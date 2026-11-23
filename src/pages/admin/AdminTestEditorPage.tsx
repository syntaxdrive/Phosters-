import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, BellRing, BookOpenCheck, Plus, Sparkles, Trash2 } from 'lucide-react';
import { fetchAdminLessonsList } from '../../services/adminService';
import { fetchTestForAdminEditor, saveAdminTest } from '../../services/cbtService';
import { generateAiQuestionsForTutor } from '../../services/mockExamService';
import { triggerPushNotification } from '../../services/pushService';
import { fetchApprovedBankQuestionsForTestBuilder } from '../../services/questionBankService';
import type { AdminLessonListItem } from '../../types/admin';
import type { AdminQuestionDraft } from '../../types/cbt';
import type { Exam, Subject, Topic } from '../../types/database';
import type { QuestionDifficulty } from '../../types/questionBank';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyQuestion(): AdminQuestionDraft {
  return {
    localKey: newKey(),
    question_text: '',
    explanation: '',
    points: 1,
    options: [
      { localKey: newKey(), option_key: 'A', option_text: '', is_correct: true },
      { localKey: newKey(), option_key: 'B', option_text: '', is_correct: false },
      { localKey: newKey(), option_key: 'C', option_text: '', is_correct: false },
      { localKey: newKey(), option_key: 'D', option_text: '', is_correct: false },
    ],
  };
}

