import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Switch, 
  ActivityIndicator, 
  LayoutAnimation, 
  Platform, 
  UIManager 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';

// Enable layout animation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SettingsSection = 
  | 'account' 
  | 'health' 
  | 'wearable' 
  | 'privacy' 
  | 'notifications' 
  | 'ai' 
  | 'appearance' 
  | 'dev' 
  | 'about';

export default function SettingsScreen() {
  const { profile, updateProfile, signOut } = useAuthStore();
  
  // Section Expansion State
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>('health');

  // Input states
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || '');
  const [height, setHeight] = useState(profile?.height_cm?.toString() || '');
  const [waterGoal, setWaterGoal] = useState(profile?.daily_water_goal_ml?.toString() || '2500');
  const [calorieGoal, setCalorieGoal] = useState(profile?.daily_calorie_goal_kcal?.toString() || '2000');
  
  // Toggle states
  const [hapticNotify, setHapticNotify] = useState(true);
  const [vitalsAlerts, setVitalsAlerts] = useState(true);
  const [briefingsNotify, setBriefingsNotify] = useState(true);
  const [anonymizeSync, setAnonymizeSync] = useState(false);
  const [sharePractitioner, setSharePractitioner] = useState(true);
  const [strictGrounding, setStrictGrounding] = useState(true);
  const [appTheme, setAppTheme] = useState<'sandalwood' | 'forest' | 'obsidian'>('sandalwood');

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleSection = (section: SettingsSection) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === section ? null : section);
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateProfile({
        full_name: fullName,
        weight_kg: weight ? parseFloat(weight) : null,
        height_cm: height ? parseFloat(height) : null,
        daily_water_goal_ml: parseInt(waterGoal) || 2000,
        daily_calorie_goal_kcal: parseInt(calorieGoal) || 2000
      });
      setSuccessMsg('Wellness Profile saved successfully!');
    } catch (err: any) {
      console.error('[Settings] Error saving updates:', err);
      setErrorMsg(err.message || 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }} edges={['top']}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#E4E1D8]">
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={() => router.back()} 
              className="p-1.5 rounded-lg bg-[#F2EFE8] border border-[#E4E1D8] mr-4 active:bg-[#F2EFE8]/80"
            >
              <Ionicons name="chevron-back" size={20} color="#607C64" />
            </TouchableOpacity>
            <View>
              <Text className="text-[#2E3A2F] text-base font-serif font-black">Sanctuary Settings</Text>
              <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">System Preferences & Targets</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-6 py-5" showsVerticalScrollIndicator={false}>
          
          {successMsg && (
            <View className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl mb-6">
              <Text className="text-emerald-600 text-xs text-center font-sans font-medium">{successMsg}</Text>
            </View>
          )}
          {errorMsg && (
            <View className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-xl mb-6">
              <Text className="text-rose-600 text-xs text-center font-sans font-medium">{errorMsg}</Text>
            </View>
          )}

          {/* ================= ACCOUNT SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('account')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="person-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Account Profile</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Sanctuary credentials and login details</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'account' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'account' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                <View>
                  <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono mb-1">User Identifier</Text>
                  <Text className="text-slate-650 text-xs font-mono">{profile?.id || 'Not Loaded'}</Text>
                </View>
                <View className="pt-2 space-y-3">
                  <TouchableOpacity 
                    onPress={() => router.push('/(auth)/onboarding')}
                    className="bg-[#F2EFE8] border border-[#E4E1D8] py-3 rounded-xl items-center active:bg-emerald-950/5 mb-1"
                  >
                    <Text className="text-[#607C64] font-bold text-xs">Redo Wellness Intake Assessment</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={signOut}
                    className="bg-red-500/5 border border-red-500/10 py-3 rounded-xl items-center active:bg-red-500/10"
                  >
                    <Text className="text-red-500 font-bold text-xs">Sign Out of Sanctuary</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ================= HEALTH PROFILE SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('health')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="fitness-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Ayurvedic Health Profile</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Height, weight, hydration & metabolic targets</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'health' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'health' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                <View className="flex-row space-x-4">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-semibold mb-2">Weight (kg)</Text>
                    <TextInput
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="numeric"
                      className="bg-[#F8F6F0] border border-[#E4E1D8] rounded-xl px-4 py-2.5 text-[#2E3A2F] text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-semibold mb-2">Height (cm)</Text>
                    <TextInput
                      value={height}
                      onChangeText={setHeight}
                      keyboardType="numeric"
                      className="bg-[#F8F6F0] border border-[#E4E1D8] rounded-xl px-4 py-2.5 text-[#2E3A2F] text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                </View>

                <View className="flex-row space-x-4">
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-semibold mb-2">Water Goal (ml)</Text>
                    <TextInput
                      value={waterGoal}
                      onChangeText={setWaterGoal}
                      keyboardType="numeric"
                      className="bg-[#F8F6F0] border border-[#E4E1D8] rounded-xl px-4 py-2.5 text-[#2E3A2F] text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-slate-500 text-[10px] font-semibold mb-2">Calorie Goal (kcal)</Text>
                    <TextInput
                      value={calorieGoal}
                      onChangeText={setCalorieGoal}
                      keyboardType="numeric"
                      className="bg-[#F8F6F0] border border-[#E4E1D8] rounded-xl px-4 py-2.5 text-[#2E3A2F] text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                </View>

                <View className="pt-2">
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    disabled={loading}
                    className="bg-[#7D9C83] rounded-xl py-3 flex-row justify-center items-center shadow-sm active:bg-[#607C64]"
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text className="text-white font-black text-[10px] uppercase tracking-wider">Save Targets</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ================= WEARABLE SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('wearable')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="watch-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Wearable Band Settings</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Active biosensors & telemetry parameters</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'wearable' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'wearable' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                <View className="bg-[#F5F2EA] p-4 rounded-2xl border border-[#E4E1D8]">
                  <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">Telemetry Mode</Text>
                  <Text className="text-[#2E3A2F] text-xs font-bold mt-1">Concentric Sensor Handshake</Text>
                  <Text className="text-slate-600 text-[10px] leading-relaxed mt-1">
                    Bluetooth discovery binds core parameters (HRV, skin temp) directly into the Ayurvedic rule engine every 15s.
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => router.push('/(tabs)/device')}
                  className="bg-[#F2EFE8] border border-[#E4E1D8] py-3 rounded-xl items-center active:bg-emerald-950/5"
                >
                  <Text className="text-[#607C64] font-bold text-xs uppercase tracking-wider">Manage Devices</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* ================= PRIVACY SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('privacy')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="lock-closed-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Data Privacy & Vault</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Telemetry encryption & sharing consents</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'privacy' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'privacy' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                {/* Anonymize Toggle */}
                <View className="flex-row justify-between items-center py-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Anonymize Telemetry Sync</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Encrypts identity tags during database commits.</Text>
                  </View>
                  <Switch
                    value={anonymizeSync}
                    onValueChange={setAnonymizeSync}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={anonymizeSync ? '#ffffff' : '#9ca3af'}
                  />
                </View>

                {/* Practitioner Sharing Toggle */}
                <View className="flex-row justify-between items-center py-2 border-t border-[#E4E1D8]/20 pt-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Share Logs with Practitioner</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Grants clinical view permissions to B.A.M.S. advisers.</Text>
                  </View>
                  <Switch
                    value={sharePractitioner}
                    onValueChange={setSharePractitioner}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={sharePractitioner ? '#ffffff' : '#9ca3af'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ================= NOTIFICATIONS SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('notifications')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="notifications-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Intelligent Alerts</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Dinacharya alarms and heart rate warnings</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'notifications' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'notifications' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                {/* Haptic alarms */}
                <View className="flex-row justify-between items-center py-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Haptic Dinacharya Reminders</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Vibrates paired band on hydration/dinacharya ticks.</Text>
                  </View>
                  <Switch
                    value={hapticNotify}
                    onValueChange={setHapticNotify}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={hapticNotify ? '#ffffff' : '#9ca3af'}
                  />
                </View>

                {/* Vitals alarm */}
                <View className="flex-row justify-between items-center py-2 border-t border-[#E4E1D8]/20 pt-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Vitals Volatility Alarm</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Vibrate core if HR/skin temp scales abnormally.</Text>
                  </View>
                  <Switch
                    value={vitalsAlerts}
                    onValueChange={setVitalsAlerts}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={vitalsAlerts ? '#ffffff' : '#9ca3af'}
                  />
                </View>

                {/* Briefing alerts */}
                <View className="flex-row justify-between items-center py-2 border-t border-[#E4E1D8]/20 pt-4">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Morning Diagnostic Briefing</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Receive notifications when your diagnostic compile completes.</Text>
                  </View>
                  <Switch
                    value={briefingsNotify}
                    onValueChange={setBriefingsNotify}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={briefingsNotify ? '#ffffff' : '#9ca3af'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ================= AI PREFERENCES SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('ai')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="sparkles-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">AI Coach Preferences</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Grounding filters and anti-hallucination settings</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'ai' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'ai' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                <View className="flex-row justify-between items-center py-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-[#2E3A2F] text-xs font-bold">Anti-Hallucination Grounding</Text>
                    <Text className="text-slate-500 text-[9px] mt-0.5">Forces rule engine parsing on all Groq vision/diet prompts.</Text>
                  </View>
                  <Switch
                    value={strictGrounding}
                    onValueChange={setStrictGrounding}
                    trackColor={{ false: '#F2EFE8', true: '#7D9C83' }}
                    thumbColor={strictGrounding ? '#ffffff' : '#9ca3af'}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ================= APPEARANCE SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('appearance')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="color-palette-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Visual Appearance</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Theme presets and color settings</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'appearance' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'appearance' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-4">
                <Text className="text-slate-500 text-[10px] font-semibold mb-2 font-mono">Aesthetic Canvas Theme</Text>
                <View className="flex-row space-x-2 bg-[#F2EFE8] p-1 rounded-xl border border-[#E4E1D8]">
                  {(['sandalwood', 'forest', 'obsidian'] as const).map((theme) => {
                    const isSelected = appTheme === theme;
                    return (
                      <TouchableOpacity
                        key={theme}
                        onPress={() => setAppTheme(theme)}
                        className={`flex-1 py-2 rounded-lg items-center capitalize ${
                          isSelected ? 'bg-[#7D9C83]' : ''
                        }`}
                      >
                        <Text className={`text-[9px] font-bold ${isSelected ? 'text-white' : 'text-[#607C64]/60'}`}>
                          {theme}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>


          {/* ================= ABOUT SECTION ================= */}
          <View className="bg-white border border-[#E4E1D8] rounded-3xl mb-4 overflow-hidden shadow-sm shadow-[#E4E1D8]/20">
            <TouchableOpacity 
              onPress={() => toggleSection('about')}
              className="p-5 flex-row justify-between items-center active:bg-[#F2EFE8]/40"
            >
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-8 h-8 rounded-full bg-[#F2EFE8] border border-[#E4E1D8] justify-center items-center mr-3">
                  <Ionicons name="information-circle-outline" size={16} color="#607C64" />
                </View>
                <View className="flex-1">
                  <Text className="text-[#2E3A2F] text-xs font-bold font-serif">About AquaAyur</Text>
                  <Text className="text-[#607C64]/70 text-[9px] mt-0.5 leading-tight">Software specifications and clinical certifications</Text>
                </View>
              </View>
              <Ionicons name={expandedSection === 'about' ? 'chevron-up' : 'chevron-down'} size={16} color="#607C64" />
            </TouchableOpacity>

            {expandedSection === 'about' && (
              <View className="px-5 pb-5 border-t border-[#E4E1D8]/60 pt-4 space-y-3.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-500 text-[11px] font-sans">Software Version</Text>
                  <Text className="text-[#2E3A2F] text-xs font-bold font-mono">v1.4.0</Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-500 text-[11px] font-sans">B.A.M.S. Clinical Standards</Text>
                  <Text className="text-[#607C64] text-xs font-bold font-mono">Certified</Text>
                </View>
                <View className="flex-row justify-between items-center pt-2 border-t border-[#E4E1D8]/20">
                  <Text className="text-[9px] text-[#607C64]/60 leading-normal font-sans text-center w-full">
                    Designed for holistic wellness. Telemetry assessments are grounded strictly on rule-based engines.
                  </Text>
                </View>
              </View>
            )}
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
