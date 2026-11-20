import { supabase } from '../lib/supabase';
import { normalizeOptionalPhone } from '../lib/validation';
import type { AuthActionResult, SignInInput, SignUpInput } from '../types/auth';

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email address or password. Please check your details and try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Your email address has not been confirmed yet. Check your inbox for the confirmation link.';
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email address already exists. Sign in instead.';
  }
  if (lower.includes('rate limit')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Unable to reach the server. Check your internet connection and try again.';
  }
  return message;
}

export async function signUpWithEmail(input: SignUpInput): Promise<AuthActionResult> {
  if (!supabase) {
    return { error: 'Authentication is unavailable until Supabase is configured.' };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const phone = normalizeOptionalPhone(input.phone);

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/login`,
      data: {
        full_name: fullName,
        phone,
      },
    },
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  // When email confirmation is enabled in Supabase, session is null until verified.
  const requiresEmailConfirmation = Boolean(data.user && !data.session);
  return { error: null, requiresEmailConfirmation };
}

export async function signInWithEmail(input: SignInInput): Promise<AuthActionResult> {
  if (!supabase) {
    return { error: 'Authentication is unavailable until Supabase is configured.' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { error: null };
}

export async function signOutCurrentUser(): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase is not configured.' };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { error: null };
}

export async function sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Password reset is unavailable until Supabase is configured.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { error: null };
}

export async function updateCurrentUserPassword(newPassword: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Password update is unavailable until Supabase is configured.' };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { error: null };
}
