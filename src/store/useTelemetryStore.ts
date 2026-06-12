import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { getPendingTelemetry } from '../services/database';
import { HeartRateLog, TemperatureLog, ActivityLog } from '../types';

interface TelemetryState {
  heartRateHistory: HeartRateLog[];
  temperatureHistory: TemperatureLog[];
  activityHistory: ActivityLog[];
  pendingSyncCount: number;
  loading: boolean;
  error: string | null;
  
  fetchHistory: (userId: string) => Promise<void>;
  updatePendingCount: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  heartRateHistory: [],
  temperatureHistory: [],
  activityHistory: [],
  pendingSyncCount: 0,
  loading: false,
  error: null,

  fetchHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      const [hrRes, tempRes, actRes] = await Promise.all([
        supabase
          .from('heart_rate_logs')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(100),
        supabase
          .from('temperature_logs')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(100),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(100)
      ]);

      if (hrRes.error) throw hrRes.error;
      if (tempRes.error) throw tempRes.error;
      if (actRes.error) throw actRes.error;

      set({
        heartRateHistory: (hrRes.data as HeartRateLog[]) || [],
        temperatureHistory: (tempRes.data as TemperatureLog[]) || [],
        activityHistory: (actRes.data as ActivityLog[]) || [],
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch telemetry history', loading: false });
    }
  },

  updatePendingCount: async () => {
    try {
      const pending = await getPendingTelemetry();
      set({ pendingSyncCount: pending.length });
    } catch (e) {
      console.warn('[TelemetryStore] Error updating pending count:', e);
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
