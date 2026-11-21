import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, BellRing, Plus, Trash2 } from 'lucide-react';
import { isSafeExternalHttpUrl, validateMaterialUrl } from '../../lib/materialLinks';
import { getSafeYouTubeEmbedUrl } from '../../lib/youtube';
import {
  fetchAllExams,
  fetchAllSubjects,
  fetchAllTopics,
  fetchLessonForEditor,
  saveLessonWithAttachments,
} from '../../services/adminService';
import { triggerPushNotification } from '../../services/pushService';
import type { LinkDraft, MaterialDraft } from '../../types/admin';
import type { Exam, MaterialFileType, Subject, Topic } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

function newLocalKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminLessonEditorPage() {
  const { lessonId } = useParams();
  const isEditing = Boolean(lessonId && lessonId !== 'new');
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');

  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [tutorName, setTutorName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isPublished, setIsPublished] = useState(false);
  const [notifyOnSave, setNotifyOnSave] = useState(false);

  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [links, setLinks] = useState<LinkDraft[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [pushNotice, setPushNotice] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);

  const loadEditor = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [examsRes, subjectsRes, topicsRes] = await Promise.all([
      fetchAllExams(),
      fetchAllSubjects(),
      fetchAllTopics(),
    ]);

    const baseErr = examsRes.error || subjectsRes.error || topicsRes.error;
    if (baseErr) {
      setLoadError(baseErr);
      setLoading(false);
      return;
    }

    setExams(examsRes.exams);
    setSubjects(subjectsRes.subjects);
    setTopics(topicsRes.topics);

    if (isEditing && lessonId) {
      const lessonRes = await fetchLessonForEditor(lessonId);
      if (lessonRes.error || !lessonRes.lesson) {
        setLoadError(lessonRes.error || 'Lesson not found.');
        setLoading(false);
        return;
      }

      const l = lessonRes.lesson;
      const parentTopic = lessonRes.topic;

      setSelectedExamId(parentTopic?.exam_id ?? examsRes.exams[0]?.id ?? '');
      setSelectedSubjectId(parentTopic?.subject_id ?? subjectsRes.subjects[0]?.id ?? '');
      setTopicId(l.topic_id);
      setTitle(l.title);
      setShortDescription(l.short_description ?? '');
      setDescription(l.description ?? '');
      setTutorName(l.tutor_name ?? '');
      setYoutubeUrl(l.youtube_url ?? '');
      setDisplayOrder(l.display_order);
      setIsPublished(l.is_published);

      setMaterials(
        lessonRes.materials.map((m) => ({
          localKey: m.id,
          id: m.id,
          title: m.title,
          file_type: m.file_type,
          file_url: m.file_url,
        }))
      );
      setLinks(
        lessonRes.links.map((lnk) => ({
          localKey: lnk.id,
          id: lnk.id,
          title: lnk.title,
          url: lnk.url,
        }))
      );
    } else {
      const firstTopic = topicsRes.topics[0];
      setSelectedExamId(firstTopic?.exam_id ?? examsRes.exams[0]?.id ?? '');
      setSelectedSubjectId(firstTopic?.subject_id ?? subjectsRes.subjects[0]?.id ?? '');
      setTopicId(firstTopic?.id ?? '');
    }

    setLoading(false);
  }, [isEditing, lessonId]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  const matchingTopics = topics.filter(
    (t) => t.exam_id === selectedExamId && t.subject_id === selectedSubjectId
  );

  function handleExamOrSubjectChange(nextExamId: string, nextSubjectId: string) {
    setSelectedExamId(nextExamId);
    setSelectedSubjectId(nextSubjectId);
    const firstMatch = topics.find(
      (t) => t.exam_id === nextExamId && t.subject_id === nextSubjectId
    );
    setTopicId(firstMatch?.id ?? '');
  }

  function addMaterial() {
    setMaterials((prev) => [
      ...prev,
      {
        localKey: newLocalKey(),
        title: '',
        file_type: 'pdf',
        file_url: '',
      },
    ]);
  }

  function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    return copy;
  }

  function addLink() {
    setLinks((prev) => [
      ...prev,
      {
        localKey: newLocalKey(),
        title: '',
        url: '',
      },
    ]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(null);
    setPushNotice(null);

    if (!topicId) {
      setFormError('Select a topic for this lesson (create one in Topics if none exist).');
      return;
    }

    if (title.trim().length < 2) {
      setFormError('Lesson title must be at least 2 characters.');
      return;
    }

    setSaving(true);
    const res = await saveLessonWithAttachments({
      id: isEditing ? lessonId : undefined,
      topic_id: topicId,
      title,
      short_description: shortDescription,
      description,
      tutor_name: tutorName,
      youtube_url: youtubeUrl,
      display_order: displayOrder,
      is_published: isPublished,
      materials,
      links,
    });
    setSaving(false);

    if (res.error || !res.lessonId) {
      setFormError(res.error || 'Could not save lesson.');
      return;
    }

    setSaveSuccess('Lesson saved.');

    if (isPublished && notifyOnSave) {
      setSendingPush(true);
      const pushRes = await triggerPushNotification({
        type: 'lesson',
        lessonId: res.lessonId,
      });
      setSendingPush(false);
      if (pushRes.error) {
        setPushNotice({ tone: 'error', message: `Lesson saved, but push failed: ${pushRes.error}` });
      } else if (pushRes.result) {
        setPushNotice({ tone: 'success', message: pushRes.result.message });
      }
      setNotifyOnSave(false);
    }

    if (!isEditing) {
      navigate(`/admin/lessons/${res.lessonId}`, { replace: true });
    }
  }

  async function handleSendLessonPush() {
    if (!lessonId || !isPublished) return;
    setPushNotice(null);
    setSendingPush(true);
    const pushRes = await triggerPushNotification({
      type: 'lesson',
      lessonId,
    });
    setSendingPush(false);
    if (pushRes.error) {
      setPushNotice({ tone: 'error', message: pushRes.error });
    } else if (pushRes.result) {
      setPushNotice({ tone: 'success', message: pushRes.result.message });
    }
  }

  if (loading) return <LoadingState message="Loading lesson editor..." />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => void loadEditor()} />;

  const safeEmbedPreview = youtubeUrl.trim()
    ? getSafeYouTubeEmbedUrl(youtubeUrl)
    : null;
  const ytInvalid = Boolean(youtubeUrl.trim()) && !safeEmbedPreview;

  const selectedTopic = topics.find((t) => t.id === topicId);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            to="/admin/lessons"
            className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Lessons</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Lesson' : 'Create Lesson'}
          </h1>
        </div>

        {isEditing && lessonId && (
          <div className="flex flex-wrap items-center gap-2">
            {isPublished && (
              <Button
                type="button"
                variant="secondary"
                loading={sendingPush}
                onClick={() => void handleSendLessonPush()}
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                <span>Notify Students</span>
              </Button>
            )}
            <Link
              to={`/app/lessons/${lessonId}`}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isPublished ? 'View in Student Portal' : 'Preview Lesson'}
            </Link>
          </div>
        )}
      </div>

      <AdminNav />

      {selectedTopic && !selectedTopic.is_published && (
        <Alert tone="info" title="Parent topic is currently a draft">
          Students will not see lessons inside &ldquo;{selectedTopic.title}&rdquo; until that topic is published under{' '}
          <Link to="/admin/topics" className="font-semibold underline">
            Admin Topics
          </Link>
          .
        </Alert>
      )}

      {formError && <Alert tone="error">{formError}</Alert>}
      {saveSuccess && <Alert tone="success">{saveSuccess}</Alert>}
      {pushNotice && <Alert tone={pushNotice.tone}>{pushNotice.message}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Placement &amp; details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                required
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
          </div>

          {matchingTopics.length === 0 && (
            <Alert tone="warning">
              No topic exists for this examination and subject yet.{' '}
              <Link to="/admin/topics" className="font-semibold underline">
                Create a topic first
              </Link>
              .
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Lesson title"
                placeholder="e.g. Newton's Laws of Motion"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <Input
              label="Tutor name (optional)"
              placeholder="e.g. Mr. Adeyemi"
              value={tutorName}
              onChange={(e) => setTutorName(e.target.value)}
            />
          </div>

          <Input
            label="Short description (optional)"
            placeholder="One-line summary shown in the topic lesson list"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Full lesson description &amp; study guide (optional)
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key concepts, formulas, and study instructions for students..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <Input
              label="Display order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
            />

            <div className="space-y-1">
              <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Published (visible to enrolled students)
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

        <Card padding="lg" className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Lesson video (YouTube)</h2>

          <Input
            label="YouTube video URL (optional)"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            error={
              ytInvalid
                ? 'Unrecognised YouTube URL. Paste a standard youtube.com/watch?v=..., youtu.be/..., or embed URL.'
                : null
            }
            hint="Supports watch, share (youtu.be), Shorts, and embed links."
          />

          {safeEmbedPreview && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-phosters-700 dark:text-phosters-400">
                Valid YouTube embed verified ({safeEmbedPreview})
              </p>
              <div className="max-w-md aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-black">
                <iframe
                  src={safeEmbedPreview}
                  title="Video preview"
                  className="w-full h-full border-0"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Learning materials (GitHub raw URLs)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload files to the Phosters-owned materials repository and paste the{' '}
                <code className="font-mono">https://raw.githubusercontent.com/...</code> URL.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addMaterial}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Material</span>
            </Button>
          </div>

          {materials.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No materials added yet.</p>
          ) : (
            <div className="space-y-3">
              {materials.map((mat, index) => {
                const urlValidation = mat.file_url.trim()
                  ? validateMaterialUrl(mat.file_url)
                  : { valid: true };
                return (
                  <div
                    key={mat.localKey}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Material #{index + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Move material up"
                          disabled={index === 0}
                          onClick={() =>
                            setMaterials((prev) => moveItem(prev, index, -1))
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move material down"
                          disabled={index === materials.length - 1}
                          onClick={() =>
                            setMaterials((prev) => moveItem(prev, index, 1))
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove material"
                          onClick={() =>
                            setMaterials((prev) =>
                              prev.filter((_, idx) => idx !== index)
                            )
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          label="Friendly title (shown to students)"
                          placeholder="e.g. Algebra Notes"
                          value={mat.title}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? { ...item, title: e.target.value }
                                  : item
                              )
                            )
                          }
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                          File type
                        </label>
                        <select
                          value={mat.file_type}
                          onChange={(e) =>
                            setMaterials((prev) =>
                              prev.map((item, idx) =>
                                idx === index
                                  ? {
                                      ...item,
                                      file_type: e.target.value as MaterialFileType,
                                    }
                                  : item
                              )
                            )
                          }
                          className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100"
                        >
                          <option value="pdf">PDF</option>
                          <option value="image">Image</option>
                          <option value="zip">ZIP</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <Input
                      label="Direct raw file URL"
                      placeholder="https://raw.githubusercontent.com/OWNER/REPO/main/path/file.pdf"
                      value={mat.file_url}
                      onChange={(e) =>
                        setMaterials((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, file_url: e.target.value }
                              : item
                          )
                        )
                      }
                      error={urlValidation.valid ? null : urlValidation.error}
                      required
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Important links (optional)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Reference websites or syllabus links for this lesson.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={addLink}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Link</span>
            </Button>
          </div>

          {links.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No important links added.</p>
          ) : (
            <div className="space-y-3">
              {links.map((lnk, index) => {
                const linkInvalid =
                  Boolean(lnk.url.trim()) && !isSafeExternalHttpUrl(lnk.url);
                return (
                  <div
                    key={lnk.localKey}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Link #{index + 1}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Move link up"
                          disabled={index === 0}
                          onClick={() =>
                            setLinks((prev) => moveItem(prev, index, -1))
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move link down"
                          disabled={index === links.length - 1}
                          onClick={() =>
                            setLinks((prev) => moveItem(prev, index, 1))
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove link"
                          onClick={() =>
                            setLinks((prev) =>
                              prev.filter((_, idx) => idx !== index)
                            )
                          }
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Link title"
                        placeholder="e.g. JAMB Syllabus Reference"
                        value={lnk.title}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? { ...item, title: e.target.value }
                                : item
                            )
                          )
                        }
                        required
                      />
                      <Input
                        label="URL"
                        placeholder="https://..."
                        value={lnk.url}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((item, idx) =>
                              idx === index
                                ? { ...item, url: e.target.value }
                                : item
                            )
                          )
                        }
                        error={
                          linkInvalid
                            ? 'Enter a valid https:// or http:// URL.'
                            : null
                        }
                        required
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Link
            to="/admin/lessons"
            className="inline-flex items-center justify-center min-h-[48px] px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Back to Lessons
          </Link>
          <Button type="submit" size="lg" loading={saving}>
            {isEditing ? 'Save Lesson' : 'Create Lesson'}
          </Button>
        </div>
      </form>
    </div>
  );
}
