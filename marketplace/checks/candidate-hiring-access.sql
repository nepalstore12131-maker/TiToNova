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
select 'PASS — career access, hiring stage protection, private notes and conversation checks; all fixtures rolled back' as result;
