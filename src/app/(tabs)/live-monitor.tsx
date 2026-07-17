import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSensorStore } from '../../store/useSensorStore';
import { Motion } from '../../components/Motion';
import { useExperienceStore } from '../../store/useExperienceStore';
import { ExperienceSwitch } from '../../components/ExperienceSwitch';
import { 
  getLocalizedHeartRate, 
  getLocalizedTemperature, 
  getLocalizedMovement 
} from '../../services/translationEngine';

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
  const { mode, locale } = useExperienceStore();
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
    if (bpm < 60) return { label: 'Vata Dominant (Slow/Prana)', color: 'text-sky-500' };
    if (bpm > 85) return { label: 'Pitta Peak (Fiery/Tejas)', color: 'text-orange-500' };
    return { label: 'Sama (Balanced/Ojas)', color: 'text-[#607C64]' };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }} edges={['top']}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#E4E1D8]">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-1.5 rounded-lg bg-[#F2EFE8] border border-[#E4E1D8] mr-4 active:bg-[#E4E1D8]/50"
            >
              <Ionicons name="chevron-back" size={20} color="#607C64" />
            </TouchableOpacity>
            <View>
              <Text className="text-[#2E3A2F] text-base font-serif font-black">Biometric Stream</Text>
              <Text className="text-[#607C64]/70 text-[8px] uppercase font-bold tracking-widest font-mono">Realtime Wearable Telemetry</Text>
            </View>
          </View>
          
          <View className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-3 py-1 rounded-full">
            <View 
              className="w-1.5 h-1.5 rounded-full mr-2" 
              style={{
                backgroundColor: isConnected ? '#607C64' : '#ef4444',
              }}
            />
            <Text className="text-[#2E3A2F] text-[8px] font-bold uppercase font-mono tracking-widest">
              {isConnected ? 'Linked' : 'Offline'}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-6 py-5" showsVerticalScrollIndicator={false}>
          
          <ExperienceSwitch />
          {!isConnected ? (
            <Motion.Card index={0} className="flex-1 justify-center items-center py-20 bg-white border border-dashed border-[#E4E1D8] rounded-3xl">
              <Ionicons name="pulse" size={48} color="#607C64" className="mb-4" />
              <Text className="text-[#2E3A2F] text-base font-serif font-black">Awaiting Hardware Sync</Text>
              <Text className="text-slate-600 text-xs mt-2 text-center px-8 leading-relaxed">
                Connect your physical AquaAyur smartband inside the device settings page to start streaming biometrics.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/device')}
                className="mt-6 bg-[#7D9C83] rounded-2xl px-5 py-3 flex-row items-center shadow-sm active:bg-[#607C64]"
              >
                <Ionicons name="bluetooth" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text className="text-white font-black text-[10px] uppercase tracking-wider">Device Settings</Text>
              </TouchableOpacity>
            </Motion.Card>
          ) : (
            <View className="space-y-6">
              
              {/* Live Pulsometer visualizer */}
              <Motion.Card index={0} className="bg-white border border-[#E4E1D8] p-6.5 rounded-3xl items-center justify-center relative overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
                <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-4">
                  Active Pulse Sensor
                </Text>

                {/* Animated Pulsing Ring */}
                <Motion.Pulse min={0.93} max={1.08} speed={1200} className="w-32 h-32 rounded-full bg-rose-500/5 border-2 border-rose-500/20 justify-center items-center mb-5 relative">
                  <View className="w-24 h-24 rounded-full bg-[#F5F2EA] border border-[#E4E1D8] justify-center items-center shadow-sm shadow-[#E4E1D8]/30">
                    <Ionicons name="heart" size={44} color="#ef4444" />
                  </View>
                </Motion.Pulse>

                {mode === 'wellness' ? (
                  <Text className="text-[#2E3A2F] text-2xl font-serif font-bold text-center mt-2 px-4 leading-snug">
                    {liveData?.heartRate 
                      ? getLocalizedHeartRate(liveData.heartRate, locale)
                      : 'Establishing connection...'}
                  </Text>
                ) : (
                  <>
                    <Text className="text-[#2E3A2F] text-5xl font-black font-mono tracking-tight">
                      {liveData?.heartRate || '--'}
                    </Text>
                    <Text className="text-rose-500 font-bold text-xs uppercase tracking-wider font-mono mt-1">bpm</Text>
                  </>
                )}

                <View className="border-t border-[#E4E1D8]/65 pt-4 mt-5 w-full items-center">
                  <Text className="text-slate-500 text-[10px]">Ayurvedic State Classification</Text>
                  <Text className={`text-xs font-serif font-black mt-1 ${getHeartRateStatus(liveData?.heartRate || 72).color}`}>
                    {getHeartRateStatus(liveData?.heartRate || 72).label}
                  </Text>
                </View>
              </Motion.Card>

              {/* Sparkline visualization (Evidence view only) */}
              {mode === 'evidence' && (
                <Motion.Card index={1} className="bg-white border border-[#E4E1D8] p-5.5 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                  <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono mb-4">
                    Pulse Sparkline History
                  </Text>
                  
                  {pulseHistory.length === 0 ? (
                    <Text className="text-slate-500 text-[11px] text-center py-6">
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
                              className="w-full bg-[#7D9C83] rounded-t-sm"
                            />
                            <Text className="text-[#607C64]/70 text-[7px] mt-1 font-mono">
                              {val}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Motion.Card>
              )}

              {/* Sensor specifications cards */}
              <View className="grid grid-cols-2 gap-4 flex-row flex-wrap">
                
                {/* Temperature card */}
                <Motion.Card index={2} className="w-[47%] bg-white border border-[#E4E1D8] p-5 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                  <View className="flex-row justify-between items-center mb-2">
                    <Ionicons name="thermometer" size={18} color="#5C788A" />
                    <Text className="text-[#5C788A] text-[10px] font-bold font-mono uppercase tracking-wider">Skin Temp</Text>
                  </View>
                  <Text className="text-[#2E3A2F] text-lg font-black font-sans">
                    {mode === 'wellness' 
                      ? (liveData ? getLocalizedTemperature(liveData.temperature, locale) : 'Steady') 
                      : (liveData ? `${liveData.temperature.toFixed(1)} °C` : '--')}
                  </Text>
                  <Text className="text-[#607C64]/70 text-[9px] font-mono mt-1">
                    {mode === 'wellness' ? 'Thermal State' : 'Celsius scale'}
                  </Text>
                </Motion.Card>

                {/* Steps Tracker Card */}
                <Motion.Card index={3} className="w-[47%] bg-white border border-[#E4E1D8] p-5 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                  <View className="flex-row justify-between items-center mb-2">
                    <Ionicons name="footsteps" size={18} color="#C07A65" />
                    <Text className="text-[#C07A65] text-[10px] font-bold font-mono uppercase tracking-wider">Movement</Text>
                  </View>
                  <Text className="text-[#2E3A2F] text-lg font-black font-sans">
                    {mode === 'wellness' 
                      ? (liveData ? getLocalizedMovement(liveData.steps, locale) : 'Syncing') 
                      : (liveData ? `${liveData.steps}` : '--')}
                  </Text>
                  <Text className="text-[#607C64]/70 text-[9px] font-mono mt-1">
                    {mode === 'wellness' ? 'Circulation' : 'Daily steps log'}
                  </Text>
                </Motion.Card>

              </View>

              {/* Activity Status Card */}
              <Motion.Card index={4} className="bg-white border border-[#E4E1D8] p-5.5 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-[#F5F2EA] border border-[#E4E1D8] justify-center items-center mr-3">
                      <Ionicons 
                        name={getActivityIcon(liveData?.activity)} 
                        size={16} 
                        color={getActivityColor(liveData?.activity)} 
                      />
                    </View>
                    <Text className="text-[#2E3A2F] font-serif font-black text-sm">Current Activity</Text>
                  </View>
                  <View className="px-3 py-1 rounded-full bg-[#F2EFE8] border border-[#E4E1D8]">
                    <Text className="text-[#607C64] font-mono text-[9px] uppercase font-bold tracking-widest">
                      {liveData ? liveData.activity : 'Unknown'}
                    </Text>
                  </View>
                </View>

                {mode === 'evidence' && (
                  <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-[#E4E1D8]/65">
                    <View>
                      <Text className="text-slate-500 text-[9px] font-mono uppercase tracking-wider">Est. Calories Burned</Text>
                      <Text className="text-[#2E3A2F] text-xl font-black font-mono mt-1">
                        {liveData ? `${Math.round(liveData.steps * 0.04)}` : '0'} <Text className="text-slate-400 text-xs font-normal">kcal</Text>
                      </Text>
                    </View>
                    <Ionicons name="flame" size={26} color="#C07A65" />
                  </View>
                )}
              </Motion.Card>

            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
