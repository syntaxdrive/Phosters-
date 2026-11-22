import {
  ArrowUpDown,
  BellRing,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderGit2,
  Lock,
  Mail,
  MessageSquare,
  MousePointer2,
  Pin,
  Play,
  Send,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';
import type { TutorGuideChapter } from '../../data/tutorGuideChapters';

interface TutorMotionStageProps {
  chapter: TutorGuideChapter;
  beatIndex: 0 | 1 | 2 | 3;
  isPlaying: boolean;
  progressPercent: number;
  sceneInstanceKey: string;
}

function StageGridBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
    >
      <defs>
        <pattern
          id="tutor-stage-grid"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tutor-stage-grid)" />
    </svg>
  );
}

function OverviewScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  const nodes = [
    { label: '01. Exam', detail: 'JAMB UTME · UI Post-UTME', activeFrom: 0 },
    { label: '02. Subject', detail: 'Chemistry · Mathematics', activeFrom: 1 },
    { label: '03. Topic', detail: 'Ordered modules (1, 2, 3)', activeFrom: 2 },
    { label: '04. Lesson', detail: 'Video + Raw PDF Notes', activeFrom: 2 },
    { label: '05. CBT Test', detail: 'Server-graded MCQs', activeFrom: 3 },
  ];

  return (
    <div className="relative flex h-full flex-col justify-between gap-4 p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div key={`ov-head-${beatIndex}`} className="mg-anim-rise space-y-1">
          <p className="font-mono text-xs text-phosters-300 tabular-nums">
            WORKFLOW PIPELINE · 5 STAGES
          </p>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            {beatIndex === 0 && 'From Admin Overview to Student Enrollment'}
            {beatIndex === 1 && 'Examinations Unlock Allowed Subjects'}
            {beatIndex === 2 && 'Topics Organize Lessons & Handouts'}
            {beatIndex === 3 && 'Published Tracks Go Live for Students'}
          </h3>
        </div>
        <div className="hidden sm:block text-right font-mono text-xs text-slate-400 tabular-nums">
          <div>LIVE DATABASE SYNC</div>
          <div className="text-phosters-300">
            {beatIndex >= 3 ? 'STATUS · PUBLISHED' : 'BUILDING CURRICULUM'}
          </div>
        </div>
      </div>

      {/* Horizontal connected node flow */}
      <div className="relative grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 items-center my-auto">
        {nodes.map((node, idx) => {
          const active = beatIndex >= node.activeFrom;
          const highlighted =
            (beatIndex === 0 && idx === 0) ||
            (beatIndex === 1 && idx <= 1) ||
            (beatIndex === 2 && idx >= 2 && idx <= 3) ||
            (beatIndex === 3 && idx === 4);

          return (
            <div
              key={`${node.label}-${beatIndex}`}
              className={[
                'relative rounded-xl border p-3 transition-all duration-300 mg-anim-pop',
                highlighted
                  ? 'border-phosters-400 bg-phosters-900/50 text-white shadow-lg shadow-phosters-900/40 -translate-y-0.5'
                  : active
                    ? 'border-slate-700 bg-slate-900/90 text-slate-100'
                    : 'border-slate-800/80 bg-slate-900/40 text-slate-500',
              ].join(' ')}
            >
              <div className="font-mono text-[11px] text-phosters-300 tabular-nums">
                STEP 0{idx + 1}
              </div>
              <div className="mt-1 text-sm font-bold">{node.label.slice(4)}</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-400">
                {node.detail}
              </div>
              {highlighted && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-xl border border-phosters-400 mg-anim-ring"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom student preview strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-t border-slate-800/90 pt-3">
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <BookOpen className="h-4 w-4 text-phosters-400 shrink-0" aria-hidden="true" />
          <span>Students only see subjects linked to their Exam.</span>
        </div>
        <div className="flex items-center gap-2.5 text-xs text-slate-300">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
          <span>Draft items remain strictly hidden from students.</span>
        </div>
        <div
          className={[
            'flex items-center gap-2.5 text-xs transition-opacity duration-300',
            beatIndex >= 3 ? 'text-phosters-300 font-semibold opacity-100' : 'text-slate-500 opacity-75',
          ].join(' ')}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {beatIndex >= 3
              ? 'Published lessons & tests appear in /app/subjects'
              : 'Toggle Published when each stage is ready'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TaxonomyScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  return (
    <div className="relative grid h-full grid-cols-1 sm:grid-cols-12 gap-4 p-5 sm:p-7 items-center">
      {/* Left panel: Exam + Subject Mapping */}
      <div className="sm:col-span-5 space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">EXAMINATIONS &amp; SUBJECTS</span>
          <span className="text-phosters-300 font-medium">Active Track</span>
        </div>

        <div className="space-y-2">
          <div
            className={[
              'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all duration-300',
              beatIndex === 0
                ? 'border-phosters-400 bg-phosters-900/40 text-white'
                : 'border-slate-800 bg-slate-950/60 text-slate-300',
            ].join(' ')}
          >
            <span className="font-semibold">JAMB UTME</span>
            <span className="font-mono text-phosters-300">4 subjects</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
            <span className="font-medium">UI Post-UTME</span>
            <span className="font-mono">Mapped</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
          <div className="text-slate-400">Mapped subjects inside JAMB UTME</div>
          <div className="grid grid-cols-2 gap-1.5 font-medium text-slate-200">
            <div className="rounded bg-slate-800/80 px-2.5 py-1.5">Use of English</div>
            <div className="rounded bg-slate-800/80 px-2.5 py-1.5">Mathematics</div>
            <div className="rounded bg-slate-800/80 px-2.5 py-1.5">Chemistry</div>
            <div className="rounded bg-slate-800/80 px-2.5 py-1.5">Physics</div>
          </div>
        </div>
      </div>

      {/* Right panel: Topic Ordering, Comments, Publish Toggle */}
      <div className="sm:col-span-7 space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4 relative">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">TOPICS · JAMB CHEMISTRY</span>
          <span className="tabular-nums">Display Order 1–3</span>
        </div>

        <div className="space-y-2.5">
          {[
            { order: 1, title: 'Atomic Structure & Periodicity', comments: true, published: true },
            {
              order: 2,
              title: 'Chemical Bonding & Hybridization',
              comments: beatIndex >= 2,
              published: beatIndex >= 3,
            },
          ].map((topic, idx) => (
            <div
              key={`${topic.order}-${beatIndex}`}
              className={[
                'rounded-lg border p-3 transition-all duration-300',
                idx === 1 && beatIndex >= 1
                  ? 'border-phosters-400/80 bg-slate-950/90 mg-anim-rise'
                  : 'border-slate-800 bg-slate-950/60',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-phosters-300 tabular-nums">
                    0{topic.order}.
                  </span>
                  <span className="truncate text-sm font-semibold text-white">
                    {topic.title}
                  </span>
                </div>
                <span
                  className={[
                    'text-[11px] font-semibold shrink-0',
                    topic.published ? 'text-phosters-300' : 'text-amber-400',
                  ].join(' ')}
                >
                  {topic.published ? 'Published' : 'Draft'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>
                    Discussions: {topic.comments ? 'Enabled' : 'Paused'}
                  </span>
                </span>

                {idx === 1 && beatIndex === 2 && (
                  <span className="text-phosters-300 font-medium mg-anim-pop">
                    Inspect &amp; moderate comments inline
                  </span>
                )}
                {idx === 1 && beatIndex === 3 && (
                  <span className="text-phosters-300 font-medium mg-anim-pop">
                    Visible to enrolled students now
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Animated virtual cursor */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-14 left-12 text-phosters-300 drop-shadow mg-anim-cursor"
        >
          <MousePointer2 className="h-5 w-5 fill-slate-950" />
        </div>
      </div>
    </div>
  );
}

function LessonsScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  return (
    <div className="relative grid h-full grid-cols-1 sm:grid-cols-12 gap-4 p-5 sm:p-7 items-center">
      {/* Left: Editor Form Card */}
      <div className="sm:col-span-7 space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">LESSON EDITOR · /admin/lessons/new</span>
          <span className="text-phosters-300">Topic 01 · Chemistry</span>
        </div>

        <div className="space-y-2.5">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
            <div className="text-[11px] text-slate-400">Lesson Title &amp; Tutor</div>
            <div className="mt-0.5 text-sm font-semibold text-white">
              Balancing Redox Equations · Tutor Kunle
            </div>
          </div>

          <div
            className={[
              'rounded-lg border px-3 py-2 transition-all duration-300',
              beatIndex === 1
                ? 'border-phosters-400 bg-phosters-900/30 mg-anim-pop'
                : 'border-slate-800 bg-slate-950/80',
            ].join(' ')}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-phosters-400" aria-hidden="true" />
                <span>YouTube Lecture URL</span>
              </span>
              <span className="text-phosters-300 font-mono">youtube-nocookie</span>
            </div>
            <div className="mt-0.5 truncate font-mono text-xs text-slate-200">
              https://youtu.be/phosters-chem-01
            </div>
          </div>

          <div
            className={[
              'rounded-lg border px-3 py-2 space-y-1.5 transition-all duration-300',
              beatIndex === 2
                ? 'border-phosters-400 bg-phosters-900/30 mg-anim-rise'
                : 'border-slate-800 bg-slate-950/80',
            ].join(' ')}
          >
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-phosters-400" aria-hidden="true" />
                <span>Study Material (GitHub Raw)</span>
              </span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                <span>Reorder</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-slate-200">
              <span className="inline-flex items-center gap-1.5 truncate font-mono">
                <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  raw.githubusercontent.com/.../redox-notes.pdf
                </span>
              </span>
              <span className="text-phosters-300 shrink-0 font-semibold">PDF</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Live Student Video Preview + Publish Action */}
      <div className="sm:col-span-5 space-y-3">
        <div
          key={`vid-${beatIndex}`}
          className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2.5 mg-anim-slide-right"
        >
          <div className="aspect-video rounded-lg border border-slate-800 bg-slate-950 flex flex-col items-center justify-center gap-2 relative overflow-hidden">
            <div className="h-10 w-10 rounded-full bg-phosters-600/90 text-white flex items-center justify-center shadow">
              <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {beatIndex >= 1 ? 'EMBED READY · PRIVACY MODE' : 'PASTE YOUTUBE LINK'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-400">Visibility</span>
            <span
              className={[
                'font-semibold',
                beatIndex >= 3 ? 'text-phosters-300' : 'text-amber-400',
              ].join(' ')}
            >
              {beatIndex >= 3 ? 'Published + Push Sent' : 'Draft Preview'}
            </span>
          </div>

          {beatIndex >= 3 && (
            <div className="rounded-lg border border-phosters-500/50 bg-phosters-900/40 px-3 py-2 flex items-center gap-2 text-xs text-phosters-200 mg-anim-pop">
              <BellRing className="h-4 w-4 text-phosters-300 shrink-0" aria-hidden="true" />
              <span>Enrolled Chemistry students notified automatically.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CbtScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  const options = [
    { key: 'A', text: '+2', correct: false },
    { key: 'B', text: '+4', correct: false },
    { key: 'C', text: '+7', correct: true },
    { key: 'D', text: '+6', correct: false },
  ];

  return (
    <div className="relative grid h-full grid-cols-1 sm:grid-cols-12 gap-4 p-5 sm:p-7 items-center">
      {/* Left: Question Authoring Card */}
      <div className="sm:col-span-7 space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">TEST BUILDER · /admin/tests/new</span>
          <span className="text-phosters-300">
            {beatIndex === 0 ? 'Attach: Lesson or Topic' : 'Question 01 · 1 pt'}
          </span>
        </div>

        <div className="text-sm font-semibold text-white">
          What is the oxidation number of Manganese in KMnO₄?
        </div>

        <div className="grid grid-cols-2 gap-2">
          {options.map((opt) => (
            <div
              key={`${opt.key}-${beatIndex}`}
              className={[
                'flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-all duration-300',
                opt.correct && beatIndex >= 1
                  ? 'border-phosters-400 bg-phosters-900/45 text-white font-semibold mg-anim-pop'
                  : 'border-slate-800 bg-slate-950/70 text-slate-300',
              ].join(' ')}
            >
              <span>
                <strong className="font-mono mr-1.5">{opt.key}.</strong>
                {opt.text}
              </span>
              {opt.correct && beatIndex >= 1 && (
                <Check className="h-3.5 w-3.5 text-phosters-300" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
          <span className="text-slate-400">Post-submission explanation: </span>
          +1 + Mn + 4(-2) = 0, so Mn = +7.
        </div>
      </div>

      {/* Right: Security & Grading Outcome */}
      <div className="sm:col-span-5 space-y-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Answer keys stay hidden during tests</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Database row-level rules strip <code className="font-mono text-slate-200">is_correct</code> before student submission so answers cannot be inspected in browser dev tools.
          </p>

          <div
            key={`cbt-score-${beatIndex}`}
            className={[
              'rounded-lg border p-3 transition-all duration-300',
              beatIndex >= 3
                ? 'border-phosters-500/60 bg-phosters-900/40 mg-anim-pop'
                : 'border-slate-800 bg-slate-950/70',
            ].join(' ')}
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-phosters-400" aria-hidden="true" />
                <span>PostgreSQL Grading</span>
              </span>
              <span className="font-mono">submit_test_attempt</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl font-bold text-white tabular-nums">
                {beatIndex >= 3 ? '8 / 10 · 80%' : 'Awaiting Submit'}
              </span>
              <span className="text-xs text-phosters-300 font-medium">
                {beatIndex >= 2 ? 'Explanations ON' : 'Configured'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentsScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  const rows = [
    { name: 'Amina Bello', exam: 'JAMB UTME', status: 'Inactive 9d', pct: '35%', selected: beatIndex >= 2 },
    { name: 'Chinedu Okafor', exam: 'UI Post-UTME', status: 'Not started', pct: '0%', selected: beatIndex >= 2 },
    { name: 'Tolu Adeyemi', exam: 'JAMB UTME', status: 'In progress', pct: '78%', selected: false },
  ];

  return (
    <div className="relative flex h-full flex-col justify-between gap-3 p-5 sm:p-7">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-4 w-4 text-phosters-400" aria-hidden="true" />
          <span className="font-mono text-slate-300">STUDENT ENGAGEMENT FILTER:</span>
          <span className="font-semibold text-phosters-300">
            {beatIndex === 0 && 'All Registered Students'}
            {beatIndex === 1 && 'Expanded Progress & Scores'}
            {beatIndex === 2 && 'Selected Inactive & Not Started (2)'}
            {beatIndex === 3 && 'Study Reminder Pushed'}
          </span>
        </div>
        <div className="font-mono text-xs text-slate-400 tabular-nums">
          CSV Export · Formula-Safe
        </div>
      </div>

      {/* Table preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden my-auto">
        <div className="divide-y divide-slate-800">
          {rows.map((r, idx) => (
            <div
              key={`${r.name}-${beatIndex}`}
              className={[
                'px-4 py-2.5 flex items-center justify-between gap-3 text-xs transition-colors duration-300',
                r.selected ? 'bg-phosters-900/35' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={[
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0',
                    r.selected
                      ? 'border-phosters-400 bg-phosters-600 text-white'
                      : 'border-slate-700 bg-slate-950',
                  ].join(' ')}
                >
                  {r.selected && <Check className="h-3 w-3" aria-hidden="true" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{r.name}</div>
                  <div className="text-[11px] text-slate-400">{r.exam}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 tabular-nums">
                <span
                  className={
                    r.status.includes('In progress') ? 'text-phosters-300' : 'text-amber-300'
                  }
                >
                  {r.status}
                </span>
                <span className="font-mono text-slate-200 w-9 text-right">{r.pct}</span>
              </div>

              {idx === 0 && beatIndex === 1 && (
                <div className="hidden md:block text-[11px] font-mono text-phosters-300 mg-anim-pop">
                  Last CBT: 75% · 4 lessons done
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action footer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div
          className={[
            'rounded-lg border px-3 py-2 flex items-center gap-2.5 text-xs transition-all duration-300',
            beatIndex === 2
              ? 'border-phosters-400 bg-phosters-900/40 text-white mg-anim-pop'
              : 'border-slate-800 bg-slate-900/60 text-slate-300',
          ].join(' ')}
        >
          <Mail className="h-4 w-4 text-phosters-400 shrink-0" aria-hidden="true" />
          <span>Pre-filled follow-up email drafts generated per segment.</span>
        </div>
        <div
          className={[
            'rounded-lg border px-3 py-2 flex items-center gap-2.5 text-xs transition-all duration-300',
            beatIndex === 3
              ? 'border-phosters-400 bg-phosters-900/40 text-white mg-anim-pop'
              : 'border-slate-800 bg-slate-900/60 text-slate-300',
          ].join(' ')}
        >
          <Send className="h-4 w-4 text-phosters-400 shrink-0" aria-hidden="true" />
          <span>One-click study nudges sent to subscribed devices.</span>
        </div>
      </div>
    </div>
  );
}

function BroadcastsScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  return (
    <div className="relative grid h-full grid-cols-1 sm:grid-cols-12 gap-4 p-5 sm:p-7 items-center">
      {/* Left: Broadcast Composer */}
      <div className="sm:col-span-7 space-y-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">ANNOUNCEMENTS &amp; PUSH</span>
          <span className="inline-flex items-center gap-1 text-phosters-300 font-medium">
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{beatIndex >= 1 ? 'Pinned Top' : 'Standard'}</span>
          </span>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/75 p-3 space-y-1.5">
          <div className="text-[11px] font-mono text-phosters-300">
            AUDIENCE · {beatIndex === 0 ? 'ALL / EXAM / SUBJECT' : 'JAMB UTME · CHEMISTRY'}
          </div>
          <div className="text-sm font-bold text-white">
            Weekend Live Revision &amp; Practice CBT
          </div>
          <p className="text-xs text-slate-400">
            Complete Redox Topic 1 and attempt the timed 10-question mock quiz before Sunday.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-300">
            Auth: <strong className="text-phosters-300">Admin Session + VAPID</strong>
          </span>
          <span className="text-slate-400 font-mono">No Service Role Key needed</span>
        </div>
      </div>

      {/* Right: Mobile Lock-screen Push Arrival */}
      <div className="sm:col-span-5 flex flex-col justify-center">
        <div
          key={`push-${beatIndex}`}
          className={[
            'rounded-2xl border p-4 space-y-2.5 transition-all duration-300',
            beatIndex >= 3
              ? 'border-phosters-400 bg-slate-900 shadow-xl shadow-phosters-950/60 mg-anim-slide-right'
              : 'border-slate-800 bg-slate-900/60',
          ].join(' ')}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-phosters-300">
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PHOSTERS · NOW</span>
            </span>
            <span className="font-mono">WEB PUSH</span>
          </div>
          <div className="text-sm font-bold text-white">
            {beatIndex >= 3
              ? 'Weekend Live Revision & Practice CBT'
              : 'Ready to deliver to enrolled phones'}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {beatIndex >= 3
              ? 'Delivered even while the student browser is closed. Tapping opens /app directly.'
              : 'Generate VAPID keys once in Admin Announcements, then test directly on your own phone.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistScene({ beatIndex }: { beatIndex: 0 | 1 | 2 | 3 }) {
  const rules = [
    {
      title: 'Publish Topic + Lesson + Test together',
      desc: 'Unpublished parent Topics keep published lessons invisible to students.',
    },
    {
      title: 'Keep GitHub materials repository public-only',
      desc: 'Store public handouts only — never student emails, personal notes, or API secrets.',
    },
    {
      title: 'Verify CBT keys & explanations before launch',
      desc: 'Check every marked option and explanation so automatic grading teaches clearly.',
    },
    {
      title: 'Run weekly Student Analytics follow-ups',
      desc: 'Filter inactive 7d students and send encouraging reminders or live class alerts.',
    },
  ];

  return (
    <div className="relative flex h-full flex-col justify-center gap-3 p-5 sm:p-7">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-mono text-phosters-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>TUTOR OPERATIONAL STANDARDS</span>
        </span>
        <span className="tabular-nums font-mono">RULE {beatIndex + 1} OF 4</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rules.map((rule, idx) => {
          const active = idx === beatIndex;
          const done = idx <= beatIndex;
          return (
            <div
              key={`${rule.title}-${beatIndex}`}
              className={[
                'rounded-xl border p-3.5 transition-all duration-300',
                active
                  ? 'border-phosters-400 bg-phosters-900/45 text-white mg-anim-pop'
                  : done
                    ? 'border-slate-700 bg-slate-900/90 text-slate-200'
                    : 'border-slate-800/80 bg-slate-900/40 text-slate-500',
              ].join(' ')}
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2
                  className={[
                    'h-4 w-4 mt-0.5 shrink-0',
                    done ? 'text-phosters-400' : 'text-slate-600',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-bold">{rule.title}</div>
                  <p className="text-[11px] sm:text-xs leading-relaxed text-slate-400">
                    {rule.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TutorMotionStage({
  chapter,
  beatIndex,
  isPlaying,
  progressPercent,
  sceneInstanceKey,
}: TutorMotionStageProps) {
  const currentBeat = chapter.beats[beatIndex];
  const clampedPct = Math.max(0, Math.min(100, progressPercent));

  return (
    <div
      className={[
        'rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden shadow-sm',
        isPlaying ? '' : 'mg-paused',
      ].join(' ')}
    >
      {/* Top Studio Header Strip */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/90 bg-slate-900/80 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-semibold text-phosters-300 tabular-nums shrink-0">
            CH {chapter.number}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span className="font-semibold text-white truncate">{chapter.title}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
          <span>BEAT {beatIndex + 1}/4</span>
          <span aria-hidden="true">·</span>
          <span>{isPlaying ? 'PLAYING' : 'PAUSED'}</span>
        </div>
      </div>

      {/* Main 16:9 Motion Stage */}
      <div key={sceneInstanceKey} className="relative min-h-[340px] sm:aspect-video w-full overflow-hidden">
        <StageGridBackdrop />
        {chapter.id === 'overview' && <OverviewScene beatIndex={beatIndex} />}
        {chapter.id === 'taxonomy' && <TaxonomyScene beatIndex={beatIndex} />}
        {chapter.id === 'lessons' && <LessonsScene beatIndex={beatIndex} />}
        {chapter.id === 'cbt' && <CbtScene beatIndex={beatIndex} />}
        {chapter.id === 'students' && <StudentsScene beatIndex={beatIndex} />}
        {chapter.id === 'broadcasts' && <BroadcastsScene beatIndex={beatIndex} />}
        {chapter.id === 'checklist' && <ChecklistScene beatIndex={beatIndex} />}
      </div>

      {/* SVG Scrubber Progress Track + Synchronized Caption Bar */}
      <div className="border-t border-slate-800/90 bg-slate-900/95">
        <svg
          aria-hidden="true"
          viewBox="0 0 1000 6"
          preserveAspectRatio="none"
          className="block h-1.5 w-full bg-slate-800"
        >
          <rect x="0" y="0" width={clampedPct * 10} height="6" fill="#238e5f" />
        </svg>

        <div className="px-4 py-3 sm:px-5 sm:py-3.5 space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-phosters-300">{currentBeat.title}</span>
            <span className="font-mono text-slate-400 tabular-nums">
              {chapter.durationSec}s module
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {currentBeat.caption}
          </p>
        </div>
      </div>
    </div>
  );
}
