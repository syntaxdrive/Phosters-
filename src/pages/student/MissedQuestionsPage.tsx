import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  RotateCcw,
  Target,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMasteredMissedKeys,
  loadStudentMissedQuestions,
  saveMasteredMissedKeys,
  type MissedQuestionItem,
} from '../../services/missedQuestionsService';
import { JambCalculator } from '../../components/cbt/JambCalculator';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

type DrillFilter = 'unmastered' | 'all';

export function MissedQuestionsPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<MissedQuestionItem[]>([]);
  const [masteredKeys, setMasteredKeys] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<DrillFilter>('unmastered');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [fromOfflineOnly, setFromOfflineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMissed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [res, mastered] = await Promise.all([
      loadStudentMissedQuestions(user.id),
      Promise.resolve(getMasteredMissedKeys(user.id)),
    ]);
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setItems(res.items);
    setMasteredKeys(mastered);
    setFromOfflineOnly(res.fromOfflineOnly);
    setActiveIndex(0);
    setSelectedKey(null);
    setChecked(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadMissed();
  }, [loadMissed]);

  const subjectOptions = useMemo(() => {
    const names = Array.from(new Set(items.map((i) => i.subjectName))).sort((a, b) =>
      a.localeCompare(b)
    );
    return names;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (subjectFilter !== 'all' && item.subjectName !== subjectFilter) return false;
      if (filterMode === 'unmastered' && masteredKeys.has(item.dedupeKey)) return false;
      return true;
    });
  }, [filterMode, items, masteredKeys, subjectFilter]);

  const safeIndex = Math.min(activeIndex, Math.max(0, filteredItems.length - 1));
  const currentItem = filteredItems[safeIndex] ?? null;

  const goPrevious = useCallback(() => {
    if (safeIndex > 0) {
      setActiveIndex(safeIndex - 1);
      setSelectedKey(null);
      setChecked(false);
    }
  }, [safeIndex]);

  const goNext = useCallback(() => {
    if (safeIndex < filteredItems.length - 1) {
      setActiveIndex(safeIndex + 1);
      setSelectedKey(null);
      setChecked(false);
    }
  }, [filteredItems.length, safeIndex]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentItem || !selectedKey || !user) return;
    setChecked(true);

    const isNowCorrect =
      selectedKey.toUpperCase() === currentItem.correctKey.toUpperCase();
    if (isNowCorrect && !masteredKeys.has(currentItem.dedupeKey)) {
      const next = new Set(masteredKeys);
      next.add(currentItem.dedupeKey);
      setMasteredKeys(next);
      saveMasteredMissedKeys(user.id, next);
    }
  }, [currentItem, masteredKeys, selectedKey, user]);

  function handleResetMastered() {
    if (!user) return;
    const empty = new Set<string>();
    setMasteredKeys(empty);
    saveMasteredMissedKeys(user.id, empty);
    setFilterMode('unmastered');
    setActiveIndex(0);
    setSelectedKey(null);
    setChecked(false);
  }

  // CBT keyboard shortcuts: A-E select, Enter check, N/ArrowRight next, P/ArrowLeft previous
  useEffect(() => {
    if (!currentItem) return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const upper = e.key.toUpperCase();
      if (!checked && ['A', 'B', 'C', 'D', 'E'].includes(upper)) {
        const matched = currentItem.options.find((o) => o.key.toUpperCase() === upper);
        if (matched) {
          setSelectedKey(matched.key);
        }
      } else if (e.key === 'Enter' && !checked && selectedKey) {
        e.preventDefault();
        handleCheckAnswer();
      } else if (e.key === 'ArrowRight' || upper === 'N') {
        goNext();
      } else if (e.key === 'ArrowLeft' || upper === 'P') {
        goPrevious();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [checked, currentItem, goNext, goPrevious, handleCheckAnswer, selectedKey]);

  if (loading) {
    return <LoadingState message="Gathering your missed questions..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadMissed()} />;
  }

  const masteredCount = items.filter((i) => masteredKeys.has(i.dedupeKey)).length;
  const remainingCount = Math.max(0, items.length - masteredCount);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/results"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Results</span>
        </Link>

        <Button
          type="button"
          variant={calculatorOpen ? 'primary' : 'secondary'}
          onClick={() => setCalculatorOpen((v) => !v)}
        >
          <Calculator className="h-4 w-4" aria-hidden="true" />
          <span>{calculatorOpen ? 'Hide Calculator' : 'JAMB Calculator'}</span>
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Practice My Missed Questions
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Drill the exact questions you missed in previous practice tests and 4-subject mocks until you master them.
        </p>
      </div>

      {fromOfflineOnly && (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Working offline using test and mock reviews already cached on this device (0 MB mobile data used).
            </span>
          </span>
        </Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="No missed questions to drill yet"
          description="Once you submit a topic test or 4-subject mock exam and miss any question, it appears here automatically so you can turn weak areas into strengths."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/app/mocks"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
              >
                Open Mock Center
              </Link>
              <Link
                to="/app/subjects"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Browse Subjects
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {/* Summary + Filters */}
          <Card padding="md" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Missed</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {items.length}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Still to Drill</p>
                <p className="mt-0.5 text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {remainingCount}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Mastered</p>
                <p className="mt-0.5 text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {masteredCount}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 self-start">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('unmastered');
                    setActiveIndex(0);
                    setSelectedKey(null);
                    setChecked(false);
                  }}
                  className={[
                    'min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    filterMode === 'unmastered'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                  ].join(' ')}
                >
                  Needs Drill ({remainingCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all');
                    setActiveIndex(0);
                    setSelectedKey(null);
                    setChecked(false);
                  }}
                  className={[
                    'min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0',
                    filterMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                  ].join(' ')}
                >
                  All Missed ({items.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {subjectOptions.length > 1 && (
                  <select
                    aria-label="Filter by subject"
                    value={subjectFilter}
                    onChange={(e) => {
                      setSubjectFilter(e.target.value);
                      setActiveIndex(0);
                      setSelectedKey(null);
                      setChecked(false);
                    }}
                    className="min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">All Subjects</option>
                    {subjectOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                )}

                {masteredCount > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleResetMastered}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Reset Mastered</span>
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {!currentItem ? (
            <Card padding="lg" className="text-center space-y-3">
              <div className="h-11 w-11 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <Target className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                All missed questions mastered in this filter
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Switch to All Missed to review again, or reset mastered markers before your next timed mock.
              </p>
              <div className="flex justify-center gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={() => setFilterMode('all')}>
                  View All Missed
                </Button>
                <Button type="button" onClick={handleResetMastered}>
                  Drill Again From Start
                </Button>
              </div>
            </Card>
          ) : (
            <Card padding="lg" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-phosters-700 dark:text-phosters-400">
                    {currentItem.subjectName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{currentItem.sourceTitle}</span>
                </div>
                <span className="font-semibold tabular-nums">
                  Question {safeIndex + 1} of {filteredItems.length}
                </span>
              </div>

              <p className="text-base sm:text-[17px] font-semibold text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line">
                {currentItem.questionText}
              </p>

              <div
                role="radiogroup"
                aria-label={`Drill question ${safeIndex + 1}`}
                className="space-y-2.5"
              >
                {currentItem.options.map((opt) => {
                  const isSelected = selectedKey === opt.key;
                  const showCorrect = checked && opt.isCorrect;
                  const showWrong = checked && isSelected && !opt.isCorrect;

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={checked}
                      onClick={() => setSelectedKey(opt.key)}
                      className={[
                        'w-full flex items-center justify-between gap-3 min-h-[52px] px-4 py-3 rounded-xl border text-left transition-colors',
                        checked ? 'cursor-default' : 'cursor-pointer',
                        showCorrect
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-slate-900 dark:text-slate-100'
                          : showWrong
                            ? 'border-red-400 bg-red-50 dark:bg-red-950/50 text-slate-900 dark:text-slate-100'
                            : isSelected
                              ? 'border-phosters-600 bg-phosters-50 dark:bg-phosters-900/40 text-slate-900 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={[
                            'inline-flex items-center justify-center h-7 w-7 rounded-md font-mono text-xs font-bold shrink-0',
                            showCorrect
                              ? 'bg-emerald-600 text-white'
                              : showWrong
                                ? 'bg-red-600 text-white'
                                : isSelected
                                  ? 'bg-phosters-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
                          ].join(' ')}
                        >
                          {opt.key}
                        </span>
                        <span className="text-sm sm:text-base leading-snug pt-0.5">
                          {opt.text}
                        </span>
                      </div>
                      {showCorrect && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      )}
                      {showWrong && (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>

              {checked && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {selectedKey?.toUpperCase() === currentItem.correctKey.toUpperCase() ? (
                    <Alert tone="success" title="Correct — marked as mastered">
                      You selected {currentItem.correctKey}, the right answer.
                    </Alert>
                  ) : (
                    <Alert tone="warning" title={`Correct answer is ${currentItem.correctKey}`}>
                      {currentItem.lastWrongAnswerText
                        ? `Earlier attempt selected: ${currentItem.lastWrongAnswerText}`
                        : 'Review the solution below and try again next pass.'}
                    </Alert>
                  )}

                  {currentItem.explanation && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-1">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Worked Explanation
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                        {currentItem.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={safeIndex === 0}
                  onClick={goPrevious}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Previous</span>
                </Button>

                <p className="hidden sm:block text-xs text-slate-400 dark:text-slate-500">
                  Keys: A–D select · Enter check · N / P navigate
                </p>

                <div className="flex items-center gap-2">
                  {!checked ? (
                    <Button
                      type="button"
                      disabled={!selectedKey}
                      onClick={handleCheckAnswer}
                    >
                      Check Answer
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={safeIndex >= filteredItems.length - 1}
                      onClick={goNext}
                    >
                      <span>Next Missed</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <JambCalculator
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />
    </div>
  );
}
