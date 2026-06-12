import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
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

  // Validation rules check
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

    if (showAdvanced) {
      const carbsVal = parseFloat(carbs);
      if (carbs && (isNaN(carbsVal) || carbsVal < 0)) {
        setErrorMsg('Carbs must be a non-negative number.');
        return false;
      }
      const proteinVal = parseFloat(protein);
      if (protein && (isNaN(proteinVal) || proteinVal < 0)) {
        setErrorMsg('Protein must be a non-negative number.');
        return false;
      }
      const fatVal = parseFloat(fat);
      if (fat && (isNaN(fatVal) || fatVal < 0)) {
        setErrorMsg('Fat must be a non-negative number.');
        return false;
      }
      const fiberVal = parseFloat(fiber);
      if (fiber && (isNaN(fiberVal) || fiberVal < 0)) {
        setErrorMsg('Fiber must be a non-negative number.');
        return false;
      }
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

      // 1. Upload photo to Supabase storage if selected
      let uploadedUrl: string | null = null;
      if (imageUri) {
        setUploadingImage(true);
        uploadedUrl = await uploadMealImage(imageUri, user.id);
        setUploadingImage(false);
      }

      // 2. Insert into food_logs table
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

      // 3. Resolve nutrients
      const carbsVal = carbs ? parseFloat(carbs) : Math.round(weightVal * 0.15);
      const proteinVal = protein ? parseFloat(protein) : Math.round(weightVal * 0.05);
      const fatVal = fat ? parseFloat(fat) : Math.round(weightVal * 0.03);
      const fiberVal = fiber ? parseFloat(fiber) : Math.round(weightVal * 0.02);
      
      const ayurvedicTaste = aiResult?.ayurvedicTaste || 'sweet';
      const doshaEffect = aiResult?.doshaImpact || 'Tridoshic balancing in moderate amounts.';

      // 4. Insert linked nutrition analysis
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#34d399" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Log New Meal</Text>
        </View>

        <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
          {errorMsg && (
            <View key="error-alert" className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-6 will-change-variable">
              <Text className="text-red-400 text-sm text-center">{errorMsg}</Text>
            </View>
          )}

          {/* Camera & Gallery Image Picker Panel */}
          <Text className="text-emerald-300 text-sm font-semibold mb-3">Meal Photograph</Text>
          {imageUri ? (
            <View className="relative w-full h-48 rounded-xl overflow-hidden mb-4 border border-emerald-800/40">
              <Image source={{ uri: imageUri }} className="w-full h-full object-cover" />
              <TouchableOpacity
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
                className="absolute top-3 right-3 bg-red-600/80 p-2 rounded-full shadow"
              >
                <Ionicons name="trash" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row space-x-3 mb-4">
              <TouchableOpacity
                onPress={handleTakePhoto}
                className="flex-1 bg-emerald-950 border border-emerald-850/50 rounded-xl py-6 items-center justify-center active:bg-emerald-900/30"
              >
                <Ionicons name="camera-outline" size={28} color="#34d399" />
                <Text className="text-emerald-300 font-bold text-xs mt-2">Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChoosePhoto}
                className="flex-1 bg-emerald-950 border border-emerald-850/50 rounded-xl py-6 items-center justify-center active:bg-emerald-900/30"
              >
                <Ionicons name="image-outline" size={28} color="#34d399" />
                <Text className="text-emerald-300 font-bold text-xs mt-2">Choose Image</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Smart AI Scanning Button */}
          <TouchableOpacity
            onPress={handleAIScan}
            disabled={scanningMeal}
            className="bg-emerald-500/10 border border-emerald-500/30 py-3 rounded-xl items-center flex-row justify-center mb-6 active:bg-emerald-500/25"
          >
            {scanningMeal ? (
              <ActivityIndicator color="#34d399" />
            ) : (
              <>
                <Ionicons name="scan-outline" size={16} color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 font-bold text-xs">Scan Meal with Groq Vision AI</Text>
              </>
            )}
          </TouchableOpacity>

          {/* AI Scan Result Card (Toggled) */}
          {aiResult && (
            <View key="ai-result-panel" className="bg-emerald-900/40 border border-emerald-800/40 p-4 rounded-xl mb-6 space-y-2 will-change-variable">
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={16} color="#34d399" />
                <Text className="text-white text-xs font-bold ml-2">AI Nutrition Insights</Text>
              </View>
              <Text className="text-emerald-250 text-xs">
                Ayurvedic Taste (Rasa): <Text className="capitalize font-bold text-white">{aiResult.ayurvedicTaste}</Text>
              </Text>
              <Text className="text-emerald-200/90 text-xs italic leading-relaxed">
                {aiResult.doshaImpact}
              </Text>

              {/* Micronutrients display */}
              <View className="pt-2 border-t border-emerald-800/15">
                <Text className="text-emerald-400/60 text-[9px] uppercase font-bold mb-1">Micronutrients Detected</Text>
                <View className="flex-row flex-wrap">
                  {Object.entries(aiResult.micronutrients).map(([key, val]) => (
                    <View key={key} className="bg-emerald-950/80 px-2 py-0.5 rounded mr-2 mt-1 border border-emerald-850/40">
                      <Text className="text-emerald-350 text-[10px] font-mono">{key}: {val}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Meal Type selection */}
          <Text className="text-emerald-300 text-sm font-semibold mb-3">Meal Category</Text>
          <View className="flex-row space-x-2 mb-6 bg-emerald-950/60 p-1 rounded-xl border border-emerald-800/20">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setMealType(type)}
                className={`flex-1 rounded-lg py-2 items-center capitalize ${
                  mealType === type
                    ? 'bg-emerald-500 border border-emerald-400/20'
                    : 'border border-transparent'
                }`}
              >
                <Text className={`text-xs font-bold ${mealType === type ? 'text-emerald-955' : 'text-emerald-400/60'}`}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Inputs */}
          <View className="mb-4">
            <Text className="text-emerald-300 text-sm font-semibold mb-2">Food / Meal Name</Text>
            <TextInput
              value={foodName}
              onChangeText={setFoodName}
              placeholder="e.g. Avocado Toast"
              placeholderTextColor="#065f46"
              className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base font-bold"
            />
          </View>

          <View className="flex-row space-x-4 mb-4">
            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Weight (g)</Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="200"
                placeholderTextColor="#065f46"
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base font-bold"
                style={{ fontFamily: 'monospace' }}
              />
            </View>

            <View className="flex-1">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Energy (kcal)</Text>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                placeholder="320"
                placeholderTextColor="#065f46"
                keyboardType="numeric"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base font-bold"
                style={{ fontFamily: 'monospace' }}
              />
            </View>
          </View>

          {/* Advanced collapsible macronutrients section */}
          <TouchableOpacity
            onPress={() => setShowAdvanced(!showAdvanced)}
            className="flex-row items-center justify-between py-3 mb-6 border-t border-emerald-800/15"
          >
            <Text className="text-emerald-300 font-bold text-sm">Advanced Nutrition (Macronutrients)</Text>
            <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={18} color="#34d399" />
          </TouchableOpacity>

          {showAdvanced && (
            <View key="advanced-macro-panel" className="space-y-4 mb-6 bg-emerald-950/20 p-4 rounded-xl border border-emerald-850/30 will-change-variable">
              <View className="flex-row space-x-4">
                <View className="flex-1">
                  <Text className="text-emerald-400/70 text-xs font-bold mb-1">Carbs (g)</Text>
                  <TextInput
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="Auto"
                    placeholderTextColor="#065f46"
                    keyboardType="numeric"
                    className="bg-emerald-950 border border-emerald-800/30 rounded-lg p-2 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-emerald-400/70 text-xs font-bold mb-1">Protein (g)</Text>
                  <TextInput
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="Auto"
                    placeholderTextColor="#065f46"
                    keyboardType="numeric"
                    className="bg-emerald-950 border border-emerald-800/30 rounded-lg p-2 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
              </View>

              <View className="flex-row space-x-4">
                <View className="flex-1">
                  <Text className="text-emerald-400/70 text-xs font-bold mb-1">Fat (g)</Text>
                  <TextInput
                    value={fat}
                    onChangeText={setFat}
                    placeholder="Auto"
                    placeholderTextColor="#065f46"
                    keyboardType="numeric"
                    className="bg-emerald-950 border border-emerald-800/30 rounded-lg p-2 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-emerald-400/70 text-xs font-bold mb-1">Fiber (g)</Text>
                  <TextInput
                    value={fiber}
                    onChangeText={setFiber}
                    placeholder="Auto"
                    placeholderTextColor="#065f46"
                    keyboardType="numeric"
                    className="bg-emerald-950 border border-emerald-800/30 rounded-lg p-2 text-white text-sm font-bold"
                    style={{ fontFamily: 'monospace' }}
                  />
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || uploadingImage || scanningMeal}
            className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600"
          >
            {loading || uploadingImage || scanningMeal ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="#022c22" />
                <Text className="text-emerald-950 text-sm font-bold ml-2">
                  {uploadingImage ? 'Uploading meal photo...' : scanningMeal ? 'Consulting AI Vision...' : 'Logging nutrition...'}
                </Text>
              </View>
            ) : (
              <>
                <Ionicons name="restaurant-outline" size={16} color="#022c22" className="mr-2" />
                <Text className="text-emerald-950 text-base font-bold">Log & Analyze Meal</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
