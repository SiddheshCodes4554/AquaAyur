import { BleManager, Device, Subscription, BleErrorCode } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { useBLEStore } from '../store/useBLEStore';
import { LiveBiometrics, OfflineTelemetry } from '../types';
import { insertLocalTelemetry, batchInsertLocalTelemetry } from './database';
import { triggerSync } from './syncManager';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { validateBiometrics } from '../utils/validation';

// Service & Characteristic UUIDs matching the BLE specification
export const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc';
export const BIOMETRICS_CHAR_UUID = 'abcd1234-5678-5678-5678-abcdef123456';
export const CONTROL_CHAR_UUID = 'e322d7de-5b2c-491c-99c7-742616238b15';

let managerInstance: BleManager | null = null;
let activeSubscription: Subscription | null = null;
let reconnectionTimeout: any = null;
let autoReconnectEnabled = true;
let isScanningActive = false;
let isAutoconnecting = false;

// Buffering and Sync Throttling variables
let telemetryBuffer: Omit<OfflineTelemetry, 'id'>[] = [];
let lastSyncTime = 0;
let flushTimer: any = null;

async function flushTelemetryBuffer() {
  if (telemetryBuffer.length === 0) return;
  const bufferToFlush = [...telemetryBuffer];
  telemetryBuffer = [];
  console.log(`[BLE] Flushing ${bufferToFlush.length} telemetry records to SQLite...`);
  try {
    await batchInsertLocalTelemetry(bufferToFlush);
    const now = Date.now();
    if (now - lastSyncTime >= 60000) {
      console.log('[BLE] Throttled sync trigger running...');
      lastSyncTime = now;
      await triggerSync();
    }
  } catch (error) {
    console.error('[BLE] Failed to flush telemetry buffer:', error);
    // Return failed records to the beginning of the buffer
    telemetryBuffer = [...bufferToFlush, ...telemetryBuffer];
  }
}

function startTelemetryFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(async () => {
    try {
      await flushTelemetryBuffer();
    } catch (e) {
      console.error('[BLE] Error in telemetry flush timer:', e);
    }
  }, 15000);
}

function stopTelemetryFlushTimer() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

/**
 * Singleton BleManager accessor.
 */
export function getBleManager(): BleManager | null {
  if (!managerInstance) {
    try {
      managerInstance = new BleManager();
    } catch (e) {
      console.error('[BLE] Failed to initialize native BleManager:', e);
      useBLEStore.getState().setError('Failed to initialize Bluetooth. Make sure native modules are built.');
      useBLEStore.getState().setStatus('error');
      managerInstance = null;
    }
  }
  return managerInstance;
}

/**
 * Request runtime location and Bluetooth permissions for Android 12+.
 */
export async function requestBLEPermissions(): Promise<boolean> {
  console.log('[BLE] requestBLEPermissions called.');
  if (Platform.OS === 'ios') {
    console.log('[BLE] iOS platform detected, bypassing PermissionsAndroid');
    return true;
  }

  if (Platform.OS === 'android') {
    console.log('[BLE] Android platform version:', Platform.Version);
    try {
      // For Android 12 (API 31) and higher
      if (Platform.Version >= 31) {
        console.log('[BLE] Requesting Android 12+ scan, connect, and location permissions');
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        console.log('[BLE] Permissions request result:', granted);

        const isScanGranted = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED;
        const isConnectGranted = granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
        const isLocationGranted = granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;

        console.log('[BLE] scan:', isScanGranted, 'connect:', isConnectGranted, 'location:', isLocationGranted);

        return isScanGranted && isConnectGranted && isLocationGranted;
      } else {
        // For older Android versions
        console.log('[BLE] Requesting legacy Android location permission');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        console.log('[BLE] Legacy permission request result:', granted);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error('[BLE] Error occurred while requesting Android permissions:', err);
      return false;
    }
  }

  return false;
}

/**
 * Decode Base64 string to standard UTF-8 string safely.
 */
function base64ToUtf8(base64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(base64);
    }
  } catch (e) {}

  // Fallback pure JavaScript base64 decoder
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64.endsWith('==')) bufferLength -= 2;
  else if (base64.endsWith('=')) bufferLength -= 1;

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const e1 = lookup[base64.charCodeAt(i)];
    const e2 = lookup[base64.charCodeAt(i + 1)];
    const e3 = lookup[base64.charCodeAt(i + 2)];
    const e4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < bufferLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < bufferLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }

  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return str;
}

