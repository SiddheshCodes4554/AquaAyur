import { create } from 'zustand';
import { Device } from 'react-native-ble-plx';

import { ConnectionStatus, LiveBiometrics } from '../types';

interface BLEState {
  status: ConnectionStatus;
  scannedDevices: Device[];
  connectedDevice: Device | null;
  liveData: LiveBiometrics | null;
  errorMsg: string | null;
  
  setStatus: (status: ConnectionStatus) => void;
  setScannedDevices: (devices: Device[]) => void;
  addScannedDevice: (device: Device) => void;
  clearScannedDevices: () => void;
  setConnectedDevice: (device: Device | null) => void;
  setLiveData: (data: LiveBiometrics) => void;
  setError: (msg: string | null) => void;
  resetBLEStore: () => void;
}

export const useBLEStore = create<BLEState>((set) => ({
  status: 'idle',
  scannedDevices: [],
  connectedDevice: null,
  liveData: null,
  errorMsg: null,

  setStatus: (status) => set({ status }),
  
  setScannedDevices: (scannedDevices) => set({ scannedDevices }),
  
  addScannedDevice: (device) => set((state) => {
    // Avoid duplicate listings
    if (state.scannedDevices.some(d => d.id === device.id)) {
      return state;
    }
    return { scannedDevices: [...state.scannedDevices, device] };
  }),
  
  clearScannedDevices: () => set({ scannedDevices: [] }),
  
  setConnectedDevice: (connectedDevice) => set({ connectedDevice }),
  
  setLiveData: (liveData) => set({ liveData }),
  
  setError: (errorMsg) => set({ errorMsg }),

  resetBLEStore: () => set({
    status: 'idle',
    scannedDevices: [],
    connectedDevice: null,
    liveData: null,
    errorMsg: null
  })
}));
