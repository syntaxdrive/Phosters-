import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Filter,
  Plus,
  Square,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAdminLessonsList } from '../../services/adminService';
import {
  bulkApproveBankQuestions,
  deleteBankQuestion,
  fetchQuestionBankItems,
  saveParsedQuestionsToBank,
  updateBankQuestionStatus,
} from '../../services/questionBankService';
import type { Exam, Subject, Topic } from '../../types/database';
import type {
  ParsedBankQuestionDraft,
  QuestionBankItem,
  QuestionBankStatus,
  QuestionDifficulty,
} from '../../types/questionBank';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function localKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyBankQuestion(defaultYear: number | null): ParsedBankQuestionDraft {
  return {
    localKey: localKey(),
    questionText: '',
    explanation: '',
    examYear: defaultYear,
    sectionLabel: '',
    difficulty: 'medium',
    points: 1,
    needsDiagram: false,
    hasKeyIssue: false,
    include: true,
    options: OPTION_KEYS.map((key, idx) => ({
      localKey: localKey(),
      optionKey: key,
      optionText: '',
      isCorrect: idx === 0,
    })),
  };
}

export function AdminQuestionBankPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');

  // Shared taxonomy data
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  // Target metadata for manual entry
  const [targetExamId, setTargetExamId] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetTopicId, setTargetTopicId] = useState('');
  const [defaultYearInput, setDefaultYearInput] = useState('');
  const [sourceReference, setSourceReference] = useState('Manual Entry');

  const [draftQueue, setDraftQueue] = useState<ParsedBankQuestionDraft[]>(() => [
    createEmptyBankQuestion(null),
  ]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

  // Bank library tab state
  const [libraryItems, setLibraryItems] = useState<QuestionBankItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [filterExamId, setFilterExamId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterYearInput, setFilterYearInput] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<QuestionDifficulty | ''>('');
  const [filterStatus, setFilterStatus] = useState<QuestionBankStatus | ''>('');
  const [filterDiagram, setFilterDiagram] = useState<'all' | 'text_only' | 'needs_diagram'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const [libraryBusyId, setLibraryBusyId] = useState<string | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);

  const loadTaxonomy = useCallback(async () => {
    setTaxonomyLoading(true);
    setTaxonomyError(null);
    const res = await fetchAdminLessonsList();
    if (res.error) {
      setTaxonomyError(res.error);
      setTaxonomyLoading(false);
      return;
    }
    setExams(res.exams);
    setSubjects(res.subjects);
    setTopics(res.topics);
    setTargetExamId((prev) => prev || res.exams[0]?.id || '');
    setTargetSubjectId((prev) => prev || res.subjects[0]?.id || '');
    setTaxonomyLoading(false);
  }, []);

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    const parsedYear = Number(filterYearInput.trim());
    const validYear =
      Number.isFinite(parsedYear) && parsedYear >= 1978 && parsedYear <= 2035
        ? parsedYear
        : undefined;

    const res = await fetchQuestionBankItems({
      examId: filterExamId || undefined,
      subjectId: filterSubjectId || undefined,
      examYear: validYear,
      difficulty: filterDifficulty,
      status: filterStatus,
      diagramFilter: filterDiagram,
      search: searchQuery,
      limit: 200,
    });

    if (res.migrationMissing) {
      setMigrationMissing(true);
    }
    if (res.error) {
      setLibraryError(res.error);
      setLibraryLoading(false);
      return;
    }

    setLibraryItems(res.items);
    setSelectedBankIds(new Set());
    setLibraryLoading(false);
  }, [
    filterExamId,
    filterSubjectId,
    filterYearInput,
    filterDifficulty,
    filterStatus,
    filterDiagram,
    searchQuery,
  ]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    if (activeTab === 'library') {
      void loadLibrary();
    }
  }, [activeTab, loadLibrary]);

  const matchingTopics = useMemo(
    () => topics.filter((t) => t.exam_id === targetExamId && t.subject_id === targetSubjectId),
    [topics, targetExamId, targetSubjectId]
  );

  const examNameById = useMemo(
    () => new Map(exams.map((ex) => [ex.id, ex.name])),
    [exams]
  );
  const subjectNameById = useMemo(
    () => new Map(subjects.map((sub) => [sub.id, sub.name])),
    [subjects]
  );

  const parsedDefaultYear = useMemo(() => {
    const parsed = Number(defaultYearInput.trim());
    return Number.isFinite(parsed) && parsed >= 1978 && parsed <= 2035 ? parsed : null;
  }, [defaultYearInput]);

  const includedCount = useMemo(
    () => draftQueue.filter((q) => q.include).length,
    [draftQueue]
  );

  function addDraftQuestion() {
    setDraftQueue((prev) => [...prev, createEmptyBankQuestion(parsedDefaultYear)]);
  }

  function removeDraftQuestion(qKey: string) {
    setDraftQueue((prev) => {
      if (prev.length <= 1) return [createEmptyBankQuestion(parsedDefaultYear)];
      return prev.filter((q) => q.localKey !== qKey);
    });
  }

  function updateDraftQuestion(qKey: string, patch: Partial<ParsedBankQuestionDraft>) {
    setDraftQueue((prev) =>
      prev.map((q) => (q.localKey === qKey ? { ...q, ...patch } : q))
    );
  }

  function updateDraftOption(qKey: string, optKey: string, optionText: string) {
    setDraftQueue((prev) =>
      prev.map((q) => {
        if (q.localKey !== qKey) return q;
        return {
          ...q,
          options: q.options.map((o) => (o.localKey === optKey ? { ...o, optionText } : o)),
        };
      })
    );
  }

  function setDraftCorrectOption(qKey: string, optKey: string) {
    setDraftQueue((prev) =>
      prev.map((q) => {
        if (q.localKey !== qKey) return q;
        return {
          ...q,
          hasKeyIssue: false,
          options: q.options.map((o) => ({ ...o, isCorrect: o.localKey === optKey })),
        };
      })
    );
  }

  async function handleSaveBatch(targetStatus: QuestionBankStatus) {
    if (!user) return;
    setCreateError(null);
    setCreateNotice(null);
    setSavingBatch(true);

    const totalChars = draftQueue.reduce(
      (sum, q) =>
        sum +
        q.questionText.length +
        q.options.reduce((oSum, o) => oSum + o.optionText.length, 0),
      0
    );

    const res = await saveParsedQuestionsToBank({
      fileName: sourceReference.trim() || 'Manual Entry',
      sourceFormat: 'paste',
      rawCharCount: totalChars,
      examId: targetExamId || null,
      subjectId: targetSubjectId || null,
      topicId: targetTopicId || null,
      defaultYear: parsedDefaultYear,
      targetStatus,
      userId: user.id,
      questions: draftQueue,
    });

    setSavingBatch(false);
    if (res.migrationMissing) {
      setMigrationMissing(true);
    }
    if (res.error) {
      setCreateError(res.error);
      return;
    }

    const remaining = draftQueue.filter((q) => !q.include);
    setDraftQueue(
      remaining.length > 0 ? remaining : [createEmptyBankQuestion(parsedDefaultYear)]
    );
    setCreateNotice(
      `Saved ${res.insertedCount} ${targetStatus === 'approved' ? 'approved' : 'draft'} question${res.insertedCount === 1 ? '' : 's'} to the Question Bank.`
    );
  }

  async function handleToggleLibraryStatus(item: QuestionBankItem) {
    setLibraryBusyId(item.id);
    setLibraryError(null);
    const nextStatus: QuestionBankStatus = item.status === 'approved' ? 'draft' : 'approved';
    const res = await updateBankQuestionStatus(item.id, nextStatus);
    setLibraryBusyId(null);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: nextStatus } : q))
    );
  }

  async function handleDeleteLibraryItem(id: string) {
    setLibraryBusyId(id);
    setLibraryError(null);
    const res = await deleteBankQuestion(id);
    setLibraryBusyId(null);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) => prev.filter((q) => q.id !== id));
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleBulkApproveSelected() {
    const ids = Array.from(selectedBankIds);
    if (ids.length === 0) return;
    setBulkApproving(true);
    setLibraryError(null);
    const res = await bulkApproveBankQuestions(ids);
    setBulkApproving(false);
    if (res.error) {
      setLibraryError(res.error);
      return;
    }
    setLibraryItems((prev) =>
      prev.map((q) => (selectedBankIds.has(q.id) ? { ...q, status: 'approved' } : q))
    );
    setLibraryNotice(`Approved ${ids.length} selected questions for Tutor CBT & Mock builders.`);
    setSelectedBankIds(new Set());
  }

  if (taxonomyLoading) {
    return <LoadingState message="Loading examinations and subjects..." />;
  }

  if (taxonomyError) {
    return <ErrorState message={taxonomyError} onRetry={() => void loadTaxonomy()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Super Admin Question Bank
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manually add, organize, and approve past or practice questions for Tutors and Mock Exams.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={[
              'min-h-[40px] px-4 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap',
              activeTab === 'create'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
            ].join(' ')}
          >
            Add Questions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={[
              'min-h-[40px] px-4 py-1.5 rounded-md text-sm font-semibold cursor-pointer transition-colors whitespace-nowrap',
              activeTab === 'library'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
            ].join(' ')}
          >
            Bank Library
          </button>
        </div>
      </div>

      <AdminNav />

      {migrationMissing && (
        <Alert tone="warning" title="One-time database migration required">
          Run{' '}
          <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
            supabase/migrations/011_question_bank_schema.sql
          </code>{' '}
          in your Supabase SQL Editor to create{' '}
          <code className="font-mono text-xs">question_bank</code>,{' '}
          <code className="font-mono text-xs">question_bank_options</code>, and{' '}
          <code className="font-mono text-xs">question_bank_batches</code>.
        </Alert>
      )}

      {activeTab === 'create' ? (
        <div className="space-y-6">
          {createError && <Alert tone="error">{createError}</Alert>}
          {createNotice && <Alert tone="success">{createNotice}</Alert>}

          {/* Step 1: Target Exam / Subject / Topic */}
          <Card padding="lg" className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              1. Target classification
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Examination
                </label>
                <select
                  value={targetExamId}
                  onChange={(e) => {
                    setTargetExamId(e.target.value);
                    setTargetTopicId('');
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Any / Shared Exam</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Subject
                </label>
                <select
                  value={targetSubjectId}
                  onChange={(e) => {
                    setTargetSubjectId(e.target.value);
                    setTargetTopicId('');
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Select subject...</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Topic (optional)
                </label>
                <select
                  value={targetTopicId}
                  onChange={(e) => setTargetTopicId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">All / Subject-wide</option>
                  {matchingTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Exam Year (optional)
                </label>
                <input
                  type="number"
                  min={1978}
                  max={2035}
                  placeholder="e.g. 2022"
                  value={defaultYearInput}
                  onChange={(e) => setDefaultYearInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Source Label (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. JAMB 2022 Pack"
                  value={sourceReference}
                  onChange={(e) => setSourceReference(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </Card>

          {/* Step 2: Manual Questions Builder */}
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  2. Compose questions ({draftQueue.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter question stems, A–D options, mark the correct option, and save to the Question Bank.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={addDraftQuestion}
                className="whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Another Question</span>
              </Button>
            </div>

            <div className="space-y-4">
              {draftQueue.map((q, qIdx) => (
                <div
                  key={q.localKey}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={q.include}
                        onChange={(e) =>
                          updateDraftQuestion(q.localKey, { include: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                      />
                      <span className="tabular-nums">Include Question #{qIdx + 1}</span>
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Difficulty for question ${qIdx + 1}`}
                        value={q.difficulty}
                        onChange={(e) =>
                          updateDraftQuestion(q.localKey, {
                            difficulty: e.target.value as QuestionDifficulty,
                          })
                        }
                        className="min-h-[36px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>

                      <input
                        type="number"
                        aria-label={`Exam year for question ${qIdx + 1}`}
                        min={1978}
                        max={2035}
                        placeholder="Year"
                        value={q.examYear ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          updateDraftQuestion(q.localKey, {
                            examYear: Number.isFinite(n) && n > 1900 ? n : null,
                          });
                        }}
                        className="w-24 min-h-[36px] rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                      />

                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer px-2">
                        <input
                          type="checkbox"
                          checked={q.needsDiagram}
                          onChange={(e) =>
                            updateDraftQuestion(q.localKey, { needsDiagram: e.target.checked })
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-phosters-600"
                        />
                        <span>Needs Diagram</span>
                      </label>

                      <button
                        type="button"
                        aria-label={`Remove draft question ${qIdx + 1}`}
                        onClick={() => removeDraftQuestion(q.localKey)}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={q.questionText}
                    onChange={(e) =>
                      updateDraftQuestion(q.localKey, { questionText: e.target.value })
                    }
                    placeholder="Enter question stem..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt) => (
                      <div key={opt.localKey} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`bank-correct-${q.localKey}`}
                          checked={opt.isCorrect}
                          onChange={() => setDraftCorrectOption(q.localKey, opt.localKey)}
                          aria-label={`Mark option ${opt.optionKey} as correct`}
                          className="h-4 w-4 text-phosters-600 focus:ring-phosters-600 shrink-0"
                        />
                        <span className="w-5 text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                          {opt.optionKey}.
                        </span>
                        <input
                          type="text"
                          value={opt.optionText}
                          onChange={(e) =>
                            updateDraftOption(q.localKey, opt.localKey, e.target.value)
                          }
                          placeholder={`Option ${opt.optionKey}`}
                          className="flex-1 min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Explanation (optional)
                    </label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        updateDraftQuestion(q.localKey, { explanation: e.target.value })
                      }
                      placeholder="Short explanation shown after test submission"
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                onClick={addDraftQuestion}
                className="whitespace-nowrap"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Another Question</span>
              </Button>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  loading={savingBatch}
                  disabled={includedCount === 0}
                  onClick={() => void handleSaveBatch('draft')}
                >
                  Save Selected as Draft ({includedCount})
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={savingBatch}
                  disabled={includedCount === 0}
                  onClick={() => void handleSaveBatch('approved')}
                >
                  Approve &amp; Publish to Question Bank ({includedCount})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-5">
          {libraryError && <Alert tone="error">{libraryError}</Alert>}
          {libraryNotice && <Alert tone="success">{libraryNotice}</Alert>}

          <Card padding="lg" className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Filter className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
              <span>Filter Question Bank</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <select
                aria-label="Filter by examination"
                value={filterExamId}
                onChange={(e) => setFilterExamId(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Examinations</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by subject"
                value={filterSubjectId}
                onChange={(e) => setFilterSubjectId(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by approval status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as QuestionBankStatus | '')}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved (Live for Tutors)</option>
                <option value="draft">Draft</option>
              </select>

              <select
                aria-label="Filter by difficulty"
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value as QuestionDifficulty | '')}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>

              <select
                aria-label="Filter diagram dependency"
                value={filterDiagram}
                onChange={(e) =>
                  setFilterDiagram(e.target.value as 'all' | 'text_only' | 'needs_diagram')
                }
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="all">Text &amp; Diagram Questions</option>
                <option value="text_only">Text-Only Questions</option>
                <option value="needs_diagram">Diagram-Flagged Only</option>
              </select>

              <input
                type="number"
                aria-label="Filter by exam year"
                placeholder="Year (e.g. 2018)"
                min={1978}
                max={2035}
                value={filterYearInput}
                onChange={(e) => setFilterYearInput(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              />

              <input
                type="search"
                aria-label="Search question text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:col-span-2 w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Showing {libraryItems.length} bank questions · {selectedBankIds.size} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (selectedBankIds.size === libraryItems.length && libraryItems.length > 0) {
                      setSelectedBankIds(new Set());
                    } else {
                      setSelectedBankIds(new Set(libraryItems.map((q) => q.id)));
                    }
                  }}
                >
                  {selectedBankIds.size === libraryItems.length && libraryItems.length > 0 ? (
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Square className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {selectedBankIds.size === libraryItems.length && libraryItems.length > 0
                      ? 'Clear Selection'
                      : 'Select All Visible'}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={bulkApproving}
                  disabled={selectedBankIds.size === 0}
                  onClick={() => void handleBulkApproveSelected()}
                >
                  Approve Selected ({selectedBankIds.size})
                </Button>
              </div>
            </div>
          </Card>

          {libraryLoading ? (
            <LoadingState message="Loading Question Bank items..." />
          ) : libraryItems.length === 0 ? (
            <EmptyState
              title="No bank questions match these filters"
              description="Add questions manually in the Add Questions tab or broaden your search filters."
              action={
                <Button type="button" variant="primary" onClick={() => setActiveTab('create')}>
                  Add Bank Questions
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {libraryItems.map((item) => {
                const isSelected = selectedBankIds.has(item.id);
                const isBusy = libraryBusyId === item.id;
                const examLabel = item.exam_id ? examNameById.get(item.exam_id) : null;
                const subjectLabel = item.subject_id ? subjectNameById.get(item.subject_id) : null;

                return (
                  <Card key={item.id} padding="lg" className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          aria-label="Select question"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedBankIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600 shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                            <span
                              className={
                                item.status === 'approved'
                                  ? 'font-semibold text-phosters-700 dark:text-phosters-400'
                                  : 'font-semibold text-amber-700 dark:text-amber-400'
                              }
                            >
                              {item.status === 'approved' ? 'Approved' : 'Draft'}
                            </span>
                            {examLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{examLabel}</span>
                              </>
                            )}
                            {subjectLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{subjectLabel}</span>
                              </>
                            )}
                            {item.exam_year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{item.exam_year}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{item.difficulty}</span>
                            {item.needs_diagram && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Needs Diagram
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                            {item.question_text}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="secondary"
                          loading={isBusy}
                          onClick={() => void handleToggleLibraryStatus(item)}
                        >
                          {item.status === 'approved' ? 'Move to Draft' : 'Approve'}
                        </Button>
                        <button
                          type="button"
                          aria-label="Delete bank question"
                          disabled={isBusy}
                          onClick={() => void handleDeleteLibraryItem(item.id)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6 text-xs">
                      {item.options.map((opt) => (
                        <div
                          key={opt.id}
                          className={
                            opt.is_correct
                              ? 'rounded-md border border-phosters-200 dark:border-phosters-800 bg-phosters-50/70 dark:bg-phosters-950/40 px-2.5 py-1.5 font-semibold text-phosters-900 dark:text-phosters-200'
                              : 'rounded-md border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-300'
                          }
                        >
                          <span className="font-mono mr-1.5">{opt.option_key}.</span>
                          <span>{opt.option_text}</span>
                        </div>
                      ))}
                    </div>

                    {item.explanation && (
                      <p className="pl-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Explanation: {item.explanation}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
