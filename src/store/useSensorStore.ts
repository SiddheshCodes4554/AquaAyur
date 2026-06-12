import { create } from 'zustand';
import { LiveBiometrics } from '../types';

export type SensorStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

interface SensorState {
  liveData: LiveBiometrics | null;
  status: SensorStatus;
  
  setLiveData: (data: LiveBiometrics | null) => void;
  setStatus: (status: SensorStatus) => void;
}

export const useSensorStore = create<SensorState>((set) => ({
  liveData: null,
  status: 'idle',

  setLiveData: (liveData) => set({ liveData }),
  setStatus: (status) => set({ status }),
}));
