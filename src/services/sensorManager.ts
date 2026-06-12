import { useSensorStore } from '../store/useSensorStore';
import { useBLEStore } from '../store/useBLEStore';
import { useAuthStore } from '../store/useAuthStore';
import { autoConnectLastPairedDevice } from './bleManager';

// 1. Subscribe to BLE store changes to sync to unified sensor store
useBLEStore.subscribe((bleState) => {
  useSensorStore.getState().setLiveData(bleState.liveData);
  useSensorStore.getState().setStatus(bleState.status as any);
});

// 2. Subscribe to auth store changes to trigger auto-connect when user session is loaded
useAuthStore.subscribe((authState) => {
  const userId = authState.user?.id;
  if (userId) {
    autoConnectLastPairedDevice().catch((err: any) => console.log('[BLE] Background autoconnect error:', err));
  } else {
    useSensorStore.getState().setLiveData(null);
    useSensorStore.getState().setStatus('idle');
  }
});

/**
 * Initializes the sensor management system (auto-connect check).
 */
export async function initializeSensorMode(userId?: string) {
  // Sync useSensorStore with current BLE store values
  const bleState = useBLEStore.getState();
  useSensorStore.getState().setLiveData(bleState.liveData);
  useSensorStore.getState().setStatus(bleState.status as any);

  // Trigger auto-connect checks for previously paired hardware
  const activeUserId = userId || useAuthStore.getState().user?.id;
  if (activeUserId) {
    autoConnectLastPairedDevice().catch((err: any) => console.log('[BLE] Background autoconnect error:', err));
  }
}

/**
 * Reads the persisted telemetry configuration on application startup.
 */
export async function loadSavedSensorMode() {
  const userId = useAuthStore.getState().user?.id;
  await initializeSensorMode(userId);
}
