import { create } from 'zustand';
import { LiveBiometrics } from '../types';

export interface SensorData extends Omit<LiveBiometrics, 'timestamp'> {
  sleep: number;
  stress: number;
  hydration: number;
  battery: number;
  timestamp: string; // ISO String
}

export type SensorStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnecting' | 'error';

interface SensorState {
  status: SensorStatus;
  liveData: SensorData | null;
  errorMsg: string | null;

  setStatus: (status: SensorStatus) => void;
  setLiveData: (data: SensorData | null) => void;
  setError: (msg: string | null) => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  status: 'idle',
  liveData: null,
  errorMsg: null,

  setStatus: (status) => set({ status }),
  setLiveData: (liveData) => set({ liveData }),
  setError: (errorMsg) => set({ errorMsg }),
}));
