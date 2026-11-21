import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Play,
  Sun,
} from 'lucide-react';
import { LEGAL_CONTACT_EMAIL, LEGAL_DOCUMENTS } from '../data/legalPolicies';
import { useAuth } from '../hooks/useAuth';
import { useTheme, type ThemeMode } from '../hooks/useTheme';

type ConnectPurpose = 'visit' | 'ui_support' | 'prayer' | 'volunteer';

interface MinistryCardItem {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  schedule: string;
  image: string;
  alt: string;
  actionType: 'connect' | 'academy' | 'youtube';
  purpose?: ConnectPurpose;
  isFlyerGraphic?: boolean;
}

interface PillarItem {
  id: string;
  label: string;
  scriptureRef: string;
  summary: string;
  scheduleNote: string;
  image: string;
  alt: string;
}

const HERO_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_12-16-41_2627_2__03315170.jpg';
const PROSKYNESIS_CARD_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_11-35-02_4464_36__214b33fd.jpg';
const WORSHIP_DRAPE_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_12-17-17_0587_30__0560dea7.jpg';
const SUNDAY_TEACHING_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_12-16-53_2026_11__30d0b2d1.jpg';
const MIDWEEK_MINISTER_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_12-17-16_0346_29__551cefb2.jpg';
const CAMPUS_STUDENTS_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_12-16-53_4694_10__f1d38e41.jpg';
const FELLOWSHIP_JOY_IMAGE = '/assets/aistudio/ResizedImage_2026-11-15_11-35-00_7854_35__e112d856.jpg';
const OFFICIAL_MINISTRY_BANNER = '/assets/aistudio/IMG-20261121-WA0018_235ddb0e.jpg';
const SUNDAY_SERVICE_GRAPHIC = '/assets/aistudio/IMG-20261017-WA0019_8c3e86f1.jpg';

const YOUTUBE_CHANNEL_SEARCH_URL =
  'https://www.youtube.com/results?search_query=%22The+Phosters+Ministries%22+Proskynesis';

const GATHERING_CARDS: MinistryCardItem[] = [
  {
    id: 'sunday-service',
    kicker: 'Weekly Gathering',
    title: 'Sunday Service',
    subtitle: 'Word exposition, worship, and fellowship at UI.',
    schedule: 'Sundays · 9:00 AM · JCR, Queen Elizabeth II Hall',
    image: SUNDAY_SERVICE_GRAPHIC,
    alt: 'The Phosters Ministries Sunday Service at 9am at JCR Queen Elizabeth Hall, University of Ibadan with Pastor Kunle and Pastor Mrs Treasure Heben',
    actionType: 'connect',
    purpose: 'visit',
    isFlyerGraphic: true,
  },
  {
    id: 'sunday-word',
    kicker: 'Word Exposition',
    title: 'Sunday Word',
    subtitle: 'Verse-by-verse teaching rooted in Scripture.',
    schedule: 'Sundays · 9:00 AM · JCR, Queen Elizabeth II Hall',
    image: SUNDAY_TEACHING_IMAGE,
    alt: 'Pastor Kunle preaching with microphone at The Phosters Ministries service',
    actionType: 'connect',
    purpose: 'visit',
  },
  {
    id: 'midweek-service',
    kicker: 'Midweek Word & Prayer',
    title: 'Tuesday Fellowship',
    subtitle: 'Focused Bible study and midweek prayer renewal.',
    schedule: 'Tuesdays · 5:00 PM – 6:00 PM · JCR, Queen Elizabeth II Hall',
    image: MIDWEEK_MINISTER_IMAGE,
    alt: 'Minister teaching inside JCR Queen Elizabeth Hall during fellowship',
    actionType: 'connect',
    purpose: 'visit',
  },
  {
    id: 'proskynesis',
    kicker: 'Annual Convocation',
    title: "Proskynesis '26",
    subtitle: 'Spiritual Sacrifices · Our 1st-anniversary worship evening.',
    schedule: 'Annual Gathering · Watch Archives on YouTube',
    image: WORSHIP_DRAPE_IMAGE,
    alt: 'Worship minister singing passionately during The Phosters Ministries gathering',
    actionType: 'youtube',
  },
  {
    id: 'phosters-academy',
    kicker: 'Educational Outreach',
    title: 'Phosters Academy',
    subtitle: 'Free JAMB UTME & UI Post-UTME video lessons and CBT mocks.',
    schedule: '100% Free · Open to All Aspirants',
    image: CAMPUS_STUDENTS_IMAGE,
    alt: 'University of Ibadan students smiling together inside JCR Queen Elizabeth Hall',
    actionType: 'academy',
  },
  {
    id: 'ui-campus-family',
    kicker: 'Campus Welcome',
    title: 'UI Freshers Care',
    subtitle: 'Orientation, campus directions, and student community.',
    schedule: 'Queen Elizabeth Hall 2 · University of Ibadan',
    image: FELLOWSHIP_JOY_IMAGE,
    alt: 'Joyful church member smiling in fellowship inside JCR Queen Elizabeth Hall',
    actionType: 'connect',
    purpose: 'ui_support',
  },
];

