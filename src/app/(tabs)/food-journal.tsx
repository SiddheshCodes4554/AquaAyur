import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';

interface FoodLogRecord {
  id: string;
  meal_type: string;
  food_name: string;
  quantity_g: number;
  calories_kcal: number;
  timestamp: string;
  image_url?: string | null;
  nutrition_analysis?: {
    carbs_g: number;
    protein_g: number;
    fat_g: number;
    fiber_g: number;
    ayurvedic_taste: string;
    dosha_effect: string;
  } | null;
}

export default function FoodJournalScreen() {
  const { profile, user } = useAuthStore();
  const [logs, setLogs] = useState<FoodLogRecord[]>([]);
  
  // Daily nutrient accumulators
  const [totalCalories, setTotalCalories] = useState(0);
  const [totalCarbs, setTotalCarbs] = useState(0);
  const [totalProtein, setTotalProtein] = useState(0);
  const [totalFat, setTotalFat] = useState(0);
  const [totalFiber, setTotalFiber] = useState(0);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Daily Recommended Macro Budgets
  const dailyMacroGoals = {
    carbs: 300,   // grams
    protein: 65,  // grams
    fat: 70,      // grams
    fiber: 30     // grams
  };

  const fetchFoodLogs = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Join with nutrition_analysis
      const { data, error } = await supabase
        .from('food_logs')
        .select('*, nutrition_analysis(*)')
        .eq('user_id', user.id)
        .gte('timestamp', todayStart.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;
      const records = (data as FoodLogRecord[]) || [];
      setLogs(records);

      // Calculate totals
      let kcalSum = 0;
      let carbsSum = 0;
      let proteinSum = 0;
      let fatSum = 0;
      let fiberSum = 0;

      records.forEach((item) => {
        kcalSum += item.calories_kcal;
        if (item.nutrition_analysis) {
          carbsSum += Number(item.nutrition_analysis.carbs_g || 0);
          proteinSum += Number(item.nutrition_analysis.protein_g || 0);
          fatSum += Number(item.nutrition_analysis.fat_g || 0);
          fiberSum += Number(item.nutrition_analysis.fiber_g || 0);
        }
      });

      setTotalCalories(kcalSum);
      setTotalCarbs(carbsSum);
      setTotalProtein(proteinSum);
      setTotalFat(fatSum);
      setTotalFiber(fiberSum);
    } catch (e) {
      console.warn('[FoodJournal] Error loading food logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFoodLogs();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFoodLogs();
    setRefreshing(false);
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const calGoal = profile?.daily_calorie_goal_kcal || 2000;
  const progressPercent = Math.min(Math.round((totalCalories / calGoal) * 100), 100);

  const getProgressWidth = (val: number, goal: number): any => {
    const pct = Math.min(Math.round((val / goal) * 100), 100);
    return `${pct}%`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34d399" />}
        className="px-6 py-6"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Nutrition Tracker</Text>
            <Text className="text-white text-2xl font-bold">Food Journal</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/food-analysis')}
            className="bg-emerald-500 p-3 rounded-xl shadow-md active:bg-emerald-600"
          >
            <Ionicons name="add" size={20} color="#022c22" />
          </TouchableOpacity>
        </View>

        {/* Daily Progress Visual Card */}
        <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl mb-8">
          <Text className="text-emerald-300 font-bold text-sm mb-4">Daily Calories</Text>
          
          <View className="flex-row justify-between items-end mb-2">
            <Text className="text-white text-3xl font-black">{totalCalories} kcal</Text>
            <Text className="text-emerald-400/60 text-xs">Goal: {calGoal} kcal</Text>
          </View>

          {/* Calorie Progress Bar */}
          <View className="h-3 w-full bg-emerald-950 rounded-full overflow-hidden mb-6">
            <View 
              style={{ width: `${progressPercent}%` }} 
              className="h-full bg-emerald-400 rounded-full"
            />
          </View>

          {/* Daily Macronutrients Progress Grid */}
          <Text className="text-emerald-300/80 text-xs font-bold uppercase tracking-wider mb-3">Macronutrients</Text>
          <View className="space-y-3">
            
            {/* Carbs */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-emerald-100 font-semibold">Carbohydrates</Text>
                <Text className="text-emerald-400/60 font-mono font-bold">{totalCarbs}g / {dailyMacroGoals.carbs}g</Text>
              </View>
              <View className="h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalCarbs, dailyMacroGoals.carbs) }} className="h-full bg-emerald-400" />
              </View>
            </View>

            {/* Protein */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-emerald-100 font-semibold">Protein</Text>
                <Text className="text-emerald-400/60 font-mono font-bold">{totalProtein}g / {dailyMacroGoals.protein}g</Text>
              </View>
              <View className="h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalProtein, dailyMacroGoals.protein) }} className="h-full bg-cyan-400" />
              </View>
            </View>

            {/* Fat */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-emerald-100 font-semibold">Fats</Text>
                <Text className="text-emerald-400/60 font-mono font-bold">{totalFat}g / {dailyMacroGoals.fat}g</Text>
              </View>
              <View className="h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalFat, dailyMacroGoals.fat) }} className="h-full bg-amber-400" />
              </View>
            </View>

            {/* Fiber */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-emerald-100 font-semibold">Dietary Fiber</Text>
                <Text className="text-emerald-400/60 font-mono font-bold">{totalFiber}g / {dailyMacroGoals.fiber}g</Text>
              </View>
              <View className="h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalFiber, dailyMacroGoals.fiber) }} className="h-full bg-purple-400" />
              </View>
            </View>

          </View>
        </View>

        {/* Food Logs list */}
        <Text className="text-emerald-300/80 text-sm font-bold uppercase tracking-widest mb-4">
          Today's Meals
        </Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#34d399" className="py-12" />
        ) : logs.length === 0 ? (
          <View className="bg-emerald-900/10 border border-dashed border-emerald-800/30 p-12 rounded-2xl justify-center items-center">
            <Ionicons name="restaurant" size={32} color="#047857" className="mb-2" />
            <Text className="text-emerald-500 text-sm text-center">
              No food logged today. Click the '+' button to log your first meal!
            </Text>
          </View>
        ) : (
          <View className="space-y-4">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              
              return (
                <TouchableOpacity
                  key={log.id}
                  onPress={() => toggleExpandLog(log.id)}
                  activeOpacity={0.9}
                  className="bg-emerald-900/20 border border-emerald-800/30 p-4 rounded-xl"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center space-x-3">
                      {/* Photo or Category Icon */}
                      {log.image_url ? (
                        <Image source={{ uri: log.image_url }} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <View className="bg-emerald-950 p-2.5 rounded-lg">
                          <Ionicons
                            name={
                              log.meal_type === 'breakfast' ? 'cafe-outline' :
                              log.meal_type === 'lunch' ? 'pizza-outline' :
                              log.meal_type === 'dinner' ? 'flame-outline' : 'fast-food-outline'
                            }
                            size={20}
                            color="#34d399"
                          />
                        </View>
                      )}
                      
                      <View>
                        <Text className="text-white font-bold text-sm capitalize">{log.food_name}</Text>
                        <Text className="text-emerald-400/50 text-xs capitalize mt-0.5">
                          {log.meal_type} • {log.quantity_g}g
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-emerald-400 font-extrabold text-base">
                        {log.calories_kcal} kcal
                      </Text>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={14} 
                        color="#34d399" 
                        className="mt-1"
                      />
                    </View>
                  </View>

                  {/* Expanded Breakdown Drawer */}
                  {isExpanded && log.nutrition_analysis && (
                    <View className="mt-4 pt-4 border-t border-emerald-800/15 space-y-4">
                      
                      {/* Macronutrients distribution circles */}
                      <View className="flex-row justify-between bg-emerald-950/30 p-3 rounded-lg border border-emerald-900/30">
                        <View className="items-center flex-1">
                          <Text className="text-emerald-400/60 text-[9px] uppercase font-bold">Carbs</Text>
                          <Text className="text-white font-bold text-xs mt-0.5">{log.nutrition_analysis.carbs_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-emerald-850/50">
                          <Text className="text-emerald-400/60 text-[9px] uppercase font-bold">Protein</Text>
                          <Text className="text-cyan-400 font-bold text-xs mt-0.5">{log.nutrition_analysis.protein_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-emerald-850/50">
                          <Text className="text-emerald-400/60 text-[9px] uppercase font-bold">Fat</Text>
                          <Text className="text-amber-400 font-bold text-xs mt-0.5">{log.nutrition_analysis.fat_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-emerald-850/50">
                          <Text className="text-emerald-400/60 text-[9px] uppercase font-bold">Fiber</Text>
                          <Text className="text-purple-400 font-bold text-xs mt-0.5">{log.nutrition_analysis.fiber_g}g</Text>
                        </View>
                      </View>

                      {/* Ayurvedic breakdown details */}
                      <View className="space-y-1">
                        <Text className="text-emerald-300 text-xs font-bold">Ayurvedic Properties</Text>
                        <Text className="text-white text-xs">
                          Taste (Rasa): <Text className="text-emerald-400 capitalize font-bold">{log.nutrition_analysis.ayurvedic_taste}</Text>
                        </Text>
                        <Text className="text-emerald-100/70 text-xs italic leading-relaxed mt-0.5">
                          {log.nutrition_analysis.dosha_effect}
                        </Text>
                      </View>

                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
