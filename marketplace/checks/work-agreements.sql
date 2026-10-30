-- Append after migration without its COMMIT; do not retain fixtures.
do $$
declare e uuid:=gen_random_uuid();w uuid:=gen_random_uuid();x uuid:=gen_random_uuid();j uuid:=gen_random_uuid();a uuid:=gen_random_uuid();assignment uuid;v1 uuid;v2 uuid;v3 uuid;v4 uuid;n integer;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into auth.users(id,email,raw_user_meta_data) values(e,e||'@agreements.invalid','{"account_type":"employer"}'),(w,w||'@agreements.invalid','{}'),(x,x||'@agreements.invalid','{}');
 update public.profiles set employer_premium_until=now()+interval '1 day' where id=e;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);set local role authenticated;
 insert into public.jobs(id,employer_id,title,description,category,status,submission_key) values(j,e,'Agreement test','Temporary job for agreement permission tests.','Development','published',gen_random_uuid());reset role;
 insert into public.applications(id,job_id,applicant_id,cover_note) values(a,j,w,'Test application for work agreement validation');set local role authenticated;
 assignment:=public.assign_job_worker(a);
 if not exists(select 1 from public.job_assignments where id=assignment and agreement_required) then raise exception 'New assignment not protected';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 begin perform public.update_job_work(assignment,'start');raise exception 'Started without agreement';exception when raise_exception then if sqlerrm<>'Accept the current work agreement before starting' then raise;end if;end;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
 v1:=public.propose_work_agreement(assignment,null,'Create the agreed design and deliver the source files.',5000,'project','bank','Within two days after completion','About one day; no fixed deadline');
 begin perform public.respond_work_agreement(v1,true);raise exception 'Hirer accepted for worker';exception when raise_exception then if sqlerrm<>'Agreement response unavailable' then raise;end if;end;
 v2:=public.propose_work_agreement(assignment,v1,'Create two agreed designs and deliver the source files.',6000,'project','bank','Within two days after completion','About two days; no fixed deadline');
 perform set_config('request.jwt.claims',json_build_object('sub',x,'role','authenticated')::text,true);
 select count(*) into n from public.work_agreements where assignment_id=assignment;if n<>0 then raise exception 'Outsider reads agreement';end if;
 begin perform public.respond_work_agreement(v2,true);raise exception 'Outsider accepted agreement';exception when raise_exception then if sqlerrm<>'Agreement response unavailable' then raise;end if;end;
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 begin perform public.respond_work_agreement(v1,true);raise exception 'Stale proposal accepted';exception when raise_exception then if sqlerrm<>'Agreement response unavailable' then raise;end if;end;
 perform public.respond_work_agreement(v2,false,'Please clarify the delivery format.');
 begin perform public.update_job_work(assignment,'start');raise exception 'Changes requested but started';exception when raise_exception then if sqlerrm<>'Accept the current work agreement before starting' then raise;end if;end;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
 v3:=public.propose_work_agreement(assignment,v2,'Create two agreed designs and deliver editable source files.',6000,'project','bank','Within two days after completion','About two days; no fixed deadline');
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);perform public.respond_work_agreement(v3,true);
 -- A new proposal invalidates an earlier acceptance.
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
 v4:=public.propose_work_agreement(assignment,v3,'Create two agreed designs and deliver editable source files.',6500,'project','bank','Within two days after completion','About two days; no fixed deadline');
 perform set_config('request.jwt.claims',json_build_object('sub',w,'role','authenticated')::text,true);
 begin perform public.update_job_work(assignment,'start');raise exception 'Old acceptance bypassed new proposal';exception when raise_exception then if sqlerrm<>'Accept the current work agreement before starting' then raise;end if;end;
 -- Simulate a changed schedule; proposal snapshots must no longer be accepted.
 reset role;update public.job_assignments set scheduled_start_at=now()+interval '1 day' where id=assignment;set local role authenticated;
 begin perform public.respond_work_agreement(v4,true);raise exception 'Outdated schedule accepted';exception when raise_exception then if sqlerrm<>'Agreement changed; ask the hirer for a current proposal' then raise;end if;end;
 reset role;update public.job_assignments set scheduled_start_at=null where id=assignment;set local role authenticated;
 perform public.respond_work_agreement(v4,true);
 perform public.update_job_work(assignment,'start');
 if not exists(select 1 from public.job_assignments where id=assignment and state='in_progress') then raise exception 'Accepted work did not start';end if;
 select count(*) into n from public.work_agreements where assignment_id=assignment;if n<>4 then raise exception 'Version history lost';end if;
 perform set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
 begin perform public.propose_work_agreement(assignment,v4,'Change work after it has already started.',1,'project','cash','Today after work','Today');raise exception 'Started terms modified';exception when raise_exception then if sqlerrm<>'Agreement proposal unavailable' then raise;end if;end;
 reset role;
end$$;
rollback;
select 'PASS: required agreement for new work, start blocked before consent, private access, no proxy acceptance, stale version rejection, change requests, preserved history, accepted start, locked terms after start; fixtures rolled back' as result;
