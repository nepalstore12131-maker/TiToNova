-- Append to migration without COMMIT; rollback all fixtures.
do $$
declare e uuid:=gen_random_uuid();w uuid:=gen_random_uuid();x uuid:=gen_random_uuid();oldjob uuid:=gen_random_uuid();j uuid:=gen_random_uuid();a uuid:=gen_random_uuid();i uuid;n int;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values(e,e||'@rehire.invalid','{"account_type":"employer"}'),(w,w||'@rehire.invalid','{}'),(x,x||'@rehire.invalid','{}');
 update public.profiles set employer_premium_until=now()+interval '1 day' where id=e;
 insert into public.jobs(id,employer_id,title,description,category,status,submission_key) values(oldjob,e,'Prior work fixture','Completed work fixture for rehire tests.','Development','published',gen_random_uuid());
 insert into public.applications(id,job_id,applicant_id,cover_note) values(a,oldjob,w,'Previous application fixture for rehire tests');
 insert into public.job_assignments(job_id,application_id,employer_id,worker_id,state,progress,completed_at) values(oldjob,a,e,w,'completed',100,now());
 update public.jobs set status='closed' where id=oldjob;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 insert into public.jobs(id,employer_id,title,description,category,status,submission_key) values(j,e,'Repeat work fixture','New opportunity fixture for repeat hiring.','Development','published',gen_random_uuid());
 perform public.save_previous_worker(w,true);perform public.save_previous_worker(w,true);
 select count(*) into n from public.saved_workers where worker_id=w;if n<>1 then raise exception 'Save not idempotent';end if;
 begin perform public.save_previous_worker(x,true);raise exception 'Saved unrelated worker';exception when raise_exception then if sqlerrm<>'Complete a job together before saving this worker' then raise;end if;end;
 i:=public.invite_previous_worker(w,j,'Would you like to work on this new job with us?');
 begin perform public.invite_previous_worker(w,j,'Duplicate invitation should be rejected.');raise exception 'Duplicate invitation permitted';exception when unique_violation then null;end;
 perform set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 select count(*) into n from public.rehire_invitations where id=i;if n<>0 then raise exception 'Outsider read invitation';end if;
 begin perform public.respond_rehire_invitation(i,'accept');raise exception 'Outsider accepted';exception when raise_exception then if sqlerrm<>'Only the invited worker can respond' then raise;end if;end;
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 select count(*) into n from public.saved_workers where employer_id=e;if n<>0 then raise exception 'Saved list not private';end if;
 perform public.respond_rehire_invitation(i,'accept');
 select count(*) into n from public.applications where job_id=j and applicant_id=w;if n<>1 then raise exception 'Acceptance did not create application';end if;
 select count(*) into n from public.job_assignments where job_id=j;if n<>0 then raise exception 'Acceptance assigned work automatically';end if;
 begin perform public.respond_rehire_invitation(i,'accept');raise exception 'Invitation accepted twice';exception when raise_exception then if sqlerrm<>'Invitation unavailable' then raise;end if;end;
 reset role;
end$$;
rollback;
select 'PASS: private saved list, completed-work requirement, duplicate invitation prevention, private participant invitation, recipient-only acceptance, application created once, no automatic work assignment; fixtures rolled back' as result;
