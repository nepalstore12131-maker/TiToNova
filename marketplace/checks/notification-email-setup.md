# Notification email setup

The Auth SMTP configuration only sends authentication emails. Application notifications use the Resend API separately.

Set these **server-only** production variables in Vercel (never NEXT_PUBLIC_):
- RESEND_API_KEY: a Resend sending key authorized for the verified sender domain.
- NOTIFICATION_EMAIL_FROM: a sender on that verified domain, e.g. Titonova <notifications@titonova.com> only if that domain is verified for sending.
- NOTIFICATION_EMAIL_ENABLED: true after configuration is ready.
- CRON_SECRET: a long randomly generated secret for the retry endpoint.
- SUPABASE_SERVICE_ROLE_KEY: existing server-only Supabase key.

Redeploy after changing environment variables. Do not paste keys into chat or commit them.

Preferences default to no notification emails. Members opt into individual types. Auth/security emails are separate. New category/keyword alerts require job alerts enabled and a category or keyword; optional location narrows results. No historical backfill.

Delivery is queued durably in Supabase. Job creation, hiring invitations, admin review and notices attempt a batch after the request. Authenticated notification-bell polling also drains batches. A daily Vercel cron retries when the site is quiet. This is not an instant-delivery guarantee; high-volume/offline delivery needs a more frequent authenticated scheduler for /api/notification-emails. The daily schedule is compatible with Vercel Hobby. The endpoint requires Authorization: Bearer CRON_SECRET.

Each queued event has a stable provider idempotency key and payload. Transient failures retry at most five times within 23 hours; uncertain older sends are failed for manual investigation rather than resending beyond Resend's 24-hour idempotency window. Current preferences and confirmed email are checked before each attempt. Changed recipient email skips a retried payload. App read state is independent of email status.

Validation before enabling: use an explicitly authorized recipient, enable one preference, create the matching permitted event, verify provider acceptance and inbox receipt, check opt-out and failed-delivery status. Never send a test broadcast to real members.

Provider references: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys; scheduling: https://vercel.com/docs/cron-jobs/usage-and-pricing.
