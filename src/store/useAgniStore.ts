import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { calculateDailyAgni, AgniScoreRecord } from '../services/agniEngine';

interface AgniState {
  todayAgni: AgniScoreRecord | null;
  history: AgniScoreRecord[];
  loading: boolean;
  error: string | null;

  fetchTodayAgni: (userId: string) => Promise<void>;
  fetchHistory: (userId: string) => Promise<void>;
  recalculateAgni: (userId: string) => Promise<void>;
}

export const useAgniStore = create<AgniState>((set, get) => ({
  todayAgni: null,
  history: [],
  loading: false,
  error: null,

  fetchTodayAgni: async (userId) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_agni_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayDateStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({ 
          todayAgni: {
            ...data,
            agni_score: Number(data.agni_score),
            s_timing: Number(data.s_timing),
            s_diet: Number(data.s_diet),
            s_vitals: Number(data.s_vitals),
            s_hydration: Number(data.s_hydration),
            s_activity: Number(data.s_activity),
            s_sleep: Number(data.s_sleep),
          }, 
          loading: false 
        });
      } else {
        // First run of the day: compute initial score
        const record = await calculateDailyAgni(userId, todayDateStr);
        set({ todayAgni: record, loading: false });
      }
    } catch (err: any) {
      console.warn('[AgniStore] Failed to fetch today Agni:', err);
      set({ error: err.message || 'Failed to fetch today Agni', loading: false });
    }
  },

  fetchHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_agni_scores')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(7);

      if (error) throw error;
      
      const normalizedHistory = (data || []).map(r => ({
        ...r,
        agni_score: Number(r.agni_score),
        s_timing: Number(r.s_timing),
        s_diet: Number(r.s_diet),
        s_vitals: Number(r.s_vitals),
        s_hydration: Number(r.s_hydration),
        s_activity: Number(r.s_activity),
        s_sleep: Number(r.s_sleep),
      }));

      set({ history: normalizedHistory, loading: false });
    } catch (err: any) {
      console.warn('[AgniStore] Failed to fetch Agni history:', err);
      set({ error: err.message || 'Failed to fetch Agni history', loading: false });
    }
  },

  recalculateAgni: async (userId) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const record = await calculateDailyAgni(userId, todayDateStr);
      set({ todayAgni: record, loading: false });
      await get().fetchHistory(userId);
    } catch (err: any) {
      console.error('[AgniStore] Failed to recalculate Agni:', err);
      set({ error: err.message || 'Failed to recalculate Agni', loading: false });
      throw err;
    }
  }
}));
