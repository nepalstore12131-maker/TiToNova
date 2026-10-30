-- Permission checks use disposable fixtures and roll back every change.
rollback;
begin;
do $$
declare
 employer uuid:=gen_random_uuid(); applicant uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); administrator uuid:=gen_random_uuid(); job uuid:=gen_random_uuid();
 path text; employer_path text; n integer;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values
 (employer,employer::text||'@titonova-check.invalid','{"account_type":"employer"}'),
 (applicant,applicant::text||'@titonova-check.invalid','{}'),
 (outsider,outsider::text||'@titonova-check.invalid','{}'),
 (administrator,administrator::text||'@titonova-check.invalid','{}');
 update public.profiles set employer_premium_until=now()+interval '1 day' where id=employer;
 update public.profiles set role='admin' where id=administrator;
 insert into public.jobs(id,employer_id,title,description,category,status) values(job,employer,'Photo access check','Temporary permission verification job description.','Development','published');
 insert into public.applications(job_id,applicant_id,cover_note) values(job,applicant,'Temporary permission check application.');
 path:=applicant::text||'/'||gen_random_uuid()::text||'.webp';
 employer_path:=employer::text||'/'||gen_random_uuid()::text||'.webp';
 insert into public.profile_photos(id,object_path) values(employer,employer_path);
 perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
 set local role authenticated;
 insert into storage.objects(bucket_id,name) values('profile-photos',path);
 insert into public.profile_photos(id,object_path) values(applicant,path);
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>1 then raise exception 'Owner cannot read own photo'; end if;
 begin
 update public.profile_photos set object_path=employer_path where id=applicant;
 raise exception 'Foreign object path accepted';
 exception when check_violation or unique_violation then null; end;
 perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>0 then raise exception 'Unrelated member reads candidate photo'; end if;
 select count(*) into n from storage.objects where bucket_id='profile-photos' and name=path;
 if n<>0 then raise exception 'Unrelated member reads candidate file'; end if;
 update public.profile_photos set updated_at=now() where id=applicant;
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Unrelated member edits photo'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>1 then raise exception 'Relevant Premium employer cannot read candidate photo'; end if;
 select count(*) into n from storage.objects where bucket_id='profile-photos' and name=path;
 if n<>1 then raise exception 'Relevant employer cannot read candidate file'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true);
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>1 then raise exception 'Admin cannot read candidate photo'; end if;
 update public.profiles set employer_premium_until=now()-interval '1 day' where id=employer;
 perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>0 then raise exception 'Expired employer reads candidate photo'; end if;
 reset role;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>0 then raise exception 'Anonymous reads candidate photo'; end if;
 select count(*) into n from public.profile_photos where id=employer;
 if n<>1 then raise exception 'Published employer photo not public'; end if;
 reset role;
 perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
 set local role authenticated;
 delete from public.profile_photos where id=applicant;
 select count(*) into n from public.profile_photos where id=applicant;
 if n<>0 then raise exception 'Owner cannot unlink photo'; end if;
 reset role;
end;
$$;
rollback;
select 'PASS: owner, outsider, relevant Premium employer, expired employer, admin, public company, private candidate and owner unlink checks; all fixtures rolled back' as result;
