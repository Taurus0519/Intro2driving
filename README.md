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

Account creation runs through the Node API in `server/index.mjs`. It requires `SUPABASE_SERVICE_ROLE_KEY` in the root `.env` file in addition to the Supabase URL and publishable key. Get the service-role key from your Supabase project's API settings, keep it server-side, and do not use a `VITE_` prefix. The API uses the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values when `SUPABASE_URL` and `SUPABASE_ANON_KEY` are not set. After adding the key, restart the API (or run `npm run dev` again).

Run `npm install` and then `npm run dev` to start the API and Vite client together. The API listens on port 3001. Set `ACCOUNT_API_ORIGINS` to the comma-separated frontend origins when deploying the API, and set `VITE_ACCOUNT_API_URL` to the API's base URL when building the client for production.

## Quiz results

Before students can submit recorded quiz results, run [`supabase/quiz_attempts.sql`](./supabase/quiz_attempts.sql) in the Supabase SQL Editor. It creates the attempt table and the row-level security policies that allow students to record their own results and admins to view them. Admin and super admin dashboards show the total number of takes and the 20 most recent results.

## Achievement tracking

Run [`supabase/player_achievements.sql`](./supabase/player_achievements.sql) in the Supabase SQL Editor to enable per-student achievement tracking. Super admins can mark or revoke achievements for a selected student on the Achievements page. Students can see their completed achievements and unlock dates there and on their dashboard.

## PDC checklist

Run [`supabase/pdc_checklist.sql`](./supabase/pdc_checklist.sql) in the Supabase SQL Editor to enable the per-student practical driving checklist. Admins and super admins can select a student, record a Yes/No result and optional remarks for each item, and print the checklist or save it as a PDF. Students can view and print their results. A checklist is counted as completed when all 20 items have a Yes/No result. Re-run the SQL after this update so a saved Yes or No can be cleared.
