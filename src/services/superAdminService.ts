import { supabase } from '../lib/supabase';
import type { Subject, UserRole } from '../types/database';

export interface ManagedAccountRow {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  assignedSubjectIds: string[];
}

function isMissingFunctionError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('does not exist');
}

function isMissingAssignmentsError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (
    err.code === '42P01' ||
    err.code === '42883' ||
    err.code === 'PGRST202' ||
    err.code === 'PGRST205'
  ) {
    return true;
  }
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('tutor_subject_assignments') || msg.includes('set_tutor_assigned_subjects');
}

export async function fetchManagedAccounts(): Promise<{
  accounts: ManagedAccountRow[];
  subjects: Subject[];
  migrationMissing: boolean;
  assignmentsMigrationMissing: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return {
      accounts: [],
      subjects: [],
      migrationMissing: false,
      assignmentsMigrationMissing: false,
      error: 'Supabase is not configured.',
    };
  }

  const [accountsRes, subjectsRes, assignmentsRes] = await Promise.all([
    supabase.rpc('get_admin_managed_accounts'),
    supabase
      .from('subjects')
      .select('id, name, slug, description, is_active, created_at')
      .order('name', { ascending: true }),
    supabase.from('tutor_subject_assignments').select('tutor_id, subject_id'),
  ]);

  if (accountsRes.error) {
    if (isMissingFunctionError(accountsRes.error)) {
      return {
        accounts: [],
        subjects: [],
        migrationMissing: true,
        assignmentsMigrationMissing: false,
        error: null,
      };
    }

    return {
      accounts: [],
      subjects: [],
      migrationMissing: false,
      assignmentsMigrationMissing: false,
      error: accountsRes.error.message || 'Unable to load user accounts.',
    };
  }

  const assignmentsMigrationMissing = Boolean(
    assignmentsRes.error && isMissingAssignmentsError(assignmentsRes.error)
  );

  const assignmentMap = new Map<string, string[]>();
  if (!assignmentsRes.error && assignmentsRes.data) {
    for (const row of assignmentsRes.data as Array<{ tutor_id: string; subject_id: string }>) {
      const list = assignmentMap.get(row.tutor_id) ?? [];
      if (!list.includes(row.subject_id)) {
        list.push(row.subject_id);
      }
      assignmentMap.set(row.tutor_id, list);
    }
  }

  const accounts: ManagedAccountRow[] = (accountsRes.data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role === 'admin' ? 'admin' : 'student',
    isSuperAdmin: Boolean(row.is_super_admin),
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
    assignedSubjectIds: assignmentMap.get(row.user_id) ?? [],
  }));

  return {
    accounts,
    subjects: (subjectsRes.data ?? []) as Subject[],
    migrationMissing: false,
    assignmentsMigrationMissing,
    error: null,
  };
}

export async function setManagedAccountRole(
  targetUserId: string,
  newRole: UserRole
): Promise<{ role: UserRole | null; error: string | null }> {
  if (!supabase) {
    return { role: null, error: 'Supabase is not configured.' };
  }

  const { data, error } = await supabase.rpc('set_user_account_role', {
    p_target_user_id: targetUserId,
    p_new_role: newRole,
  });

  if (error) {
    return {
      role: null,
      error: error.message || 'Unable to update account role.',
    };
  }

  const first = Array.isArray(data) ? data[0] : data;
  const updatedRole: UserRole = first?.role === 'admin' ? 'admin' : newRole;

  return {
    role: updatedRole,
    error: null,
  };
}

export async function setTutorAssignedSubjects(
  tutorId: string,
  subjectIds: string[]
): Promise<{ assignedSubjectIds: string[] | null; error: string | null }> {
  if (!supabase) {
    return { assignedSubjectIds: null, error: 'Supabase is not configured.' };
  }

  const uniqueSubjectIds = Array.from(new Set(subjectIds.filter(Boolean)));

  const { data, error } = await supabase.rpc('set_tutor_assigned_subjects', {
    p_tutor_id: tutorId,
    p_subject_ids: uniqueSubjectIds,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const isAmbiguousBug = error.code === '42702' || msg.includes('ambiguous');

    if (isAmbiguousBug) {
      // Safe fallback using Super-Admin-only RLS policy on tutor_subject_assignments
      const { data: authData } = await supabase.auth.getUser();
      const actorId = authData.user?.id ?? null;

      const existingRes = await supabase
        .from('tutor_subject_assignments')
        .select('subject_id')
        .eq('tutor_id', tutorId);

      if (existingRes.error) {
        return {
          assignedSubjectIds: null,
          error: existingRes.error.message || 'Unable to read tutor subject assignments.',
        };
      }

      const existingIds = new Set(
        ((existingRes.data ?? []) as Array<{ subject_id: string }>).map((r) => r.subject_id)
      );
      const desiredIds = new Set(uniqueSubjectIds);

      const toRemove = Array.from(existingIds).filter((id) => !desiredIds.has(id));
      const toAdd = uniqueSubjectIds.filter((id) => !existingIds.has(id));

      if (toRemove.length > 0) {
        const delRes = await supabase
          .from('tutor_subject_assignments')
          .delete()
          .eq('tutor_id', tutorId)
          .in('subject_id', toRemove);

        if (delRes.error) {
          return {
            assignedSubjectIds: null,
            error: delRes.error.message || 'Unable to remove unselected subjects.',
          };
        }
      }

      if (toAdd.length > 0) {
        const insRes = await supabase.from('tutor_subject_assignments').insert(
          toAdd.map((subjectId) => ({
            tutor_id: tutorId,
            subject_id: subjectId,
            assigned_by: actorId,
          }))
        );

        if (insRes.error) {
          return {
            assignedSubjectIds: null,
            error: insRes.error.message || 'Unable to assign selected subjects.',
          };
        }
      }

      const finalRes = await supabase
        .from('tutor_subject_assignments')
        .select('subject_id')
        .eq('tutor_id', tutorId);

      if (finalRes.error) {
        return { assignedSubjectIds: uniqueSubjectIds, error: null };
      }

      return {
        assignedSubjectIds: ((finalRes.data ?? []) as Array<{ subject_id: string }>).map(
          (r) => r.subject_id
        ),
        error: null,
      };
    }

    if (isMissingAssignmentsError(error)) {
      return {
        assignedSubjectIds: null,
        error:
          'Run migrations 013a–013c in Supabase SQL Editor first to enable Tutor subject assignments.',
      };
    }
    return {
      assignedSubjectIds: null,
      error: error.message || 'Unable to update tutor subject assignments.',
    };
  }

  const savedIds = ((data ?? []) as Array<{ tutor_id: string; subject_id: string }>).map(
    (r) => r.subject_id
  );

  return {
    assignedSubjectIds: savedIds,
    error: null,
  };
}
