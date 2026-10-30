-- Run in SQL Editor as postgres. All fixtures are rolled back; no accounts,
-- listings, applications, messages, reports or settings persist.
begin;
do $$
declare
  employer uuid := gen_random_uuid();
  applicant uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  administrator uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  application uuid := gen_random_uuid();
  message uuid := gen_random_uuid();
  n integer;
  invitation uuid; replacement uuid; second_job uuid:=gen_random_uuid(); second_application uuid:=gen_random_uuid();
begin
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  insert into auth.users(id,email,raw_user_meta_data) values
    (employer,employer::text||'@titonova-check.invalid','{"account_type":"employer"}'),
    (applicant,applicant::text||'@titonova-check.invalid','{}'),
    (outsider,outsider::text||'@titonova-check.invalid','{}'),
    (administrator,administrator::text||'@titonova-check.invalid','{}');
  update public.profiles set employer_premium_until=now()+interval '1 day' where id=employer;
  update public.profiles set role='admin' where id=administrator;
  insert into public.jobs(id,employer_id,title,description,category,status) values(job,employer,'Access check role','Temporary job description for permission verification only.','Development','published');
  insert into public.applications(id,job_id,applicant_id,cover_note) values(application,job,applicant,'Temporary application used only within this transaction.');

  insert into public.jobs(id,employer_id,title,description,category,status) values(second_job,employer,'Second interview role','A temporary second listing for overlap verification only.','Development','published');
  insert into public.applications(id,job_id,applicant_id,cover_note) values(second_application,second_job,applicant,'A temporary second application for scheduling checks.');
  insert into public.candidate_profiles(id,work_history) values(applicant,'Temporary career history');
  perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.application_messages(id,application_id,sender_id,body) values(message,application,applicant,'Permission verification message');
  select count(*) into n from public.application_messages where id=message;
  if n<>1 then raise exception 'Applicant cannot read own conversation'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
  select count(*) into n from public.application_messages where id=message;
  if n<>0 then raise exception 'Outsider can read a private message'; end if;
  select count(*) into n from public.candidate_profiles where id=applicant;
  if n<>0 then raise exception 'Unrelated member can read career details'; end if;
  begin
    insert into public.application_messages(application_id,sender_id,body) values(application,outsider,'Should be blocked');
    raise exception 'Outsider can send messages';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
  select count(*) into n from public.application_messages where id=message;
  if n<>1 then raise exception 'Premium employer cannot read conversation'; end if;
  invitation:=public.propose_interview(application,now()+interval '3 days',30,'https://example.com/meeting','','Prepare a work sample');
  begin
    perform public.propose_interview(second_application,now()+interval '3 days 10 minutes',30,'','Office','');
    raise exception 'Conflicting interview accepted';
  exception when raise_exception then
    if sqlerrm <> 'Interview overlaps another active invitation' then raise; end if;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',outsider,'role','authenticated')::text,true);
  select count(*) into n from public.interviews where id=invitation;
  if n<>0 then raise exception 'Unrelated user can read interview'; end if;
  begin
    perform public.respond_interview(invitation,'accepted','');
    raise exception 'Outsider accepted invitation';
  exception when raise_exception then
    if sqlerrm <> 'Interview unavailable' then raise; end if;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
  perform public.respond_interview(invitation,'accepted','Confirmed');
  select count(*) into n from public.interviews where id=invitation and status='accepted';
  if n<>1 then raise exception 'Acceptance not saved'; end if;
  begin
    perform public.respond_interview(invitation,'declined','');
    raise exception 'Duplicate response accepted';
  exception when raise_exception then
    if sqlerrm <> 'This invitation is no longer awaiting your response' then raise; end if;
  end;
  perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
  replacement:=public.propose_interview(application,now()+interval '4 days',45,'','Office','');
  select count(*) into n from public.interviews where id=invitation and status='superseded';
  if n<>1 then raise exception 'Previous invitation not superseded'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
  perform public.respond_interview(replacement,'reschedule_requested','Please suggest next week');
  perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
  replacement:=public.propose_interview(application,now()+interval '5 days',30,'','Office','');
  perform public.respond_interview(replacement,'cancelled','');
  select count(*) into n from public.interviews where id=replacement and status='cancelled';
  if n<>1 then raise exception 'Cancellation not saved'; end if;
  replacement:=public.propose_interview(second_application,now()+interval '7 days',30,'','Office','');
  perform public.save_hiring_review(second_application,'rejected','');
  select count(*) into n from public.interviews where id=replacement and status='cancelled';
  if n<>1 then raise exception 'Rejection did not cancel invitation'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
  select count(*) into n from public.notifications where recipient_id=applicant and kind='interview';
  if n<3 then raise exception 'Interview alerts missing'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
  perform public.save_hiring_review(application,'interview','Private test note');
  select count(*) into n from public.hiring_reviews where application_id=application;
  if n<>1 then raise exception 'Employer cannot read own hiring notes'; end if;
  select count(*) into n from public.candidate_profiles where id=applicant;
  if n<>1 then raise exception 'Employer cannot read relevant career details'; end if;
  insert into public.message_reports(message_id,reporter_id,reason) values(message,employer,'other');

  perform set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true);
  update public.application_messages set hidden=true where id=message;
  select count(*) into n from public.application_messages where id=message;
  if n<>1 then raise exception 'Admin cannot inspect hidden message'; end if;
  insert into public.conversation_controls(application_id,paused,updated_by) values(application,true,administrator);

  perform set_config('request.jwt.claims',json_build_object('sub',applicant,'role','authenticated')::text,true);
  select count(*) into n from public.application_messages where id=message;
  if n<>0 then raise exception 'Participant can read hidden content'; end if;
  select count(*) into n from public.hiring_reviews where application_id=application;
  if n<>0 then raise exception 'Applicant can read private employer notes'; end if;
  begin
    update public.applications set hiring_stage='hired' where id=application;
    get diagnostics n = row_count;
    if n>0 then raise exception 'Applicant can change hiring stage'; end if;
  exception when raise_exception then
    if sqlerrm <> 'Only the hiring team can change hiring stages' then raise; end if;
  end;
  begin
    insert into public.application_messages(application_id,sender_id,body) values(application,applicant,'Should be paused');
    raise exception 'Paused conversation accepts messages';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims',json_build_object('sub',administrator,'role','authenticated')::text,true);
  update public.profiles set employer_premium_until=now()-interval '1 day' where id=employer;
  perform set_config('request.jwt.claims',json_build_object('sub',employer,'role','authenticated')::text,true);
  if public.can_read_conversation(application) then raise exception 'Expired employer retains message access'; end if;
  select count(*) into n from public.candidate_profiles where id=applicant;
  if n<>0 then raise exception 'Expired employer can read career details'; end if;
  reset role;
  raise notice 'PASS: applicant, Premium employer, outsider isolation, reports, admin moderation, hidden content, paused conversation, expired Premium';
end;
$$;
rollback;
select 'PASS — interview proposals, acceptance, overlap prevention, replacement, cancellation, privacy and alerts; fixtures rolled back' as result;
