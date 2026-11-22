import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

export interface ManagedAccountRow {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

function isMissingFunctionError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('could not find the function') || msg.includes('does not exist');
}

export async function fetchManagedAccounts(): Promise<{
  accounts: ManagedAccountRow[];
  migrationMissing: boolean;
  error: string | null;
}> {
  if (!supabase) {
    return {
      accounts: [],
      migrationMissing: false,
      error: 'Supabase is not configured.',
    };
  }

  const { data, error } = await supabase.rpc('get_admin_managed_accounts');

  if (error) {
    if (isMissingFunctionError(error)) {
      return {
        accounts: [],
        migrationMissing: true,
        error: null,
      };
    }

    return {
      accounts: [],
      migrationMissing: false,
      error: error.message || 'Unable to load user accounts.',
    };
  }

  const accounts: ManagedAccountRow[] = (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role === 'admin' ? 'admin' : 'student',
    isSuperAdmin: Boolean(row.is_super_admin),
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
  }));

  return {
    accounts,
    migrationMissing: false,
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