export function AdminTestEditorPage() {
  const { testId } = useParams();
  const isEditing = Boolean(testId && testId !== 'new');
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<AdminLessonListItem[]>([]);

  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [attachMode, setAttachMode] = useState<'lesson' | 'topic'>('lesson');
  const [topicId, setTopicId] = useState('');
  const [lessonId, setLessonId] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showExplanations, setShowExplanations] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [notifyOnSave, setNotifyOnSave] = useState(false);
  const [questions, setQuestions] = useState<AdminQuestionDraft[]>([createEmptyQuestion()]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);

  // Pull from Question Bank state (available to all authorized Tutors)
  const [bankOpen, setBankOpen] = useState(false);
  const [bankMatchScope, setBankMatchScope] = useState<'exam_subject' | 'subject_only' | 'all'>('exam_subject');
  const [bankYearInput, setBankYearInput] = useState('');
  const [bankDifficulty, setBankDifficulty] = useState<QuestionDifficulty | ''>('');
  const [bankExcludeDiagrams, setBankExcludeDiagrams] = useState(true);
  const [bankCount, setBankCount] = useState(10);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankFeedback, setBankFeedback] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);

  // Tutor AI Question Generator state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed');
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);

  const loadEditor = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const baseRes = await fetchAdminLessonsList();
    if (baseRes.error) {
      setLoadError(baseRes.error);
      setLoading(false);
      return;
    }

    setExams(baseRes.exams);
    setSubjects(baseRes.subjects);
    setTopics(baseRes.topics);
    setLessons(baseRes.lessons);

    if (isEditing && testId) {
      const testRes = await fetchTestForAdminEditor(testId);
      if (testRes.error || !testRes.test) {
        setLoadError(testRes.error || 'Test not found.');
        setLoading(false);
        return;
      }

      const t = testRes.test;
      setTitle(t.title);
      setDescription(t.description ?? '');
      setShowExplanations(t.show_explanations_after_submission);
      setIsPublished(t.is_published);

      // Resolve placement context
      let resolvedTopic: Topic | undefined;
      if (t.lesson_id) {
        setAttachMode('lesson');
        setLessonId(t.lesson_id);
        const matchedLesson = baseRes.lessons.find((l) => l.id === t.lesson_id);
        resolvedTopic = baseRes.topics.find((tp) => tp.id === matchedLesson?.topic_id);
      } else if (t.topic_id) {
        setAttachMode('topic');
        resolvedTopic = baseRes.topics.find((tp) => tp.id === t.topic_id);
      }

      setTopicId(resolvedTopic?.id ?? t.topic_id ?? '');
      setSelectedExamId(resolvedTopic?.exam_id ?? baseRes.exams[0]?.id ?? '');
      setSelectedSubjectId(resolvedTopic?.subject_id ?? baseRes.subjects[0]?.id ?? '');

      if (testRes.questions.length > 0) {
        setQuestions(
          testRes.questions.map((q) => ({
            localKey: q.id,
            question_text: q.question_text,
            explanation: q.explanation ?? '',
            points: q.points,
            options: q.options.map((o, idx) => ({
              localKey: o.id,
              option_key: o.option_key || OPTION_KEYS[idx] || String(idx + 1),
              option_text: o.option_text,
              is_correct: o.is_correct,
            })),
          }))
        );
      }
    } else {
      const firstTopic = baseRes.topics[0];
      const firstLesson = baseRes.lessons.find((l) => l.topic_id === firstTopic?.id);
      setSelectedExamId(firstTopic?.exam_id ?? baseRes.exams[0]?.id ?? '');
      setSelectedSubjectId(firstTopic?.subject_id ?? baseRes.subjects[0]?.id ?? '');
      setTopicId(firstTopic?.id ?? '');
      setLessonId(firstLesson?.id ?? '');
      setAttachMode(firstLesson ? 'lesson' : 'topic');
    }

    setLoading(false);
  }, [isEditing, testId]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  const matchingTopics = topics.filter(
    (t) => t.exam_id === selectedExamId && t.subject_id === selectedSubjectId
  );
  const matchingLessons = lessons.filter((l) => l.topic_id === topicId);

  function handleExamOrSubjectChange(nextExamId: string, nextSubjectId: string) {
    setSelectedExamId(nextExamId);
    setSelectedSubjectId(nextSubjectId);
    const nextTopic = topics.find(
      (t) => t.exam_id === nextExamId && t.subject_id === nextSubjectId
    );
    const nextTopicId = nextTopic?.id ?? '';
    setTopicId(nextTopicId);
    const nextLesson = lessons.find((l) => l.topic_id === nextTopicId);
    setLessonId(nextLesson?.id ?? '');
  }

  function handleTopicChange(nextTopicId: string) {
    setTopicId(nextTopicId);
    const nextLesson = lessons.find((l) => l.topic_id === nextTopicId);
    setLessonId(nextLesson?.id ?? '');
  }

  function moveQuestion(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function addOptionToQuestion(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex || q.options.length >= OPTION_KEYS.length) return q;
        const nextKeyChar = OPTION_KEYS[q.options.length];
        return {
          ...q,
          options: [
            ...q.options,
            {
              localKey: newKey(),
              option_key: nextKeyChar,
              option_text: '',
              is_correct: false,
            },
          ],
        };
      })
    );
  }

  function removeOptionFromQuestion(qIndex: number, optIndex: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex || q.options.length <= 2) return q;
        const remaining = q.options
          .filter((_, oi) => oi !== optIndex)
          .map((o, oi) => ({ ...o, option_key: OPTION_KEYS[oi] ?? String(oi + 1) }));
        // Ensure one option remains marked correct
        if (!remaining.some((o) => o.is_correct) && remaining.length > 0) {
          remaining[0] = { ...remaining[0], is_correct: true };
        }
        return { ...q, options: remaining };
      })
    );
  }

  function setCorrectOption(qIndex: number, optIndex: number) {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        return {
          ...q,
          options: q.options.map((o, oi) => ({ ...o, is_correct: oi === optIndex })),
        };
      })
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(null);
    setPushNotice(null);

    const targetTopicId = attachMode === 'topic' ? topicId || null : null;
    const targetLessonId = attachMode === 'lesson' ? lessonId || null : null;

    if (attachMode === 'lesson' && !targetLessonId) {
      setFormError('Select a lesson to attach this test to, or switch to Topic attachment.');
      return;
    }
    if (attachMode === 'topic' && !targetTopicId) {
      setFormError('Select a topic to attach this test to.');
      return;
    }

    setSaving(true);
    const res = await saveAdminTest({
      id: isEditing ? testId : undefined,
      title,
      description,
      topic_id: targetTopicId,
      lesson_id: targetLessonId,
      is_published: isPublished,
      show_explanations_after_submission: showExplanations,
      questions,
    });
    setSaving(false);

    if (res.error || !res.testId) {
      setFormError(res.error || 'Could not save test.');
      return;
    }

    setSaveSuccess('Test and questions saved.');

    if (isPublished && notifyOnSave) {
      setSendingPush(true);
      const pushRes = await triggerPushNotification({
        type: 'test',
        testId: res.testId,
        onlyUnattempted: false,
      });
      setSendingPush(false);
      if (pushRes.error) {
        setPushNotice({ tone: 'error', message: `Test saved, but push failed: ${pushRes.error}` });
      } else if (pushRes.result) {
        setPushNotice({ tone: 'success', message: pushRes.result.message });
      }
      setNotifyOnSave(false);
    }

    if (!isEditing) {
      navigate(`/admin/tests/${res.testId}`, { replace: true });
    }
  }

  async function handleSendTestPush(onlyUnattempted: boolean) {
    if (!testId || !isPublished) return;
    setPushNotice(null);
    setSendingPush(true);
    const pushRes = await triggerPushNotification({
      type: 'test',
      testId,
      onlyUnattempted,
    });
    setSendingPush(false);
    if (pushRes.error) {
      setPushNotice({ tone: 'error', message: pushRes.error });
    } else if (pushRes.result) {
      setPushNotice({ tone: 'success', message: pushRes.result.message });
    }
  }

  async function handlePullFromQuestionBank(overrideCount?: number) {
    const requestedCount = Math.max(1, Math.min(100, overrideCount ?? bankCount));
    if (overrideCount) setBankCount(overrideCount);
    setBankFeedback(null);
    setBankLoading(true);

    const parsedYear = Number(bankYearInput.trim());
    const validYear =
      Number.isFinite(parsedYear) && parsedYear >= 1978 && parsedYear <= 2035
        ? parsedYear
        : null;

    const res = await fetchApprovedBankQuestionsForTestBuilder({
      examId: bankMatchScope === 'exam_subject' ? selectedExamId : undefined,
      subjectId: bankMatchScope !== 'all' ? selectedSubjectId : undefined,
      examYear: validYear,
      difficulty: bankDifficulty,
      excludeDiagrams: bankExcludeDiagrams,
      count: requestedCount,
    });

    setBankLoading(false);

    if (res.migrationMissing) {
      setBankFeedback({
        tone: 'info',
        message: 'Question Bank tables have not been migrated yet. Ask Super Admin to run migration 011.',
      });
      return;
    }

    if (res.error) {
      setBankFeedback({ tone: 'error', message: res.error });
      return;
    }

    if (res.items.length === 0) {
      setBankFeedback({
        tone: 'info',
        message: 'No approved Question Bank items matched those filters. Try broadening scope to Any Exam (Same Subject).',
      });
      return;
    }

    const existingTexts = new Set(
      questions.map((q) => q.question_text.trim().toLowerCase()).filter(Boolean)
    );

    const incomingDrafts: AdminQuestionDraft[] = [];
    for (const item of res.items) {
      const normalized = item.question_text.trim().toLowerCase();
      if (existingTexts.has(normalized)) continue;
      existingTexts.add(normalized);

      const mappedOpts = item.options.map((opt, idx) => ({
        localKey: newKey(),
        option_key: opt.option_key || OPTION_KEYS[idx] || String(idx + 1),
        option_text: opt.option_text,
        is_correct: opt.is_correct,
      }));
      if (mappedOpts.length >= 2 && !mappedOpts.some((o) => o.is_correct)) {
        mappedOpts[0] = { ...mappedOpts[0], is_correct: true };
      }
      if (mappedOpts.length < 2) continue;

      incomingDrafts.push({
        localKey: newKey(),
        question_text: item.question_text,
        explanation: item.explanation ?? '',
        points: item.points || 1,
        options: mappedOpts,
      });
    }

    if (incomingDrafts.length === 0) {
      setBankFeedback({
        tone: 'info',
        message: 'All matching bank questions are already in this test draft.',
      });
      return;
    }

    setQuestions((prev) => {
      const isOnlyBlankStarter =
        prev.length === 1 &&
        !prev[0].question_text.trim() &&
        prev[0].options.every((o) => !o.option_text.trim());
      return isOnlyBlankStarter ? incomingDrafts : [...prev, ...incomingDrafts];
    });

    setBankFeedback({
      tone: 'success',
      message: `Added ${incomingDrafts.length} approved questions from the Question Bank. Review and save when ready.`,
    });
  }

  async function handleGenerateAiQuestions(overrideCount?: number) {
    const requestedCount = Math.max(1, Math.min(40, overrideCount ?? aiCount));
    if (overrideCount) setAiCount(overrideCount);
    setAiFeedback(null);

    const examName = exams.find((e) => e.id === selectedExamId)?.name || 'JAMB UTME';
    const subjectName = subjects.find((s) => s.id === selectedSubjectId)?.name || '';
    const topicTitle = topics.find((t) => t.id === topicId)?.title || '';
    const lessonTitle =
      attachMode === 'lesson' ? lessons.find((l) => l.id === lessonId)?.title || '' : '';

    if (!subjectName) {
      setAiFeedback({ tone: 'error', message: 'Select a Subject above before generating AI questions.' });
      return;
    }

    setAiLoading(true);
    const res = await generateAiQuestionsForTutor({
      examName,
      subjectName,
      topicTitle: [topicTitle, lessonTitle].filter(Boolean).join(' — '),
      difficulty: aiDifficulty,
      count: requestedCount,
      purpose: 'lesson_test',
      instructions: aiInstructions,
    });
    setAiLoading(false);

    if (res.error || !res.result) {
      setAiFeedback({
        tone: 'error',
        message: res.error || 'Could not generate AI questions right now.',
      });
      return;
    }

    const existingTexts = new Set(
      questions.map((q) => q.question_text.trim().toLowerCase()).filter(Boolean)
    );

    const incomingDrafts: AdminQuestionDraft[] = [];
    for (const item of res.result.questions) {
      const normalized = item.questionText.trim().toLowerCase();
      if (!normalized || existingTexts.has(normalized)) continue;
      existingTexts.add(normalized);

      incomingDrafts.push({
        localKey: newKey(),
        question_text: item.questionText,
        explanation: item.explanation || '',
        points: item.points || 1,
        options: item.options.map((o, idx) => ({
          localKey: newKey(),
          option_key: o.optionKey || OPTION_KEYS[idx] || String(idx + 1),
          option_text: o.optionText,
          is_correct: o.isCorrect,
        })),
      });
    }

    if (incomingDrafts.length === 0) {
      setAiFeedback({ tone: 'info', message: 'No new questions were added from the AI response.' });
      return;
    }

    setQuestions((prev) => {
      const isOnlyBlankStarter =
        prev.length === 1 &&
        !prev[0].question_text.trim() &&
        prev[0].options.every((o) => !o.option_text.trim());
      return isOnlyBlankStarter ? incomingDrafts : [...prev, ...incomingDrafts];
    });

    setAiFeedback({
      tone: 'success',
      message: `Generated ${incomingDrafts.length} ${subjectName} questions with verified keys and explanations. Review below before saving.`,
    });
  }

  if (loading) return <LoadingState message="Loading test editor..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void loadEditor()} />;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/admin/tests"
            className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Tests</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Test' : 'Create Test'}
          </h1>
        </div>

        {isEditing && isPublished && testId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={sendingPush}
              onClick={() => void handleSendTestPush(false)}
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              <span>Notify All Enrolled</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={sendingPush}
              onClick={() => void handleSendTestPush(true)}
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              <span>Remind Unattempted</span>
            </Button>
          </div>
        )}
      </div>

      <AdminNav />

      {formError && <Alert tone="error">{formError}</Alert>}
      {saveSuccess && <Alert tone="success">{saveSuccess}</Alert>}
      {pushNotice && <Alert tone={pushNotice.tone}>{pushNotice.message}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Test settings &amp; attachment</h2>

          <Input
            label="Test title"
            placeholder="e.g. Algebra Practice Quiz 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Instructions / description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief instructions shown before the student starts"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Attach test to</p>
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => setAttachMode('lesson')}
                className={[
                  'min-h-[38px] px-3.5 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors',
                  attachMode === 'lesson'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
                ].join(' ')}
              >
                Specific Lesson
              </button>
              <button
                type="button"
                onClick={() => setAttachMode('topic')}
                className={[
                  'min-h-[38px] px-3.5 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-colors',
                  attachMode === 'topic'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
                ].join(' ')}
              >
                Whole Topic
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                Examination
              </label>
              <select
                value={selectedExamId}
                onChange={(e) =>
                  handleExamOrSubjectChange(e.target.value, selectedSubjectId)
                }
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) =>
                  handleExamOrSubjectChange(selectedExamId, e.target.value)
                }
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">Topic</label>
              <select
                value={topicId}
                onChange={(e) => handleTopicChange(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {matchingTopics.length === 0 ? (
                  <option value="">No topics for this exam &amp; subject</option>
                ) : (
                  matchingTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))
                )}
              </select>
            </div>

            {attachMode === 'lesson' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">Lesson</label>
                <select
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                >
                  {matchingLessons.length === 0 ? (
                    <option value="">No lessons in this topic yet</option>
                  ) : (
                    matchingLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
              />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Show correct answers &amp; explanations after submission
              </span>
            </label>

            <div className="space-y-1">
              <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Published (students can take this test)
                </span>
              </label>

              {isPublished && (
                <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnSave}
                    onChange={(e) => setNotifyOnSave(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                  />
                  <span className="text-sm font-medium text-phosters-700 dark:text-phosters-400">
                    Send native push notification to enrolled students when saved
                  </span>
                </label>
              )}
            </div>
          </div>
        </Card>

        <section aria-labelledby="questions-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="questions-heading" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Questions ({questions.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAiOpen((v) => !v)}
              >
                <Sparkles className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                <span>{aiOpen ? 'Hide AI Setter' : 'Set Questions with AI'}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setBankOpen((v) => !v)}
              >
                <BookOpenCheck className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                <span>{bankOpen ? 'Hide Question Bank' : 'Pull from Question Bank'}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setQuestions((prev) => [...prev, createEmptyQuestion()])
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Question</span>
              </Button>
            </div>
          </div>

          {aiOpen && (
            <Card padding="lg" className="space-y-4 border-phosters-200 dark:border-phosters-800/80">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  AI Tutor Assistant — Generate Syllabus Questions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Creates original {exams.find((e) => e.id === selectedExamId)?.name || 'exam'} questions for{' '}
                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                    {subjects.find((s) => s.id === selectedSubjectId)?.name || 'selected subject'}
                  </strong>{' '}
                  with A–D options and student explanations. You can edit any draft before saving.
                </p>
              </div>

              {aiFeedback && <Alert tone={aiFeedback.tone}>{aiFeedback.message}</Alert>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Difficulty mix
                  </label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) =>
                      setAiDifficulty(e.target.value as 'mixed' | 'easy' | 'medium' | 'hard')
                    }
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="mixed">Balanced Exam Mix</option>
                    <option value="easy">Easy (Foundational)</option>
                    <option value="medium">Medium (Standard UTME)</option>
                    <option value="hard">Hard (Competitive / UI)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Number of questions (1–40)
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

                <div className="space-y-1 sm:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Topic / syllabus instructions (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="e.g. Focus on Quadratic Equations, surds, and word problems; include worked numerical solutions."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  loading={aiLoading}
                  onClick={() => void handleGenerateAiQuestions(5)}
                >
                  +5 Quick Quiz
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={aiLoading}
                  onClick={() => void handleGenerateAiQuestions(25)}
                >
                  +25 UI Post-UTME
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={aiLoading}
                  onClick={() => void handleGenerateAiQuestions(40)}
                >
                  +40 JAMB Subject
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  loading={aiLoading}
                  onClick={() => void handleGenerateAiQuestions()}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Generate {aiCount} Questions</span>
                </Button>
              </div>
            </Card>
          )}

          {bankOpen && (
            <Card padding="lg" className="space-y-4 border-phosters-200 dark:border-phosters-800/80">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Pull approved past questions into this test
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Randomly draws non-duplicate approved questions curated in the Phosters Question Bank.
                </p>
              </div>

              {bankFeedback && <Alert tone={bankFeedback.tone}>{bankFeedback.message}</Alert>}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Scope
                  </label>
                  <select
                    value={bankMatchScope}
                    onChange={(e) =>
                      setBankMatchScope(e.target.value as 'exam_subject' | 'subject_only' | 'all')
                    }
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="exam_subject">Selected Exam &amp; Subject</option>
                    <option value="subject_only">Selected Subject (Any Exam)</option>
                    <option value="all">All Approved Bank Questions</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Difficulty
                  </label>
                  <select
                    value={bankDifficulty}
                    onChange={(e) => setBankDifficulty(e.target.value as QuestionDifficulty | '')}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Any Difficulty</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Exam Year (optional)
                  </label>
                  <input
                    type="number"
                    min={1978}
                    max={2035}
                    placeholder="Any year"
                    value={bankYearInput}
                    onChange={(e) => setBankYearInput(e.target.value)}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Questions to add
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bankCount}
                    onChange={(e) => setBankCount(Math.max(1, Math.min(100, Number(e.target.value) || 10)))}
                    className="w-full min-h-[42px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bankExcludeDiagrams}
                    onChange={(e) => setBankExcludeDiagrams(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Exclude questions that require external diagrams or graphs
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={bankLoading}
                    onClick={() => void handlePullFromQuestionBank(25)}
                  >
                    +25 UI Post-UTME
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={bankLoading}
                    onClick={() => void handlePullFromQuestionBank(40)}
                  >
                    +40 JAMB Subject
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={bankLoading}
                    onClick={() => void handlePullFromQuestionBank(60)}
                  >
                    +60 JAMB English
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    loading={bankLoading}
                    onClick={() => void handlePullFromQuestionBank()}
                  >
                    Add {bankCount} Questions
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {questions.map((q, qIndex) => (
            <Card key={q.localKey} padding="lg" className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  Question {qIndex + 1}
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Move question ${qIndex + 1} up`}
                    disabled={qIndex === 0}
                    onClick={() => moveQuestion(qIndex, -1)}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move question ${qIndex + 1} down`}
                    disabled={qIndex === questions.length - 1}
                    onClick={() => moveQuestion(qIndex, 1)}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove question ${qIndex + 1}`}
                      onClick={() =>
                        setQuestions((prev) =>
                          prev.filter((_, idx) => idx !== qIndex)
                        )
                      }
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3 space-y-1.5">
                  <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                    Question text
                  </label>
                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((item, idx) =>
                          idx === qIndex
                            ? { ...item, question_text: e.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Enter the question..."
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
                    required
                  />
                </div>

                <Input
                  label="Points"
                  type="number"
                  min={1}
                  value={q.points}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, idx) =>
                        idx === qIndex
                          ? { ...item, points: Math.max(1, Number(e.target.value) || 1) }
                          : item
                      )
                    )
                  }
                />
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Answer options (select the one correct answer)
                  </p>
                  {q.options.length < OPTION_KEYS.length && (
                    <button
                      type="button"
                      onClick={() => addOptionToQuestion(qIndex)}
                      className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer"
                    >
                      + Add option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <div key={opt.localKey} className="flex items-center gap-2.5">
                      <label className="inline-flex items-center gap-2 min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer shrink-0">
                        <input
                          type="radio"
                          name={`correct-${q.localKey}`}
                          checked={opt.is_correct}
                          onChange={() => setCorrectOption(qIndex, optIdx)}
                          className="h-4 w-4 text-phosters-600 focus:ring-phosters-600"
                        />
                        <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {opt.option_key}
                        </span>
                      </label>

                      <input
                        type="text"
                        placeholder={`Option ${opt.option_key}`}
                        value={opt.option_text}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIndex
                                ? {
                                    ...item,
                                    options: item.options.map((o, oi) =>
                                      oi === optIdx
                                        ? { ...o, option_text: e.target.value }
                                        : o
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        className="flex-1 min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
                        required
                      />

                      {q.options.length > 2 && (
                        <button
                          type="button"
                          aria-label={`Remove option ${opt.option_key}`}
                          onClick={() => removeOptionFromQuestion(qIndex, optIdx)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Input
                label="Explanation for correct answer (optional)"
                placeholder="Shown after submission when answer review is enabled"
                value={q.explanation}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, idx) =>
                      idx === qIndex
                        ? { ...item, explanation: e.target.value }
                        : item
                    )
                  )
                }
              />
            </Card>
          ))}
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link
            to="/admin/tests"
            className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Back to Tests
          </Link>
          <Button type="submit" size="lg" loading={saving}>
            {isEditing ? 'Save Test' : 'Create Test'}
          </Button>
        </div>
      </form>
    </div>
  );
}
