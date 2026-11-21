import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from './database';

export interface SignUpInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone?: string;
}

export interface AuthActionResult {
  error: string | null;
  requiresEmailConfirmation?: boolean;
}

export interface AuthContextValue {
  isConfigured: boolean;
  configError: string | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signUp: (input: SignUpInput) => Promise<AuthActionResult>;
  signIn: (input: SignInInput) => Promise<AuthActionResult>;
  signOut: () => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateProfile: (input: ProfileUpdateInput) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}
