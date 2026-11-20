# Phosters Tutorial Centre

Mobile-first online tutorial platform for Nigerian students preparing for **JAMB UTME** and **University of Ibadan (UI) Post-UTME**.

## Current Build Status: Phase 1 — Foundation

Implemented in Phase 1:
- React + TypeScript + Vite + Tailwind CSS v4 design system (Phosters green, crisp neutral surfaces, 44px+ mobile touch targets)
- Responsive `AppShell` with desktop navigation and mobile bottom tab bar
- Route guards (`ProtectedRoute`, `AdminRoute`) with lazy-loaded pages
- Safe Supabase client initialization with clear setup guidance when credentials are missing
- Authentication flows: Sign Up, Sign In, Password Reset request & update, Sign Out
- Profile creation trigger, permitted personal field editing, and database-enforced role protection (`student` / `admin`)

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
```

Never place the Supabase `service_role` key in `.env` or any `VITE_*` variable.

### 3. Run the Phase 1 Database Migration
1. Open **SQL Editor** in your Supabase Dashboard.
2. Paste and run the contents of `supabase/migrations/001_phase1_profiles_and_auth.sql`.
   This creates:
   - `public.profiles` linked to `auth.users`
   - `handle_new_user()` trigger that assigns `'student'` on signup
   - `guard_profile_role_update()` trigger blocking self-escalation
   - Row Level Security (RLS) policies for student and admin reads/updates
   - `public.promote_user_to_admin(target_email)` helper (restricted to SQL Editor / database owner)

### 4. Configure Supabase Auth URLs
In **Authentication -> URL Configuration**:
- Set **Site URL** to your local dev URL (`http://localhost:3000`) or deployed Vercel URL.
- Add **Redirect URLs**:
  - `http://localhost:3000/login`
  - `http://localhost:3000/reset-password`
  - Plus your production URL equivalents when deploying to Vercel.

### 5. Create Your First Admin Account
1. Sign up normally through `/signup` in the app.
2. In the Supabase **SQL Editor**, promote your account using the trusted helper:

```sql
select public.promote_user_to_admin('your-admin-email@example.com');
```

3. Sign out and sign back in (or refresh the profile) to access `/admin`.

---

## Development & Build Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```
