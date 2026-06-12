import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

const DOSHA_DESCRIPTIONS: Record<string, { title: string; description: string; traits: string; color: string }> = {
  vata: {
    title: "Vata (Wind & Ether)",
    description: "Vata governs movement, breathing, pulse rate, muscle contraction, and cellular activity. Balanced Vata promotes creativity and vitality. Aggravated Vata causes dry skin, bloating, anxiety, and sleep irregularities.",
    traits: "Slender, dry skin, cold-intolerant, fast talker, creative.",
    color: "text-amber-400"
  },
  pitta: {
    title: "Pitta (Fire & Water)",
    description: "Pitta governs metabolic processes, digestion, temperature control, and nutrient absorption. Balanced Pitta promotes sharp intellect and focus. Aggravated Pitta leads to skin rashes, burning sensations, heartburn, and anger.",
    traits: "Muscular build, warm skin, heat-intolerant, competitive, sharp memory.",
    color: "text-cyan-400"
  },
  kapha: {
    title: "Kapha (Earth & Water)",
    description: "Kapha governs physical structure, joint lubrication, immune vigor, and hydration. Balanced Kapha builds physical power, stamina, and patience. Aggravated Kapha creates lethargy, weight gain, congestion, and attachment.",
    traits: "Broad build, smooth skin, cold/damp intolerant, calm, steady pacing.",
    color: "text-purple-400"
  },
  tridoshic: {
    title: "Tridosha (Equal Balance)",
    description: "A rare and highly resilient constitution where Vata, Pitta, and Kapha exist in equal ratios. Ensures natural vitality, strong immunity, and dynamic biological adaptability to climate shifts.",
    traits: "Symmetrical build, strong digestive fire, emotional stability, easy focus.",
    color: "text-emerald-400"
  }
};

export default function ProfileScreen() {
  const { profile } = useAuthStore();
  const doshaKey = (profile?.dominant_dosha || 'vata').toLowerCase();
  
  let baseDosha = 'vata';
  if (doshaKey.includes('pitta')) baseDosha = 'pitta';
  else if (doshaKey.includes('kapha')) baseDosha = 'kapha';
  else if (doshaKey.includes('tridoshic')) baseDosha = 'tridoshic';

  const info = DOSHA_DESCRIPTIONS[baseDosha] || DOSHA_DESCRIPTIONS.vata;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6 mt-2">
            <View>
              <Text className="text-emerald-400/50 text-[10px] font-bold uppercase tracking-wider">Account Settings</Text>
              <Text className="text-white text-2xl font-bold font-sans">Your Profile</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/settings')}
              className="bg-[#051f18]/40 p-2.5 rounded-xl border border-emerald-900/30 active:bg-emerald-900/20"
            >
              <Ionicons name="settings-outline" size={18} color="#34d399" />
            </TouchableOpacity>
          </View>

          {/* User Card */}
          <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 items-center relative overflow-hidden">
            <View className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            
            <View className="w-22 h-22 rounded-full bg-emerald-950/80 border border-emerald-500/30 justify-center items-center overflow-hidden mb-4 shadow-lg shadow-black/25">
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
              ) : (
                <Ionicons name="person" size={40} color="#10b981" />
              )}
            </View>

            <Text className="text-white text-lg font-bold">{profile?.full_name || 'Yogi'}</Text>
            
            <View className="bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1 mt-2.5">
              <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest font-mono">
                {profile?.dominant_dosha || 'Establishing Dosha'}
              </Text>
            </View>
          </View>

          {/* Physical Vitals Dashboard */}
          <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6">
            <View className="flex-row items-center mb-4">
              <Ionicons name="body-outline" size={16} color="#10b981" />
              <Text className="text-white font-bold text-sm ml-2">Baseline Physicals</Text>
            </View>
            
            <View className="flex-row justify-between py-3 border-b border-emerald-900/20">
              <Text className="text-emerald-300/60 text-xs">Height</Text>
              <Text className="text-white font-bold text-xs font-mono">
                {profile?.height_cm ? `${profile.height_cm} cm` : 'Not Configured'}
              </Text>
            </View>

            <View className="flex-row justify-between py-3 border-b border-emerald-900/20">
              <Text className="text-emerald-300/60 text-xs">Weight</Text>
              <Text className="text-white font-bold text-xs font-mono">
                {profile?.weight_kg ? `${profile.weight_kg} kg` : 'Not Configured'}
              </Text>
            </View>

            <View className="flex-row justify-between py-3">
              <Text className="text-emerald-300/60 text-xs">Daily Hydration Target</Text>
              <Text className="text-white font-bold text-xs font-mono">
                {profile?.daily_water_goal_ml ? `${profile.daily_water_goal_ml} ml` : '2,500 ml'}
              </Text>
            </View>
          </View>

          {/* Ayurvedic Constitution Info Card */}
          <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl">
            <View className="flex-row items-center mb-4">
              <Ionicons name="book-outline" size={16} color="#10b981" />
              <Text className="text-white font-bold text-sm ml-2">Prakriti Analysis</Text>
            </View>

            <Text className={`font-bold text-sm mb-2.5 ${info.color}`}>{info.title}</Text>
            <Text className="text-emerald-100/90 text-xs leading-relaxed mb-4">{info.description}</Text>
            
            <View className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-900/30">
              <Text className="text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">Key Traits</Text>
              <Text className="text-white text-xs leading-relaxed">{info.traits}</Text>
            </View>
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
