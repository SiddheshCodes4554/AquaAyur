import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useHydrationStore } from '../../store/useHydrationStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useSleepStore } from '../../store/useSleepStore';
import { useDoshaStore } from '../../store/useDoshaStore';
import { useAgniStore } from '../../store/useAgniStore';
import { useOjasStore } from '../../store/useOjasStore';
import { useDinacharyaStore } from '../../store/useDinacharyaStore';
import { triggerSync } from '../../services/syncManager';
import { supabase } from '../../services/supabase';

const getDoshaInterpretation = (
  v: number,
  p: number,
  k: number,
  defaultStatus: string,
  defaultAdvice: string,
  defaultColor: string
) => {
  const maxVal = Math.max(v, p, k);
  if (v === 33 && p === 33 && k === 34) {
    return { status: defaultStatus, advice: defaultAdvice, color: defaultColor };
  }
  if (maxVal === v && v > 38) {
    return {
      status: 'Vata Dominant (Active)',
      advice: 'Dynamic Vata wind energy is active. Stabilize with warm, grounding foods, herbal tea, and slow deep breathing.',
      color: 'text-amber-400'
    };
  }
  if (maxVal === p && p > 38) {
    return {
      status: 'Pitta Dominant (Active)',
      advice: 'Pitta fire energy is elevated. Cooling hydration (coconut water), sweet fruits, and peaceful rests will soothe inflammation.',
      color: 'text-cyan-400'
    };
  }
  if (maxVal === k && k > 38) {
    return {
      status: 'Kapha Dominant (Active)',
      advice: 'Kapha earth energy is sluggish. Brisk activity, warming spices (ginger/pepper), and light diets will stimulate metabolic processes.',
      color: 'text-purple-400'
    };
  }
  return {
    status: 'Tridoshic Balance',
    advice: 'Vitals, activity, and nutrition indicate optimal homeostasis. Continue standard healthy practices.',
    color: 'text-emerald-400'
  };
};