/**
 * Scan for BLE devices advertising the AquaAyur service.
 */
export async function startScanning(): Promise<void> {
  const manager = getBleManager();
  
  if (!manager) {
    return;
  }

  const hasPermissions = await requestBLEPermissions();
  if (!hasPermissions) {
    useBLEStore.getState().setError('Bluetooth/Location permissions are denied.');
    useBLEStore.getState().setStatus('error');
    return;
  }

  // Verify Bluetooth radio is powered on
  try {
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      const stateLabel = state === 'PoweredOff' ? 'powered off' : state.toLowerCase();
      useBLEStore.getState().setError(`Bluetooth is ${stateLabel}. Please enable Bluetooth to scan.`);
      useBLEStore.getState().setStatus('error');
      return;
    }
  } catch (stateErr) {
    console.warn('[BLE] Could not check Bluetooth state:', stateErr);
  }

  if (isScanningActive) {
    console.log('[BLE] Scan already active. Stopping current scan first.');
    try {
      manager.stopDeviceScan();
    } catch (e) {}
    isScanningActive = false;
    isAutoconnecting = false; // Reset autoconnect guard since manual scan overrides it
  }

  useBLEStore.getState().setError(null);
  useBLEStore.getState().setStatus('scanning');
  useBLEStore.getState().clearScannedDevices();
  isScanningActive = true;

  manager.startDeviceScan(null, null, (error, device) => {
    if (error) {
      console.error('[BLE] Scan error:', error);
      useBLEStore.getState().setError(`Scan failed: ${error.message}`);
      useBLEStore.getState().setStatus('error');
      try {
        manager.stopDeviceScan();
      } catch (e) {}
      isScanningActive = false;
      return;
    }

    if (device) {
      // Add all discovered devices. Categorization/filtering is handled in the UI.
      useBLEStore.getState().addScannedDevice(device);
    }
  });

  // Stop scanning automatically after 15 seconds to save power
  setTimeout(() => {
    if (useBLEStore.getState().status === 'scanning') {
      stopScanning();
    }
  }, 15000);
}

/**
 * Stop active BLE scanning.
 */
export function stopScanning(): void {
  const manager = getBleManager();
  if (manager) {
    try {
      manager.stopDeviceScan();
    } catch (e) {}
  }
  isScanningActive = false;
  if (useBLEStore.getState().status === 'scanning') {
    useBLEStore.getState().setStatus('idle');
  }
}

/**
 * Connect to a selected peripheral device.
 */
