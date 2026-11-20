# PHOSTERS — Google AI Studio Build Specification

**Document purpose:** Master product specification and build instructions for the first Phosters web app/PWA MVP.

**Product:** Phosters Tutorial Centre  
**Initial examinations:** JAMB UTME and University of Ibadan (UI) Post-UTME  
**Target:** Nigerian students using Android phones and mobile data  
**Development workflow:** Google AI Studio Build mode → GitHub → Supabase → Vercel

---

# 1. MASTER PROMPT FOR GOOGLE AI STUDIO

Copy the prompt below into Google AI Studio Build mode.

---

## MASTER BUILD PROMPT

You are a senior full-stack engineer, product designer and security-conscious software architect. Build a polished, lightweight, mobile-first tutorial platform called **Phosters**.

Phosters is an online tutorial platform for students preparing for JAMB UTME and University of Ibadan (UI) Post-UTME. It should feel like a proper, simple learning application — not a generic admin template, not a social network and not an overcomplicated learning management system.

### A. Product goals

Build an MVP that allows:

1. Students to create accounts and sign in.
2. Students to select their examination profile.
3. Students to choose the subjects they are preparing for.
4. Students to browse subjects, topics and lessons.
5. Students to watch lesson videos hosted on YouTube.
6. Students to access lesson notes and other materials through direct download links.
7. Students to take multiple-choice tests inside Phosters.
8. Students to receive automatically graded results.
9. Admins to create and manage subjects, topics, lessons, learning materials and tests through a protected admin dashboard.

Keep the first release focused. Do not add payments, subscriptions, AI tutors, chat, live classes, social feeds, leaderboards, complex analytics or multi-school support.

### B. Technology

Use the following stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase for authentication and PostgreSQL database
- Supabase Storage only if a future feature genuinely requires file uploads
- YouTube embeds for lesson videos
- GitHub raw file URLs for public lesson materials
- Vercel for deployment
- Make the application installable as a Progressive Web App (PWA), if this can be done without making the app unnecessarily complex.

Do not introduce a separate backend framework unless it is genuinely necessary. Use Supabase Edge Functions or secure database functions for operations that must not be trusted to the browser.

### C. Design direction

The interface must be professional, modern, clean and lightweight.

Brand colours:
- Primary: Phosters green
- Supporting: white
- Text and contrast: near-black / dark charcoal
- Use neutral grey for secondary information.

Design requirements:
- Mobile-first, especially Android phone screens.
- Responsive on tablets and desktop.
- Comfortable rounded corners, but do not make every element excessively pill-shaped.
- Clear typography and generous spacing.
- Avoid gradients, neon glow, excessive shadows, pale brown/beige themes and generic AI-generated dashboard styling.
- Avoid excessive borders and divider lines.
- Use a consistent, small set of reusable components.
- Make buttons and touch targets comfortable to tap.
- Avoid heavy animations.
- Optimise for low-end Android devices and Nigerian mobile networks.
- Use loading, empty, error and success states.
- Do not use fake statistics, fake testimonials or placeholder content presented as real data.

### D. Student experience

#### 1. Authentication

Create:
- Sign-up page
- Login page
- Password reset flow
- Sign-out action

Use Supabase Auth. Do not build a custom password system.

Collect only necessary profile information, such as:
- Full name
- Email
- Optional phone number
- Examination profile

Do not expose Supabase service-role keys or other secret keys in frontend code.

#### 2. Examination profile

Support:
- JAMB UTME
- UI Post-UTME

A student may prepare for one or both.

Allow the student to select the examination and their intended course/programme where relevant. Let the student choose subjects for each examination profile.

Important: Do not hard-code the assumption that every UI Post-UTME subject combination is identical to the student's JAMB combination. Store examination subject selections separately. An admin should be able to update the subject options and requirements. Where a student has already selected JAMB subjects, the UI Post-UTME profile may offer them as a convenient starting point, but the student must be able to review and edit the selection.

For JAMB, allow English Language plus the student's three other selected subjects. Do not assume a universal three-subject combination for every course.