const MINISTRY_PILLARS: PillarItem[] = [
  {
    id: 'word',
    label: 'Word',
    scriptureRef: '2 Timothy 2:15',
    summary:
      'Every Sunday at 9:00 AM and Tuesday evening from 5:00 PM to 6:00 PM, we teach Scripture verse by verse so believers know Christ deeply and stand firm in truth.',
    scheduleNote: 'Sundays 9:00 AM · Tuesdays 5:00 PM – 6:00 PM',
    image: SUNDAY_TEACHING_IMAGE,
    alt: 'Pastor teaching the Word during worship service at The Phosters Ministries',
  },
  {
    id: 'worship',
    label: 'Worship',
    scriptureRef: 'John 4:23–24',
    summary:
      'From weekly assemblies at Queen Elizabeth Hall 2 to our annual Proskynesis convocation, worship is offered in spirit, truth, and unhurried reverence.',
    scheduleNote: 'Annual Proskynesis Worship & Word Evening',
    image: PROSKYNESIS_CARD_IMAGE,
    alt: 'Worship leader singing in front of The Phosters Ministries backdrop',
  },
  {
    id: 'discipleship',
    label: 'Discipleship',
    scriptureRef: 'Philippians 2:15',
    summary:
      'True to the name Phosteres (light-bearers), we walk closely with young men and women to build godly character, spiritual discipline, and purpose.',
    scheduleNote: 'JCR, Queen Elizabeth Hall 2, University of Ibadan',
    image: HERO_IMAGE,
    alt: 'Pastor Kunle encouraging believers during a teaching session',
  },
  {
    id: 'prayer',
    label: 'Prayer',
    scriptureRef: '1 Thessalonians 5:17',
    summary:
      'Intercession anchors everything we do—praying for students facing examinations, families across Ibadan, and spiritual awakening on campus.',
    scheduleNote: 'Tuesdays 5:00 PM – 6:00 PM · Midweek Service',
    image: MIDWEEK_MINISTER_IMAGE,
    alt: 'Midweek fellowship teaching and prayer session at Queen Elizabeth Hall 2',
  },
  {
    id: 'fellowship',
    label: 'Fellowship',
    scriptureRef: 'Acts 2:42',
    summary:
      'No student has to walk through University of Ibadan alone. Our church family shares life, encouragement, and practical hospitality every week.',
    scheduleNote: 'Open to UI Students, Staff & Ibadan Residents',
    image: FELLOWSHIP_JOY_IMAGE,
    alt: 'Smiling member sharing fellowship inside JCR Queen Elizabeth Hall 2',
  },
  {
    id: 'outreach',
    label: 'Free Academy',
    scriptureRef: 'Matthew 5:16',
    summary:
      'Through Phosters Academy, we serve JAMB UTME and UI Post-UTME aspirants with structured video classes, notes, and CBT simulations completely free of charge.',
    scheduleNote: 'Free Online Prep · Powered by The Phosters Ministries',
    image: CAMPUS_STUDENTS_IMAGE,
    alt: 'Students gathered warmly inside Queen Elizabeth Hall at University of Ibadan',
  },
];

