# Phosters Tutorial Centre

Mobile-first online tutorial platform for Nigerian students preparing for **JAMB UTME** and **University of Ibadan (UI) Post-UTME**.

## Current Build Status: Phase 4 — Integrated CBT Engine

Implemented across Phases 1–4:
- React + TypeScript + Vite + Tailwind CSS v4 design system (Phosters green, crisp neutral surfaces, 44px+ mobile touch targets)
- Responsive `AppShell` with desktop navigation and mobile bottom tab bar
- Authentication flows (Sign Up, Sign In, Password Reset, Sign Out) & Profile management
- Examination profile setup supporting JAMB UTME (English + 3 subjects) and UI Post-UTME independently
- Student dashboard with Continue Learning card, subject overview, and recent test results
- Subject → Topic → Lesson browsing restricted to enrolled subjects & published content
- Lesson page with sticky mobile 16:9 YouTube player (`youtube-nocookie.com`), validated direct material links (`raw.githubusercontent.com`), completion tracking, attached tests, and previous/next lesson navigation
- Protected Admin Dashboard (`/admin`) for Examinations, Exam Subject Options, Subjects, Topics, Lessons, Materials, Links, CBT Tests, Student Usage & Progress Statistics (`/admin/students`), and Broadcast Announcements (`/admin/announcements`)
- Integrated CBT Engine with server-authoritative PostgreSQL grading (`submit_test_attempt`), hidden answer keys before submission, score & percentage summaries, and gated answer review

---

## Setup Instructions

### 1. Create a Supabase Project
1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings -> API** and copy:
   - **Project URL**
   - **anon / publishable key**

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or configure your hosting environment variables):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY

# Enable native Web Push notifications (you can also generate keys in /admin/announcements)
VITE_VAPID_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VAPID_PUBLIC_KEY=YOUR_PUBLIC_VAPID_KEY
VAPID_PRIVATE_KEY=YOUR_PRIVATE_VAPID_KEY
VAPID_SUBJECT=mailto:notifications@phosters.com

# Optional: Only needed for unattended Cron inactivity reminders (admin sends use your Admin session + anon key)
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET=YOUR_RANDOM_CRON_SECRET

# Required for Super Admin Question Bank AI parsing & scanned PDF OCR (/admin/question-bank)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Never place `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, or `GEMINI_API_KEY` in any `VITE_*` variable.

### 3. Run the Database Migrations
In your Supabase **SQL Editor**, run the migration scripts in order:
1. `supabase/migrations/001_phase1_profiles_and_auth.sql` — creates `public.profiles`, signup trigger, role-escalation protection, and RLS.
2. `supabase/migrations/002_phase2_learning_schema.sql` — creates `exams`, `subjects`, `exam_subjects`, `student_exam_profiles`, `student_exam_subjects`, `topics`, `lessons`, `lesson_materials`, `lesson_links`, `student_lesson_progress`, RLS policies, and seeds JAMB UTME / UI Post-UTME subjects.
3. `supabase/migrations/003_phase4_cbt_schema.sql` — creates `tests`, `questions`, `question_options`, `test_attempts`, `attempt_answers`, strict answer-key hiding RLS, and secure grading/review RPCs.
4. `supabase/migrations/004_admin_student_statistics.sql` — creates the admin-only `get_admin_student_contacts()` RPC so admins can view student email addresses and last sign-in activity for follow-up emails.
5. `supabase/migrations/005_admin_announcements.sql` — creates `announcements` and `announcement_links` with audience targeting and scoped RLS policies.
6. `supabase/migrations/006_push_notifications.sql` — creates `push_subscriptions` and `push_notification_logs` for native background Web Push notifications and daily study/test reminders.
7. `supabase/migrations/007_topic_comments_and_social.sql` — adds topic comments, social engagement tables, and policies.
8. `supabase/migrations/008_subject_comments_support.sql` — adds subject-level comments support.
9. `supabase/migrations/009_admin_push_delivery_rls.sql` — allows admins to prune expired push subscriptions and stamp `last_notified_at` using their signed-in Admin session without needing `SUPABASE_SERVICE_ROLE_KEY`.
10. `supabase/migrations/010_super_admin_role_management.sql` — designates `oyasordaniel@gmail.com` as Super Admin and enables upgrading user accounts to Tutor/Admin directly from `/admin/accounts` without manual SQL.
11. `supabase/migrations/011_question_bank_schema.sql` — creates `question_bank_batches`, `question_bank`, and `question_bank_options` with Super Admin management and Tutor read-only access to approved bank questions.

### 4. Configure Supabase Auth URLs
In **Authentication -> URL Configuration**:
- Set **Site URL** to your local dev URL (`http://localhost:3000`) or deployed Vercel URL.
- Add **Redirect URLs**:
  - `http://localhost:3000/login`
  - `http://localhost:3000/reset-password`
  - Plus your production URL equivalents when deploying to Vercel.

### 5. Super Admin & Tutor Accounts
1. Sign up normally through `/signup` with `oyasordaniel@gmail.com` (migration `010` automatically assigns Super Admin access).
2. To upgrade additional tutors without SQL, have each tutor register normally via `/signup`, then open **Admin -> Tutor Access** (`/admin/accounts`) while signed in as `oyasordaniel@gmail.com` and click **Upgrade to Tutor**.

---

## Development & Build Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```
