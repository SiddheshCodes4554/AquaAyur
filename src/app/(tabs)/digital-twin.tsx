import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Easing, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Circle, Line, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { useAuthStore } from '../../store/useAuthStore';
import { useDigitalTwinStore } from '../../store/useDigitalTwinStore';
import { useDoshaStore } from '../../store/useDoshaStore';
import { useAgniStore } from '../../store/useAgniStore';
import { useOjasStore } from '../../store/useOjasStore';
import { useSensorStore } from '../../store/useSensorStore';
import { supabase } from '../../services/supabase';
import { calculateDailyDosha } from '../../services/doshaEngine';
import { calculateDailyAgni } from '../../services/agniEngine';
import { calculateDailyOjas } from '../../services/ojasEngine';
import AyurExplanationSheet from '../../components/AyurExplanationSheet';
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type TwinTab = 'balance' | 'doshas' | 'indices';

export default function DigitalTwinScreen() {
  const { user } = useAuthStore();
  const { vata, pitta, kapha, agni, ojas, lastUpdated, loading, fetchTwinState, subscribeToTwinUpdates } = useDigitalTwinStore();
  const currentDosha = useDoshaStore(state => state.currentDosha);
  const doshaHistory = useDoshaStore(state => state.history);
  const todayAgni = useAgniStore(state => state.todayAgni);
  const agniHistory = useAgniStore(state => state.history);
  const todayOjas = useOjasStore(state => state.todayOjas);
  const ojasHistory = useOjasStore(state => state.history);
  const liveData = useSensorStore(state => state.liveData);
  const [activeTab, setActiveTab] = useState<TwinTab>('balance');
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

  const ojasAnalysis = useMemo(() => {
    const stressVal = currentDosha?.explanationSummary?.factors?.find(f => f.name === 'Stress')?.value || 'MEDIUM';

    if (!todayOjas) {
      return {
        score: ojas || 78,
        state: 'Moderate Ojas' as const,
        vitality: 75,
        recovery: 70,
        mentalWellness: 72,
        consistency: 78,
        reason: 'Calculating vitality shield metrics... Sync your wearable device to calibrate.',
        insight: 'Restorative sleep and consistent hydration are key drivers of tissue immunity.',
        recommendation: 'Prioritize winding down by 9:30 PM for restorative sleep.'
      };
    }

    const {
      ojas_score: scoreVal,
      ojas_state: state,
      s_sleep,
      s_recovery,
      s_rhr,
      s_activity,
      s_nutrition,
      s_hydration
    } = todayOjas;

    const vitality = Math.round((s_nutrition + s_hydration) / 2);
    const recovery = Math.round((s_recovery + s_rhr) / 2);
    
    const stressScore = stressVal === 'LOW' ? 95 : stressVal === 'MEDIUM' ? 70 : 40;
    const mentalWellness = Math.round(s_sleep * 0.6 + stressScore * 0.4);
    
    const consistency = Math.round(s_activity);

    let reason = 'Your Ojas vitality shield is highly consolidated, providing powerful physiological protection and immunity.';
    let insight = 'High HRV recovery patterns and stable sleep rhythms indicate active cellular repair.';
    let recommendation = 'Conserve your immune energy shield with mindful meditations and daily oil massages.';

    if (scoreVal < 60) {
      reason = 'Your Ojas vitality shield is depleted, rendering your tissues vulnerable to fatigue and immune stressors.';
      insight = 'This depletion is driven by fragmented sleep durations and physiological stress signals.';
      recommendation = 'Initiate absolute rest. Cancel high-exertion workouts and wind down by 9:30 PM with warm spiced milk.';
    } else if (scoreVal < 75) {
      reason = 'Your Ojas shield is in a moderate state, with steady vital reserves.';
      insight = 'A slight fluctuation in step consistency or hydration is slowing down optimal tissue replenishment.';
      recommendation = 'Maintain stable daily timing structures and include sweet nourishing foods (ghee, dates, almonds) in your diet.';
    }

    return {
      score: scoreVal,
      state,
      vitality,
      recovery,
      mentalWellness,
      consistency,
      reason,
      insight,
      recommendation
    };
  }, [todayOjas, ojas, currentDosha]);

  const agniAnalysis = useMemo(() => {
    if (!todayAgni) {
      return {
        score: agni || 75,
        state: 'Moderate' as const,
        reason: 'Calculating metabolic core indices... Sync your wearable device to calibrate.',
        weakest: { name: 'Vitals', score: 70, desc: 'Resting pulse and stable skin temperature.' },
        strongest: { name: 'Sleep', score: 80, desc: 'Restorative circadian sleep indices.' },
        recommendation: 'Maintain consistent meal hours to support high metabolic efficiency.',
        expectedImprovement: 'Improve your sleep score to stabilize energy reserves.',
        timeline: [
          { time: 'Morning', event: 'Ushapan Hydration Logged', impact: 'Pacifies dryness' },
          { time: '13:00 PM', event: 'Solar Lunch Logged', impact: 'Strong digestive Agni peak' }
        ]
      };
    }

    const {
      agni_score: scoreVal,
      agni_state: state,
      s_timing,
      s_diet,
      s_vitals,
      s_hydration,
      s_activity,
      s_sleep
    } = todayAgni;

    const factorsList = [
      { name: 'Circadian Timing', score: s_timing, desc: 'Aligning meals with circadian and solar peaks.', rec: 'Space meals exactly 4 hours apart and consume your largest meal at solar noon (12:00 PM - 1:30 PM).' },
      { name: 'Diet Quality', score: s_diet, desc: 'Consuming warm, fresh, and spice-rich foods.', rec: 'Incorporate warming digestion-stimulating spices like cumin, ginger, and black pepper, and avoid sweet/heavy desserts right after meals.' },
      { name: 'Metabolic Vitals', score: s_vitals, desc: 'Resting pulse and stable skin temperature.', rec: 'Maintain a steady routine to normalize pulse rates; avoid stimulants late in the afternoon.' },
      { name: 'Fluid Hydration', score: s_hydration, desc: 'Maintaining ideal fluid volume without flooding.', rec: 'Drink 2L of warm water throughout the day. Avoid drinking ice water during or immediately after meals as it extinguishes Agni.' },
      { name: 'Vyayama Activity', score: s_activity, desc: 'Consistent physical steps and circulation.', rec: 'Execute a 10-minute brisk walk after lunch to stimulate blood flow and clear metabolic sluggishness.' },
      { name: 'Sleep Quality', score: s_sleep, desc: 'Restorative circadian sleep indices.', rec: 'Complete a winding-down routine by 9:30 PM and practice alternate nostril breathing to calm Vata wind before bed.' }
    ];

    const sorted = [...factorsList].sort((a, b) => a.score - b.score);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];

    let reason = 'Your metabolic Agni is burning steady and clear today, indicating efficient cellular conversion.';
    if (scoreVal < 60) {
      reason = `Your Agni fire is running weak today. This is primarily caused by low scores in ${weakest.name.toLowerCase()} (${weakest.score}%) which is dampening your metabolic strength.`;
    } else if (scoreVal < 75) {
      reason = `Your Agni fire is in a moderate state. Correcting minor deviations in ${weakest.name.toLowerCase()} will help you reach full digestive strength.`;
    }

    const expectedImprovement = `Correcting your ${weakest.name.toLowerCase()} issues tomorrow will raise your overall Agni score by +${Math.round((100 - weakest.score) * 0.15)}% and improve core energy.`;

    const timeline = [];
    if (s_hydration > 60) {
      timeline.push({ time: 'Morning', event: 'Ushapan Hydration Cleansing', impact: 'Kindles digestive spark' });
    }
    if (s_timing > 60) {
      timeline.push({ time: '13:00 PM', event: 'Solar peak lunch alignment', impact: 'Strongest Agni burning' });
    } else {
      timeline.push({ time: '14:30 PM', event: 'Late lunch ingestion', impact: 'Dampens digestive Agni' });
    }
    if (s_activity > 60) {
      timeline.push({ time: 'Afternoon', event: 'Active step circulation', impact: 'Ignites metabolic fire' });
    }

    return {
      score: scoreVal,
      state,
      reason,
      weakest,
      strongest,
      recommendation: weakest.rec,
      expectedImprovement,
      timeline
    };
  }, [todayAgni, agni]);

  // Animation values
  const agniPulse = useRef(new Animated.Value(1)).current;
  const ojasBreathe = useRef(new Animated.Value(1)).current;
  
  // Dynamic coordinates animation (to smoothly morph the SVG polygon vertices)
  const vataY = useRef(new Animated.Value(150 - (30 + (vata / 100) * 100))).current;
  const pittaX = useRef(new Animated.Value(150 + (30 + (pitta / 100) * 100) * Math.cos(Math.PI / 6))).current;
  const pittaY = useRef(new Animated.Value(150 + (30 + (pitta / 100) * 100) * Math.sin(Math.PI / 6))).current;
  const kaphaX = useRef(new Animated.Value(150 + (30 + (kapha / 100) * 100) * Math.cos(5 * Math.PI / 6))).current;
  const kaphaY = useRef(new Animated.Value(150 + (30 + (kapha / 100) * 100) * Math.sin(5 * Math.PI / 6))).current;

  // Sync state
  useEffect(() => {
    if (user?.id) {
      fetchTwinState(user.id);
      useDoshaStore.getState().fetchCurrentState(user.id);
      useDoshaStore.getState().fetchHistory(user.id, 7);
      useAgniStore.getState().fetchTodayAgni(user.id);
      useAgniStore.getState().fetchHistory(user.id);
      const unsubscribe = subscribeToTwinUpdates(user.id);
      return () => unsubscribe();
    }
  }, [user?.id]);

  // Handle continuous pulsing loops
  useEffect(() => {
    // Agni pulse - speed depends on Agni score (higher Agni = faster pulse)
    const agniDuration = Math.max(500, 2000 - (agni / 100) * 1500);
    const agniAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(agniPulse, {
          toValue: 1.3,
          duration: agniDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false // cannot use native driver for scale/opacities inside SVG nested tags
        }),
        Animated.timing(agniPulse, {
          toValue: 0.9,
          duration: agniDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        })
      ])
    );
    agniAnim.start();

    // Ojas halo breathe (slow and calming)
    const ojasAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ojasBreathe, {
          toValue: 1.05,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        }),
        Animated.timing(ojasBreathe, {
          toValue: 0.95,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false
        })
      ])
    );
    ojasAnim.start();

    return () => {
      agniAnim.stop();
      ojasAnim.stop();
    };
  }, [agni, ojas]);

  // Smoothly morph coordinates when dynamic values change
  useEffect(() => {
    // Vata (top vertex)
    const vY = 150 - (30 + (vata / 100) * 100);
    // Pitta (bottom-right vertex)
    const pX = 150 + (30 + (pitta / 100) * 100) * Math.cos(Math.PI / 6);
    const pY = 150 + (30 + (pitta / 100) * 100) * Math.sin(Math.PI / 6);
    // Kapha (bottom-left vertex)
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

  // Set up listeners for the animated points to build dynamic SVG attributes
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


  const getDominantDoshaText = () => {
    const max = Math.max(vata, pitta, kapha);
    if (max === vata) return 'Vata Dominant (Unstable Air & Ether)';
    if (max === pitta) return 'Pitta Dominant (Active Fire & Water)';
    return 'Kapha Dominant (Stable Earth & Water)';
  };

  const getDominantDoshaAdvice = () => {
    const max = Math.max(vata, pitta, kapha);
    if (max === vata) {
      return 'Variable telemetry and erratic heart rate logs highlight Vata air excitation. Ground your energy with warm spiced teas, soothing environment, and restorative sleep.';
    }
    if (max === pitta) {
      return 'Thermal temperature spikes and higher resting heart rates match a heated Pitta fire state. Focus on cooling coconut water, light meals, and avoiding intense midday stressors.';
    }
    return 'Bradycardic heart rates and sedentary logs reflect a heavy Kapha state. Incorporate physical steps, stimulating exercise, and drying hot spices (ginger, pepper) to restore vitality.';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        {/* Header Navigation */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-emerald-900/35">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-1 rounded-lg bg-emerald-900/20 border border-emerald-800/30 mr-4 active:bg-emerald-900/40"
            >
              <Ionicons name="chevron-back" size={20} color="#34d399" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-lg font-bold">Ayurvedic Digital Twin</Text>
              <Text className="text-emerald-400/50 text-[10px] uppercase font-bold tracking-wider">Bio-simulation & State</Text>
            </View>
          </View>
          <View className="flex-row items-center bg-emerald-950/70 border border-emerald-900/40 px-2.5 py-1 rounded-full">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            <Text className="text-emerald-400/80 text-[8px] font-mono font-bold uppercase">Live Updated: {lastUpdated}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          {/* Main Dynamic Avatar Container */}
          <View className="items-center justify-center py-6 mb-4 relative">
            <View className="w-72 h-72 rounded-full border border-emerald-800/25 bg-[#031510]/45 items-center justify-center shadow-xl shadow-emerald-950/20 relative overflow-hidden">
              {/* Outer Glowing Shield representing Ojas */}
              <Animated.View 
                style={{
                  width: 256,
                  height: 256,
                  borderRadius: 9999,
                  borderWidth: 2,
                  borderColor: 'rgba(167, 139, 250, 0.45)', // Violet
                  position: 'absolute',
                  transform: [{ scale: ojasBreathe }],
                  opacity: 0.3 + (ojas / 100) * 0.6,
                  shadowColor: '#a78bfa',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 10,
                }}
              />

              {/* Dynamic SVG Mandala */}
              <Svg width="260" height="260" viewBox="0 0 300 300">
                <Defs>
                  {/* Agni Core Fire Gradient */}
                  <RadialGradient id="agniFire" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <Stop offset="40%" stopColor="#fbbf24" stopOpacity="0.95" />
                    <Stop offset="80%" stopColor="#f97316" stopOpacity="0.4" />
                    <Stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                  </RadialGradient>
                  
                  {/* Mandala Fill Gradient */}
                  <RadialGradient id="mandalaShine" cx="50%" cy="50%" rx="50%" ry="50%">
                    <Stop offset="0%" stopColor="rgba(52, 211, 153, 0.08)" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="rgba(5, 31, 24, 0.5)" stopOpacity="0.1" />
                  </RadialGradient>
                </Defs>

                {/* Base reference lines */}
                <Line x1="150" y1="150" x2="150" y2="30" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="150" y1="150" x2="253.9" y2="210" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="150" y1="150" x2="46.1" y2="210" stroke="rgba(16, 185, 129, 0.1)" strokeWidth="1" strokeDasharray="4,4" />
                
                {/* Dynamic Morphing Polygon representing Doshas */}
                <Polygon
                  points={polyPoints}
                  fill="url(#mandalaShine)"
                  stroke="rgba(52, 211, 153, 0.75)"
                  strokeWidth="2.5"
                />

                {/* Inner polygon overlays to create a rich vector neon glow */}
                <Polygon
                  points={polyPoints}
                  fill="none"
                  stroke="rgba(52, 211, 153, 0.2)"
                  strokeWidth="8"
                />

                {/* Vertex Label Points */}
                {/* Vata (Air/Ether) Top Node */}
                <G>
                  <AnimatedCircle cx="150" cy={vataY} r="8" fill="#020b08" stroke="#38bdf8" strokeWidth={2.5} />
                  <AnimatedCircle cx="150" cy={vataY} r="18" fill="rgba(56, 189, 248, 0.08)" />
                </G>

                {/* Pitta (Fire/Water) Bottom-Right Node */}
                <G>
                  <AnimatedCircle cx={pittaX} cy={pittaY} r="8" fill="#020b08" stroke="#fb923c" strokeWidth={2.5} />
                  <AnimatedCircle cx={pittaX} cy={pittaY} r="18" fill="rgba(251, 146, 60, 0.08)" />
                </G>

                {/* Kapha (Earth/Water) Bottom-Left Node */}
                <G>
                  <AnimatedCircle cx={kaphaX} cy={kaphaY} r="8" fill="#020b08" stroke="#34d399" strokeWidth={2.5} />
                  <AnimatedCircle cx={kaphaX} cy={kaphaY} r="18" fill="rgba(52, 211, 153, 0.08)" />
                </G>

                {/* CENTRAL AGNI FLAME CORE */}
                <AnimatedG scale={agniPulse} origin="150, 150">
                  <Circle cx="150" cy="150" r={10 + (agni / 100) * 35} fill="url(#agniFire)" />
                </AnimatedG>
              </Svg>

              {/* Dynamic Labels absolute positioned */}
              <View className="absolute top-7 items-center">
                <Text className="text-sky-400 font-mono font-bold text-[9px] tracking-widest uppercase">Vata (Air)</Text>
                <Text className="text-white text-xs font-extrabold">{vata}%</Text>
              </View>

              <View className="absolute bottom-6 right-5 items-center">
                <Text className="text-orange-400 font-mono font-bold text-[9px] tracking-widest uppercase">Pitta (Fire)</Text>
                <Text className="text-white text-xs font-extrabold">{pitta}%</Text>
              </View>

              <View className="absolute bottom-6 left-5 items-center">
                <Text className="text-emerald-400 font-mono font-bold text-[9px] tracking-widest uppercase">Kapha (Earth)</Text>
                <Text className="text-white text-xs font-extrabold">{kapha}%</Text>
              </View>
            </View>
          </View>

          {/* Quick Selector Tabs */}
          <View className="flex-row bg-emerald-950/40 p-1 rounded-xl border border-emerald-900/25 mb-5">
            {(['balance', 'doshas', 'indices'] as TwinTab[]).map(tab => {
              const isSelected = activeTab === tab;
              let label = 'Overview';
              if (tab === 'doshas') label = 'Bio-Doshas';
              if (tab === 'indices') label = 'Agni & Ojas';

              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-lg items-center ${
                    isSelected ? 'bg-emerald-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isSelected ? 'text-emerald-950' : 'text-emerald-400/80'
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* TAB CONTENT 1: OVERVIEW BALANCE PANEL */}
          {activeTab === 'balance' && (
            <View className="space-y-4">
              <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">State Interpretation</Text>
                <Text className="text-white text-base font-extrabold mb-2">{getDominantDoshaText()}</Text>
                <Text className="text-emerald-100/70 text-xs leading-relaxed">
                  {getDominantDoshaAdvice()}
                </Text>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center">
                  <Ionicons name="flame-outline" size={20} color="#f59e0b" />
                  <Text className="text-emerald-400/50 text-[10px] font-bold uppercase mt-2">Metabolism</Text>
                  <Text className="text-white text-lg font-extrabold mt-1">{agni}/100</Text>
                  <Text className="text-[8px] text-emerald-300/60 font-mono mt-0.5">Agni score</Text>
                </View>

                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center">
                  <Ionicons name="shield-checkmark-outline" size={20} color="#a78bfa" />
                  <Text className="text-emerald-400/50 text-[10px] font-bold uppercase mt-2">Immunity</Text>
                  <Text className="text-white text-lg font-extrabold mt-1">{ojas}/100</Text>
                  <Text className="text-[8px] text-emerald-300/60 font-mono mt-0.5">Ojas vitality</Text>
                </View>
              </View>

              <View className="bg-sky-950/20 border border-sky-900/30 p-4 rounded-2xl">
                <Text className="text-sky-300 text-xs font-bold mb-1.5 flex-row items-center">
                  🧬 Real-time Update Strategy
                </Text>
                <Text className="text-sky-200/60 text-[11px] leading-relaxed">
                  The Ayurvedic Digital Twin is a reactive simulation. Whenever wearable heart rate/temperature syncs, or hydration logs are updated, the background calculations recompute Vata, Pitta, Kapha, Agni, and Ojas. The twin morphs its coordinates instantly using database triggers.
                </Text>
              </View>
            </View>
          )}

          {/* TAB CONTENT 2: DYNAMIC DOSHA INTELLIGENCE SCREEN */}
          {activeTab === 'doshas' && (
            <View className="space-y-5">
              
              {/* IMMERSIVE DOSHA WHEEL */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl items-center">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Concentric Dosha Wheel</Text>
                <DoshaWheel vata={vata} pitta={pitta} kapha={kapha} />
              </View>

              {/* CURRENT BALANCE & NARRATIVE EXPLANATION */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Constitutional Balance</Text>
                <Text className="text-white text-xl font-serif font-bold leading-snug mb-3">
                  {getDominantDoshaText()}
                </Text>
                <Text className="text-slate-300 text-xs leading-relaxed mb-4">
                  {currentDosha?.explanationSummary?.reasoning || getDominantDoshaAdvice()}
                </Text>

                {/* Recent Changes Narrative */}
                <View className="border-t border-[#1f372f] pt-4 mt-2">
                  <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1.5">Recent Changes</Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {(() => {
                      const yesterdayRecord = doshaHistory && doshaHistory.length > 0 ? doshaHistory[0] : null;
                      if (!yesterdayRecord) return 'Homeostasis established. Sync telemetry daily to map dynamic element trends.';
                      const vataDiff = Math.round(vata - yesterdayRecord.vata_percentage);
                      const pittaDiff = Math.round(pitta - yesterdayRecord.pitta_percentage);
                      const kaphaDiff = Math.round(kapha - yesterdayRecord.kapha_percentage);

                      const changes = [];
                      if (vataDiff !== 0) changes.push(`Vata wind ${vataDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(vataDiff)}%`);
                      if (pittaDiff !== 0) changes.push(`Pitta heat ${pittaDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(pittaDiff)}%`);
                      if (kaphaDiff !== 0) changes.push(`Kapha earth ${kaphaDiff > 0 ? 'increased' : 'decreased'} by ${Math.abs(kaphaDiff)}%`);

                      if (changes.length === 0) return 'Homeostatic stability. Elements remain fully aligned with yesterday\'s baselines.';
                      return `Compared to yesterday: ${changes.join(', ')}.`;
                    })()}
                  </Text>
                </View>
              </View>

              {/* DYNAMIC FORECAST PREDICTIONS */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-3">Constitutional Projections</Text>
                
                <View className="space-y-4">
                  {/* Scenario A: Followed */}
                  <View className="bg-emerald-950/20 border border-emerald-900/35 p-4.5 rounded-2xl">
                    <Text className="text-emerald-400 text-xs font-bold font-serif mb-1.5">If Daily Plan is Followed</Text>
                    <Text className="text-slate-300 text-xs leading-relaxed">
                      Sustaining recommendations grounds active element peaks (Vata/Pitta) and shifts your constitution closer to balanced base proportions, raising Ojas immunity score tomorrow to {Math.round(ojas + 4)}%.
                    </Text>
                  </View>

                  {/* Scenario B: Ignored */}
                  <View className="bg-rose-950/20 border border-rose-900/35 p-4.5 rounded-2xl">
                    <Text className="text-rose-400 text-xs font-bold font-serif mb-1.5">If Recommendations are Ignored</Text>
                    <Text className="text-slate-300 text-xs leading-relaxed">
                      Neglecting routine adjustments leads to Pitta fire accumulation and Vata wind scatter. Resting heart rate is projected to climb, lowering digestive Agni scores to {Math.round(agni - 5)}%.
                    </Text>
                  </View>
                </View>
              </View>

              {/* RECOMMENDATIONS (Aggravating & Pacifying lists) */}
              {((currentDosha?.explanationSummary?.aggravating?.length || 0) + (currentDosha?.explanationSummary?.pacifying?.length || 0) > 0) && (
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                  <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-4">Constitutional Recommendations</Text>
                  
                  {currentDosha?.explanationSummary?.aggravating && currentDosha.explanationSummary.aggravating.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-orange-400 text-xs font-bold mb-2">⚠️ Factors Aggravating Your System Today</Text>
                      <View className="space-y-2">
                        {currentDosha.explanationSummary.aggravating.map((agg, idx) => (
                          <View key={idx} className="flex-row items-start pl-1">
                            <Text className="text-orange-400/80 mr-2 mt-0.5">•</Text>
                            <Text className="text-slate-300 text-xs leading-relaxed flex-1">{agg}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {currentDosha?.explanationSummary?.pacifying && currentDosha.explanationSummary.pacifying.length > 0 && (
                    <View>
                      <Text className="text-emerald-400 text-xs font-bold mb-2">✅ Cooling & Pacifying Guidelines</Text>
                      <View className="space-y-2">
                        {currentDosha.explanationSummary.pacifying.map((pac, idx) => (
                          <View key={idx} className="flex-row items-start pl-1">
                            <Text className="text-emerald-400/80 mr-2 mt-0.5">•</Text>
                            <Text className="text-slate-300 text-xs leading-relaxed flex-1">{pac}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* HISTORICAL TRENDS TIMELINE */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-4">Historical Elements Trend</Text>
                
                <View className="space-y-3">
                  {doshaHistory.length === 0 ? (
                    <Text className="text-emerald-400/50 text-xs italic pl-1">No historical dosha records logged.</Text>
                  ) : (
                    doshaHistory.slice(0, 4).map((record, index) => (
                      <View key={index} className="flex-row justify-between items-center bg-[#172722]/40 border border-[#1f372f] p-4 rounded-2xl">
                        <View>
                          <Text className="text-white text-xs font-bold font-serif">{new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                          <Text className="text-emerald-400 text-[9px] mt-1 font-mono uppercase tracking-wider">
                            {record.vata_percentage > 38 ? 'Vata High' : record.pitta_percentage > 38 ? 'Pitta High' : record.kapha_percentage > 38 ? 'Kapha High' : 'Aligned'}
                          </Text>
                        </View>
                        <Text className="text-slate-300 text-xs font-bold font-mono">
                          V:{Math.round(record.vata_percentage)}% | P:{Math.round(record.pitta_percentage)}% | K:{Math.round(record.kapha_percentage)}%
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )}

          {/* TAB CONTENT 3: METABOLISM & VITALITY */}
          {activeTab === 'indices' && (
            <View className="space-y-6">
              
              {/* ========================================================================= */}
              {/* AGNI METABOLIC FIRE PREMIUM WELLNESS CARD */}
              {/* ========================================================================= */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl relative overflow-hidden">
                <View className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                
                {/* Header Row */}
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center flex-1 mr-4">
                    <PulsingMetricRing score={agniAnalysis.score} color="#fbbf24" iconName="flame" />
                    <View className="ml-4 flex-1">
                      <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono">Metabolism State</Text>
                      <Text className="text-white text-lg font-serif font-bold mt-0.5">{agniAnalysis.state}</Text>
                    </View>
                  </View>
                </View>

                {/* Current Status Description */}
                <Text className="text-white text-sm font-serif font-medium leading-snug mb-3">
                  Current Status
                </Text>
                <Text className="text-slate-300 text-xs leading-relaxed mb-4">
                  {agniAnalysis.reason}
                </Text>

                {/* Trend Summary */}
                <View className="bg-[#172722]/50 border border-[#1f372f] p-4 rounded-2xl mb-4">
                  <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Metabolic Trend</Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {(() => {
                      if (agniHistory.length === 0) return 'Baseline metabolism calibrated. Sync daily telemetry to record trends.';
                      const avg = Math.round(agniHistory.reduce((acc, r) => acc + r.agni_score, 0) / agniHistory.length);
                      const diff = Math.round(agniAnalysis.score - avg);
                      if (diff > 0) return `Metabolism is elevated by ${diff}% above your baseline average (${avg}%).`;
                      if (diff < 0) return `Metabolism is running ${Math.abs(diff)}% slower than your baseline average (${avg}%).`;
                      return `Metabolic fire is stable, matching your historical average of ${avg}%.`;
                    })()}
                  </Text>
                </View>

                {/* Reason Details (Strongest vs Weakest) */}
                <View className="flex-row space-x-3 mb-4">
                  {/* Strongest */}
                  <View className="flex-1 bg-emerald-950/20 border border-emerald-900/30 p-3.5 rounded-2xl">
                    <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">Peaking Factor</Text>
                    <Text className="text-white text-xs font-bold mt-1.5">{agniAnalysis.strongest.name}</Text>
                    <Text className="text-emerald-300 font-mono text-[10px] mt-0.5">{agniAnalysis.strongest.score}% Efficiency</Text>
                  </View>
                  
                  {/* Weakest */}
                  <View className="flex-1 bg-red-950/15 border border-red-900/25 p-3.5 rounded-2xl">
                    <Text className="text-red-400 text-[9px] uppercase font-bold tracking-wider font-mono">Impaired Factor</Text>
                    <Text className="text-white text-xs font-bold mt-1.5">{agniAnalysis.weakest.name}</Text>
                    <Text className="text-red-300 font-mono text-[10px] mt-0.5">{agniAnalysis.weakest.score}% Efficiency</Text>
                  </View>
                </View>

                {/* Expected Improvement */}
                <View className="bg-amber-950/20 border border-amber-900/25 p-4 rounded-2xl mb-4">
                  <Text className="text-amber-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Expected Improvement</Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {agniAnalysis.expectedImprovement}
                  </Text>
                </View>

                {/* Recommendations */}
                <View className="bg-[#172722]/40 border border-[#1f372f] p-4.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider font-mono">Metabolic Directives</Text>
                    <TouchableOpacity
                      onPress={() => handleOpenExplanation(agniAnalysis.recommendation)}
                      className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg active:bg-emerald-500/20"
                    >
                      <Text className="text-emerald-400 font-bold text-[8px] tracking-wider">WHY?</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-300 text-xs leading-relaxed">{agniAnalysis.recommendation}</Text>
                </View>

              </View>

              {/* Daily Metabolic Timeline */}
              {agniAnalysis.timeline.length > 0 && (
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                  <Text className="text-white text-sm font-serif font-bold mb-4 flex-row items-center">
                    <Ionicons name="git-commit-outline" size={16} color="#10b981" /> Daily Metabolic Timeline
                  </Text>

                  <View className="space-y-4 pl-1 relative">
                    <View className="absolute left-[9px] top-1.5 bottom-1.5 w-[1px] bg-[#1f372f]" />
                    {agniAnalysis.timeline.map((item, idx) => (
                      <View key={idx} className="flex-row items-start">
                        <View className="w-[10px] h-[10px] rounded-full bg-amber-400 border-2 border-emerald-950 z-10 mr-3 mt-1.5" />
                        <View className="flex-1 bg-[#172722]/20 border border-[#1f372f]/40 p-3 rounded-2xl">
                          <View className="flex-row justify-between">
                            <Text className="text-white text-xs font-bold">{item.event}</Text>
                            <Text className="text-emerald-400 text-[9px] font-mono mt-0.5">{item.time}</Text>
                          </View>
                          <Text className="text-slate-300 text-[10px] mt-1 leading-relaxed">{item.impact}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}


              {/* ========================================================================= */}
              {/* OJAS VITALITY SHIELD PREMIUM WELLNESS CARD */}
              {/* ========================================================================= */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl relative overflow-hidden">
                <View className="absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
                
                {/* Header Row */}
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center flex-1 mr-4">
                    <PulsingMetricRing score={ojasAnalysis.score} color="#c084fc" iconName="shield-checkmark" />
                    <View className="ml-4 flex-1">
                      <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono">Immunity Shield</Text>
                      <Text className="text-white text-lg font-serif font-bold mt-0.5">{ojasAnalysis.state?.replace(' Ojas', '')}</Text>
                    </View>
                  </View>
                </View>

                {/* Current Status Description */}
                <Text className="text-white text-sm font-serif font-medium leading-snug mb-3">
                  Current Status
                </Text>
                <Text className="text-slate-300 text-xs leading-relaxed mb-4">
                  {ojasAnalysis.reason}
                </Text>

                {/* Trend Summary */}
                <View className="bg-[#172722]/50 border border-[#1f372f] p-4 rounded-2xl mb-4">
                  <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Immune Trend</Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {(() => {
                      if (ojasHistory.length === 0) return 'Vitality tracking initialized. Sync daily biosensors to map immune reserves.';
                      const avg = Math.round(ojasHistory.reduce((acc, r) => acc + r.ojas_score, 0) / ojasHistory.length);
                      const diff = Math.round(ojasAnalysis.score - avg);
                      if (diff > 0) return `Cellular shield resilience is ${diff}% higher than your baseline average (${avg}%).`;
                      if (diff < 0) return `Cellular shield resilience is ${Math.abs(diff)}% lower than your baseline average (${avg}%).`;
                      return `Immune shield remains stable, matching your historical average of ${avg}%.`;
                    })()}
                  </Text>
                </View>

                {/* Explainability Metrics Grid */}
                <View className="flex-row flex-wrap gap-2.5 mb-4">
                  {/* Vitality Card */}
                  <View className="flex-[1_0_45%] bg-[#172722]/45 border border-[#1f372f] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">Tissue Reserve</Text>
                      <Ionicons name="leaf-outline" size={12} color="#34d399" />
                    </View>
                    <Text className="text-white text-base font-bold font-mono">{ojasAnalysis.vitality}%</Text>
                    <Text className="text-slate-300 text-[8px] mt-0.5">Physical tissue reserve</Text>
                  </View>

                  {/* Recovery Card */}
                  <View className="flex-[1_0_45%] bg-[#172722]/45 border border-[#1f372f] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">HRV Recovery</Text>
                      <Ionicons name="pulse" size={12} color="#c084fc" />
                    </View>
                    <Text className="text-white text-base font-bold font-mono">{ojasAnalysis.recovery}%</Text>
                    <Text className="text-slate-300 text-[8px] mt-0.5">Autonomic wellness trend</Text>
                  </View>

                  {/* Mental Wellness */}
                  <View className="flex-[1_0_45%] bg-[#172722]/45 border border-[#1f372f] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">Stress Index</Text>
                      <Ionicons name="sunny-outline" size={12} color="#fbbf24" />
                    </View>
                    <Text className="text-white text-base font-bold font-mono">{ojasAnalysis.mentalWellness}%</Text>
                    <Text className="text-slate-300 text-[8px] mt-0.5">Circadian sleep & stress</Text>
                  </View>

                  {/* Consistency */}
                  <View className="flex-[1_0_45%] bg-[#172722]/45 border border-[#1f372f] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">Consistency</Text>
                      <Ionicons name="bar-chart-outline" size={12} color="#10b981" />
                    </View>
                    <Text className="text-white text-base font-bold font-mono">{ojasAnalysis.consistency}%</Text>
                    <Text className="text-slate-300 text-[8px] mt-0.5">Routine logging consistency</Text>
                  </View>
                </View>

                {/* Expected Improvement */}
                <View className="bg-violet-950/20 border border-violet-900/25 p-4 rounded-2xl mb-4">
                  <Text className="text-violet-400 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Expected Improvement</Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">{ojasAnalysis.insight}</Text>
                </View>

                {/* Recommendations */}
                <View className="bg-[#172722]/40 border border-[#1f372f] p-4.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider font-mono">Resilience Directives</Text>
                    <TouchableOpacity
                      onPress={() => handleOpenExplanation(ojasAnalysis.recommendation)}
                      className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-lg active:bg-emerald-500/20"
                    >
                      <Text className="text-emerald-400 font-bold text-[8px] tracking-wider">WHY?</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-300 text-xs leading-relaxed">{ojasAnalysis.recommendation}</Text>
                </View>

              </View>

              {/* Weekly Ojas Trend */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-white text-sm font-serif font-bold mb-4 flex-row items-center">
                  <Ionicons name="bar-chart-outline" size={16} color="#10b981" /> Weekly Ojas History
                </Text>

                <View className="space-y-3">
                  {ojasHistory.length === 0 ? (
                    <Text className="text-emerald-400/50 text-xs italic pl-1">No historical ojas records logged.</Text>
                  ) : (
                    ojasHistory.slice(0, 4).map((record, index) => (
                      <View key={index} className="flex-row justify-between items-center bg-[#172722]/40 border border-[#1f372f] p-4 rounded-2xl">
                        <View>
                          <Text className="text-white text-xs font-bold font-serif">{new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                          <Text className="text-emerald-400 text-[9px] mt-1 font-mono uppercase tracking-wider">{record.ojas_state}</Text>
                        </View>
                        <Text className="text-violet-300 text-xs font-bold font-mono">{record.ojas_score}%</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

            </View>
          )}



        </ScrollView>

        <AyurExplanationSheet
          visible={explanationVisible}
          onClose={() => setExplanationVisible(false)}
          context={explanationContext}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}


const DoshaWheel = React.memo(function DoshaWheel({ vata, pitta, kapha }: { vata: number, pitta: number, kapha: number }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 30000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const spinReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  const rVata = 42;
  const rPitta = 58;
  const rKapha = 74;

  const cVata = 2 * Math.PI * rVata;
  const cPitta = 2 * Math.PI * rPitta;
  const cKapha = 2 * Math.PI * rKapha;

  const oVata = cVata * (1 - vata / 100);
  const oPitta = cPitta * (1 - pitta / 100);
  const oKapha = cKapha * (1 - kapha / 100);

  const maxDosha = Math.max(vata, pitta, kapha);
  const dominantName = maxDosha === vata ? 'Vata' : maxDosha === pitta ? 'Pitta' : 'Kapha';
  const dominantColor = maxDosha === vata ? '#38bdf8' : maxDosha === pitta ? '#f97316' : '#14b8a6';

  return (
    <View className="items-center justify-center py-4">
      <View className="w-52 h-52 items-center justify-center relative">
        <View className="absolute items-center z-10">
          <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono">Dominant</Text>
          <Text style={{ color: dominantColor }} className="text-2xl font-serif font-black">{dominantName}</Text>
          <Text className="text-white text-xs font-bold font-mono mt-0.5">{Math.round(maxDosha)}%</Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute' }}>
          <Svg width="180" height="180" viewBox="0 0 180 180">
            <Circle cx="90" cy="90" r={rKapha} fill="none" stroke="#132a24" strokeWidth="5.5" />
            <Circle
              cx="90"
              cy="90"
              r={rKapha}
              fill="none"
              stroke="#14b8a6"
              strokeWidth="5.5"
              strokeDasharray={cKapha}
              strokeDashoffset={oKapha}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={{ transform: [{ rotate: spinReverse }], position: 'absolute' }}>
          <Svg width="180" height="180" viewBox="0 0 180 180">
            <Circle cx="90" cy="90" r={rPitta} fill="none" stroke="#2e1b12" strokeWidth="5.5" />
            <Circle
              cx="90"
              cy="90"
              r={rPitta}
              fill="none"
              stroke="#f97316"
              strokeWidth="5.5"
              strokeDasharray={cPitta}
              strokeDashoffset={oPitta}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
          </Svg>
        </Animated.View>

        <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute' }}>
          <Svg width="180" height="180" viewBox="0 0 180 180">
            <Circle cx="90" cy="90" r={rVata} fill="none" stroke="#0f2635" strokeWidth="5.5" />
            <Circle
              cx="90"
              cy="90"
              r={rVata}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="5.5"
              strokeDasharray={cVata}
              strokeDashoffset={oVata}
              strokeLinecap="round"
              transform="rotate(-90 90 90)"
            />
          </Svg>
        </Animated.View>
      </View>

      <View className="flex-row gap-5 mt-5">
        <View className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] mr-1.5" />
          <Text className="text-slate-300 text-[10px] font-bold font-mono">Vata {Math.round(vata)}%</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-[#f97316] mr-1.5" />
          <Text className="text-slate-300 text-[10px] font-bold font-mono">Pitta {Math.round(pitta)}%</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] mr-1.5" />
          <Text className="text-slate-300 text-[10px] font-bold font-mono">Kapha {Math.round(kapha)}%</Text>
        </View>
      </View>
    </View>
  );
});

const PulsingMetricRing = React.memo(function PulsingMetricRing({ score, color, iconName }: { score: number, color: string, iconName: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const radius = 28;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);

  return (
    <View className="items-center justify-center">
      <View className="w-16 h-16 items-center justify-center relative">
        <Animated.View style={{ transform: [{ scale: pulseAnim }], position: 'absolute' }}>
          <Svg width="68" height="68" viewBox="0 0 68 68">
            <Circle
              cx="34"
              cy="34"
              r={radius}
              fill="none"
              stroke="#0f2620"
              strokeWidth={strokeWidth}
            />
            <Circle
              cx="34"
              cy="34"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 34 34)"
            />
          </Svg>
        </Animated.View>
        <Ionicons name={iconName as any} size={18} color={color} />
      </View>
    </View>
  );
});


