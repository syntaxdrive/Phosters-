import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  Circle,
  ExternalLink,
  FileDown,
  Pin,
  PinOff,
  VideoOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { accessMaterialFile, isSafeExternalHttpUrl, validateMaterialUrl } from '../../lib/materialLinks';
import { getSafeYouTubeEmbedUrl } from '../../lib/youtube';
import { fetchPublishedTestsForLesson } from '../../services/cbtService';
import { fetchLessonDetail, setLessonCompletion } from '../../services/learningService';
import type { MaterialFileType, Test } from '../../types/database';
import type { LessonDetailData } from '../../types/learning';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ErrorState, LoadingState } from '../../components/ui/States';

const fileTypeLabels: Record<MaterialFileType, string> = {
  pdf: 'PDF Document',
  image: 'Image',
  zip: 'ZIP Archive',
  other: 'Study File',
};

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const { user, profile, profileLoading } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [detail, setDetail] = useState<LessonDetailData | null>(null);
  const [attachedTests, setAttachedTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isStickyMobileVideo, setIsStickyMobileVideo] = useState(true);
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [materialNotice, setMaterialNotice] = useState<{
    tone: 'info' | 'error' | 'success';
    message: string;
  } | null>(null);

  const loadLesson = useCallback(async () => {
    if (!user || !lessonId || profileLoading) return;
    setLoading(true);
    setError(null);
    setMaterialNotice(null);

    const res = await fetchLessonDetail(user.id, lessonId, {
      allowDrafts: isAdmin,
    });
    if (res.error || !res.data) {
      setError(res.error || 'Lesson could not be loaded.');
      setLoading(false);
      return;
    }

    const testsRes = await fetchPublishedTestsForLesson(
      res.data.lesson.id,
      res.data.topic.id
    );

    setDetail(res.data);
    setAttachedTests(testsRes.tests);
    setLoading(false);
  }, [user, isAdmin, profileLoading, lessonId]);

  useEffect(() => {
    void loadLesson();
  }, [loadLesson]);

  async function handleToggleComplete() {
    if (!user || !detail) return;
    const nextState = !detail.isCompleted;
    setTogglingComplete(true);
    const { error: updateError } = await setLessonCompletion(
      user.id,
      detail.lesson.id,
      nextState
    );
    setTogglingComplete(false);

    if (!updateError) {
      setDetail((prev) => (prev ? { ...prev, isCompleted: nextState } : prev));
    }
  }

  async function handleMaterialAccess(
    materialId: string,
    title: string,
    fileType: MaterialFileType,
    fileUrl: string
  ) {
    setMaterialNotice(null);
    setDownloadingId(materialId);
    const result = await accessMaterialFile(fileUrl, title, fileType);
    setDownloadingId(null);

    if (result.error) {
      setMaterialNotice({ tone: 'error', message: result.error });
      return;
    }

    if (result.method === 'opened-direct') {
      setMaterialNotice({
        tone: 'info',
        message:
          'Opened the file directly. Some mobile browsers preview PDFs instead of saving immediately—use your browser Save or Download button if needed.',
      });
    } else {
      setMaterialNotice({
        tone: 'success',
        message: `"${title}" download started.`,
      });
    }
  }

  if (loading) {
    return <LoadingState message="Loading lesson..." />;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Lesson unavailable"
          message={error || 'This lesson could not be loaded.'}
          onRetry={() => void loadLesson()}
        />
        <div className="flex justify-center">
          <Link
            to="/app/subjects"
            className="text-sm font-semibold text-phosters-700 hover:underline"
          >
            Back to Subjects
          </Link>
        </div>
      </div>
    );
  }

  const {
    lesson,
    topic,
    exam,
    subject,
    materials,
    links,
    isCompleted,
    previousLesson,
    nextLesson,
    relatedLessons,
  } = detail;

  const embedUrl = getSafeYouTubeEmbedUrl(lesson.youtube_url);
  const safeLinks = links.filter((l) => isSafeExternalHttpUrl(l.url));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/app/subjects/${exam.slug}/${subject.slug}`}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="truncate max-w-[240px] sm:max-w-none">
            {subject.name}
          </span>
        </Link>
        {isAdmin && (
          <Link
            to={`/admin/lessons/${lesson.id}`}
            className="text-sm font-semibold text-phosters-700 dark:text-phosters-400 hover:underline shrink-0"
          >
            Edit in Admin
          </Link>
        )}
      </div>

      {isAdmin && (!topic.is_published || !lesson.is_published) && (
        <Alert tone="warning" title="Admin preview">
          {!topic.is_published && !lesson.is_published
            ? 'Both this lesson and its parent topic are drafts. Publish them in Admin before students can view this lesson.'
            : !topic.is_published
              ? 'This lesson is published, but its parent topic is still a draft. Publish the topic in Admin -> Topics so students can see it.'
              : 'This lesson is still a draft and is hidden from students.'}
        </Alert>
      )}

      {/* Video Player: sticky at top on mobile while scrolling lesson details */}
      <div
        className={[
          '-mx-4 sm:mx-0 bg-slate-950 sm:rounded-xl overflow-hidden border-b sm:border border-slate-200 dark:border-slate-800',
          isStickyMobileVideo ? 'sticky top-0 z-20 md:static' : '',
        ].join(' ')}
      >
        {embedUrl ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={embedUrl}
              title={lesson.title}
              className="w-full h-full border-0"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video w-full bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-6 text-center">
            <VideoOff className="h-8 w-8 text-slate-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-white">
              Video unavailable for this lesson
            </p>
            <p className="mt-1 text-xs text-slate-300 max-w-sm">
              {lesson.youtube_url
                ? 'The video link attached to this lesson is invalid or could not be loaded.'
                : 'No video has been attached yet. Read the lesson overview and study materials below.'}
            </p>
          </div>
        )}
      </div>

      {/* Mobile sticky pin toggle for small landscape screens */}
      <div className="flex md:hidden justify-end -mt-3">
        <button
          type="button"
          onClick={() => setIsStickyMobileVideo((v) => !v)}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          {isStickyMobileVideo ? (
            <>
              <PinOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unpin video while scrolling</span>
            </>
          ) : (
            <>
              <Pin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pin video to top</span>
            </>
          )}
        </button>
      </div>

      {/* Lesson Header & Completion Action */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-phosters-700 dark:text-phosters-400">
              <span>{exam.name}</span>
              <span aria-hidden="true">·</span>
              <span>{subject.name}</span>
              <span aria-hidden="true">·</span>
              <span>{topic.title}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {lesson.title}
            </h1>
            {lesson.tutor_name && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tutor: <span className="font-medium text-slate-900 dark:text-slate-100">{lesson.tutor_name}</span>
              </p>
            )}
          </div>

          <Button
            variant={isCompleted ? 'secondary' : 'primary'}
            onClick={handleToggleComplete}
            loading={togglingComplete}
            className="self-start shrink-0"
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-phosters-600 dark:text-phosters-400" aria-hidden="true" />
                <span>Completed</span>
              </>
            ) : (
              <>
                <Circle className="h-4 w-4" aria-hidden="true" />
                <span>Mark as Completed</span>
              </>
            )}
          </Button>
        </div>

        {(lesson.description || lesson.short_description) && (
          <Card padding="md">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lesson notes &amp; overview</h2>
            <p className="mt-2 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {lesson.description || lesson.short_description}
            </p>
          </Card>
        )}
      </section>

      {/* Learning Materials (Direct file access without exposing GitHub branding) */}
      <section aria-labelledby="materials-heading" className="space-y-3">
        <h2 id="materials-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
          Learning materials
        </h2>

        {materialNotice && (
          <Alert tone={materialNotice.tone}>{materialNotice.message}</Alert>
        )}

        {materials.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No downloadable study materials are attached to this lesson yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {materials.map((mat) => {
              const validation = validateMaterialUrl(mat.file_url);
              const isLoadingThis = downloadingId === mat.id;
              return (
                <Card
                  key={mat.id}
                  padding="sm"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{mat.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {fileTypeLabels[mat.file_type]}
                      {!validation.valid && (
                        <span className="text-red-600 dark:text-red-400"> · Link unavailable</span>
                      )}
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    disabled={!validation.valid}
                    loading={isLoadingThis}
                    onClick={() =>
                      void handleMaterialAccess(
                        mat.id,
                        mat.title,
                        mat.file_type,
                        mat.file_url
                      )
                    }
                    className="self-start sm:self-auto"
                  >
                    <FileDown className="h-4 w-4 text-phosters-700 dark:text-phosters-400" aria-hidden="true" />
                    <span>Download {mat.title}</span>
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Important Links */}
      {safeLinks.length > 0 && (
        <section aria-labelledby="links-heading" className="space-y-3">
          <h2 id="links-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Important links
          </h2>
          <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
            {safeLinks.map((linkItem) => (
              <a
                key={linkItem.id}
                href={linkItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-3.5 min-h-[48px] text-sm font-medium text-phosters-700 dark:text-phosters-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className="truncate">{linkItem.title}</span>
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              </a>
            ))}
          </Card>
        </section>
      )}

      {/* Attached Practice Tests */}
      {attachedTests.length > 0 && (
        <section aria-labelledby="tests-heading" className="space-y-3">
          <h2 id="tests-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Practice tests
          </h2>
          <div className="space-y-2.5">
            {attachedTests.map((tst) => (
              <Card
                key={tst.id}
                padding="md"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-phosters-200 dark:border-phosters-800 bg-phosters-50/40 dark:bg-phosters-900/25"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-phosters-100 dark:bg-phosters-900/70 text-phosters-700 dark:text-phosters-300 flex items-center justify-center shrink-0">
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{tst.title}</p>
                    {tst.description && (
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{tst.description}</p>
                    )}
                  </div>
                </div>
                <Link
                  to={`/app/tests/${tst.id}`}
                  className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-phosters-600 text-white text-sm font-semibold hover:bg-phosters-700 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  Take Test
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Previous & Next Lesson Navigation */}
      <nav
        aria-label="Lesson sequence navigation"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
      >
        {previousLesson ? (
          <Link
            to={`/app/lessons/${previousLesson.id}`}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-phosters-600 dark:hover:border-phosters-500 transition-colors min-h-[60px]"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-xs text-slate-500 dark:text-slate-400">Previous lesson</span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {previousLesson.title}
              </span>
            </div>
          </Link>
        ) : (
          <div className="hidden sm:block" />
        )}

        {nextLesson && (
          <Link
            to={`/app/lessons/${nextLesson.id}`}
            className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-phosters-600 dark:hover:border-phosters-500 transition-colors min-h-[60px]"
          >
            <div className="min-w-0">
              <span className="block text-xs text-slate-500 dark:text-slate-400">Next lesson</span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {nextLesson.title}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-phosters-700 dark:text-phosters-400 shrink-0" aria-hidden="true" />
          </Link>
        )}
      </nav>

      {/* Related Lessons */}
      {relatedLessons.length > 0 && (
        <section aria-labelledby="related-heading" className="space-y-3 pt-2">
          <h2 id="related-heading" className="text-base font-bold text-slate-900 dark:text-slate-100">
            Related lessons in {subject.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedLessons.map((rel) => (
              <Link
                key={rel.id}
                to={`/app/lessons/${rel.id}`}
                className="block p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-phosters-600 dark:hover:border-phosters-500 transition-colors"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rel.topicTitle}
                  {rel.isCompleted ? ' · Completed' : ''}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {rel.title}
                </p>
                {rel.short_description && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {rel.short_description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