#### 3. Student dashboard

After login, show a simple dashboard containing:
- Welcome message using the student's profile name.
- Selected examination profile(s).
- Selected subjects.
- Continue learning / recently opened lesson, if available.
- A clear way to browse subjects.
- Recent test results, if available.

Do not overload the dashboard.

#### 4. Subject and lesson navigation

Suggested navigation:

Examination → Subject → Topic → Lesson

A subject page should show:
- Subject name
- Available topics
- Number of lessons only when based on real database data
- Lessons arranged in an admin-defined order

A lesson list should show:
- Lesson title
- Topic
- Optional short description
- Completion/progress state only if progress tracking is implemented reliably

Students should only see lessons belonging to the examination/subjects they are permitted to access.

#### 5. Lesson page

This is one of the most important screens.

Create a lesson experience similar to a video-learning page:

- YouTube video player at the top.
- On mobile, the player should remain sticky/pinned at the top while the student scrolls through the lesson content, without covering the page or consuming the entire screen.
- Use a responsive 16:9 video area.
- Below the video, show:
  - Lesson title
  - Subject and topic
  - Tutor/teacher name, if supplied
  - Lesson description
  - Learning materials
  - Important links
  - Take Test button, if a test is attached
  - Previous Lesson and Next Lesson navigation
  - Related lessons, if available

YouTube videos must be embedded using a valid YouTube embed URL. Accept common YouTube URL formats in the admin form and convert them safely to an embed URL. Validate URLs and do not render arbitrary iframe URLs.

If a video is unavailable or the URL is invalid, show a useful fallback message rather than a broken player.

#### 6. Learning materials — GitHub is storage only

GitHub is used only as a public file-storage source for supplementary learning materials. Students must not need GitHub accounts.

Admin workflow:
1. Admin uploads a PDF or other permitted learning file to the Phosters-owned GitHub repository.
2. Admin copies the file's **raw.githubusercontent.com** URL.
3. Admin opens the lesson editor in Phosters.
4. Admin adds a material title, file type and raw URL.
5. Phosters stores the URL against the lesson.

Student workflow:
- Students see a clear button such as “Download Notes” or “Download Practice Questions”.
- Clicking it should access the file directly, without opening a GitHub repository page.
- Do not send students to github.com repository pages.
- Do not display GitHub branding or GitHub terminology in the student interface.

Important implementation detail:
- Validate that material URLs use HTTPS and an approved host such as `raw.githubusercontent.com` (or another explicitly approved host configured by the application).
- Do not accept arbitrary JavaScript URLs or unsafe URL schemes.
- Use a direct raw file URL, not a repository page URL.
- Add an appropriate download interaction. The HTML `download` attribute may be ignored for cross-origin files by some browsers. If reliable direct download is required, test a fetch-to-Blob download for CORS compatibility and reasonable file sizes. If the browser cannot force a download, explain that the browser may preview a PDF and provide a clear “Download PDF” action in the preview experience.
- Never claim that every Android browser will always download rather than preview a PDF.
- Do not proxy large files through the frontend server.
- Do not use GitHub as a place to store private or paid-only materials. Public raw URLs are accessible to anyone who has them.
- Do not commit secrets, student data or private files to the repository.
- Keep file links editable so an admin can replace a broken link.

For the MVP, support at least PDF materials. The data model should allow other file types later, such as images or ZIP files, but do not build an elaborate file manager now.

#### 7. Integrated CBT / test engine

Build a basic multiple-choice test engine inside Phosters. Do not redirect students to Google Forms or another testing platform.

Test features:
- A test can be linked to a lesson or topic.
- Each question has a question text.
- Each question can have multiple answer options.
- Each question has one correct answer for the initial MVP.
- Optional explanation for the correct answer.
- Students select answers and submit.
- Automatically calculate the score.
- Save the attempt and result.
- Show the student their score and percentage after submission.
- Show correct answers and explanations only after submission, according to the test's review settings.

