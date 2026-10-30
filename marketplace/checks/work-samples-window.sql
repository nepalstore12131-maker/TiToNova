-- Append to migration without its COMMIT. All data and schema changes roll back.
do $$
declare e uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); a uuid; n integer;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values(e,e||'@samples.invalid','{"account_type":"employer"}'),(w,w||'@samples.invalid','{}'),(x,x||'@samples.invalid','{}');
 update public.profiles set employer_premium_until=now()+interval '1 day' where id=e;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 insert into public.jobs(id,employer_id,title,description,category,status,submission_key,applications_open_at) values(j,e,'Application sample test','Temporary transactional job sample validation.','Development','published',gen_random_uuid(),now()+interval '1 day');
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 insert into public.candidate_sample_library(id,samples) values(w,'https://drive.google.com/file/d/private-example/view');
 begin perform public.submit_application_samples(j,'Valid application cover note','{}');raise exception 'Future application allowed';exception when raise_exception then if sqlerrm<>'Applications are not open for this job' then raise;end if;end;
 reset role;update public.jobs set applications_open_at=null,applications_close_at=statement_timestamp() where id=j;set local role authenticated;
 begin insert into public.applications(job_id,applicant_id,cover_note) values(j,w,'Valid application cover note');raise exception 'Closed application allowed';exception when raise_exception then if sqlerrm<>'Applications are not open for this job' then raise;end if;end;
 reset role;update public.jobs set applications_close_at=null where id=j;set local role authenticated;
 a:=public.submit_application_samples(j,'Valid application cover note','{}');
 if exists(select 1 from public.application_work_samples where application_id=a) then raise exception 'Samples shared without opt in';end if;
 insert into public.application_work_samples values(a,w,array['https://youtu.be/abcdefghijk'],now());
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
 select count(*) into n from public.candidate_sample_library where id=w;if n<>0 then raise exception 'Employer sees private library';end if;
 select count(*) into n from public.application_work_samples where application_id=a;if n<>1 then raise exception 'Employer missing shared sample';end if;
 update public.application_work_samples set links='{}' where application_id=a and author_id=w;
 get diagnostics n=row_count;if n<>0 then raise exception 'Employer edits worker samples';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 select count(*) into n from public.application_work_samples where application_id=a;if n<>0 then raise exception 'Outsider sees samples';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 update public.application_work_samples set links='{}' where application_id=a;
 if exists(select 1 from public.application_work_samples where application_id=a and cardinality(links)>0) then raise exception 'Cannot remove own links';end if;
 if public.valid_work_sample_links(array['https://drive.google.com.evil.test/file']) then raise exception 'Unsafe URL accepted';end if;
 reset role;
end$$;
rollback;
select 'PASS: private library, opt-in sharing, participant read access, owner-only changes, future/closed application rejection, optional open window, unsafe URL rejection; all tests rolled back' as result;
