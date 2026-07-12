import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LiveBiometrics } from '../types';

export interface SensorData extends Omit<LiveBiometrics, 'timestamp'> {
  sleep: number;
  stress: number;
  hydration: number;
  battery: number;
  timestamp: string; // ISO String
}

export type DataSourceMode = 'physical' | 'simulator';
export type SensorStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnecting' | 'error';
export type ActivityType = 'Resting' | 'Walking' | 'Running' | 'Cycling' | 'Sleeping' | 'Meditating';

export interface SimulatorSettings {
  heartRate: number;
  temperature: number;
  steps: number;
  activity: ActivityType;
  battery: number;
  sleepQuality: number;
  stress: number;
  hydration: number;
  
  autoIncrementSteps: boolean;
  isPaused: boolean;
  packetCount: number;
  uptimeSeconds: number;
  connectionQuality: number;
  activeScenarioName: string;
}

interface SensorState {
  dataSource: DataSourceMode;
  status: SensorStatus;
  liveData: SensorData | null;
  simulatorSettings: SimulatorSettings;
  errorMsg: string | null;

  setDataSource: (mode: DataSourceMode) => void;
  setStatus: (status: SensorStatus) => void;
  setLiveData: (data: SensorData | null) => void;
  setError: (msg: string | null) => void;
  
  // Simulator Controls
  updateSimulatorSetting: <K extends keyof SimulatorSettings>(key: K, value: SimulatorSettings[K]) => void;
  resetSimulatorSettings: () => void;
  incrementPacket: () => void;
  tickUptime: () => void;
  resetUptimeAndPackets: () => void;
}

const defaultSettings: SimulatorSettings = {
  heartRate: 72,
  temperature: 36.5,
  steps: 4200,
  activity: 'Resting',
  battery: 100,
  sleepQuality: 82,
  stress: 30,
  hydration: 80,
  autoIncrementSteps: false,
  isPaused: false,
  packetCount: 0,
  uptimeSeconds: 0,
  connectionQuality: 100,
  activeScenarioName: 'Healthy Adult'
};

export const useSensorStore = create<SensorState>()(
  persist(
    (set) => ({
      dataSource: 'simulator', // Default mode as requested: Simulator
      status: 'idle',
      liveData: null,
      errorMsg: null,
      simulatorSettings: { ...defaultSettings },

      setDataSource: (dataSource) => set({ dataSource }),
      setStatus: (status) => set({ status }),
      setLiveData: (liveData) => set({ liveData }),
      setError: (errorMsg) => set({ errorMsg }),

      updateSimulatorSetting: (key, value) =>
        set((state) => ({
          simulatorSettings: {
            ...state.simulatorSettings,
            [key]: value
          }
        })),

      resetSimulatorSettings: () =>
        set((state) => ({
          simulatorSettings: {
            ...defaultSettings,
            steps: state.simulatorSettings.steps // Keep steps so they don't reset to default unless asked
          }
        })),

      incrementPacket: () =>
        set((state) => ({
          simulatorSettings: {
            ...state.simulatorSettings,
            packetCount: state.simulatorSettings.packetCount + 1
          }
        })),

      tickUptime: () =>
        set((state) => ({
          simulatorSettings: {
            ...state.simulatorSettings,
            uptimeSeconds: state.simulatorSettings.uptimeSeconds + 1
          }
        })),

      resetUptimeAndPackets: () =>
        set((state) => ({
          simulatorSettings: {
            ...state.simulatorSettings,
            uptimeSeconds: 0,
            packetCount: 0
          }
        }))
    }),
    {
      name: 'aquaayur-sensor-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dataSource: state.dataSource,
        simulatorSettings: {
          ...state.simulatorSettings,
          isPaused: state.simulatorSettings.isPaused // Persist pause state, but skip loop variables if needed
        }
      })
    }
  )
);