const PURPOSE_OPTIONS: Array<{
  id: ConnectPurpose;
  label: string;
  hint: string;
}> = [
  {
    id: 'visit',
    label: 'Attend Sunday / Midweek',
    hint: 'Let us know you are visiting JCR, Queen Elizabeth Hall 2 (Sun 9 AM or Tue 5–6 PM).',
  },
  {
    id: 'ui_support',
    label: 'UI Aspirant / Fresher Care',
    hint: 'Need UI Post-UTME directions, resumption guidance, or a campus welcome?',
  },
  {
    id: 'prayer',
    label: 'Prayer & Counselling',
    hint: 'Share a prayer point or request a conversation with a pastor.',
  },
  {
    id: 'volunteer',
    label: 'Serve with Outreach',
    hint: 'Join the worship, hospitality, media, or Phosters Academy team.',
  },
];

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
];

interface SafePhotoProps {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
  fallbackTitle: string;
}

function SafePhoto({ src, alt, className = '', lazy = false, fallbackTitle }: SafePhotoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={[
          'flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-ministry-900 via-slate-900 to-slate-950 text-slate-100',
          className,
        ].join(' ')}
      >
        <BookOpen className="h-7 w-7 text-ministry-300 mb-2" aria-hidden="true" />
        <p className="font-display text-base font-semibold">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function MinistriesPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const [activePillarId, setActivePillarId] = useState<string>(MINISTRY_PILLARS[0].id);
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [purpose, setPurpose] = useState<ConnectPurpose>('visit');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    fullName: string;
    contact: string;
    purposeLabel: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'The Phosters Ministries — JCR Queen Elizabeth II Hall, University of Ibadan';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const academyHref = user ? '/app' : '/';
  const activePillar =
    MINISTRY_PILLARS.find((p) => p.id === activePillarId) ?? MINISTRY_PILLARS[0];
  const selectedPurposeObj =
    PURPOSE_OPTIONS.find((item) => item.id === purpose) ?? PURPOSE_OPTIONS[0];

  function scrollCarousel(direction: 'left' | 'right') {
    const container = carouselRef.current;
    if (!container) return;
    const distance = direction === 'left' ? -340 : 340;
    container.scrollBy({ left: distance, behavior: 'smooth' });
  }

  function jumpToConnect(nextPurpose: ConnectPurpose) {
    setPurpose(nextPurpose);
    const el = document.getElementById('connect');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function handleConnectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const cleanName = fullName.trim();
    const cleanContact = contact.trim();
    const cleanMessage = message.trim();

    if (cleanName.length < 2) {
      setFormError('Please enter your full name.');
      return;
    }

    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContact);
    const digitsOnly = cleanContact.replace(/\D/g, '');
    const looksLikePhone = digitsOnly.length >= 10 && digitsOnly.length <= 15;

    if (!looksLikeEmail && !looksLikePhone) {
      setFormError('Enter a valid email address or Nigerian/WhatsApp phone number.');
      return;
    }

    if (purpose === 'prayer' && cleanMessage.length < 5) {
      setFormError('Please share a brief note for your prayer or counselling request.');
      return;
    }

    setSubmittedRecord({
      fullName: cleanName,
      contact: cleanContact,
      purposeLabel: selectedPurposeObj.label,
      message: cleanMessage,
    });
  }

  function buildMailtoHref(): string {
    if (!submittedRecord) return `mailto:${LEGAL_CONTACT_EMAIL}`;
    const subject = encodeURIComponent(
      `[The Phosters Ministries] ${submittedRecord.purposeLabel} — ${submittedRecord.fullName}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${submittedRecord.fullName}`,
        `Contact: ${submittedRecord.contact}`,
        `Inquiry: ${submittedRecord.purposeLabel}`,
        submittedRecord.message ? `Message:\n${submittedRecord.message}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    return `mailto:${LEGAL_CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#07080b] text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#07080b]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          <Link
            to="/ministries"
            className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded"
          >
            The Phosters Ministries
          </Link>

          <nav
            aria-label="Ministry navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <a
              href="#gatherings"
              className="py-1 whitespace-nowrap shrink-0 hover:text-white hover:underline underline-offset-8 decoration-2 transition-colors"
            >
              Gatherings
            </a>
            <a
              href="#academy-outreach"
              className="py-1 whitespace-nowrap shrink-0 hover:text-white hover:underline underline-offset-8 decoration-2 transition-colors"
            >
              Academy
            </a>
            <a
              href="#pillars"
              className="py-1 whitespace-nowrap shrink-0 hover:text-white hover:underline underline-offset-8 decoration-2 transition-colors"
            >
              Pillars
            </a>
            <a
              href="#connect"
              className="py-1 whitespace-nowrap shrink-0 hover:text-white hover:underline underline-offset-8 decoration-2 transition-colors"
            >
              Connect
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Link
              to={academyHref}
              className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-lg bg-white text-slate-950 text-xs sm:text-sm font-semibold hover:bg-ministry-50 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Phosters Academy
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. Framed Dark Hero Canvas with Floating Next Gathering / Proskynesis Card */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-10 sm:pt-6 sm:pb-14">
          <div className="relative rounded-2xl overflow-hidden border border-white/10 min-h-[500px] sm:min-h-[560px] lg:min-h-[620px] flex flex-col justify-end">
            <SafePhoto
              src={HERO_IMAGE}
              alt="Pastor Kunle preaching at The Phosters Ministries in Ibadan"
              className="absolute inset-0 h-full w-full object-cover object-[50%_18%]"
              fallbackTitle="The Phosters Ministries"
            />
            {/* Measured royal indigo & violet editorial scrim matching brand palette */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04061c]/95 via-[#0e1975]/70 to-[#1f1266]/45"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#060928]/85 via-[#1c2bd8]/40 to-[#5c20c9]/30"
            />

            <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="max-w-2xl space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-ministry-200 font-medium">
                  <span>JCR, Queen Elizabeth Hall 2</span>
                  <span aria-hidden="true">·</span>
                  <span>University of Ibadan</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Sundays 9:00 AM</span>
                </div>

                <h1 className="font-display text-[clamp(2.25rem,4.4vw,3.9rem)] font-bold tracking-tight text-white leading-[1.06]">
                  Shine as lights in the Word and worship.
                </h1>

                <p className="text-sm sm:text-base text-slate-100/90 max-w-xl leading-relaxed">
                  Join a Christ-centred church family inside University of Ibadan every Sunday at 9:00 AM and Tuesday from 5:00 PM to 6:00 PM—growing together in Scripture, prayer, and campus outreach.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => jumpToConnect('visit')}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-lg bg-white text-slate-950 text-sm sm:text-base font-semibold hover:bg-ministry-50 transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Plan Your Sunday Visit</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <a
                    href="#academy-outreach"
                    className="inline-flex items-center gap-1.5 min-h-[44px] text-sm sm:text-base font-semibold text-white/90 hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Free UI &amp; JAMB Academy</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Bottom-Right Floating Highlight Card (matches reference hero vignette) */}
              <div className="w-full sm:w-80 rounded-xl border border-white/15 bg-black/75 backdrop-blur-md overflow-hidden shrink-0">
                <div className="p-3.5 flex items-center gap-3.5">
                  <div className="relative h-20 w-24 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <SafePhoto
                      src={PROSKYNESIS_CARD_IMAGE}
                      alt="Worship minister leading Proskynesis worship evening"
                      className="h-full w-full object-cover object-top"
                      fallbackTitle="Proskynesis '26"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[11px] font-medium text-ministry-300">
                      1st Anniversary · Nov 2026
                    </p>
                    <p className="font-display text-sm font-bold text-white leading-snug truncate">
                      Proskynesis &apos;26
                    </p>
                    <p className="text-xs text-slate-300 truncate">
                      Spiritual Sacrifices
                    </p>
                    <a
                      href={YOUTUBE_CHANNEL_SEARCH_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-white hover:text-ministry-300 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>Watch on YouTube</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Horizontal Swipeable Portrait Gathering & Outreach Cards */}
        <section
          id="gatherings"
          aria-labelledby="gatherings-strip-heading"
          className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-16 sm:pb-20"
        >
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h2
                id="gatherings-strip-heading"
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white"
              >
                Gatherings &amp; Outreach
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                JCR, Queen Elizabeth Hall 2, UI · Sun 9:00 AM · Tue 5:00 – 6:00 PM
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-label="Scroll gatherings left"
                onClick={() => scrollCarousel('left')}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Scroll gatherings right"
                onClick={() => scrollCarousel('right')}
                className="inline-flex items-center justify-center h-10 w-10 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
          >
            {GATHERING_CARDS.map((card) => {
              const cardContent = card.isFlyerGraphic ? (
                <article className="relative h-[380px] sm:h-[420px] w-[280px] sm:w-[300px] shrink-0 snap-start rounded-2xl overflow-hidden border border-white/15 bg-[#121316] group">
                  <SafePhoto
                    src={card.image}
                    alt={card.alt}
                    lazy
                    className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                    fallbackTitle={card.title}
                  />
                </article>
              ) : (
                <article className="relative h-[380px] sm:h-[420px] w-[260px] sm:w-[272px] shrink-0 snap-start rounded-2xl overflow-hidden border border-white/10 bg-slate-900 group">
                  <SafePhoto
                    src={card.image}
                    alt={card.alt}
                    lazy
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
                    fallbackTitle={card.title}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#04061a]/95 via-[#0b114d]/55 to-black/15"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5 space-y-2 text-left">
                    <p className="text-[11px] font-medium text-ministry-300">
                      {card.kicker}
                    </p>
                    <h3 className="font-display text-2xl font-bold text-white leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-200 leading-snug">
                      {card.subtitle}
                    </p>
                    <p className="pt-1 text-[11px] text-slate-300 tabular-nums border-t border-white/15">
                      {card.schedule}
                    </p>
                  </div>
                </article>
              );

              if (card.actionType === 'academy') {
                return (
                  <Link
                    key={card.id}
                    to={academyHref}
                    className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-2xl"
                  >
                    {cardContent}
                  </Link>
                );
              }

              if (card.actionType === 'youtube') {
                return (
                  <a
                    key={card.id}
                    href={YOUTUBE_CHANNEL_SEARCH_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-2xl"
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => jumpToConnect(card.purpose ?? 'visit')}
                  className="shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-2xl"
                >
                  {cardContent}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Full-Bleed Atmospheric Center Banner — Phosters Academy Outreach Bridge */}
        <section
          id="academy-outreach"
          aria-labelledby="outreach-banner-heading"
          className="relative overflow-hidden border-t border-white/10 min-h-[440px] sm:min-h-[500px] flex items-center"
        >
          <SafePhoto
            src={CAMPUS_STUDENTS_IMAGE}
            alt="University of Ibadan students smiling together inside Queen Elizabeth Hall"
            lazy
            className="absolute inset-0 h-full w-full object-cover object-[50%_28%]"
            fallbackTitle="Phosters Academy"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#04061c]/88 via-[#0f1769]/70 to-[#04061c]/90"
          />

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24 text-center space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-ministry-200 font-medium">
              <span>Educational Outreach</span>
              <span aria-hidden="true">·</span>
              <span>JAMB UTME &amp; UI Post-UTME</span>
              <span aria-hidden="true">·</span>
              <span>100% Free Access</span>
            </div>

            <h2
              id="outreach-banner-heading"
              className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]"
            >
              Are you a University of Ibadan aspirant or schooling in Ibadan?
            </h2>

            <p className="text-base sm:text-lg text-slate-100/90 max-w-2xl mx-auto leading-relaxed">
              Phosters Academy is free for you—offering structured video lectures, downloadable notes, and instant CBT practice tests with zero tuition fees and no membership requirement.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link
                to={academyHref}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-lg bg-white text-slate-950 text-sm sm:text-base font-semibold hover:bg-ministry-50 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{user ? 'Open Phosters Academy' : 'Start Free on Phosters Academy'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              {!user && (
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-white/25 bg-black/35 text-white text-sm sm:text-base font-semibold hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
                >
                  Create Student Account
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* 4. Crisp Light-Canvas Interactive Stacked Pillars Split (matches bottom section of reference) */}
        <section
          id="pillars"
          aria-labelledby="pillars-heading"
          className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <p
                id="pillars-heading"
                className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400"
              >
                Pillars of The Phosters Ministries · Select to explore
              </p>

              <div className="flex flex-col items-start space-y-1">
                {MINISTRY_PILLARS.map((pillar) => {
                  const isActive = pillar.id === activePillar.id;
                  return (
                    <button
                      key={pillar.id}
                      type="button"
                      onClick={() => setActivePillarId(pillar.id)}
                      className={[
                        'text-left font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.12] transition-colors cursor-pointer py-0.5',
                        isActive
                          ? 'text-slate-950 dark:text-white underline decoration-ministry-600 dark:decoration-ministry-400 decoration-2 underline-offset-8'
                          : 'text-slate-300 dark:text-slate-700 hover:text-slate-600 dark:hover:text-slate-400',
                      ].join(' ')}
                    >
                      {pillar.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-medium text-ministry-600 dark:text-ministry-400">
                  {activePillar.scriptureRef} · {activePillar.scheduleNote}
                </p>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activePillar.summary}
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="relative aspect-[3/4] sm:aspect-[4/5] max-w-lg mx-auto lg:mx-0 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                <SafePhoto
                  key={activePillar.id}
                  src={activePillar.image}
                  alt={activePillar.alt}
                  lazy
                  className="h-full w-full object-cover object-top"
                  fallbackTitle={activePillar.label}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Venue</p>
                  <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100">
                    JCR, Queen Elizabeth Hall 2, UI
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sunday Service</p>
                  <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    Sundays · 9:00 AM
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Midweek Service</p>
                  <p className="mt-0.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    Tuesdays · 5:00 – 6:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Plan a Visit, UI Fresher Care & Prayer Request (#connect) */}
        <section
          id="connect"
          aria-labelledby="connect-heading"
          className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[16/7] bg-ministry-900">
                <SafePhoto
                  src={OFFICIAL_MINISTRY_BANNER}
                  alt="The Phosters Ministries official emblem and wordmark banner"
                  lazy
                  className="h-full w-full object-cover"
                  fallbackTitle="The Phosters Ministries"
                />
              </div>

              <p className="text-xs font-medium text-ministry-600 dark:text-ministry-400">
                Worship &amp; Connect
              </p>
              <h2
                id="connect-heading"
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight"
              >
                Join us at Queen Elizabeth Hall 2 this week
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Visiting for Sunday service at 9:00 AM, Tuesday midweek at 5:00 PM, coming to Ibadan for UI Post-UTME, or sending a prayer request? Leave a note below and we will welcome you gladly.
              </p>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 py-1">
                  <span className="text-slate-500 dark:text-slate-400 shrink-0">Pastors</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 text-right">
                    Pastor Kunle &amp; Pastor Mrs Treasure Heben
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 shrink-0">
                    <MapPin className="h-4 w-4 text-ministry-600 dark:text-ministry-400" aria-hidden="true" />
                    <span>Venue</span>
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 text-right">
                    JCR, Queen Elizabeth Hall 2, University of Ibadan
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-slate-500 dark:text-slate-400">Sunday &amp; Midweek</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 text-right tabular-nums">
                    Sun 9:00 AM · Tue 5:00 – 6:00 PM
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-slate-500 dark:text-slate-400">Ministry Desk</span>
                  <a
                    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                    className="font-medium text-ministry-600 dark:text-ministry-400 hover:underline"
                  >
                    {LEGAL_CONTACT_EMAIL}
                  </a>
                </div>
                <div className="flex items-center justify-between gap-4 py-1">
                  <span className="text-slate-500 dark:text-slate-400">YouTube</span>
                  <a
                    href={YOUTUBE_CHANNEL_SEARCH_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-ministry-600 dark:text-ministry-400 hover:underline"
                  >
                    <span>The Phosters Ministries</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8">
                {submittedRecord ? (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className="h-6 w-6 text-ministry-600 dark:text-ministry-400 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          Your note is ready to send
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Thank you, {submittedRecord.fullName}. Click below to send this directly through your email app to our team, or edit your message.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">Category</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {submittedRecord.purposeLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500 dark:text-slate-400">Reply Contact</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {submittedRecord.contact}
                        </span>
                      </div>
                      {submittedRecord.message && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Message</p>
                          <p className="mt-1 text-slate-700 dark:text-slate-200 whitespace-pre-line">
                            {submittedRecord.message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href={buildMailtoHref()}
                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-ministry-600 text-white text-sm font-semibold hover:bg-ministry-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        <span>Send via Email App</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmittedRecord(null);
                          setFormError(null);
                        }}
                        className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Edit Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleConnectSubmit} noValidate className="space-y-5">
                    <div className="space-y-2">
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        How can we serve you?
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PURPOSE_OPTIONS.map((option) => {
                          const active = purpose === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setPurpose(option.id)}
                              className={[
                                'text-left px-3.5 py-2.5 min-h-[44px] rounded-lg border text-xs sm:text-sm font-medium transition-colors cursor-pointer',
                                active
                                  ? 'border-ministry-600 bg-ministry-50 dark:bg-ministry-900/40 text-ministry-800 dark:text-ministry-200'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700',
                              ].join(' ')}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedPurposeObj.hint}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="ministry-name"
                          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                          Full Name
                        </label>
                        <input
                          id="ministry-name"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Toluwani Adeyemi"
                          required
                          className="w-full min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ministry-600"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="ministry-contact"
                          className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                        >
                          Email or WhatsApp Number
                        </label>
                        <input
                          id="ministry-contact"
                          type="text"
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          placeholder="you@example.com or 080..."
                          required
                          className="w-full min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ministry-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="ministry-message"
                        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
                      >
                        Message or Prayer Request
                      </label>
                      <textarea
                        id="ministry-message"
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us which Sunday or Tuesday service you are visiting, or share a prayer point..."
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-ministry-600"
                      />
                    </div>

                    {formError && (
                      <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                        {formError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Creates a formatted note with direct ministry email handoff.
                      </p>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg bg-ministry-600 text-white text-sm font-semibold hover:bg-ministry-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Prepare Ministry Note
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 bg-[#07080b] text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="sm:col-span-2 space-y-2.5">
              <p className="font-display text-lg font-bold text-white">
                The Phosters Ministries
              </p>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
                Meeting at JCR, Queen Elizabeth Hall 2, University of Ibadan · Sunday Service 9:00 AM · Midweek Tuesday 5:00 PM – 6:00 PM.
              </p>
            </div>

            <div className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Explore
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                <li>
                  <a href="#gatherings" className="hover:text-white transition-colors">
                    Gatherings &amp; Proskynesis
                  </a>
                </li>
                <li>
                  <a href="#pillars" className="hover:text-white transition-colors">
                    Ministry Pillars
                  </a>
                </li>
                <li>
                  <Link to={academyHref} className="hover:text-white transition-colors">
                    Phosters Academy (Free Prep)
                  </Link>
                </li>
                <li>
                  <a href="#connect" className="hover:text-white transition-colors">
                    Plan a Visit &amp; Prayer
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Appearance &amp; Legal
              </h2>
              <div
                role="radiogroup"
                aria-label="Theme switcher"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-white/10"
              >
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setTheme(opt.value)}
                      className={[
                        'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0',
                        active
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {LEGAL_DOCUMENTS.slice(0, 2).map((doc) => (
                  <li key={doc.slug}>
                    <Link
                      to={`/legal/${doc.slug}`}
                      className="hover:text-white transition-colors"
                    >
                      {doc.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} The Phosters Ministries. University of Ibadan.</span>
            <span>Outreach Arm: Phosters Academy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