Security requirements:
- Never send correct answers to the browser before a test is submitted.
- Do not calculate the authoritative score solely in frontend JavaScript.
- Use a secure Supabase Edge Function or a carefully designed database function to receive submitted answers, retrieve the answer key securely, calculate the score and save the attempt.
- Apply authentication and authorization checks.
- Prevent a student from submitting an attempt for another student.
- Do not expose answer keys through public database queries or client-side bundles.
- If a timer is implemented, treat the server/database as authoritative for the start and end times. Do not trust a client-side countdown as the security control.
- For the first version, a timer may be omitted if it adds unnecessary complexity.

Test result page should show:
- Test name
- Score
- Percentage
- Number of correct answers
- Number of questions
- Submission date/time
- Review of answers only if enabled by the test settings

### E. Admin dashboard

Create a protected admin area. Only users with an admin role should access it.

Admin features:

1. Dashboard overview with simple real counts from the database.
2. Create and edit examinations.
3. Create and edit subjects.
4. Configure subject options for each examination.
5. Create and edit topics.
6. Create and edit lessons.
7. Add YouTube video links.
8. Add lesson descriptions and tutor names.
9. Add, edit and remove GitHub raw material links.
10. Arrange lesson order.
11. Create and edit tests.
12. Add, edit and remove test questions and options.
13. Attach a test to a lesson or topic.
14. Publish/unpublish lessons and tests.

The lesson editor should be straightforward. Suggested fields:
- Examination
- Subject
- Topic
- Lesson title
- Short description
- Full lesson description
- Tutor name
- YouTube URL
- Materials list: title, type, raw URL
- Optional important links
- Display order
- Draft/published status
- Optional attached test

Do not make admins edit database tables directly.

For the first version, use one central Phosters-owned GitHub repository for learning materials. Admins can be given appropriate repository access by the owner. Do not require every tutor to create a separate repository. Explain that GitHub collaborator permissions must be configured by the repository owner and should follow least privilege.

### F. Database design

Create a clean relational schema. Use UUID primary keys and timestamps.

Suggested tables:

1. `profiles`
   - `id` UUID, references `auth.users.id`
   - `full_name`
   - `phone` nullable
   - `role` (`student` or `admin`)
   - `created_at`
   - `updated_at`

2. `exams`
   - `id`
   - `name`
   - `slug`
   - `is_active`
   - `created_at`

3. `subjects`
   - `id`
   - `name`
   - `slug`
   - `description` nullable
   - `is_active`
   - `created_at`

4. `exam_subjects`
   - `id`
   - `exam_id`
   - `subject_id`
   - `is_active`
   - `display_order`

5. `student_exam_profiles`
   - `id`
   - `student_id`
   - `exam_id`
   - `intended_course` nullable
   - `institution` nullable
   - `created_at`
   - Unique constraint on student + exam, unless product requirements later allow multiple profiles per exam.

6. `student_exam_subjects`
   - `id`
   - `student_exam_profile_id`
   - `subject_id`
   - `created_at`
   - Unique constraint on profile + subject.

7. `topics`
   - `id`
   - `exam_id`
   - `subject_id`
   - `title`
   - `description` nullable
   - `display_order`
   - `is_published`
   - `created_at`
   - `updated_at`

8. `lessons`
   - `id`
   - `topic_id`
   - `title`
   - `short_description` nullable
   - `description` nullable
   - `tutor_name` nullable
   - `youtube_url` nullable
   - `display_order`
   - `is_published`
   - `created_at`
   - `updated_at`

9. `lesson_materials`
   - `id`
   - `lesson_id`
   - `title`
   - `file_type` (for example `pdf`, `image`, `zip`, `other`)
   - `file_url`
   - `display_order`
   - `created_at`

10. `lesson_links`
    - `id`
    - `lesson_id`
    - `title`
    - `url`
    - `display_order`

11. `tests`
    - `id`
    - `title`
    - `description` nullable
    - `topic_id` nullable
    - `lesson_id` nullable
    - `is_published`
    - `show_explanations_after_submission`
    - `created_at`
    - `updated_at`

