export type TutorGuideSceneId =
  | 'overview'
  | 'taxonomy'
  | 'lessons'
  | 'cbt'
  | 'students'
  | 'broadcasts'
  | 'checklist';

export interface TutorGuideBeat {
  title: string;
  caption: string;
}

export interface TutorGuideChapter {
  id: TutorGuideSceneId;
  number: string;
  title: string;
  subtitle: string;
  durationSec: number;
  routeTo: string;
  routeLabel: string;
  summary: string;
  steps: string[];
  beats: [TutorGuideBeat, TutorGuideBeat, TutorGuideBeat, TutorGuideBeat];
}

export const TUTOR_GUIDE_CHAPTERS: TutorGuideChapter[] = [
  {
    id: 'overview',
    number: '01',
    title: 'Curriculum Architecture',
    subtitle: 'How Exams, Subjects, Topics, Lessons & Tests connect',
    durationSec: 12,
    routeTo: '/admin',
    routeLabel: 'Open Admin Overview',
    summary:
      'Phosters organizes content in a strict five-step hierarchy. Students only unlock lessons and tests once both the parent Topic and the item itself are published.',
    steps: [
      'Activate Exams (e.g., JAMB UTME, UI Post-UTME) and map allowed Subjects.',
      'Create ordered Topics under each Exam + Subject combination.',
      'Publish Lessons with video/notes and attach graded CBT Tests.',
    ],
    beats: [
      {
        title: 'Admin Workspace Hub',
        caption: 'Start on the Overview screen to monitor live counts for exams, topics, drafts, and students.',
      },
      {
        title: 'Exam-to-Subject Mapping',
        caption: 'Each Examination defines which Subjects students can pick during their onboarding setup.',
      },
      {
        title: 'Topic Sequencing',
        caption: 'Topics group lessons in study order using display numbers (1, 2, 3...) per Exam and Subject.',
      },
      {
        title: 'Instant Student Unlock',
        caption: 'Switching both Topic and Lesson to Published immediately unlocks them for enrolled students.',
      },
    ],
  },
  {
    id: 'taxonomy',
    number: '02',
    title: 'Exams, Subjects & Topics',
    subtitle: 'Structure tracks, order topics & moderate discussions',
    durationSec: 12,
    routeTo: '/admin/topics',
    routeLabel: 'Open Topics Manager',
    summary:
      'Set up the academic structure before adding lessons. Control which subjects belong to JAMB or Post-UTME, keep topics numbered cleanly, and manage student discussion threads.',
    steps: [
      'Use Examinations to enable tracks and map subjects under Exam Subjects.',
      'In Topics, set Display Order so chapters appear sequentially for learners.',
      'Toggle Discussions per topic and inspect or delete comments inline.',
    ],
    beats: [
      {
        title: 'Map Subjects to Exams',
        caption: 'Open Examinations to attach Subjects like Chemistry, Mathematics, and English to each exam.',
      },
      {
        title: 'Order Every Topic',
        caption: 'Set clear Display Order values (1, 2, 3) so students study topics from foundation to advanced.',
      },
      {
        title: 'Moderate Topic Discussions',
        caption: 'Enable or pause student comments per topic and review or remove posts directly from the topic row.',
      },
      {
        title: 'Draft vs Published Control',
        caption: 'Keep work-in-progress topics in Draft until their introductory lessons are ready for students.',
      },
    ],
  },
  {
    id: 'lessons',
    number: '03',
    title: 'Lessons, Video & Notes',
    subtitle: 'Embed YouTube classes & attach GitHub raw study PDFs',
    durationSec: 14,
    routeTo: '/admin/lessons/new',
    routeLabel: 'Open Lesson Editor',
    summary:
      'Build complete multimedia lessons without storing heavy media files on the database. Paste a YouTube link for privacy-enhanced playback and link PDFs from the Phosters GitHub repository.',
    steps: [
      'Pick Exam, Subject, and Topic, then fill Title, Tutor Name, and Lesson Overview.',
      'Paste any YouTube URL — Phosters embeds via youtube-nocookie.com automatically.',
      'Attach public PDFs using raw.githubusercontent.com URLs and order with arrows.',
    ],
    beats: [
      {
        title: 'Place & Name Your Lesson',
        caption: 'Choose the target Exam, Subject, and Topic first, then add the lesson title and tutor name.',
      },
      {
        title: 'YouTube Video Integration',
        caption: 'Paste a YouTube watch or share link — the player validates and embeds with privacy mode.',
      },
      {
        title: 'Downloadable Handouts & Links',
        caption: 'Attach PDFs via raw.githubusercontent.com links, reorder with Up/Down arrows, and add reference URLs.',
      },
      {
        title: 'Publish & Alert Students',
        caption: 'Save as Draft for review, or toggle Published and send an instant push notification on save.',
      },
    ],
  },
  {
    id: 'cbt',
    number: '04',
    title: 'CBT Practice Tests',
    subtitle: 'Author MCQs, set explanations & verify server grading',
    durationSec: 14,
    routeTo: '/admin/tests/new',
    routeLabel: 'Open Test Builder',
    summary:
      'Every CBT test is graded securely on PostgreSQL via submit_test_attempt. Correct option flags remain hidden from student browsers until the student clicks Submit.',
    steps: [
      'Attach a test either directly to a Lesson or broadly to a Topic.',
      'Add A–D/F options, point values, and mark the single correct answer per question.',
      'Enable post-submission explanations so students learn from mistakes after grading.',
    ],
    beats: [
      {
        title: 'Lesson or Topic Attachment',
        caption: 'Attach quick quizzes directly inside a Lesson, or create broader revision tests at the Topic level.',
      },
      {
        title: 'Build Questions & Keys',
        caption: 'Write each question, edit options A–D (up to F), mark the correct answer, and reorder cleanly.',
      },
      {
        title: 'Answer Key Security & Explanations',
        caption: 'Answer keys are hidden by database policy during attempts and revealed only after submission.',
      },
      {
        title: 'Instant Server Grading',
        caption: 'Students receive verified percentages and optional tutor explanations immediately on submit.',
      },
    ],
  },
  {
    id: 'students',
    number: '05',
    title: 'Student Tracking & Follow-Up',
    subtitle: 'Monitor engagement, inspect scores & reach inactive learners',
    durationSec: 14,
    routeTo: '/admin/students',
    routeLabel: 'Open Student Analytics',
    summary:
      'Identify who has not enrolled, who stopped opening lessons, and how students are scoring in CBT tests — then follow up by pre-filled email, CSV export, or device push nudge.',
    steps: [
      'Filter learners by Not enrolled, Not started, Inactive 7+ days, or In progress.',
      'Expand any student row to inspect lesson completion and recent CBT percentages.',
      'Select students to draft bulk follow-up emails, export CSV, or push reminders.',
    ],
    beats: [
      {
        title: 'Filter by Engagement Stage',
        caption: 'Spot students who registered without picking subjects, never started, or went quiet for 7+ days.',
      },
      {
        title: 'Inspect Individual Progress',
        caption: 'Expand any student row to view last sign-in date, subject mastery, and individual CBT scores.',
      },
      {
        title: 'Bulk Email & Safe CSV Export',
        caption: 'Select rows to copy student emails into pre-written follow-up templates or export sanitized CSVs.',
      },
      {
        title: 'Automated Study Nudges',
        caption: 'Run targeted push reminders that alert subscribed students about pending tests or missed days.',
      },
    ],
  },
  {
    id: 'broadcasts',
    number: '06',
    title: 'Broadcasts & Native Push',
    subtitle: 'Target announcements & deliver lock-screen mobile alerts',
    durationSec: 14,
    routeTo: '/admin/announcements',
    routeLabel: 'Open Announcements',
    summary:
      'Keep students informed of live UI/JAMB classes, revision schedules, and important links. Broadcasts support scoped targeting and native Web Push using your Admin login + VAPID keys.',
    steps: [
      'Target All Students, a specific Exam, or a single Exam + Subject pair.',
      'Pin critical schedules and attach verified external study or live-class URLs.',
      'Generate VAPID keys once if needed and send live push tests to your device.',
    ],
    beats: [
      {
        title: 'Scoped Audience Targeting',
        caption: 'Send updates to every student, or narrow announcements to JAMB UTME or a single Subject.',
      },
      {
        title: 'Pinned Notices & Study Links',
        caption: 'Pin urgent updates to the top of student dashboards and include safe clickable resource buttons.',
      },
      {
        title: 'One-Time VAPID Push Readiness',
        caption: 'Admin sends work with your signed-in Admin session and VAPID keys — no Service Role Key needed.',
      },
      {
        title: 'Native Lock-Screen Delivery',
        caption: 'Subscribed Android, desktop, and installed iPhone PWAs wake up with a direct deep link back.',
      },
    ],
  },
  {
    id: 'checklist',
    number: '07',
    title: 'Tutor Mastery Checklist',
    subtitle: 'Four operational habits for reliable, secure classes',
    durationSec: 12,
    routeTo: '/admin/lessons',
    routeLabel: 'Go to Lessons List',
    summary:
      'Follow these four daily checks to guarantee every student gets working videos, accessible PDFs, accurate CBT grading, and timely reminders.',
    steps: [
      'Verify both the parent Topic AND Lesson/Test are toggled Published.',
      'Open every raw.githubusercontent.com PDF link once to confirm public access.',
      'Never commit student emails, private documents, or API keys to GitHub.',
    ],
    beats: [
      {
        title: '1. Publish Both Parent & Child',
        caption: 'A Published lesson inside a Draft topic stays hidden — publish the Topic too when launching.',
      },
      {
        title: '2. Keep Public Repos Clean',
        caption: 'Only upload public handouts to the materials repo. Never store student records or secrets there.',
      },
      {
        title: '3. Verify CBT Answer Keys',
        caption: 'Double-check every marked correct option and explanation before publishing a CBT practice test.',
      },
      {
        title: '4. Weekly Retention Rhythm',
        caption: 'Check Student Analytics weekly and broadcast encouragement or test reminders every few days.',
      },
    ],
  },
];
