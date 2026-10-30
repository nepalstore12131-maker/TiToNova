begin;
create table public.advertising_plans (
 id uuid primary key default gen_random_uuid(),name text not null check(char_length(name) between 2 and 80),
 placement text not null check(placement in ('home','jobs')),daily_price_npr integer not null default 0 check(daily_price_npr between 0 and 1000000),
 max_days integer not null default 30 check(max_days between 1 and 90),width integer not null default 1600 check(width between 600 and 2400),height integer not null default 400 check(height between 150 and 1200),
 max_mb integer not null default 2 check(max_mb between 1 and 2),requirements text not null default 'Use clear, truthful artwork that you own or have permission to advertise.' check(char_length(requirements)<=2000),
 active boolean not null default false,revision timestamptz not null default clock_timestamp(),check(width::numeric/height between 2 and 6),check(not active or daily_price_npr>0)
);
insert into public.advertising_plans(name,placement) values('Homepage banner','home'),('Job search banner','jobs');
alter table public.advertising_plans enable row level security;
revoke all on public.advertising_plans from anon,authenticated;
grant select,insert,update on public.advertising_plans to authenticated;
create policy "Members read ad plans" on public.advertising_plans for select to authenticated using(true);
create policy "Admins edit ad plans" on public.advertising_plans for all to authenticated using(public.is_admin()) with check(public.is_admin());
create function public.touch_ad_plan() returns trigger language plpgsql set search_path=public as $$begin new.revision:=clock_timestamp();return new;end;$$;
create trigger ad_plan_revision before update on public.advertising_plans for each row execute function public.touch_ad_plan();
alter table public.sponsor_banners add column image_bucket text not null default 'sponsor-banners' check(image_bucket in ('sponsor-banners','advertising-artwork'));
create table public.advertising_requests (
 id uuid primary key,employer_id uuid not null references public.profiles(id),plan_id uuid not null references public.advertising_plans(id),plan_name text not null,
 placement text not null check(placement in ('home','jobs')),daily_price_npr integer not null check(daily_price_npr>0),days integer not null check(days between 1 and 90),amount_npr integer not null check(amount_npr=daily_price_npr*days),
 width integer not null,height integer not null,requirements text not null,
 advertiser text not null check(char_length(advertiser) between 2 and 100),title text not null check(char_length(title) between 2 and 140),alt_text text not null check(char_length(alt_text) between 2 and 200),target_url text not null check(target_url ~ '^https://[^/[:space:]@]+'),
 artwork_path text not null unique,proof_path text not null unique,method text not null check(method in ('esewa','khalti','bank')),transaction_code text not null check(char_length(transaction_code) between 4 and 120),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),review_note text not null default '' check(char_length(review_note)<=1000),
 banner_id uuid unique references public.sponsor_banners(id),reviewed_by uuid references public.profiles(id),reviewed_at timestamptz,created_at timestamptz not null default now()
);
alter table public.advertising_requests enable row level security;
revoke all on public.advertising_requests from public,anon,authenticated;
grant select on public.advertising_requests to authenticated;
create policy "Private advertiser request history" on public.advertising_requests for select to authenticated using(employer_id=auth.uid() or public.is_admin());
create policy "Advertisers see own banner lifecycle" on public.sponsor_banners for select to authenticated using(exists(select 1 from public.advertising_requests r where r.banner_id=sponsor_banners.id and r.employer_id=auth.uid()));
create trigger ad_claim_transaction before insert on public.advertising_requests for each row execute function public.claim_payment_transaction();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('advertising-artwork','advertising-artwork',false,2097152,array['image/webp']),
 ('advertising-proofs','advertising-proofs',false,2097152,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy "Advertisers upload own files" on storage.objects for insert to authenticated with check(bucket_id in ('advertising-artwork','advertising-proofs') and (storage.foldername(name))[1]=auth.uid()::text and public.current_account_role()='employer');
create policy "Private ad submission files" on storage.objects for select to authenticated using(bucket_id in ('advertising-artwork','advertising-proofs') and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy "Only published artwork is public" on storage.objects for select to anon,authenticated using(bucket_id='advertising-artwork' and exists(select 1 from public.sponsor_banners b where b.image_bucket='advertising-artwork' and b.image_path=name and b.active and b.starts_at<=now() and (b.ends_at is null or b.ends_at>now())));
create policy "Advertisers clean unused uploads" on storage.objects for delete to authenticated using(bucket_id in ('advertising-artwork','advertising-proofs') and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.advertising_requests r where (bucket_id='advertising-artwork' and r.artwork_path=name) or (bucket_id='advertising-proofs' and r.proof_path=name)));
create function public.request_banner_ad(p_id uuid,p_plan uuid,p_revision timestamptz,p_days integer,p_advertiser text,p_title text,p_alt text,p_url text,p_artwork text,p_proof text,p_method text,p_transaction text) returns uuid language plpgsql security definer set search_path=public as $$
declare plan public.advertising_plans%rowtype;s public.employer_payment_settings%rowtype;existing public.advertising_requests%rowtype;
begin
 if auth.uid() is null or public.current_account_role() is distinct from 'employer' then raise exception 'Employer account required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from public.advertising_requests where id=p_id;
 if existing.id is not null then if existing.employer_id=auth.uid() then return existing.id;else raise exception 'Request unavailable';end if;end if;
 select * into plan from public.advertising_plans where id=p_plan for share;
 if plan.id is null or not plan.active or plan.daily_price_npr<1 or p_revision is distinct from plan.revision or p_days is null or p_days not between 1 and plan.max_days then raise exception 'Plan changed; reload before paying';end if;
 select * into s from public.employer_payment_settings where id=1;
 if s.id is null or not ((p_method='esewa' and coalesce(s.esewa_account_id,'')<>'') or (p_method='khalti' and (coalesce(s.khalti_account_id,'')<>'' or coalesce(s.khalti_payment_url,'')<>'')) or (p_method='bank' and coalesce(s.bank_name,'')<>'' and coalesce(s.bank_account_number,'')<>'')) then raise exception 'Payment method unavailable';end if;
 if p_artwork is distinct from auth.uid()::text||'/'||p_id::text||'.webp' or split_part(p_proof,'/',1) is distinct from auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='advertising-artwork' and name=p_artwork) or not exists(select 1 from storage.objects where bucket_id='advertising-proofs' and name=p_proof) then raise exception 'Uploads required';end if;
 insert into public.advertising_requests(id,employer_id,plan_id,plan_name,placement,daily_price_npr,days,amount_npr,width,height,requirements,advertiser,title,alt_text,target_url,artwork_path,proof_path,method,transaction_code)
 values(p_id,auth.uid(),plan.id,plan.name,plan.placement,plan.daily_price_npr,p_days,plan.daily_price_npr*p_days,plan.width,plan.height,plan.requirements,btrim(p_advertiser),btrim(p_title),btrim(p_alt),p_url,p_artwork,p_proof,p_method,btrim(p_transaction));
 insert into public.notifications(recipient_id,kind,title,href) select id,'advertising','A banner and payment need review','/dashboard/advertising' from public.profiles where role='admin';
 return p_id;
