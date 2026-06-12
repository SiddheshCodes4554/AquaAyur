import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSensorStore } from '../../store/useSensorStore';

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
    case 'walking': return '#34d399'; // emerald-400
    case 'running': return '#f87171'; // red-400
    case 'yoga': return '#c084fc'; // purple-400
    case 'sedentary': return '#9ca3af'; // gray-400
    default: return '#fbbf24'; // amber-400
  }
};

export default function LiveMonitorScreen() {
  const { liveData, status } = useSensorStore();
  const isConnected = status === 'connected';
  const [pulseHistory, setPulseHistory] = useState<number[]>([]);
  const [beatScale, setBeatScale] = useState(1);

  // Maintain last 15 pulse readings for a simple text-based sparkline graph
  useEffect(() => {
    if (liveData?.heartRate) {
      setPulseHistory((prev) => [...prev.slice(-14), liveData.heartRate]);
      
      // Pulse animation effect: trigger scale flash on heartbeat updates
      setBeatScale(1.25);
      const t = setTimeout(() => setBeatScale(1), 200);
      return () => clearTimeout(t);
    }
  }, [liveData?.heartRate]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#34d399" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Vitals Stream</Text>
        </View>

        {!isConnected ? (
          <View className="flex-1 justify-center items-center py-20 bg-emerald-900/10 border border-dashed border-emerald-800/30 rounded-2xl">
            <Ionicons name="stats-chart" size={48} color="#047857" className="mb-4" />
            <Text className="text-emerald-400 text-lg font-bold">Waiting for Connection</Text>
            <Text className="text-emerald-500/80 text-sm mt-2 text-center px-8">
              Enable your Bluetooth Wearable to view real-time biometric feeds.
            </Text>
          </View>
        ) : (
          <View className="space-y-6">
            
            {/* Live Pulsometer beat visualizer */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-8 rounded-2xl items-center justify-center">
              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-6">
                Active Heart Rate
              </Text>

              <View
                style={{ transform: [{ scale: beatScale }] }}
                className="w-32 h-32 rounded-full bg-rose-500/10 border-4 border-rose-500 justify-center items-center mb-6 transition-all duration-100"
              >
                <Ionicons name="heart" size={56} color="#f43f5e" />
              </View>

              <Text className="text-white text-5xl font-black mb-1">
                {liveData ? `${liveData.heartRate}` : '--'}
              </Text>
              <Text className="text-rose-400 font-bold text-sm">bpm</Text>
            </View>

            {/* Sparkline visualization */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                Pulse Sparkline History
              </Text>
              
              {pulseHistory.length === 0 ? (
                <Text className="text-emerald-500/60 text-xs text-center py-6">
                  Establishing vitals frequency range...
                </Text>
              ) : (
                <View className="flex-row items-end justify-between h-20 px-2">
                  {pulseHistory.map((val, idx) => {
                    // Normalize bar height relative to max/min rates
                    const heightPercent = Math.max(10, Math.min(100, ((val - 50) / 70) * 100));
                    return (
                      <View key={idx} className="items-center w-[5%]">
                        <View
                          style={{ height: `${heightPercent}%` }}
                          className="w-full bg-emerald-400 rounded-t-sm"
                        />
                        <Text className="text-emerald-400/40 text-[8px] mt-1 font-mono">
                          {val}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Sensor specifications cards */}
            <View className="flex-row space-x-4">
              
              {/* Temperature card */}
              <View className="flex-1 bg-emerald-900/30 border border-emerald-800/30 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-2">
                  <Ionicons name="thermometer-outline" size={20} color="#0ea5e9" />
                  <Text className="text-sky-400 text-xs font-bold">Skin Temp</Text>
                </View>
                <Text className="text-white text-3xl font-extrabold">
                  {liveData ? `${liveData.temperature.toFixed(2)}` : '--'}
                </Text>
                <Text className="text-emerald-400/60 text-xs mt-1">Celsius</Text>
              </View>

              {/* Steps Tracker Card */}
              <View className="flex-1 bg-emerald-900/30 border border-emerald-800/30 p-5 rounded-2xl">
                <View className="flex-row justify-between items-center mb-2">
                  <Ionicons name="footsteps-outline" size={20} color="#eab308" />
                  <Text className="text-yellow-400 text-xs font-bold">Steps</Text>
                </View>
                <Text className="text-white text-3xl font-extrabold">
                  {liveData ? `${liveData.steps}` : '--'}
                </Text>
                <Text className="text-emerald-400/60 text-xs mt-1">Daily Steps</Text>
              </View>

            </View>

            {/* Activity Status Card */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center">
                  <Ionicons 
                    name={getActivityIcon(liveData?.activity)} 
                    size={24} 
                    color={getActivityColor(liveData?.activity)} 
                  />
                  <Text className="text-white font-bold text-lg ml-2">Current Activity</Text>
                </View>
                <View className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/40">
                  <Text className="text-emerald-400 font-mono text-xs uppercase font-bold">
                    {liveData ? liveData.activity : 'Unknown'}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-emerald-800/20">
                <View>
                  <Text className="text-emerald-400/60 text-xs font-semibold uppercase">Est. Calories Burned</Text>
                  <Text className="text-white text-2xl font-extrabold mt-1">
                    {liveData ? `${Math.round(liveData.steps * 0.04)}` : '0'} <Text className="text-emerald-400/80 text-sm font-normal">kcal</Text>
                  </Text>
                </View>
                <Ionicons name="flame" size={32} color="#f97316" />
              </View>
            </View>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
