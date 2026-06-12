import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

export default function SettingsScreen() {
  const { profile, updateProfile, signOut } = useAuthStore();
  
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [waterGoal, setWaterGoal] = useState(profile?.daily_water_goal_ml?.toString() || '2500');
  const [calorieGoal, setCalorieGoal] = useState(profile?.daily_calorie_goal_kcal?.toString() || '2000');
  
  const [hapticNotify, setHapticNotify] = useState(true);
  const [vitalsAlerts, setVitalsAlerts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateProfile({
        full_name: fullName,
        weight_kg: weight ? parseFloat(weight) : null,
        height_cm: height ? parseFloat(height) : null,
        daily_water_goal_ml: parseInt(waterGoal),
        daily_calorie_goal_kcal: parseInt(calorieGoal)
      });
      setSuccessMsg('Profile updated successfully!');
    } catch (err: any) {
      console.error('[Settings] Error saving updates:', err);
      setErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#34d399" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Settings</Text>
        </View>

        {/* Edit Profile Info Section */}
        <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl mb-6">
          <Text className="text-white font-bold text-lg mb-4">Edit Profile Info</Text>

          {successMsg && (
            <View key="success-alert" className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl mb-6 will-change-variable">
              <Text className="text-emerald-400 text-sm text-center">{successMsg}</Text>
            </View>
          )}
          {errorMsg && (
            <View key="error-alert" className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-6 will-change-variable">
              <Text className="text-red-400 text-sm text-center">{errorMsg}</Text>
            </View>
          )}

          <View className="mb-4">
            <Text className="text-emerald-300 text-sm font-semibold mb-2">Display Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          <View className="flex-row space-x-4 mb-4">
            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Weight (kg)</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>

            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Height (cm)</Text>
              <TextInput
                value={height}
                onChangeText={setHeight}
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>
          </View>

          <View className="flex-row space-x-4 mb-8">
            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Water Goal (ml)</Text>
              <TextInput
                value={waterGoal}
                onChangeText={setWaterGoal}
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>

            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Calorie Goal (kcal)</Text>
              <TextInput
                value={calorieGoal}
                onChangeText={setCalorieGoal}
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600"
          >
            {loading ? (
              <ActivityIndicator color="#022c22" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color="#022c22" className="mr-2" />
                <Text className="text-emerald-950 text-base font-bold">Save Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Notifications & Hardware controls */}
        <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl mb-8">
          <Text className="text-white font-bold text-lg mb-4">Device Alerts Configuration</Text>
          
          <View className="flex-row justify-between items-center py-4 border-b border-emerald-800/20">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-sm">Haptic Reminders</Text>
              <Text className="text-emerald-400/60 text-xs mt-0.5">Let wearable vibrate on hydration deficit alerts.</Text>
            </View>
            <Switch
              value={hapticNotify}
              onValueChange={setHapticNotify}
              trackColor={{ false: '#022c22', true: '#10b981' }}
              thumbColor={hapticNotify ? '#ffffff' : '#9ca3af'}
            />
          </View>

          <View className="flex-row justify-between items-center py-4">
            <View className="flex-1 pr-4">
              <Text className="text-white font-bold text-sm">Vitals Abnormal Alarm</Text>
              <Text className="text-emerald-400/60 text-xs mt-0.5">Vibrate or warn if heart rate rises abnormally.</Text>
            </View>
            <Switch
              value={vitalsAlerts}
              onValueChange={setVitalsAlerts}
              trackColor={{ false: '#022c22', true: '#10b981' }}
              thumbColor={vitalsAlerts ? '#ffffff' : '#9ca3af'}
            />
          </View>
        </View>

        {/* Sign Out Card */}
        <TouchableOpacity
          onPress={signOut}
          className="bg-red-500/10 border border-red-500/30 py-4 rounded-xl items-center mb-8 active:bg-red-500/20"
        >
          <Text className="text-red-400 font-bold text-base">Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}