export default function DashboardScreen() {
  const profile = useAuthStore(state => state.profile);
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);

  const hydrationPending = useHydrationStore(state => state.pendingSyncCount);
  const telemetryPending = useTelemetryStore(state => state.pendingSyncCount);
  const sleepPending = useSleepStore(state => state.pendingSyncCount);
  const totalPending = hydrationPending + telemetryPending + sleepPending;

  const todayTotalMl = useHydrationStore(state => state.todayTotalMl);
  const waterGoal = profile?.daily_water_goal_ml || 2500;

  const [currentWeather, setCurrentWeather] = useState<'Pleasant' | 'Hot & Dry' | 'Cold & Humid' | 'Rainy'>('Pleasant');
  const [refreshing, setRefreshing] = useState(false);
  const [latestRec, setLatestRec] = useState<any>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  // Quick Action Modal States
  const [showSleepLogger, setShowSleepLogger] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState('8');
  const [sleepScoreInput, setSleepScoreInput] = useState('80');
  const [loggingSleep, setLoggingSleep] = useState(false);

  // Breathing Coach State
  const [showBreathingCoach, setShowBreathingCoach] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<'Idle' | 'Inhale' | 'Hold' | 'Exhale'>('Idle');
  const [breathingProgress, setBreathingProgress] = useState(0);
  const [breathingCycles, setBreathingCycles] = useState(0);

  // Quick hydration logger modal state
  const [showHydrationModal, setShowHydrationModal] = useState(false);

  const handleWeatherChange = useCallback(async (newWeather: 'Pleasant' | 'Hot & Dry' | 'Cold & Humid' | 'Rainy') => {
    setCurrentWeather(newWeather);
    if (user?.id) {
      try {
        await useDinacharyaStore.getState().recalculateDinacharya(user.id, newWeather);
      } catch (e) {
        console.warn('[Dashboard] Dinacharya weather update failed:', e);
      }
    }
  }, [user?.id]);

  // Breathing exercise timer loop
  useEffect(() => {
    let interval: any;
    const isIdle = breathingPhase === 'Idle';
    if (showBreathingCoach && !isIdle) {
      let step = 0;
      interval = setInterval(() => {
        step = (step + 1) % 12; // 4s inhale, 4s hold, 4s exhale
        if (step < 4) {
          setBreathingPhase('Inhale');
          setBreathingProgress(((step + 1) / 4) * 100);
        } else if (step < 8) {
          setBreathingPhase('Hold');
          setBreathingProgress(100);
        } else {
          setBreathingPhase('Exhale');
          setBreathingProgress((1 - (step - 7) / 4) * 100);
        }

        if (step === 0) {
          setBreathingCycles(c => c + 1);
        }
      }, 1000);
    } else {
      setBreathingProgress(0);
      setBreathingCycles(0);
    }
    return () => clearInterval(interval);
  }, [showBreathingCoach, breathingPhase]);

  // Fetch latest AI recommendations
  const fetchLatestRecommendation = useCallback(async () => {
    if (!user?.id) return;
    setLoadingRec(true);
    try {
      const { data, error } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLatestRec(data);
      }
    } catch (e) {
      console.warn('[Dashboard] Recommendation fetch failed:', e);
    } finally {
      setLoadingRec(false);
    }
  }, [user?.id]);

  // Initial database/sync trigger
  const loadData = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        useHydrationStore.getState().fetchTodayLogs(user.id),
        useTelemetryStore.getState().fetchHistory(user.id),
        useSleepStore.getState().fetchHistory(user.id),
        fetchLatestRecommendation(),
        useDoshaStore.getState().fetchCurrentState(user.id),
        useAgniStore.getState().fetchTodayAgni(user.id),
        useAgniStore.getState().fetchHistory(user.id),
        useOjasStore.getState().fetchTodayOjas(user.id),
        useOjasStore.getState().fetchHistory(user.id),
        useDinacharyaStore.getState().fetchTodayDinacharya(user.id, currentWeather),
        triggerSync()
      ]);
    }
  }, [user?.id, currentWeather, fetchLatestRecommendation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await Promise.all([
        useHydrationStore.getState().fetchTodayLogs(user.id),
        useTelemetryStore.getState().fetchHistory(user.id),
        useSleepStore.getState().fetchHistory(user.id),
        fetchLatestRecommendation(),
        useDoshaStore.getState().recalculateToday(user.id),
        useAgniStore.getState().recalculateAgni(user.id),
        useOjasStore.getState().recalculateOjas(user.id),
        useDinacharyaStore.getState().recalculateDinacharya(user.id, currentWeather),
        triggerSync()
      ]);
    }
    setRefreshing(false);
  };

  // Handle manual sleep logs
  const handleLogSleep = async () => {
    if (!user?.id) return;
    const hours = parseFloat(sleepHoursInput);
    const score = parseInt(sleepScoreInput);

    if (isNaN(hours) || hours <= 0 || hours > 24) {
      Alert.alert('Validation Error', 'Please enter a valid sleep duration.');
      return;
    }
    if (isNaN(score) || score < 0 || score > 100) {
      Alert.alert('Validation Error', 'Please enter a valid sleep score (0-100).');
      return;
    }

    setLoggingSleep(true);
    try {
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      await useSleepStore.getState().logSleep(user.id, startTime, endTime, Math.round(hours * 60), score);
      setShowSleepLogger(false);
      setSleepHoursInput('8');
      setSleepScoreInput('80');
    } catch (e) {
      console.warn('[Dashboard] Sleep logging failed:', e);
    } finally {
      setLoggingSleep(false);
    }
  };

  // Dynamic dynamic time greetings
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34d399" />}
          className="px-6 py-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6 mt-2">
            <View>
              <Text className="text-emerald-400/60 text-[10px] font-bold uppercase tracking-wider">{getGreeting()}</Text>
              <Text className="text-white text-2xl font-bold">{profile?.full_name || 'Yogi'}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              {totalPending > 0 ? (
                <View className="bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="cloud-offline" size={11} color="#f59e0b" />
                  <Text className="text-amber-500 text-[10px] font-bold ml-1">{totalPending} Offline</Text>
                </View>
              ) : null}

              {/* Telemetry Source & Connection Indicator */}
              <ConnectionStatusIndicator />

              <TouchableOpacity onPress={signOut} className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 active:bg-red-500/20">
                <Ionicons name="log-out-outline" size={18} color="#f87171" />
              </TouchableOpacity>
            </View>
          </View>

          {/* HEALTH SCORE HERO CARD (Isolated Widget) */}
          <HealthRecoveryIndexCard />

          {/* AGNI SCORE HERO CARD (Isolated Widget) */}
          <AgniScoreCard />

          {/* OJAS SCORE HERO CARD (Isolated Widget) */}
          <OjasScoreCard />

          {/* DINACHARYA Circadian Schedule Card (Isolated Widget) */}
          <DinacharyaCard currentWeather={currentWeather} onWeatherChange={handleWeatherChange} />

          {/* QUICK ACTIONS ROW */}
          <Text className="text-emerald-300/80 text-xs font-bold uppercase tracking-widest mb-3.5">Quick Actions</Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {/* Food Journal */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/food-journal')}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="restaurant-outline" size={18} color="#34d399" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Food Journal</Text>
            </TouchableOpacity>

            {/* AI Coach */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/coach')}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#10b981" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Ask Coach</Text>
            </TouchableOpacity>

            {/* Breathing */}
            <TouchableOpacity
              onPress={() => {
                setShowBreathingCoach(true);
                setBreathingPhase('Inhale');
              }}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="sync-outline" size={18} color="#38bdf8" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Breathing</Text>
            </TouchableOpacity>

            {/* Sleep Mode */}
            <TouchableOpacity
              onPress={() => setShowSleepLogger(true)}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="moon-outline" size={18} color="#a855f7" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Log Sleep</Text>
            </TouchableOpacity>

            {/* Hydration */}
            <TouchableOpacity
              onPress={() => setShowHydrationModal(true)}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="water-outline" size={18} color="#0ea5e9" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Hydrate</Text>
            </TouchableOpacity>

            {/* Reports */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/insights')}
              className="flex-1 min-w-[30%] bg-[#051f18]/30 border border-emerald-800/25 p-3 rounded-2xl items-center active:bg-emerald-900/10"
            >
              <Ionicons name="document-text-outline" size={18} color="#eab308" />
              <Text className="text-white text-[10px] font-bold mt-1.5">Reports</Text>
            </TouchableOpacity>
          </View>

          {/* LIVE BIOMETRICS GRID */}
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-emerald-300/80 text-xs font-bold uppercase tracking-widest">Live Biometrics</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/live-monitor')} className="flex-row items-center active:opacity-60">
              <Text className="text-emerald-400 text-[10px] font-bold">Monitor Screen</Text>
              <Ionicons name="chevron-forward" size={10} color="#34d399" className="ml-0.5" />
            </TouchableOpacity>
          </View>
          <LiveTelemetryGrid />

          {/* AYURVEDIC DIGITAL TWIN PREVIEW CARD */}
          <TouchableOpacity
            onPress={() => router.push('/digital-twin')}
            activeOpacity={0.85}
            className="bg-[#051f18]/30 border border-emerald-800/30 p-5 rounded-3xl mb-6 flex-row items-center relative overflow-hidden active:bg-emerald-900/10"
          >
            <View className="absolute right-0 top-0 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none" />
            <View className="flex-1 mr-4">
              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-0.5">Ayurvedic Digital Twin</Text>
              <Text className="text-white text-base font-extrabold mb-1">Interact with your Avatar</Text>
              <Text className="text-emerald-200/60 text-[10px] leading-relaxed">
                Visualize Vata, Pitta, Kapha, Agni, and Ojas dynamic states syncing from wearables in real-time.
              </Text>
            </View>
            <View className="w-16 h-16 rounded-full bg-emerald-950/45 border border-emerald-900/30 items-center justify-center relative overflow-hidden">
              <Ionicons name="body-outline" size={22} color="#10b981" />
              <View className="absolute inset-2 border border-purple-500/20 rounded-full" />
            </View>
          </TouchableOpacity>

          {/* DOSHA STATUS CARD (Isolated Widget) */}
          <DoshaEquilibriumCard />

          {/* SLEEP BRIEF HIGHLIGHT (Isolated Widget) */}
          <SleepRecoveryBriefCard onLogSleepPress={() => setShowSleepLogger(true)} />

          {/* AI RECOMMENDATIONS CARD */}
          <View className="bg-[#051f18]/30 border border-emerald-800/35 p-6 rounded-3xl mb-6 relative overflow-hidden">
            <View className="absolute right-0 top-0 w-24 h-24 bg-teal-500/5 rounded-full blur-xl pointer-events-none" />
            <View className="flex-row items-center mb-3">
              <Ionicons name="sparkles" size={18} color="#34d399" />
              <Text className="text-white font-bold text-sm ml-2">AquaGuru Wellness Coach</Text>
            </View>

            {loadingRec ? (
              <ActivityIndicator size="small" color="#34d399" className="py-4" />
            ) : latestRec ? (
              <View>
                <Text className="text-emerald-100/90 text-[13px] leading-relaxed mb-3">
                  {latestRec.recommendation_text}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/coach')}
                  className="bg-emerald-500 px-5 py-2.5 rounded-xl active:bg-emerald-600 flex-row justify-center items-center"
                >
                  <Text className="text-emerald-950 font-bold text-xs">Message Coach</Text>
                  <Ionicons name="arrow-forward" size={12} color="#022c22" className="ml-1" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="py-4 items-center">
                <Text className="text-emerald-500/80 text-xs text-center mb-4">No daily insights recommendations synthesized yet.</Text>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/coach')}
                  className="bg-emerald-500/10 border border-emerald-500/30 px-5 py-2 rounded-xl"
                >
                  <Text className="text-emerald-400 font-bold text-xs">Consult AquaGuru</Text>
                </TouchableOpacity>
              </View>
            )}
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

              {/* Progress Ring details */}
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
                  <Text className="text-emerald-950 font-bold text-sm">Save Log</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

// ==========================================
// Sub-components for isolated rendering
// ==========================================

const ConnectionStatusIndicator = React.memo(function ConnectionStatusIndicator() {
  const sensorStatus = useSensorStore(state => state.status);
  const [pulseGlow, setPulseGlow] = useState(1);

  useEffect(() => {
    if (sensorStatus !== 'connected') return;
    const pulseTimer = setInterval(() => {
      setPulseGlow(p => (p === 1 ? 0.4 : 1));
    }, 1000);
    return () => clearInterval(pulseTimer);
  }, [sensorStatus]);

  return (
    <View className="bg-[#051f18]/40 border border-emerald-900/30 px-3 py-1.5 rounded-full flex-row items-center">
      <View 
        style={{ 
          opacity: sensorStatus === 'connected' ? pulseGlow : 1 
        }} 
        className={`w-2 h-2 rounded-full mr-1.5 ${
          sensorStatus === 'connected' 
            ? 'bg-emerald-400 shadow-md shadow-emerald-400/50' 
            : 'bg-rose-500'
        } will-change-variable`} 
      />
      <Text className="text-white text-[10px] font-bold uppercase font-mono tracking-wider">
        {sensorStatus === 'connected' ? 'ESP32 Connected' : 'Device Offline'}
      </Text>
    </View>
  );
});

const HealthRecoveryIndexCard = React.memo(function HealthRecoveryIndexCard() {
  const liveData = useSensorStore(state => state.liveData);
  const heartRateHistory = useTelemetryStore(state => state.heartRateHistory);
  const temperatureHistory = useTelemetryStore(state => state.temperatureHistory);
  const sleepHistory = useSleepStore(state => state.sleepHistory);

  const healthAndRecoveryIndex = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const hrToday = heartRateHistory.filter(log => new Date(log.timestamp) >= oneDayAgo);
    const hrYesterday = heartRateHistory.filter(log => {
      const d = new Date(log.timestamp);
      return d >= twoDaysAgo && d < oneDayAgo;
    });

    const tempToday = temperatureHistory.filter(log => new Date(log.timestamp) >= oneDayAgo);
    const tempYesterday = temperatureHistory.filter(log => {
      const d = new Date(log.timestamp);
      return d >= twoDaysAgo && d < oneDayAgo;
    });

    const sleepToday = sleepHistory.filter(log => new Date(log.start_time) >= oneDayAgo);
    const sleepYesterday = sleepHistory.filter(log => {
      const d = new Date(log.start_time);
      return d >= twoDaysAgo && d < oneDayAgo;
    });

    const calcAvgHr = (logs: typeof heartRateHistory, defaultVal: number) => {
      let totalBpm = logs.reduce((sum, item) => sum + item.bpm, 0);
      let count = logs.length;
      if (liveData?.heartRate && count === 0) {
        return liveData.heartRate;
      }
      return count > 0 ? Math.round(totalBpm / count) : defaultVal;
    };

    const calcAvgTemp = (logs: typeof temperatureHistory, defaultVal: number) => {
      let totalTemp = logs.reduce((sum, item) => sum + Number(item.temperature_celsius), 0);
      let count = logs.length;
      if (liveData?.temperature && count === 0) {
        return liveData.temperature;
      }
      return count > 0 ? Number((totalTemp / count).toFixed(1)) : defaultVal;
    };

    const calcAvgSleep = (logs: typeof sleepHistory, defaultVal: number) => {
      let totalSleep = logs.reduce((sum, item) => sum + item.sleep_score, 0);
      let count = logs.length;
      return count > 0 ? Math.round(totalSleep / count) : defaultVal;
    };

    const histAvgHr = heartRateHistory.length > 0 ? Math.round(heartRateHistory.reduce((s, v) => s + v.bpm, 0) / heartRateHistory.length) : 72;
    const histAvgTemp = temperatureHistory.length > 0 ? Number((temperatureHistory.reduce((s, v) => s + Number(v.temperature_celsius), 0) / temperatureHistory.length).toFixed(1)) : 36.6;
    const histAvgSleep = sleepHistory.length > 0 ? Math.round(sleepHistory.reduce((s, v) => s + v.sleep_score, 0) / sleepHistory.length) : 80;

    const avgHrToday = calcAvgHr(hrToday, histAvgHr);
    const avgTempToday = calcAvgTemp(tempToday, histAvgTemp);
    const avgSleepToday = calcAvgSleep(sleepToday, histAvgSleep);

    const avgHrYesterday = calcAvgHr(hrYesterday, histAvgHr);
    const avgTempYesterday = calcAvgTemp(tempYesterday, histAvgTemp);
    const avgSleepYesterday = calcAvgSleep(sleepYesterday, histAvgSleep);

    const calculateScore = (hr: number, temp: number, sleep: number) => {
      const hrScore = Math.max(20, 100 - Math.abs(hr - 70) * 2);
      const tempScore = Math.max(20, 100 - Math.abs(temp - 36.6) * 20);
      return Math.round((hrScore + tempScore + sleep) / 3);
    };

    const todayScore = calculateScore(avgHrToday, avgTempToday, avgSleepToday);
    const yesterdayScore = calculateScore(avgHrYesterday, avgTempYesterday, avgSleepYesterday);

    const scoreDiff = todayScore - yesterdayScore;

    let rating = 'Optimal';
    let ratingColor = 'text-emerald-400';
    let bgGlow = 'bg-emerald-500/10';
    if (todayScore < 60) {
      rating = 'Needs Attention';
      ratingColor = 'text-rose-400';
      bgGlow = 'bg-rose-500/10';
    } else if (todayScore < 80) {
      rating = 'Fair';
      ratingColor = 'text-amber-400';
      bgGlow = 'bg-amber-500/10';
    }

    let summaryText = 'Vitals show stable homeostasis. Sleep recovery is strong, keeping Pitta and Vata elements balanced.';
    if (avgSleepToday < 70) {
      summaryText = `Sleep recovery is currently low at ${avgSleepToday}%. Rest and establish a stable bedtime routine to pacify Vata wind energy.`;
    } else if (avgTempToday > 37.2) {
      summaryText = `Body temperature is slightly elevated at ${avgTempToday}°C. Avoid direct sun and drink cooling water to balance Pitta fire.`;
    } else if (avgHrToday > 85) {
      summaryText = `Resting heart rate is elevated at ${avgHrToday} bpm. Practice breathing exercises to soothe an overstimulated nervous system (Vata).`;
    } else if (avgHrToday < 55) {
      summaryText = `Resting heart rate is slow at ${avgHrToday} bpm. Dynamic movement or warm ginger tea will stimulate sluggish Kapha energy.`;
    } else {
      summaryText = `Physiological health is optimal (Score: ${todayScore}/100) with a resting pulse of ${avgHrToday} bpm, normal temperature of ${avgTempToday}°C, and sleep score of ${avgSleepToday}%.`;
    }

    return {
      score: todayScore,
      diff: scoreDiff,
      rating,
      ratingColor,
      bgGlow,
      summary: summaryText
    };
  }, [heartRateHistory, temperatureHistory, sleepHistory, liveData]);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 relative overflow-hidden">
      <View className={`absolute right-0 top-0 w-32 h-32 ${healthAndRecoveryIndex.bgGlow} rounded-full blur-2xl pointer-events-none`} />

      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Health & Recovery Index</Text>
          <Text className="text-white text-3xl font-extrabold font-mono">
            {healthAndRecoveryIndex.score} <Text className="text-emerald-400/60 text-lg">/ 100</Text>
          </Text>
          <View className="flex-row items-center mt-2.5">
            <View className="bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-md mr-2">
              <Text className={`text-[10px] font-bold uppercase ${healthAndRecoveryIndex.ratingColor}`}>
                {healthAndRecoveryIndex.rating}
              </Text>
            </View>
            <Ionicons 
              name={healthAndRecoveryIndex.diff >= 0 ? 'arrow-up' : 'arrow-down'} 
              size={12} 
              color={healthAndRecoveryIndex.diff >= 0 ? '#10b981' : '#f87171'} 
            />
            <Text className="text-emerald-400/70 text-[10px] ml-0.5">
              {healthAndRecoveryIndex.diff >= 0 ? '+' : ''}{healthAndRecoveryIndex.diff} points vs yesterday
            </Text>
          </View>
        </View>

        <View className="w-20 h-20 rounded-full border-4 border-emerald-950 items-center justify-center bg-emerald-950/40 relative shadow-lg shadow-black/20">
          <View className="absolute inset-0.5 rounded-full border-2 border-emerald-500/75 border-t-transparent animate-pulse" />
          <Ionicons name="leaf" size={24} color="#10b981" />
        </View>
      </View>

      <View className="h-[1px] bg-emerald-900/35 my-4" />
      <Text className="text-emerald-100/90 text-xs leading-relaxed">
        {healthAndRecoveryIndex.summary}
      </Text>
    </View>
  );
});

