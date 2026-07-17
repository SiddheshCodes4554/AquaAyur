import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, { Polygon, Line, Defs, RadialGradient, Stop, G, Circle } from 'react-native-svg';
import { useAuthStore } from '../../store/useAuthStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useHydrationStore } from '../../store/useHydrationStore';
import { useSleepStore } from '../../store/useSleepStore';
import { useDoshaStore } from '../../store/useDoshaStore';
import { useAgniStore } from '../../store/useAgniStore';
import { useOjasStore } from '../../store/useOjasStore';
import { useDigitalTwinStore } from '../../store/useDigitalTwinStore';
import { useDinacharyaStore } from '../../store/useDinacharyaStore';
import { triggerSync } from '../../services/syncManager';
import AyurExplanationSheet from '../../components/AyurExplanationSheet';
import AyurConceptExplanationSheet from '../../components/AyurConceptExplanationSheet';
import { ConceptId } from '../../services/conceptExplanations';
import { generateDailyStory } from '../../services/dailyStoryEngine';
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';
import { useExperienceStore } from '../../store/useExperienceStore';
import { ExperienceSwitch } from '../../components/ExperienceSwitch';
import { 
  getLocalizedDoshaState, 
  getLocalizedAgni, 
  getLocalizedOjas, 
  getLocalizedHeartRate, 
  getLocalizedTemperature, 
  getLocalizedMovement 
} from '../../services/translationEngine';

const AnimatedG = Animated.createAnimatedComponent(G);

