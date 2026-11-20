import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../lib/supabase';
import {
  sendPasswordResetEmail,
  signInWithEmail,
  signOutCurrentUser,
  signUpWithEmail,
  updateCurrentUserPassword,
} from '../services/authService';
import { fetchUserProfile, updateUserProfile } from '../services/profileService';
import type { AuthContextValue, ProfileUpdateInput, SignInInput, SignUpInput } from '../types/auth';
import type { Profile } from '../types/database';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const activeUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    setProfileError(null);
    const { profile: fetchedProfile, error } = await fetchUserProfile(userId);
    // Avoid stale writes if user signed out or changed while fetching
    if (activeUserIdRef.current !== userId) {
      return;
    }
    setProfile(fetchedProfile);
    setProfileError(error);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setLoading(false);
          return;
        }
        const initialSession = data.session;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        activeUserIdRef.current = initialSession?.user?.id ?? null;
        setLoading(false);

        if (initialSession?.user) {
          void loadProfile(initialSession.user.id);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      const nextUser = nextSession?.user ?? null;
      const previousUserId = activeUserIdRef.current;
      const nextUserId = nextUser?.id ?? null;

      setSession(nextSession);
      setUser(nextUser);
      activeUserIdRef.current = nextUserId;
      setLoading(false);

      if (!nextUser) {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
        return;
      }

      if (nextUserId && (nextUserId !== previousUserId || event === 'USER_UPDATED' || event === 'SIGNED_IN')) {
        void loadProfile(nextUserId);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const handleSignUp = useCallback(async (input: SignUpInput) => {
    return signUpWithEmail(input);
  }, []);

  const handleSignIn = useCallback(async (input: SignInInput) => {
    return signInWithEmail(input);
  }, []);

  const handleSignOut = useCallback(async () => {
    const result = await signOutCurrentUser();
    if (!result.error) {
      activeUserIdRef.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setProfileError(null);
    }
    return result;
  }, []);

  const handleRequestPasswordReset = useCallback(async (email: string) => {
    return sendPasswordResetEmail(email);
  }, []);

  const handleUpdatePassword = useCallback(async (newPassword: string) => {
    return updateCurrentUserPassword(newPassword);
  }, []);

  const handleUpdateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      if (!user) {
        return { error: 'You must be signed in to update your profile.' };
      }
      const { profile: updated, error } = await updateUserProfile(user.id, input);
      if (updated) {
        setProfile(updated);
      }
      return { error };
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      configError: supabaseConfigError,
      loading,
      profileLoading,
      profileError,
      session,
      user,
      profile,
      signUp: handleSignUp,
      signIn: handleSignIn,
      signOut: handleSignOut,
      requestPasswordReset: handleRequestPasswordReset,
      updatePassword: handleUpdatePassword,
      updateProfile: handleUpdateProfile,
      refreshProfile,
    }),
    [
      loading,
      profileLoading,
      profileError,
      session,
      user,
      profile,
      handleSignUp,
      handleSignIn,
      handleSignOut,
      handleRequestPasswordReset,
      handleUpdatePassword,
      handleUpdateProfile,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
