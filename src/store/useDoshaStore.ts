import { create } from 'zustand';
import { calculateDailyDosha, getDoshaHistory, CalculatedDoshaState } from '../services/doshaEngine';
import { supabase } from '../services/supabase';

interface DoshaStore {
  currentDosha: CalculatedDoshaState | null;
  history: any[];
  isLoading: boolean;
  error: string | null;
  fetchCurrentState: (userId: string) => Promise<void>;
  fetchHistory: (userId: string, limit?: number) => Promise<void>;
  recalculateToday: (userId: string) => Promise<void>;
}

export const useDoshaStore = create<DoshaStore>((set, get) => ({
  currentDosha: null,
  history: [],
  isLoading: false,
  error: null,

  fetchCurrentState: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Try fetching today's record from Supabase first
      const { data, error } = await supabase
        .from('daily_dosha_states')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayStr)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        // Record exists, set store state
        set({
          currentDosha: {
            vata: Number(data.vata_percentage),
            pitta: Number(data.pitta_percentage),
            kapha: Number(data.kapha_percentage),
            heartRateAvg: data.heart_rate_avg,
            temperatureAvg: data.temperature_avg,
            stepsCount: data.steps_count,
            sleepDurationMinutes: data.sleep_duration_minutes,
            waterIntakeMl: data.water_intake_ml,
            tasteProfile: data.taste_profile_summary || {},
            explanationSummary: data.explanation_summary || { aggravating: [], pacifying: [] },
            trendAlert: data.trend_alert || ''
          },
          isLoading: false
        });
      } else {
        // No record exists for today yet, trigger a fresh calculation
        console.log('[DoshaStore] No daily dosha state found, running calculation...');
        const computed = await calculateDailyDosha(userId, todayStr);
        set({ currentDosha: computed, isLoading: false });
      }
    } catch (err: any) {
      console.warn('[DoshaStore] Error fetching current dosha:', err);
      set({ error: err.message || 'Failed to fetch today\'s dosha state', isLoading: false });
    }
  },

  fetchHistory: async (userId: string, limit: number = 7) => {
    try {
      const records = await getDoshaHistory(userId, limit);
      set({ history: records });
    } catch (err: any) {
      console.warn('[DoshaStore] Error fetching dosha history:', err);
    }
  },

  recalculateToday: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const computed = await calculateDailyDosha(userId, todayStr);
      
      // Also refetch history to update dashboard trends
      const records = await getDoshaHistory(userId, 7);
      
      set({ currentDosha: computed, history: records, isLoading: false });
    } catch (err: any) {
      console.warn('[DoshaStore] Error recalculating today\'s dosha:', err);
      set({ error: err.message || 'Failed to recalculate today\'s dosha state', isLoading: false });
    }
  }
}));
