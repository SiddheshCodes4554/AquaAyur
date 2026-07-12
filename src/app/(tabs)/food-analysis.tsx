import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Image, 
  Alert, 
  Animated, 
  Easing 
} from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { uploadMealImage } from '../../services/imageUpload';
import { analyzeFoodNutrition, AINutritionResult } from '../../services/aiNutritionService';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export default function FoodAnalysisScreen() {
  const { user } = useAuthStore();
  
  // Form States
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [weight, setWeight] = useState('');
  const [calories, setCalories] = useState('');
  
  // Advanced Nutrition States
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [carbs, setCarbs] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');

  // Image Upload / Base64 States
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // AI Scanner States
  const [scanningMeal, setScanningMeal] = useState(false);
  const [aiResult, setAiResult] = useState<AINutritionResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Viewfinder scanner line animation
  const scannerLineAnim = useRef(new Animated.Value(0)).current;
  // Nutrient progress bar animations
  const carbsBarWidth = useRef(new Animated.Value(0)).current;
  const proteinBarWidth = useRef(new Animated.Value(0)).current;
  const fatBarWidth = useRef(new Animated.Value(0)).current;
  const fiberBarWidth = useRef(new Animated.Value(0)).current;

  // Viewfinder scanning animation loop
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (!imageUri || scanningMeal) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scannerLineAnim, {
            toValue: 1,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(scannerLineAnim, {
            toValue: 0,
            duration: 2500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      anim.start();
    } else {
      scannerLineAnim.setValue(0);
    }
    return () => anim?.stop();
  }, [imageUri, scanningMeal]);

  // Animate nutrient progress bars when AI results load
  useEffect(() => {
    if (aiResult) {
      const total = (aiResult.carbs_g + aiResult.protein_g + aiResult.fat_g + aiResult.fiber_g) || 1;
      
      Animated.parallel([
        Animated.timing(carbsBarWidth, {
          toValue: aiResult.carbs_g / total,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false
        }),
        Animated.timing(proteinBarWidth, {
          toValue: aiResult.protein_g / total,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false
        }),
        Animated.timing(fatBarWidth, {
          toValue: aiResult.fat_g / total,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false
        }),
        Animated.timing(fiberBarWidth, {
          toValue: aiResult.fiber_g / total,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false
        })
      ]).start();
    } else {
      carbsBarWidth.setValue(0);
      proteinBarWidth.setValue(0);
      fatBarWidth.setValue(0);
      fiberBarWidth.setValue(0);
    }
  }, [aiResult]);

  // Derived health indicators
  const healthScore = useMemo(() => {
    if (!aiResult) return null;
    const c = aiResult.carbs_g;
    const p = aiResult.protein_g;
    const f = aiResult.fat_g;
    const fib = aiResult.fiber_g;
    // Ayurvedic health score algorithm based on macro composition
    let score = 85;
    if (f > 20) score -= 12; // excess heavy fats
    if (c > 75) score -= 10; // excess simple sugars
    if (fib > 5) score += 8;  // digestion fibers bonus
    if (p > 15) score += 6;  // tissue repair bonus
    return Math.max(50, Math.min(99, score));
  }, [aiResult]);

  const agniImpact = useMemo(() => {
    if (!aiResult) return null;
    const f = aiResult.fat_g;
    const fib = aiResult.fiber_g;
    if (f > 15 || fib > 6) {
      return {
        label: 'Heavy (Guru)',
        desc: 'Requires robust digestive fire. Best consumed during midday peak (Pitta hours). Avoid eating late at night.',
        color: '#f97316'
      };
    }
    return {
      label: 'Light (Laghu)',
      desc: 'Quickly assimilated, stoking metabolic fire without creating toxins (Ama). Safe for evening consumption.',
      color: '#34d399'
    };
  }, [aiResult]);

  const pairingRecommendation = useMemo(() => {
    if (!aiResult) return null;
    const taste = aiResult.ayurvedicTaste;
    if (['sweet', 'sour', 'salty'].includes(taste)) {
      return {
        title: 'Vata Pacifying Pairing',
        text: 'This meal grounds dry Vata energy. Best paired with hot ginger tea or a pinch of rock salt to aid assimilation.'
      };
    }
    return {
      title: 'Kapha Pacifying Pairing',
      text: 'This dry/stimulating meal clears Kapha dampness. Best paired with warm water or active digestive spices (black pepper).'
    };
  }, [aiResult]);

  // Trigger camera capture (requests base64 payload)
  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera access permissions are required to scan meal photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  // Trigger gallery selection (requests base64 payload)
  const handleChoosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Media gallery permissions are required to choose meal photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  // Handle AI Scan Trigger
  const handleAIScan = async () => {
    setErrorMsg(null);
    if (!imageBase64 && !foodName.trim()) {
      setErrorMsg('Please capture a photo or enter a meal name to trigger AI analysis.');
      return;
    }

    setScanningMeal(true);
    try {
      const result = await analyzeFoodNutrition(imageBase64, foodName);
      
      // Pre-populate input fields
      setFoodName(result.foodName);
      setWeight(String(result.weight_g));
      setCalories(String(result.calories_kcal));
      setCarbs(String(result.carbs_g));
      setProtein(String(result.protein_g));
      setFat(String(result.fat_g));
      setFiber(String(result.fiber_g));
      
      // Update AI results display
      setAiResult(result);
      setShowAdvanced(true); // show macro entries
    } catch (e: any) {
      console.warn('[AIScan] Failed to scan meal:', e);
      setErrorMsg(e.message || 'AI scanning failed. Please check network/API configurations.');
    } finally {
      setScanningMeal(false);
    }
  };

  const validateForm = (): boolean => {
    if (!foodName.trim()) {
      setErrorMsg('Please enter a descriptive meal name.');
      return false;
    }

    const weightVal = parseFloat(weight);
    if (isNaN(weightVal) || weightVal <= 0) {
      setErrorMsg('Meal weight must be a positive number.');
      return false;
    }

    const kcalVal = parseInt(calories);
    if (isNaN(kcalVal) || kcalVal < 0) {
      setErrorMsg('Calories must be a non-negative integer.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (!validateForm()) return;
    if (!user?.id) return;

    setLoading(true);

    try {
      const kcalVal = parseInt(calories);
      const weightVal = parseFloat(weight);

      let uploadedUrl: string | null = null;
      if (imageUri) {
        setUploadingImage(true);
        uploadedUrl = await uploadMealImage(imageUri, user.id);
        setUploadingImage(false);
      }

      const { data: foodLog, error: logError } = await supabase
        .from('food_logs')
        .insert({
          user_id: user.id,
          meal_type: mealType,
          food_name: foodName,
          quantity_g: weightVal,
          calories_kcal: kcalVal,
          image_url: uploadedUrl
        })
        .select()
        .single();

      if (logError) throw logError;

      const carbsVal = carbs ? parseFloat(carbs) : Math.round(weightVal * 0.15);
      const proteinVal = protein ? parseFloat(protein) : Math.round(weightVal * 0.05);
      const fatVal = fat ? parseFloat(fat) : Math.round(weightVal * 0.03);
      const fiberVal = fiber ? parseFloat(fiber) : Math.round(weightVal * 0.02);
      
      const ayurvedicTaste = aiResult?.ayurvedicTaste || 'sweet';
      const doshaEffect = aiResult?.doshaImpact || 'Tridoshic balancing in moderate amounts.';

      const { error: analysisError } = await supabase
        .from('nutrition_analysis')
        .insert({
          food_log_id: foodLog.id,
          carbs_g: carbsVal,
          protein_g: proteinVal,
          fat_g: fatVal,
          fiber_g: fiberVal,
          ayurvedic_taste: ayurvedicTaste,
          dosha_effect: doshaEffect
        });

      if (analysisError) throw analysisError;

      router.back();
    } catch (e: any) {
      console.error('[FoodAnalysis] Error logging food:', e);
      setErrorMsg(e.message || 'An error occurred while logging food.');
    } finally {
      setLoading(false);
      setUploadingImage(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#091310' }}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center border-b border-[#1f372f]">
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="p-1.5 rounded-lg bg-[#172722] border border-[#1f372f] mr-4 active:bg-emerald-900/20"
          >
            <Ionicons name="chevron-back" size={20} color="#34d399" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-base font-serif font-black">Food Scanner</Text>
            <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono">Ayurvedic Nutrient Intelligence</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} className="px-6 py-6" showsVerticalScrollIndicator={false}>
          {errorMsg && (
            <View className="bg-red-950/40 border border-red-900/40 p-4 rounded-xl mb-6">
              <Text className="text-red-400 text-xs text-center font-sans font-medium">{errorMsg}</Text>
            </View>
          )}

          {/* VIEWPORT CAMERA SCANNER */}
          <View className="mb-6 relative">
            {imageUri ? (
              <View className="w-full h-60 rounded-3xl overflow-hidden border border-[#1f372f] relative">
                <Image source={{ uri: imageUri }} className="w-full h-full object-cover" />
                
                {/* HUD Overlay Frame */}
                <View className="absolute inset-4 border border-emerald-500/20 rounded-2xl pointer-events-none flex justify-between p-3">
                  <View className="flex-row justify-between">
                    <View className="w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                    <View className="w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                  </View>
                  <View className="flex-row justify-between">
                    <View className="w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                    <View className="w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                  </View>
                </View>

                {/* Animated Scanner Laser Bar */}
                {scanningMeal && (
                  <Animated.View
                    style={{
                      transform: [{
                        translateY: scannerLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 200]
                        })
                      }],
                      position: 'absolute',
                      left: 16,
                      right: 16,
                      height: 2,
                      backgroundColor: '#10b981',
                      shadowColor: '#10b981',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 5,
                      elevation: 4
                    }}
                  />
                )}

                {/* Delete Camera Snap */}
                <TouchableOpacity
                  onPress={() => {
                    setImageUri(null);
                    setImageBase64(null);
                    setAiResult(null);
                  }}
                  className="absolute top-4 right-4 bg-red-950/80 border border-red-950 p-2.5 rounded-full shadow active:bg-red-900"
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="w-full h-60 rounded-3xl bg-[#111d19]/45 border border-[#1f372f] overflow-hidden justify-center items-center relative">
                
                {/* Viewfinder Target corners */}
                <View className="absolute inset-8 border border-emerald-950 rounded-2xl pointer-events-none flex justify-between p-3">
                  <View className="flex-row justify-between">
                    <View className="w-4 h-4 border-t border-l border-emerald-500/40" />
                    <View className="w-4 h-4 border-t border-r border-emerald-500/40" />
                  </View>
                  <View className="flex-row justify-between">
                    <View className="w-4 h-4 border-b border-l border-emerald-500/40" />
                    <View className="w-4 h-4 border-b border-r border-emerald-500/40" />
                  </View>
                </View>

                <Animated.View
                  style={{
                    transform: [{
                      translateY: scannerLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 170]
                      })
                    }],
                    position: 'absolute',
                    left: 32,
                    right: 32,
                    height: 1,
                    backgroundColor: '#10b981/40',
                  }}
                />

                <Ionicons name="scan-outline" size={36} color="#047857" className="mb-4" />
                <Text className="text-white text-sm font-serif font-bold text-center px-8 leading-normal mb-6">
                  Intelligent Camera Viewfinder
                </Text>

                <View className="flex-row space-x-3 px-6">
                  <TouchableOpacity
                    onPress={handleTakePhoto}
                    className="flex-1 bg-emerald-500 rounded-xl py-3 flex-row justify-center items-center active:bg-emerald-600 shadow"
                  >
                    <Ionicons name="camera" size={14} color="#022c22" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-950 font-black text-[10px] uppercase tracking-wider">Capture Snap</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleChoosePhoto}
                    className="flex-1 bg-[#172722] border border-[#1f372f] rounded-xl py-3 flex-row justify-center items-center active:bg-emerald-900/10"
                  >
                    <Ionicons name="image" size={14} color="#34d399" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider">Choose File</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Trigger Scan Button */}
          <TouchableOpacity
            onPress={handleAIScan}
            disabled={scanningMeal || (!imageBase64 && !foodName.trim())}
            className="bg-emerald-500/10 border border-emerald-500/30 py-3.5 rounded-2xl flex-row justify-center items-center mb-6 active:bg-emerald-500/25 disabled:bg-transparent disabled:border-[#1f372f]/40"
          >
            {scanningMeal ? (
              <>
                <ActivityIndicator color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Consulting AI Scanner...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color="#10b981" style={{ marginRight: 6 }} />
                <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Run Vision AI Analysis</Text>
              </>
            )}
          </TouchableOpacity>

          {/* IMMERSIVE NUTRITION ANALYSIS REPORT CARDS */}
          {aiResult && (
            <View className="space-y-5 mb-6">
              
              {/* Concentric Macro Nutrition Wheel & Health Score */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl items-center relative overflow-hidden">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Concentric Macro Wheel</Text>
                
                <View className="w-48 h-48 items-center justify-center relative my-2">
                  <View className="absolute items-center z-10">
                    <Text className="text-emerald-400/50 text-[8px] uppercase font-bold tracking-widest font-mono">Health Score</Text>
                    <Text className="text-white text-3xl font-serif font-black">{healthScore}/100</Text>
                    <Text className="text-emerald-400 text-[9px] font-bold font-mono mt-0.5">{aiResult.calories_kcal} kcal</Text>
                  </View>

                  <Svg width="160" height="160" viewBox="0 0 160 160" className="absolute">
                    {/* Fat Outer ring (Yellow) */}
                    <Circle cx="80" cy="80" r="60" fill="none" stroke="#242111" strokeWidth="5.5" />
                    <Circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="5.5"
                      strokeDasharray={2 * Math.PI * 60}
                      strokeDashoffset={2 * Math.PI * 60 * (1 - (aiResult.fat_g / ((aiResult.carbs_g + aiResult.protein_g + aiResult.fat_g) || 1)))}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />

                    {/* Protein Middle ring (Orange) */}
                    <Circle cx="80" cy="80" r="46" fill="none" stroke="#2e1c12" strokeWidth="5.5" />
                    <Circle
                      cx="80"
                      cy="80"
                      r="46"
                      fill="none"
                      stroke="#fb923c"
                      strokeWidth="5.5"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - (aiResult.protein_g / ((aiResult.carbs_g + aiResult.protein_g + aiResult.fat_g) || 1)))}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />

                    {/* Carbs Inner ring (Sky Blue) */}
                    <Circle cx="80" cy="80" r="32" fill="none" stroke="#0e2433" strokeWidth="5.5" />
                    <Circle
                      cx="80"
                      cy="80"
                      r="32"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="5.5"
                      strokeDasharray={2 * Math.PI * 32}
                      strokeDashoffset={2 * Math.PI * 32 * (1 - (aiResult.carbs_g / ((aiResult.carbs_g + aiResult.protein_g + aiResult.fat_g) || 1)))}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                    />
                  </Svg>
                </View>

                {/* Macro Legend */}
                <View className="flex-row gap-5 mt-4">
                  <View className="flex-row items-center">
                    <View className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] mr-1.5" />
                    <Text className="text-slate-300 text-[10px] font-bold font-mono">Carbs {aiResult.carbs_g}g</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-1.5 h-1.5 rounded-full bg-[#fb923c] mr-1.5" />
                    <Text className="text-slate-300 text-[10px] font-bold font-mono">Protein {aiResult.protein_g}g</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-1.5 h-1.5 rounded-full bg-[#facc15] mr-1.5" />
                    <Text className="text-slate-300 text-[10px] font-bold font-mono">Fat {aiResult.fat_g}g</Text>
                  </View>
                </View>
              </View>

              {/* Dynamic Animated Nutrient Bars */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl space-y-4">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono">Macro Composition Efficiency</Text>
                
                {/* Carbs Bar */}
                <View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-300 text-xs font-bold font-sans">Carbohydrates</Text>
                    <Text className="text-white text-xs font-mono font-bold">{aiResult.carbs_g}g</Text>
                  </View>
                  <View className="h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/10">
                    <Animated.View 
                      style={{
                        width: carbsBarWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }}
                      className="h-full bg-sky-400 rounded-full"
                    />
                  </View>
                </View>

                {/* Protein Bar */}
                <View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-300 text-xs font-bold font-sans">Proteins</Text>
                    <Text className="text-white text-xs font-mono font-bold">{aiResult.protein_g}g</Text>
                  </View>
                  <View className="h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/10">
                    <Animated.View 
                      style={{
                        width: proteinBarWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }}
                      className="h-full bg-orange-400 rounded-full"
                    />
                  </View>
                </View>

                {/* Fat Bar */}
                <View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-300 text-xs font-bold font-sans">Healthy Fats</Text>
                    <Text className="text-white text-xs font-mono font-bold">{aiResult.fat_g}g</Text>
                  </View>
                  <View className="h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/10">
                    <Animated.View 
                      style={{
                        width: fatBarWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }}
                      className="h-full bg-yellow-400 rounded-full"
                    />
                  </View>
                </View>

                {/* Fiber Bar */}
                <View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-300 text-xs font-bold font-sans">Dietary Fiber</Text>
                    <Text className="text-white text-xs font-mono font-bold">{aiResult.fiber_g}g</Text>
                  </View>
                  <View className="h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/10">
                    <Animated.View 
                      style={{
                        width: fiberBarWidth.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }}
                      className="h-full bg-emerald-400 rounded-full"
                    />
                  </View>
                </View>
              </View>

              {/* Ayurvedic Dosha Effects & Taste Card */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Ayurvedic Elemental Effects</Text>
                <Text className="text-white text-lg font-serif font-bold mt-1 mb-2 capitalize">
                  {aiResult.ayurvedicTaste} taste (Rasa)
                </Text>
                <Text className="text-slate-300 text-xs leading-relaxed italic pl-3 border-l-2 border-emerald-500">
                  {aiResult.doshaImpact}
                </Text>
              </View>

              {/* Agni Metabolic Impact Card */}
              {agniImpact && (
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl relative overflow-hidden">
                  <View className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                  <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Digestive Agni Impact</Text>
                  <Text style={{ color: agniImpact.color }} className="text-lg font-serif font-bold mt-1 mb-2">
                    {agniImpact.label}
                  </Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {agniImpact.desc}
                  </Text>
                </View>
              )}

              {/* Ayurvedic food pairings Recommendation Cards */}
              {pairingRecommendation && (
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                  <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Synergistic Pairings</Text>
                  <Text className="text-white text-sm font-serif font-bold mt-1 mb-2">
                    {pairingRecommendation.title}
                  </Text>
                  <Text className="text-slate-300 text-xs leading-relaxed">
                    {pairingRecommendation.text}
                  </Text>
                </View>
              )}

              {/* Micronutrients Pill Badges */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
                <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-3">Microelements Detected</Text>
                <View className="flex-row flex-wrap gap-2">
                  {Object.entries(aiResult.micronutrients).map(([key, val]) => (
                    <View key={key} className="bg-[#172722]/50 border border-[#1f372f] px-3.5 py-2 rounded-2xl flex-row items-center">
                      <Ionicons name="sparkles-outline" size={10} color="#10b981" style={{ marginRight: 6 }} />
                      <Text className="text-emerald-300 text-[10px] font-mono capitalize">{key}: {val}</Text>
                    </View>
                  ))}
                </View>
              </View>

            </View>
          )}

          {/* MANUAL ENTRY PANEL FORM */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl">
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-4">Meal Particulars</Text>
            
            {/* Meal Category Selectors */}
            <Text className="text-emerald-300 text-xs font-semibold mb-2">Meal Category</Text>
            <View className="flex-row space-x-2 mb-4 bg-[#172722]/40 p-1 rounded-xl border border-[#1f372f]">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setMealType(type)}
                  className={`flex-1 rounded-lg py-2.5 items-center capitalize ${
                    mealType === type
                      ? 'bg-emerald-500 border border-emerald-400/20'
                      : 'border border-transparent'
                  }`}
                >
                  <Text className={`text-[10px] font-bold ${mealType === type ? 'text-emerald-950' : 'text-emerald-400/60'}`}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Inputs */}
            <View className="mb-4">
              <Text className="text-emerald-300 text-xs font-semibold mb-2">Food / Meal Name</Text>
              <TextInput
                value={foodName}
                onChangeText={setFoodName}
                placeholder="e.g. Spiced Khichdi"
                placeholderTextColor="#064e3b"
                className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 py-3 text-white text-sm font-bold"
              />
            </View>

            <View className="flex-row space-x-4 mb-4">
              <View className="flex-1">
                <Text className="text-emerald-300 text-xs font-semibold mb-2">Weight (g)</Text>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="250"
                  placeholderTextColor="#064e3b"
                  keyboardType="numeric"
                  className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 py-3 text-white text-sm font-bold"
                  style={{ fontFamily: 'monospace' }}
                />
              </View>

              <View className="flex-1">
                <Text className="text-emerald-300 text-xs font-semibold mb-2">Calories (kcal)</Text>
                <TextInput
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="350"
                  placeholderTextColor="#064e3b"
                  keyboardType="numeric"
                  className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 py-3 text-white text-sm font-bold"
                  style={{ fontFamily: 'monospace' }}
                />
              </View>
            </View>

            {/* Advanced collapsible macronutrients section */}
            <TouchableOpacity
              onPress={() => setShowAdvanced(!showAdvanced)}
              className="flex-row items-center justify-between py-3.5 mb-4 border-t border-[#1f372f]/40"
            >
              <Text className="text-emerald-300 font-bold text-xs">Macro details (Carbs, Protein, Fat)</Text>
              <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color="#34d399" />
            </TouchableOpacity>

            {showAdvanced && (
              <View className="space-y-3 mb-4 bg-[#172722]/20 p-4 rounded-xl border border-[#1f372f]/40">
                <View className="flex-row space-x-4">
                  <View className="flex-1">
                    <Text className="text-emerald-400/70 text-[10px] font-bold mb-1">Carbs (g)</Text>
                    <TextInput
                      value={carbs}
                      onChangeText={setCarbs}
                      placeholder="Auto"
                      placeholderTextColor="#064e3b"
                      keyboardType="numeric"
                      className="bg-[#172722] border border-[#1f372f] rounded-lg p-2.5 text-white text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-400/70 text-[10px] font-bold mb-1">Protein (g)</Text>
                    <TextInput
                      value={protein}
                      onChangeText={setProtein}
                      placeholder="Auto"
                      placeholderTextColor="#064e3b"
                      keyboardType="numeric"
                      className="bg-[#172722] border border-[#1f372f] rounded-lg p-2.5 text-white text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                </View>

                <View className="flex-row space-x-4">
                  <View className="flex-1">
                    <Text className="text-emerald-400/70 text-[10px] font-bold mb-1">Fat (g)</Text>
                    <TextInput
                      value={fat}
                      onChangeText={setFat}
                      placeholder="Auto"
                      placeholderTextColor="#064e3b"
                      keyboardType="numeric"
                      className="bg-[#172722] border border-[#1f372f] rounded-lg p-2.5 text-white text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-emerald-400/70 text-[10px] font-bold mb-1">Fiber (g)</Text>
                    <TextInput
                      value={fiber}
                      onChangeText={setFiber}
                      placeholder="Auto"
                      placeholderTextColor="#064e3b"
                      keyboardType="numeric"
                      className="bg-[#172722] border border-[#1f372f] rounded-lg p-2.5 text-white text-xs font-bold"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || uploadingImage || scanningMeal}
              className="bg-emerald-500 rounded-2xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600 disabled:bg-[#172722]/30"
            >
              {loading || uploadingImage || scanningMeal ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="#022c22" />
                  <Text className="text-emerald-950 text-xs font-bold ml-2">
                    {uploadingImage ? 'Uploading meal photo...' : scanningMeal ? 'Consulting AI Vision...' : 'Logging nutrition...'}
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="restaurant-outline" size={15} color="#022c22" className="mr-2" />
                  <Text className="text-emerald-950 text-xs font-black uppercase tracking-wider">Log & Analyze Meal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