end;$$;
create function public.review_banner_ad(p_request uuid,p_approve boolean,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare r public.advertising_requests%rowtype;banner uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin required';end if;
 -- Serialize approval with manual banner writes so a paid ad cannot start off-screen.
 lock table public.sponsor_banners in share row exclusive mode;
 select * into r from public.advertising_requests where id=p_request for update;
 if r.id is null or r.status<>'pending' or p_approve is null or char_length(coalesce(p_note,''))>1000 then raise exception 'Request unavailable';end if;
 if not p_approve and char_length(btrim(coalesce(p_note,'')))<5 then raise exception 'Rejection reason required';end if;
 if p_approve then
  if (select count(*) from public.sponsor_banners where placement=r.placement and active and starts_at<now()+make_interval(days=>r.days) and (ends_at is null or ends_at>now()))>=2 then raise exception 'Placement full; keep pending until space is available';end if;
  insert into public.sponsor_banners(advertiser,title,image_path,image_bucket,target_url,alt_text,placement,sort_order,active,starts_at,ends_at) values(r.advertiser,r.title,r.artwork_path,'advertising-artwork',r.target_url,r.alt_text,r.placement,10,true,now(),now()+make_interval(days=>r.days)) returning id into banner;
 end if;
 update public.advertising_requests set status=case when p_approve then 'approved' else 'rejected' end,banner_id=banner,review_note=coalesce(p_note,''),reviewed_by=auth.uid(),reviewed_at=now() where id=r.id;
 insert into public.notifications(recipient_id,kind,title,href) values(r.employer_id,'advertising',case when p_approve then 'Your banner advertisement is live' else 'Your banner request needs attention' end,'/dashboard/advertising');
end;$$;
-- Prevent manual ads from displacing a paid banner that is already running.
create function public.guard_banner_capacity() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(735921);
 if new.active and (new.ends_at is null or new.ends_at>now()) and (select count(*) from public.sponsor_banners b where b.id<>new.id and b.placement=new.placement and b.active and (b.ends_at is null or b.ends_at>greatest(new.starts_at,now())) and (new.ends_at is null or b.starts_at<new.ends_at))>=2 then raise exception 'At most two overlapping banners per placement';end if;
 return new;
end;$$;
create trigger banner_capacity before insert or update on public.sponsor_banners for each row execute function public.guard_banner_capacity();
revoke all on function public.request_banner_ad(uuid,uuid,timestamptz,integer,text,text,text,text,text,text,text,text),public.review_banner_ad(uuid,boolean,text),public.guard_banner_capacity(),public.touch_ad_plan() from public;
grant execute on function public.request_banner_ad(uuid,uuid,timestamptz,integer,text,text,text,text,text,text,text,text),public.review_banner_ad(uuid,boolean,text) to authenticated;
commit;