12. `questions`
    - `id`
    - `test_id`
    - `question_text`
    - `explanation` nullable
    - `display_order`
    - `points` default 1

13. `question_options`
    - `id`
    - `question_id`
    - `option_text`
    - `option_key` (A, B, C, D or another stable key)
    - `is_correct`
    - `display_order`

14. `test_attempts`
    - `id`
    - `test_id`
    - `student_id`
    - `score`
    - `total_points`
    - `percentage`
    - `submitted_at`
    - `created_at`

15. `attempt_answers`
    - `id`
    - `attempt_id`
    - `question_id`
    - `selected_option_id` nullable
    - `is_correct`
    - `points_awarded`

You may adjust this schema if there is a clear technical reason, but preserve the relationships and security requirements. Avoid creating unnecessary tables.

### G. Supabase security and access control

Set up Row Level Security (RLS) on all relevant tables.

Rules:
- Students can read and update only their own profile, within permitted fields.
- Students can read published examinations, subjects, topics and lessons that are available to them.
- Students can read lesson material links and important links for accessible published lessons.
- Students can create and read only their own test attempts and answers.
- Students must not read the `is_correct` field or answer key before submitting.
- Admins can create, update and delete learning content.
- Only trusted admins can change user roles.
- A user must never be able to make themselves an admin by editing their profile.
- Never put the Supabase service-role key in frontend environment variables or client code.
- Use the anon/publishable key in the frontend with RLS enabled.
- Keep any service-role key only in a secure server-side environment, such as an Edge Function secret.
- Add database constraints and indexes for common lookups and relationships.

Do not rely on hiding admin buttons in the UI as security. Enforce admin access in database policies and secure functions.

### H. Code quality and project structure

Use a maintainable structure. Separate:
- Pages
- Reusable components
- Feature components
- Supabase client and service functions
- Types
- Hooks
- Utilities
- Styles

Do not put the entire app in one giant component.

Requirements:
- TypeScript types for database entities and component props.
- Reusable form controls.
- Reusable loading, error and empty states.
- Form validation.
- Useful error messages.
- No hard-coded fake authentication.
- No mock data in production flows.
- Do not leave buttons that look functional but do nothing.
- Avoid unnecessary dependencies.
- Keep components reasonably small and understandable.
- Add comments for security-sensitive logic, not for every obvious line.

### I. Performance and connectivity

- Keep pages lightweight.
- Lazy-load routes and heavy components where appropriate.
- Avoid loading every lesson and question at once.
- Use pagination or sensible limits for long lists.
- Avoid autoplaying videos.
- Load YouTube embeds only when appropriate, and do not preload multiple videos on a page.
- Use compressed images and avoid unnecessary decorative images.
- Ensure the app remains usable on a modest Android phone and a slower connection.
- Provide clear retry actions for network errors.

### J. Deployment and configuration

Prepare the app for deployment to Vercel.

Use environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or the current Supabase publishable key name supported by the project)

Do not put secrets in variables prefixed with `VITE_`.

Provide:
- `.env.example` with placeholder values only.
- `.gitignore` that excludes `.env`, `.env.local`, build outputs and dependencies.
- README with setup and deployment instructions.
- SQL migration files for the schema, indexes, constraints and RLS policies.
- Any Edge Function source and deployment instructions needed for secure test submission.

Do not invent real Supabase credentials. If credentials are not configured, show a clear setup message rather than pretending authentication works.

### K. Build process

Do not attempt to implement every feature in one uncontrolled pass.

First inspect the project and create a short implementation plan. Then build in the following phases:

Phase 1 — Foundation:
- React + TypeScript + Vite project
- Tailwind and design system
- Responsive app shell
- Routing
- Supabase client configuration
- Authentication pages
- Profile creation and role handling

Phase 2 — Student learning experience:
- Examination selection
- Subject selection
- Student dashboard
- Subject/topic/lesson browsing
- Lesson page
- Sticky video player
- GitHub raw material links and download interaction

