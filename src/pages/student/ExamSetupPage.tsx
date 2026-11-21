import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  fetchActiveExamsWithSubjects,
  fetchStudentEnrollments,
  saveStudentExamSelections,
  type ExamSelectionDraft,
} from '../../services/learningService';
import type { ExamWithSubjects } from '../../types/learning';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

type LocalExamDraft = {
  enabled: boolean;
  intendedCourse: string;
  institution: string;
  subjectIds: string[];
};

export function ExamSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exams, setExams] = useState<ExamWithSubjects[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LocalExamDraft>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);

    const [examsRes, enrollRes] = await Promise.all([
      fetchActiveExamsWithSubjects(),
      fetchStudentEnrollments(user.id),
    ]);

    if (examsRes.error) {
      setLoadError(examsRes.error);
      setLoading(false);
      return;
    }

    if (enrollRes.error) {
      setLoadError(enrollRes.error);
      setLoading(false);
      return;
    }

    const enrollmentByExamId = new Map(
      enrollRes.enrollments.map((e) => [e.exam.id, e])
    );

    const nextDrafts: Record<string, LocalExamDraft> = {};
    for (const exam of examsRes.exams) {
      const existing = enrollmentByExamId.get(exam.id);
      const compulsoryIds = exam.availableSubjects
        .filter((s) => s.isCompulsory)
        .map((s) => s.subjectId);

      const initialSubjectIds = existing
        ? Array.from(
            new Set([
              ...compulsoryIds,
              ...existing.selectedSubjects.map((s) => s.id),
            ])
          )
        : compulsoryIds;

      nextDrafts[exam.id] = {
        enabled: Boolean(existing),
        intendedCourse: existing?.intendedCourse ?? '',
        institution: existing?.institution ?? '',
        subjectIds: initialSubjectIds,
      };
    }

    setExams(examsRes.exams);
    setDrafts(nextDrafts);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function toggleExam(exam: ExamWithSubjects) {
    setFormError(null);
    setSaveSuccess(false);
    setDrafts((prev) => {
      const current = prev[exam.id];
      const nextEnabled = !current?.enabled;
      const compulsoryIds = exam.availableSubjects
        .filter((s) => s.isCompulsory)
        .map((s) => s.subjectId);

      return {
        ...prev,
        [exam.id]: {
          enabled: nextEnabled,
          intendedCourse: current?.intendedCourse ?? '',
          institution: current?.institution ?? '',
          subjectIds:
            nextEnabled && (current?.subjectIds.length ?? 0) === 0
              ? compulsoryIds
              : current?.subjectIds ?? compulsoryIds,
        },
      };
    });
  }

  function toggleSubject(exam: ExamWithSubjects, subjectId: string, isCompulsory: boolean) {
    if (isCompulsory) return;
    setFormError(null);
    setSaveSuccess(false);

    setDrafts((prev) => {
      const current = prev[exam.id];
      if (!current) return prev;

      const exists = current.subjectIds.includes(subjectId);
      const nextIds = exists
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId];

      return {
        ...prev,
        [exam.id]: {
          ...current,
          subjectIds: nextIds,
        },
      };
    });
  }

  function copyJambSubjectsToUi(uiExam: ExamWithSubjects) {
    const jambExam = exams.find((e) => e.slug === 'jamb-utme');
    if (!jambExam) return;
    const jambDraft = drafts[jambExam.id];
    if (!jambDraft || jambDraft.subjectIds.length === 0) return;

    const uiAvailableIds = new Set(uiExam.availableSubjects.map((s) => s.subjectId));
    const compulsoryUiIds = uiExam.availableSubjects
      .filter((s) => s.isCompulsory)
      .map((s) => s.subjectId);

    const copied = jambDraft.subjectIds.filter((id) => uiAvailableIds.has(id));
    const merged = Array.from(new Set([...compulsoryUiIds, ...copied]));

    setFormError(null);
    setSaveSuccess(false);
    setDrafts((prev) => ({
      ...prev,
      [uiExam.id]: {
        ...prev[uiExam.id],
        subjectIds: merged,
      },
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setFormError(null);
    setSaveSuccess(false);

    const enabledExams = exams.filter((exam) => drafts[exam.id]?.enabled);
    if (enabledExams.length === 0) {
      setFormError('Select at least one examination (JAMB UTME or UI Post-UTME).');
      return;
    }

    const payload: ExamSelectionDraft[] = [];

    for (const exam of enabledExams) {
      const draft = drafts[exam.id];
      if (exam.slug === 'jamb-utme') {
        if (draft.subjectIds.length !== 4) {
          setFormError(
            `For JAMB UTME, select English Language plus 3 other subjects (currently ${draft.subjectIds.length} of 4 selected).`
          );
          return;
        }
      } else if (draft.subjectIds.length === 0) {
        setFormError(`Select at least one subject for ${exam.name}.`);
        return;
      }

      payload.push({
        examId: exam.id,
        intendedCourse: draft.intendedCourse,
        institution: draft.institution,
        subjectIds: draft.subjectIds,
      });
    }

    setSaving(true);
    const { error } = await saveStudentExamSelections(user.id, payload);
    setSaving(false);

    if (error) {
      setFormError(error);
      return;
    }

    setSaveSuccess(true);
    navigate('/app', { replace: true });
  }

  if (loading) {
    return <LoadingState message="Loading examination options..." />;
  }

  if (loadError) {
    return <ErrorState message={loadError} onRetry={() => void loadData()} />;
  }

  const jambExam = exams.find((e) => e.slug === 'jamb-utme');
  const jambEnabled = jambExam ? Boolean(drafts[jambExam.id]?.enabled) : false;
  const jambSubjectCount = jambExam ? drafts[jambExam.id]?.subjectIds.length ?? 0 : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Examination &amp; subject selection
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Choose JAMB UTME, UI Post-UTME, or both. Your subject choices are saved separately for each examination.
        </p>
      </div>

      {formError && <Alert tone="error">{formError}</Alert>}
      {saveSuccess && (
        <Alert tone="success">Your examination profiles and subjects have been saved.</Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {exams.map((exam) => {
          const draft = drafts[exam.id] ?? {
            enabled: false,
            intendedCourse: '',
            institution: '',
            subjectIds: [],
          };
          const isJamb = exam.slug === 'jamb-utme';
          const isUiPostUtme = exam.slug === 'ui-post-utme';

          return (
            <Card key={exam.id} padding="lg" className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{exam.name}</h2>
                  {exam.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{exam.description}</p>
                  )}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.enabled}
                  onClick={() => toggleExam(exam)}
                  className={[
                    'min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold border transition-colors shrink-0 cursor-pointer',
                    draft.enabled
                      ? 'bg-phosters-600 text-white border-phosters-600 hover:bg-phosters-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {draft.enabled ? 'Selected' : 'Select'}
                </button>
              </div>

              {draft.enabled && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Intended course / programme (optional)"
                      placeholder="e.g. Medicine, Law, Computer Science"
                      value={draft.intendedCourse}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [exam.id]: { ...prev[exam.id], intendedCourse: e.target.value },
                        }))
                      }
                    />
                    {isJamb && (
                      <Input
                        label="First-choice institution (optional)"
                        placeholder="e.g. University of Ibadan"
                        value={draft.institution}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [exam.id]: { ...prev[exam.id], institution: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Subjects for {exam.name}{' '}
                          <span className="font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                            ({draft.subjectIds.length}
                            {isJamb ? ' / 4' : ''} selected)
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isJamb
                            ? 'English Language is included automatically. Pick 3 additional subjects.'
                            : 'Select the subjects required for your UI Post-UTME course.'}
                        </p>
                      </div>

                      {isUiPostUtme && jambEnabled && jambSubjectCount > 0 && (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => copyJambSubjectsToUi(exam)}
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          <span>Copy JAMB subjects</span>
                        </Button>
                      )}
                    </div>

                    {exam.availableSubjects.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No subjects have been configured for this examination yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {exam.availableSubjects.map((opt) => {
                          const checked = draft.subjectIds.includes(opt.subjectId);
                          return (
                            <button
                              key={opt.examSubjectId}
                              type="button"
                              disabled={opt.isCompulsory}
                              onClick={() =>
                                toggleSubject(exam, opt.subjectId, opt.isCompulsory)
                              }
                              aria-pressed={checked}
                              className={[
                                'flex items-center justify-between gap-3 min-h-[48px] px-3.5 py-2.5 rounded-lg border text-left transition-colors',
                                opt.isCompulsory ? 'cursor-default' : 'cursor-pointer',
                                checked
                                  ? 'bg-phosters-50 dark:bg-phosters-900/40 border-phosters-600 dark:border-phosters-500 text-slate-900 dark:text-slate-100'
                                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                              ].join(' ')}
                            >
                              <div className="min-w-0">
                                <span className="block text-sm font-medium truncate">
                                  {opt.subject.name}
                                </span>
                                {opt.isCompulsory && (
                                  <span className="block text-xs text-phosters-700 dark:text-phosters-400">
                                    Compulsory
                                  </span>
                                )}
                              </div>
                              <span
                                aria-hidden="true"
                                className={[
                                  'h-5 w-5 rounded border flex items-center justify-center shrink-0',
                                  checked
                                    ? 'bg-phosters-600 border-phosters-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800',
                                ].join(' ')}
                              >
                                {checked && <Check className="h-3.5 w-3.5" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link
            to="/app"
            className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <Button type="submit" size="lg" loading={saving}>
            Save Examination Profile
          </Button>
        </div>
      </form>
    </div>
  );
}
