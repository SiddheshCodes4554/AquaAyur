import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { getPendingSleep, insertLocalSleep } from '../services/database';
import { SleepLog } from '../types';

interface SleepState {
  sleepHistory: SleepLog[];
  pendingSyncCount: number;
  loading: boolean;
  error: string | null;
  
  fetchHistory: (userId: string) => Promise<void>;
  logSleep: (userId: string, startTime: string, endTime: string, durationMinutes: number, sleepScore: number) => Promise<void>;
  updatePendingCount: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useSleepStore = create<SleepState>((set, get) => ({
  sleepHistory: [],
  pendingSyncCount: 0,
  loading: false,
  error: null,

  fetchHistory: async (userId) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false })
        .limit(30);

      if (error) throw error;
      set({ sleepHistory: (data as SleepLog[]) || [], loading: false });
    } catch (err: any) {
      console.warn('[SleepStore] Failed to fetch sleep history:', err);
      set({ error: err.message || 'Failed to fetch sleep history', loading: false });
    }
  },

  logSleep: async (userId, startTime, endTime, durationMinutes, sleepScore) => {
    set({ loading: true });
    try {
      // 1. Write to local offline cache SQLite
      await insertLocalSleep(startTime, endTime, durationMinutes, sleepScore);
      
      // Update pending sync count
      await get().updatePendingCount();

      // Create a temporary log for responsive UI display
      const tempLog: SleepLog = {
        id: 'temp-' + Math.random().toString(),
        user_id: userId,
        start_time: startTime,
        end_time: endTime,
        duration_minutes: durationMinutes,
        sleep_score: sleepScore,
        deep_sleep_minutes: Math.round(durationMinutes * 0.2),
        light_sleep_minutes: Math.round(durationMinutes * 0.55),
        rem_sleep_minutes: Math.round(durationMinutes * 0.18),
        awake_minutes: Math.round(durationMinutes * 0.07)
      };

      set((state) => ({
        sleepHistory: [tempLog, ...state.sleepHistory],
        loading: false
      }));

      // 2. Trigger asynchronous synchronization
      const { triggerSync } = require('../services/syncManager');
      triggerSync().catch((err: any) => console.log('[SleepStore] Background sync trigger:', err));

    } catch (error: any) {
      console.error('[SleepStore] Failed to log sleep:', error);
      set({ error: error.message || 'Failed to log sleep', loading: false });
      throw error;
    }
  },

  updatePendingCount: async () => {
    try {
      const pending = await getPendingSleep();
      set({ pendingSyncCount: pending.length });
    } catch (e) {
      console.warn('[SleepStore] Error updating pending count:', e);
    }
  },

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