export async function connectToDevice(device: Device): Promise<void> {
  const currentStatus = useBLEStore.getState().status;
  if (currentStatus === 'connecting' || currentStatus === 'connected') {
    console.log('[BLE] Already connecting or connected. Ignoring duplicate request.');
    return;
  }

  stopScanning();
  useBLEStore.getState().setStatus('connecting');
  useBLEStore.getState().setError(null);
  autoReconnectEnabled = true;

  try {
    const isAlreadyConnected = await device.isConnected();
    let connectedDevice: Device;
    
    if (isAlreadyConnected) {
      console.log('[BLE] Device is already connected, reusing connection.');
      connectedDevice = device;
    } else {
      connectedDevice = await device.connect();
    }
    console.log('[BLE] Connected to device:', connectedDevice.name);
    
    // Discover all services & characteristics
    await connectedDevice.discoverAllServicesAndCharacteristics();
    
    // Log all discovered services and characteristics for debugging UUIDs
    try {
      const services = await connectedDevice.services();
      console.log('[BLE] Discovered Services & Characteristics for:', connectedDevice.name || connectedDevice.id);
      for (const service of services) {
        console.log(`  + Service UUID: ${service.uuid}`);
        const characteristics = await service.characteristics();
        for (const char of characteristics) {
          console.log(`    - Characteristic UUID: ${char.uuid} (Notify: ${char.isNotifiable}, Read: ${char.isReadable}, Write: ${char.isWritableWithResponse || char.isWritableWithoutResponse})`);
        }
      }
    } catch (discoveryErr) {
      console.warn('[BLE] Could not retrieve services/characteristics metadata:', discoveryErr);
    }
    
    // Attempt to negotiate MTU size for larger JSON payloads (128 bytes target)
    try {
      if (Platform.OS === 'android') {
        await connectedDevice.requestMTU(128);
      }
    } catch (mtuErr) {
      console.log('[BLE] MTU request rejected, using default MTU size.');
    }

    useBLEStore.getState().setConnectedDevice(connectedDevice);
    useBLEStore.getState().setStatus('connected');

    // Persist pairing in database
    savePairingToDatabase(device.id, device.name || 'AquaAyur Wearable')
      .catch(err => console.log('[BLE] DB pairing save error:', err));

    // Subscribe to disconnect events
    device.onDisconnected((err, disconnectedDevice) => {
      console.log('[BLE] Device disconnected.');
      useBLEStore.getState().setConnectedDevice(null);
      useBLEStore.getState().setLiveData(null as any);
      
      // Flush leftover buffer and stop timer
      flushTelemetryBuffer().catch(e => console.error('[BLE] Error flushing buffer on disconnect:', e));
      stopTelemetryFlushTimer();
      
      if (autoReconnectEnabled) {
        useBLEStore.getState().setStatus('connecting');
        handleReconnection(device);
      } else {
        useBLEStore.getState().setStatus('idle');
      }
    });

    // Start streaming notifications
    await startStreamingData(connectedDevice);

  } catch (error: any) {
    console.error('[BLE] Connection failed:', error);
    useBLEStore.getState().setError(`Connection failed: ${error.message}`);
    useBLEStore.getState().setStatus('error');
  }
}

/**
 * Disconnect from the currently paired device.
 */
export async function disconnectDevice(): Promise<void> {
  autoReconnectEnabled = false;
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  
  if (activeSubscription) {
    activeSubscription.remove();
    activeSubscription = null;
  }

  // Flush leftover buffer and stop timer
  await flushTelemetryBuffer().catch(e => console.error('[BLE] Error flushing buffer on manual disconnect:', e));
  stopTelemetryFlushTimer();

  const device = useBLEStore.getState().connectedDevice;
  if (device) {
    useBLEStore.getState().setStatus('disconnecting');
    try {
      await device.cancelConnection();
      console.log('[BLE] Clean disconnect complete.');
      // Deactivate pairing record
      await deactivatePairingInDatabase(device.id);
    } catch (e) {
      console.warn('[BLE] Disconnect error:', e);
    }
  }

  useBLEStore.getState().resetBLEStore();
}

/**
 * Reconnect handling with linear-backoff retry.
 */
function handleReconnection(device: Device) {
  if (reconnectionTimeout) clearTimeout(reconnectionTimeout);
  
  console.log('[BLE] Attempting reconnection in 5 seconds...');
  reconnectionTimeout = setTimeout(async () => {
    if (!autoReconnectEnabled) return;
    try {
      await connectToDevice(device);
    } catch (e) {
      handleReconnection(device);
    }
  }, 5000);
}

/**
 * Subscribe to characteristic notifications.
 */
