# Titonova marketplace

The app is being built in stages. The live GitHub Pages preview stays untouched until the production app is ready.

## Stack

- Next.js App Router for the web application and server-side actions.
- Supabase Auth and Postgres for shared accounts, marketplace data, and row-level security.
- Vercel for hosting the server-rendered app.

## Current stage

The foundation includes email/password sign-up and sign-in, freelancer/employer roles, a member dashboard, and the first database migration for profiles, jobs, applications, and row-level security. Admin role assignment is intentionally separate from public sign-up.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
3. Apply `supabase/migrations/0001_marketplace_foundation.sql` in the Supabase SQL editor.
4. In Supabase Auth settings, enable email/password sign-in and add `http://localhost:3000/auth/callback` plus the production callback URL to the redirect allow-list.
5. Run `npm install`, then `npm run dev`.

Assign the first administrator using the Supabase SQL editor after that account has signed up:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
```

Do not put a Supabase service-role key in browser code or commit credentials. Billing and payment providers will be configured in a later stage.
