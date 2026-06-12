import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { calculateDailyOjas, OjasScoreRecord } from '../services/ojasEngine';

interface OjasState {
  todayOjas: OjasScoreRecord | null;
  history: OjasScoreRecord[];
  loading: boolean;
  error: string | null;

  fetchTodayOjas: (userId: string) => Promise<void>;
  fetchHistory: (userId: string) => Promise<void>;
  recalculateOjas: (userId: string) => Promise<void>;
}

export const useOjasStore = create<OjasState>((set, get) => ({
  todayOjas: null,
  history: [],
  loading: false,
  error: null,

  fetchTodayOjas: async (userId) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_ojas_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayDateStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({
          todayOjas: {
            ...data,
            ojas_score: Number(data.ojas_score),
            s_sleep: Number(data.s_sleep),
            s_recovery: Number(data.s_recovery),
            s_rhr: Number(data.s_rhr),
            s_activity: Number(data.s_activity),
            s_nutrition: Number(data.s_nutrition),
            s_hydration: Number(data.s_hydration),
          },
          loading: false
        });
      } else {
        // First run of the day: compute initial score
        const record = await calculateDailyOjas(userId, todayDateStr);
        set({ todayOjas: record, loading: false });
      }
    } catch (err: any) {
      console.warn('[OjasStore] Failed to fetch today Ojas:', err);
      set({ error: err.message || 'Failed to fetch today Ojas', loading: false });
    }
  },

  fetchHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_ojas_scores')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);

      if (error) throw error;

      const normalizedHistory = (data || []).map(r => ({
        ...r,
        ojas_score: Number(r.ojas_score),
        s_sleep: Number(r.s_sleep),
        s_recovery: Number(r.s_recovery),
        s_rhr: Number(r.s_rhr),
        s_activity: Number(r.s_activity),
        s_nutrition: Number(r.s_nutrition),
        s_hydration: Number(r.s_hydration),
      }));

      set({ history: normalizedHistory, loading: false });
    } catch (err: any) {
      console.warn('[OjasStore] Failed to fetch Ojas history:', err);
      set({ error: err.message || 'Failed to fetch Ojas history', loading: false });
    }
  },

  recalculateOjas: async (userId) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const record = await calculateDailyOjas(userId, todayDateStr);
      set({ todayOjas: record, loading: false });
      await get().fetchHistory(userId);
    } catch (err: any) {
      console.error('[OjasStore] Failed to recalculate Ojas:', err);
      set({ error: err.message || 'Failed to recalculate Ojas', loading: false });
      throw err;
    }
  }
}));
