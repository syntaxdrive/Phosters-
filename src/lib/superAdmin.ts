import type { UserRole } from '../types/database';

export const SUPER_ADMIN_EMAIL = 'oyasordaniel@gmail.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  return (email ?? '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function isSuperAdminUser(
  email?: string | null,
  role?: UserRole | null
): boolean {
  return role === 'admin' && isSuperAdminEmail(email);
}
