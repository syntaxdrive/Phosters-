import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchAllSubjects, saveSubject } from '../../services/adminService';
import { slugify } from '../../lib/slug';
import type { Subject } from '../../types/database';
import { AdminNav } from '../../components/admin/AdminNav';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { ErrorState, LoadingState } from '../../components/ui/States';

export function AdminSubjectsPage() {
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

      {formError && <Alert tone="error">{formError}</Alert>}
      {formSuccess && <Alert tone="success">{formSuccess}</Alert>}

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
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">All subjects</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{subjects.length} total</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {subjects.map((subj) => (
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
          </Card>
        </div>
      </div>
    </div>
  );
}
