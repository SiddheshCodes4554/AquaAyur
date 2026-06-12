import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Easing, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Circle, Line, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { useAuthStore } from '../../store/useAuthStore';
import { useDigitalTwinStore } from '../../store/useDigitalTwinStore';
import { supabase } from '../../services/supabase';
import { calculateDailyDosha } from '../../services/doshaEngine';
import { calculateDailyAgni } from '../../services/agniEngine';
import { calculateDailyOjas } from '../../services/ojasEngine';

const AnimatedG = Animated.createAnimatedComponent(G);

type TwinTab = 'balance' | 'doshas' | 'indices';

export default function DigitalTwinScreen() {
  const { user } = useAuthStore();
  const { vata, pitta, kapha, agni, ojas, lastUpdated, loading, fetchTwinState, subscribeToTwinUpdates } = useDigitalTwinStore();
  const [activeTab, setActiveTab] = useState<TwinTab>('balance');
  const [simulating, setSimulating] = useState(false);

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

  // Simulator helper: inserts raw data & triggers recalculations
  const handleSimulateTelemetry = async () => {
    if (!user?.id) return;
    setSimulating(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isOverheating = Math.random() > 0.5;
      
      const simulatedHR = isOverheating ? 98 : 58; // High vs low heart rates
      const simulatedTemp = isOverheating ? 37.8 : 35.9; // Feverish vs cool body temps
      
      console.log(`[Simulator] Injecting HR: ${simulatedHR} bpm, Temp: ${simulatedTemp}°C`);

      // Write logs to Supabase
      const timestamp = new Date().toISOString();
      const [hrRes, tempRes] = await Promise.all([
        supabase.from('heart_rate_logs').insert({ user_id: user.id, timestamp, bpm: simulatedHR }),
        supabase.from('temperature_logs').insert({ user_id: user.id, timestamp, temperature_celsius: simulatedTemp })
      ]);

      if (hrRes.error) throw hrRes.error;
      if (tempRes.error) throw tempRes.error;

      // Force recalculation of daily dosha, agni, and ojas engines
      await Promise.all([
        calculateDailyDosha(user.id, todayStr),
        calculateDailyAgni(user.id, todayStr),
        calculateDailyOjas(user.id, todayStr)
      ]);

      // State is refreshed in background via the database realtime listeners, but we call fetch just in case
      await fetchTwinState(user.id);

      if (Platform.OS !== 'web') {
        Alert.alert(
          'Biometrics Synced',
          `Wearable data updated!\nHeart Rate: ${simulatedHR} bpm\nTemp: ${simulatedTemp}°C\nDigital Twin is morphing to represent the new state.`
        );
      }
    } catch (e: any) {
      console.error('[Simulator] Failed:', e);
      Alert.alert('Simulation Error', e.message || 'Failed to simulate wearable stream.');
    } finally {
      setSimulating(false);
    }
  };

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
                  <Circle cx="150" cy={(vataY as any)._value} r="8" fill="#020b08" stroke="#38bdf8" strokeWidth="2.5" />
                  <Circle cx="150" cy={(vataY as any)._value} r="18" fill="rgba(56, 189, 248, 0.08)" />
                </G>

                {/* Pitta (Fire/Water) Bottom-Right Node */}
                <G>
                  <Circle cx={(pittaX as any)._value} cy={(pittaY as any)._value} r="8" fill="#020b08" stroke="#fb923c" strokeWidth="2.5" />
                  <Circle cx={(pittaX as any)._value} cy={(pittaY as any)._value} r="18" fill="rgba(251, 146, 60, 0.08)" />
                </G>

                {/* Kapha (Earth/Water) Bottom-Left Node */}
                <G>
                  <Circle cx={(kaphaX as any)._value} cy={(kaphaY as any)._value} r="8" fill="#020b08" stroke="#34d399" strokeWidth="2.5" />
                  <Circle cx={(kaphaX as any)._value} cy={(kaphaY as any)._value} r="18" fill="rgba(52, 211, 153, 0.08)" />
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
          <View className="flex-row bg-emerald-950/40 p-1.5 rounded-2xl border border-emerald-900/25 mb-5">
            {(['balance', 'doshas', 'indices'] as TwinTab[]).map(tab => {
              const isSelected = activeTab === tab;
              let label = 'Overview';
              if (tab === 'doshas') label = 'Bio-Doshas';
              if (tab === 'indices') label = 'Agni & Ojas';

              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    isSelected ? 'bg-emerald-500' : 'bg-transparent'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
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

          {/* TAB CONTENT 2: DOSHA DETAIL BREAKDOWNS */}
          {activeTab === 'doshas' && (
            <View className="space-y-4">
              {/* Vata Card */}
              <View className="bg-[#051f18]/25 border border-sky-950/30 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-sky-400 font-bold text-sm">Vata (Air & Ether) • {vata}%</Text>
                  <Ionicons name="cloud-outline" size={16} color="#38bdf8" />
                </View>
                <View className="w-full h-1.5 bg-sky-950/50 rounded-full overflow-hidden mb-3">
                  <View style={{ width: `${vata}%` }} className="h-full bg-sky-400 rounded-full" />
                </View>
                <Text className="text-emerald-100/60 text-[11px] leading-relaxed">
                  Controls movement, nerve impulses, breathing, and circulation. Aggravated by cold weather, lack of sleep, high HRV irregularities, and inadequate hydration.
                </Text>
              </View>

              {/* Pitta Card */}
              <View className="bg-[#051f18]/25 border border-orange-950/30 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-orange-400 font-bold text-sm">Pitta (Fire & Water) • {pitta}%</Text>
                  <Ionicons name="flame-outline" size={16} color="#fb923c" />
                </View>
                <View className="w-full h-1.5 bg-orange-950/50 rounded-full overflow-hidden mb-3">
                  <View style={{ width: `${pitta}%` }} className="h-full bg-orange-400 rounded-full" />
                </View>
                <Text className="text-emerald-100/60 text-[11px] leading-relaxed">
                  Controls digestion, body temperature, intelligence, and metabolism. Excited by thermal body temperature rises, spicy/acidic foods, and cardiovascular overexertion.
                </Text>
              </View>

              {/* Kapha Card */}
              <View className="bg-[#051f18]/25 border border-emerald-950/30 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-2.5">
                  <Text className="text-emerald-400 font-bold text-sm">Kapha (Earth & Water) • {kapha}%</Text>
                  <Ionicons name="leaf-outline" size={16} color="#34d399" />
                </View>
                <View className="w-full h-1.5 bg-emerald-950/50 rounded-full overflow-hidden mb-3">
                  <View style={{ width: `${kapha}%` }} className="h-full bg-emerald-400 rounded-full" />
                </View>
                <Text className="text-emerald-100/60 text-[11px] leading-relaxed">
                  Controls physical structure, fluid balance, lubrication, and immunity. Aggravated by sedentary logs, sleeping in too long, and heavy sugary meals.
                </Text>
              </View>
            </View>
          )}

          {/* TAB CONTENT 3: METABOLISM & VITALITY */}
          {activeTab === 'indices' && (
            <View className="space-y-4">
              <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-white text-sm font-bold flex-row items-center">
                    <Ionicons name="flame" size={15} color="#fbbf24" /> Metabolic Core (Agni)
                  </Text>
                  <Text className="text-amber-400 font-mono font-semibold text-xs">{agni}/100</Text>
                </View>
                <Text className="text-emerald-100/60 text-[11px] leading-relaxed mb-3">
                  Your digestive fire (Agni) represents your capacity to digest foods, absorb nutrients, and transform experience. A steady Agni score above 70 reflects clean tissue metabolism and low toxin (Ama) buildup.
                </Text>
                <View className="h-[1px] bg-emerald-900/20 my-2" />
                <Text className="text-emerald-400/80 text-[10px] uppercase font-bold tracking-wider">Dynamic Recommendations:</Text>
                <Text className="text-emerald-100/70 text-[11px] mt-1">
                  • {agni < 50 ? 'Incorporate warm ginger tea and space meals exactly 4-5 hours apart.' : 'Maintain consistent meal hours to support high metabolic efficiency.'}
                </Text>
              </View>

              <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-white text-sm font-bold flex-row items-center">
                    <Ionicons name="shield-checkmark" size={15} color="#a78bfa" /> Vitality Shield (Ojas)
                  </Text>
                  <Text className="text-violet-400 font-mono font-semibold text-xs">{ojas}/100</Text>
                </View>
                <Text className="text-emerald-100/60 text-[11px] leading-relaxed mb-3">
                  Ojas is the essential sap of all bodily tissues, acting as your physical immunity, radiant glow, and spiritual resilience. Conserving Ojas protects you from viral stress, emotional fatigue, and metabolic degeneration.
                </Text>
                <View className="h-[1px] bg-emerald-900/20 my-2" />
                <Text className="text-emerald-400/80 text-[10px] uppercase font-bold tracking-wider">Dynamic Recommendations:</Text>
                <Text className="text-emerald-100/70 text-[11px] mt-1">
                  • {ojas < 50 ? 'Prioritize winding down by 9:30 PM for restorative sleep; reduce cardiovascular workouts.' : 'Conserve your immune energy shield with mindful meditations and daily oil rubs.'}
                </Text>
              </View>
            </View>
          )}

          {/* TELEMETRY SIMULATOR PANEL */}
          <View className="mt-8 bg-emerald-950/25 border border-dashed border-emerald-900/30 p-5 rounded-2xl">
            <View className="flex-row justify-between items-center mb-2.5">
              <View className="flex-1 pr-2">
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Biometric Stream Simulator</Text>
                <Text className="text-emerald-500/50 text-[10px] mt-0.5">Simulate live BLE smart ring sync events to morph the Twin.</Text>
              </View>
              <Ionicons name="hardware-chip-outline" size={18} color="#10b981" />
            </View>
            
            <TouchableOpacity
              onPress={handleSimulateTelemetry}
              disabled={simulating}
              className="bg-emerald-500 py-3 rounded-xl flex-row justify-center items-center active:bg-emerald-600 shadow-md shadow-emerald-500/10"
            >
              {simulating ? (
                <>
                  <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                  <Text className="text-emerald-950 font-bold text-xs">Simulating BLE Stream...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="radio-outline" size={14} color="#022c22" className="mr-1.5" />
                  <Text className="text-emerald-950 font-bold text-xs">Simulate Wearable Stream</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
