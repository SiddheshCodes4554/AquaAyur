import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  weight_kg: number | null;
  height_cm: number | null;
  dominant_dosha: 'vata' | 'pitta' | 'kapha' | 'dual_vata_pitta' | 'dual_pitta_kapha' | 'dual_vata_kapha' | 'tridoshic' | null;
  daily_water_goal_ml: number;
  daily_calorie_goal_kcal: number;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setSession: (session: Session | null) => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setSession: async (session) => {
    set({ session, user: session?.user ?? null, loading: true });
    if (session?.user) {
      await get().fetchProfile(session.user.id);
    } else {
      set({ profile: null, loading: false });
    }
  },

  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Create a default empty profile locally to let user proceed
        set({
          profile: {
            id: userId,
            full_name: '',
            avatar_url: null,
            birth_date: null,
            gender: null,
            weight_kg: null,
            height_cm: null,
            dominant_dosha: null,
            daily_water_goal_ml: 2500,
            daily_calorie_goal_kcal: 2000,
          },
          loading: false,
        });
      } else {
        set({ profile: data as Profile, loading: false });
      }
    } catch (e) {
      console.error('[AuthStore] Unexpected error fetching profile:', e);
      set({ loading: false });
    }
  },

  updateProfile: async (updates) => {
    const profile = get().profile;
    if (!profile) return;

    set({ loading: true });
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        console.warn('[AuthStore] Profile update failed on server, applying locally:', error);
      }
    } catch (error) {
      console.error('[AuthStore] Failed to update profile on server, applying locally:', error);
    }

    // Always update local profile state so the user is not blocked offline/during network errors
    set({ profile: { ...profile, ...updates }, loading: false });
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, loading: false });
  },

  initializeAuth: () => {
    // Initial fetch of session
    supabase.auth.getSession().then(({ data: { session } }) => {
      get().setSession(session).then(() => {
        set({ initialized: true });
      });
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      get().setSession(session).then(() => {
        set({ initialized: true });
      });
    });
  },
}));
