import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface DigitalTwinState {
  vata: number;
  pitta: number;
  kapha: number;
  agni: number;
  ojas: number;
  lastUpdated: string;
  loading: boolean;
  error: string | null;

  fetchTwinState: (userId: string) => Promise<void>;
  subscribeToTwinUpdates: (userId: string) => () => void;
}

export const useDigitalTwinStore = create<DigitalTwinState>((set, get) => ({
  vata: 33.3,
  pitta: 33.3,
  kapha: 33.4,
  agni: 70,
  ojas: 70,
  lastUpdated: '--',
  loading: false,
  error: null,

  fetchTwinState: async (userId) => {
    set({ loading: true, error: null });
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch dynamic dosha, agni, and ojas in parallel
      const [doshaRes, agniRes, ojasRes] = await Promise.all([
        supabase
          .from('daily_dosha_states')
          .select('vata_percentage, pitta_percentage, kapha_percentage, updated_at')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle(),
        supabase
          .from('daily_agni_scores')
          .select('agni_score, created_at')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle(),
        supabase
          .from('daily_ojas_scores')
          .select('ojas_score, created_at')
          .eq('user_id', userId)
          .eq('date', todayStr)
          .maybeSingle()
      ]);

      const vata = doshaRes.data ? Number(doshaRes.data.vata_percentage) : 33.3;
      const pitta = doshaRes.data ? Number(doshaRes.data.pitta_percentage) : 33.3;
      const kapha = doshaRes.data ? Number(doshaRes.data.kapha_percentage) : 33.4;

      const agni = agniRes.data ? Number(agniRes.data.agni_score) : 70;
      const ojas = ojasRes.data ? Number(ojasRes.data.ojas_score) : 70;

      const updateTimes = [
        doshaRes.data?.updated_at,
        agniRes.data?.created_at,
        ojasRes.data?.created_at
      ].filter(Boolean) as string[];

      let lastUpdated = 'Today';
      if (updateTimes.length > 0) {
        const latestTime = new Date(Math.max(...updateTimes.map(t => new Date(t).getTime())));
        lastUpdated = latestTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      set({
        vata,
        pitta,
        kapha,
        agni,
        ojas,
        lastUpdated,
        loading: false
      });
    } catch (err: any) {
      console.warn('[DigitalTwinStore] Error fetching twin state:', err);
      set({ error: err.message || 'Failed to sync digital twin', loading: false });
    }
  },

  subscribeToTwinUpdates: (userId) => {
    console.log('[DigitalTwinStore] Setting up Realtime subscriptions for user:', userId);

    // Subscribe to dosha state changes
    const doshaChannel = supabase
      .channel(`rt-twin-dosha-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_dosha_states', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('[DigitalTwinStore] Realtime Dosha change detected:', payload.new);
          if (payload.new && 'vata_percentage' in payload.new) {
            set({
              vata: Number(payload.new.vata_percentage),
              pitta: Number(payload.new.pitta_percentage),
              kapha: Number(payload.new.kapha_percentage),
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
      )
      .subscribe();

    // Subscribe to agni changes
    const agniChannel = supabase
      .channel(`rt-twin-agni-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_agni_scores', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('[DigitalTwinStore] Realtime Agni change detected:', payload.new);
          if (payload.new && 'agni_score' in payload.new) {
            set({
              agni: Number(payload.new.agni_score),
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
      )
      .subscribe();

    // Subscribe to ojas changes
    const ojasChannel = supabase
      .channel(`rt-twin-ojas-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_ojas_scores', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('[DigitalTwinStore] Realtime Ojas change detected:', payload.new);
          if (payload.new && 'ojas_score' in payload.new) {
            set({
              ojas: Number(payload.new.ojas_score),
              lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
          }
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      console.log('[DigitalTwinStore] Unsubscribing Realtime channels');
      supabase.removeChannel(doshaChannel);
      supabase.removeChannel(agniChannel);
      supabase.removeChannel(ojasChannel);
    };
  }
}));
