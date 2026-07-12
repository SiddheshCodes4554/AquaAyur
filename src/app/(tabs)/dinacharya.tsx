import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { useDinacharyaStore } from '../../store/useDinacharyaStore';
import { useHydrationStore } from '../../store/useHydrationStore';
import { useSleepStore } from '../../store/useSleepStore';

type RoutineTab = 'morning' | 'afternoon' | 'evening';

interface RoutineItem {
  key: string;
  title: string;
  recommendation: string;
  timeLabel: string;
  iconName: keyof typeof Ionicons.glyphMap;
  colorClass: string;
  gradientColors: [string, string];
}

export default function DinacharyaScreen() {
  const { user } = useAuthStore();
  const { todayDinacharya, completions, reminders, loading, fetchTodayDinacharya, toggleTaskCompletion, toggleReminder } = useDinacharyaStore();
  const todayTotalMl = useHydrationStore(state => state.todayTotalMl);
  const waterGoal = useAuthStore(state => state.profile?.daily_water_goal_ml || 2500);

  const getInitialTab = (): RoutineTab => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const [activeTab, setActiveTab] = useState<RoutineTab>(getInitialTab());

  // Quick Action Modal States
  const [showSleepLogger, setShowSleepLogger] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState('8');
  const [sleepScoreInput, setSleepScoreInput] = useState('80');
  const [loggingSleep, setLoggingSleep] = useState(false);

  const [showHydrationModal, setShowHydrationModal] = useState(false);

  // Breathing Coach State
  const [showBreathingCoach, setShowBreathingCoach] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'Idle' | 'Inhale' | 'Hold' | 'Exhale'>('Idle');
  const [breathingProgress, setBreathingProgress] = useState(0);
  const [breathingCycles, setBreathingCycles] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchTodayDinacharya(user.id);
    }
  }, [user?.id]);

  // Breathing coach timer logic
  useEffect(() => {
    if (breathingPhase === 'Idle') {
      setBreathingProgress(0);
      return;
    }
    let interval: any;
    let ticks = 0;
    const phaseDurations = { Inhale: 4, Hold: 4, Exhale: 4 };

    interval = setInterval(() => {
      ticks += 1;
      const duration = phaseDurations[breathingPhase];
      const progress = (ticks / (duration * 10)) * 100;
      setBreathingProgress(progress);

      if (ticks >= duration * 10) {
        ticks = 0;
        if (breathingPhase === 'Inhale') {
          setBreathingPhase('Hold');
        } else if (breathingPhase === 'Hold') {
          setBreathingPhase('Exhale');
        } else if (breathingPhase === 'Exhale') {
          setBreathingCycles(c => c + 1);
          setBreathingPhase('Inhale');
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [breathingPhase]);

  const handleLogSleep = async () => {
    if (!user?.id) return;
    const hours = parseFloat(sleepHoursInput);
    const score = parseInt(sleepScoreInput, 10);
    if (isNaN(hours) || isNaN(score)) {
      Alert.alert('Error', 'Please enter valid numbers');
      return;
    }
    setLoggingSleep(true);
    try {
      const durationMinutes = Math.round(hours * 60);
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - durationMinutes * 60 * 1000).toISOString();
      await useSleepStore.getState().logSleep(user.id, startTime, endTime, durationMinutes, score);
      setShowSleepLogger(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to log sleep');
    } finally {
      setLoggingSleep(false);
    }
  };

  if (loading && !todayDinacharya) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#34d399" />
          <Text className="text-emerald-400 mt-4 font-semibold">Aligning Circadian Plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Parse time of day from text or provide defaults
  const getWakeUpTime = () => {
    const text = todayDinacharya?.wake_up_rec || '';
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    return match ? match[0] : '6:00 AM';
  };

  const getHydrationTime = () => {
    return '7:00 AM';
  };

  const getMealTime = () => {
    const text = todayDinacharya?.meal_timing_rec || '';
    const match = text.match(/lunch at (\d{1,2}):(\d{2})\s*(AM|PM)/i);
    return match ? match[0].replace('lunch at ', '') : '12:30 PM';
  };

  const getExerciseTime = () => {
    const text = todayDinacharya?.exercise_timing_rec || '';
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    return match ? match[0] : '4:30 PM';
  };

  const getSleepTime = () => {
    const text = todayDinacharya?.sleep_timing_rec || '';
    const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    return match ? match[0] : '10:00 PM';
  };

  // Build the list of routine items based on the loaded Dinacharya recommendations
  const allItems: RoutineItem[] = [
    {
      key: 'wake_up',
      title: 'Brahma Muhurta Awakening',
      recommendation: todayDinacharya?.wake_up_rec || 'Rise early to align with the cosmic rhythms before sunrise.',
      timeLabel: getWakeUpTime(),
      iconName: 'sunny-outline',
      colorClass: 'text-amber-400',
      gradientColors: ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.03)'],
    },
    {
      key: 'hydration',
      title: 'Morning Hydration (Ushapan)',
      recommendation: todayDinacharya?.hydration_rec || 'Drink warm or copper-infused water to kickstart digestion.',
      timeLabel: getHydrationTime(),
      iconName: 'water-outline',
      colorClass: 'text-sky-400',
      gradientColors: ['rgba(56, 189, 248, 0.15)', 'rgba(56, 189, 248, 0.03)'],
    },
    {
      key: 'meal_timing',
      title: 'Main Midday Feast (Ahara)',
      recommendation: todayDinacharya?.meal_timing_rec || 'Take lunch when solar power peaks to support digestive fire (Agni).',
      timeLabel: getMealTime(),
      iconName: 'restaurant-outline',
      colorClass: 'text-emerald-400',
      gradientColors: ['rgba(52, 211, 153, 0.15)', 'rgba(52, 211, 153, 0.03)'],
    },
    {
      key: 'exercise_timing',
      title: 'Exercise & Yoga (Vyayama)',
      recommendation: todayDinacharya?.exercise_timing_rec || 'Perform gentle exercises to build strength and clear physical sluggishness.',
      timeLabel: getExerciseTime(),
      iconName: 'barbell-outline',
      colorClass: 'text-violet-400',
      gradientColors: ['rgba(167, 139, 250, 0.15)', 'rgba(167, 139, 250, 0.03)'],
    },
    {
      key: 'sleep_timing',
      title: 'Sleep & Wind-Down (Nidra)',
      recommendation: todayDinacharya?.sleep_timing_rec || 'Disconnect from screens, relax, and sleep to conserve vital immune defense (Ojas).',
      timeLabel: getSleepTime(),
      iconName: 'moon-outline',
      colorClass: 'text-indigo-400',
      gradientColors: ['rgba(129, 140, 248, 0.15)', 'rgba(129, 140, 248, 0.03)'],
    },
  ];

  // Group items by tab
  const getFilteredItems = (): RoutineItem[] => {
    switch (activeTab) {
      case 'morning':
        return allItems.filter(item => item.key === 'wake_up' || item.key === 'hydration');
      case 'afternoon':
        return allItems.filter(item => item.key === 'meal_timing' || item.key === 'exercise_timing');
      case 'evening':
        return allItems.filter(item => item.key === 'sleep_timing');
    }
  };

  // Progress calculations
  const totalTasks = allItems.length;
  const completedTasks = allItems.filter(item => completions && completions[item.key]).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleToggleCompletion = async (key: string) => {
    if (!user?.id) return;
    try {
      await toggleTaskCompletion(user.id, key);
    } catch (e) {
      Alert.alert('Error', 'Failed to update routine status.');
    }
  };

  const handleToggleReminder = async (item: RoutineItem) => {
    const isSet = !!reminders[item.key];
    const triggerText = `${item.title} Reminder`;
    const bodyText = `Time to: ${item.recommendation.substring(0, 80)}...`;

    try {
      await toggleReminder(item.key, triggerText, bodyText, item.timeLabel);
      if (Platform.OS !== 'web') {
        Alert.alert(
          isSet ? 'Reminder Cleared' : 'Reminder Scheduled',
          isSet 
            ? `Daily notification for ${item.title} has been removed.`
            : `Daily notification for ${item.title} scheduled at ${item.timeLabel}.`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to update reminder settings.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        {/* Header Navigation */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-emerald-900/35">
          <View>
            <Text className="text-white text-lg font-bold">Circadian Path</Text>
            <Text className="text-emerald-400/50 text-[10px] uppercase font-bold tracking-wider">Dynamic Dinacharya Plan</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          {/* Progress tracking Card */}
          <View className="bg-[#051f18]/30 border border-emerald-800/25 p-5 rounded-3xl mb-6 relative overflow-hidden shadow-lg">
            <View className="flex-row justify-between items-center z-10">
              <View className="flex-1 pr-4">
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-0.5">Today's Alignment</Text>
                <Text className="text-white text-xl font-bold">
                  {progressPct === 100 ? 'Fully Aligned! 🌟' : progressPct >= 60 ? 'Optimal Synergy' : 'Wakeful Awareness'}
                </Text>
                <Text className="text-emerald-200/60 text-[11px] mt-1 leading-relaxed">
                  You have completed {completedTasks} of {totalTasks} daily actions. Keep aligning your meals and sleep for prime Ojas.
                </Text>
              </View>
              <View className="w-18 h-18 rounded-full border-4 border-emerald-900/40 justify-center items-center relative bg-emerald-950/40 shadow-inner">
                <LinearGradient 
                  colors={['#10b981', '#059669']} 
                  style={{ width: `${progressPct}%`, height: `${progressPct}%`, position: 'absolute', borderRadius: 9999, opacity: 0.15 }}
                />
                <Text className="text-emerald-300 text-lg font-mono font-bold">{progressPct}%</Text>
                <Text className="text-emerald-500/60 text-[8px] uppercase font-bold">Done</Text>
              </View>
            </View>
          </View>

          {/* Quick Action Logger Panel */}
          <Text className="text-emerald-300/80 text-xs font-bold uppercase tracking-widest mb-3">Path Quick Loggers</Text>
          <View className="flex-row gap-3 mb-6">
            <TouchableOpacity
              onPress={() => setShowHydrationModal(true)}
              className="flex-1 bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="water-outline" size={18} color="#0ea5e9" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Log Water</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowSleepLogger(true)}
              className="flex-1 bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="moon-outline" size={18} color="#a855f7" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Log Sleep</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowBreathingCoach(true);
                setBreathingPhase('Inhale');
              }}
              className="flex-1 bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="sync-outline" size={18} color="#38bdf8" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Breathing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/food-journal')}
              className="flex-1 bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="restaurant-outline" size={18} color="#34d399" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Log Meal</Text>
            </TouchableOpacity>
          </View>

          {/* Routine Tabs */}
          <View className="flex-row bg-emerald-950/40 p-1.5 rounded-2xl border border-emerald-900/25 mb-6">
            {(['morning', 'afternoon', 'evening'] as RoutineTab[]).map(tab => {
              const isSelected = activeTab === tab;
              let tabIcon: keyof typeof Ionicons.glyphMap = 'sunny-outline';
              if (tab === 'afternoon') tabIcon = 'partly-sunny-outline';
              if (tab === 'evening') tabIcon = 'moon-outline';

              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${
                    isSelected ? 'bg-emerald-500 shadow-md shadow-emerald-500/10' : 'bg-transparent'
                  }`}
                >
                  <Ionicons 
                    name={tabIcon} 
                    size={15} 
                    color={isSelected ? '#022c22' : '#34d399'} 
                    className="mr-1.5" 
                  />
                  <Text
                    className={`text-xs font-bold capitalize ${
                      isSelected ? 'text-emerald-950' : 'text-emerald-400/80'
                    }`}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dynamic Routine Timeline */}
          <View className="space-y-4">
            {getFilteredItems().map((item) => {
              const isCompleted = completions ? !!completions[item.key] : false;
              const isReminderSet = reminders ? !!reminders[item.key] : false;

              return (
                <View 
                  key={item.key} 
                  className="bg-[#051f18]/25 border border-emerald-900/20 rounded-2xl overflow-hidden mb-3"
                >
                  <LinearGradient colors={item.gradientColors} className="p-5">
                    
                    {/* Time & Action Badge Header */}
                    <View className="flex-row justify-between items-center mb-3">
                      <View className="flex-row items-center bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-900/30">
                        <Ionicons name="time-outline" size={13} color="#34d399" className="mr-1.5" />
                        <Text className="text-emerald-300 text-[10px] font-mono font-bold">{item.timeLabel}</Text>
                      </View>
                      
                      {/* Controls (Reminders & Toggles) */}
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => handleToggleReminder(item)}
                          className={`p-1.5 rounded-lg border ${
                            isReminderSet 
                              ? 'bg-sky-500/20 border-sky-400/40' 
                              : 'bg-emerald-950/40 border-emerald-900/40'
                          }`}
                        >
                          <Ionicons 
                            name={isReminderSet ? 'notifications' : 'notifications-outline'} 
                            size={14} 
                            color={isReminderSet ? '#38bdf8' : '#34d399'} 
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleToggleCompletion(item.key)}
                          className={`flex-row items-center gap-1.5 px-3 py-1 rounded-lg border ${
                            isCompleted 
                              ? 'bg-emerald-500/20 border-emerald-400/40' 
                              : 'bg-emerald-950/40 border-emerald-900/40'
                          }`}
                        >
                          <Ionicons 
                            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'} 
                            size={14} 
                            color={isCompleted ? '#34d399' : '#6b7280'} 
                          />
                          <Text className={`text-[10px] font-bold ${isCompleted ? 'text-emerald-400' : 'text-emerald-400/40'}`}>
                            {isCompleted ? 'Completed' : 'Complete'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Title & Recommendation Detail */}
                    <View className="flex-row items-start mt-1">
                      <View className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-900/30 mr-3 mt-0.5">
                        <Ionicons name={item.iconName} size={18} className={item.colorClass} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white text-sm font-bold">{item.title}</Text>
                        <Text className="text-emerald-100/70 text-xs leading-relaxed mt-1">
                          {item.recommendation}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })}
          </View>

          {/* Ayurvedic Insights Footer Tip */}
          <View className="bg-emerald-950/10 border border-emerald-900/10 p-4 rounded-2xl mt-6">
            <Text className="text-emerald-300 text-xs font-semibold mb-1">
              💡 Ayurvedic Biological Clock
            </Text>
            <Text className="text-emerald-100/50 text-[11px] leading-relaxed">
              Circadian dynamics divide the 24-hour cycle into three Dosha periods: Kapha (6:00 AM - 10:00 AM), Pitta (10:00 AM - 2:00 PM), and Vata (2:00 PM - 6:00 PM). Completing routines in their proper zones maximizes natural energy transfer and strengthens deep tissue recovery.
            </Text>
          </View>
        </ScrollView>

        {/* 1. BREATHING COACH OVERLAY MODAL */}
        <Modal
          visible={showBreathingCoach}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowBreathingCoach(false);
            setBreathingPhase('Idle');
          }}
        >
          <View className="flex-1 bg-[#020b08]/95 items-center justify-center px-6">
            <View className="bg-[#051f18]/40 border border-emerald-800/40 p-8 rounded-3xl items-center w-full max-w-sm relative">
              <TouchableOpacity
                onPress={() => {
                  setShowBreathingCoach(false);
                  setBreathingPhase('Idle');
                }}
                className="absolute right-4 top-4 p-1.5 rounded-full bg-emerald-950 border border-emerald-900/30"
              >
                <Ionicons name="close" size={20} color="#34d399" />
              </TouchableOpacity>

              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Pranayama Guide</Text>
              <Text className="text-white text-lg font-bold mb-8">Nadi Shodhana Coach</Text>

              {/* Breathing Circle Ring Animation */}
              <View className="w-48 h-48 items-center justify-center mb-10 relative">
                <View
                  style={{
                    width: 110 + breathingProgress * 0.7,
                    height: 110 + breathingProgress * 0.7,
                    opacity: 0.15,
                  }}
                  className="absolute bg-emerald-400 rounded-full"
                />
                <View
                  style={{
                    width: 90 + breathingProgress * 0.5,
                    height: 90 + breathingProgress * 0.5,
                    opacity: 0.3,
                  }}
                  className="absolute bg-emerald-500 rounded-full"
                />
                <View className="w-24 h-24 rounded-full bg-emerald-950 border-2 border-emerald-400 items-center justify-center shadow-lg">
                  <Text className="text-white text-sm font-bold font-mono capitalize">
                    {breathingPhase === 'Idle' ? 'Start' : breathingPhase}
                  </Text>
                </View>
              </View>

              <Text className="text-emerald-300 text-xs text-center font-medium px-4 mb-6">
                {breathingPhase === 'Inhale' && 'Slowly breathe in cooling ambient energy.'}
                {breathingPhase === 'Hold' && 'Hold breath. Feel stability at your core.'}
                {breathingPhase === 'Exhale' && 'Slowly release excess Vata tension.'}
                {breathingPhase === 'Idle' && 'Find a comfortable seated posture.'}
              </Text>

              <View className="flex-row items-center gap-2 mb-6 bg-emerald-950/60 px-4 py-1.5 rounded-full">
                <Ionicons name="time" size={14} color="#34d399" />
                <Text className="text-emerald-400/90 text-xs font-bold font-mono">
                  Cycles Completed: {breathingCycles}
                </Text>
              </View>

              {breathingPhase === 'Idle' ? (
                <TouchableOpacity
                  onPress={() => setBreathingPhase('Inhale')}
                  className="bg-emerald-500 px-8 py-3 rounded-xl active:bg-emerald-600 w-full items-center"
                >
                  <Text className="text-emerald-950 font-bold text-sm">Begin Practice</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setBreathingPhase('Idle')}
                  className="bg-red-500/10 border border-red-500/30 px-8 py-3 rounded-xl active:bg-red-500/20 w-full items-center"
                >
                  <Text className="text-red-400 font-bold text-sm">End Session</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        {/* 2. HYDRATION LOGGER MODAL */}
        <Modal
          visible={showHydrationModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowHydrationModal(false)}
        >
          <View className="flex-1 bg-[#020b08]/90 justify-center items-center px-6">
            <View className="bg-[#051f18]/40 border border-emerald-800/40 p-6 rounded-3xl w-full max-w-sm relative">
              <TouchableOpacity
                onPress={() => setShowHydrationModal(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full bg-emerald-950 border border-emerald-900/30"
              >
                <Ionicons name="close" size={18} color="#34d399" />
              </TouchableOpacity>

              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Water Sync</Text>
              <Text className="text-white text-base font-bold mb-4">Log Hydration intake</Text>

              {/* Progress Detail */}
              <View className="items-center mb-6">
                <Text className="text-white text-3xl font-black font-mono">{todayTotalMl}</Text>
                <Text className="text-emerald-400/60 text-xs">/ {waterGoal} ml logged today</Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={async () => {
                    if (user?.id) {
                      await useHydrationStore.getState().logWater(user.id, 250);
                      setShowHydrationModal(false);
                    }
                  }}
                  className="flex-1 bg-emerald-500 py-3 rounded-xl active:bg-emerald-600 items-center shadow-md shadow-emerald-500/15"
                >
                  <Text className="text-emerald-950 font-bold text-xs">+250 ml</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    if (user?.id) {
                      await useHydrationStore.getState().logWater(user.id, 500);
                      setShowHydrationModal(false);
                    }
                  }}
                  className="flex-1 bg-emerald-500 py-3 rounded-xl active:bg-emerald-600 items-center shadow-md shadow-emerald-500/15"
                >
                  <Text className="text-emerald-950 font-bold text-xs">+500 ml</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* 3. SLEEP LOGGER MODAL */}
        <Modal
          visible={showSleepLogger}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSleepLogger(false)}
        >
          <View className="flex-1 bg-[#020b08]/90 justify-center items-center px-6">
            <View className="bg-[#051f18]/40 border border-purple-800/30 p-6 rounded-3xl w-full max-w-sm relative">
              <TouchableOpacity
                onPress={() => setShowSleepLogger(false)}
                className="absolute right-4 top-4 p-1.5 rounded-full bg-emerald-950 border border-emerald-900/30"
              >
                <Ionicons name="close" size={18} color="#c084fc" />
              </TouchableOpacity>

              <Text className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Sleep Mode</Text>
              <Text className="text-white text-base font-bold mb-4">Record Sleep Offline</Text>

              <View className="space-y-4 mb-6">
                <View className="space-y-1">
                  <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Hours Slept</Text>
                  <TextInput
                    value={sleepHoursInput}
                    onChangeText={setSleepHoursInput}
                    keyboardType="numeric"
                    placeholder="e.g. 7.5"
                    placeholderTextColor="#0b2e23"
                    className="bg-emerald-950/80 border border-emerald-900/40 rounded-xl p-3 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
                <View className="space-y-1">
                  <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Sleep Quality (0-100)</Text>
                  <TextInput
                    value={sleepScoreInput}
                    onChangeText={setSleepScoreInput}
                    keyboardType="numeric"
                    placeholder="e.g. 85"
                    placeholderTextColor="#0b2e23"
                    className="bg-emerald-950/80 border border-emerald-900/40 rounded-xl p-3 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
              </View>

              {loggingSleep ? (
                <ActivityIndicator size="small" color="#c084fc" className="py-2" />
              ) : (
                <TouchableOpacity
                  onPress={handleLogSleep}
                  className="bg-purple-500 py-3.5 rounded-xl active:bg-purple-600 items-center w-full"
                >
                  <Text className="text-white font-bold text-sm">Save Log</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}
