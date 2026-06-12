import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { 
  getPendingTelemetry, 
  deleteLocalTelemetry, 
  getPendingHydration, 
  deleteLocalHydration,
  getPendingSleep,
  deleteLocalSleep 
} from './database';
import { useAuthStore } from '../store/useAuthStore';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useHydrationStore } from '../store/useHydrationStore';
import { calculateDailyAgni } from './agniEngine';
import { calculateDailyOjas } from './ojasEngine';

let isSyncing = false;
let isInternetReachable = true;

// Setup network listener
NetInfo.addEventListener(state => {
  const wasOffline = !isInternetReachable;
  isInternetReachable = state.isConnected === true && state.isInternetReachable !== false;
  
  if (isInternetReachable && wasOffline) {
    console.log('[SyncManager] Internet restored, triggering sync...');
    triggerSync().catch(err => console.error('[SyncManager] NetInfo trigger error:', err));
  }
});

/**
 * Check if the device is currently online.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  isInternetReachable = state.isConnected === true && state.isInternetReachable !== false;
  return isInternetReachable;
}

/**
 * Triggers synchronization. Safe to call multiple times (guarded by isSyncing).
 */
export async function triggerSync(): Promise<void> {
  if (isSyncing) return;
  
  const online = await isOnline();
  if (!online) {
    console.log('[SyncManager] Device is offline, skipping sync.');
    return;
  }

  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    console.log('[SyncManager] No authenticated user, skipping sync.');
    return;
  }

  isSyncing = true;
  console.log('[SyncManager] Starting data sync to Supabase...');

  try {
    await syncTelemetry(userId);
    await syncHydration(userId);
    await syncSleep(userId);
    console.log('[SyncManager] Sync completed successfully.');

    // Recalculate daily Agni Score after sync completes
    const todayDateStr = new Date().toISOString().split('T')[0];
    await calculateDailyAgni(userId, todayDateStr).catch(e => 
      console.warn('[SyncManager] Agni recalculation failed:', e)
    );
    
    // Recalculate daily Ojas Score after sync completes
    await calculateDailyOjas(userId, todayDateStr).catch(e => 
      console.warn('[SyncManager] Ojas recalculation failed:', e)
    );
    
    try {
      const { calculateDailyDosha } = require('./doshaEngine');
      calculateDailyDosha(userId, todayDateStr).catch((err: any) => 
        console.warn('[SyncManager] Background daily dosha calculation failed:', err)
      );
    } catch (doshaErr) {
      console.warn('[SyncManager] Could not trigger dynamic calculations:', doshaErr);
    }
  } catch (error) {
    console.error('[SyncManager] Synchronization error:', error);
  } finally {
    isSyncing = false;
    
    // Update store counts to refresh UI badges
    useTelemetryStore.getState().updatePendingCount();
    useHydrationStore.getState().updatePendingCount();
    
    try {
      const { useSleepStore } = require('../store/useSleepStore');
      useSleepStore.getState().updatePendingCount();
      useSleepStore.getState().fetchHistory(userId);
    } catch (e) {
      console.warn('[SyncManager] Failed to update sleep store counts:', e);
    }
    
    // Refresh today's logs to pull full Supabase values (e.g. replaces local temp IDs)
    useHydrationStore.getState().fetchTodayLogs(userId);

    // Refresh Agni store scores to reflect synced changes
    try {
      const { useAgniStore } = require('../store/useAgniStore');
      useAgniStore.getState().fetchTodayAgni(userId);
      useAgniStore.getState().fetchHistory(userId);
    } catch (e) {
      console.warn('[SyncManager] Failed to refresh Agni store:', e);
    }

    // Refresh Ojas store scores to reflect synced changes
    try {
      const { useOjasStore } = require('../store/useOjasStore');
      useOjasStore.getState().fetchTodayOjas(userId);
      useOjasStore.getState().fetchHistory(userId);
    } catch (e) {
      console.warn('[SyncManager] Failed to refresh Ojas store:', e);
    }
  }
}

/**
 * Sync pending biometric logs.
 */
