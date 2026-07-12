import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSensorStore } from '../../store/useSensorStore';
import { Motion } from '../../components/Motion';

// Contextual helpers for activity icons and colors
const getActivityIcon = (act?: string): any => {
  switch (act?.toLowerCase()) {
    case 'walking': return 'walk';
    case 'running': return 'fitness';
    case 'yoga': return 'body';
    case 'sedentary': return 'bed';
    default: return 'sparkles';
  }
};

const getActivityColor = (act?: string): string => {
  switch (act?.toLowerCase()) {
    case 'walking': return '#10b981'; // emerald-500
    case 'running': return '#ef4444'; // red-500
    case 'yoga': return '#a78bfa'; // purple-400
    case 'sedentary': return '#6b7280'; // gray-500
    default: return '#fbbf24'; // amber-400
  }
};

export default function LiveMonitorScreen() {
  const { liveData, status } = useSensorStore();
  const isConnected = status === 'connected';
  const [pulseHistory, setPulseHistory] = useState<number[]>([]);

  // Maintain last 16 pulse readings for a clean sparkline graph
  useEffect(() => {
    if (liveData?.heartRate) {
      setPulseHistory((prev) => [...prev.slice(-15), liveData.heartRate]);
    }
  }, [liveData?.heartRate]);

  // Determine heart rate state based on Ayurvedic parameters
  const getHeartRateStatus = (bpm: number) => {
    if (bpm < 60) return { label: 'Vata Dominant (Slow/Prana)', color: 'text-sky-400' };
    if (bpm > 85) return { label: 'Pitta Peak (Fiery/Tejas)', color: 'text-amber-500' };
    return { label: 'Sama (Balanced/Ojas)', color: 'text-emerald-400' };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#091310' }} edges={['top']}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#1f372f]">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-1.5 rounded-lg bg-[#172722] border border-[#1f372f] mr-4 active:bg-emerald-900/20"
            >
              <Ionicons name="chevron-back" size={20} color="#34d399" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-base font-serif font-black">Biometric Stream</Text>
              <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono">Realtime Wearable Telemetry</Text>
            </View>
          </View>
          
          <View className="flex-row items-center bg-[#172722] border border-[#1f372f] px-3 py-1 rounded-full">
            <View className={`w-1.5 h-1.5 rounded-full mr-2 ${isConnected ? 'bg-emerald-400 shadow shadow-emerald-400' : 'bg-rose-500'}`} />
            <Text className="text-white text-[8px] font-bold uppercase font-mono tracking-widest">
              {isConnected ? 'Linked' : 'Offline'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-6 py-5" showsVerticalScrollIndicator={false}>
          
          {!isConnected ? (
            <Motion.Card index={0} className="flex-1 justify-center items-center py-20 bg-[#111d19]/45 border border-dashed border-[#1f372f] rounded-3xl">
              <Ionicons name="pulse" size={48} color="#047857" className="mb-4" />
              <Text className="text-emerald-400 text-base font-serif font-black">Awaiting Hardware Sync</Text>
              <Text className="text-slate-300 text-xs mt-2 text-center px-8 leading-relaxed">
                Connect your physical AquaAyur smartband or toggle Developer Simulator mode inside the Settings hub to start streaming biometrics.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/device')}
                className="mt-6 bg-emerald-500 rounded-2xl px-5 py-3 flex-row items-center shadow shadow-emerald-500/20 active:bg-emerald-600"
              >
                <Ionicons name="bluetooth" size={14} color="#022c22" style={{ marginRight: 6 }} />
                <Text className="text-emerald-950 font-black text-[10px] uppercase tracking-wider">Device Settings</Text>
              </TouchableOpacity>
            </Motion.Card>
          ) : (
            <View className="space-y-6">
              
              {/* Live Pulsometer visualizer */}
              <Motion.Card index={0} className="bg-[#111d19]/45 border border-[#1f372f] p-6.5 rounded-3xl items-center justify-center relative overflow-hidden">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mb-4">
                  Active Pulse Sensor
                </Text>

                {/* Animated Pulsing Ring */}
                <Motion.Pulse min={0.93} max={1.08} speed={1200} className="w-32 h-32 rounded-full bg-rose-500/10 border-2 border-rose-500/40 justify-center items-center mb-5 relative">
                  <View className="w-24 h-24 rounded-full bg-[#172722] border border-[#1f372f] justify-center items-center shadow-lg shadow-black/35">
                    <Ionicons name="heart" size={44} color="#ef4444" />
                  </View>
                </Motion.Pulse>

                <Text className="text-white text-5xl font-black font-mono tracking-tight">
                  {liveData?.heartRate || '--'}
                </Text>
                <Text className="text-rose-400 font-bold text-xs uppercase tracking-wider font-mono mt-1">bpm</Text>

                <View className="border-t border-[#1f372f]/45 pt-4 mt-5 w-full items-center">
                  <Text className="text-slate-350 text-[10px]">Ayurvedic State Classification</Text>
                  <Text className={`text-xs font-serif font-black mt-1 ${getHeartRateStatus(liveData?.heartRate || 72).color}`}>
                    {getHeartRateStatus(liveData?.heartRate || 72).label}
                  </Text>
                </View>
              </Motion.Card>

              {/* Sparkline visualization */}
              <Motion.Card index={1} className="bg-[#111d19]/45 border border-[#1f372f] p-5.5 rounded-3xl">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mb-4">
                  Pulse Sparkline History
                </Text>
                
                {pulseHistory.length === 0 ? (
                  <Text className="text-emerald-500/50 text-[11px] text-center py-6">
                    Establishing vitals frequency range...
                  </Text>
                ) : (
                  <View className="flex-row items-end justify-between h-20 px-2 mt-2">
                    {pulseHistory.map((val, idx) => {
                      // Normalize bar height relative to max/min rates
                      const heightPercent = Math.max(12, Math.min(100, ((val - 50) / 70) * 100));
                      return (
                        <View key={idx} className="items-center w-[5.5%]">
                          <View
                            style={{ height: `${heightPercent}%` }}
                            className="w-full bg-emerald-500 rounded-t-sm"
                          />
                          <Text className="text-emerald-400/40 text-[7px] mt-1 font-mono">
                            {val}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Motion.Card>

              {/* Sensor specifications cards */}
              <View className="grid grid-cols-2 gap-4 flex-row flex-wrap">
                
                {/* Temperature card */}
                <Motion.Card index={2} className="w-[47%] bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Ionicons name="thermometer" size={18} color="#38bdf8" />
                    <Text className="text-sky-400 text-[10px] font-bold font-mono uppercase tracking-wider">Skin Temp</Text>
                  </View>
                  <Text className="text-white text-2xl font-black font-mono">
                    {liveData ? `${liveData.temperature.toFixed(2)}` : '--'}
                  </Text>
                  <Text className="text-emerald-400/50 text-[9px] font-mono mt-1">Celsius (°C)</Text>
                </Motion.Card>

                {/* Steps Tracker Card */}
                <Motion.Card index={3} className="w-[47%] bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl">
                  <View className="flex-row justify-between items-center mb-2">
                    <Ionicons name="footsteps" size={18} color="#fbbf24" />
                    <Text className="text-yellow-400 text-[10px] font-bold font-mono uppercase tracking-wider">Steps</Text>
                  </View>
                  <Text className="text-white text-2xl font-black font-mono">
                    {liveData ? `${liveData.steps}` : '--'}
                  </Text>
                  <Text className="text-emerald-400/50 text-[9px] font-mono mt-1">Daily Steps</Text>
                </Motion.Card>

              </View>

              {/* Activity Status Card */}
              <Motion.Card index={4} className="bg-[#111d19]/45 border border-[#1f372f] p-5.5 rounded-3xl">
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-[#172722] border border-[#1f372f] justify-center items-center mr-3">
                      <Ionicons 
                        name={getActivityIcon(liveData?.activity)} 
                        size={16} 
                        color={getActivityColor(liveData?.activity)} 
                      />
                    </View>
                    <Text className="text-white font-serif font-black text-sm">Current Activity</Text>
                  </View>
                  <View className="px-3 py-1 rounded-full bg-[#172722]/80 border border-[#1f372f]/60">
                    <Text className="text-emerald-400 font-mono text-[9px] uppercase font-bold tracking-widest">
                      {liveData ? liveData.activity : 'Unknown'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-[#1f372f]/45">
                  <View>
                    <Text className="text-slate-350 text-[9px] font-mono uppercase tracking-wider">Est. Calories Burned</Text>
                    <Text className="text-white text-xl font-black font-mono mt-1">
                      {liveData ? `${Math.round(liveData.steps * 0.04)}` : '0'} <Text className="text-slate-400 text-xs font-normal">kcal</Text>
                    </Text>
                  </View>
                  <Ionicons name="flame" size={26} color="#f97316" />
                </View>
              </Motion.Card>

            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