export default function DashboardScreen() {
  const profile = useAuthStore(state => state.profile);
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);

  // Experience Mode
  const { mode, locale, setLocale, welcomeDismissed, setWelcomeDismissed } = useExperienceStore();

  // Zustand Store states
  const todayAgni = useAgniStore(state => state.todayAgni);
  const todayOjas = useOjasStore(state => state.todayOjas);
  const currentDosha = useDoshaStore(state => state.currentDosha);
  const { todayDinacharya, completions, fetchTodayDinacharya, toggleTaskCompletion } = useDinacharyaStore();
  const { todayTotalMl, fetchTodayLogs, logWater, pendingSyncCount: hydrationPending } = useHydrationStore();
  const telemetryPending = useTelemetryStore(state => state.pendingSyncCount);
  const sleepPending = useSleepStore(state => state.pendingSyncCount);
  const sleepHistory = useSleepStore(state => state.sleepHistory);
  const totalPending = hydrationPending + telemetryPending + sleepPending;
  const liveData = useSensorStore(state => state.liveData);
  const sensorStatus = useSensorStore(state => state.status);
  const { agni, ojas } = useDigitalTwinStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [explanationContext, setExplanationContext] = useState<ExplanationContext | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptId | null>(null);

  // Wellness View Plain Language Translations
  const getHeartRateTranslation = (hr: number) => {
    return getLocalizedHeartRate(hr, locale);
  };

  const getTempTranslation = (temp: number) => {
    return getLocalizedTemperature(temp, locale);
  };

  const getStepsTranslation = (steps: number) => {
    return getLocalizedMovement(steps, locale);
  };

  const getWellnessTranslations = () => {
    const vataVal = currentDosha?.vata || 33.3;
    const pittaVal = currentDosha?.pitta || 33.3;
    const kaphaVal = currentDosha?.kapha || 33.4;

    const translated = getLocalizedDoshaState(vataVal, pittaVal, kaphaVal, locale);

    const agniScore = todayAgni?.agni_score || agni || 75;
    const ojasScore = todayOjas?.ojas_score || ojas || 78;

    const warnings: string[] = [];
    if (agniScore <= 70) {
      warnings.push(locale === 'sa' ? "Mandāgni saṁvedanaśīlā asti." : "Your digestion may be slightly slower today.");
    }
    if (ojasScore <= 75) {
      warnings.push(locale === 'sa' ? "Ojo-kṣayaḥ viśrāmaḥ āvaśyakaḥ." : "Your body may need additional recovery today.");
    }

    return {
      stateText: translated.whatIsHappening,
      whyText: translated.why,
      actionText: translated.whatTodo,
      nextText: translated.whatNextDay,
      warnings
    };
  };

  const getDailyStory = () => {
    const vataVal = currentDosha?.vata || 33.3;
    const pittaVal = currentDosha?.pitta || 33.3;
    const kaphaVal = currentDosha?.kapha || 33.4;

    const agniScore = todayAgni?.agni_score || agni || 75;
    const ojasScore = todayOjas?.ojas_score || ojas || 78;

    const sleepMin = sleepHistory && sleepHistory.length > 0 ? sleepHistory[0].duration_minutes : 0;
    const avgSleepMin = sleepHistory && sleepHistory.length > 0 
      ? Math.round(sleepHistory.reduce((s, v) => s + v.duration_minutes, 0) / sleepHistory.length)
      : 480;

    return generateDailyStory({
      userName: profile?.first_name || 'Yogi',
      dominantDosha: profile?.dominant_dosha || 'tridoshic',
      vata: vataVal,
      pitta: pittaVal,
      kapha: kaphaVal,
      agni: agniScore,
      ojas: ojasScore,
      sleepMinutes: sleepMin,
      avgSleepMinutes: avgSleepMin,
      heartRate: liveData?.heartRate || 0,
      avgHeartRate: 70,
      temperature: liveData?.temperature || 0,
      avgTemperature: 36.5,
      steps: liveData?.steps || 0,
      waterMl: todayTotalMl || 0
    });
  };

  const handleOpenExplanation = (recommendationTitle: string) => {
    const biometricsSnapshot = liveData ? {
      heartRate: liveData.heartRate,
      temperature: liveData.temperature,
      steps: liveData.steps,
      activity: liveData.activity
    } : null;
    const doshaPercentages = currentDosha ? {
      vata: currentDosha.vata,
      pitta: currentDosha.pitta,
      kapha: currentDosha.kapha
    } : null;
    const agniScoreVal = todayAgni?.agni_score || agni || 75;
    const ojasScoreVal = todayOjas?.ojas_score || ojas || 78;

    const ctx = getExplanationForRecommendation(
      recommendationTitle,
      biometricsSnapshot,
      doshaPercentages,
      agniScoreVal,
      ojasScoreVal
    );
    setExplanationContext(ctx);
    setExplanationVisible(true);
  };

  const loadData = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        useTelemetryStore.getState().fetchHistory(user.id),
        useSleepStore.getState().fetchHistory(user.id),
        useDoshaStore.getState().fetchCurrentState(user.id),
        useAgniStore.getState().fetchTodayAgni(user.id),
        useOjasStore.getState().fetchTodayOjas(user.id),
        useDigitalTwinStore.getState().fetchTwinState(user.id),
        fetchTodayLogs(user.id),
        fetchTodayDinacharya(user.id),
        triggerSync()
      ]);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) {
      await Promise.all([
        useTelemetryStore.getState().fetchHistory(user.id),
        useSleepStore.getState().fetchHistory(user.id),
        useDoshaStore.getState().recalculateToday(user.id),
        useAgniStore.getState().recalculateAgni(user.id),
        useOjasStore.getState().recalculateOjas(user.id),
        useDigitalTwinStore.getState().fetchTwinState(user.id),
        fetchTodayLogs(user.id),
        fetchTodayDinacharya(user.id),
        triggerSync()
      ]);
    }
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good Morning';
    if (hours < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Dynamic Narrative / Storyteller
  const narrative = useMemo(() => {
    const agniScore = todayAgni?.agni_score || 75;
    const ojasScore = todayOjas?.ojas_score || 78;
    const recovery = Math.round((agniScore + ojasScore) / 2);

    let wellnessStatement = 'Your system registers calm equilibrium today.';
    let primaryImbalance = 'homeostasis';
    let routineFocus = 'Maintain hydration and consume fresh, warm foods to support metabolic fire.';
    let predictedOutcome = 'Sustaining this balance will lead to stable evening energy and deep sleep restoration.';

    if (currentDosha) {
      const maxDosha = Math.max(currentDosha.vata, currentDosha.pitta, currentDosha.kapha);
      if (maxDosha === currentDosha.vata && currentDosha.vata > 35) {
        primaryImbalance = 'vata';
        wellnessStatement = 'A breeze of Vata wind is scattering your energy today, indicating minor sleep fragmentation.';
        routineFocus = 'Prioritize grounding routines: drink warm herbal infusions and practice slow breathing.';
        predictedOutcome = 'Grounding Vata today will stabilize your nervous system and increase sleep efficiency tonight by 10%.';
      } else if (maxDosha === currentDosha.pitta && currentDosha.pitta > 35) {
        primaryImbalance = 'pitta';
        wellnessStatement = 'Your internal Pitta fire is intense today, manifesting as elevated resting heart rates.';
        routineFocus = 'Cool the flames: seek sweet cooling fruits, coconut water, and a short walk in shaded environments.';
        predictedOutcome = 'Pacifying Pitta today will lower your body heat and prevent midday digestive acidity.';
      } else if (maxDosha === currentDosha.kapha && currentDosha.kapha > 35) {
        primaryImbalance = 'kapha';
        wellnessStatement = 'A heavy Kapha earth energy is slowing your physical pace and bringing minor lethargy.';
        routineFocus = 'Ignite the spark: engage in cardiorespiratory activity, brisk walking, and warm ginger water.';
        predictedOutcome = 'Stimulating Kapha today will dispel slow metabolic stagnation and clear mental fog by evening.';
      }
    }

    return {
      recovery,
      wellnessStatement,
      primaryImbalance,
      routineFocus,
      predictedOutcome
    };
  }, [todayAgni, todayOjas, currentDosha]);

  const visibleTasks = useMemo(() => {
    const currentHour = new Date().getHours();
    const tasks = [
      {
        key: 'hydration',
        title: 'Hydration Target',
        subtitle: `${todayTotalMl} / ${profile?.daily_water_goal_ml || 2500} ml Logged`,
        timeLabel: '7:00 AM',
        targetHour: 7,
        completed: !!completions.hydration,
        why: 'Hydration Target'
      },
      {
        key: 'meal_timing',
        title: 'Principal Midday Meal',
        subtitle: 'Eat between 12:00 - 13:30 when Agni fires peak',
        timeLabel: '12:30 PM',
        targetHour: 13,
        completed: !!completions.meal_timing,
        why: 'Principal Midday Meal'
      },
      {
        key: 'sleep_timing',
        title: 'Night Nadi Shodhana',
        subtitle: '5 minutes of alternate nostril breath at 21:30',
        timeLabel: '9:30 PM',
        targetHour: 21,
        completed: !!completions.sleep_timing,
        why: 'Night Nadi Shodhana'
      }
    ];

    return tasks.filter(task => {
      if (!task.completed) return true;
      return currentHour <= (task.targetHour + 2);
    });
  }, [completions, todayTotalMl, profile?.daily_water_goal_ml]);

  const logHydrationQuick = async () => {
    if (!user?.id) return;
    try {
      await logWater(user.id, 250, 'manual');
      await Promise.all([
        useAgniStore.getState().recalculateAgni(user.id),
        useOjasStore.getState().recalculateOjas(user.id),
        useDoshaStore.getState().recalculateToday(user.id)
      ]);
    } catch (err) {
      console.error('[Dashboard] Quick log water failed:', err);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#607C64" />}
          className="px-6 py-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-8 mt-3">
            <View>
              <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">{getGreeting()}</Text>
              <Text className="text-[#2E3A2F] text-3xl font-serif font-black mt-0.5">{profile?.first_name || 'Yogi'}</Text>
            </View>
            <View className="flex-row items-center gap-3">
              {totalPending > 0 && (
                <View className="bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="cloud-offline" size={10} color="#f59e0b" />
                  <Text className="text-amber-500 text-[10px] font-bold ml-1 font-mono">{totalPending}</Text>
                </View>
              )}
              <ConnectionStatusIndicator />
              <TouchableOpacity 
                onPress={() => setLocale(locale === 'en' ? 'sa' : 'en')} 
                className="bg-white border border-[#E4E1D8] px-3 py-2.5 rounded-xl active:bg-emerald-950/5"
              >
                <Text className="text-[#607C64] text-[10px] font-bold font-mono uppercase tracking-wider">
                  {locale === 'en' ? 'En' : 'Sa'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setShowProfileModal(true)} 
                className="bg-white border border-[#E4E1D8] p-2.5 rounded-xl active:bg-emerald-950/5"
              >
                <Ionicons name="cog-outline" size={18} color="#607C64" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Experience Switch Segmented Control */}
          <ExperienceSwitch />

          {/* Welcome Onboarding Card */}
          {!welcomeDismissed && (
            <View className="bg-white border border-[#E4E1D8] p-5.5 rounded-3xl mb-8 relative overflow-hidden mt-6 shadow-sm shadow-[#E4E1D8]/40">
              <View className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
              <TouchableOpacity 
                onPress={() => setWelcomeDismissed(true)}
                className="absolute right-3.5 top-3.5 w-6 h-6 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] items-center justify-center active:bg-emerald-950/5"
                style={{ zIndex: 10 }}
              >
                <Ionicons name="close" size={12} color="#607C64" />
              </TouchableOpacity>

              <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">Welcome to AquaAyur 🌿</Text>
              <Text className="text-[#2E3A2F] text-base font-serif font-black mt-2 mb-2">You don't need to know Ayurveda.</Text>
              <Text className="text-slate-550 text-[11px] leading-relaxed mb-4">
                We'll help you understand your body one day at a time. Every recommendation is based on:
              </Text>
              
              <View className="space-y-2 mb-5">
                <View className="flex-row items-center mt-1">
                  <Ionicons name="watch-outline" size={13} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Your paired sensor wearable band</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="checkbox-outline" size={13} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Your daily logged habits</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="sunny-outline" size={13} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Your lifestyle and circadian path</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="leaf-outline" size={13} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Ayurvedic wellness principles</Text>
                </View>
              </View>

              <TouchableOpacity 
                onPress={() => setWelcomeDismissed(true)}
                className="bg-[#7D9C83] py-3.5 rounded-2xl items-center active:bg-[#607C64] shadow shadow-emerald-500/10"
              >
                <Text className="text-white font-black text-xs uppercase tracking-wider">Let's begin your first Wellness Brief</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ayurvedic Twin Avatar Core */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/digital-twin')}
            activeOpacity={0.9}
            className="items-center justify-center mb-8"
          >
            <AyurvedicTwinAvatar />
          </TouchableOpacity>

          {/* Live Telemetry Stream Card */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/live-monitor')}
            className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-8 active:bg-emerald-955/5 shadow-sm shadow-[#E4E1D8]/40"
          >
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <Ionicons name="pulse" size={16} color="#607C64" />
                <Text className="text-[#2E3A2F] text-xs font-serif font-black ml-2">Live Biometric Feed</Text>
              </View>
              <View className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-0.5 rounded-full">
                <View 
                  className="w-1.5 h-1.5 rounded-full mr-1.5"
                  style={{
                    backgroundColor: sensorStatus === 'connected' ? '#10b981' : '#ef4444',
                    shadowColor: sensorStatus === 'connected' ? '#10b981' : undefined,
                    shadowOffset: sensorStatus === 'connected' ? { width: 0, height: 0 } : undefined,
                    shadowOpacity: sensorStatus === 'connected' ? 0.6 : undefined,
                    shadowRadius: sensorStatus === 'connected' ? 4 : undefined,
                    elevation: sensorStatus === 'connected' ? 2 : undefined
                  }}
                />
                <Text className="text-[#2E3A2F] text-[8px] font-bold uppercase font-mono tracking-widest">
                  {sensorStatus === 'connected' ? 'Live Stream' : 'Offline'}
                </Text>
              </View>
            </View>

            {sensorStatus === 'connected' ? (
              <View className="flex-row justify-between items-center">
                <View className="items-center flex-1">
                  <View className="flex-row items-center">
                    <Ionicons name="heart" size={12} color="#ef4444" style={{ marginRight: 4 }} />
                    <Text className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Heart State</Text>
                  </View>
                  <Text className="text-[#2E3A2F] text-xs font-bold mt-1 text-center">
                    {mode === 'wellness' 
                      ? getHeartRateTranslation(liveData?.heartRate || 72)
                      : `${liveData?.heartRate || 72} bpm`}
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-[#E4E1D8]" />

                <View className="items-center flex-1">
                  <View className="flex-row items-center">
                    <Ionicons name="thermometer" size={12} color="#38bdf8" style={{ marginRight: 4 }} />
                    <Text className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Skin Temp</Text>
                  </View>
                  <Text className="text-[#2E3A2F] text-xs font-bold mt-1 text-center">
                    {mode === 'wellness'
                      ? getTempTranslation(liveData?.temperature || 36.5)
                      : `${liveData?.temperature ? liveData.temperature.toFixed(1) : '36.5'} °C`}
                  </Text>
                </View>

                <View className="w-[1px] h-8 bg-[#E4E1D8]" />

                <View className="items-center flex-1">
                  <View className="flex-row items-center">
                    <Ionicons name="footsteps" size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                    <Text className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Movement</Text>
                  </View>
                  <Text className="text-[#2E3A2F] text-xs font-bold mt-1 text-center">
                    {mode === 'wellness'
                      ? getStepsTranslation(liveData?.steps || 0)
                      : `${liveData?.steps || 0} steps`}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="flex-row justify-between items-center py-1">
                <Text className="text-slate-500 text-xs flex-1 mr-3 leading-relaxed">
                  No active wearable hardware paired. Tap here to pair your sensor band.
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#607C64" />
              </View>
            )}
          </TouchableOpacity>

          {/* Narrative Insight block */}
          {mode === 'wellness' ? (
            <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-8 shadow-sm shadow-[#E4E1D8]/40">
              <View className="flex-row justify-between items-center mb-4 border-b border-[#E4E1D8]/45 pb-3">
                <View>
                  <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">Daily Story</Text>
                  <Text className="text-slate-450 text-[7.5px] font-mono mt-0.5">PREDICTION CONFIDENCE: {getDailyStory().confidence}%</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setSelectedConcept((narrative.primaryImbalance as ConceptId) || 'pitta')}
                  className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1 rounded-xl"
                >
                  <Text className="text-[#607C64] text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-[#2E3A2F] text-base font-serif font-black leading-snug mb-3">
                {getDailyStory().greeting}
              </Text>
              
              <Text className="text-slate-600 text-xs font-serif leading-relaxed mb-4">
                {getDailyStory().currentCondition} {getDailyStory().reason} {getDailyStory().prediction}
              </Text>

              {/* Today's Focus List */}
              <View className="bg-[#F5F2EA]/60 border border-[#E4E1D8] p-4.5 rounded-2xl mb-4">
                <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-2">Today's Focus Tasks</Text>
                {getDailyStory().recommendations.map((rec, idx) => (
                  <View key={idx} className="flex-row items-center mt-1">
                    <Ionicons name="sparkles" size={10} color="#607C64" style={{ marginRight: 6 }} />
                    <Text className="text-slate-600 text-xs font-sans">{rec}</Text>
                  </View>
                ))}
              </View>

              {/* Expected Outcome */}
              <View className="border-t border-[#E4E1D8]/45 pt-3">
                <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">Expected Outcome</Text>
                <Text className="text-slate-600 text-xs mt-1 leading-relaxed">
                  {getDailyStory().expectedOutcome}
                </Text>
              </View>
            </View>
          ) : (
            <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-8 shadow-sm shadow-[#E4E1D8]/40">
              <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest mb-2 font-mono">Today's State</Text>
              <Text className="text-[#2E3A2F] text-xl font-serif font-bold leading-snug mb-3">
                {narrative.wellnessStatement}
              </Text>
              <Text className="text-slate-600 text-xs leading-relaxed">
                Your metabolic fire (Agni) is currently registered at {todayAgni?.agni_score || 75}% ({todayAgni?.agni_state || 'Balanced'}), while your immune cellular shield (Ojas) index holds at {todayOjas?.ojas_score || 78}%. Overall physiological recovery is calculated at {narrative.recovery}%.
              </Text>

              <View className="border-t border-[#E4E1D8] pt-4 mt-4 flex-row justify-around">
                <TouchableOpacity onPress={() => setSelectedConcept('agni')} className="items-center">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wide">Agni</Text>
                  <Text className="text-[#2E3A2F] text-sm font-bold font-mono mt-0.5">{todayAgni?.agni_score || 75}%</Text>
                  <Text className="text-[#607C64]/70 text-[7.5px] font-bold mt-0.5 font-mono uppercase tracking-wider">Learn Why</Text>
                </TouchableOpacity>
                <View className="w-[1px] bg-[#E4E1D8]" />
                <TouchableOpacity onPress={() => setSelectedConcept('ojas')} className="items-center">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wide">Ojas</Text>
                  <Text className="text-[#2E3A2F] text-sm font-bold font-mono mt-0.5">{todayOjas?.ojas_score || 78}%</Text>
                  <Text className="text-[#607C64]/70 text-[7.5px] font-bold mt-0.5 font-mono uppercase tracking-wider">Learn Why</Text>
                </TouchableOpacity>
                <View className="w-[1px] bg-[#E4E1D8]" />
                <TouchableOpacity onPress={() => setSelectedConcept((narrative.primaryImbalance as ConceptId) || 'pitta')} className="items-center">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wide">Imbalance</Text>
                  <Text className="text-[#2E3A2F] text-sm font-bold font-mono mt-0.5">{(narrative.primaryImbalance || 'Pitta').toUpperCase()}</Text>
                  <Text className="text-[#607C64]/70 text-[7.5px] font-bold mt-0.5 font-mono uppercase tracking-wider">Learn Why</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Tomorrow's Forecast Prediction (Evidence View only - represented inside Wellness Insight for Wellness view) */}
          {mode === 'evidence' && (
            <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-8 shadow-sm shadow-[#E4E1D8]/40">
              <Text className="text-[#607C64] text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Tomorrow's Forecast</Text>
              <Text className="text-[#2E3A2F] text-sm font-serif font-bold mb-2">Predicted Outcome</Text>
              <Text className="text-slate-600 text-xs leading-relaxed">
                {narrative.predictedOutcome}
              </Text>
            </View>
          )}

          {/* Upcoming Health Mission */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-8 flex-row items-center shadow-sm shadow-[#E4E1D8]/40">
            <View className="w-10 h-10 rounded-full bg-[#F5F2EA] border border-[#E4E1D8] items-center justify-center mr-4">
              <Ionicons name="sparkles" size={18} color="#607C64" />
            </View>
            <View className="flex-1">
              <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono">Current Focus</Text>
              <Text className="text-[#2E3A2F] text-sm font-serif font-bold mt-0.5">Hydration & Circadian Lock</Text>
              <Text className="text-slate-600 text-xs mt-1 leading-relaxed">
                {narrative.routineFocus}
              </Text>
            </View>
          </View>

          {/* Today's Plan (Checklist recommendations) */}
          <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-8 shadow-sm shadow-[#E4E1D8]/40">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#607C64] text-[10px] font-bold uppercase tracking-wider font-mono">Today's Plan</Text>
              <Text className="text-slate-400 text-[9px] font-mono">Remaining Tasks</Text>
            </View>
            
            <View className="space-y-3.5">
              {visibleTasks.length === 0 ? (
                <View className="py-4 items-center justify-center">
                  <Ionicons name="checkmark-done-circle-outline" size={32} color="#607C64" />
                  <Text className="text-[#607C64] text-xs font-serif font-black mt-2 text-center">
                    All remaining Dinacharya tasks are completed!
                  </Text>
                  <Text className="text-slate-500 text-[10px] text-center mt-1">
                    Rest and conserve your Ojas.
                  </Text>
                </View>
              ) : (
                visibleTasks.map((task) => (
                  <View key={task.key} className="flex-row items-center bg-[#F5F2EA]/40 p-4 rounded-2xl border border-[#E4E1D8] justify-between">
                    <TouchableOpacity
                      onPress={() => user?.id && toggleTaskCompletion(user.id, task.key)}
                      className="flex-row items-center flex-1 mr-3"
                    >
                      <Ionicons 
                        name={task.completed ? 'checkmark-circle' : 'ellipse-outline'} 
                        size={22} 
                        color={task.completed ? '#607C64' : '#E4E1D8'} 
                      />
                      <View className="ml-3 flex-1">
                        <Text className={`text-[#2E3A2F] text-xs font-bold ${task.completed ? 'line-through text-slate-400' : ''}`}>
                          {task.title}
                        </Text>
                        <Text className="text-slate-500 text-[10px] mt-0.5">
                          {task.subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleOpenExplanation(task.why)}
                      className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1.5 rounded-lg active:bg-emerald-950/5"
                    >
                      <Text className="text-[#607C64] font-bold text-[8px] tracking-wider uppercase">WHY?</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Quick Action Buttons */}
          <View className="flex-row space-x-3 mb-6">
            <TouchableOpacity
              onPress={logHydrationQuick}
              className="flex-1 bg-[#7D9C83] rounded-xl py-3.5 flex-row justify-center items-center shadow active:bg-[#607C64]"
            >
              <Ionicons name="water" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text className="text-white font-black text-xs uppercase tracking-wider">Log +250ml</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/coach')}
              className="flex-1 bg-white border border-[#E4E1D8] rounded-xl py-3.5 flex-row justify-center items-center active:bg-emerald-955/5"
            >
              <Ionicons name="chatbubble-ellipses" size={14} color="#607C64" style={{ marginRight: 6 }} />
              <Text className="text-[#607C64] font-bold text-xs uppercase tracking-wider">Consult Physician</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Modal Companion Settings */}
        <Modal
          visible={showProfileModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowProfileModal(false)}
        >
          <View className="flex-1 bg-black/40 justify-end">
            <View className="bg-[#F8F6F0] border-t border-[#E4E1D8] p-6 rounded-t-3xl min-h-[50%]">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-[#2E3A2F] text-lg font-serif font-black">Sanctuary Settings</Text>
                <TouchableOpacity
                  onPress={() => setShowProfileModal(false)}
                  className="p-1.5 rounded-full bg-[#F2EFE8] border border-[#E4E1D8]"
                >
                  <Ionicons name="close" size={18} color="#607C64" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowProfileModal(false);
                  router.push('/(tabs)/profile');
                }}
                className="bg-white border border-[#E4E1D8] p-4 rounded-2xl mb-4 active:bg-emerald-955/5 shadow-sm"
              >
                <Text className="text-[#607C64] text-[10px] uppercase font-bold mb-2 font-mono">Active Profile</Text>
                <Text className="text-[#2E3A2F] text-base font-bold">{profile?.full_name || 'Yogi'}</Text>
                <Text className="text-slate-500 text-xs mt-1">
                  Dominant Dosha: <Text className="text-[#607C64] capitalize">{profile?.dominant_dosha?.replace('_', ' ') || 'Calculating...'}</Text>
                </Text>
                <Text className="text-slate-500 text-xs mt-1">
                  Water Allocation: <Text className="text-[#607C64]">{profile?.daily_water_goal_ml || 2500} ml</Text>
                </Text>
              </TouchableOpacity>

              <View className="space-y-3.5 mb-6">
                <TouchableOpacity
                  onPress={() => {
                    setShowProfileModal(false);
                    router.push('/(tabs)/profile');
                  }}
                  className="bg-white border border-[#E4E1D8] p-4 rounded-xl flex-row items-center justify-between active:bg-emerald-955/5 shadow-sm"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="person-outline" size={18} color="#607C64" />
                    <Text className="text-[#2E3A2F] text-xs font-bold ml-3">Wellness Profile</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#8C958E" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowProfileModal(false);
                    router.push('/(tabs)/device');
                  }}
                  className="bg-white border border-[#E4E1D8] p-4 rounded-xl flex-row items-center justify-between active:bg-emerald-955/5 shadow-sm"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="bluetooth" size={18} color="#607C64" />
                    <Text className="text-[#2E3A2F] text-xs font-bold ml-3">Wearable Devices</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#8C958E" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowProfileModal(false);
                    router.push('/(tabs)/settings');
                  }}
                  className="bg-white border border-[#E4E1D8] p-4 rounded-xl flex-row items-center justify-between active:bg-emerald-955/5 shadow-sm"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="settings-outline" size={18} color="#607C64" />
                    <Text className="text-[#2E3A2F] text-xs font-bold ml-3">System Settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#8C958E" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowProfileModal(false);
                  signOut();
                }}
                className="bg-red-500/10 border border-red-500/20 py-3.5 rounded-xl items-center w-full active:bg-red-500/20"
              >
                <Text className="text-red-400 font-bold text-xs uppercase tracking-wider">Leave Sanctuary</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <AyurExplanationSheet
          visible={explanationVisible}
          onClose={() => setExplanationVisible(false)}
          context={explanationContext}
        />

        <AyurConceptExplanationSheet
          visible={!!selectedConcept}
          onClose={() => setSelectedConcept(null)}
          conceptId={selectedConcept}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

// Subcomponents
const ConnectionStatusIndicator = React.memo(function ConnectionStatusIndicator() {
  const sensorStatus = useSensorStore(state => state.status);
  const [pulseGlow, setPulseGlow] = useState(1);

  useEffect(() => {
    if (sensorStatus !== 'connected') return;
    const pulseTimer = setInterval(() => {
      setPulseGlow(p => (p === 1 ? 0.4 : 1));
    }, 1200);
    return () => clearInterval(pulseTimer);
  }, [sensorStatus]);

  return (
    <View className="bg-[#F2EFE8] border border-[#E4E1D8] px-3 py-1.5 rounded-full flex-row items-center">
      <View 
        style={{ 
          opacity: sensorStatus === 'connected' ? pulseGlow : 1,
          backgroundColor: sensorStatus === 'connected' ? '#607C64' : '#ef4444',
          shadowColor: sensorStatus === 'connected' ? '#607C64' : undefined,
          shadowOffset: sensorStatus === 'connected' ? { width: 0, height: 0 } : undefined,
          shadowOpacity: sensorStatus === 'connected' ? 0.6 : undefined,
          shadowRadius: sensorStatus === 'connected' ? 4 : undefined,
          elevation: sensorStatus === 'connected' ? 2 : undefined
        }} 
        className="w-1.5 h-1.5 rounded-full mr-1.5" 
      />
      <Text className="text-[#607C64] text-[9px] font-bold uppercase font-mono tracking-widest">
        {sensorStatus === 'connected' ? 'Linked' : 'Offline'}
      </Text>
    </View>
  );
});

const AyurvedicTwinAvatar = React.memo(function AyurvedicTwinAvatar() {
  const userId = useAuthStore(state => state.user?.id);
  const { vata, pitta, kapha, agni, ojas, fetchTwinState, subscribeToTwinUpdates } = useDigitalTwinStore();

  const agniPulse = useRef(new Animated.Value(1)).current;
  const ojasBreathe = useRef(new Animated.Value(1)).current;

  const vataY = useRef(new Animated.Value(150 - (30 + (vata / 100) * 100))).current;
  const pittaX = useRef(new Animated.Value(150 + (30 + (pitta / 100) * 100) * Math.cos(Math.PI / 6))).current;
  const pittaY = useRef(new Animated.Value(150 + (30 + (pitta / 100) * 100) * Math.sin(Math.PI / 6))).current;
  const kaphaX = useRef(new Animated.Value(150 + (30 + (kapha / 100) * 100) * Math.cos(5 * Math.PI / 6))).current;
  const kaphaY = useRef(new Animated.Value(150 + (30 + (kapha / 100) * 100) * Math.sin(5 * Math.PI / 6))).current;

  useEffect(() => {
    if (userId) {
      fetchTwinState(userId);
      const unsubscribe = subscribeToTwinUpdates(userId);
      return () => unsubscribe();
    }
  }, [userId]);

  useEffect(() => {
    const agniDuration = Math.max(600, 2000 - (agni / 100) * 1400);
    const agniAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(agniPulse, { toValue: 1.25, duration: agniDuration, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(agniPulse, { toValue: 0.95, duration: agniDuration, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    );
    agniAnim.start();

    const ojasAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ojasBreathe, { toValue: 1.04, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(ojasBreathe, { toValue: 0.96, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: false })
      ])
    );
    ojasAnim.start();

    return () => {
      agniAnim.stop();
      ojasAnim.stop();
    };
  }, [agni, ojas]);

  useEffect(() => {
    const vY = 150 - (30 + (vata / 100) * 100);
    const pX = 150 + (30 + (pitta / 100) * 100) * Math.cos(Math.PI / 6);
    const pY = 150 + (30 + (pitta / 100) * 100) * Math.sin(Math.PI / 6);
    const kX = 150 + (30 + (kapha / 100) * 100) * Math.cos(5 * Math.PI / 6);
    const kY = 150 + (30 + (kapha / 100) * 100) * Math.sin(5 * Math.PI / 6);

    Animated.parallel([
      Animated.timing(vataY, { toValue: vY, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(pittaX, { toValue: pX, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(pittaY, { toValue: pY, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(kaphaX, { toValue: kX, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: false }),
      Animated.timing(kaphaY, { toValue: kY, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start();
  }, [vata, pitta, kapha]);

  const [polyPoints, setPolyPoints] = useState('150,50 250,200 50,200');
  useEffect(() => {
    const currentValues = {
      vY: 150 - (30 + (vata / 100) * 100),
      pX: 150 + (30 + (pitta / 100) * 100) * Math.cos(Math.PI / 6),
      pY: 150 + (30 + (pitta / 100) * 100) * Math.sin(Math.PI / 6),
      kX: 150 + (30 + (kapha / 100) * 100) * Math.cos(5 * Math.PI / 6),
      kY: 150 + (30 + (kapha / 100) * 100) * Math.sin(5 * Math.PI / 6),
    };

    const updatePoints = () => {
      setPolyPoints(`150,${currentValues.vY} ${currentValues.pX},${currentValues.pY} ${currentValues.kX},${currentValues.kY}`);
    };

    const listeners = [
      vataY.addListener(({ value }) => {
        currentValues.vY = value;
        updatePoints();
      }),
      pittaX.addListener(({ value }) => {
        currentValues.pX = value;
        updatePoints();
      }),
      pittaY.addListener(({ value }) => {
        currentValues.pY = value;
        updatePoints();
      }),
      kaphaX.addListener(({ value }) => {
        currentValues.kX = value;
        updatePoints();
      }),
      kaphaY.addListener(({ value }) => {
        currentValues.kY = value;
        updatePoints();
      }),
    ];

    updatePoints();

    return () => {
      vataY.removeListener(listeners[0]);
      pittaX.removeListener(listeners[1]);
      pittaY.removeListener(listeners[2]);
      kaphaX.removeListener(listeners[3]);
      kaphaY.removeListener(listeners[4]);
    };
  }, [vata, pitta, kapha]);

  return (
    <View className="items-center justify-center py-2 relative">
      <View className="w-56 h-56 rounded-full border border-[#E4E1D8] bg-white items-center justify-center shadow-sm relative overflow-hidden">
        
        {/* Outer glowing breathe ring */}
        <Animated.View 
          style={{
            width: 175,
            height: 175,
            borderRadius: 9999,
            borderWidth: 1.5,
            borderColor: 'rgba(96, 124, 100, 0.25)', // Sage green alpha
            position: 'absolute',
            transform: [{ scale: ojasBreathe }],
            opacity: 0.4 + (ojas / 100) * 0.5,
          }}
        />

        {/* Digital Twin SVG Mandala */}
        <Svg width="180" height="180" viewBox="0 0 300 300">
          <Defs>
            <RadialGradient id="agniFire" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="40%" stopColor="#D48C7B" stopOpacity="0.95" />
              <Stop offset="80%" stopColor="#C07A65" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#C07A65" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mandalaShine" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="rgba(96, 124, 100, 0.15)" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="rgba(255, 255, 255, 0.8)" stopOpacity="0.15" />
            </RadialGradient>
          </Defs>

          <Line x1="150" y1="150" x2="150" y2="30" stroke="rgba(96, 124, 100, 0.15)" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="150" y1="150" x2="253.9" y2="210" stroke="rgba(96, 124, 100, 0.15)" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="150" y1="150" x2="46.1" y2="210" stroke="rgba(96, 124, 100, 0.15)" strokeWidth="1" strokeDasharray="3,3" />
          
          <Polygon
            points={polyPoints}
            fill="url(#mandalaShine)"
            stroke="#607C64" // Sage Green Accent
            strokeWidth="2"
          />
          
          {/* Nodes corresponding to Vata, Pitta, Kapha */}
          <Circle cx="150" cy="30" r="4.5" fill="#5C788A" /> {/* Vata - Slate Blue */}
          <Circle cx="253.9" cy="210" r="4.5" fill="#C07A65" /> {/* Pitta - Terracotta */}
          <Circle cx="46.1" cy="210" r="4.5" fill="#607C64" /> {/* Kapha - Sage Green */}

          <AnimatedG transform={[{ scale: agniPulse }]} origin="150, 150">
            <Circle cx="150" cy="150" r="26" fill="url(#agniFire)" />
          </AnimatedG>
        </Svg>
      </View>
    </View>
  );
});
