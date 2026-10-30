# Titonova marketplace

The app is being built in stages. The live GitHub Pages preview stays untouched until the production app is ready.

## Stack

- Next.js App Router for the web application and server-side actions.
- Supabase Auth and Postgres for shared accounts, marketplace data, and row-level security.
- Vercel for hosting the server-rendered app.

## Current stage

The foundation includes email/password sign-up, separate freelancer/employer/admin sign-in pages, role-based workspaces, live job search, job posting and editing, job applications, profile editing, application review, and administrator tools for accounts, jobs, employer review, and job reports. Employer job posting uses a manual Premium plan: administrators set the price, duration, and payment instructions; employers submit a transaction code and private proof file; administrators approve or reject the payment and control account eligibility. Supabase Postgres and private Storage hold marketplace data and payment proofs; row-level security limits members to their own actions and payment records.

Main pages are separate: `/jobs`, `/jobs/[id]`, `/login`, `/employer/login`, `/admin/login`, `/signup`, `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/jobs`, `/dashboard/jobs/new`, `/dashboard/jobs/[id]/edit`, `/dashboard/billing`, `/dashboard/applications`, `/dashboard/applications/[id]`, `/dashboard/profile`, `/admin`, `/admin/jobs`, `/admin/listings`, `/admin/employers`, `/admin/reports`, `/admin/payments`, `/admin/payments/settings`, `/admin/applications`, and `/admin/users`.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Add the Supabase service-role key only if using administrator account management.
3. Apply `supabase/migrations/0001_marketplace_foundation.sql`, then `supabase/migrations/0002_profiles_and_application_workflows.sql`, `0003_api_access_grants.sql`, `0004_admin_profile_grants.sql`, `0005_trust_and_moderation.sql`, and `0006_employer_premium_payments.sql` in the Supabase SQL editor, in that order.
4. In Supabase Auth settings, enable email/password sign-in and email confirmations. Add `http://localhost:3000/auth/callback` plus the production callback URL to the redirect allow-list.
5. In Supabase Authentication → Email Templates → Confirm signup, replace the confirmation-link template with the code template in `supabase/email-templates/confirm-signup.html`. Set Supabase's email OTP length to 8; the app verifies an eight-digit code. For production, configure custom SMTP so confirmation email can reach all users and avoid the built-in provider's low sending limit.
6. Run `npm install`, then `npm run dev`.

Assign the first administrator using the Supabase SQL editor after that account has signed up:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_ADMIN_EMAIL');
```

Do not put a Supabase service-role key in browser code or commit credentials. For production account management, add `SUPABASE_SERVICE_ROLE_KEY` to Vercel as a server-only environment variable. Admins can create, edit, reset, and remove accounts, manage listings and applications, review employer details, resolve job reports, review private payment proofs, set Premium pricing and payment instructions, and change employer access. Employers cannot post until an administrator approves a payment or manually enables access. The current billing flow is manual and does not verify transactions with eSewa or Khalti automatically; configure account details in `/admin/payments/settings` before accepting payments.

## Not connected yet

Automated eSewa or Khalti checkout and server-side provider verification are not connected. Until then, manual administrator review is the only way payment submissions become Premium access.

## Premium discovery and conversations

Apply `supabase/migrations/0007_premium_workspace.sql` before deploying this release. It adds work arrangement and experience fields, a public company-details function with an explicit safe column list, private application messages, reports, and moderation controls. Only application participants can read messages; employers require active Premium. Admins can review reports at `/admin/messages`, inspect the thread, hide or restore a message, pause or resume a conversation, and resolve or dismiss a report. Sending is limited to active applications and ten messages per minute per sender; hidden content is excluded from participant API results. Existing payment settings and prices are preserved.

Discovery at `/jobs` includes category, city, work arrangement, job type, experience and minimum advertised NPR pay and pay-period filters, pagination, and optional profile-skill matching over the newest 120 matching jobs. This is deterministic matching, not a hiring prediction. Company pages live at `/companies/[id]`. Nepali landing and search pages live at `/ne` and `/jobs?lang=ne`; account administration is currently English. Nepali date rendering uses Nepali digits with the Gregorian calendar, and message times use Nepal time.

The web app includes PNG home-screen icons, a manifest, an install prompt where supported, and an offline explanation. On iOS, use Safari’s Share → Add to Home Screen. Only the public offline explanation is cached; authenticated pages, conversations, and payment data are never cached by the service worker.

## Candidate careers and hiring board

Migration 0008 adds private candidate career details and PDF CV storage, applicant-visible hiring stages, and private employer notes. Job seekers edit these in `/dashboard/profile`. Premium employers use `/dashboard/hiring` and application details to compare candidates and record stages/notes. CV files are private, limited to 5 MB, and downloaded through ten-minute signed links. Career details and CVs are limited to their owner, relevant active Premium employers, and admins. Stage/notes updates use an atomic RPC that checks employer ownership and active Premium; withdrawn applications cannot be reviewed. Marking a stage records a team decision and does not send a formal job offer.

## In-app notifications

Migration 0009 creates recipient-only notifications from trusted database triggers: applications, messages, hiring-stage changes, withdrawals, Premium payment reviews, and listing reviews. Members can mark only their own notifications read; clients cannot insert or alter event details. Alerts contain generic titles and workspace links, never private message text, CV data or employer notes. The workspace bell refreshes unread counts every 30 seconds while the page is visible. `/dashboard/notifications` supports all/unread views, pagination and marking one/all read. Email delivery and scheduled reminders are not included.

`checks/notification-journey.sql` exercises the database journey using rolled-back fixtures: posting blocked before Premium, payment approval, employer job submission, admin publication, applicant submission, messaging, hiring stages, recipient isolation, forgery prevention, mark-read and note privacy. It does not validate real signup email delivery, payment-provider transfers, or browser CV upload.

## Interview invitations

Migration 0010 adds `/dashboard/interviews` and proposal forms within active application details. Premium employers propose a future date within 180 days, a 15–240 minute duration and HTTPS meeting link or location. Inputs and displays use Nepal time (UTC+05:45). Applicants accept, decline or request another time; employers can cancel existing invitations even after Premium expires. A replacement invalidates the old proposal and requires fresh candidate acceptance. Account locks serialize scheduling checks to reject overlapping active invitations. Rejected/withdrawn applications automatically cancel active invitations. Private details are visible only to the applicant, employer and admins. Generic in-app notifications announce proposals, responses and cancellations. There are no email, calendar or scheduled reminders in this release.
