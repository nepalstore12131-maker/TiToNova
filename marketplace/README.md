# Titonova marketplace

The app is being built in stages. The live GitHub Pages preview stays untouched until the production app is ready.

## Stack

- Next.js App Router for the web application and server-side actions.
- Supabase Auth and Postgres for shared accounts, marketplace data, and row-level security.
- Vercel for hosting the server-rendered app.

## Current stage

The foundation includes email/password sign-up, separate freelancer/employer/admin sign-in pages, role-based workspaces, live job search, job posting and editing, job applications, profile editing, application review, and an administrator workspace for accounts, jobs, and applications. Supabase Postgres stores accounts, profiles, jobs, and applications; row-level security limits each member to the actions their role permits. Admin role assignment is intentionally separate from public sign-up.

Main pages are separate: `/jobs`, `/jobs/[id]`, `/login`, `/employer/login`, `/admin/login`, `/signup`, `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/jobs`, `/dashboard/jobs/new`, `/dashboard/jobs/[id]/edit`, `/dashboard/applications`, `/dashboard/applications/[id]`, `/dashboard/profile`, `/admin`, `/admin/jobs`, `/admin/listings`, `/admin/applications`, and `/admin/users`.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Add the Supabase service-role key only if using administrator account management.
3. Apply `supabase/migrations/0001_marketplace_foundation.sql`, then `supabase/migrations/0002_profiles_and_application_workflows.sql`, `0003_api_access_grants.sql`, and `0004_admin_profile_grants.sql`, in the Supabase SQL editor, in that order.
4. In Supabase Auth settings, enable email/password sign-in and email confirmations. Add `http://localhost:3000/auth/callback` plus the production callback URL to the redirect allow-list.
5. In Supabase Authentication → Email Templates → Confirm signup, replace the confirmation-link template with the code template in `supabase/email-templates/confirm-signup.html`. The app verifies the six-digit code using Supabase Auth. For production, configure custom SMTP so confirmation email can reach all users and avoid the built-in provider's low sending limit.
6. Run `npm install`, then `npm run dev`.

Assign the first administrator using the Supabase SQL editor after that account has signed up:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
```

Do not put a Supabase service-role key in browser code or commit credentials. For production account management, add `SUPABASE_SERVICE_ROLE_KEY` to Vercel as a server-only environment variable. Admins can create, edit, reset, and remove accounts, and manage listings and applications. Passwords are never readable; setting a password replaces the old one. Billing and payment providers will be configured in a later stage.

## Not connected yet

The current application backend does not charge members or employers. Payment plans and checkout need a selected provider and business rules before they can be safely implemented.
