import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdminUser } from '../../lib/superAdmin';
import {
  OFFICIAL_JAMB_SUBJECTS,
  getMissingOfficialJambSubjects,
} from '../../lib/jambSubjects';
import {
  fetchAllSubjects,
  saveSubject,
  syncOfficialJambSubjects,
} from '../../services/adminService';
import { slugify } from '../../lib/slug';
import type { Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminSubjectsPage() {
  const { user, profile } = useAuth();
  const isSuperAdmin = isSuperAdminUser(user?.email, profile?.role);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingJamb, setSyncingJamb] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchAllSubjects();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setSubjects(res.subjects);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  function resetForm() {
    setEditingId(undefined);
    setName('');
    setSlug('');
    setDescription('');
    setIsActive(true);
    setFormError(null);
  }

  function startEdit(subject: Subject) {
    setEditingId(subject.id);
    setName(subject.name);
    setSlug(subject.slug);
    setDescription(subject.description ?? '');
    setIsActive(subject.is_active);
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (name.trim().length < 2) {
      setFormError('Subject name must be at least 2 characters.');
      return;
    }

    const finalSlug = slugify(slug || name);
    if (!finalSlug) {
      setFormError('Enter a valid slug for this subject.');
      return;
    }

    setSaving(true);
    const res = await saveSubject({
      id: editingId,
      name,
      slug: finalSlug,
      description,
      is_active: isActive,
    });
    setSaving(false);

    if (res.error || !res.subject) {
      setFormError(res.error || 'Could not save subject.');
      return;
    }

    setFormSuccess(`Saved "${res.subject.name}".`);
    resetForm();
    await loadSubjects();
  }

  async function handleSyncOfficialJamb() {
    setFormError(null);
    setFormSuccess(null);
    setSyncingJamb(true);
    const res = await syncOfficialJambSubjects();
    setSyncingJamb(false);

    if (res.error) {
      setFormError(res.error);
      return;
    }

    if (res.subjectsCreated === 0 && res.linksCreated === 0) {
      setFormSuccess(
        `All ${res.totalOfficialCount} official JAMB UTME subjects are already added and linked to JAMB UTME & UI Post-UTME.`
      );
    } else {
      setFormSuccess(
        `Synced official JAMB UTME subjects: ${res.subjectsCreated} subject(s) added and ${res.linksCreated} examination mapping(s) linked.`
      );
    }
    await loadSubjects();
  }

  const missingOfficial = useMemo(
    () => getMissingOfficialJambSubjects(subjects),
    [subjects]
  );

  const filteredSubjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  }, [subjects, searchQuery]);

  if (loading) return <LoadingState message="Loading subjects..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadSubjects()} />;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Subjects</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Create and edit subjects available across Phosters examinations.
        </p>
      </div>

      <AdminNav />

      {!isSuperAdmin && (
        <Alert tone="info" title="Super Admin only">
          Global subjects are managed by the Super Admin (<code className="font-mono text-xs">oyasordaniel@gmail.com</code>). Use Tutor Access to request additional subjects for your account.
        </Alert>
      )}

      {formError && <Alert tone="error">{formError}</Alert>}
      {formSuccess && <Alert tone="success">{formSuccess}</Alert>}

      {isSuperAdmin && missingOfficial.length > 0 && (
        <Card
          padding="md"
          className="border-phosters-200 dark:border-phosters-800/80 bg-phosters-50/40 dark:bg-phosters-950/30"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {missingOfficial.length} official JAMB UTME subject
                {missingOfficial.length === 1 ? ' is' : 's are'} missing
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Missing:{' '}
                {missingOfficial
                  .slice(0, 6)
                  .map((s) => s.name)
                  .join(', ')}
                {missingOfficial.length > 6
                  ? `, and ${missingOfficial.length - 6} more`
                  : ''}
                . Syncing adds all {OFFICIAL_JAMB_SUBJECTS.length} official JAMB UTME subjects and links them to JAMB UTME &amp; UI Post-UTME automatically.
              </p>
            </div>
            <Button
              type="button"
              loading={syncingJamb}
              onClick={() => void handleSyncOfficialJamb()}
              className="shrink-0 whitespace-nowrap"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Add All Missing JAMB Subjects</span>
            </Button>
          </div>
        </Card>
      )}

      {isSuperAdmin && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <Card padding="lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingId ? 'Edit subject' : 'Create subject'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-semibold text-phosters-700 dark:text-phosters-400 hover:underline cursor-pointer"
                >
                  + New instead
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Input
                label="Subject name"
                placeholder="e.g. Physics"
                value={name}
                onChange={(e) => {
                  const val = e.target.value;
                  setName(val);
                  if (!editingId) setSlug(slugify(val));
                }}
                required
              />

              <Input
                label="URL slug"
                placeholder="e.g. physics"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-phosters-600/20 focus:border-phosters-600 dark:focus:border-phosters-500"
                  placeholder="Summary of topics covered in this subject"
                />
              </div>

              <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-phosters-600 focus:ring-phosters-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Active (available to assign to exams)
                </span>
              </label>

              <Button type="submit" fullWidth loading={saving}>
                {editingId ? 'Save Changes' : 'Create Subject'}
              </Button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">All subjects</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {filteredSubjects.length === subjects.length
                    ? `${subjects.length} total`
                    : `${filteredSubjects.length} of ${subjects.length}`}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {missingOfficial.length === 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    loading={syncingJamb}
                    onClick={() => void handleSyncOfficialJamb()}
                    className="whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Verify Exam Links</span>
                  </Button>
                )}
                <div className="relative w-full sm:w-56">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter subjects..."
                    aria-label="Filter subjects"
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-phosters-600"
                  />
                </div>
              </div>
            </div>
            {filteredSubjects.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400">
                No subjects match "{searchQuery}".
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSubjects.map((subj) => (
                  <li
                    key={subj.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{subj.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {subj.slug} · {subj.is_active ? 'Active' : 'Hidden'}
                        {subj.description ? ` · ${subj.description}` : ''}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => startEdit(subj)}>
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
