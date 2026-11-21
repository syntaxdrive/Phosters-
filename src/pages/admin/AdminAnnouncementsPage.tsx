import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Pin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSafeExternalHttpUrl } from '../../lib/materialLinks';
import {
  deleteAdminAnnouncement,
  fetchAdminAnnouncements,
  saveAdminAnnouncement,
  updateAnnouncementFlags,
} from '../../services/announcementService';
import type {
  AnnouncementFeedItem,
  AnnouncementLinkDraft,
} from '../../types/announcement';
import type { AnnouncementAudienceType, Exam, Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminAnnouncementsPage() {
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Composer state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audienceType, setAudienceType] = useState<AnnouncementAudienceType>('all');
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [links, setLinks] = useState<AnnouncementLinkDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAdminAnnouncements();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setAnnouncements(res.announcements);
    setExams(res.exams);
    setSubjects(res.subjects);

    if (res.exams.length > 0) {
      setExamId((prev) => prev || res.exams[0].id);
    }
    if (res.subjects.length > 0) {
      setSubjectId((prev) => prev || res.subjects[0].id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function resetForm() {
    setEditingId(undefined);
    setTitle('');
    setMessage('');
    setAudienceType('all');
    setIsPinned(false);
    setIsPublished(true);
    setLinks([]);
    setFormError(null);
  }

  function startEdit(item: AnnouncementFeedItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setMessage(item.message);
    setAudienceType(item.audience_type);
    if (item.exam_id) setExamId(item.exam_id);
    if (item.subject_id) setSubjectId(item.subject_id);
    setIsPinned(item.is_pinned);
    setIsPublished(item.is_published);
    setLinks(
      item.links.map((l) => ({
        localKey: l.id,
        title: l.title,
        url: l.url,
      }))
    );
    setFormError(null);
    setFormSuccess(null);
  }

  function addLinkRow() {
    setLinks((prev) => [...prev, { localKey: newKey(), title: '', url: '' }]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (title.trim().length < 2) {
      setFormError('Title must be at least 2 characters.');
      return;
    }
    if (message.trim().length < 2) {
      setFormError('Message body is required.');
      return;
    }

    for (let i = 0; i < links.length; i++) {
      if (!links[i].title.trim()) {
        setFormError(`Link #${i + 1} needs a label.`);
        return;
      }
      if (!isSafeExternalHttpUrl(links[i].url)) {
        setFormError(`Link #${i + 1} must be a valid https:// or http:// URL.`);
        return;
      }
    }

    setSaving(true);
    const res = await saveAdminAnnouncement({
      id: editingId,
      title,
      message,
      audience_type: audienceType,
      exam_id: audienceType === 'all' ? null : examId || null,
      subject_id: audienceType === 'exam_subject' ? subjectId || null : null,
      is_pinned: isPinned,
      is_published: isPublished,
      created_by: user?.id ?? null,
      links,
    });
    setSaving(false);

    if (res.error) {
      setFormError(res.error);
      return;
    }

    setFormSuccess(
      editingId ? 'Announcement updated.' : 'Announcement broadcast published.'
    );
    resetForm();
    await loadData();
  }

  async function handleToggleFlag(
    item: AnnouncementFeedItem,
    patch: { is_published?: boolean; is_pinned?: boolean }
  ) {
    setFormError(null);
    const res = await updateAnnouncementFlags(item.id, patch);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    await loadData();
  }

  async function handleDelete(announcementId: string) {
    setFormError(null);
    const res = await deleteAdminAnnouncement(announcementId);
    setConfirmDeleteId(null);
    if (res.error) {
      setFormError(res.error);
      return;
    }
    if (editingId === announcementId) resetForm();
    await loadData();
  }

  if (loading) return <LoadingState message="Loading announcements..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadData()} />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Announcements &amp; Broadcasts
        </h1>
        <p className="text-sm text-slate-600">
          Broadcast messages, live class schedules, and important links to all students or specific examination/subject cohorts.
        </p>
      </div>

      <AdminNav />

      {formError && <Alert tone="error">{formError}</Alert>}
      {formSuccess && <Alert tone="success">{formSuccess}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <Card padding="lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit broadcast' : 'New broadcast'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-phosters-700 hover:underline cursor-pointer"
                >
                  + New instead
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Input
                label="Headline"
                placeholder="e.g. Live Physics Revision Class on Saturday"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Message
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the announcement details for students..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900">
                  Target audience
                </label>
                <select
                  value={audienceType}
                  onChange={(e) =>
                    setAudienceType(e.target.value as AnnouncementAudienceType)
                  }
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="all">All students</option>
                  <option value="exam">Students in a specific examination</option>
                  <option value="exam_subject">
                    Students enrolled in a specific exam &amp; subject
                  </option>
                </select>
              </div>

              {audienceType !== 'all' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-900">
                    Examination
                  </label>
                  <select
                    value={examId}
                    onChange={(e) => setExamId(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {audienceType === 'exam_subject' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-900">
                    Subject
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                  >
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900">
                    Attached links (optional)
                  </span>
                  <button
                    type="button"
                    onClick={addLinkRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-phosters-700 hover:underline cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add link</span>
                  </button>
                </div>

                {links.map((lnk, idx) => (
                  <div
                    key={lnk.localKey}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">
                        Link #{idx + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove link ${idx + 1}`}
                        onClick={() =>
                          setLinks((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-xs font-medium text-red-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Button label (e.g. Join Live Session)"
                      value={lnk.title}
                      onChange={(e) =>
                        setLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      required
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={lnk.url}
                      onChange={(e) =>
                        setLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, url: e.target.value } : item
                          )
                        )
                      }
                      className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Pin announcement to top
                  </span>
                </label>

                <label className="flex items-center gap-2.5 min-h-[40px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-phosters-600 focus:ring-phosters-600"
                  />
                  <span className="text-sm font-medium text-slate-800">
                    Published (visible to target students immediately)
                  </span>
                </label>
              </div>

              <Button type="submit" fullWidth loading={saving}>
                {editingId ? 'Save Changes' : 'Publish Broadcast'}
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {announcements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Create your first broadcast message on the left to share updates, class schedules, or helpful study links with students."
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Broadcast history
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {announcements.length} total
                </span>
              </div>

              <ul className="divide-y divide-slate-100">
                {announcements.map((item) => {
                  const isConfirming = confirmDeleteId === item.id;
                  const dateLabel = new Date(item.created_at).toLocaleDateString(
                    'en-NG',
                    { year: 'numeric', month: 'short', day: 'numeric' }
                  );
                  return (
                    <li key={item.id} className="p-4 sm:p-5 space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                          {item.is_pinned && (
                            <>
                              <span className="inline-flex items-center gap-1 font-semibold text-phosters-800">
                                <Pin className="h-3 w-3" aria-hidden="true" />
                                <span>Pinned</span>
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="font-medium text-slate-700">
                            {item.audienceLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{dateLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              item.is_published
                                ? 'font-medium text-phosters-700'
                                : 'font-medium text-amber-700'
                            }
                          >
                            {item.is_published ? 'Published' : 'Draft'}
                          </span>
                        </div>

                        <p className="text-base font-semibold text-slate-900">
                          {item.title}
                        </p>

                        <p className="text-sm text-slate-600 whitespace-pre-line">
                          {item.message}
                        </p>

                        {item.links.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-2">
                            {item.links.map((lnk) => (
                              <a
                                key={lnk.id}
                                href={lnk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-phosters-700 hover:underline"
                              >
                                <span>{lnk.title}</span>
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void handleToggleFlag(item, { is_pinned: !item.is_pinned })
                          }
                        >
                          {item.is_pinned ? 'Unpin' : 'Pin'}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            void handleToggleFlag(item, {
                              is_published: !item.is_published,
                            })
                          }
                        >
                          {item.is_published ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button variant="secondary" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.title}`}
                          onClick={() =>
                            setConfirmDeleteId(isConfirming ? null : item.id)
                          }
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      {isConfirming && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                          <span>Delete this announcement permanently?</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => void handleDelete(item.id)}
                            >
                              Delete Broadcast
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
