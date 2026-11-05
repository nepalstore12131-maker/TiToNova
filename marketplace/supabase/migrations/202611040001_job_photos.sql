-- Run in Supabase SQL editor before enabling job photo uploads.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('job-photos','job-photos',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create table if not exists public.job_photos (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.jobs(id) on delete cascade,
 employer_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,
 created_at timestamptz not null default now()
);
create index if not exists job_photos_job_id_idx on public.job_photos(job_id);
alter table public.job_photos enable row level security;
create policy "Published job photos readable" on public.job_photos for select using (
 exists(select 1 from public.jobs j where j.id=job_id and j.status='published')
 or employer_id=auth.uid()
);
create policy "Employer can attach job photos" on public.job_photos for insert to authenticated with check (
 employer_id=auth.uid() and exists(select 1 from public.jobs j where j.id=job_id and j.employer_id=auth.uid())
);
create policy "Employer can remove job photos" on public.job_photos for delete to authenticated using (employer_id=auth.uid());
create policy "Employer uploads own job images" on storage.objects for insert to authenticated with check (
 bucket_id='job-photos' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "Employer deletes own job images" on storage.objects for delete to authenticated using (
 bucket_id='job-photos' and (storage.foldername(name))[1]=auth.uid()::text
);

grant select on public.job_photos to anon;
grant select,insert,delete on public.job_photos to authenticated;
grant all on public.job_photos to service_role;
-- Storage DELETE also needs a SELECT policy for the owner's objects.
create policy "Employer reads own job image objects" on storage.objects for select to authenticated using (
 bucket_id='job-photos' and (storage.foldername(name))[1]=auth.uid()::text
);

-- Anonymous viewers can obtain short-lived links only for published job photos.
create policy "Published job image objects readable" on storage.objects for select to anon,authenticated using (
 bucket_id='job-photos' and exists (
 select 1 from public.job_photos p join public.jobs j on j.id=p.job_id
 where p.object_path=name and j.status='published' and j.archived_at is null
 )
);