const AgniScoreCard = React.memo(function AgniScoreCard() {
  const todayAgni = useAgniStore(state => state.todayAgni);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 relative overflow-hidden">
      <View className={`absolute right-0 top-0 w-32 h-32 ${
        todayAgni?.agni_state === 'Strong' ? 'bg-emerald-500/10' :
        todayAgni?.agni_state === 'Moderate' ? 'bg-amber-500/10' : 'bg-rose-500/10'
      } rounded-full blur-2xl pointer-events-none`} />

      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Agni Score (Digestive Fire)</Text>
          <Text className="text-white text-3xl font-extrabold font-mono">
            {todayAgni ? todayAgni.agni_score : '--'} <Text className="text-emerald-400/60 text-lg">/ 100</Text>
          </Text>
          <View className="flex-row items-center mt-2.5">
            <View className={`border px-2 py-0.5 rounded-md mr-2 ${
              todayAgni?.agni_state === 'Strong' ? 'bg-emerald-500/20 border-emerald-500/30' :
              todayAgni?.agni_state === 'Moderate' ? 'bg-amber-500/20 border-amber-500/30' : 'bg-rose-500/20 border-rose-500/30'
            }`}>
              <Text className={`text-[10px] font-bold uppercase ${
                todayAgni?.agni_state === 'Strong' ? 'text-emerald-400' :
                todayAgni?.agni_state === 'Moderate' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {todayAgni ? `${todayAgni.agni_state} Agni` : 'Loading...'}
              </Text>
            </View>
            <Text className="text-emerald-400/70 text-[10px]">
              {todayAgni?.agni_state === 'Strong' && 'Robust digestive & metabolic power'}
              {todayAgni?.agni_state === 'Moderate' && 'Stable but sensitive metabolic activity'}
              {todayAgni?.agni_state === 'Weak' && 'Sluggish digestive & metabolic power'}
            </Text>
          </View>
        </View>

        <View className="w-20 h-20 rounded-full border-4 border-emerald-950 items-center justify-center bg-emerald-950/40 relative shadow-lg shadow-black/20">
          <View className={`absolute inset-0.5 rounded-full border-2 ${
            todayAgni?.agni_state === 'Strong' ? 'border-emerald-500/75' :
            todayAgni?.agni_state === 'Moderate' ? 'border-amber-500/75' : 'border-rose-500/75'
          } border-t-transparent`} />
          <Ionicons name="flame" size={24} color={
            todayAgni?.agni_state === 'Strong' ? '#10b981' :
            todayAgni?.agni_state === 'Moderate' ? '#eab308' : '#f43f5e'
          } />
        </View>
      </View>

      <View className="h-[1px] bg-emerald-900/35 my-4" />
      <Text className="text-emerald-100/90 text-xs leading-relaxed">
        {todayAgni?.agni_state === 'Strong' && 'Strong digestive fire (Sama). Metabolism, nutrient absorption, and energy conversions are operating at maximum efficiency. Keep it stable by continuing current healthy eating timings and fluid intake.'}
        {todayAgni?.agni_state === 'Moderate' && 'Moderate digestive fire (Vishma/Tikshna/Manda). Your metabolism is stable but sensitive to irregular meal times or sleep schedules. Keep habits consistent to maintain balance.'}
        {todayAgni?.agni_state === 'Weak' && 'Weak digestive fire. Digestion is slow, making you prone to sluggishness and toxin (Ama) accumulation. Support metabolism with warm, light meals and light exercises.'}
        {!todayAgni && 'Loading Agni metabolic state details...'}
      </Text>
    </View>
  );
});

const OjasScoreCard = React.memo(function OjasScoreCard() {
  const todayOjas = useOjasStore(state => state.todayOjas);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 relative overflow-hidden">
      <View className={`absolute right-0 top-0 w-32 h-32 ${
        todayOjas?.ojas_state === 'High Ojas' ? 'bg-violet-500/10' :
        todayOjas?.ojas_state === 'Moderate Ojas' ? 'bg-amber-500/10' : 'bg-rose-500/10'
      } rounded-full blur-2xl pointer-events-none`} />

      <View className="flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <Text className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-1">Ojas Score (Vitality & Immunity)</Text>
          <Text className="text-white text-3xl font-extrabold font-mono">
            {todayOjas ? todayOjas.ojas_score : '--'} <Text className="text-violet-400/60 text-lg">/ 100</Text>
          </Text>
          <View className="flex-row items-center mt-2.5">
            <View className={`border px-2 py-0.5 rounded-md mr-2 ${
              todayOjas?.ojas_state === 'High Ojas' ? 'bg-violet-500/20 border-violet-500/30' :
              todayOjas?.ojas_state === 'Moderate Ojas' ? 'bg-amber-500/20 border-amber-500/30' : 'bg-rose-500/20 border-rose-500/30'
            }`}>
              <Text className={`text-[10px] font-bold uppercase ${
                todayOjas?.ojas_state === 'High Ojas' ? 'text-violet-400' :
                todayOjas?.ojas_state === 'Moderate Ojas' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {todayOjas ? todayOjas.ojas_state : 'Loading...'}
              </Text>
            </View>
            <Text className="text-violet-400/70 text-[10px]">
              {todayOjas?.ojas_state === 'High Ojas' && 'Robust vitality & immune defense'}
              {todayOjas?.ojas_state === 'Moderate Ojas' && 'Stable recovery & standard resilience'}
              {todayOjas?.ojas_state === 'Low Ojas' && 'Depleted vitality & low resistance'}
            </Text>
          </View>
        </View>

        <View className="w-20 h-20 rounded-full border-4 border-violet-950 items-center justify-center bg-violet-950/40 relative shadow-lg shadow-black/20">
          <View className={`absolute inset-0.5 rounded-full border-2 ${
            todayOjas?.ojas_state === 'High Ojas' ? 'border-violet-500/75' :
            todayOjas?.ojas_state === 'Moderate Ojas' ? 'border-amber-500/75' : 'border-rose-500/75'
          } border-t-transparent`} />
          <Ionicons name="shield-half" size={24} color={
            todayOjas?.ojas_state === 'High Ojas' ? '#8b5cf6' :
            todayOjas?.ojas_state === 'Moderate Ojas' ? '#eab308' : '#f43f5e'
          } />
        </View>
      </View>

      <Text className="text-violet-100/90 text-xs leading-relaxed">
        {todayOjas?.ojas_state === 'High Ojas' && 'Vibrant Vitality (High Ojas). Your immune system, physical stamina, and mental clarity are operating at peak resilience. Maintain this state by continuing consistent sleep schedules, balanced hydration, and nourishing diets.'}
        {todayOjas?.ojas_state === 'Moderate Ojas' && 'Stable Vitality (Moderate Ojas). Resilience and physical recovery are balanced but vulnerable to stress, irregular sleep, or mild dehydration. Prioritize rest and hydration to prevent energy depletion.'}
        {todayOjas?.ojas_state === 'Low Ojas' && 'Depleted Vitality (Low Ojas). Vital energy and immune defense are low, making you prone to fatigue and stress. Rebuild Ojas with deep restorative sleep, warm sweet nourishing foods, and gentle yoga exercises.'}
        {!todayOjas && 'Loading Ojas vitality details...'}
      </Text>
    </View>
  );
});

interface DinacharyaCardProps {
  currentWeather: 'Pleasant' | 'Hot & Dry' | 'Cold & Humid' | 'Rainy';
  onWeatherChange: (newWeather: 'Pleasant' | 'Hot & Dry' | 'Cold & Humid' | 'Rainy') => Promise<void>;
}

const DinacharyaCard = React.memo(function DinacharyaCard({ currentWeather, onWeatherChange }: DinacharyaCardProps) {
  const todayDinacharya = useDinacharyaStore(state => state.todayDinacharya);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 relative overflow-hidden">
      <View className="absolute right-0 top-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-1 mr-2">
          <Text className="text-sky-400 text-xs font-bold uppercase tracking-wider mb-1">Dinacharya (Ayurvedic Circadian Schedule)</Text>
          <Text className="text-white text-base font-extrabold">Circadian Balance Plan</Text>
        </View>
        <Ionicons name="sunny-outline" size={24} color="#38bdf8" />
      </View>

      {/* Weather Selector */}
      <View className="mb-5 bg-emerald-950/40 p-2 rounded-xl border border-emerald-900/30">
        <Text className="text-emerald-400/60 text-[9px] font-bold uppercase tracking-wider mb-1.5 px-1">Active Climate Context</Text>
        <View className="flex-row gap-1">
          {(['Pleasant', 'Hot & Dry', 'Cold & Humid', 'Rainy'] as const).map((w) => {
            const isSel = currentWeather === w;
            return (
              <TouchableOpacity
                key={w}
                onPress={() => onWeatherChange(w)}
                className={`flex-1 py-1.5 rounded-md items-center justify-center ${
                  isSel ? 'bg-sky-500/25 border border-sky-500/30' : 'bg-transparent'
                }`}
              >
                <Text className={`text-[9px] font-bold text-center ${isSel ? 'text-sky-300' : 'text-emerald-400/40'}`}>
                  {w}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Circadian Timeline */}
      {todayDinacharya ? (
        <View className="space-y-4">
          {/* 🌅 Wake Up */}
          <View className="flex-row items-start">
            <View className="mr-3 items-center">
              <View className="w-7 h-7 rounded-full bg-amber-500/10 border border-amber-500/30 items-center justify-center">
                <Ionicons name="sunny" size={13} color="#f59e0b" />
              </View>
              <View className="w-[1px] h-10 bg-emerald-900/35 my-1" />
            </View>
            <View className="flex-1 pb-2">
              <Text className="text-amber-400 text-[10px] font-bold uppercase">Wake-Up & Morning (Brahma Muhurta)</Text>
              <Text className="text-emerald-100/90 text-xs leading-relaxed mt-0.5">{todayDinacharya.wake_up_rec}</Text>
            </View>
          </View>

          {/* 💧 Hydration */}
          <View className="flex-row items-start">
            <View className="mr-3 items-center">
              <View className="w-7 h-7 rounded-full bg-sky-500/10 border border-sky-500/30 items-center justify-center">
                <Ionicons name="water" size={13} color="#38bdf8" />
              </View>
              <View className="w-[1px] h-10 bg-emerald-900/35 my-1" />
            </View>
            <View className="flex-1 pb-2">
              <Text className="text-sky-400 text-[10px] font-bold uppercase">Hydration & Fluids (Soma)</Text>
              <Text className="text-emerald-100/90 text-xs leading-relaxed mt-0.5">{todayDinacharya.hydration_rec}</Text>
            </View>
          </View>

          {/* 🍽️ Meals */}
          <View className="flex-row items-start">
            <View className="mr-3 items-center">
              <View className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 items-center justify-center">
                <Ionicons name="restaurant" size={12} color="#10b981" />
              </View>
              <View className="w-[1px] h-10 bg-emerald-900/35 my-1" />
            </View>
            <View className="flex-1 pb-2">
              <Text className="text-emerald-400 text-[10px] font-bold uppercase">Meal Schedule & Agni Timing</Text>
              <Text className="text-emerald-100/90 text-xs leading-relaxed mt-0.5">{todayDinacharya.meal_timing_rec}</Text>
            </View>
          </View>

          {/* 🏃‍♂️ Exercise */}
          <View className="flex-row items-start">
            <View className="mr-3 items-center">
              <View className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/30 items-center justify-center">
                <Ionicons name="fitness" size={13} color="#8b5cf6" />
              </View>
              <View className="w-[1px] h-10 bg-emerald-900/35 my-1" />
            </View>
            <View className="flex-1 pb-2">
              <Text className="text-violet-400 text-[10px] font-bold uppercase">Vyayama (Exercise Timing)</Text>
              <Text className="text-emerald-100/90 text-xs leading-relaxed mt-0.5">{todayDinacharya.exercise_timing_rec}</Text>
            </View>
          </View>

          {/* 🌙 Sleep */}
          <View className="flex-row items-start">
            <View className="mr-3 items-center">
              <View className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 items-center justify-center">
                <Ionicons name="moon" size={12} color="#6366f1" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-indigo-400 text-[10px] font-bold uppercase">Sleep & Ojas Wind-Down</Text>
              <Text className="text-emerald-100/90 text-xs leading-relaxed mt-0.5">{todayDinacharya.sleep_timing_rec}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/dinacharya')}
            className="mt-4 bg-emerald-500/10 border border-emerald-500/20 py-2.5 rounded-xl flex-row justify-center items-center active:bg-emerald-500/25"
          >
            <Text className="text-emerald-400 font-bold text-xs">Manage Routine & Reminders</Text>
            <Ionicons name="arrow-forward" size={13} color="#34d399" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text className="text-emerald-400/60 text-xs py-4 text-center">Loading circadian routine recommendations...</Text>
      )}
    </View>
  );
});

const LiveTelemetryGrid = React.memo(function LiveTelemetryGrid() {
  const liveData = useSensorStore(state => state.liveData);
  const [pulseGlow, setPulseGlow] = useState(1);

  useEffect(() => {
    const pulseTimer = setInterval(() => {
      setPulseGlow(p => (p === 1 ? 0.4 : 1));
    }, 1000);
    return () => clearInterval(pulseTimer);
  }, []);

  return (
    <View className="flex-row flex-wrap gap-4 mb-6">
      {/* Heart Rate Card */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/live-monitor')}
        activeOpacity={0.9}
        className="flex-1 min-w-[45%] bg-[#051f18]/25 border border-rose-950/40 p-4 rounded-2xl relative overflow-hidden"
      >
        <View className="absolute right-0 top-0 w-8 h-8 bg-rose-500/5 rounded-full blur-md" />
        <View className="flex-row justify-between items-center mb-2">
          <Ionicons name="heart" size={20} color="#f43f5e" style={{ opacity: pulseGlow }} />
          <Text className="text-rose-400 text-[10px] font-bold uppercase">Pulse</Text>
        </View>
        <Text className="text-white text-2xl font-black font-mono">
          {liveData ? `${liveData.heartRate}` : '--'}
          <Text className="text-rose-400/50 text-[10px] font-normal font-sans"> bpm</Text>
        </Text>
        {/* Mini Pulse Sparkline */}
        <View className="flex-row items-end h-6 space-x-0.5 mt-2 justify-end">
          {[3, 5, 8, 4, 7, 9, 6, 8].map((h, i) => (
            <View key={i} style={{ height: `${h * 10}%` }} className="w-1 bg-rose-500/50 rounded-full" />
          ))}
        </View>
      </TouchableOpacity>

      {/* Temperature Card */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/live-monitor')}
        activeOpacity={0.9}
        className="flex-1 min-w-[45%] bg-[#051f18]/25 border border-sky-950/40 p-4 rounded-2xl relative overflow-hidden"
      >
        <View className="absolute right-0 top-0 w-8 h-8 bg-sky-500/5 rounded-full blur-md" />
        <View className="flex-row justify-between items-center mb-2">
          <Ionicons name="thermometer" size={20} color="#0ea5e9" />
          <Text className="text-sky-400 text-[10px] font-bold uppercase">Temp</Text>
        </View>
        <Text className="text-white text-2xl font-black font-mono">
          {liveData ? `${liveData.temperature.toFixed(1)}` : '--'}
          <Text className="text-sky-400/50 text-[10px] font-normal font-sans"> °C</Text>
        </Text>
        {/* Mini Temp Sparkline */}
        <View className="flex-row items-end h-6 space-x-0.5 mt-2 justify-end">
          {[5, 5, 6, 5, 6, 6, 5, 6].map((h, i) => (
            <View key={i} style={{ height: `${h * 10}%` }} className="w-1 bg-sky-500/50 rounded-full" />
          ))}
        </View>
      </TouchableOpacity>

      {/* Steps Card */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/live-monitor')}
        activeOpacity={0.9}
        className="flex-1 min-w-[45%] bg-[#051f18]/25 border border-amber-950/40 p-4 rounded-2xl relative overflow-hidden"
      >
        <View className="absolute right-0 top-0 w-8 h-8 bg-amber-500/5 rounded-full blur-md" />
        <View className="flex-row justify-between items-center mb-2">
          <Ionicons name="footsteps" size={20} color="#eab308" />
          <Text className="text-amber-400 text-[10px] font-bold uppercase">Steps</Text>
        </View>
        <Text className="text-white text-2xl font-black font-mono">
          {liveData ? `${liveData.steps.toLocaleString()}` : '--'}
          <Text className="text-amber-400/50 text-[10px] font-normal font-sans"> / 8k</Text>
        </Text>
        {/* Mini Steps Sparkline */}
        <View className="flex-row items-end h-6 space-x-0.5 mt-2 justify-end">
          {[2, 4, 3, 5, 6, 8, 7, 9].map((h, i) => (
            <View key={i} style={{ height: `${h * 10}%` }} className="w-1 bg-amber-500/50 rounded-full" />
          ))}
        </View>
      </TouchableOpacity>

      {/* Activity Card */}
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/live-monitor')}
        activeOpacity={0.9}
        className="flex-1 min-w-[45%] bg-[#051f18]/25 border border-purple-950/40 p-4 rounded-2xl relative overflow-hidden"
      >
        <View className="absolute right-0 top-0 w-8 h-8 bg-purple-500/5 rounded-full blur-md" />
        <View className="flex-row justify-between items-center mb-2">
          <Ionicons name="fitness" size={20} color="#a855f7" />
          <Text className="text-purple-400 text-[10px] font-bold uppercase">Activity</Text>
        </View>
        <Text className="text-white text-lg font-black capitalize truncate mt-0.5">
          {liveData ? `${liveData.activity}` : '--'}
        </Text>
        {/* Mini Activity Sparkline */}
        <View className="flex-row items-end h-6 space-x-0.5 mt-3 justify-end">
          {[1, 2, 1, 3, 5, 2, 1, 2].map((h, i) => (
            <View key={i} style={{ height: `${h * 10}%` }} className="w-1 bg-purple-500/50 rounded-full" />
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
});

const DoshaEquilibriumCard = React.memo(function DoshaEquilibriumCard() {
  const liveData = useSensorStore(state => state.liveData);
  const sensorStatus = useSensorStore(state => state.status);
  const currentDosha = useDoshaStore(state => state.currentDosha);
  const dominantDosha = useAuthStore(state => state.profile?.dominant_dosha);

  const activeDoshaState = useMemo(() => {
    if (!liveData) {
      return {
        status: 'Device Offline',
        advice: 'Connect your wearable ESP32 sensor suite to map live Dosha equilibrium.',
        color: 'text-gray-400',
        rata: 33,
        pitta: 33,
        kapha: 34
      };
    }

    const { heartRate, temperature } = liveData;
    let pVal = 35;
    let vVal = 35;
    let kVal = 30;

    if (heartRate > 85) {
      vVal += 15;
      pVal -= 5;
      kVal -= 10;
      return {
        status: 'Vata Elevated (Wind)',
        advice: 'Irregular pulse registered. Sip warm cardamom tea and avoid stimulants.',
        color: 'text-amber-400',
        rata: vVal,
        pitta: pVal,
        kapha: kVal
      };
    } else if (temperature > 37.0) {
      pVal += 20;
      vVal -= 10;
      kVal -= 10;
      return {
        status: 'Pitta Elevated (Fire)',
        advice: 'Skin temperature is elevated. Drink cooling coconut water and avoid active sun.',
        color: 'text-cyan-400',
        rata: vVal,
        pitta: pVal,
        kapha: kVal
      };
    } else if (heartRate < 60) {
      kVal += 15;
      vVal -= 5;
      pVal -= 10;
      return {
        status: 'Kapha Elevated (Earth)',
        advice: 'Slow, steady pulse. Engage in brisk movement or warm ginger tea to stimulate circulation.',
        color: 'text-indigo-400',
        rata: vVal,
        pitta: pVal,
        kapha: kVal
      };
    } else {
      return {
        status: 'Tridoshic Balance',
        advice: 'Vitals indicate optimal homeostasis. Continue current health configurations.',
        color: 'text-emerald-400',
        rata: 34,
        pitta: 33,
        kapha: 33
      };
    }
  }, [liveData, dominantDosha, sensorStatus]);

  const vataVal = currentDosha ? currentDosha.vata : (activeDoshaState.rata || 33);
  const pittaVal = currentDosha ? currentDosha.pitta : (activeDoshaState.pitta || 33);
  const kaphaVal = currentDosha ? currentDosha.kapha : (activeDoshaState.kapha || 34);

  const displayDosha = getDoshaInterpretation(
    vataVal,
    pittaVal,
    kaphaVal,
    activeDoshaState.status,
    activeDoshaState.advice,
    activeDoshaState.color
  );

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <Ionicons name="color-palette-outline" size={18} color="#10b981" />
          <Text className="text-white font-bold text-sm ml-2">Dosha Equilibrium</Text>
        </View>
        <Text className={`text-xs font-bold font-mono ${displayDosha.color}`}>
          {displayDosha.status}
        </Text>
      </View>

      {/* Horizontal Balance Segment bar */}
      <View className="flex-row h-3 rounded-full overflow-hidden bg-emerald-950/80 mb-4 border border-emerald-900/30">
        <View style={{ width: `${vataVal}%` }} className="bg-amber-400" />
        <View style={{ width: `${pittaVal}%` }} className="bg-cyan-400" />
        <View style={{ width: `${kaphaVal}%` }} className="bg-purple-400" />
      </View>
      <View className="flex-row justify-between mb-3 px-1">
        <Text className="text-[10px] text-amber-400 font-bold">Vata ({vataVal}%)</Text>
        <Text className="text-[10px] text-sky-400 font-bold">Pitta ({pittaVal}%)</Text>
        <Text className="text-[10px] text-purple-400 font-bold">Kapha ({kaphaVal}%)</Text>
      </View>

      {/* Daily Trend Alert Banner */}
      {currentDosha?.trendAlert && !currentDosha.trendAlert.includes('Establishing') && (
        <View className="bg-emerald-950/50 border border-emerald-500/20 px-3 py-2 rounded-xl mb-3 flex-row items-center">
          <Ionicons name="trending-up" size={13} color="#34d399" />
          <Text className="text-emerald-400/90 text-[10px] font-bold ml-1.5 flex-1">{currentDosha.trendAlert}</Text>
        </View>
      )}

      <Text className="text-emerald-200/80 text-[11px] leading-relaxed italic border-t border-emerald-900/30 pt-3 pb-2">
        {displayDosha.advice}
      </Text>

      {/* Explainable AI Trigger Details */}
      {currentDosha?.explanationSummary?.aggravating && currentDosha.explanationSummary.aggravating.length > 0 && currentDosha.explanationSummary.aggravating[0] !== 'No aggravating anomalies detected.' && (
        <View className="border-t border-emerald-900/20 pt-2.5">
          <Text className="text-emerald-400/60 text-[9px] font-bold uppercase tracking-wider mb-1.5">Influencing Bio-Metrics (AI Explanation)</Text>
          {currentDosha.explanationSummary.aggravating.slice(0, 2).map((factor, i) => (
            <View key={i} className="flex-row items-start mb-1">
              <Text className="text-amber-400 text-[10px] mr-1.5">•</Text>
              <Text className="text-emerald-100/70 text-[10px] flex-1 leading-normal">{factor}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});

interface SleepRecoveryBriefCardProps {
  onLogSleepPress: () => void;
}

const SleepRecoveryBriefCard = React.memo(function SleepRecoveryBriefCard({ onLogSleepPress }: SleepRecoveryBriefCardProps) {
  const sleepHistory = useSleepStore(state => state.sleepHistory);

  const latestSleep = sleepHistory.length > 0 ? sleepHistory[0] : null;
  const sleepDurationHours = latestSleep ? (latestSleep.duration_minutes / 60).toFixed(1) : '--';
  const sleepScore = latestSleep ? latestSleep.sleep_score : '--';

  return (
    <View className="bg-[#051f18]/25 border border-purple-950/30 p-5 rounded-3xl mb-6">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <Ionicons name="moon" size={16} color="#a855f7" />
          <Text className="text-white font-bold text-sm ml-2">Sleep Recovery</Text>
        </View>
        <TouchableOpacity onPress={onLogSleepPress} className="bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
          <Text className="text-purple-400 text-[10px] font-bold">Log Sleep</Text>
        </TouchableOpacity>
      </View>
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-emerald-400/60 text-[10px] font-bold uppercase">Sleep Duration</Text>
          <Text className="text-white text-2xl font-black mt-0.5">
            {sleepDurationHours} <Text className="text-emerald-400/70 text-xs font-normal">hrs</Text>
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-emerald-400/60 text-[10px] font-bold uppercase">Restfulness</Text>
          <Text className="text-purple-400 text-2xl font-black mt-0.5">
            {sleepScore}%
          </Text>
        </View>
      </View>
    </View>
  );
});
