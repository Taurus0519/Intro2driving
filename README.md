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

## Quiz results

The dashboard includes separate game and quiz success-rate pie charts. Each rate is total earned points divided by total possible points across all valid recorded attempts, including repeat attempts. Students see their own results; admins and super admins see the school totals. Charts refresh every 30 seconds and when the window regains focus. Empty results display a placeholder rather than a misleading 0%.

Student names in the Students list, dashboard progress table, and quiz results open an admin-only detail page with account/profile information, game scores, quiz history, achievements, and PDC progress. The `/api/student-details` endpoint validates the signed-in administrator before reading the selected student's records. It uses the same server-only Supabase configuration as the existing account APIs. Run `npm run dev` for the local API and client; Vite proxies this endpoint to port 3001.

Every Wednesday is marked in the dashboard calendar for the onsite theoretical driving course. The calendar shows the next class and a same-day reminder on Wednesdays. Students can download a recurring weekly `.ics` event with a reminder the day before and import it into their personal calendar. The event is all day because a class time has not been specified; the website does not send email or push notifications.

Run `npm test` to check score aggregation, pagination, weekly recurrence/calendar exports, and student-detail authorization.

Before students can submit recorded quiz results, run [`supabase/quiz_attempts.sql`](./supabase/quiz_attempts.sql) in the Supabase SQL Editor. It creates the attempt table and the row-level security policies that allow students to record their own results and admins to view them. Admin and super admin dashboards show the total number of takes and the 20 most recent results.

## Chaptered quizzes

Before deploying chaptered quizzes, run [`supabase/quiz_chapters.sql`](./supabase/quiz_chapters.sql) in the Supabase SQL Editor after the quiz questions and attempts tables exist. Existing questions are assigned in creation order to chapters in groups of 10. The migration requires no more than 70 unassigned questions. Admins and super admins can manage up to 7 chapters with 10 questions each. Students complete chapters in order; each chapter's question order is shuffled when they start, and submitting it unlocks the next chapter regardless of score.

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

The standalone page for requesting a password reset is `https://intro2driving-system.vercel.app/forgot-password`. In Supabase Authentication URL Configuration, set the Site URL to `https://intro2driving-system.vercel.app` and add `https://intro2driving-system.vercel.app/reset-password` to the Redirect URLs allow-list. Production builds use the current deployed site origin for reset links, so do not set a localhost `VITE_APP_URL` in Vercel. For local recovery testing, optionally set `VITE_APP_URL=http://localhost:5173` and allow `http://localhost:5173/reset-password` in Supabase. Always request a fresh reset email after changing these settings.