async function startStreamingData(device: Device): Promise<void> {
  if (activeSubscription) {
    activeSubscription.remove();
    activeSubscription = null;
  }

  // Start telemetry flush timer
  startTelemetryFlushTimer();

  activeSubscription = device.monitorCharacteristicForService(
    SERVICE_UUID,
    BIOMETRICS_CHAR_UUID,
    async (error, char) => {
      if (error) {
        const errMsg = (error.message || '').toLowerCase();
        if (
          errMsg.includes('cancelled') ||
          errMsg.includes('canceled') ||
          errMsg.includes('destroyed') ||
          error.errorCode === BleErrorCode.OperationCancelled ||
          error.errorCode === BleErrorCode.BluetoothManagerDestroyed
        ) {
          console.log('[BLE] Streaming monitor subscription cancelled cleanly.');
          return;
        }
        console.error('[BLE] Streaming characteristic monitoring error:', error);
        useBLEStore.getState().setError('Target BLE Service or Characteristic not found. Check console logs for details.');
        useBLEStore.getState().setStatus('error');
        return;
      }

      if (char?.value) {
        try {
          // 1. Decode base64 value
          const rawString = base64ToUtf8(char.value);
          
          // 2. Parse JSON
          const payload = JSON.parse(rawString);
          
          // 3. Inject client-side timestamp and temperature if missing from firmware
          if (payload.timestamp === undefined || payload.timestamp === null) {
            payload.timestamp = Date.now();
          }
          if (payload.temperature === undefined || payload.temperature === null) {
            payload.temperature = 36.5; // default normal skin temperature in C
          }

          // 4. Validate raw payload
          const validation = validateBiometrics(payload);
          if (!validation.isValid) {
            console.warn('[BLE] Rejected invalid biometrics payload:', validation.errors, rawString);
            return;
          }

          // 5. Decode timestamp (epoch to Date)
          const epoch = Number(payload.timestamp);
          const dateObj = new Date(epoch);

          const isNoFinger = String(payload.heartRate).trim() === 'No Finger';
          const hrVal = isNoFinger ? 0 : Number(payload.heartRate);

          let activityVal = String(payload.activity).trim().toLowerCase();
          if (activityVal === 'still') {
            activityVal = 'sedentary';
          }

          const biometrics: LiveBiometrics = {
            heartRate: hrVal,
            temperature: Number(payload.temperature),
            steps: Number(payload.steps),
            activity: activityVal,
            timestamp: dateObj
          };

          // 5. Update Zustand Store for real-time dashboard UI
          useBLEStore.getState().setLiveData(biometrics);

          // 6. Push to local memory buffer instead of writing directly to SQLite
          telemetryBuffer.push({
            timestamp: dateObj.toISOString(),
            heart_rate: biometrics.heartRate,
            skin_temperature: biometrics.temperature,
            steps: biometrics.steps,
            activity: biometrics.activity
          });

        } catch (parseError) {
          console.warn('[BLE] Failed to parse biometrics payload:', parseError, char.value);
        }
      }
    }
  );
}

/**
 * Send control packets to the device.
 * E.g., send '0x01' to trigger haptic feedback or LED alerts.
 */
export async function sendControlCommand(commandCode: number): Promise<void> {
  const device = useBLEStore.getState().connectedDevice;
  if (!device) {
    console.warn('[BLE] Cannot send control command: No device connected.');
    return;
  }

  try {
    // base64 encode the 1 byte command code
    const buffer = new Uint8Array([commandCode]);
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    const base64Command = btoa(binary);

    try {
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CONTROL_CHAR_UUID,
        base64Command
      );
      console.log(`[BLE] Successfully wrote control code: ${commandCode} to ${CONTROL_CHAR_UUID}`);
    } catch (writeErr: any) {
      // If the control characteristic is not found, fallback to BIOMETRICS_CHAR_UUID which has Write: true
      const errMsg = writeErr?.message || '';
      if (errMsg.includes('not found') || errMsg.includes('missing') || errMsg.includes('Characteristic')) {
        console.log(`[BLE] CONTROL_CHAR_UUID not found. Falling back to BIOMETRICS_CHAR_UUID...`);
        await device.writeCharacteristicWithResponseForService(
          SERVICE_UUID,
          BIOMETRICS_CHAR_UUID,
          base64Command
        );
        console.log(`[BLE] Successfully wrote control code: ${commandCode} to fallback ${BIOMETRICS_CHAR_UUID}`);
      } else {
        throw writeErr;
      }
    }
  } catch (error) {
    console.error('[BLE] Failed to write control characteristic:', error);
  }
}

/**
 * Save user pairing record to Supabase backend database.
 */
