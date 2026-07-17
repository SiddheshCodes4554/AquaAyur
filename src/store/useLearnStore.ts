import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string; // Ionicons name
  unlockedAt: string;
}

interface LearnState {
  completedLessons: string[];
  xp: number;
  dailyStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  achievements: Achievement[];
  activeLessonId: string | null;

  completeLesson: (lessonId: string, xpReward: number) => { unlocked: Achievement[] };
  checkAndResetStreak: () => void;
  resetProgress: () => void;
  setActiveLessonId: (id: string | null) => void;
}

export const AVAILABLE_ACHIEVEMENTS = [
  { id: 'first_lesson', name: 'First Steps', desc: 'Completed your very first lesson', icon: 'ribbon-outline' },
  { id: 'dosha_explorer', name: 'Dosha Explorer', desc: 'Learned about Vata, Pitta, and Kapha', icon: 'compass-outline' },
  { id: 'agni_scholar', name: 'Agni Scholar', desc: 'Mastered the metabolic fire concepts', icon: 'flame-outline' },
  { id: 'circadian_yogi', name: 'Circadian Yogi', desc: 'Completed the Dinacharya circadian lesson', icon: 'sunny-outline' },
  { id: 'ayur_master', name: 'Ayur Master', desc: 'Finished all 10 foundational lessons', icon: 'trophy-outline' }
];

export const useLearnStore = create<LearnState>()(
  persist(
    (set, get) => ({
      completedLessons: [],
      xp: 0,
      dailyStreak: 0,
      lastActiveDate: null,
      achievements: [],
      activeLessonId: null,

      completeLesson: (lessonId, xpReward) => {
        const { completedLessons, xp, dailyStreak, lastActiveDate, achievements } = get();
        const todayStr = new Date().toISOString().split('T')[0];

        // 1. Update completed lessons list
        const updatedCompleted = completedLessons.includes(lessonId)
          ? completedLessons
          : [...completedLessons, lessonId];

        // 2. Calculate Streak
        let updatedStreak = dailyStreak;
        if (!lastActiveDate) {
          updatedStreak = 1;
        } else {
          const lastActive = new Date(lastActiveDate);
          const today = new Date(todayStr);
          const diffTime = today.getTime() - lastActive.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            updatedStreak += 1;
          } else if (diffDays > 1) {
            updatedStreak = 1;
          }
        }

        // 3. Add XP
        const isNewCompletion = !completedLessons.includes(lessonId);
        const addedXp = isNewCompletion ? xpReward : 5; // Less XP for repeats
        const updatedXp = xp + addedXp;

        // 4. Check achievements to unlock
        const unlocked: Achievement[] = [];
        const currentIds = achievements.map(a => a.id);

        const checkUnlock = (id: string) => {
          if (currentIds.includes(id)) return;
          const template = AVAILABLE_ACHIEVEMENTS.find(a => a.id === id);
          if (template) {
            unlocked.push({
              ...template,
              unlockedAt: new Date().toISOString()
            });
          }
        };

        // First lesson check
        checkUnlock('first_lesson');

        // Dosha Explorer check (Vata, Pitta, Kapha lessons completed)
        if (
          updatedCompleted.includes('vata') && 
          updatedCompleted.includes('pitta') && 
          updatedCompleted.includes('kapha')
        ) {
          checkUnlock('dosha_explorer');
        }

        // Agni Scholar check
        if (updatedCompleted.includes('agni')) {
          checkUnlock('agni_scholar');
        }

        // Circadian Yogi check
        if (updatedCompleted.includes('dinacharya')) {
          checkUnlock('circadian_yogi');
        }

        // Master check (10 lessons completed)
        if (updatedCompleted.length >= 10) {
          checkUnlock('ayur_master');
        }

        const updatedAchievements = [...achievements, ...unlocked];

        set({
          completedLessons: updatedCompleted,
          xp: updatedXp,
          dailyStreak: updatedStreak,
          lastActiveDate: todayStr,
          achievements: updatedAchievements
        });

        return { unlocked };
      },

      checkAndResetStreak: () => {
        const { lastActiveDate, dailyStreak } = get();
        if (!lastActiveDate) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const lastActive = new Date(lastActiveDate);
        const today = new Date(todayStr);
        const diffTime = today.getTime() - lastActive.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 1 && dailyStreak > 0) {
          set({ dailyStreak: 0 }); // Streak reset due to inactivity
        }
      },

      resetProgress: () => {
        set({
          completedLessons: [],
          xp: 0,
          dailyStreak: 0,
          lastActiveDate: null,
          achievements: [],
          activeLessonId: null
        });
      },

      setActiveLessonId: (id) => {
        set({ activeLessonId: id });
      }
    }),
    {
      name: 'aquaayur-learn-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
