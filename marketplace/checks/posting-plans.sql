-- Run against a disposable migrated Supabase database.
begin;
do $$
declare
  employer uuid := gen_random_uuid(); admin_user uuid := gen_random_uuid();
  payment uuid; allowance record;
begin
  insert into auth.users(id,email,raw_user_meta_data)
    values(employer,employer||'@example.invalid','{"account_type":"employer"}'),
          (admin_user,admin_user||'@example.invalid','{}');
  update public.profiles set role='admin' where id=admin_user;
  update public.employer_payment_settings set free_posts=1,single_post_npr=100,bank_name='Fixture',bank_account_number='test' where id=1;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',employer,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.jobs(employer_id,title,description,category,status) values(employer,'First listing','A sample employer listing used in a rollback test.','Other','pending_review');
  select * into allowance from public.post_allowance();
  if allowance.free_left<>0 then raise exception 'Free post was not counted'; end if;
  begin
    insert into public.jobs(employer_id,title,description,category,status) values(employer,'Another listing','This attempt should exceed the free allowance.','Other','pending_review');
    raise exception 'Exceeded free posting allowance';
  exception when raise_exception then if sqlerrm<>'posting_limit_reached' then raise; end if; end;
  insert into public.employer_payment_requests(employer_id,product,payment_method,transaction_code,amount_npr,plan_duration_days,proof_path)
    values(employer,'post','bank',gen_random_uuid()::text,100,1,employer||'/fixture.pdf') returning id into payment;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
  perform public.approve_employer_payment_request(payment);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',employer,'role','authenticated')::text,true);
  select * into allowance from public.post_allowance();
  if allowance.credits_left<>1 or allowance.premium_active then raise exception 'Incorrect one-post entitlement'; end if;
  insert into public.jobs(employer_id,title,description,category,status) values(employer,'Prepaid role','This listing consumes the purchased credit.','Other','pending_review');
  select * into allowance from public.post_allowance();
  if allowance.credits_left<>0 then raise exception 'Purchased post was not counted'; end if;
  reset role;
end;$$;
rollback;
