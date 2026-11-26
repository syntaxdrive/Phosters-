import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, GraduationCap, Search, SlidersHorizontal } from 'lucide-react';
import {
  COURSE_COMBO_GUIDE,
  computeUiAggregate,
  requiredPostUtmeForTarget,
  type CourseFaculty,
} from '../../data/admissionGuide';
import { Card } from '../../components/ui/Card';

const FACULTIES: Array<'All' | CourseFaculty> = [
  'All',
  'College of Medicine',
  'Science & Computing',
  'Technology & Engineering',
  'Law & Arts',
  'Social & Management',
  'Agriculture & Environmental',
  'Education',
];

export function AdmissionGuidePage() {
  const [jambScoreInput, setJambScoreInput] = useState('260');
  const [postUtmeScoreInput, setPostUtmeScoreInput] = useState('65');
  const [targetAggregateInput, setTargetAggregateInput] = useState('68');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<'All' | CourseFaculty>('All');

  const jambScore = Number.parseFloat(jambScoreInput) || 0;
  const postUtmeScore = Number.parseFloat(postUtmeScoreInput) || 0;
  const targetAggregate = Math.min(100, Math.max(0, Number.parseFloat(targetAggregateInput) || 0));

  const aggregate = useMemo(
    () => computeUiAggregate(jambScore, postUtmeScore),
    [jambScore, postUtmeScore]
  );

  const targetEstimate = useMemo(
    () => requiredPostUtmeForTarget(jambScore, targetAggregate),
    [jambScore, targetAggregate]
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return COURSE_COMBO_GUIDE.filter((entry) => {
      if (selectedFaculty !== 'All' && entry.faculty !== selectedFaculty) return false;
      if (!q) return true;
      return (
        entry.course.toLowerCase().includes(q) ||
        entry.faculty.toLowerCase().includes(q) ||
        entry.jambSubjects.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, selectedFaculty]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>

        <Link
          to="/app/setup-exams"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <span>Update My 4 Subjects</span>
        </Link>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          UI Aggregate Calculator &amp; JAMB Subject Guide
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Check the exact JAMB UTME subject combination for your intended course and calculate your University of Ibadan (UI) admission aggregate offline at any time.
        </p>
      </div>

      {/* Section 1: UI Post-UTME Aggregate Calculator */}
      <section aria-labelledby="ui-aggregate-heading">
        <Card padding="lg" className="space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-phosters-50 dark:bg-phosters-900/50 border border-phosters-200 dark:border-phosters-800 flex items-center justify-center text-phosters-700 dark:text-phosters-400 shrink-0">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="ui-aggregate-heading" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                UI Post-UTME Aggregate Calculator
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Formula: <span className="font-mono font-semibold">(JAMB ÷ 8) + (Post-UTME ÷ 2) = Aggregate %</span> (50% JAMB + 50% Post-UTME)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="ui-jamb-score"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  JAMB UTME Score (0–400)
                </label>
                <input
                  id="ui-jamb-score"
                  type="number"
                  min={0}
                  max={400}
                  inputMode="numeric"
                  value={jambScoreInput}
                  onChange={(e) => setJambScoreInput(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  JAMB points: {aggregate.jambPart.toFixed(2)} / 50.00
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="ui-postutme-score"
                  className="block text-sm font-semibold text-slate-800 dark:text-slate-200"
                >
                  UI Post-UTME Score (0–100)
                </label>
                <input
                  id="ui-postutme-score"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={postUtmeScoreInput}
                  onChange={(e) => setPostUtmeScoreInput(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  Post-UTME points: {aggregate.postUtmePart.toFixed(2)} / 50.00
                </p>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="ui-target-aggregate"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Target Course Cut-off (%):
                  </label>
                  <input
                    id="ui-target-aggregate"
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    value={targetAggregateInput}
                    onChange={(e) => setTargetAggregateInput(e.target.value)}
                    className="w-24 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums text-right"
                  />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  {targetEstimate.achievable ? (
                    <>
                      With <strong className="font-semibold">{Math.min(400, Math.max(0, jambScore))}</strong> in JAMB, you need at least{' '}
                      <strong className="font-bold text-phosters-700 dark:text-phosters-400">
                        {targetEstimate.neededPostUtme}/100
                      </strong>{' '}
                      in UI Post-UTME to reach <strong className="font-semibold">{targetAggregate}%</strong>.
                    </>
                  ) : (
                    <>
                      Even 100/100 in Post-UTME gives{' '}
                      <strong className="font-semibold">
                        {(Math.min(400, Math.max(0, jambScore)) / 8 + 50).toFixed(2)}%
                      </strong>{' '}
                      with this JAMB score. Aim higher in JAMB mock drills first.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-xl border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-phosters-700 dark:text-phosters-400">
                  Your Estimated UI Aggregate
                </p>
                <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 tabular-nums">
                  {aggregate.totalAggregate.toFixed(2)}%
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 border-t border-phosters-200/70 dark:border-phosters-800/70 pt-3">
                <p className="tabular-nums">
                  JAMB share: <strong className="font-semibold">{aggregate.jambPart.toFixed(2)}%</strong>
                </p>
                <p className="tabular-nums">
                  Post-UTME share: <strong className="font-semibold">{aggregate.postUtmePart.toFixed(2)}%</strong>
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  Note: UI Post-UTME strictly scores 50% minimum (25/50) eligibility before departmental cut-offs apply.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Section 2: Course & JAMB Subject Combinations */}
      <section aria-labelledby="combo-guide-heading" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="combo-guide-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">
              JAMB &amp; UI Subject Combination Guide
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Avoid losing admission over a wrong 4th subject. Check your exact JAMB subjects and O-Level rules.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            Showing {filteredCourses.length} of {COURSE_COMBO_GUIDE.length} courses
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search course or subject (e.g. Medicine, Law, Computer Science, Economics)..."
              aria-label="Search course or subject combination"
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {FACULTIES.map((fac) => {
              const active = selectedFaculty === fac;
              return (
                <button
                  key={fac}
                  type="button"
                  onClick={() => setSelectedFaculty(fac)}
                  className={[
                    'min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors border',
                    active
                      ? 'bg-phosters-600 text-white border-phosters-600'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  {fac}
                </button>
              );
            })}
          </div>
        </div>

        {filteredCourses.length === 0 ? (
          <Card padding="lg" className="text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No matching courses found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clear your search filter or check another faculty tab.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCourses.map((entry) => (
              <Card key={entry.id} padding="md" className="flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-medium text-phosters-700 dark:text-phosters-400">
                        {entry.faculty}
                      </p>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {entry.course}
                      </h3>
                    </div>
                    <GraduationCap
                      className="h-4 w-4 text-slate-400 shrink-0 mt-1"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      4 JAMB UTME Subjects:
                    </p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {entry.jambSubjects.join(' · ')}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <p>
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">O&apos;Level:</strong>{' '}
                      {entry.oLevelNotes}
                    </p>
                    <p className="tabular-nums">
                      <strong className="font-semibold text-slate-800 dark:text-slate-200">Typical UI Merit Range:</strong>{' '}
                      {entry.uiCutOffGuide}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">{entry.advice}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <Link
                    to={`/app/setup-exams?subjects=${encodeURIComponent(entry.subjectSlugs.join(','))}&course=${encodeURIComponent(entry.course)}`}
                    className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline py-1"
                  >
                    Use this subject combo in my profile →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
