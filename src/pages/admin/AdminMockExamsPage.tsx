import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  datetimeLocalToIso,
  deriveReleaseStatus,
  getReleaseStatusMeta,
  isoToDatetimeLocal,
} from '../../lib/releaseQueue';
import {
  deleteAdminMockExam,
  fetchAdminMockExamsData,
  fetchMockCustomQuestionsForAdmin,
  generateAiQuestionsForTutor,
  saveAdminMockExam,
  saveTutorMockSubjectQuestions,
  updateMockReleaseStatus,
} from '../../services/mockExamService';
import {
  fetchMyTutorSubjectScope,
  filterSubjectsByTutorScope,
} from '../../services/tutorScopeService';
import type {
  AdminMockCustomQuestionInput,
  AdminMockExamListItem,
} from '../../types/cbt';
import type { Exam, ReleaseStatus, Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { ReleaseQueueControl } from '../../components/admin/ReleaseQueueControl';
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
  const { user, profile } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mockExams, setMockExams] = useState<AdminMockExamListItem[]>([]);
  const [bankCounts, setBankCounts] = useState<Map<string, number>>(new Map());
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [releaseQueueMigrationMissing, setReleaseQueueMigrationMissing] = useState(false);

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [assignedSubjectIds, setAssignedSubjectIds] = useState<string[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warning' | 'success' | 'error'; message: string } | null>(
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
  const [releaseStatus, setReleaseStatus] = useState<ReleaseStatus>('draft');
  const [scheduledReleaseLocal, setScheduledReleaseLocal] = useState('');

  // For Super Admin: holds all custom questions on the mock exam.
  // For Subject Tutors: `customQuestions` holds ONLY questions in their assigned subject(s),
  // while `otherSubjectCounts` shows read-only counts from other tutors/Super Admin.
  const [customQuestions, setCustomQuestions] = useState<AdminMockCustomQuestionInput[]>([]);
  const [otherSubjectCounts, setOtherSubjectCounts] = useState<Array<{ subjectName: string; count: number }>>([]);

  // AI Setter inside Mock Builder
  const [aiSubjectId, setAiSubjectId] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | ReleaseStatus>('all');
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editableSubjects = useMemo(
    () => filterSubjectsByTutorScope(subjects, assignedSubjectIds),
    [subjects, assignedSubjectIds]
  );

  const mockCounts = useMemo(() => {
    let queued = 0;
    let draft = 0;
    let published = 0;
    for (const m of mockExams) {
      const s = deriveReleaseStatus(m);
      if (s === 'queued') queued += 1;
      else if (s === 'published') published += 1;
      else draft += 1;
    }
    return { all: mockExams.length, queued, draft, published };
  }, [mockExams]);

  const filteredMocks = useMemo(() => {
    if (statusFilter === 'all') return mockExams;
    return mockExams.filter((m) => deriveReleaseStatus(m) === statusFilter);
  }, [mockExams, statusFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [res, scope] = await Promise.all([
      fetchAdminMockExamsData(),
      fetchMyTutorSubjectScope(user?.email, profile?.role),
    ]);

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
    setReleaseQueueMigrationMissing(res.releaseQueueMigrationMissing);
    setIsSuperAdmin(scope.isSuperAdmin);
    setAssignedSubjectIds(scope.assignedSubjectIds);

    const allowedSubjs = filterSubjectsByTutorScope(
      res.subjects,
      scope.assignedSubjectIds
    );

    if (!examId && res.exams.length > 0) {
      const jamb = res.exams.find((e) => e.slug === 'jamb-utme') ?? res.exams[0];
      setExamId(jamb.id);
    }

    setAiSubjectId((prev) => {
      if (prev && allowedSubjs.some((s) => s.id === prev)) return prev;
      return allowedSubjs[0]?.id ?? '';
    });

    setLoading(false);
  }, [examId, profile?.role, user?.email]);

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
    setReleaseStatus('draft');
    setScheduledReleaseLocal('');
    setCustomQuestions([]);
    setOtherSubjectCounts([]);
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
    setReleaseStatus(deriveReleaseStatus(mock));
    setScheduledReleaseLocal(isoToDatetimeLocal(mock.scheduled_release_at));

    const qRes = await fetchMockCustomQuestionsForAdmin(mock.id);
    if (qRes.error) {
      setNotice({ tone: 'error', message: qRes.error });
    } else if (isSuperAdmin || assignedSubjectIds === null) {
      setCustomQuestions(qRes.questions);
      setOtherSubjectCounts([]);
    } else {
      const allowedSet = new Set(assignedSubjectIds);
      const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
      const mine: AdminMockCustomQuestionInput[] = [];
      const otherCountsMap = new Map<string, number>();

      for (const q of qRes.questions) {
        if (allowedSet.has(q.subject_id)) {
          mine.push(q);
        } else {
          const sName = subjectMap.get(q.subject_id) ?? 'Other Subject';
          otherCountsMap.set(sName, (otherCountsMap.get(sName) ?? 0) + 1);
        }
      }

      setCustomQuestions(mine);
      setOtherSubjectCounts(
        Array.from(otherCountsMap.entries()).map(([subjectName, count]) => ({
          subjectName,
          count,
        }))
      );
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleGenerateAiForMock() {
    const subj = editableSubjects.find((s) => s.id === aiSubjectId);
    const exam = exams.find((e) => e.id === examId);
    if (!subj) {
      setNotice({ tone: 'error', message: 'Select an assigned subject for AI question generation.' });
      return;
    }

    setNotice(null);
    setAiGenerating(true);
    const res = await generateAiQuestionsForTutor({
      examName: exam?.name || 'JAMB UTME',
      subjectId: subj.id,
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
      message: `AI prepared ${incoming.length} ${subj.name} questions. Review below and save your changes.`,
    });
  }

  function addManualCustomQuestion() {
    const targetSubj =
      (editableSubjects.some((s) => s.id === aiSubjectId) ? aiSubjectId : '') ||
      editableSubjects[0]?.id;
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
    if (!user) return;

    setNotice(null);

    // Subject Tutor mode: save ONLY questions belonging to assigned subjects
    if (!isSuperAdmin) {
      if (!editingId) {
        setNotice({
          tone: 'error',
          message: 'Select a Mock Exam template below before saving your subject questions.',
        });
        return;
      }

      setSaving(true);
      const res = await saveTutorMockSubjectQuestions({
        mockExamId: editingId,
        allowedSubjectIds: assignedSubjectIds,
        customQuestions,
      });
      setSaving(false);

      if (res.error) {
        setNotice({ tone: 'error', message: res.error });
        return;
      }

      await loadData();
      setNotice({
        tone: 'success',
        message: 'Saved your assigned subject questions to this Mock Exam without affecting other subjects.',
      });
      return;
    }

    if (!examId) return;

    const scheduledIso =
      releaseStatus === 'queued' ? datetimeLocalToIso(scheduledReleaseLocal) : null;

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
      is_published: releaseStatus === 'published',
      release_status: releaseStatus,
      scheduled_release_at: scheduledIso,
      show_explanations_after_submission: showExplanations,
      created_by: user.id,
      customQuestions,
    });
    setSaving(false);

    if (res.error) {
      setNotice({ tone: 'error', message: res.error });
      return;
    }

    const wasEditing = Boolean(editingId);
    const savedStatus = releaseStatus;
    await loadData();
    resetEditor(examId);

    if (res.warning) {
      setReleaseQueueMigrationMissing(true);
      setNotice({ tone: 'warning', message: res.warning });
    } else {
      setNotice({
        tone: 'success',
        message:
          savedStatus === 'queued'
            ? wasEditing
              ? 'Mock exam updated in Release Queue.'
              : 'Mock exam created and placed in Release Queue.'
            : savedStatus === 'published'
              ? wasEditing
                ? 'Mock exam updated and published to students.'
                : 'Mock exam published and ready for students.'
              : wasEditing
                ? 'Mock exam draft updated.'
                : 'Mock exam saved as draft.',
      });
    }
  }

  async function handleStatusTransition(
    mock: AdminMockExamListItem,
    nextStatus: ReleaseStatus
  ) {
    setNotice(null);
    setStatusBusyId(mock.id);
    const res = await updateMockReleaseStatus(
      mock.id,
      nextStatus,
      nextStatus === 'queued' ? mock.scheduled_release_at : null
    );
    setStatusBusyId(null);

    if (res.releaseQueueMigrationMissing) {
      setReleaseQueueMigrationMissing(true);
    }
    if (res.error) {
      setNotice({ tone: 'error', message: res.error });
      return;
    }

    await loadData();
    setNotice({
      tone: 'success',
      message:
        nextStatus === 'published'
          ? `"${mock.title}" is now released to students.`
          : nextStatus === 'queued'
            ? `"${mock.title}" moved to the Release Queue.`
            : `"${mock.title}" moved to Drafts.`,
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

  const noSubjectsAssigned = !isSuperAdmin && editableSubjects.length === 0;
  const activeMock = editingId ? mockExams.find((m) => m.id === editingId) : undefined;
  const coverageSubjects = isSuperAdmin ? subjects : editableSubjects;
  const showQuestionBuilder = isSuperAdmin || (Boolean(editingId) && !noSubjectsAssigned);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          4-Subject Mock Exam Builder &amp; AI Setter
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {isSuperAdmin
            ? 'Publish timed JAMB UTME (60 English + 40 × 3 Electives · 120 mins) and UI Post-UTME mock examinations, backed by your Question Bank plus manual and AI tutor questions.'
            : editableSubjects.length > 0
              ? `Manually add or AI-generate mock exam questions for your assigned subject${editableSubjects.length > 1 ? 's' : ''}: ${editableSubjects.map((s) => s.name).join(' · ')}.`
              : 'Add manual or AI-generated mock exam questions for your assigned subjects.'}
        </p>
      </div>

      <AdminNav />

      {migrationMissing && (
        <Alert tone="info" title="Run migrations 012a–012d first">
          Execute <code className="font-mono text-xs">supabase/migrations/012a</code> through{' '}
          <code className="font-mono text-xs">012d</code> in order in Supabase SQL Editor to enable Mock Exams.
        </Alert>
      )}

      {!migrationMissing && releaseQueueMigrationMissing && (
        <Alert tone="info" title="Enable Release Queue &amp; Scheduled Release">
          {isSuperAdmin ? 'Run ' : 'Ask Super Admin to run '}
          <code className="font-mono text-xs">supabase/migrations/014a</code>,{' '}
          <code className="font-mono text-xs">014b</code>, and{' '}
          <code className="font-mono text-xs">014c</code> in the Supabase SQL Editor to queue or schedule mock exams before publishing.
        </Alert>
      )}

      {noSubjectsAssigned && (
        <Alert tone="warning" title="No subjects assigned to your Tutor account">
          You cannot add or edit Mock Exam questions until the Super Admin (<code className="font-mono text-xs">oyasordaniel@gmail.com</code>) assigns one or more subjects to your account under Tutor Access.
        </Alert>
      )}

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      {/* Question Bank Coverage Summary */}
      {!migrationMissing && coverageSubjects.length > 0 && (
        <Card padding="md" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {isSuperAdmin
                ? 'Approved Question Bank Coverage by Subject'
                : 'Approved Question Bank Coverage (Your Assigned Subjects)'}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Dynamic mocks auto-draw each student&apos;s 4 chosen subjects
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {coverageSubjects.map((subj) => {
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

      {/* Tutor Prompt when no template is selected yet */}
      {!isSuperAdmin && !editingId && !noSubjectsAssigned && mockExams.length > 0 && (
        <Alert tone="info" title="Select a Mock Exam below">
          Click <strong>Set Questions</strong> on any Mock Exam template in the list below to manually set or AI-generate questions for{' '}
          <strong>{editableSubjects.map((s) => s.name).join(', ')}</strong>. Other tutors&apos; subjects on the same mock exam stay untouched.
        </Alert>
      )}

      {/* Mock Exam Editor Form */}
      {showQuestionBuilder && (
        <form onSubmit={handleSaveMock} className="space-y-5">
          {isSuperAdmin ? (
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

                <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer sm:col-span-2">
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
              </div>

              <ReleaseQueueControl
                entityLabel="mock exam"
                releaseStatus={releaseStatus}
                scheduledReleaseLocal={scheduledReleaseLocal}
                onChangeStatus={setReleaseStatus}
                onChangeSchedule={setScheduledReleaseLocal}
              />
            </Card>
          ) : activeMock ? (
            <Card padding="lg" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-phosters-700 dark:text-phosters-400">
                    Selected Mock Exam Template
                  </p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {activeMock.title}
                  </h2>
                </div>
                <Button type="button" variant="ghost" onClick={() => resetEditor()}>
                  Close Selection
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {activeMock.examName} · {activeMock.duration_minutes} mins ·{' '}
                {activeMock.english_question_count} Eng +{' '}
                {activeMock.other_subject_question_count}/subject ·{' '}
                <span className={`font-semibold ${getReleaseStatusMeta(activeMock).toneClass}`}>
                  {getReleaseStatusMeta(activeMock).label}
                </span>
              </p>
              {activeMock.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 pt-1">
                  {activeMock.description}
                </p>
              )}
              {otherSubjectCounts.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  Questions already contributed in other subjects (protected):{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {otherSubjectCounts
                      .map((o) => `${o.subjectName}: ${o.count}`)
                      .join(' · ')}
                  </span>
                </p>
              )}
            </Card>
          ) : null}

          {/* Tutor AI & Custom Mock Questions Section */}
          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isSuperAdmin
                    ? `Custom & AI-Set Mock Questions (${customQuestions.length})`
                    : `Your Assigned Subject Questions (${customQuestions.length})`}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Optional fixed questions per subject. When a student sits this mock, their 4 selected subjects pull custom questions first and top up from the Question Bank.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={editableSubjects.length === 0}
                onClick={addManualCustomQuestion}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Manual Question</span>
              </Button>
            </div>

            {editableSubjects.length > 0 && (
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
                      {editableSubjects.map((s) => (
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
            )}

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
                          {editableSubjects.map((s) => (
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
                <span>
                  {isSuperAdmin
                    ? editingId
                      ? 'Save Mock Exam Changes'
                      : 'Create Mock Exam'
                    : 'Save My Subject Questions'}
                </span>
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* Existing Mock Exams List */}
      <section aria-labelledby="existing-mocks-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="existing-mocks-heading"
            className="text-lg font-bold text-slate-900 dark:text-slate-100"
          >
            Configured Mock Exams ({mockExams.length})
          </h2>
        </div>

        {mockExams.length > 0 && (
          <div
            role="tablist"
            aria-label="Filter mock exams by release status"
            className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800"
          >
            {(
              [
                { key: 'all', label: 'All Mocks', count: mockCounts.all },
                { key: 'queued', label: 'Queued (Awaiting Release)', count: mockCounts.queued },
                { key: 'draft', label: 'Drafts', count: mockCounts.draft },
                { key: 'published', label: 'Published', count: mockCounts.published },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.key)}
                  className={[
                    'min-h-[42px] px-3.5 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer tabular-nums',
                    active
                      ? 'border-phosters-600 text-phosters-700 dark:text-phosters-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100',
                  ].join(' ')}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>
        )}

        {mockExams.length === 0 ? (
          <EmptyState
            title="No custom mock exam templates yet"
            description={
              isSuperAdmin
                ? 'Students can already launch dynamic 4-subject mocks from your approved Question Bank, or you can create a curated mock template above.'
                : 'Ask Super Admin to create a mock exam template so you can add manual or AI-generated questions for your assigned subjects.'
            }
          />
        ) : filteredMocks.length === 0 ? (
          <EmptyState
            title={`No ${statusFilter === 'queued' ? 'queued' : statusFilter} mock exams`}
            description={
              statusFilter === 'queued'
                ? 'Queue a mock exam while tutors finish adding subject questions so it stays prepared and awaiting release.'
                : 'No mock exam templates match this filter.'
            }
          />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMocks.map((mock) => {
                const meta = getReleaseStatusMeta(mock);
                const isBusy = statusBusyId === mock.id;
                return (
                  <li
                    key={mock.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {mock.title}
                        </p>
                        <span aria-hidden="true" className="text-slate-400">
                          ·
                        </span>
                        <span className={`text-xs font-semibold ${meta.toneClass}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {mock.examName} · {mock.duration_minutes} mins · {mock.english_question_count}{' '}
                        Eng + {mock.other_subject_question_count}/subject · {mock.customQuestionCount}{' '}
                        custom Qs {mock.uses_question_bank ? '· +Question Bank' : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isSuperAdmin && meta.status === 'draft' && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(mock, 'queued')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                            <span>Queue</span>
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(mock, 'published')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                            <span>Release Now</span>
                          </Button>
                        </>
                      )}

                      {isSuperAdmin && meta.status === 'queued' && (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(mock, 'published')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                            <span>Release Now</span>
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            loading={isBusy}
                            onClick={() => void handleStatusTransition(mock, 'draft')}
                            className="whitespace-nowrap shrink-0"
                          >
                            <span>Move to Draft</span>
                          </Button>
                        </>
                      )}

                      {isSuperAdmin && meta.status === 'published' && (
                        <Button
                          type="button"
                          variant="secondary"
                          loading={isBusy}
                          onClick={() => void handleStatusTransition(mock, 'draft')}
                          className="whitespace-nowrap shrink-0"
                        >
                          <span>Move to Draft</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant={editingId === mock.id ? 'primary' : 'secondary'}
                        disabled={!isSuperAdmin && noSubjectsAssigned}
                        onClick={() => void handleStartEdit(mock)}
                        className="whitespace-nowrap shrink-0"
                      >
                        <Edit3 className="h-4 w-4" aria-hidden="true" />
                        <span>{isSuperAdmin ? 'Edit' : 'Set Questions'}</span>
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          loading={deletingId === mock.id}
                          onClick={() => void handleDeleteMock(mock.id)}
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          <span>Delete</span>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
