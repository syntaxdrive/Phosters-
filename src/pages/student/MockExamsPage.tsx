import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Play,
  Settings2,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import {
  fetchStudentMockHub,
  startMockExamSession,
  type StudentMockHubData,
} from '../../services/mockExamService';
import { getUiPostUtmeScore100, isUiPostUtmeExam } from '../../data/admissionGuide';
import type { MockExamMode } from '../../types/cbt';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

export function MockExamsPage() {
  const { user } = useAuth();
  const { isOnline, summary, refreshVault } = useOfflineSync();
  const navigate = useNavigate();

  const [hub, setHub] = useState<StudentMockHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launchingKey, setLaunchingKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(
    null
  );

  const loadHub = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const res = await fetchStudentMockHub(user.id);
    setHub(res);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  async function handleStartMock(params: {
    key: string;
    examId: string;
    mockExamId?: string | null;
    mode: MockExamMode;
    pinOffline?: boolean;
  }) {
    if (!user) return;
    setNotice(null);
    setLaunchingKey(params.key);

    const res = await startMockExamSession({
      examId: params.examId,
      mockExamId: params.mockExamId,
      mode: params.mode,
      studentId: user.id,
      pinOffline: params.pinOffline,
    });

    setLaunchingKey(null);

    if (res.error || !res.session) {
      setNotice({
        tone: 'error',
        message: res.error || 'Could not start mock exam session.',
      });
      return;
    }

    if (params.pinOffline) {
      await refreshVault();
      setNotice({
        tone: 'success',
        message: `"${res.session.title}" (${res.session.total_questions} questions across ${res.session.sections.length} subjects) is saved on this device for offline practice.`,
      });
      return;
    }

    navigate(`/app/mocks/${res.session.attempt_id}`);
  }

  if (loading) {
    return <LoadingState message="Loading CBT Mock Exam Center..." />;
  }

  if (hub?.error) {
    return <ErrorState message={hub.error} onRetry={() => void loadHub()} />;
  }

  const enrollments = hub?.enrollments ?? [];
  const savedMocks = summary?.savedMocks ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            4-Subject CBT Mock Center
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
            Sit full timed JAMB UTME (120 mins · /400 scale) and UI Post-UTME (90 mins · /100 scale · no calculator) CBT mocks built dynamically from your 4 chosen subjects.
          </p>
        </div>

        <Link
          to="/app/setup-exams"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <Settings2 className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
          <span>Edit Subject Combination</span>
        </Link>
      </div>

      {!isOnline && (
        <Alert tone="warning" title="Offline mode active">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You are offline. You can sit any saved offline mock paper below; answers queue automatically and grade on the server once reconnected.
            </span>
          </span>
        </Alert>
      )}

      {hub?.migrationMissing && (
        <Alert tone="info" title="Mock Exam database setup required">
          Ask your Super Administrator to run{' '}
          <code className="font-mono text-xs">supabase/migrations/012a–012d</code>{' '}
          (in order) in the Supabase SQL Editor to enable 4-subject mock sittings and JAMB /400 scoring.
        </Alert>
      )}

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      {savedMocks.length > 0 && (
        <section aria-labelledby="saved-offline-mocks-heading" className="space-y-3">
          <h2
            id="saved-offline-mocks-heading"
            className="text-lg font-bold text-slate-900 dark:text-slate-100"
          >
            Ready to take offline ({savedMocks.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedMocks.map((mock) => (
              <Card key={mock.key} padding="md" className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-phosters-700 dark:text-phosters-400">
                    {mock.examName} · Offline Paper
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {mock.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {mock.subjectCount} subjects · {mock.questionCount} questions · {mock.durationMinutes} mins
                  </p>
                </div>
                <Link
                  to={`/app/mocks/${mock.attemptId}`}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors shrink-0"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Start</span>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      {enrollments.length === 0 ? (
        <EmptyState
          title="No examination selected yet"
          description="Select JAMB UTME (4 subjects) or UI Post-UTME in your profile setup before launching a mock exam."
          action={
            <Link
              to="/app/setup-exams"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Choose Examinations &amp; 4 Subjects
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {enrollments.map((enr) => {
            const isJamb = enr.exam.slug === 'jamb-utme';
            const isUiPostUtme = enr.exam.slug === 'ui-post-utme';
            const requiresFour = isJamb || isUiPostUtme;
            const readinessList = hub?.readinessByExamId.get(enr.exam.id) ?? [];
            const readinessMap = new Map(readinessList.map((r) => [r.subject_id, r]));
            const examPublishedMocks = (hub?.publishedMocks ?? []).filter(
              (m) => m.exam_id === enr.exam.id
            );

            const hasValidSubjects = requiresFour
              ? enr.selectedSubjects.length === 4
              : enr.selectedSubjects.length >= 1;

            const totalBankReady = enr.selectedSubjects.reduce(
              (acc, subj) => acc + (readinessMap.get(subj.id)?.approved_text_count ?? 0),
              0
            );

            return (
              <Card key={enr.profileId} padding="lg" className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {enr.exam.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      {isJamb
                        ? 'Standard CBT: 60 Use of English + 40 × 3 Electives (180 Qs max · 120 mins · /400 scoring)'
                        : isUiPostUtme
                          ? 'Standard UI CBT: 25 Qs × 4 Subjects (100 Qs · 90 mins · /100 scoring · No Calculator)'
                          : 'Timed Multi-Subject CBT Mock'}
                      {enr.intendedCourse ? ` · ${enr.intendedCourse}` : ''}
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                    {enr.selectedSubjects.length}{' '}
                    {enr.selectedSubjects.length === 1 ? 'subject' : 'subjects'} selected
                  </div>
                </div>

                {!hasValidSubjects ? (
                  <Alert tone="warning" title="Complete your 4-subject combination">
                    {enr.exam.name} mock exams require Use of English plus 3 elective subjects (currently{' '}
                    {enr.selectedSubjects.length} selected).{' '}
                    <Link
                      to="/app/setup-exams"
                      className="font-semibold underline hover:text-phosters-700 dark:hover:text-phosters-300"
                    >
                      Update subject combination
                    </Link>
                    .
                  </Alert>
                ) : (
                  <>
                    {/* 4-Subject Combination Readiness Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {enr.selectedSubjects.map((subj) => {
                        const r = readinessMap.get(subj.id);
                        const readyCount = r?.approved_text_count ?? 0;
                        const targetCount = isJamb
                          ? subj.slug === 'english-language'
                            ? 60
                            : 40
                          : 25;

                        return (
                          <div
                            key={subj.id}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 space-y-1"
                          >
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {subj.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                              Target: {targetCount} Qs
                            </p>
                            <p className="text-xs font-medium text-phosters-700 dark:text-phosters-400 tabular-nums">
                              {hub?.migrationMissing
                                ? 'Bank pending SQL setup'
                                : readyCount > 0
                                  ? `${readyCount} bank Qs ready`
                                  : 'Awaiting bank questions'}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Launch Controls */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Button
                        variant="primary"
                        size="lg"
                        disabled={!isOnline || Boolean(hub?.migrationMissing) || totalBankReady === 0}
                        loading={launchingKey === `full:${enr.exam.id}`}
                        onClick={() =>
                          void handleStartMock({
                            key: `full:${enr.exam.id}`,
                            examId: enr.exam.id,
                            mode: 'full_mock',
                          })
                        }
                      >
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {isJamb
                            ? 'Start Full 4-Subject Mock (120 mins)'
                            : isUiPostUtme
                              ? 'Start Full UI Post-UTME Mock (90 mins)'
                              : 'Start Timed CBT Mock'}
                        </span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="lg"
                        disabled={!isOnline || Boolean(hub?.migrationMissing) || totalBankReady === 0}
                        loading={launchingKey === `mini:${enr.exam.id}`}
                        onClick={() =>
                          void handleStartMock({
                            key: `mini:${enr.exam.id}`,
                            examId: enr.exam.id,
                            mode: 'mini_mock',
                          })
                        }
                      >
                        <Zap className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                        <span>Quick 4-Subject Mini Mock (30 mins)</span>
                      </Button>

                      <Button
                        variant="secondary"
                        disabled={!isOnline || Boolean(hub?.migrationMissing) || totalBankReady === 0}
                        loading={launchingKey === `offline:${enr.exam.id}`}
                        onClick={() =>
                          void handleStartMock({
                            key: `offline:${enr.exam.id}`,
                            examId: enr.exam.id,
                            mode: 'full_mock',
                            pinOffline: true,
                          })
                        }
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Save Offline Paper</span>
                      </Button>
                    </div>

                    {totalBankReady === 0 && !hub?.migrationMissing && isOnline && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Note: Dynamic practice mocks draw from approved Question Bank items for your selected subjects. Published tutor mock exams below can also include custom tutor-authored questions.
                      </p>
                    )}

                    {/* Tutor Published Mock Exams for this Exam */}
                    {examPublishedMocks.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Published Tutor Mock Exams
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {examPublishedMocks.map((mock) => (
                            <div
                              key={mock.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900"
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {mock.title}
                                </p>
                                {mock.description && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {mock.description}
                                  </p>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {mock.duration_minutes} mins · {mock.english_question_count} Eng +{' '}
                                  {mock.other_subject_question_count}/subject
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="secondary"
                                  disabled={!isOnline}
                                  loading={launchingKey === `pin:${mock.id}`}
                                  onClick={() =>
                                    void handleStartMock({
                                      key: `pin:${mock.id}`,
                                      examId: enr.exam.id,
                                      mockExamId: mock.id,
                                      mode: 'published_mock',
                                      pinOffline: true,
                                    })
                                  }
                                >
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                  <span>Offline</span>
                                </Button>
                                <Button
                                  variant="primary"
                                  disabled={!isOnline}
                                  loading={launchingKey === `pub:${mock.id}`}
                                  onClick={() =>
                                    void handleStartMock({
                                      key: `pub:${mock.id}`,
                                      examId: enr.exam.id,
                                      mockExamId: mock.id,
                                      mode: 'published_mock',
                                    })
                                  }
                                >
                                  <span>Start</span>
                                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Past Graded Mock Attempts */}
      {(hub?.attempts.length ?? 0) > 0 && (
        <section aria-labelledby="past-mocks-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="past-mocks-heading"
              className="text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              Past Mock Exam Scores
            </h2>
            <Link
              to="/app/results"
              className="text-sm font-semibold text-phosters-700 dark:text-phosters-400 hover:underline"
            >
              All results
            </Link>
          </div>

          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {hub?.attempts.map((att) => {
                const when = att.submitted_at
                  ? new Date(att.submitted_at).toLocaleDateString('en-NG', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';
                const isUi = isUiPostUtmeExam(att.exam_slug, att.exam_name, att.title);
                const uiScore = getUiPostUtmeScore100(att.percentage);
                return (
                  <li key={att.id}>
                    <Link
                      to={`/app/mocks/results/${att.id}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {att.title}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {when} · {att.total_correct}/{att.total_questions} correct (
                          {Math.round(att.percentage)}%)
                        </p>
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0 pl-6 sm:pl-0">
                        <span className="text-lg font-bold text-phosters-700 dark:text-phosters-400 tabular-nums">
                          {isUi ? uiScore : att.total_score_400}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {isUi ? '/ 100' : '/ 400'}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