async function syncTelemetry(userId: string): Promise<void> {
  const pendingLogs = await getPendingTelemetry();
  if (pendingLogs.length === 0) return;

  console.log(`[SyncManager] Syncing ${pendingLogs.length} telemetry logs to split tables...`);

  // Perform bulk insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < pendingLogs.length; i += batchSize) {
    const batch = pendingLogs.slice(i, i + batchSize);
    const dbIds = batch.map(log => log.id);

    // Map to split table structures - filter out 0 or invalid heart rate values
    const hrBatch = batch
      .filter(log => {
        const bpm = Number(log.heart_rate);
        return !isNaN(bpm) && bpm > 0 && bpm < 300;
      })
      .map(log => ({
        user_id: userId,
        timestamp: log.timestamp,
        bpm: Number(log.heart_rate)
      }));

    const tempBatch = batch.map(log => ({
      user_id: userId,
      timestamp: log.timestamp,
      temperature_celsius: log.skin_temperature
    }));

    const actBatch = batch.map(log => ({
      user_id: userId,
      timestamp: log.timestamp,
      steps_count: log.steps,
      activity_type: log.activity === 'still' ? 'sedentary' : log.activity,
      calories_burned_kcal: Math.round(log.steps * 0.04)
    }));

    // Perform insertions in parallel, skipping heart rate insert if batch is empty
    const insertPromises: Promise<any>[] = [];
    if (hrBatch.length > 0) {
      insertPromises.push(Promise.resolve(supabase.from('heart_rate_logs').insert(hrBatch)));
    } else {
      insertPromises.push(Promise.resolve({ error: null }));
    }
    insertPromises.push(Promise.resolve(supabase.from('temperature_logs').insert(tempBatch)));
    insertPromises.push(Promise.resolve(supabase.from('activity_logs').insert(actBatch)));

    const [hrRes, tempRes, actRes] = await Promise.all(insertPromises);

    if (hrRes.error) {
      throw new Error(`Failed to sync heart rates: ${hrRes.error.message}`);
    }
    if (tempRes.error) {
      throw new Error(`Failed to sync temperatures: ${tempRes.error.message}`);
    }
    if (actRes.error) {
      throw new Error(`Failed to sync activity logs: ${actRes.error.message}`);
    }

    // Delete synced records from local SQLite
    await deleteLocalTelemetry(dbIds);
  }
}

/**
 * Sync pending hydration logs.
 */
async function syncHydration(userId: string): Promise<void> {
  const pendingLogs = await getPendingHydration();
  if (pendingLogs.length === 0) return;

  console.log(`[SyncManager] Syncing ${pendingLogs.length} hydration logs...`);

  // Map to Supabase table schema structure
  const logsToInsert = pendingLogs.map(log => ({
    user_id: userId,
    timestamp: log.timestamp,
    amount_ml: log.amount_ml,
    source: log.source
  }));

  // Perform batch syncs
  const batchSize = 50;
  for (let i = 0; i < logsToInsert.length; i += batchSize) {
    const batch = logsToInsert.slice(i, i + batchSize);
    const dbIds = pendingLogs.slice(i, i + batchSize).map(log => log.id);

    const { error } = await supabase
      .from('hydration_logs')
      .insert(batch);

    if (error) {
      throw new Error(`Failed to sync hydration batch: ${error.message}`);
    }

    // Delete synced records from SQLite
    await deleteLocalHydration(dbIds);
  }
}

/**
 * Sync pending sleep logs.
 */
async function syncSleep(userId: string): Promise<void> {
  const pendingLogs = await getPendingSleep();
  if (pendingLogs.length === 0) return;

  console.log(`[SyncManager] Syncing ${pendingLogs.length} sleep logs...`);

  // Map to Supabase sleep_logs table structure
  const logsToInsert = pendingLogs.map(log => ({
    user_id: userId,
    start_time: log.start_time,
    end_time: log.end_time,
    duration_minutes: log.duration_minutes,
    sleep_score: log.sleep_score,
    deep_sleep_minutes: Math.round(log.duration_minutes * 0.2), // standard sleep ratios
    light_sleep_minutes: Math.round(log.duration_minutes * 0.55),
    rem_sleep_minutes: Math.round(log.duration_minutes * 0.18),
    awake_minutes: Math.round(log.duration_minutes * 0.07)
  }));

  // Perform bulk insert in batches of 50
  const batchSize = 50;
  for (let i = 0; i < logsToInsert.length; i += batchSize) {
    const batch = logsToInsert.slice(i, i + batchSize);
    const dbIds = pendingLogs.slice(i, i + batchSize).map(log => log.id);

    const { error } = await supabase
      .from('sleep_logs')
      .insert(batch);

    if (error) {
      throw new Error(`Failed to sync sleep batch: ${error.message}`);
    }

    // Delete synced records from SQLite
    await deleteLocalSleep(dbIds);
  }
}

