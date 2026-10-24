# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.
You can also try [the experimental native React Compiler support in plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md#rust-react-compiler) by using `compiler: true` in the plugin options instead of using the Babel plugin.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Account creation API

Account creation uses the local Node API in `server/index.mjs` during development and the Vercel Node function in `api/create-account.js` when deployed. For Vercel, configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for the same Supabase project. Keep the service-role key server-side and do not use a `VITE_` prefix. For local development, add `SUPABASE_SERVICE_ROLE_KEY` to the root `.env` file and run `npm run dev`.

Run `npm install` and then `npm run dev` to start the local API and Vite client together. The API listens on port 3001. In production, account creation always uses the same-origin Vercel function.

Student deletion, achievement progress, the admin student age distribution, and student quiz results use authenticated Vercel serverless functions in `api/`. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel project environment variables for the same Supabase project. The service-role key must remain server-side and must never use a `VITE_` prefix. The student quiz results endpoint only returns attempts belonging to the authenticated student. The Students page shows each student's completed achievements out of the six configured achievements.

## Personal profiles

Students, admins, and super admins can open Profile from the sidebar to edit their own first name, last name, username, nickname, gender, date of birth, address, About, and Goals. First and last name boundaries are preserved in their own Auth `profile_name` metadata, while `profiles.name` keeps the combined name for reports and checklists. Dashboard greetings use the username for all three roles. Email and account role are read-only. Admin and super admin personal details are saved in their own Supabase Auth `staff_profile` metadata; student details continue to use `student_profiles`. The age distribution includes only accounts whose `profiles.role` is `student`, so staff profiles and birthdays do not affect the chart. No new database migration is needed for staff profiles.

## Quiz results

The dashboard includes separate game and quiz success-rate pie charts. Each rate is total earned points divided by total possible points across all valid recorded attempts, including repeat attempts. Students see their own results; admins and super admins see the school totals. Charts refresh every 30 seconds and when the window regains focus. Empty results display a placeholder rather than a misleading 0%.

Student names in the Students list, dashboard progress table, and quiz results open an admin-only detail page with account/profile information, game scores, quiz history, achievements, and PDC progress. The `/api/student-details` endpoint validates the signed-in administrator before reading the selected student's records. It uses the same server-only Supabase configuration as the existing account APIs. Run `npm run dev` for the local API and client; Vite proxies this endpoint to port 3001.

The dashboard calendar uses saved course dates with three editable types: Onsite theoretical driving course, Online theoretical driving course, and Additional schedule course date. Admins and super admins can add, change, or remove the type and date of each session. Different types can share a date; duplicate type/date combinations are blocked by the database. Students can view the saved schedules and download upcoming dates as an all-day `.ics` calendar with a reminder the day before. There are no automatic Wednesday sessions. Existing additional dates are preserved. Class times remain to be confirmed; the website does not send email or push notifications.

Run `npm test` to check score aggregation, pagination, saved course calendar exports, security controls, and student-detail authorization.

## Security PIN and idle lock

Apply [`supabase/migrations/20261023063523_portal_security_and_editable_courses.sql`](./supabase/migrations/20261023063523_portal_security_and_editable_courses.sql) in the Supabase SQL Editor as part of deploying this release. Deploy the API and client together, with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` configured. The migration requires the existing portal tables, including `onsite_course_sessions`. It adds the schedule type, server-only PIN credentials, verified sessions, and attempt counters. Coordinate applying it with the release: its access policies require PIN verification immediately, so the previous client cannot access protected data afterward. Do not apply the SQL twice.

Students sign in with their password, then verify a private 6-digit PIN. Existing students create their PIN and security question the first time they use this release. Admins and super admins sign in and unlock with their password; they do not create a student PIN. The portal locks after 5 minutes without activity, including when returning from an inactive tab. Active tabs share activity and lock notifications. Server-side session expiry and database policies protect portal data while locked; background polling does not count as activity. External clients that access these protected tables must also authenticate their portal session through `/api/login-security` before accessing data.

The portal sign-in API permits three password attempts per normalized email in a 15-minute window. The third unsuccessful attempt triggers a 15-minute lock. PIN guesses and security answers have separate account-level limits. Counters live in the database, so refreshing or switching browsers does not clear them. These limits cover the portal API; Supabase's direct Auth endpoint retains its separately configured rate limits. Direct Auth sign-in alone cannot unlock portal data.

PINs and normalized security answers are stored as salted scrypt hashes, never as browser storage or editable Auth metadata. Recovery requires the account password and the correct security answer. Admins and super admins can also reset a student PIN from **Students → student details → Student PIN security**, after entering their own password and the student's correct answer. Resetting a PIN locks all of that account's existing portal sessions. A student or administrator cannot use the student reset action to change staff PINs.

The dashboard progress/achievement table has been removed for staff; student details still show the individual results. Monthly Enrollees is a line graph beside Student Age Distribution, with a year selector and counts based on student account creation dates. Months without enrollees show zero. The PDC completion card appears below this analytics row. Game score summaries stack bold Level 1–6 labels with their most recent scores. Student lists and game/quiz history tables show three records per page with Previous/Next controls. Messages and all message/reply composers display a warning against sharing sensitive information.

`tests/portal-security.database.sql` contains database assertions for rate limits, session expiry, reset invalidation, student privacy, role protection, and course constraints. Validate against a matching schema by concatenating `BEGIN;`, the migration, these assertions, and `ROLLBACK;` into a temporary file and running it through `supabase db query --linked --file <file>`. This check rolls back its temporary credentials, sessions, schedules, and schema changes. `npm test` also covers the API's authentication and recovery rules without database access.

Before students can submit recorded quiz results, run [`supabase/quiz_attempts.sql`](./supabase/quiz_attempts.sql) in the Supabase SQL Editor. It creates the attempt table and the row-level security policies that allow students to record their own results and admins to view them. Admin and super admin dashboards show the total number of takes and the 20 most recent results.

## Chaptered quizzes

Before deploying chaptered quizzes, run [`supabase/quiz_chapters.sql`](./supabase/quiz_chapters.sql) in the Supabase SQL Editor after the quiz questions and attempts tables exist. Existing questions are assigned in creation order to chapters in groups of 10. The migration requires no more than 70 unassigned questions. Admins and super admins can manage up to 7 chapters with 10 questions each. Students complete chapters in order; each chapter's question order is shuffled when they start, and submitting it unlocks the next chapter. A score of 50% or higher is a pass. Students can take up to 3 attempts per chapter. Before deploying the matching client, run [`supabase/quiz_chapter_attempt_limit.sql`](./supabase/quiz_chapter_attempt_limit.sql) after the chapter and attempt tables exist to enforce the cap atomically in the database and make retried submissions idempotent.

## Quiz question images

Run [`supabase/quiz_question_images.sql`](./supabase/quiz_question_images.sql) in the Supabase SQL Editor to add optional image attachments to quiz questions and configure the public image bucket. Admins and super admins can attach JPEG, PNG, WebP, or GIF images up to 5 MB; students see the image above the question.

## Message replies and attachments

Run [`supabase/message_replies_attachments.sql`](./supabase/message_replies_attachments.sql) in the Supabase SQL Editor to enable replies and private message attachments. Senders and recipients can reply to messages and share up to five images, videos, or other files per message, up to 50 MB each. The storage bucket is private; only the two message participants can access its attachments. The recipient list is loaded from the authenticated `/api/message-recipients` endpoint; configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel for the same Supabase project.

## Achievement tracking

Run [`supabase/player_achievements.sql`](./supabase/player_achievements.sql) in the Supabase SQL Editor to enable per-student achievement tracking. Super admins can mark or revoke achievements for a selected student on the Achievements page. Students can see their completed achievements and unlock dates there and on their dashboard.

## PDC checklist

Run [`supabase/pdc_checklist.sql`](./supabase/pdc_checklist.sql) in the Supabase SQL Editor to enable the per-student practical driving checklist. Admins and super admins can select a student, record a Yes/No result and optional remarks for each item, and print the checklist or save it as a PDF. Students can view their results; printing and PDF downloads are available only to admins and super admins. A checklist is counted as completed when all 20 items have a Yes/No result. Re-run the SQL after this update so a saved Yes or No can be cleared.

## Game score tracking

Run [`supabase/game_scores.sql`](./supabase/game_scores.sql) in the Supabase SQL Editor to store Unity game results for each student. Each row keeps the student account, level number, score earned, maximum possible score, and timestamp. The website displays the most recent score for each level and keeps the table available for admin review.

## Password recovery on Vercel

The standalone page for requesting a password reset is `https://Intro2driving.vercel.app/forgot-password`. In Supabase Authentication URL Configuration, set the Site URL to `https://Intro2driving.vercel.app` and add `https://Intro2driving.vercel.app/reset-password` to the Redirect URLs allow-list. Production builds use the current deployed site origin for reset links, so do not set a localhost `VITE_APP_URL` in Vercel. For local recovery testing, optionally set `VITE_APP_URL=http://localhost:5173` and allow `http://localhost:5173/reset-password` in Supabase. Always request a fresh reset email after changing these settings.