Phase 3 — Admin content management:
- Protected admin routes
- Subject and topic management
- Lesson editor
- YouTube URL validation
- Material-link management
- Lesson ordering and publishing

Phase 4 — CBT:
- Test editor
- Question and option management
- Student test-taking interface
- Secure submission and grading
- Results and answer review

Phase 5 — Hardening:
- RLS and authorization review
- Mobile responsiveness
- Error and empty states
- Accessibility
- Performance
- PWA setup if stable
- README and deployment instructions

After each phase:
1. Run the available checks/build.
2. Fix errors before moving on.
3. Summarise what was implemented.
4. List any Supabase SQL or dashboard action I must perform.
5. Do not silently skip unfinished requirements.
6. Do not replace real backend functionality with fake local data.

Start with Phase 1. Do not begin Phase 2 until the foundation is stable.

---

# 2. IMPLEMENTATION PROMPTS TO USE AFTER THE MASTER PROMPT

Use these one at a time. Do not paste all of them together if AI Studio starts mixing requirements.

## Prompt 1 — Build the foundation

Build Phase 1 only from the specification. Create the React + TypeScript + Vite structure, Tailwind styling, routing, responsive app shell, Supabase client configuration, authentication screens and profile handling.

Before coding, inspect the existing project. Preserve working code where possible. Do not build fake authentication. If Supabase credentials are missing, provide a clear setup state and document exactly where the credentials go.

When finished, run the build/type checks and fix errors. Show me the files created and the exact setup steps I must complete.

## Prompt 2 — Build the student portal

Implement Phase 2 only. Build examination selection, separate subject selections per examination, student dashboard, subject/topic/lesson browsing and the lesson page.

The lesson page must have a responsive YouTube player that remains sticky at the top on mobile while the student scrolls through lesson details. Do not let the player cover content or make the page difficult to scroll.

Implement GitHub raw material links. Students must see friendly labels such as “Download Notes”, not GitHub URLs or GitHub branding. Validate allowed URLs. Test direct download behaviour and document browser limitations. Do not expose private files because this MVP uses public raw links.

Use real Supabase data. Do not insert fake lesson data into production flows.

## Prompt 3 — Build the admin dashboard

Implement Phase 3 only. Build a protected admin dashboard with forms to manage examinations, subjects, topics and lessons.

The lesson form must support:
- Examination
- Subject
- Topic
- Lesson title
- Short and full description
- Tutor name
- YouTube link
- Multiple learning materials, each with title, file type and GitHub raw URL
- Important links
- Display order
- Draft/published state

Allow admins to add, edit, remove and reorder materials. Validate URLs. Only authorised admins may use these features. Enforce permissions in Supabase, not just in the frontend.

## Prompt 4 — Build the CBT engine

Implement Phase 4 only. Build an admin test editor and student CBT experience.

Admins must be able to create tests, add multiple-choice questions, add answer options, select the correct answer, add explanations and attach tests to lessons or topics.

Students must be able to take and submit tests inside Phosters. The authoritative grading must happen securely on the server/database side. Correct answers must never be exposed to the browser before submission.

Save attempts and results. Show score, percentage and review details according to the test settings. Add RLS and secure submission logic. Do not use Google Forms or external test platforms.

## Prompt 5 — Security and release review

Audit the whole application before release.

Check:
- RLS on every relevant table.
- Students cannot access another student's profile or attempts.
- Students cannot change their role to admin.
- Correct answers are not exposed before test submission.
- Test scores are calculated securely.
- Admin routes and database actions require admin permissions.
- No service-role key or secret is present in frontend code or GitHub.
- No fake data or nonfunctional buttons remain.
- Material links reject unsafe URL schemes.
- YouTube URLs are validated.
- Mobile layout works on small Android screens.
- Loading, empty, error and success states exist.
- Build and type checks pass.

Fix confirmed issues. Produce a release checklist and update the README.

---

# 3. PRODUCT AND USER-FLOW DOCUMENTATION

## Student journey

