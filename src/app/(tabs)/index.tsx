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
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';

const AnimatedG = Animated.createAnimatedComponent(G);

export default function DashboardScreen() {
  const profile = useAuthStore(state => state.profile);
  const user = useAuthStore(state => state.user);
  const signOut = useAuthStore(state => state.signOut);

  // Zustand Store states
  const todayAgni = useAgniStore(state => state.todayAgni);
  const todayOjas = useOjasStore(state => state.todayOjas);
  const currentDosha = useDoshaStore(state => state.currentDosha);
  const { todayDinacharya, completions, fetchTodayDinacharya, toggleTaskCompletion } = useDinacharyaStore();
  const { todayTotalMl, fetchTodayLogs, logWater, pendingSyncCount: hydrationPending } = useHydrationStore();
  const telemetryPending = useTelemetryStore(state => state.pendingSyncCount);
  const sleepPending = useSleepStore(state => state.pendingSyncCount);
  const totalPending = hydrationPending + telemetryPending + sleepPending;
  const liveData = useSensorStore(state => state.liveData);
  const { agni, ojas } = useDigitalTwinStore();

  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [explanationContext, setExplanationContext] = useState<ExplanationContext | null>(null);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#091310' }}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34d399" />}
          className="px-6 py-4"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-10 mt-3">
            <View>
              <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono">{getGreeting()}</Text>
              <Text className="text-white text-3xl font-serif font-black mt-0.5">{profile?.first_name || 'Yogi'}</Text>
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
                onPress={() => setShowProfileModal(true)} 
                className="bg-[#111d19] border border-[#1f372f] p-2.5 rounded-xl active:bg-emerald-900/10"
              >
                <Ionicons name="cog-outline" size={18} color="#34d399" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Ayurvedic Twin Avatar Core */}
          <View className="items-center justify-center mb-8">
            <AyurvedicTwinAvatar />
          </View>

          {/* Narrative Story block (How am I today?) */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl mb-8">
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest mb-2 font-mono">Today's State</Text>
            <Text className="text-white text-xl font-serif font-bold leading-snug mb-3">
              {narrative.wellnessStatement}
            </Text>
            <Text className="text-slate-300 text-xs leading-relaxed">
              Your metabolic fire (Agni) is currently registered at {todayAgni?.agni_score || 75}% ({todayAgni?.agni_state || 'Balanced'}), while your immune cellular shield (Ojas) index holds at {todayOjas?.ojas_score || 78}%. Overall physiological recovery is calculated at {narrative.recovery}%.
            </Text>

            <View className="border-t border-[#1f372f] pt-4 mt-4 flex-row justify-around">
              <View className="items-center">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wide">Agni</Text>
                <Text className="text-white text-sm font-bold font-mono mt-0.5">{todayAgni?.agni_score || 75}%</Text>
              </View>
              <View className="w-[1px] bg-[#1f372f]" />
              <View className="items-center">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wide">Ojas</Text>
                <Text className="text-white text-sm font-bold font-mono mt-0.5">{todayOjas?.ojas_score || 78}%</Text>
              </View>
              <View className="w-[1px] bg-[#1f372f]" />
              <View className="items-center">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wide">Equilibrium</Text>
                <Text className="text-white text-sm font-bold font-mono mt-0.5">{narrative.recovery}%</Text>
              </View>
            </View>
          </View>

          {/* Upcoming Health Mission */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl mb-8 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-4">
              <Ionicons name="sparkles" size={18} color="#10b981" />
            </View>
            <View className="flex-1">
              <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono">Current Focus</Text>
              <Text className="text-white text-sm font-serif font-bold mt-0.5">Hydration & Circadian Lock</Text>
              <Text className="text-slate-300 text-xs mt-1 leading-relaxed">
                {narrative.routineFocus}
              </Text>
            </View>
          </View>

          {/* Today's Plan (Checklist recommendations) */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl mb-8">
            <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-4 font-mono">Today's Plan</Text>
            
            <View className="space-y-3.5">
              {/* Hydration */}
              <View className="flex-row items-center bg-[#172722]/40 p-4 rounded-2xl border border-[#1f372f] justify-between">
                <TouchableOpacity
                  onPress={() => user?.id && toggleTaskCompletion(user.id, 'hydration')}
                  className="flex-row items-center flex-1 mr-3"
                >
                  <Ionicons 
                    name={completions.hydration ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={22} 
                    color={completions.hydration ? '#10b981' : '#1f372f'} 
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-white text-xs font-bold ${completions.hydration ? 'line-through text-emerald-500/40' : ''}`}>Hydration Target</Text>
                    <Text className="text-emerald-300 text-[10px] mt-0.5 font-mono">{todayTotalMl} / {profile?.daily_water_goal_ml || 2500} ml Logged</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenExplanation('Hydration Target')}
                  className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/20"
                >
                  <Text className="text-emerald-400 font-bold text-[8px] tracking-wider uppercase">WHY?</Text>
                </TouchableOpacity>
              </View>

              {/* Midday meal */}
              <View className="flex-row items-center bg-[#172722]/40 p-4 rounded-2xl border border-[#1f372f] justify-between">
                <TouchableOpacity
                  onPress={() => user?.id && toggleTaskCompletion(user.id, 'exercise_timing')}
                  className="flex-row items-center flex-1 mr-3"
                >
                  <Ionicons 
                    name={completions.exercise_timing ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={22} 
                    color={completions.exercise_timing ? '#10b981' : '#1f372f'} 
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-white text-xs font-bold ${completions.exercise_timing ? 'line-through text-emerald-500/40' : ''}`}>Principal Midday Meal</Text>
                    <Text className="text-emerald-300 text-[10px] mt-0.5">Eat between 12:00 - 13:30 when Agni fires peak</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenExplanation('Principal Midday Meal')}
                  className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/20"
                >
                  <Text className="text-emerald-400 font-bold text-[8px] tracking-wider uppercase">WHY?</Text>
                </TouchableOpacity>
              </View>

              {/* Night wind-down */}
              <View className="flex-row items-center bg-[#172722]/40 p-4 rounded-2xl border border-[#1f372f] justify-between">
                <TouchableOpacity
                  onPress={() => user?.id && toggleTaskCompletion(user.id, 'sleep_timing')}
                  className="flex-row items-center flex-1 mr-3"
                >
                  <Ionicons 
                    name={completions.sleep_timing ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={22} 
                    color={completions.sleep_timing ? '#10b981' : '#1f372f'} 
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-white text-xs font-bold ${completions.sleep_timing ? 'line-through text-emerald-500/40' : ''}`}>Night Nadi Shodhana</Text>
                    <Text className="text-emerald-300 text-[10px] mt-0.5">5 minutes of alternate nostril breath at 21:30</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleOpenExplanation('Night Nadi Shodhana')}
                  className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/20"
                >
                  <Text className="text-emerald-400 font-bold text-[8px] tracking-wider uppercase">WHY?</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Tomorrow's Forecast Prediction */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl mb-8">
            <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-2 font-mono">Tomorrow's Forecast</Text>
            <Text className="text-white text-sm font-serif font-bold mb-2">Predicted Outcome</Text>
            <Text className="text-slate-300 text-xs leading-relaxed">
              {narrative.predictedOutcome}
            </Text>
          </View>

          {/* Quick Action Buttons */}
          <View className="flex-row space-x-3 mb-6">
            <TouchableOpacity
              onPress={logHydrationQuick}
              className="flex-1 bg-emerald-500 rounded-xl py-3.5 flex-row justify-center items-center shadow active:bg-emerald-600"
            >
              <Ionicons name="water" size={14} color="#091310" style={{ marginRight: 6 }} />
              <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Log +250ml</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/coach')}
              className="flex-1 bg-[#111d19] border border-[#1f372f] rounded-xl py-3.5 flex-row justify-center items-center active:bg-emerald-900/15"
            >
              <Ionicons name="chatbubble-ellipses" size={14} color="#34d399" style={{ marginRight: 6 }} />
              <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Consult Physician</Text>
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
          <View className="flex-1 bg-[#091310]/95 justify-end">
            <View className="bg-[#111d19] border-t border-[#1f372f] p-6 rounded-t-3xl min-h-[50%]">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white text-lg font-serif font-black">Sanctuary Settings</Text>
                <TouchableOpacity
                  onPress={() => setShowProfileModal(false)}
                  className="p-1.5 rounded-full bg-[#172722] border border-[#1f372f]"
                >
                  <Ionicons name="close" size={18} color="#34d399" />
                </TouchableOpacity>
              </View>

              <View className="bg-[#172722]/50 border border-[#1f372f] p-4 rounded-2xl mb-4">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold mb-2 font-mono">Active Profile</Text>
                <Text className="text-white text-base font-bold">{profile?.full_name || 'Yogi'}</Text>
                <Text className="text-slate-300 text-xs mt-1">
                  Dominant Dosha: <Text className="text-emerald-400 capitalize">{profile?.dominant_dosha?.replace('_', ' ') || 'Calculating...'}</Text>
                </Text>
                <Text className="text-slate-300 text-xs mt-1">
                  Water Allocation: <Text className="text-emerald-400">{profile?.daily_water_goal_ml || 2500} ml</Text>
                </Text>
              </View>

              <View className="space-y-3.5 mb-6">
                <TouchableOpacity
                  onPress={() => {
                    setShowProfileModal(false);
                    router.push('/(tabs)/device');
                  }}
                  className="bg-[#172722]/30 border border-[#1f372f] p-4 rounded-xl flex-row items-center justify-between active:bg-emerald-900/10"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="bluetooth" size={18} color="#34d399" />
                    <Text className="text-white text-xs font-bold ml-3">Wearable Devices</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#6b7280" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setShowProfileModal(false);
                    router.push('/(tabs)/settings');
                  }}
                  className="bg-[#172722]/30 border border-[#1f372f] p-4 rounded-xl flex-row items-center justify-between active:bg-emerald-900/10"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="settings-outline" size={18} color="#34d399" />
                    <Text className="text-white text-xs font-bold ml-3">System Settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#6b7280" />
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
    <View className="bg-[#111d19]/60 border border-[#1f372f] px-3 py-1.5 rounded-full flex-row items-center">
      <View 
        style={{ opacity: sensorStatus === 'connected' ? pulseGlow : 1 }} 
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sensorStatus === 'connected' ? 'bg-emerald-400 shadow shadow-emerald-400' : 'bg-rose-500'}`} 
      />
      <Text className="text-white text-[9px] font-bold uppercase font-mono tracking-widest">
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
    const updatePoints = () => {
      const vYVal = (vataY as any)._value;
      const pXVal = (pittaX as any)._value;
      const pYVal = (pittaY as any)._value;
      const kXVal = (kaphaX as any)._value;
      const kYVal = (kaphaY as any)._value;
      setPolyPoints(`150,${vYVal} ${pXVal},${pYVal} ${kXVal},${kYVal}`);
    };

    const listeners = [
      vataY.addListener(updatePoints),
      pittaX.addListener(updatePoints),
      pittaY.addListener(updatePoints),
      kaphaX.addListener(updatePoints),
      kaphaY.addListener(updatePoints),
    ];

    return () => {
      vataY.removeListener(listeners[0]);
      pittaX.removeListener(listeners[1]);
      pittaY.removeListener(listeners[2]);
      kaphaX.removeListener(listeners[3]);
      kaphaY.removeListener(listeners[4]);
    };
  }, []);

  return (
    <View className="items-center justify-center py-2 relative">
      <View className="w-56 h-56 rounded-full border border-[#1f372f] bg-[#111d19]/45 items-center justify-center shadow-xl shadow-emerald-950/20 relative overflow-hidden">
        
        {/* Outer glowing breathe ring */}
        <Animated.View 
          style={{
            width: 175,
            height: 175,
            borderRadius: 9999,
            borderWidth: 1.5,
            borderColor: 'rgba(52, 211, 153, 0.35)',
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
              <Stop offset="40%" stopColor="#fbbf24" stopOpacity="0.95" />
              <Stop offset="80%" stopColor="#f97316" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="mandalaShine" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="rgba(52, 211, 153, 0.09)" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="rgba(5, 31, 24, 0.6)" stopOpacity="0.15" />
            </RadialGradient>
          </Defs>

          <Line x1="150" y1="150" x2="150" y2="30" stroke="rgba(16, 185, 129, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="150" y1="150" x2="253.9" y2="210" stroke="rgba(16, 185, 129, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
          <Line x1="150" y1="150" x2="46.1" y2="210" stroke="rgba(16, 185, 129, 0.12)" strokeWidth="1" strokeDasharray="3,3" />
          
          <Polygon
            points={polyPoints}
            fill="url(#mandalaShine)"
            stroke="rgba(52, 211, 153, 0.7)"
            strokeWidth="2"
          />
          
          <Circle cx="150" cy="30" r="3.5" fill="rgba(167, 139, 250, 0.6)" />
          <Circle cx="253.9" cy="210" r="3.5" fill="rgba(249, 115, 22, 0.6)" />
          <Circle cx="46.1" cy="210" r="3.5" fill="rgba(20, 184, 166, 0.6)" />

          <AnimatedG transform={[{ scale: agniPulse }]} origin="150, 150">
            <Circle cx="150" cy="150" r="26" fill="url(#agniFire)" />
          </AnimatedG>
        </Svg>
      </View>
    </View>
  );
});
