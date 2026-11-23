import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  FileText,
  HardDrive,
  RefreshCw,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { accessMaterialFile } from '../../lib/materialLinks';
import { clearAllOfflineDataForUser } from '../../lib/offlineDb';
import {
  discardOfflineSyncAction,
  formatBytes,
  removeOfflineLesson,
  removeOfflineMaterial,
  removeOfflineMock,
  removeOfflineSubject,
  removeOfflineTest,
} from '../../services/offlineSyncService';
import type { MaterialFileType } from '../../types/database';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';

const FILE_TYPE_LABELS: Record<MaterialFileType, string> = {
  pdf: 'PDF Document',
  image: 'Study Image',
  zip: 'ZIP Archive',
  other: 'Study File',
};

export function OfflineLibraryPage() {
  const { user } = useAuth();
  const {
    isOnline,
    isSyncing,
    summary,
    pendingActions,
    totalBytes,
    syncMessage,
    syncError,
    refreshVault,
    syncNow,
  } = useOfflineSync();

  const [notice, setNotice] = useState<{ tone: 'info' | 'success' | 'error'; message: string } | null>(
    null
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!user) return null;

  const savedSubjects = summary?.savedSubjects ?? [];
  const savedLessons = summary?.savedLessons ?? [];
  const savedTests = summary?.savedTests ?? [];
  const savedMocks = summary?.savedMocks ?? [];
  const savedMaterials = summary?.savedMaterials ?? [];
  const hasAnySavedData =
    savedSubjects.length > 0 ||
    savedLessons.length > 0 ||
    savedTests.length > 0 ||
    savedMocks.length > 0 ||
    savedMaterials.length > 0 ||
    pendingActions.length > 0;

  async function handleSyncNow() {
    setNotice(null);
    const res = await syncNow();
    if (!res) return;
    if (res.error) {
      setNotice({ tone: 'error', message: res.error });
    } else if (res.syncedCount > 0) {
      setNotice({
        tone: 'success',
        message: `Synced ${res.syncedCount} queued ${res.syncedCount === 1 ? 'action' : 'actions'} successfully.`,
      });
    } else {
      setNotice({ tone: 'info', message: 'Everything is already synced.' });
    }
  }

  async function handleOpenMaterial(url: string, title: string, fileType: MaterialFileType) {
    if (!user) return;
    setNotice(null);
    setBusyKey(`open:${url}`);
    const result = await accessMaterialFile(url, title, fileType, { userId: user.id });
    setBusyKey(null);
    if (result.error) {
      setNotice({ tone: 'error', message: result.error });
    } else if (result.method === 'offline-cache') {
      setNotice({
        tone: 'success',
        message: `Opened "${title}" from offline device storage (0 MB mobile data used).`,
      });
    }
  }

  async function handleDiscardAction(actionId: string) {
    setBusyKey(actionId);
    await discardOfflineSyncAction(actionId);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleRemoveSubject(examSlug: string, subjectSlug: string, key: string) {
    if (!user) return;
    setBusyKey(key);
    await removeOfflineSubject(user.id, examSlug, subjectSlug);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleRemoveLesson(lessonId: string, key: string) {
    if (!user) return;
    setBusyKey(key);
    await removeOfflineLesson(user.id, lessonId);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleRemoveMaterial(url: string, key: string) {
    if (!user) return;
    setBusyKey(key);
    await removeOfflineMaterial(user.id, url);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleRemoveTest(testId: string, key: string) {
    if (!user) return;
    setBusyKey(key);
    await removeOfflineTest(user.id, testId);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleRemoveMock(attemptId: string, key: string) {
    if (!user) return;
    setBusyKey(key);
    await removeOfflineMock(user.id, attemptId);
    await refreshVault();
    setBusyKey(null);
  }

  async function handleClearAllOffline() {
    if (!user) return;
    setBusyKey('clear-all');
    await clearAllOfflineDataForUser(user.id);
    await refreshVault();
    setBusyKey(null);
    setConfirmClearAll(false);
    setNotice({
      tone: 'info',
      message: 'Cleared all saved offline lessons, study files, and cached data on this device.',
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Home</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Offline Study Library
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
              Open saved lesson notes, study PDFs, and practice tests without internet access. Your offline completions and test answers sync automatically once reconnected.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {pendingActions.length > 0 && (
              <Button
                variant="primary"
                onClick={() => void handleSyncNow()}
                loading={isSyncing}
                disabled={!isOnline}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Sync Now ({pendingActions.length})</span>
              </Button>
            )}
            <Link
              to="/app/subjects"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Browse Subjects
            </Link>
          </div>
        </div>
      </div>

      {!isOnline && (
        <Alert tone="warning" title="Studying offline">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You are currently offline. Saved items below open with zero data, and new test answers stay queued until you reconnect.
            </span>
          </span>
        </Alert>
      )}

      {(notice || syncMessage || syncError) && (
        <Alert tone={notice?.tone ?? (syncError ? 'error' : 'success')}>
          {notice?.message ?? syncError ?? syncMessage}
        </Alert>
      )}

      {/* Storage & Vault Totals */}
      <section aria-label="Offline storage summary" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Saved lessons</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {savedLessons.length}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Study PDFs &amp; files</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {savedMaterials.length}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tests &amp; mocks</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {savedTests.length + savedMocks.length}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Device storage</p>
          <p className="mt-1 text-2xl font-bold text-phosters-700 dark:text-phosters-400 tabular-nums">
            {formatBytes(totalBytes)}
          </p>
        </Card>
      </section>

      {/* Pending Sync Queue */}
      {pendingActions.length > 0 && (
        <section aria-labelledby="pending-sync-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="pending-sync-heading"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              Pending sync queue ({pendingActions.length})
            </h2>
            {isOnline && (
              <Button
                variant="secondary"
                onClick={() => void handleSyncNow()}
                loading={isSyncing}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Sync All</span>
              </Button>
            )}
          </div>

          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingActions.map((act) => {
                const when = new Date(act.createdAt).toLocaleString('en-NG', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const isTest = act.kind === 'test_submission';
                const isMock = act.kind === 'mock_submission';
                return (
                  <li
                    key={act.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {isMock
                          ? `Mock exam submission: ${act.payload.mockTitle}`
                          : isTest
                            ? `Test submission: ${act.payload.testTitle}`
                            : `Lesson progress: ${act.payload.lessonTitle || 'Lesson update'}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {isMock || isTest
                          ? `${act.payload.answeredCount} of ${act.payload.totalQuestions} questions answered · Queued ${when}`
                          : `${act.payload.isCompleted ? 'Marked completed' : 'Marked incomplete'} · Queued ${when}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      loading={busyKey === act.id}
                      onClick={() => void handleDiscardAction(act.id)}
                      className="self-start sm:self-auto text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span>Discard</span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      {!hasAnySavedData ? (
        <EmptyState
          title="No offline study packs saved yet"
          description="Open any Subject or Lesson while connected and tap 'Save Subject Offline' or 'Save Offline' to keep lesson notes, study PDFs, and CBT practice tests ready when network data is off."
          action={
            <Link
              to="/app/subjects"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors"
            >
              Open Your Subjects
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Saved Subjects */}
          {savedSubjects.length > 0 && (
            <section aria-labelledby="saved-subjects-heading" className="space-y-3">
              <h2
                id="saved-subjects-heading"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Saved subjects ({savedSubjects.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedSubjects.map((item) => (
                  <Card
                    key={item.key}
                    padding="md"
                    className="flex items-start justify-between gap-3"
                  >
                    <Link
                      to={`/app/subjects/${item.examSlug}/${item.subjectSlug}`}
                      className="min-w-0 flex-1 group"
                    >
                      <p className="text-xs font-medium text-phosters-700 dark:text-phosters-400">
                        {item.examName}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 truncate">
                        {item.subjectName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.topicCount} {item.topicCount === 1 ? 'topic' : 'topics'} ·{' '}
                        {item.lessonCount} {item.lessonCount === 1 ? 'lesson' : 'lessons'}
                      </p>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${item.subjectName} offline pack`}
                      disabled={busyKey === item.key}
                      onClick={() =>
                        void handleRemoveSubject(item.examSlug, item.subjectSlug, item.key)
                      }
                      className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Saved Lessons */}
          {savedLessons.length > 0 && (
            <section aria-labelledby="saved-lessons-heading" className="space-y-3">
              <h2
                id="saved-lessons-heading"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Saved lessons &amp; notes ({savedLessons.length})
              </h2>
              <Card padding="none" className="overflow-hidden">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedLessons.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <Link
                        to={`/app/lessons/${item.lessonId}`}
                        className="flex items-start gap-3 min-w-0 flex-1 group"
                      >
                        <BookOpen
                          className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 truncate">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate tabular-nums">
                            {item.examName} · {item.subjectName} · {item.topicTitle}
                            {item.materialsCount > 0 ? ` · ${item.materialsCount} files` : ''}
                            {item.attachedTestsCount > 0 ? ` · ${item.attachedTestsCount} tests` : ''}
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${item.title} from offline lessons`}
                        disabled={busyKey === item.key}
                        onClick={() => void handleRemoveLesson(item.lessonId, item.key)}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Saved Materials */}
          {savedMaterials.length > 0 && (
            <section aria-labelledby="saved-materials-heading" className="space-y-3">
              <h2
                id="saved-materials-heading"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                Saved study PDFs &amp; files ({savedMaterials.length})
              </h2>
              <Card padding="none" className="overflow-hidden">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedMaterials.map((mat) => (
                    <li
                      key={mat.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText
                          className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {mat.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {FILE_TYPE_LABELS[mat.fileType]} · {formatBytes(mat.sizeBytes)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <Button
                          variant="secondary"
                          loading={busyKey === `open:${mat.url}`}
                          onClick={() =>
                            void handleOpenMaterial(mat.url, mat.title, mat.fileType)
                          }
                        >
                          <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          <span>Open File</span>
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete ${mat.title} from offline storage`}
                          disabled={busyKey === mat.key}
                          onClick={() => void handleRemoveMaterial(mat.url, mat.key)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Saved CBT Practice Tests */}
          {savedTests.length > 0 && (
            <section aria-labelledby="saved-tests-heading" className="space-y-3">
              <div className="space-y-0.5">
                <h2
                  id="saved-tests-heading"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Offline practice tests ({savedTests.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Test questions stay ready on your device. Answer keys are never stored offline; completed tests are graded securely once synced.
                </p>
              </div>
              <Card padding="none" className="overflow-hidden">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedTests.map((tst) => (
                    <li
                      key={tst.key}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <Link
                        to={`/app/tests/${tst.testId}`}
                        className="flex items-start gap-3 min-w-0 flex-1 group"
                      >
                        <CheckSquare
                          className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 truncate">
                            {tst.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {tst.questionCount}{' '}
                            {tst.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                            {tst.pinned ? 'Saved for offline' : 'Cached'}
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${tst.title} offline copy`}
                        disabled={busyKey === tst.key}
                        onClick={() => void handleRemoveTest(tst.testId, tst.key)}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Saved CBT Mock Papers */}
          {savedMocks.length > 0 && (
            <section aria-labelledby="saved-mocks-heading" className="space-y-3">
              <div className="space-y-0.5">
                <h2
                  id="saved-mocks-heading"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Offline 4-subject mock papers ({savedMocks.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Full timed mock exams saved on your device. Answer keys are never stored offline.
                </p>
              </div>
              <Card padding="none" className="overflow-hidden">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {savedMocks.map((mock) => (
                    <li
                      key={mock.key}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <Link
                        to={`/app/mocks/${mock.attemptId}`}
                        className="flex items-start gap-3 min-w-0 flex-1 group"
                      >
                        <CheckSquare
                          className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-phosters-700 dark:group-hover:text-phosters-400 truncate">
                            {mock.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {mock.examName} · {mock.subjectCount} subjects · {mock.questionCount}{' '}
                            questions · {mock.durationMinutes} mins
                          </p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${mock.title} offline paper`}
                        disabled={busyKey === mock.key}
                        onClick={() => void handleRemoveMock(mock.attemptId, mock.key)}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* Clear Storage Control */}
          <Card padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                <HardDrive className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Manage device storage
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {pendingActions.length > 0
                    ? `Free up ${formatBytes(totalBytes)} on this device. Clearing will also remove ${pendingActions.length} unsynced action(s).`
                    : `Currently using ${formatBytes(totalBytes)} of offline browser storage on this device.`}
                </p>
              </div>
            </div>

            {!confirmClearAll ? (
              <Button
                variant="secondary"
                onClick={() => setConfirmClearAll(true)}
                className="self-start sm:self-auto shrink-0"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Clear Offline Data</span>
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmClearAll(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={busyKey === 'clear-all'}
                  onClick={() => void handleClearAllOffline()}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Confirm Clear All</span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