1. Student opens Phosters.
2. Student signs up or logs in.
3. Student selects JAMB UTME, UI Post-UTME or both.
4. Student chooses their subjects for each exam profile.
5. Student reaches the dashboard.
6. Student opens a subject.
7. Student selects a topic.
8. Student opens a lesson.
9. Student watches the YouTube lesson.
10. Student scrolls below the sticky video player to read the description and access notes.
11. Student taps “Download Notes” to access the material directly.
12. Student takes the attached test, if available.
13. Phosters grades the submission securely and saves the result.
14. Student views their result.

## Admin journey

1. Admin signs into an authorised admin account.
2. Admin opens the admin dashboard.
3. Admin creates or selects an examination.
4. Admin creates or selects a subject.
5. Admin creates or selects a topic.
6. Admin creates a lesson.
7. Admin pastes the YouTube URL.
8. Admin uploads lesson files to the central Phosters GitHub repository using their authorised GitHub access.
9. Admin copies each raw file URL.
10. Admin adds the material title and raw URL to the lesson in Phosters.
11. Admin optionally attaches a test.
12. Admin previews the lesson.
13. Admin publishes it.

## Suggested student navigation

- Home
- My Learning
- Subjects
- Results
- Profile

Keep navigation compact on mobile. A bottom navigation bar is acceptable if it improves usability.

## Suggested admin navigation

- Overview
- Examinations
- Subjects
- Topics
- Lessons
- Tests
- Students (basic list only, if needed)

Do not build advanced student analytics in the MVP.

---

# 4. GITHUB MATERIALS STORAGE POLICY

## Recommended repository layout

Use one central repository owned by Phosters, for example:

```text
phosters-learning-materials/
├── JAMB/
│   ├── English/
│   │   ├── Comprehension/
│   │   └── Lexis-and-Structure/
│   ├── Mathematics/
│   ├── Physics/
│   └── Chemistry/
└── UI-Post-UTME/
    ├── English/
    ├── Mathematics/
    └── Subject-specific-materials/
```

This is an example structure. Admins should follow the actual subject and topic organisation configured by Phosters.

## Raw URL format

A raw file URL generally looks like:

```text
https://raw.githubusercontent.com/OWNER/REPOSITORY/BRANCH/PATH/FILE.pdf
```

Example with placeholders:

```text
https://raw.githubusercontent.com/phosters-example/phosters-learning-materials/main/JAMB/Mathematics/Algebra-Notes.pdf
```

Replace the owner, repository and path with the real values.

Do not paste ordinary repository-page URLs such as:

```text
https://github.com/OWNER/REPOSITORY/blob/main/PATH/FILE.pdf
```

The raw URL serves the file itself rather than the GitHub repository interface.

## Download behaviour caveat

A raw PDF URL avoids the GitHub repository page, but it does not guarantee that every browser will save the file immediately. Some browsers display PDFs in their built-in viewer. The HTML `download` attribute may be ignored for cross-origin links.

Recommended implementation:
1. Use the raw URL as the file source.
2. Try a download link with a `download` attribute.
3. If CORS permits and the file is reasonably sized, test a fetch-to-Blob download.
4. If the browser previews the PDF, show a clear download action in the preview/browser interface.
5. Test on Android Chrome and at least one other Android browser.

Do not silently promise forced downloads on every device.

## Repository governance

- The repository belongs to Phosters, not an individual tutor.
- Give contributors only the access they need.
- Use clear folder and file names.
- Do not upload student information, passwords, private documents or secrets.
- Do not store paid or confidential material in a public repository.
- Keep an offline backup of important teaching materials.
- Replace broken links in the Phosters admin dashboard.
- Monitor repository size and bandwidth. GitHub is not an unlimited content-delivery service.

---

# 5. SUPABASE SETUP CHECKLIST

