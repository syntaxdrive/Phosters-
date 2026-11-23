import { isSuperAdminUser } from '../lib/superAdmin';
import { supabase } from '../lib/supabase';
import type { Subject, UserRole } from '../types/database';

export interface TutorSubjectScope {
  isSuperAdmin: boolean;
  /**
   * `null` = unrestricted access to all subjects (Super Admin, or pre-013a compatibility).
   * `string[]` = explicit subject IDs assigned to this Tutor.
   */
  assignedSubjectIds: string[] | null;
  assignmentsMigrationMissing: boolean;
}

function isMissingAssignmentsTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42P01' || err.code === 'PGRST205') return true;
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('tutor_subject_assignments') &&
    (msg.includes('does not exist') || msg.includes('could not find'))
  );
}

export async function fetchMyTutorSubjectScope(
  userEmail?: string | null,
  role?: UserRole | null
): Promise<TutorSubjectScope> {
  if (isSuperAdminUser(userEmail, role)) {
    return {
      isSuperAdmin: true,
      assignedSubjectIds: null,
      assignmentsMigrationMissing: false,
    };
  }

  if (!supabase || role !== 'admin') {
    return {
      isSuperAdmin: false,
      assignedSubjectIds: [],
      assignmentsMigrationMissing: false,
    };
  }

  const { data, error } = await supabase
    .from('tutor_subject_assignments')
    .select('subject_id');

  if (error) {
    if (isMissingAssignmentsTableError(error)) {
      return {
        isSuperAdmin: false,
        assignedSubjectIds: null,
        assignmentsMigrationMissing: true,
      };
    }
    return {
      isSuperAdmin: false,
      assignedSubjectIds: [],
      assignmentsMigrationMissing: false,
    };
  }

  const assignedSubjectIds = Array.from(
    new Set(((data ?? []) as Array<{ subject_id: string }>).map((r) => r.subject_id))
  );

  return {
    isSuperAdmin: false,
    assignedSubjectIds,
    assignmentsMigrationMissing: false,
  };
}

export function filterSubjectsByTutorScope(
  subjects: Subject[],
  assignedSubjectIds: string[] | null
): Subject[] {
  if (assignedSubjectIds === null) return subjects;
  const allowed = new Set(assignedSubjectIds);
  return subjects.filter((s) => allowed.has(s.id));
}
