import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { getPendingHydration, insertLocalHydration } from '../services/database';

export interface HydrationLog {
  id: string;
  user_id: string;
  timestamp: string;
  amount_ml: number;
  source: string;
}

interface HydrationState {
  todayLogs: HydrationLog[];
  todayTotalMl: number;
  pendingSyncCount: number;
  loading: boolean;
  
  fetchTodayLogs: (userId: string) => Promise<void>;
  logWater: (userId: string, amountMl: number, source?: string) => Promise<void>;
  updatePendingCount: () => Promise<void>;
}

export const useHydrationStore = create<HydrationState>((set, get) => ({
  todayLogs: [],
  todayTotalMl: 0,
  pendingSyncCount: 0,
  loading: false,

  fetchTodayLogs: async (userId) => {
    set({ loading: true });
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('hydration_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const logs = (data as HydrationLog[]) || [];
      const total = logs.reduce((sum, log) => sum + log.amount_ml, 0);

      set({ todayLogs: logs, todayTotalMl: total, loading: false });
    } catch (e) {
      console.warn('[HydrationStore] Failed to fetch today hydration:', e);
      set({ loading: false });
    }
  },

  logWater: async (userId, amountMl, source = 'manual') => {
    set({ loading: true });
    try {
      // 1. Write immediately to local offline cache SQLite
      await insertLocalHydration(amountMl, source);
      
      // Update pending sync count
      await get().updatePendingCount();

      // Create a temporary log for responsive UI display
      const tempLog: HydrationLog = {
        id: 'temp-' + Math.random().toString(),
        user_id: userId,
        timestamp: new Date().toISOString(),
        amount_ml: amountMl,
        source
      };

      set((state) => ({
        todayLogs: [tempLog, ...state.todayLogs],
        todayTotalMl: state.todayTotalMl + amountMl,
        loading: false
      }));

      // 2. Trigger asynchronous synchronization (resolved dynamically to prevent circular dependencies)
      const { triggerSync } = require('../services/syncManager');
      triggerSync().catch((err: any) => console.log('[HydrationStore] Background sync trigger:', err));

    } catch (error) {
      console.error('[HydrationStore] Failed to log water:', error);
      set({ loading: false });
      throw error;
    }
  },

  updatePendingCount: async () => {
    try {
      const pending = await getPendingHydration();
      set({ pendingSyncCount: pending.length });
    } catch (e) {
      console.warn('[HydrationStore] Error updating pending count:', e);
    }
  }
}));
