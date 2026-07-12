import { create } from 'zustand';
import { supabase } from '../services/supabase';

export interface Lifestyle {
  avg_sleep_hours: number | null;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | null;
  occupation: string | null;
  stress_level: 'low' | 'medium' | 'high' | null;
  water_intake_ml: number | null;
  smoking: boolean;
  alcohol: 'none' | 'occasional' | 'frequent' | null;
  exercise_frequency: 'none' | '1-2_times_week' | '3-5_times_week' | 'daily' | null;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  weight_kg: number | null;
  height_cm: number | null;
  blood_group: string | null;
  country: string | null;
  timezone: string | null;
  preferred_language: string | null;
  diet_preference: 'Vegetarian' | 'Vegan' | 'Eggetarian' | 'Non-Vegetarian' | 'Jain' | 'Other' | null;
  dominant_dosha: 'vata' | 'pitta' | 'kapha' | 'dual_vata_pitta' | 'dual_pitta_kapha' | 'dual_vata_kapha' | 'tridoshic' | null;
  daily_water_goal_ml: number;
  daily_calorie_goal_kcal: number;
  
  // Relational details loaded for the active session
  medical_conditions?: string[];
  allergies?: string[];
  disliked_foods?: string[];
  health_goals?: string[];
  lifestyle?: Lifestyle | null;
}

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  user: { id: string; email: string } | null; // Supabase compatibility
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setClerkSession: (params: {
    token: string | null;
    userId: string;
    email: string;
    name: string;
    photoUrl: string | null;
  }) => Promise<void>;
  clearClerkSession: () => void;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  updateLifestyle: (updates: Partial<Lifestyle>) => Promise<void>;
  updateRelationalLists: (params: {
    medical_conditions?: string[];
    allergies?: string[];
    disliked_foods?: string[];
    health_goals?: string[];
  }) => Promise<void>;
  signOut: () => Promise<void>; // Backwards compatibility method
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  userId: null,
  email: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  setClerkSession: async ({ token, userId, email, name, photoUrl }) => {
    set({ token, userId, email, user: { id: userId, email }, loading: true });
    
    // Authenticate Supabase with Clerk JWT
    if (token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: '',
      });
      if (sessionError) {
        console.warn('[AuthStore] Supabase setSession warning:', sessionError.message);
      }
    }

    try {
      // 1. Sync user to Supabase profiles (Upsert basic info)
      const firstName = name.split(' ')[0] || '';
      const lastName = name.split(' ').slice(1).join(' ') || '';
      
      const { error: syncError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          full_name: name,
          avatar_url: photoUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (syncError) {
        console.error('[AuthStore] Syncing user metadata to Supabase failed:', syncError);
      }

      // 2. Load the full user profile & intake tables
      await get().fetchProfile(userId);
    } catch (e) {
      console.error('[AuthStore] Error during Clerk session setup:', e);
    } finally {
      set({ initialized: true, loading: false });
    }
  },

  clearClerkSession: () => {
    // Clear Supabase Session headers
    supabase.auth.setSession({ access_token: '', refresh_token: '' });
    set({ token: null, userId: null, email: null, user: null, profile: null, initialized: true, loading: false });
  },

  fetchProfile: async (userId) => {
    try {
      // 1. Fetch profile core details
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        throw profileError;
      }

      // 2. Fetch lifestyle
      const { data: lifestyleData } = await supabase
        .from('lifestyle')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // 3. Fetch allergies
      const { data: allergiesData } = await supabase
        .from('allergies')
        .select('allergy_name')
        .eq('user_id', userId);

      // 4. Fetch medical conditions
      const { data: conditionsData } = await supabase
        .from('medical_conditions')
        .select('condition_name')
        .eq('user_id', userId);

      // 5. Fetch food preferences (disliked foods)
      const { data: dislikedData } = await supabase
        .from('food_preferences')
        .select('disliked_food')
        .eq('user_id', userId);

      // 6. Fetch health goals
      const { data: goalsData } = await supabase
        .from('health_goals')
        .select('goal_name')
        .eq('user_id', userId);

      // Construct complete profile object
      const profile: Profile = {
        ...(profileData as Profile),
        medical_conditions: conditionsData?.map(c => c.condition_name) || [],
        allergies: allergiesData?.map(a => a.allergy_name) || [],
        disliked_foods: dislikedData?.map(d => d.disliked_food) || [],
        health_goals: goalsData?.map(g => g.goal_name) || [],
        lifestyle: lifestyleData || null,
      };

      set({ profile, loading: false });
    } catch (e) {
      console.warn('[AuthStore] Profile fetch empty or failed, user requires onboarding:', e);
      set({ profile: null, loading: false });
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
        console.error('[AuthStore] Profile update failed on Supabase:', error);
      }
    } catch (e) {
      console.error('[AuthStore] Error updating profile on server:', e);
    }

    set({ profile: { ...profile, ...updates }, loading: false });
  },

  updateLifestyle: async (updates) => {
    const profile = get().profile;
    if (!profile) return;

    set({ loading: true });
    try {
      const { error } = await supabase
        .from('lifestyle')
        .upsert({
          user_id: profile.id,
          ...updates,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('[AuthStore] Lifestyle update failed on Supabase:', error);
      }
    } catch (e) {
      console.error('[AuthStore] Error updating lifestyle on server:', e);
    }

    // Refresh profile state
    await get().fetchProfile(profile.id);
  },

  updateRelationalLists: async ({ medical_conditions, allergies, disliked_foods, health_goals }) => {
    const profile = get().profile;
    if (!profile) return;

    set({ loading: true });
    try {
      // 1. Sync medical conditions
      if (medical_conditions !== undefined) {
        await supabase.from('medical_conditions').delete().eq('user_id', profile.id);
        if (medical_conditions.length > 0) {
          await supabase.from('medical_conditions').insert(
            medical_conditions.map(c => ({ user_id: profile.id, condition_name: c }))
          );
        }
      }

      // 2. Sync allergies
      if (allergies !== undefined) {
        await supabase.from('allergies').delete().eq('user_id', profile.id);
        if (allergies.length > 0) {
          await supabase.from('allergies').insert(
            allergies.map(a => ({ user_id: profile.id, allergy_name: a }))
          );
        }
      }

      // 3. Sync food preferences
      if (disliked_foods !== undefined) {
        await supabase.from('food_preferences').delete().eq('user_id', profile.id);
        if (disliked_foods.length > 0) {
          await supabase.from('food_preferences').insert(
            disliked_foods.map(d => ({ user_id: profile.id, disliked_food: d }))
          );
        }
      }

      // 4. Sync goals
      if (health_goals !== undefined) {
        await supabase.from('health_goals').delete().eq('user_id', profile.id);
        if (health_goals.length > 0) {
          await supabase.from('health_goals').insert(
            health_goals.map(g => ({ user_id: profile.id, goal_name: g }))
          );
        }
      }
    } catch (e) {
      console.error('[AuthStore] Error syncing relational lists:', e);
    }

    // Refresh profile state
    await get().fetchProfile(profile.id);
  },

  signOut: async () => {
    // Default fallback. Dynamic Clerk handler overrides this on layout render.
    get().clearClerkSession();
  }
}));
