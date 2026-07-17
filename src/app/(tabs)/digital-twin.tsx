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
import AyurConceptExplanationSheet from '../../components/AyurConceptExplanationSheet';
import { ConceptId } from '../../services/conceptExplanations';
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';
import { useExperienceStore } from '../../store/useExperienceStore';
import { ExperienceSwitch } from '../../components/ExperienceSwitch';
import { 
  getLocalizedDoshaState, 
  getLocalizedAgni, 
  getLocalizedOjas 
} from '../../services/translationEngine';

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
  const { mode, locale } = useExperienceStore();
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [explanationContext, setExplanationContext] = useState<ExplanationContext | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<ConceptId | null>(null);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        {/* Header Navigation */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#E4E1D8]">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-1 rounded-lg bg-[#F2EFE8] border border-[#E4E1D8] mr-4 active:bg-[#F2EFE8]/80"
            >
              <Ionicons name="chevron-back" size={20} color="#607C64" />
            </TouchableOpacity>
            <View>
              <Text className="text-[#2E3A2F] text-base font-serif font-black">Ayurvedic Digital Twin</Text>
              <Text className="text-[#607C64]/70 text-[9px] uppercase font-bold tracking-wider font-mono">Bio-simulation & State</Text>
            </View>
          </View>
          <View className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1 rounded-full">
            <View className="w-1.5 h-1.5 rounded-full bg-[#607C64] mr-1.5" />
            <Text className="text-[#607C64] text-[8px] font-mono font-bold uppercase">Live Updated: {lastUpdated}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          <ExperienceSwitch />
          {/* Main Dynamic Avatar Container */}
          <View className="items-center justify-center py-6 mb-4 relative">
            <View className="w-72 h-72 rounded-full border border-[#E4E1D8] bg-white items-center justify-center shadow-md shadow-[#E4E1D8]/45 relative overflow-hidden">
              {/* Outer Glowing Shield representing Ojas */}
              <Animated.View 
                style={{
                  width: 256,
                  height: 256,
                  borderRadius: 9999,
                  borderWidth: 2,
                  borderColor: 'rgba(125, 156, 131, 0.45)', // Sage Green
                  position: 'absolute',
                  transform: [{ scale: ojasBreathe }],
                  opacity: 0.3 + (ojas / 100) * 0.6,
                  shadowColor: '#7d9c83',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
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
                    <Stop offset="0%" stopColor="rgba(96, 124, 100, 0.08)" stopOpacity="0.8" />
                    <Stop offset="100%" stopColor="rgba(248, 246, 240, 0.5)" stopOpacity="0.1" />
                  </RadialGradient>
                </Defs>

                {/* Base reference lines */}
                <Line x1="150" y1="150" x2="150" y2="30" stroke="rgba(96, 124, 100, 0.12)" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="150" y1="150" x2="253.9" y2="210" stroke="rgba(96, 124, 100, 0.12)" strokeWidth="1" strokeDasharray="4,4" />
                <Line x1="150" y1="150" x2="46.1" y2="210" stroke="rgba(96, 124, 100, 0.12)" strokeWidth="1" strokeDasharray="4,4" />
                
                {/* Dynamic Morphing Polygon representing Doshas */}
                <Polygon
                  points={polyPoints}
                  fill="url(#mandalaShine)"
                  stroke="rgba(96, 124, 100, 0.75)"
                  strokeWidth="2.5"
                />

                {/* Inner polygon overlays to create a rich vector glow */}
                <Polygon
                  points={polyPoints}
                  fill="none"
                  stroke="rgba(96, 124, 100, 0.15)"
                  strokeWidth="8"
                />

                {/* Vertex Label Points */}
                {/* Vata (Air/Ether) Top Node */}
                <G>
                  <AnimatedCircle cx="150" cy={vataY} r="8" fill="#F8F6F0" stroke="#38bdf8" strokeWidth={2.5} />
                  <AnimatedCircle cx="150" cy={vataY} r="18" fill="rgba(56, 189, 248, 0.08)" />
                </G>

                {/* Pitta (Fire/Water) Bottom-Right Node */}
                <G>
                  <AnimatedCircle cx={pittaX} cy={pittaY} r="8" fill="#F8F6F0" stroke="#fb923c" strokeWidth={2.5} />
                  <AnimatedCircle cx={pittaX} cy={pittaY} r="18" fill="rgba(251, 146, 60, 0.08)" />
                </G>

                {/* Kapha (Earth/Water) Bottom-Left Node */}
                <G>
                  <AnimatedCircle cx={kaphaX} cy={kaphaY} r="8" fill="#F8F6F0" stroke="#7D9C83" strokeWidth={2.5} />
                  <AnimatedCircle cx={kaphaX} cy={kaphaY} r="18" fill="rgba(125, 156, 131, 0.08)" />
                </G>

                {/* CENTRAL AGNI FLAME CORE */}
                <AnimatedG scale={agniPulse} origin="150, 150">
                  <Circle cx="150" cy="150" r={10 + (agni / 100) * 35} fill="url(#agniFire)" />
                </AnimatedG>
              </Svg>

              {/* Dynamic Labels absolute positioned */}
              <View className="absolute top-7 items-center">
                <Text className="text-sky-500 font-mono font-bold text-[9px] tracking-widest uppercase">Vata (Air)</Text>
                <Text className="text-[#2E3A2F] text-xs font-extrabold">
                  {mode === 'wellness' 
                    ? (vata > 35 
                        ? (locale === 'sa' ? 'Prabala Vāta' : 'Active Wind') 
                        : (locale === 'sa' ? 'Sama Vāta' : 'Flowing')) 
                    : `${vata}%`}
                </Text>
              </View>

              {/* Pitta */}
              <View className="absolute bottom-6 right-5 items-center">
                <Text className="text-orange-500 font-mono font-bold text-[9px] tracking-widest uppercase">Pitta (Fire)</Text>
                <Text className="text-[#2E3A2F] text-xs font-extrabold">
                  {mode === 'wellness' 
                    ? (pitta > 35 
                        ? (locale === 'sa' ? 'Prabala Pitta' : 'Warm Heat') 
                        : (locale === 'sa' ? 'Sama Pitta' : 'Temperate')) 
                    : `${pitta}%`}
                </Text>
              </View>

              {/* Kapha */}
              <View className="absolute bottom-6 left-5 items-center">
                <Text className="text-[#7D9C83] font-mono font-bold text-[9px] tracking-widest uppercase">Kapha (Earth)</Text>
                <Text className="text-[#2E3A2F] text-xs font-extrabold">
                  {mode === 'wellness' 
                    ? (kapha > 35 
                        ? (locale === 'sa' ? 'Prabala Kapha' : 'Heavy Earth') 
                        : (locale === 'sa' ? 'Sama Kapha' : 'Grounded')) 
                    : `${kapha}%`}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Selector Tabs */}
          <View className="flex-row bg-[#F2EFE8] p-1 rounded-xl border border-[#E4E1D8] mb-5">
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
                    isSelected ? 'bg-[#7D9C83]' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-[10px] font-bold ${
                      isSelected ? 'text-white' : 'text-[#607C64]/60'
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
              <View className="bg-white border border-[#E4E1D8] p-5 rounded-2xl shadow-sm">
                <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-1">State Interpretation</Text>
                <Text className="text-[#2E3A2F] text-base font-extrabold mb-2 font-serif">
                  {mode === 'wellness' 
                    ? (locale === 'sa' ? 'Sama-Sthiti' : 'Grounded & Steady') 
                    : getDominantDoshaText()}
                </Text>
                <Text className="text-slate-600 text-xs leading-relaxed font-serif">
                  {mode === 'wellness' 
                    ? getLocalizedDoshaState(vata, pitta, kapha, locale).whatIsHappening 
                    : getDominantDoshaAdvice()}
                </Text>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1 bg-white border border-[#E4E1D8] p-4 rounded-2xl items-center shadow-sm">
                  <Ionicons name="flame-outline" size={20} color="#C07A65" />
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Metabolism</Text>
                  <Text className="text-[#2E3A2F] text-xs font-extrabold mt-1 text-center">
                    {mode === 'wellness' 
                      ? getLocalizedAgni(agni, locale).label 
                      : `${agni}/100`}
                  </Text>
                  <Text className="text-[8px] text-slate-500 font-mono mt-0.5">Agni status</Text>
                </View>

                <View className="flex-1 bg-white border border-[#E4E1D8] p-4 rounded-2xl items-center shadow-sm">
                  <Ionicons name="shield-checkmark-outline" size={20} color="#7D9C83" />
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Immunity</Text>
                  <Text className="text-[#2E3A2F] text-xs font-extrabold mt-1 text-center">
                    {mode === 'wellness' 
                      ? getLocalizedOjas(ojas, locale).label 
                      : `${ojas}/100`}
                  </Text>
                  <Text className="text-[8px] text-slate-500 font-mono mt-0.5">Ojas status</Text>
                </View>
              </View>

              {mode === 'evidence' && (
                <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-2xl">
                  <Text className="text-[#607C64] text-xs font-bold mb-1.5 flex-row items-center font-serif">
                    🧬 Real-time Update Strategy
                  </Text>
                  <Text className="text-slate-600 text-[11px] leading-relaxed">
                    The Ayurvedic Digital Twin is a reactive simulation. Whenever wearable heart rate/temperature syncs, or hydration logs are updated, the background calculations recompute Vata, Pitta, Kapha, Agni, and Ojas. The twin morphs its coordinates instantly using database triggers.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* TAB CONTENT 2: DYNAMIC DOSHA INTELLIGENCE SCREEN */}
          {activeTab === 'doshas' && (
            <View className="space-y-5">
              
              {/* IMMERSIVE DOSHA WHEEL OR QUALITATIVE LIST */}
              {mode === 'evidence' ? (
                <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl items-center shadow-sm">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-2">Concentric Dosha Wheel</Text>
                  <DoshaWheel vata={vata} pitta={pitta} kapha={kapha} />
                </View>
              ) : (
                <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl shadow-sm">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-3.5">Active Elements Status</Text>
                  
                  <View className="space-y-3">
                    {/* Vata Card */}
                    <View className="bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4.5 rounded-2xl font-serif">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sky-500 text-xs font-bold font-serif">Vata (Air & Ether)</Text>
                        <TouchableOpacity 
                          onPress={() => setSelectedConcept('vata')}
                          className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-0.5 rounded-full active:bg-[#F2EFE8]/70"
                        >
                          <Text className="text-sky-500 text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                        </TouchableOpacity>
                      </View>
                      <Text className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                        {vata > 35 
                          ? 'Variable & sensitive: Needs grounding warmth, regular sleep, and slow abdominal breathing.' 
                          : 'Flowing & creative: Balanced movement and calm nervous channels.'}
                      </Text>
                    </View>

                    {/* Pitta Card */}
                    <View className="bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4.5 rounded-2xl font-serif">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-orange-500 text-xs font-bold font-serif">Pitta (Fire & Water)</Text>
                        <TouchableOpacity 
                          onPress={() => setSelectedConcept('pitta')}
                          className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-0.5 rounded-full active:bg-[#F2EFE8]/70"
                        >
                          <Text className="text-orange-500 text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                        </TouchableOpacity>
                      </View>
                      <Text className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                        {pitta > 35 
                          ? 'Intense & warm: Focus on cooling foods, coconut water, and a short walk in the shade.' 
                          : 'Temperate & focused: Steady metabolic drive and sharp intellect.'}
                      </Text>
                    </View>

                    {/* Kapha Card */}
                    <View className="bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4.5 rounded-2xl font-serif">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-[#7D9C83] text-xs font-bold font-serif">Kapha (Earth & Water)</Text>
                        <TouchableOpacity 
                          onPress={() => setSelectedConcept('kapha')}
                          className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-0.5 rounded-full active:bg-[#F2EFE8]/70"
                        >
                          <Text className="text-[#7D9C83] text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                        </TouchableOpacity>
                      </View>
                      <Text className="text-slate-600 text-xs mt-1.5 leading-relaxed">
                        {kapha > 35 
                          ? 'Heavy & slow: Stimulate with cardiovascular activity, brisk walking, and ginger water.' 
                          : 'Grounded & stable: Solid immunity, calm demeanor, and structural strength.'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* CURRENT BALANCE & NARRATIVE EXPLANATION */}
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm">
                <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-2">Constitutional Balance</Text>
                <Text className="text-[#2E3A2F] text-xl font-serif font-bold leading-snug mb-3">
                  {mode === 'wellness' ? (() => {
                    const max = Math.max(vata, pitta, kapha);
                    if (max === vata) return locale === 'sa' ? 'Vāta Shāmana Mārgadarśana' : 'Grounding (Vata) Guidance';
                    if (max === pitta) return locale === 'sa' ? 'Pitta Shāmana Mārgadarśana' : 'Tempering (Pitta) Guidance';
                    return locale === 'sa' ? 'Kapha Shāmana Mārgadarśana' : 'Invigorating (Kapha) Guidance';
                  })() : getDominantDoshaText()}
                </Text>
                <Text className="text-slate-650 text-xs leading-relaxed mb-4 font-serif">
                  {mode === 'wellness' 
                    ? getLocalizedDoshaState(vata, pitta, kapha, locale).whatIsHappening + ' ' + getLocalizedDoshaState(vata, pitta, kapha, locale).whatTodo
                    : (currentDosha?.explanationSummary?.reasoning || getDominantDoshaAdvice())}
                </Text>

                {/* Recent Changes Narrative */}
                <View className="border-t border-[#E4E1D8]/60 pt-4 mt-2">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-1.5">Recent Changes</Text>
                  <Text className="text-slate-600 text-xs leading-relaxed">
                    {(() => {
                      const yesterdayRecord = doshaHistory && doshaHistory.length > 0 ? doshaHistory[0] : null;
                      if (!yesterdayRecord) return locale === 'sa' ? 'Sama-sthitiḥ prathitā. Pratidinaṁ sync kuru.' : 'Homeostasis established. Sync telemetry daily to map dynamic element trends.';
                      const vataDiff = Math.round(vata - yesterdayRecord.vata_percentage);
                      const pittaDiff = Math.round(pitta - yesterdayRecord.pitta_percentage);
                      const kaphaDiff = Math.round(kapha - yesterdayRecord.kapha_percentage);

                      if (mode === 'wellness') {
                        const changes = [];
                        if (vataDiff > 2) changes.push(locale === 'sa' ? "Vāta-cañcalatā mandam pravṛddhā." : "Your sensitivity to routines has increased slightly.");
                        else if (vataDiff < -2) changes.push(locale === 'sa' ? "Vāto praśāmya sthiratām prāptaḥ." : "Your Vata winds have settled, bringing calm grounding.");
                        if (pittaDiff > 2) changes.push(locale === 'sa' ? "Pitta-tejaḥ śarīre svalpam uṣṇībhavati." : "Your internal body warmth is slightly more active.");
                        else if (pittaDiff < -2) changes.push(locale === 'sa' ? "Pittam sama-sthitau śītalam bhavati." : "Your internal fire is calming to a comfortable level.");
                        if (kaphaDiff > 2) changes.push(locale === 'sa' ? "Kaphasya gurutvaṁ sthairyaṁ ca vardhitam." : "Your system is holding more grounding stability but might feel slightly heavier.");
                        else if (kaphaDiff < -2) changes.push(locale === 'sa' ? "Manda-kapha-śaithilyaṁ praṇaṣṭam." : "Slower lethargy is clearing out, bringing lighter energy.");

                        if (changes.length === 0) return locale === 'sa' ? 'Sama-sthitiḥ. Doṣāḥ pūrva-vat sthirāḥ santi.' : 'Your element balances remain steady and aligned with yesterday.';
                        return changes.join(' ');
                      }

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
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono mb-3">Constitutional Projections</Text>
                
                <View className="space-y-4">
                  {/* Scenario A: Followed */}
                  <View className="bg-emerald-500/5 border border-emerald-500/10 p-4.5 rounded-2xl">
                    <Text className="text-emerald-700 text-xs font-bold font-serif mb-1.5">If Daily Plan is Followed</Text>
                    <Text className="text-slate-600 text-xs leading-relaxed">
                      {mode === 'wellness' 
                        ? (locale === 'sa' 
                            ? 'Niyama-pālanena sarve doṣāḥ praśāmyanti, ojo-balaṁ vardhate.' 
                            : getLocalizedDoshaState(vata, pitta, kapha, locale).whatNextDay)
                        : `Sustaining recommendations grounds active element peaks (Vata/Pitta) and shifts your constitution closer to balanced base proportions, raising Ojas immunity score tomorrow to ${Math.round(ojas + 4)}%.`}
                    </Text>
                  </View>

                  {/* Scenario B: Ignored */}
                  <View className="bg-rose-500/5 border border-rose-500/10 p-4.5 rounded-2xl">
                    <Text className="text-rose-700 text-xs font-bold font-serif mb-1.5">If Recommendations are Ignored</Text>
                    <Text className="text-slate-600 text-xs leading-relaxed">
                      {mode === 'wellness' 
                        ? (locale === 'sa' 
                            ? 'Niyama-upekṣayā pitta-prakopo vāta-cañcalatā ca vardhate, śvaḥ pācana-kriyā mandībhavati.' 
                            : 'Neglecting routine adjustments leads to Pitta fire accumulation and Vata wind scatter. Resting heart rate is projected to climb, weakening your core digestive fire tomorrow.')
                        : `Neglecting routine adjustments leads to Pitta fire accumulation and Vata wind scatter. Resting heart rate is projected to climb, lowering digestive Agni scores to ${Math.round(agni - 5)}%.`}
                    </Text>
                  </View>
                </View>
              </View>

              {/* RECOMMENDATIONS (Aggravating & Pacifying lists) */}
              {((currentDosha?.explanationSummary?.aggravating?.length || 0) + (currentDosha?.explanationSummary?.pacifying?.length || 0) > 0) && (
                <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                  <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono mb-4">Constitutional Recommendations</Text>
                  
                  {currentDosha?.explanationSummary?.aggravating && currentDosha.explanationSummary.aggravating.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-orange-500 text-xs font-bold mb-2">⚠️ Factors Aggravating Your System Today</Text>
                      <View className="space-y-2">
                        {currentDosha.explanationSummary.aggravating.map((agg, idx) => (
                          <View key={idx} className="flex-row items-start pl-1">
                            <Text className="text-orange-400/80 mr-2 mt-0.5">•</Text>
                            <Text className="text-slate-600 text-xs leading-relaxed flex-1">{agg}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {currentDosha?.explanationSummary?.pacifying && currentDosha.explanationSummary.pacifying.length > 0 && (
                    <View>
                      <Text className="text-[#607C64] text-xs font-bold mb-2">✅ Cooling & Pacifying Guidelines</Text>
                      <View className="space-y-2">
                        {currentDosha.explanationSummary.pacifying.map((pac, idx) => (
                          <View key={idx} className="flex-row items-start pl-1">
                            <Text className="text-[#607C64]/80 mr-2 mt-0.5">•</Text>
                            <Text className="text-slate-650 text-xs leading-relaxed flex-1">{pac}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* HISTORICAL TRENDS TIMELINE */}
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono mb-4">Historical Elements Trend</Text>
                
                <View className="space-y-3">
                  {doshaHistory.length === 0 ? (
                    <Text className="text-slate-500 text-xs italic pl-1">No historical dosha records logged.</Text>
                  ) : (
                    doshaHistory.slice(0, 4).map((record, index) => (
                      <View key={index} className="flex-row justify-between items-center bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4 rounded-2xl">
                        <View>
                          <Text className="text-[#2E3A2F] text-xs font-bold font-serif">{new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                          <Text className="text-[#607C64] text-[9px] mt-1 font-mono uppercase tracking-wider">
                            {record.vata_percentage > 38 ? 'Vata High' : record.pitta_percentage > 38 ? 'Pitta High' : record.kapha_percentage > 38 ? 'Kapha High' : 'Aligned'}
                          </Text>
                        </View>
                        {mode === 'evidence' && (
                          <Text className="text-[#2E3A2F] text-xs font-bold font-mono">
                            V:{Math.round(record.vata_percentage)}% | P:{Math.round(record.pitta_percentage)}% | K:{Math.round(record.kapha_percentage)}%
                          </Text>
                        )}
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
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl relative overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
                <View className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                
                {/* Header Row */}
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center flex-1 mr-4">
                    <PulsingMetricRing score={agniAnalysis.score} color="#C07A65" iconName="flame" />
                    <View className="ml-4 flex-1">
                      <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">Metabolism State</Text>
                      <Text className="text-[#2E3A2F] text-base font-serif font-bold mt-0.5">
                        {mode === 'wellness' 
                          ? getLocalizedAgni(agniAnalysis.score, locale).label 
                          : agniAnalysis.state}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedConcept('agni')}
                    className="bg-[#F2EFE8] border border-[#E4E1D8] px-3 py-1.5 rounded-xl active:bg-[#F2EFE8]/75"
                  >
                    <Text className="text-[#607C64] text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                  </TouchableOpacity>
                </View>

                {/* Current Status Description */}
                <Text className="text-[#2E3A2F] text-sm font-serif font-black mb-3">
                  Current Status
                </Text>
                <Text className="text-slate-650 text-xs leading-relaxed mb-4">
                  {mode === 'wellness' 
                    ? getLocalizedAgni(agniAnalysis.score, locale).desc 
                    : agniAnalysis.reason}
                </Text>

                {/* Trend Summary */}
                <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-2xl mb-4">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Metabolic Trend</Text>
                  <Text className="text-slate-600 text-xs leading-relaxed">
                    {(() => {
                      if (agniHistory.length === 0) return locale === 'sa' ? 'Calibrating. Pratidinaṁ sync kuru.' : 'Baseline metabolism calibrated. Sync daily telemetry to record trends.';
                      const avg = Math.round(agniHistory.reduce((acc, r) => acc + r.agni_score, 0) / agniHistory.length);
                      const diff = Math.round(agniAnalysis.score - avg);
                      if (mode === 'wellness') {
                        if (diff > 5) return locale === 'sa' ? 'Tava pācana-kriyā uṣṇā sakriyā ca asti.' : 'Your metabolism is currently running slightly more active and warmer than your baseline average.';
                        if (diff < -5) return locale === 'sa' ? 'Tava pācana-kriyā mandā mandāgniḥ ca asti.' : 'Your metabolism is running slightly slower than your baseline average today.';
                        return locale === 'sa' ? 'Tava pācana-kriyā samāgniḥ sama-sthitau asti.' : 'Your metabolic fire is stable and balanced, matching your baseline average.';
                      }
                      if (diff > 0) return `Metabolism is elevated by ${diff}% above your baseline average (${avg}%).`;
                      if (diff < 0) return `Metabolism is running ${Math.abs(diff)}% slower than your baseline average (${avg}%).`;
                      return `Metabolic fire is stable, matching your historical average of ${avg}%.`;
                    })()}
                  </Text>
                </View>

                {/* Reason Details (Strongest vs Weakest) */}
                <View className="flex-row space-x-3 mb-4">
                  {/* Strongest */}
                  <View className="flex-1 bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-2xl">
                    <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">Peaking Factor</Text>
                    <Text className="text-[#2E3A2F] text-xs font-bold mt-1.5">{agniAnalysis.strongest.name}</Text>
                    <Text className="text-emerald-600 font-mono text-[10px] mt-0.5">
                      {mode === 'wellness' 
                        ? (locale === 'sa' ? 'Samyak Aligned' : 'Optimal Alignment') 
                        : `${agniAnalysis.strongest.score}% Efficiency`}
                    </Text>
                  </View>
                  
                  {/* Weakest */}
                  <View className="flex-1 bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-2xl">
                    <Text className="text-rose-700 text-[9px] uppercase font-bold tracking-wider font-mono">Impaired Factor</Text>
                    <Text className="text-[#2E3A2F] text-xs font-bold mt-1.5">{agniAnalysis.weakest.name}</Text>
                    <Text className="text-rose-600 font-mono text-[10px] mt-0.5">
                      {mode === 'wellness' 
                        ? (locale === 'sa' ? 'Dhyāna-āvaśyakam' : 'Needs Attention') 
                        : `${agniAnalysis.weakest.score}% Efficiency`}
                    </Text>
                  </View>
                </View>

                {/* Expected Improvement */}
                <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-2xl mb-4">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Expected Improvement</Text>
                  <Text className="text-slate-600 text-xs leading-relaxed">
                    {mode === 'wellness' 
                      ? (locale === 'sa' 
                          ? 'Svastha-bhojanena ojo-balaṁ vardhiṣyate.' 
                          : 'Correcting your focus issues tomorrow will stabilize digestion and elevate core energy levels.') 
                      : agniAnalysis.expectedImprovement}
                  </Text>
                </View>

                {/* Recommendations */}
                <View className="bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-wider font-mono">Metabolic Directives</Text>
                    <TouchableOpacity
                      onPress={() => handleOpenExplanation(agniAnalysis.recommendation)}
                      className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1 rounded-lg active:bg-[#F2EFE8]/80"
                    >
                      <Text className="text-[#607C64] font-bold text-[8px] tracking-wider">WHY?</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-650 text-xs leading-relaxed">{agniAnalysis.recommendation}</Text>
                </View>

              </View>

              {/* Daily Metabolic Timeline */}
              {agniAnalysis.timeline.length > 0 && (
                <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                  <Text className="text-[#2E3A2F] text-sm font-serif font-black mb-4 flex-row items-center">
                    <Ionicons name="git-commit-outline" size={16} color="#607C64" /> Daily Metabolic Timeline
                  </Text>

                  <View className="space-y-4 pl-1 relative">
                    <View className="absolute left-[9px] top-1.5 bottom-1.5 w-[1px] bg-[#E4E1D8]" />
                    {agniAnalysis.timeline.map((item, idx) => (
                      <View key={idx} className="flex-row items-start">
                        <View className="w-[10px] h-[10px] rounded-full bg-amber-400 border-2 border-white z-10 mr-3 mt-1.5" />
                        <View className="flex-1 bg-[#F5F2EA]/40 border border-[#E4E1D8] p-3 rounded-2xl">
                          <View className="flex-row justify-between">
                            <Text className="text-[#2E3A2F] text-xs font-bold">{item.event}</Text>
                            <Text className="text-[#607C64] text-[9px] font-mono mt-0.5">{item.time}</Text>
                          </View>
                          <Text className="text-slate-500 text-[10px] mt-1 leading-relaxed">{item.impact}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}


              {/* ========================================================================= */}
              {/* OJAS VITALITY SHIELD PREMIUM WELLNESS CARD */}
              {/* ========================================================================= */}
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl relative overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
                <View className="absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl pointer-events-none" />
                
                {/* Header Row */}
                <View className="flex-row justify-between items-center mb-6">
                  <View className="flex-row items-center flex-1 mr-4">
                    <PulsingMetricRing score={ojasAnalysis.score} color="#7D9C83" iconName="shield-checkmark" />
                    <View className="ml-4 flex-1">
                      <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">Immunity Shield</Text>
                      <Text className="text-[#2E3A2F] text-base font-serif font-bold mt-0.5">
                        {mode === 'wellness' 
                          ? getLocalizedOjas(ojasAnalysis.score, locale).label 
                          : ojasAnalysis.state?.replace(' Ojas', '')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setSelectedConcept('ojas')}
                    className="bg-[#F2EFE8] border border-[#E4E1D8] px-3 py-1.5 rounded-xl active:bg-[#F2EFE8]/75"
                  >
                    <Text className="text-[#607C64] text-[8px] font-bold uppercase font-mono">Learn Why</Text>
                  </TouchableOpacity>
                </View>

                {/* Current Status Description */}
                <Text className="text-[#2E3A2F] text-sm font-serif font-black mb-3">
                  Current Status
                </Text>
                <Text className="text-slate-650 text-xs leading-relaxed mb-4">
                  {mode === 'wellness' 
                    ? getLocalizedOjas(ojasAnalysis.score, locale).desc 
                    : ojasAnalysis.reason}
                </Text>

                {/* Trend Summary */}
                <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-2xl mb-4">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Immune Trend</Text>
                  <Text className="text-slate-600 text-xs leading-relaxed">
                    {(() => {
                      if (ojasHistory.length === 0) return locale === 'sa' ? 'Ojo-māpanaṁ. Daily sync kuru.' : 'Vitality tracking initialized. Sync daily biosensors to map immune reserves.';
                      const avg = Math.round(ojasHistory.reduce((acc, r) => acc + r.ojas_score, 0) / ojasHistory.length);
                      const diff = Math.round(ojasAnalysis.score - avg);
                      if (mode === 'wellness') {
                        if (diff > 5) return locale === 'sa' ? 'Tava ojo-balaṁ sudṛḍhaṁ pūrva-vat prabalam asti.' : 'Your cellular shield and physical vitality are stronger than your baseline average today.';
                        if (diff < -5) return locale === 'sa' ? 'Tava ojo-kṣayaḥ viśrāmasya āvaśyakatā pradarśayati.' : 'Your cellular shield is slightly depleted, suggesting a greater need for physical rest today.';
                        return locale === 'sa' ? 'Tava ojo-balaṁ sthiraṁ sama-sthitau asti.' : 'Your immune vitality is stable and steady, matching your baseline average.';
                      }
                      if (diff > 0) return `Cellular shield resilience is ${diff}% higher than your baseline average (${avg}%).`;
                      if (diff < 0) return `Cellular shield resilience is ${Math.abs(diff)}% lower than your baseline average (${avg}%).`;
                      return `Immune shield remains stable, matching your historical average of ${avg}%.`;
                    })()}
                  </Text>
                </View>

                {/* Explainability Metrics Grid */}
                <View className="flex-row flex-wrap gap-2.5 mb-4">
                  {/* Vitality Card */}
                  <View className="flex-[1_0_45%] bg-[#F5F2EA]/45 border border-[#E4E1D8] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">Tissue Reserve</Text>
                      <Ionicons name="leaf-outline" size={12} color="#7D9C83" />
                    </View>
                    <Text className="text-[#2E3A2F] text-base font-bold font-mono">
                      {mode === 'wellness' 
                        ? (ojasAnalysis.vitality >= 80 ? (locale === 'sa' ? 'Pratibhā' : 'Excellent') : ojasAnalysis.vitality >= 60 ? (locale === 'sa' ? 'Sthira' : 'Steady') : (locale === 'sa' ? 'Manda' : 'Recharging')) 
                        : `${ojasAnalysis.vitality}%`}
                    </Text>
                    <Text className="text-slate-500 text-[8px] mt-0.5">Physical tissue reserve</Text>
                  </View>

                  {/* Recovery Card */}
                  <View className="flex-[1_0_45%] bg-[#F5F2EA]/45 border border-[#E4E1D8] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">HRV Recovery</Text>
                      <Ionicons name="pulse" size={12} color="#5C788A" />
                    </View>
                    <Text className="text-[#2E3A2F] text-base font-bold font-mono">
                      {mode === 'wellness' 
                        ? (ojasAnalysis.recovery >= 80 ? (locale === 'sa' ? 'Pratibhā' : 'Excellent') : ojasAnalysis.recovery >= 60 ? (locale === 'sa' ? 'Sthira' : 'Steady') : (locale === 'sa' ? 'Manda' : 'Recharging')) 
                        : `${ojasAnalysis.recovery}%`}
                    </Text>
                    <Text className="text-slate-500 text-[8px] mt-0.5">Autonomic wellness trend</Text>
                  </View>

                  {/* Mental Wellness */}
                  <View className="flex-[1_0_45%] bg-[#F5F2EA]/45 border border-[#E4E1D8] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">Stress Index</Text>
                      <Ionicons name="sunny-outline" size={12} color="#C07A65" />
                    </View>
                    <Text className="text-[#2E3A2F] text-base font-bold font-mono">
                      {mode === 'wellness' 
                        ? (ojasAnalysis.mentalWellness >= 80 ? (locale === 'sa' ? 'Pratibhā' : 'Excellent') : ojasAnalysis.mentalWellness >= 60 ? (locale === 'sa' ? 'Sthira' : 'Steady') : (locale === 'sa' ? 'Manda' : 'Recharging')) 
                        : `${ojasAnalysis.mentalWellness}%`}
                    </Text>
                    <Text className="text-slate-500 text-[8px] mt-0.5">Circadian sleep & stress</Text>
                  </View>

                  {/* Consistency */}
                  <View className="flex-[1_0_45%] bg-[#F5F2EA]/45 border border-[#E4E1D8] p-3.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono">Consistency</Text>
                      <Ionicons name="bar-chart-outline" size={12} color="#7D9C83" />
                    </View>
                    <Text className="text-[#2E3A2F] text-base font-bold font-mono">
                      {mode === 'wellness' 
                        ? (ojasAnalysis.consistency >= 80 ? (locale === 'sa' ? 'Pratibhā' : 'Excellent') : ojasAnalysis.consistency >= 60 ? (locale === 'sa' ? 'Sthira' : 'Steady') : (locale === 'sa' ? 'Manda' : 'Recharging')) 
                        : `${ojasAnalysis.consistency}%`}
                    </Text>
                    <Text className="text-slate-500 text-[8px] mt-0.5">Routine logging consistency</Text>
                  </View>
                </View>

                {/* Expected Improvement */}
                <View className="bg-violet-500/5 border border-violet-500/10 p-4 rounded-2xl mb-4">
                  <Text className="text-violet-700 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">Expected Improvement</Text>
                  <Text className="text-slate-600 text-xs leading-relaxed">{ojasAnalysis.insight}</Text>
                </View>

                {/* Recommendations */}
                <View className="bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-wider font-mono">Resilience Directives</Text>
                    <TouchableOpacity
                      onPress={() => handleOpenExplanation(ojasAnalysis.recommendation)}
                      className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1 rounded-lg active:bg-[#F2EFE8]/80"
                    >
                      <Text className="text-[#607C64] font-bold text-[8px] tracking-wider">WHY?</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-slate-650 text-xs leading-relaxed">{ojasAnalysis.recommendation}</Text>
                </View>

              </View>

              {/* Weekly Ojas Trend */}
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                <Text className="text-[#2E3A2F] text-sm font-serif font-black mb-4 flex-row items-center">
                  <Ionicons name="bar-chart-outline" size={16} color="#607C64" /> Weekly Ojas History
                </Text>

                <View className="space-y-3">
                  {ojasHistory.length === 0 ? (
                    <Text className="text-slate-500 text-xs italic pl-1">No historical ojas records logged.</Text>
                  ) : (
                    ojasHistory.slice(0, 4).map((record, index) => (
                      <View key={index} className="flex-row justify-between items-center bg-[#F5F2EA]/40 border border-[#E4E1D8] p-4 rounded-2xl">
                        <View>
                          <Text className="text-[#2E3A2F] text-xs font-bold font-serif">{new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
                          <Text className="text-[#607C64] text-[9px] mt-1 font-mono uppercase tracking-wider">{record.ojas_state}</Text>
                        </View>
                        <Text className="text-violet-700 text-xs font-bold font-mono">
                          {mode === 'wellness' 
                            ? (record.ojas_score >= 80 ? 'Excellent' : record.ojas_score >= 60 ? 'Steady' : 'Recharging') 
                            : `${record.ojas_score}%`}
                        </Text>
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

        <AyurConceptExplanationSheet
          visible={!!selectedConcept}
          onClose={() => setSelectedConcept(null)}
          conceptId={selectedConcept}
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
  const dominantColor = maxDosha === vata ? '#38bdf8' : maxDosha === pitta ? '#f97316' : '#7D9C83';

  return (
    <View className="items-center justify-center py-4">
      <View className="w-52 h-52 items-center justify-center relative">
        <View className="absolute items-center z-10">
          <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">Dominant</Text>
          <Text style={{ color: dominantColor }} className="text-2xl font-serif font-black">{dominantName}</Text>
          <Text className="text-[#2E3A2F] text-xs font-bold font-mono mt-0.5">{Math.round(maxDosha)}%</Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: spin }], position: 'absolute' }}>
          <Svg width="180" height="180" viewBox="0 0 180 180">
            <Circle cx="90" cy="90" r={rKapha} fill="none" stroke="#F2EFE8" strokeWidth="5.5" />
            <Circle
              cx="90"
              cy="90"
              r={rKapha}
              fill="none"
              stroke="#7D9C83"
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
            <Circle cx="90" cy="90" r={rPitta} fill="none" stroke="#F2EFE8" strokeWidth="5.5" />
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
            <Circle cx="90" cy="90" r={rVata} fill="none" stroke="#F2EFE8" strokeWidth="5.5" />
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
          <Text className="text-slate-650 text-[10px] font-bold font-mono">Vata {Math.round(vata)}%</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-[#f97316] mr-1.5" />
          <Text className="text-slate-650 text-[10px] font-bold font-mono">Pitta {Math.round(pitta)}%</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-1.5 h-1.5 rounded-full bg-[#7D9C83] mr-1.5" />
          <Text className="text-slate-650 text-[10px] font-bold font-mono">Kapha {Math.round(kapha)}%</Text>
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
              stroke="#E4E1D8"
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


