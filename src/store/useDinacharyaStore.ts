import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { calculateDinacharya, DinacharyaRecord, getDailyCompletions, toggleCompletion } from '../services/dinacharyaEngine';
import { scheduleDinacharyaReminder, cancelDinacharyaReminder, getStoredReminders } from '../services/reminderService';

interface DinacharyaState {
  todayDinacharya: DinacharyaRecord | null;
  completions: Record<string, boolean>;
  reminders: Record<string, boolean>;
  loading: boolean;
  error: string | null;

  fetchTodayDinacharya: (userId: string, weather?: string) => Promise<void>;
  recalculateDinacharya: (userId: string, weather: string) => Promise<void>;
  toggleTaskCompletion: (userId: string, taskKey: string) => Promise<void>;
  toggleReminder: (taskKey: string, title: string, body: string, timeStr: string) => Promise<void>;
}

export const useDinacharyaStore = create<DinacharyaState>((set, get) => ({
  todayDinacharya: null,
  completions: {
    wake_up: false,
    hydration: false,
    meal_timing: false,
    exercise_timing: false,
    sleep_timing: false,
  },
  reminders: {},
  loading: false,
  error: null,

  fetchTodayDinacharya: async (userId, weather = 'Pleasant') => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      
      // Parallel fetch completions and reminders
      const [completions, storedReminders] = await Promise.all([
        getDailyCompletions(userId, todayDateStr),
        getStoredReminders()
      ]);

      const reminderFlags: Record<string, boolean> = {};
      Object.keys(storedReminders).forEach(key => {
        reminderFlags[key] = true;
      });

      const { data, error } = await supabase
        .from('dinacharya_recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('date', todayDateStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({ todayDinacharya: data, completions, reminders: reminderFlags, loading: false });
      } else {
        // First fetch: generate today's initial Dinacharya schedule
        const record = await calculateDinacharya(userId, todayDateStr, weather);
        set({ todayDinacharya: record, completions, reminders: reminderFlags, loading: false });
      }
    } catch (err: any) {
      console.warn('[DinacharyaStore] Failed to fetch today Dinacharya:', err);
      set({ 
        error: err.message || 'Failed to fetch Dinacharya recommendations', 
        loading: false,
        completions: get().completions || {
          wake_up: false,
          hydration: false,
          meal_timing: false,
          exercise_timing: false,
          sleep_timing: false,
        },
        reminders: get().reminders || {}
      });
    }
  },

  recalculateDinacharya: async (userId, weather) => {
    set({ loading: true, error: null });
    try {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const record = await calculateDinacharya(userId, todayDateStr, weather);
      const completions = await getDailyCompletions(userId, todayDateStr);
      
      set({ todayDinacharya: record, completions, loading: false });
    } catch (err: any) {
      console.error('[DinacharyaStore] Failed to recalculate Dinacharya:', err);
      set({ 
        error: err.message || 'Failed to recalculate Dinacharya', 
        loading: false,
        completions: get().completions || {
          wake_up: false,
          hydration: false,
          meal_timing: false,
          exercise_timing: false,
          sleep_timing: false,
        }
      });
      throw err;
    }
  },

  toggleTaskCompletion: async (userId, taskKey) => {
    const todayDateStr = new Date().toISOString().split('T')[0];
    const currentCompletions = get().completions || {};
    const currentStatus = !!currentCompletions[taskKey];
    const newStatus = !currentStatus;

    // Optimistically update UI
    set(state => ({
      completions: {
        ...(state.completions || {}),
        [taskKey]: newStatus
      }
    }));

    try {
      await toggleCompletion(userId, todayDateStr, taskKey, newStatus);
    } catch (err) {
      // Revert if error
      set(state => ({
        completions: {
          ...state.completions,
          [taskKey]: currentStatus
        }
      }));
      console.error('[DinacharyaStore] Failed to toggle task completion:', err);
    }
  },

  toggleReminder: async (taskKey, title, body, timeStr) => {
    const currentReminders = get().reminders || {};
    const isCurrentlySet = !!currentReminders[taskKey];
    
    try {
      if (isCurrentlySet) {
        await cancelDinacharyaReminder(taskKey);
        set(state => ({
          reminders: {
            ...(state.reminders || {}),
            [taskKey]: false
          }
        }));
      } else {
        const result = await scheduleDinacharyaReminder(taskKey, title, body, timeStr);
        if (result) {
          set(state => ({
            reminders: {
              ...(state.reminders || {}),
              [taskKey]: true
            }
          }));
        }
      }
    } catch (err) {
      console.error('[DinacharyaStore] Failed to toggle reminder:', err);
    }
  }
}));