export async function savePairingToDatabase(deviceId: string, deviceName: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  try {
    // 1. Ensure device exists in devices table
    const { data: deviceRecord, error: devError } = await supabase
      .from('devices')
      .upsert({ mac_address: deviceId, device_name: deviceName }, { onConflict: 'mac_address' })
      .select()
      .single();

    if (devError) throw devError;

    // 2. Clear other active pairings for this user
    await supabase
      .from('pairings')
      .update({ is_active: false })
      .eq('user_id', userId);

    // 3. Mark this pairing as active
    const { error: pairError } = await supabase
      .from('pairings')
      .upsert({
        user_id: userId,
        device_id: deviceRecord.id,
        is_active: true,
        last_connected_at: new Date().toISOString()
      }, { onConflict: 'user_id,device_id' });

    if (pairError) throw pairError;
    console.log('[BLE] Active pairing persisted in database.');
  } catch (error) {
    console.warn('[BLE] Failed to persist pairing details in database:', error);
  }
}

/**
 * Deactivate user pairing in Supabase backend.
 */
export async function deactivatePairingInDatabase(deviceId: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  try {
    const { data: deviceRecord } = await supabase
      .from('devices')
      .select('id')
      .eq('mac_address', deviceId)
      .single();

    if (deviceRecord) {
      await supabase
        .from('pairings')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('device_id', deviceRecord.id);
      console.log('[BLE] Pairing deactivated in database.');
    }
  } catch (error) {
    console.warn('[BLE] Failed to deactivate pairing in database:', error);
  }
}

/**
 * Fetch last active pairing and auto-connect in background.
 */
export async function autoConnectLastPairedDevice(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  if (isAutoconnecting) {
    console.log('[BLE] Autoconnect already in progress. Bypassing duplicate call.');
    return;
  }
  isAutoconnecting = true;

  try {
    const { data: pairingRecord, error } = await supabase
      .from('pairings')
      .select('*, devices(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error || !pairingRecord || !pairingRecord.devices) {
      console.log('[BLE] No active paired device stored in database.');
      isAutoconnecting = false;
      return;
    }

    const deviceMac = pairingRecord.devices.mac_address;
    const deviceName = pairingRecord.devices.device_name;
    console.log('[BLE] Auto-connect target paired device found:', deviceMac);

    const manager = getBleManager();
    if (!manager) {
      isAutoconnecting = false;
      return;
    }

    const hasPermissions = await requestBLEPermissions();
    if (!hasPermissions) {
      isAutoconnecting = false;
      return;
    }

    // Verify Bluetooth radio is powered on
    try {
      const state = await manager.state();
      if (state !== 'PoweredOn') {
        console.log('[BLE] Bluetooth is not PoweredOn during autoconnect. Bypassing scan.');
        isAutoconnecting = false;
        return;
      }
    } catch (stateErr) {
      console.warn('[BLE] Could not check Bluetooth state during autoconnect:', stateErr);
    }

    if (isScanningActive) {
      console.log('[BLE] Scan already active during autoconnect. Stopping current scan first.');
      try {
        manager.stopDeviceScan();
      } catch (e) {}
      isScanningActive = false;
    }

    useBLEStore.getState().setStatus('connecting');
    isScanningActive = true;

    // Run custom target scan
    manager.startDeviceScan(null, null, async (scanErr, device) => {
      if (scanErr) {
        console.error('[BLE] Autoconnect scan error:', scanErr);
        isScanningActive = false;
        isAutoconnecting = false;
        return;
      }

      if (device && device.id === deviceMac) {
        try {
          manager.stopDeviceScan();
        } catch (e) {}
        isScanningActive = false;
        isAutoconnecting = false;
        try {
          await connectToDevice(device);
        } catch (connErr) {
          console.warn('[BLE] Background connection retry failed:', connErr);
        }
      }
    });

    // Auto-stop background scan after 20s to conserve battery
    setTimeout(() => {
      if (manager && isScanningActive) {
        try {
          manager.stopDeviceScan();
        } catch (e) {}
        isScanningActive = false;
        isAutoconnecting = false;
      }
      if (useBLEStore.getState().status === 'connecting' && !useBLEStore.getState().connectedDevice) {
        useBLEStore.getState().setStatus('idle');
      }
    }, 20000);

  } catch (error) {
    console.warn('[BLE] Failed autoConnectLastPairedDevice initialization:', error);
    isAutoconnecting = false;
  }
}
