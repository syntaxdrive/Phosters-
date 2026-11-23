import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  deleteAdminMockExam,
  fetchAdminMockExamsData,
  fetchMockCustomQuestionsForAdmin,
  generateAiQuestionsForTutor,
  saveAdminMockExam,
} from '../../services/mockExamService';
import type {
  AdminMockCustomQuestionInput,
  AdminMockExamListItem,
} from '../../types/cbt';
import type { Exam, Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

const OPTION_KEYS = ['A', 'B', 'C', 'D'];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminMockExamsPage() {
  const { user } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mockExams, setMockExams] = useState<AdminMockExamListItem[]>([]);
  const [bankCounts, setBankCounts] = useState<Map<string, number>>(new Map());
  const [migrationMissing, setMigrationMissing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(
    null
  );

  // Editor state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [examId, setExamId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [englishCount, setEnglishCount] = useState(60);
  const [otherCount, setOtherCount] = useState(40);
  const [usesBank, setUsesBank] = useState(true);
  const [excludeDiagrams, setExcludeDiagrams] = useState(true);
  const [showExplanations, setShowExplanations] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<AdminMockCustomQuestionInput[]>([]);

  // AI Setter inside Mock Builder
  const [aiSubjectId, setAiSubjectId] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await fetchAdminMockExamsData();
    if (res.error) {
      setLoadError(res.error);
      setLoading(false);
      return;
    }

    setExams(res.exams);
    setSubjects(res.subjects);
    setMockExams(res.mockExams);
    setBankCounts(res.bankCountsBySubject);
    setMigrationMissing(res.migrationMissing);

    if (!examId && res.exams.length > 0) {
      const jamb = res.exams.find((e) => e.slug === 'jamb-utme') ?? res.exams[0];
      setExamId(jamb.id);
    }
    if (!aiSubjectId && res.subjects.length > 0) {
      setAiSubjectId(res.subjects[0].id);
    }

    setLoading(false);
  }, [aiSubjectId, examId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetEditor(targetExamId?: string) {
    const resolvedExam =
      exams.find((e) => e.id === (targetExamId || examId)) ?? exams[0];
    const isUi = resolvedExam?.slug === 'ui-post-utme';

    setEditingId(undefined);
    if (resolvedExam) setExamId(resolvedExam.id);
    setTitle('');
    setDescription('');
    setDurationMinutes(isUi ? 60 : 120);
    setEnglishCount(isUi ? 25 : 60);
    setOtherCount(isUi ? 25 : 40);
    setUsesBank(true);
    setExcludeDiagrams(true);
    setShowExplanations(true);
    setIsPublished(false);
    setCustomQuestions([]);
    setNotice(null);
  }

  function applyExamPreset(nextExamId: string) {
    setExamId(nextExamId);
    if (!editingId) {
      const ex = exams.find((e) => e.id === nextExamId);
      if (ex?.slug === 'ui-post-utme') {
        setDurationMinutes(60);
        setEnglishCount(25);
        setOtherCount(25);
      } else {
        setDurationMinutes(120);
        setEnglishCount(60);
        setOtherCount(40);
      }
    }
  }

  async function handleStartEdit(mock: AdminMockExamListItem) {
    setNotice(null);
    setEditingId(mock.id);
    setExamId(mock.exam_id);
    setTitle(mock.title);
    setDescription(mock.description ?? '');
    setDurationMinutes(mock.duration_minutes);
    setEnglishCount(mock.english_question_count);
    setOtherCount(mock.other_subject_question_count);
    setUsesBank(mock.uses_question_bank);
    setExcludeDiagrams(mock.exclude_diagrams);
    setShowExplanations(mock.show_explanations_after_submission);
    setIsPublished(mock.is_published);

    const qRes = await fetchMockCustomQuestionsForAdmin(mock.id);
    if (qRes.error) {
      setNotice({ tone: 'error', message: qRes.error });
    } else {
      setCustomQuestions(qRes.questions);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleGenerateAiForMock() {
    const subj = subjects.find((s) => s.id === aiSubjectId);
    const exam = exams.find((e) => e.id === examId);
    if (!subj) {
      setNotice({ tone: 'error', message: 'Select a subject for AI question generation.' });
      return;
    }

    setNotice(null);
    setAiGenerating(true);
    const res = await generateAiQuestionsForTutor({
      examName: exam?.name || 'JAMB UTME',
      subjectName: subj.name,
      difficulty: aiDifficulty,
      count: aiCount,
      purpose: 'mock_exam',
      instructions: aiInstructions,
    });
    setAiGenerating(false);

    if (res.error || !res.result) {
      setNotice({ tone: 'error', message: res.error || 'Could not generate AI questions.' });
      return;
    }

    const incoming: AdminMockCustomQuestionInput[] = res.result.questions.map((q) => ({
      subject_id: subj.id,
      question_text: q.questionText,
      explanation: q.explanation,
      difficulty: q.difficulty,
      points: q.points || 1,
      options: q.options.map((o, idx) => ({
        localKey: newKey(),
        option_key: o.optionKey || OPTION_KEYS[idx] || String(idx + 1),
        option_text: o.optionText,
        is_correct: o.isCorrect,
      })),
    }));

    setCustomQuestions((prev) => [...prev, ...incoming]);
    setNotice({
      tone: 'success',
      message: `AI prepared ${incoming.length} ${subj.name} questions. Review below and click Save Mock Exam.`,
    });
  }

  function addManualCustomQuestion() {
    const targetSubj = aiSubjectId || subjects[0]?.id;
    if (!targetSubj) return;
    setCustomQuestions((prev) => [
      ...prev,
      {
        subject_id: targetSubj,
        question_text: '',
        explanation: '',
        difficulty: 'medium',
        points: 1,
        options: OPTION_KEYS.map((k, idx) => ({
          localKey: newKey(),
          option_key: k,
          option_text: '',
          is_correct: idx === 0,
        })),
      },
    ]);
  }

  async function handleSaveMock(e: FormEvent) {
    e.preventDefault();
    if (!user || !examId) return;

    setNotice(null);
    setSaving(true);
    const res = await saveAdminMockExam({
      id: editingId,
      exam_id: examId,
      title,
      description,
      duration_minutes: durationMinutes,
      english_question_count: englishCount,
      other_subject_question_count: otherCount,
      uses_question_bank: usesBank,
      exclude_diagrams: excludeDiagrams,
      is_published: isPublished,
      show_explanations_after_submission: showExplanations,
      created_by: user.id,
      customQuestions,
    });
    setSaving(false);

    if (res.error) {
      setNotice({ tone: 'error', message: res.error });
      return;
    }

    await loadData();
    resetEditor(examId);
    setNotice({
      tone: 'success',
      message: editingId ? 'Mock exam updated.' : 'Mock exam created and ready.',
    });
  }

  async function handleDeleteMock(id: string) {
    setNotice(null);
    setDeletingId(id);
    const res = await deleteAdminMockExam(id);
    setDeletingId(null);
    if (res.error) {
      setNotice({ tone: 'error', message: res.error });
      return;
    }
    if (editingId === id) {
      resetEditor();
    }
    await loadData();
  }

  if (loading) return <LoadingState message="Loading Mock Exam Builder..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void loadData()} />;

  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          4-Subject Mock Exam Builder &amp; AI Setter
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Publish timed JAMB UTME (60 English + 40 × 3 Electives · 120 mins) and UI Post-UTME mock examinations, backed by your Question Bank plus AI-generated tutor questions.
        </p>
      </div>

      <AdminNav />

      {migrationMissing && (
        <Alert tone="info" title="Run migrations 012a–012d first">
          Execute <code className="font-mono text-xs">supabase/migrations/012a</code> through{' '}
          <code className="font-mono text-xs">012d</code> in order in Supabase SQL Editor to enable Mock Exams.
        </Alert>
      )}

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      {/* Question Bank Coverage Summary */}
      {!migrationMissing && subjects.length > 0 && (
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Approved Question Bank Coverage by Subject
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Dynamic mocks auto-draw each student&apos;s 4 chosen subjects
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {subjects.map((subj) => {
              const cnt = bankCounts.get(subj.id) ?? 0;
              return (
                <div
                  key={subj.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2"
                >
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {subj.name}
                  </p>
                  <p className="text-xs font-mono text-phosters-700 dark:text-phosters-400 tabular-nums">
                    {cnt} ready
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mock Exam Editor Form */}
      <form onSubmit={handleSaveMock} className="space-y-5">
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {editingId ? 'Edit Mock Exam Template' : 'Create New Mock Exam Template'}
            </h2>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => resetEditor()}>
                Cancel Edit
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Examination
              </label>
              <select
                value={examId}
                onChange={(e) => applyExamPreset(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Mock exam title"
              placeholder="e.g. JAMB UTME National Mock #1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions or syllabus scope for students..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Duration (minutes)"
              type="number"
              min={5}
              max={360}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value) || 120)}
            />
            <Input
              label="Use of English questions"
              type="number"
              min={1}
              max={100}
              value={englishCount}
              onChange={(e) => setEnglishCount(Number(e.target.value) || 60)}
            />
            <Input
              label="Other subjects (each)"
              type="number"
              min={1}
              max={100}
              value={otherCount}
              onChange={(e) => setOtherCount(Number(e.target.value) || 40)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={usesBank}
                onChange={(e) => setUsesBank(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Auto-fill remaining slots from Approved Question Bank
              </span>
            </label>

            <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={excludeDiagrams}
                onChange={(e) => setExcludeDiagrams(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Exclude diagram-dependent bank items
              </span>
            </label>

            <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Show answer review &amp; explanations after submission
              </span>
            </label>

            <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-semibold text-phosters-700 dark:text-phosters-400">
                Publish mock exam to students
              </span>
            </label>
          </div>
        </Card>

        {/* Tutor AI & Custom Mock Questions Section */}
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Custom &amp; AI-Set Mock Questions ({customQuestions.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Optional fixed questions per subject. When a student sits this mock, their 4 selected subjects pull custom questions first and top up from the Question Bank.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addManualCustomQuestion}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Manual Question</span>
            </Button>
          </div>

          <div className="rounded-xl border border-phosters-200 dark:border-phosters-800/80 bg-phosters-50/40 dark:bg-phosters-950/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Target Subject for AI
                </label>
                <select
                  value={aiSubjectId}
                  onChange={(e) => setAiSubjectId(e.target.value)}
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Difficulty
                </label>
                <select
                  value={aiDifficulty}
                  onChange={(e) =>
                    setAiDifficulty(e.target.value as 'mixed' | 'easy' | 'medium' | 'hard')
                  }
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="mixed">Balanced Exam Mix</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Count (1–40)
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={aiCount}
                  onChange={(e) =>
                    setAiCount(Math.max(1, Math.min(40, Number(e.target.value) || 10)))
                  }
                  className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder="Optional topic focus (e.g. Organic chemistry reactions & IUPAC naming)"
                className="flex-1 min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
              <Button
                type="button"
                variant="primary"
                loading={aiGenerating}
                onClick={() => void handleGenerateAiForMock()}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>AI Set {aiCount} Questions</span>
              </Button>
            </div>
          </div>

          {customQuestions.length > 0 && (
            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {customQuestions.map((q, qIdx) => (
                <div
                  key={`mcq-${qIdx}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        #{qIdx + 1}
                      </span>
                      <select
                        value={q.subject_id}
                        onChange={(e) =>
                          setCustomQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx ? { ...item, subject_id: e.target.value } : item
                            )
                          )
                        }
                        className="min-h-[36px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove custom question ${qIdx + 1}`}
                      onClick={() =>
                        setCustomQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                      }
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) =>
                      setCustomQuestions((prev) =>
                        prev.map((item, idx) =>
                          idx === qIdx ? { ...item, question_text: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Question prompt..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => (
                      <div key={opt.localKey} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`mock-q-${qIdx}`}
                          checked={opt.is_correct}
                          onChange={() =>
                            setCustomQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx
                                  ? {
                                      ...item,
                                      options: item.options.map((o, oi) => ({
                                        ...o,
                                        is_correct: oi === oIdx,
                                      })),
                                    }
                                  : item
                              )
                            )
                          }
                          className="h-4 w-4 text-phosters-600"
                        />
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                          {opt.option_key}
                        </span>
                        <input
                          type="text"
                          value={opt.option_text}
                          onChange={(e) =>
                            setCustomQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx
                                  ? {
                                      ...item,
                                      options: item.options.map((o, oi) =>
                                        oi === oIdx ? { ...o, option_text: e.target.value } : o
                                      ),
                                    }
                                  : item
                              )
                            )
                          }
                          className="flex-1 min-h-[38px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs text-slate-900 dark:text-slate-100"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={q.explanation}
                    onChange={(e) =>
                      setCustomQuestions((prev) =>
                        prev.map((item, idx) =>
                          idx === qIdx ? { ...item, explanation: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Explanation shown after submission (optional)"
                    className="w-full min-h-[38px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-slate-700 dark:text-slate-300"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" size="lg" loading={saving} disabled={migrationMissing}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>{editingId ? 'Save Mock Exam Changes' : 'Create Mock Exam'}</span>
            </Button>
          </div>
        </Card>
      </form>

      {/* Existing Mock Exams List */}
      <section aria-labelledby="existing-mocks-heading" className="space-y-3">
        <h2
          id="existing-mocks-heading"
          className="text-lg font-bold text-slate-900 dark:text-slate-100"
        >
          Configured Mock Exams ({mockExams.length})
        </h2>

        {mockExams.length === 0 ? (
          <EmptyState
            title="No custom mock exam templates yet"
            description="Students can already launch dynamic 4-subject mocks from your approved Question Bank, or you can create a curated mock template above."
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {mockExams.map((mock) => (
                <li
                  key={mock.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {mock.title}
                      </p>
                      <span
                        className={[
                          'text-xs font-semibold',
                          mock.is_published
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400',
                        ].join(' ')}
                      >
                        {mock.is_published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {mock.examName} · {mock.duration_minutes} mins · {mock.english_question_count}{' '}
                      Eng + {mock.other_subject_question_count}/subject · {mock.customQuestionCount}{' '}
                      custom Qs {mock.uses_question_bank ? '· +Question Bank' : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleStartEdit(mock)}
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      loading={deletingId === mock.id}
                      onClick={() => void handleDeleteMock(mock.id)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