1. Create a Supabase project.
2. Copy the project URL.
3. Copy the anon/publishable key.
4. Add them to the local `.env` file or AI Studio environment configuration.
5. Create the database schema using the SQL migrations generated by the app.
6. Enable the required RLS policies.
7. Configure email authentication.
8. Create the first admin account.
9. Promote that account to admin using a trusted, secure database/admin procedure — never by allowing a user to edit their own role.
10. Deploy any required Edge Functions.
11. Add Edge Function secrets through Supabase's secure secrets configuration.
12. Test student and admin permissions using separate accounts.

Example `.env` file:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

These are placeholders. Never put the service-role key in this file.

---

# 6. VERCEL DEPLOYMENT CHECKLIST

1. Push the project to a private or public GitHub code repository. This is separate from the public learning-materials repository.
2. Import the application repository into Vercel.
3. Set the framework/build settings for Vite if Vercel does not detect them automatically.
4. Add the Supabase URL and public anon/publishable key as environment variables.
5. Deploy.
6. Configure the production site URL in Supabase Auth settings.
7. Configure allowed redirect URLs for login and password reset.
8. Test sign-up, login, logout and password reset on the deployed URL.
9. Test student access and admin access separately.
10. Test lesson videos, PDF links and test submission on an Android phone.

Do not commit `.env` files or secrets to GitHub.

---

# 7. MVP ACCEPTANCE TESTS

The first release is not complete until these tests pass.

## Authentication
- A new student can sign up.
- An existing student can log in.
- A student can log out.
- A student cannot make themselves an admin.
- Password reset works when configured.

## Examination and subjects
- A student can select JAMB UTME.
- A student can select UI Post-UTME.
- A student can select both.
- Subject selections are stored separately for each exam profile.
- A student can change their selections.

## Lessons
- A student can browse subjects, topics and published lessons.
- An unpublished lesson is not visible to students.
- A valid YouTube URL displays the correct video.
- An invalid video URL produces a useful error.
- Previous and next lesson navigation works.
- The video player remains usable while scrolling on mobile.

## Materials
- An admin can add a raw GitHub file URL.
- A student sees a friendly material title and download action.
- Clicking the action does not open a GitHub repository page.
- The material works on Android Chrome.
- A broken URL produces a useful error.
- Unsafe URL schemes are rejected.

## Tests
- An admin can create a test.
- An admin can add questions and options.
- A student can submit answers.
- The score is calculated securely.
- The result is saved.
- A student cannot view another student's attempt.
- Correct answers are not exposed before submission.

## Administration
- A student cannot access admin pages or admin operations.
- An admin can create, edit, publish and unpublish content.
- Lesson ordering is respected.
- Admin changes appear in the student portal.

## Quality
- The app works on a small Android screen.
- The app is usable on a slow connection.
- Loading, empty and error states are understandable.
- No major console errors remain.
- Production build succeeds.
- README setup instructions are accurate.

---

# 8. FEATURES TO DELIBERATELY LEAVE OUT OF VERSION 1

Do not add these unless specifically requested later:

- Payment gateway or subscriptions
- AI tutor
- Live classes
- Chat or messaging
- Social media feed
- Gamification and leaderboards
- Complex attendance system
- Advanced analytics
- Multi-school or multi-tenant support
- Offline video downloads
- Native Android app
- Elaborate file-management interface
- Automatic GitHub API integration

The first version should prove that students can learn from videos, access materials and take tests reliably.

---

# 9. IMPORTANT BUILD RULES FOR THE AI

1. Work in small phases.
2. Inspect the existing project before changing it.
3. Do not overwrite working features without a reason.
4. Do not generate the whole application as one giant component.
5. Do not invent credentials or pretend integrations are configured.
6. Do not use mock data as if it were real production data.
7. Do not expose secrets.
8. Do not skip RLS.
9. Do not expose test answer keys to students before submission.
10. Do not add features outside the agreed MVP.
11. After each phase, report what works, what remains and what setup action is required from me.
12. If a requirement is technically impossible or unreliable, explain the limitation and propose the simplest safe alternative before implementing a workaround.

**Final instruction:** Begin with Phase 1 only. Build a stable foundation, verify it, and wait for the next phase instruction.
