-- Run in Supabase SQL editor before enabling job photo uploads.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('job-photos','job-photos',true,3145728,array['image/jpeg','image/png','image/webp'])
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
