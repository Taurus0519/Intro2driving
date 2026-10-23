import express from 'express';
import createAccount from '../api/create-account.js';
import messageRecipients from '../api/message-recipients.js';
import studentDetails from '../api/student-details.mjs';
import studentQuizAttempts from '../api/student-quiz-attempts.mjs';
import studentAgeDistribution from '../api/student-age-distribution.mjs';
import achievementProgress from '../api/achievement-progress.mjs';
import deleteAccount from '../api/delete-account.mjs';
import loginSecurity from '../api/login-security.mjs';

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3001);
const allowedOrigins = new Set((process.env.ACCOUNT_API_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && (allowedOrigins.has(origin) || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use(express.json({ limit: '16kb' }));
app.post('/api/login-security', loginSecurity);
app.post('/api/create-account', createAccount);
app.post('/api/delete-account', deleteAccount);
app.get('/api/message-recipients', messageRecipients);
app.get('/api/student-details', studentDetails);
app.get('/api/student-quiz-attempts', studentQuizAttempts);
app.get('/api/student-age-distribution', studentAgeDistribution);
app.get('/api/achievement-progress', achievementProgress);
app.get('/health', (_request, response) => response.json({ ok: true, configured: Boolean(
  (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
  && (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)
  && process.env.SUPABASE_SERVICE_ROLE_KEY,
) }));
app.listen(port, () => console.log(`Portal API listening on port ${port}`));
