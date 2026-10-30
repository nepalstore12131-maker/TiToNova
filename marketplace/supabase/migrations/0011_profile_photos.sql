begin;
create table public.profile_photos (
 id uuid primary key references public.profiles(id) on delete cascade,
 object_path text not null unique,
 updated_at timestamptz not null default now(),
 constraint own_photo_path check (object_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$'))
);
alter table public.profile_photos enable row level security;
create function public.can_read_profile_photo(p_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=p_id and (
 p.id=auth.uid() or public.is_admin()
 or (p.role='employer' and exists(select 1 from public.jobs j where j.employer_id=p.id and j.status='published'))
 or (p.role='freelancer' and public.has_active_employer_premium() and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id where a.applicant_id=p.id and j.employer_id=auth.uid()))
 ));
$$;
revoke all on function public.can_read_profile_photo(uuid) from public;
grant execute on function public.can_read_profile_photo(uuid) to anon,authenticated;
grant select on public.profile_photos to anon,authenticated;
grant insert,update,delete on public.profile_photos to authenticated;
grant all on public.profile_photos to service_role;
create policy "Photo visibility follows work relationships" on public.profile_photos for select to anon,authenticated using(public.can_read_profile_photo(id));
create policy "Members add own photo" on public.profile_photos for insert to authenticated with check(id=auth.uid() and public.current_account_role() in ('freelancer','employer'));
create policy "Members replace own photo" on public.profile_photos for update to authenticated using(id=auth.uid()) with check(id=auth.uid() and public.current_account_role() in ('freelancer','employer'));
create policy "Members remove own photo" on public.profile_photos for delete to authenticated using(id=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',false,1048576,array['image/webp']);
create policy "Members upload own photo files" on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and public.current_account_role() in ('freelancer','employer'));
create policy "View linked permitted photo files" on storage.objects for select to anon,authenticated using(bucket_id='profile-photos' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.profile_photos p where p.object_path=storage.objects.name)));
create policy "Members clean up unlinked photo files" on storage.objects for delete to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.profile_photos p where p.object_path=storage.objects.name));
commit;
