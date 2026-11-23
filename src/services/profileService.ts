import { cacheProfile, getOfflineKv, isLikelyNetworkError, offlineKeys } from '../lib/offlineDb';
import { supabase } from '../lib/supabase';
import { normalizeOptionalPhone } from '../lib/validation';
import type { ProfileUpdateInput } from '../types/auth';
import type { Profile } from '../types/database';

export async function fetchUserProfile(
  userId: string
): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) {
    return { profile: null, error: 'Supabase is not configured.' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      if (isLikelyNetworkError(error)) {
        const cached = await getOfflineKv<Profile>(offlineKeys.profile(userId));
        if (cached?.value) {
          return { profile: cached.value, error: null };
        }
      }
      if (error.message.toLowerCase().includes('relation') || error.code === '42P01') {
        return {
          profile: null,
          error: 'The profiles table has not been created yet. Run the Phase 1 SQL migration in Supabase.',
        };
      }
      return { profile: null, error: 'Unable to load your profile right now. Please try again.' };
    }

    if (!data) {
      return {
        profile: null,
        error:
          'Your profile record could not be found. Confirm the Phase 1 SQL migration (including the user signup trigger) has been run in Supabase.',
      };
    }

    void cacheProfile(userId, data);
    return { profile: data, error: null };
  } catch (err) {
    if (isLikelyNetworkError(err)) {
      const cached = await getOfflineKv<Profile>(offlineKeys.profile(userId));
      if (cached?.value) {
        return { profile: cached.value, error: null };
      }
    }
    return { profile: null, error: 'Unable to load your profile right now. Please try again.' };
  }
}

export async function updateUserProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<{ profile: Profile | null; error: string | null }> {
  if (!supabase) {
    return { profile: null, error: 'Supabase is not configured.' };
  }

  // Only permitted personal fields are sent. Role changes are never allowed from the client profile form.
  const payload = {
    full_name: input.fullName.trim(),
    phone: normalizeOptionalPhone(input.phone),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('id, full_name, phone, role, created_at, updated_at')
    .single();

  if (error) {
    return { profile: null, error: 'Could not save your profile changes. Please try again.' };
  }

  return { profile: data, error: null };
}
