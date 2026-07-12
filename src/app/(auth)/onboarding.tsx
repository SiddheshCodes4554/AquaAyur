import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { requestBLEPermissions } from '../../services/bleManager';
import { requestNotificationPermissions } from '../../services/reminderService';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type DietPreference = 'Vegetarian' | 'Vegan' | 'Eggetarian' | 'Non-Vegetarian' | 'Jain' | 'Other';
type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
type StressLevel = 'low' | 'medium' | 'high';
type Alcohol = 'none' | 'occasional' | 'frequent';
type ExerciseFrequency = 'none' | '1-2_times_week' | '3-5_times_week' | 'daily';

const HEALTH_GOAL_OPTIONS = [
  'Improve sleep',
  'Lose weight',
  'Reduce stress',
  'Improve digestion',
  'Increase stamina',
  'Better heart health',
];

export default function OnboardingScreen() {
  const { userId, email, fetchProfile } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // STEP 1: Basic Info
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('prefer_not_to_say');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
  const [language, setLanguage] = useState('English');

  // STEP 2: Health Profile
  const [diet, setDiet] = useState<DietPreference>('Vegetarian');
  const [allergyInput, setAllergyInput] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [dislikedFoodInput, setDislikedFoodInput] = useState('');
  const [dislikedFoods, setDislikedFoods] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState('');

  // STEP 3: Lifestyle
  const [avgSleep, setAvgSleep] = useState('7.5');
  const [activity, setActivity] = useState<ActivityLevel>('lightly_active');
  const [occupation, setOccupation] = useState('');
  const [stress, setStress] = useState<StressLevel>('medium');
  const [waterIntake, setWaterIntake] = useState('2000');
  const [smoking, setSmoking] = useState(false);
  const [alcohol, setAlcohol] = useState<Alcohol>('none');
  const [exercise, setExercise] = useState<ExerciseFrequency>('1-2_times_week');

  // STEP 4: Wearable Connection
  const [wearableConnected, setWearableConnected] = useState(false);

  // STEP 5: Permissions
  const [bluetoothGranted, setBluetoothGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [healthDataGranted, setHealthDataGranted] = useState(false);

  const addTag = (input: string, setInput: React.Dispatch<React.SetStateAction<string>>, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    const clean = input.trim();
    if (clean && !list.includes(clean)) {
      setList([...list, clean]);
    }
    setInput('');
  };

  const removeTag = (item: string, list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    setList(list.filter(x => x !== item));
  };

  const toggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter(g => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleBluetoothPress = async () => {
    try {
      const granted = await requestBLEPermissions();
      setBluetoothGranted(granted);
    } catch (err) {
      console.warn('[Onboarding] Bluetooth request error:', err);
      setBluetoothGranted(true);
    }
  };

  const handleNotificationsPress = async () => {
    try {
      const granted = await requestNotificationPermissions();
      setNotificationsGranted(granted);
    } catch (err) {
      console.warn('[Onboarding] Notifications request error:', err);
      setNotificationsGranted(true);
    }
  };

  const handleHealthDataPress = () => {
    setHealthDataGranted(true);
  };

  const handleNextStep = async () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!firstName || !lastName || !age || !weight || !height) {
        setErrorMsg('Please fill in all vital profile details.');
        return;
      }
    }
    if (step === 5) {
      if (!bluetoothGranted) await handleBluetoothPress();
      if (!notificationsGranted) await handleNotificationsPress();
      setHealthDataGranted(true);
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    setStep(prev => prev - 1);
  };

  const completeOnboarding = async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      let dynamicDosha: 'vata' | 'pitta' | 'kapha' = 'pitta';
      if (stress === 'high' || activity === 'very_active') {
        dynamicDosha = 'vata';
      } else if (activity === 'sedentary') {
        dynamicDosha = 'kapha';
      }

      const allGoals = [...selectedGoals];
      if (customGoal.trim()) {
        allGoals.push(customGoal.trim());
      }

      // Upsert profile in Supabase
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: email || '',
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          age: parseInt(age) || null,
          gender,
          weight_kg: parseFloat(weight) || null,
          height_cm: parseFloat(height) || null,
          blood_group: bloodGroup || null,
          country,
          timezone,
          preferred_language: language,
          diet_preference: diet,
          dominant_dosha: dynamicDosha,
          daily_water_goal_ml: parseInt(waterIntake) || 2500,
          daily_calorie_goal_kcal: activity === 'very_active' ? 2600 : activity === 'moderately_active' ? 2200 : 2000,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // Medical Conditions
      if (conditions.length > 0) {
        await supabase.from('medical_conditions').delete().eq('user_id', userId);
        await supabase.from('medical_conditions').insert(
          conditions.map(c => ({ user_id: userId, condition_name: c }))
        );
      }

      // Allergies
      if (allergies.length > 0) {
        await supabase.from('allergies').delete().eq('user_id', userId);
        await supabase.from('allergies').insert(
          allergies.map(a => ({ user_id: userId, allergy_name: a }))
        );
      }

      // Disliked foods
      if (dislikedFoods.length > 0) {
        await supabase.from('food_preferences').delete().eq('user_id', userId);
        await supabase.from('food_preferences').insert(
          dislikedFoods.map(df => ({ user_id: userId, disliked_food: df }))
        );
      }

      // Health Goals
      if (allGoals.length > 0) {
        await supabase.from('health_goals').delete().eq('user_id', userId);
        await supabase.from('health_goals').insert(
          allGoals.map(g => ({ user_id: userId, goal_name: g }))
        );
      }

      // Lifestyle details
      await supabase.from('lifestyle').delete().eq('user_id', userId);
      const { error: lifeError } = await supabase.from('lifestyle').insert({
        user_id: userId,
        avg_sleep_hours: parseFloat(avgSleep) || 7.0,
        activity_level: activity,
        occupation: occupation || null,
        stress_level: stress,
        water_intake_ml: parseInt(waterIntake) || 2000,
        smoking,
        alcohol,
        exercise_frequency: exercise,
        updated_at: new Date().toISOString(),
      });
      if (lifeError) throw lifeError;

      await fetchProfile(userId);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('[Onboarding] Save profile error:', e);
      setErrorMsg(e.message || 'Failed to save health intake profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#091310]" edges={['top', 'bottom']}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-emerald-950/60">
          <View>
            <Text className="text-white text-base font-serif font-black">Sanctuary Intake</Text>
            <Text className="text-emerald-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">Ayurvedic Clinical Consultation</Text>
          </View>
          <Text className="text-emerald-400 font-mono text-xs">Phase {step}/6</Text>
        </View>

        {/* Progress Bar */}
        <View className="h-1 bg-emerald-950 w-full">
          <View className="h-full bg-emerald-500" style={{ width: `${(step / 6) * 100}%` }} />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6" showsVerticalScrollIndicator={false}>
          {errorMsg && (
            <View className="bg-red-950/40 border border-red-900/40 p-4 rounded-xl mb-6">
              <Text className="text-red-400 text-xs text-center font-sans font-medium">{errorMsg}</Text>
            </View>
          )}

          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl mb-6">
            
            {/* STEP 1: PHYSIOLOGICAL PROFILE */}
            {step === 1 && (
              <View>
                <Text className="text-white text-xl font-serif font-bold mb-1">Physiological Intake</Text>
                <Text className="text-emerald-400/50 text-xs mb-6">Establish your core birth vitals measurements.</Text>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">First Name</Text>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="John"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Last Name</Text>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Doe"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                </View>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Age</Text>
                    <TextInput
                      value={age}
                      onChangeText={setAge}
                      keyboardType="number-pad"
                      placeholder="28"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Blood Group</Text>
                    <TextInput
                      value={bloodGroup}
                      onChangeText={setBloodGroup}
                      placeholder="O+"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                </View>

                <View className="flex-row space-x-3 mb-5">
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Height (cm)</Text>
                    <TextInput
                      value={height}
                      onChangeText={setHeight}
                      keyboardType="numeric"
                      placeholder="175"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Weight (kg)</Text>
                    <TextInput
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="numeric"
                      placeholder="70"
                      placeholderTextColor="#064e3b"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                </View>

                <Text className="text-emerald-300 text-xs font-semibold mb-2.5">Gender Expression</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {(['male', 'female', 'other', 'prefer_not_to_say'] as Gender[]).map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(g)}
                      className={`px-3 py-2.5 rounded-xl border ${gender === g ? 'bg-emerald-500 border-emerald-400' : 'bg-[#172722] border-[#1f372f]'}`}
                    >
                      <Text className={`text-xs font-bold capitalize ${gender === g ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {g.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 2: NUTRITIONAL CONSTITUTION */}
            {step === 2 && (
              <View>
                <Text className="text-white text-xl font-serif font-bold mb-1">Nutritional Intakes</Text>
                <Text className="text-emerald-400/50 text-xs mb-6">Select your diet style and list stomach restrictions.</Text>

                <Text className="text-emerald-300 text-xs font-semibold mb-2.5">Diet Preference</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {(['Vegetarian', 'Vegan', 'Eggetarian', 'Non-Vegetarian', 'Jain', 'Other'] as DietPreference[]).map(d => (
                    <TouchableOpacity
                      key={d}
                      onPress={() => setDiet(d)}
                      className={`px-3.5 py-2.5 rounded-xl border ${diet === d ? 'bg-emerald-500 border-emerald-400' : 'bg-[#172722] border-[#1f372f]'}`}
                    >
                      <Text className={`text-xs font-bold ${diet === d ? 'text-emerald-950' : 'text-emerald-300'}`}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-emerald-300 text-xs font-semibold mb-2.5">Target Health Goals</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {HEALTH_GOAL_OPTIONS.map(g => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => toggleGoal(g)}
                      className={`px-3 py-2 rounded-xl border ${selectedGoals.includes(g) ? 'bg-emerald-500 border-emerald-400' : 'bg-[#172722] border-[#1f372f]'}`}
                    >
                      <Text className={`text-[10px] font-bold ${selectedGoals.includes(g) ? 'text-emerald-950' : 'text-emerald-300'}`}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  value={customGoal}
                  onChangeText={setCustomGoal}
                  placeholder="Other custom health goals..."
                  placeholderTextColor="#064e3b"
                  className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-11 text-white text-xs mb-4"
                />

                <Text className="text-emerald-300 text-xs font-semibold mb-2">Sensitivities / Conditions</Text>
                <View className="flex-row space-x-2 mb-3">
                  <TextInput
                    value={conditionInput}
                    onChangeText={setConditionInput}
                    placeholder="e.g. Hypertension, PCOS"
                    placeholderTextColor="#064e3b"
                    className="flex-1 bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-10 text-white text-xs"
                  />
                  <TouchableOpacity
                    onPress={() => addTag(conditionInput, setConditionInput, conditions, setConditions)}
                    className="bg-emerald-500 px-4 justify-center items-center rounded-xl"
                  >
                    <Text className="text-emerald-950 font-bold text-xs">Add</Text>
                  </TouchableOpacity>
                </View>
                <View className="flex-row flex-wrap gap-1.5 mb-4">
                  {conditions.map(c => (
                    <View key={c} className="bg-emerald-950 border border-emerald-900 flex-row items-center px-3 py-1 rounded-full">
                      <Text className="text-emerald-300 text-xs mr-2">{c}</Text>
                      <TouchableOpacity onPress={() => removeTag(c, conditions, setConditions)}>
                        <Ionicons name="close-circle" size={14} color="#34d399" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 3: LIFESTYLE DETAILS */}
            {step === 3 && (
              <View>
                <Text className="text-white text-xl font-serif font-bold mb-1">Circadian Indexing</Text>
                <Text className="text-emerald-400/50 text-xs mb-6">Map your baseline sleeping and stress configurations.</Text>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Sleep Average (hrs)</Text>
                    <TextInput
                      value={avgSleep}
                      onChangeText={setAvgSleep}
                      keyboardType="numeric"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-300 text-xs font-semibold mb-2">Water Goal (ml)</Text>
                    <TextInput
                      value={waterIntake}
                      onChangeText={setWaterIntake}
                      keyboardType="number-pad"
                      className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                    />
                  </View>
                </View>

                <Text className="text-emerald-300 text-xs font-semibold mb-2.5">Stress Index</Text>
                <View className="flex-row space-x-2 mb-4">
                  {(['low', 'medium', 'high'] as StressLevel[]).map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setStress(s)}
                      className={`flex-1 py-3 rounded-xl border items-center ${stress === s ? 'bg-emerald-500 border-emerald-400' : 'bg-[#172722] border-[#1f372f]'}`}
                    >
                      <Text className={`text-xs font-bold capitalize ${stress === s ? 'text-emerald-950' : 'text-emerald-300'}`}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-emerald-300 text-xs font-semibold mb-2.5">Movement Target</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {(['sedentary', 'lightly_active', 'moderately_active', 'very_active'] as ActivityLevel[]).map(a => (
                    <TouchableOpacity
                      key={a}
                      onPress={() => setActivity(a)}
                      className={`px-3 py-2.5 rounded-xl border ${activity === a ? 'bg-emerald-500 border-emerald-400' : 'bg-[#172722] border-[#1f372f]'}`}
                    >
                      <Text className={`text-xs font-bold capitalize ${activity === a ? 'text-emerald-950' : 'text-emerald-300'}`}>
                        {a.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 4: WEARABLE SETUP */}
            {step === 4 && (
              <View className="items-center py-6">
                <View className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 justify-center items-center rounded-full mb-6">
                  <Ionicons name="bluetooth" size={36} color="#10b981" />
                </View>
                <Text className="text-white text-xl font-serif font-bold text-center mb-1">Wearable Biosensors</Text>
                <Text className="text-emerald-400/50 text-xs text-center px-4 mb-8 leading-relaxed">
                  AquaAyur syncs heart rates, sleep indices, and skin temp fluctuations via an ESP32 wearable.
                </Text>

                {wearableConnected ? (
                  <View className="bg-emerald-500/10 border border-emerald-500/40 p-4 rounded-xl flex-row items-center w-full justify-center mb-4">
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-400 font-bold text-xs uppercase">Biosensor Linked Successfully</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setWearableConnected(true)}
                    className="bg-emerald-500 rounded-xl py-4 w-full flex-row justify-center items-center active:bg-emerald-600 mb-4"
                  >
                    <Ionicons name="radio-outline" size={16} color="#091310" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">
                      Link ESP32 Wearable
                    </Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity onPress={handleNextStep} className="py-2">
                  <Text className="text-emerald-400/50 text-xs font-semibold">Skip and configure later</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 5: PERMISSIONS */}
            {step === 5 && (
              <View>
                <Text className="text-white text-xl font-serif font-bold mb-1">Clinic Authorizations</Text>
                <Text className="text-emerald-400/50 text-xs mb-6">Enable system parameters to feed dynamic forecasts.</Text>

                <TouchableOpacity
                  onPress={handleBluetoothPress}
                  className={`p-4 rounded-xl border flex-row items-center justify-between mb-4 ${bluetoothGranted ? 'bg-[#111d19] border-emerald-500/35' : 'bg-[#172722] border-[#1f372f]'}`}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <Ionicons name="bluetooth" size={20} color="#10b981" style={{ marginRight: 10 }} />
                    <View>
                      <Text className="text-white text-xs font-bold">Bluetooth Feeds</Text>
                      <Text className="text-emerald-400/40 text-[9px] mt-0.5">Stream ESP32 biometric events.</Text>
                    </View>
                  </View>
                  <Ionicons name={bluetoothGranted ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={bluetoothGranted ? '#10b981' : '#1f372f'} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNotificationsPress}
                  className={`p-4 rounded-xl border flex-row items-center justify-between mb-4 ${notificationsGranted ? 'bg-[#111d19] border-emerald-500/35' : 'bg-[#172722] border-[#1f372f]'}`}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <Ionicons name="notifications" size={20} color="#10b981" style={{ marginRight: 10 }} />
                    <View>
                      <Text className="text-white text-xs font-bold">Smart Alerts</Text>
                      <Text className="text-emerald-400/40 text-[9px] mt-0.5">Pushes hydration schedule alerts.</Text>
                    </View>
                  </View>
                  <Ionicons name={notificationsGranted ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={notificationsGranted ? '#10b981' : '#1f372f'} />
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 6: CLINICAL SUMMARY PRESCRIPTION CARD */}
            {step === 6 && (
              <View className="items-center py-4">
                <View className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 justify-center items-center rounded-full mb-6">
                  <Ionicons name="medical" size={28} color="#10b981" />
                </View>
                <Text className="text-white text-xl font-serif font-bold text-center mb-1">Consultation Completed</Text>
                <Text className="text-emerald-400/50 text-xs text-center mb-6">Your baseline wellness profile has been compiled.</Text>

                {/* Prescription Parchment */}
                <View className="bg-emerald-950/60 border border-emerald-900/30 p-5 rounded-2xl w-full mb-6">
                  <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-3">Diagnostic Summary</Text>
                  
                  <View className="space-y-2.5">
                    <View className="flex-row justify-between items-center border-b border-emerald-900/20 pb-2">
                      <Text className="text-emerald-300 text-[10px]">Patient Name</Text>
                      <Text className="text-white font-bold text-xs">{firstName} {lastName}</Text>
                    </View>
                    <View className="flex-row justify-between items-center border-b border-emerald-900/20 pb-2">
                      <Text className="text-emerald-300 text-[10px]">Diet Profile</Text>
                      <Text className="text-white font-bold text-xs">{diet}</Text>
                    </View>
                    <View className="flex-row justify-between items-center border-b border-emerald-900/20 pb-2">
                      <Text className="text-emerald-300 text-[10px]">Water Target</Text>
                      <Text className="text-white font-bold text-xs font-mono">{waterIntake} ml</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-emerald-300 text-[10px]">Stress Index</Text>
                      <Text className="text-white font-bold text-xs capitalize">{stress}</Text>
                    </View>
                  </View>
                </View>

                <Text className="text-emerald-300/60 text-[10px] text-center px-4 leading-relaxed">
                  We will now calibrate your twin avatar balance matrices and start generating morning intelligence consultations.
                </Text>
              </View>
            )}

            {/* Intake Navigation Action Row */}
            <View className="flex-row justify-between mt-8">
              {step > 1 && (
                <TouchableOpacity
                  onPress={handlePrevStep}
                  disabled={loading}
                  className="bg-[#111d19] border border-[#1f372f] rounded-xl py-3 px-6 active:bg-emerald-900/25"
                >
                  <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Back</Text>
                </TouchableOpacity>
              )}

              {step < 6 ? (
                <TouchableOpacity
                  onPress={handleNextStep}
                  className="bg-emerald-500 rounded-xl py-3 px-8 ml-auto active:bg-emerald-600 shadow"
                >
                  <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Continue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={completeOnboarding}
                  disabled={loading}
                  className="bg-emerald-500 rounded-xl py-4 flex-1 ml-4 justify-center items-center shadow active:bg-emerald-600"
                >
                  {loading ? (
                    <ActivityIndicator color="#091310" />
                  ) : (
                    <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">
                      Enter Sanctuary
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

          </View>
        </ScrollView>

      </LinearGradient>
    </SafeAreaView>
  );
}
