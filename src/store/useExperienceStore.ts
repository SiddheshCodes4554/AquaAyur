import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ExperienceMode = 'wellness' | 'evidence';
export type LocaleType = 'en' | 'sa';

interface ExperienceState {
  mode: ExperienceMode;
  locale: LocaleType;
  welcomeDismissed: boolean;
  setMode: (mode: ExperienceMode) => void;
  setLocale: (locale: LocaleType) => void;
  setWelcomeDismissed: (welcomeDismissed: boolean) => void;
}

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      mode: 'wellness',
      locale: 'en',
      welcomeDismissed: false,
      setMode: (mode) => set({ mode }),
      setLocale: (locale) => set({ locale }),
      setWelcomeDismissed: (welcomeDismissed) => set({ welcomeDismissed }),
    }),
    {
      name: 'aquaayur-experience-mode',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
