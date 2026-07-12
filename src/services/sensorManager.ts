import { useSensorStore, SensorData, SensorStatus, DataSourceMode } from '../store/useSensorStore';
import { useBLEStore } from '../store/useBLEStore';
import { useAuthStore } from '../store/useAuthStore';
import { startSimulatorStream, stopSimulatorStream } from './simulatorEngine';
import { 
  autoConnectLastPairedDevice, 
  disconnectDevice, 
  startScanning, 
  stopScanning, 
  connectToDevice 
} from './bleManager';

const subscribers = new Set<(data: SensorData) => void>();

// Low-level BLE sync listener: when the physical BLE status or data updates, sync it to the unified SensorStore
useBLEStore.subscribe((bleState) => {
  const store = useSensorStore.getState();
  if (store.dataSource !== 'physical') return;

  store.setStatus(bleState.status as any);
  
  if (bleState.liveData) {
    const unifiedData: SensorData = {
      heartRate: bleState.liveData.heartRate,
      temperature: bleState.liveData.temperature,
      steps: bleState.liveData.steps,
      activity: bleState.liveData.activity,
      sleep: 80, // Default sleep quality baseline for BLE device feed
      stress: 25, // Default stress baseline
      hydration: 75, // Default hydration baseline
      battery: 85, // Default battery level
      timestamp: bleState.liveData.timestamp.toISOString()
    };
    store.setLiveData(unifiedData);
    
    // Notify JavaScript subscribers
    subscribers.forEach(cb => cb(unifiedData));
  } else {
    store.setLiveData(null);
  }
});

// Unified SensorStore data change listener: when liveData changes (from BLE or Simulator), notify direct JS subscribers
useSensorStore.subscribe((state) => {
  if (state.liveData) {
    subscribers.forEach(cb => cb(state.liveData!));
  }
});

// Auto-connect trigger on auth state changes
useAuthStore.subscribe((authState) => {
  const userId = authState.user?.id;
  if (userId) {
    initializeSensorMode(userId).catch(err => console.log('[SensorManager] Init error:', err));
  } else {
    const store = useSensorStore.getState();
    if (store.dataSource === 'simulator') {
      stopSimulatorStream();
    } else {
      disconnectDevice().catch(err => console.log(err));
    }
    store.setLiveData(null);
    store.setStatus('idle');
  }
});

/**
 * Initializes the unified sensor mode based on stored settings.
 */
export async function initializeSensorMode(userId?: string) {
  const store = useSensorStore.getState();
  const activeUserId = userId || useAuthStore.getState().user?.id;
  if (!activeUserId) return;

  if (store.dataSource === 'simulator') {
    console.log('[SensorManager] Initializing in Simulator Mode...');
    startSimulatorStream();
  } else {
    console.log('[SensorManager] Initializing in Physical BLE Mode...');
    autoConnectLastPairedDevice().catch(err => console.log('[SensorManager] BLE autoconnect error:', err));
  }
}

/**
 * Switches the sensor mode (physical vs. simulator) and performs necessary disconnections/reconnections.
 */
export async function switchSensorMode(mode: DataSourceMode): Promise<void> {
  const store = useSensorStore.getState();
  if (store.dataSource === mode) return;

  console.log(`[SensorManager] Toggling sensor mode: ${store.dataSource} -> ${mode}`);
  
  // 1. Disconnect active provider
  if (store.dataSource === 'simulator') {
    stopSimulatorStream();
  } else {
    await disconnectDevice().catch(err => console.log('[SensorManager] BLE disconnect error:', err));
  }

  // 2. Set new mode
  store.setDataSource(mode);

  // 3. Connect/Activate new provider
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    if (mode === 'simulator') {
      startSimulatorStream();
    } else {
      await autoConnectLastPairedDevice().catch(err => console.log('[SensorManager] BLE autoconnect error:', err));
    }
  }
}

/**
 * Global Sensor Provider methods mapping to the active Provider mode.
 */
export const SensorManager = {
  async connect(deviceId?: string): Promise<void> {
    const store = useSensorStore.getState();
    if (store.dataSource === 'simulator') {
      startSimulatorStream();
    } else {
      // Connect to BLE peripheral
      if (deviceId) {
        const scanned = useBLEStore.getState().scannedDevices;
        const target = scanned.find(d => d.id === deviceId);
        if (target) {
          await connectToDevice(target);
        } else {
          throw new Error(`Device ID ${deviceId} not found in BLE scan cache.`);
        }
      } else {
        await autoConnectLastPairedDevice();
      }
    }
  },

  async disconnect(): Promise<void> {
    const store = useSensorStore.getState();
    if (store.dataSource === 'simulator') {
      stopSimulatorStream();
    } else {
      await disconnectDevice();
    }
  },

  async startStreaming(): Promise<void> {
    const store = useSensorStore.getState();
    if (store.dataSource === 'simulator') {
      startSimulatorStream();
    } else {
      // BLE streaming starts automatically on connect
      console.log('[SensorManager] BLE streaming active upon peripheral notification bind.');
    }
  },

  async stopStreaming(): Promise<void> {
    const store = useSensorStore.getState();
    if (store.dataSource === 'simulator') {
      stopSimulatorStream();
    } else {
      // In BLE, we can stop the active notifications monitor by disconnecting or ignoring characteristics
      console.log('[SensorManager] Stopping BLE streaming requires device disconnect.');
    }
  },

  subscribe(callback: (data: SensorData) => void): () => void {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },

  unsubscribe(callback: (data: SensorData) => void): void {
    subscribers.delete(callback);
  },

  getConnectionStatus(): SensorStatus {
    return useSensorStore.getState().status;
  }
};

/**
 * Reads the persisted telemetry configuration on application startup.
 */
export async function loadSavedSensorMode() {
  const userId = useAuthStore.getState().user?.id;
  await initializeSensorMode(userId);
}
