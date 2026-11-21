export type LegalSlug =
  | 'privacy'
  | 'terms'
  | 'acceptable-use'
  | 'cookies'
  | 'student-safety';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  shortTitle: string;
  summary: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export const LEGAL_CONTACT_EMAIL = 'oyasordaniel@gmail.com';
export const LEGAL_EFFECTIVE_DATE = 'November 2026';

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy Policy',
    summary:
      'How Phosters Tutorial Centre collects, stores, uses, and protects your account, study progress, CBT test records, and optional Web Push notification subscriptions.',
    lastUpdated: LEGAL_EFFECTIVE_DATE,
    sections: [
      {
        heading: '1. Who We Are & Scope',
        paragraphs: [
          'Phosters Tutorial Centre ("Phosters", "we", "our") operates a mobile-first web application and Progressive Web App (PWA) built to help Nigerian students prepare for JAMB UTME and University of Ibadan (UI) Post-UTME examinations.',
          'This Privacy Policy applies to all visitors, students, parents/guardians, and tutorial administrators using the Phosters website and installed PWA.',
        ],
      },
      {
        heading: '2. Information We Collect Directly from You',
        paragraphs: [
          'We only collect data required to operate your tutorial account, personalize your syllabus, measure exam readiness, and deliver messages you choose to receive:',
        ],
        bullets: [
          'Account & profile details: Full name, email address, optional phone number, and account role (student or admin) stored in Supabase Auth and our profiles table.',
          'Academic setup: Selected examinations (JAMB UTME, UI Post-UTME), chosen subjects, intended university course, and target institution.',
          'Learning & CBT records: Lesson completion status, when you last opened a lesson, CBT test attempts, selected answers, scores, and submission timestamps.',
          'Session & login activity: Authentication timestamps (such as last sign-in time) used by tutorial administrators in the Student Progress dashboard to identify inactive or registered-not-started students for academic follow-up.',
          'Optional Web Push subscription data: Only if you explicitly click "Enable Notifications", your browser generates a Web Push subscription endpoint, encryption keys (p256dh and auth), basic user-agent string, notification category toggles (lectures, tests, broadcasts, reminders), and notification timestamps.',
        ],
      },
      {
        heading: '3. Third-Party Services That Process Your Data',
        paragraphs: [
          'Phosters uses trusted infrastructure and educational media providers to run the platform. We never sell student data or run third-party advertising trackers.',
        ],
        bullets: [
          'Supabase (Authentication & PostgreSQL Database): Stores account credentials, profiles, syllabi, progress, CBT attempts, and push subscriptions protected by Row-Level Security (RLS).',
          'Vercel (Hosting & Serverless Functions): Hosts the web application, API endpoints (/api/push/*), and scheduled daily reminder check.',
          'YouTube Privacy-Enhanced Mode (youtube-nocookie.com): Embedded lesson videos load through YouTube privacy-enhanced embeds when you play a lecture.',
          'GitHub Raw Content (raw.githubusercontent.com): Hosts downloadable PDF handouts and study notes linked within lessons.',
          'Browser Push Providers (Apple APNs, Google FCM, Mozilla Autopush): Deliver background notifications to your device solely when you have opted in to Web Push.',
        ],
      },
      {
        heading: '4. How We Use Your Information',
        paragraphs: [
          'Your data is used strictly for delivering your tutorial experience:',
        ],
        bullets: [
          'Authenticating your account and resetting forgotten passwords.',
          'Filtering lessons, topics, announcements, and CBT tests to match your chosen exams and subjects.',
          'Calculating subject progress, lesson streaks, and CBT performance analytics for you and Phosters administrators.',
          'Sending optional background notifications for new lectures, tutor broadcasts, unattempted tests, and study reminders.',
          'Allowing administrators to follow up with enrolled students who have not started or completed lessons.',
        ],
      },
      {
        heading: '5. Your Controls & Data Rights',
        paragraphs: [
          'You remain in control of your information at all times:',
        ],
        bullets: [
          'Update your name, phone number, target exams, and subjects directly from Profile and Exam Setup.',
          'Change your password or request a password reset email anytime from Sign In or Profile.',
          'Enable, customize by category, or turn off Web Push notifications anytime from Settings or Profile.',
          `Request export or permanent deletion of your student account and records by emailing ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of Use',
    shortTitle: 'Terms of Use',
    summary:
      'The terms governing access to Phosters courses, study notes, video lessons, CBT practice tests, and independent exam preparation disclaimers.',
    lastUpdated: LEGAL_EFFECTIVE_DATE,
    sections: [
      {
        heading: '1. Acceptance of Terms',
        paragraphs: [
          'By creating an account, signing in, or browsing Phosters Tutorial Centre, you agree to abide by these Terms of Use and our related policies. If you do not agree, please discontinue use of the platform.',
        ],
      },
      {
        heading: '2. Independent Educational Platform Disclaimer',
        paragraphs: [
          'Phosters is an independent tutorial and exam-preparation platform. Phosters is not affiliated with, endorsed by, or officially connected to the Joint Admissions and Matriculation Board (JAMB) or the University of Ibadan (UI).',
          'Practice CBT tests, predicted questions, video lectures, and study notes are provided strictly as study aids and do not guarantee admission or specific official examination scores.',
        ],
      },
      {
        heading: '3. Accounts & Security',
        paragraphs: [
          'Each student account is intended for a single learner so that lesson completion and CBT analytics remain accurate.',
        ],
        bullets: [
          'Provide accurate registration details when creating your account.',
          'Keep your password confidential and use the Forgot Password flow immediately if you suspect unauthorized access.',
          'Do not attempt to access another student’s data or bypass Row-Level Security controls.',
        ],
      },
      {
        heading: '4. Content License & Intellectual Property',
        paragraphs: [
          'All Phosters branding, curated lesson structures, original study notes, and CBT questions remain the intellectual property of Phosters Tutorial Centre or their respective tutors.',
          'Embedded videos remain subject to the creators’ rights on YouTube, and downloadable PDF study materials are licensed solely for your personal non-commercial exam preparation.',
        ],
      },
      {
        heading: '5. Service Availability & Updates',
        paragraphs: [
          'While Phosters caches core app screens and interface assets for quick loading, streaming video lectures, saving lesson progress, loading PDF handouts, and submitting CBT attempts require an active internet connection.',
          'We may add, revise, or retire lessons, tests, or platform features to improve exam accuracy.',
        ],
      },
      {
        heading: '6. Termination & Contact',
        paragraphs: [
          'Phosters reserves the right to suspend accounts that violate our Acceptable Use & Academic Integrity Policy or disrupt platform infrastructure.',
          `For support or legal inquiries regarding these terms, write to ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use & Academic Integrity Policy',
    shortTitle: 'Acceptable Use',
    summary:
      'Rules for fair study use, CBT integrity, account sharing restrictions, and prohibited automated scraping or abuse.',
    lastUpdated: LEGAL_EFFECTIVE_DATE,
    sections: [
      {
        heading: '1. Fair Study & CBT Integrity',
        paragraphs: [
          'Phosters CBT simulations exist to build real speed and accuracy for UTME and Post-UTME examinations.',
        ],
        bullets: [
          'Take timed practice tests honestly without automated answer scripts or browser manipulation.',
          'Do not submit falsified profile records or impersonate another student or tutor.',
        ],
      },
      {
        heading: '2. Prohibited Technical & Content Conduct',
        paragraphs: [
          'To protect learning resources for all enrolled students, you must not:',
        ],
        bullets: [
          'Mass-scrape, mirror, or redistribute Phosters question banks, lesson outlines, or downloadable PDF handouts.',
          'Probe, flood, or attempt unauthorized calls against /api/push/* endpoints, Supabase RPCs, or admin routes.',
          'Share admin credentials or attempt privilege escalation.',
        ],
      },
      {
        heading: '3. Reporting Issues',
        paragraphs: [
          `If you discover a broken question key, inaccurate syllabus note, or security concern, please notify ${LEGAL_CONTACT_EMAIL} so an administrator can review and correct it promptly.`,
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookies, Local Storage & Offline Cache Policy',
    shortTitle: 'Cookies & Offline Cache',
    summary:
      'Transparent breakdown of browser storage, authentication tokens, theme preferences, and PWA Workbox caching used by Phosters.',
    lastUpdated: LEGAL_EFFECTIVE_DATE,
    sections: [
      {
        heading: '1. Strictly Essential Authentication & Preference Storage',
        paragraphs: [
          'Phosters does not use advertising cookies, behavioral ad networks, or cross-site tracking pixels. We only store strictly necessary technical data locally on your device:',
        ],
        bullets: [
          'Supabase Auth session storage: Keeps you signed in safely across page reloads and standalone PWA launches.',
          'Theme preference (phosters_theme): Remembers whether you selected Light, Dark, or System appearance.',
          'UI prompt dismissal (phosters_push_banner_dismissed): Remembers if you dismissed the optional notification banner on the student Home screen.',
        ],
      },
      {
        heading: '2. Progressive Web App (PWA) & Workbox Offline Cache',
        paragraphs: [
          'When you visit Phosters or install it to your mobile home screen, our Service Worker uses Workbox to cache core HTML, CSS, JavaScript bundles, app icons, and Google Fonts so the app launches quickly even on weak mobile data connections.',
          'Supabase API calls, YouTube embeds, and backend push endpoints (/api/*) are excluded from offline caching so student data and test submissions stay live and accurate.',
        ],
      },
      {
        heading: '3. Managing or Clearing Local Data',
        paragraphs: [
          'Signing out clears your active Supabase session. You can also clear cached site data and unregister the Service Worker anytime from your browser’s Site Settings.',
        ],
      },
    ],
  },
  {
    slug: 'student-safety',
    title: 'Student & Minor Safety Notice',
    shortTitle: 'Student Safety',
    summary:
      'Safeguards for secondary school candidates, parent/guardian visibility, minimal data collection, and safe external study links.',
    lastUpdated: LEGAL_EFFECTIVE_DATE,
    sections: [
      {
        heading: '1. Built for UTME & Post-UTME Candidates',
        paragraphs: [
          'Many JAMB UTME and UI Post-UTME candidates using Phosters are secondary school students between ages 15 and 18. We design every interaction around safety and minimal data collection.',
        ],
      },
      {
        heading: '2. Zero Public Student Profiles or Peer Messaging',
        paragraphs: [
          'Students cannot browse, search, or message other students inside Phosters. Your study progress, phone number, and test scores are visible only to you and authorized Phosters tutorial administrators.',
        ],
      },
      {
        heading: '3. Curated Educational Media & Broadcast Links',
        paragraphs: [
          'Video lectures use YouTube privacy-enhanced embeds (youtube-nocookie.com), and tutor announcements or external study links are created solely by verified Phosters admins.',
        ],
      },
      {
        heading: '4. Parent & Guardian Requests',
        paragraphs: [
          `Parents or legal guardians who wish to review, update, or remove a minor student’s account may contact ${LEGAL_CONTACT_EMAIL} at any time.`,
        ],
      },
    ],
  },
];

export function getLegalDocument(slug?: string): LegalDocument {
  return (
    LEGAL_DOCUMENTS.find((doc) => doc.slug === slug) ?? LEGAL_DOCUMENTS[0]
  );
}
