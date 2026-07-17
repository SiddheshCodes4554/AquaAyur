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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7D9C83" />}
        className="px-6 py-6"
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-[#607C64] text-xs font-bold uppercase tracking-wider font-mono">Nutrition Tracker</Text>
            <Text className="text-[#2E3A2F] text-2xl font-serif font-black">Food Journal</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/food-analysis')}
            className="bg-[#7D9C83] p-3 rounded-xl shadow-sm active:bg-[#607C64]"
          >
            <Ionicons name="add" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Daily Progress Visual Card */}
        <View className="bg-white border border-[#E4E1D8] p-6 rounded-2xl mb-8 shadow-sm shadow-[#E4E1D8]/20">
          <Text className="text-[#607C64] font-bold text-sm mb-4 font-serif">Daily Calories</Text>
          
          <View className="flex-row justify-between items-end mb-2">
            <Text className="text-[#2E3A2F] text-3xl font-black">{totalCalories} kcal</Text>
            <Text className="text-[#607C64]/60 text-xs">Goal: {calGoal} kcal</Text>
          </View>

          {/* Calorie Progress Bar */}
          <View className="h-3 w-full bg-[#F2EFE8] rounded-full overflow-hidden mb-6">
            <View 
              style={{ width: `${progressPercent}%` }} 
              className="h-full bg-[#7D9C83] rounded-full"
            />
          </View>

          {/* Daily Macronutrients Progress Grid */}
          <Text className="text-[#607C64] text-xs font-bold uppercase tracking-wider mb-3 font-mono">Macronutrients</Text>
          <View className="space-y-3">
            
            {/* Carbs */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-[#2E3A2F] font-semibold">Carbohydrates</Text>
                <Text className="text-[#607C64]/70 font-mono font-bold">{totalCarbs}g / {dailyMacroGoals.carbs}g</Text>
              </View>
              <View className="h-1.5 w-full bg-[#F2EFE8] rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalCarbs, dailyMacroGoals.carbs) }} className="h-full bg-[#7D9C83]" />
              </View>
            </View>

            {/* Protein */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-[#2E3A2F] font-semibold">Protein</Text>
                <Text className="text-[#607C64]/70 font-mono font-bold">{totalProtein}g / {dailyMacroGoals.protein}g</Text>
              </View>
              <View className="h-1.5 w-full bg-[#F2EFE8] rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalProtein, dailyMacroGoals.protein) }} className="h-full bg-[#5C788A]" />
              </View>
            </View>

            {/* Fat */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-[#2E3A2F] font-semibold">Fats</Text>
                <Text className="text-[#607C64]/70 font-mono font-bold">{totalFat}g / {dailyMacroGoals.fat}g</Text>
              </View>
              <View className="h-1.5 w-full bg-[#F2EFE8] rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalFat, dailyMacroGoals.fat) }} className="h-full bg-[#C07A65]" />
              </View>
            </View>

            {/* Fiber */}
            <View>
              <View className="flex-row justify-between text-[11px] mb-1">
                <Text className="text-[#2E3A2F] font-semibold">Dietary Fiber</Text>
                <Text className="text-[#607C64]/70 font-mono font-bold">{totalFiber}g / {dailyMacroGoals.fiber}g</Text>
              </View>
              <View className="h-1.5 w-full bg-[#F2EFE8] rounded-full overflow-hidden">
                <View style={{ width: getProgressWidth(totalFiber, dailyMacroGoals.fiber) }} className="h-full bg-[#7A9482]" />
              </View>
            </View>

          </View>
        </View>

        {/* Food Logs list */}
        <Text className="text-[#607C64] text-xs font-bold uppercase tracking-widest mb-4 font-mono">
          Today's Meals
        </Text>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color="#7D9C83" className="py-12" />
        ) : logs.length === 0 ? (
          <View className="bg-white border border-dashed border-[#E4E1D8] p-12 rounded-2xl justify-center items-center shadow-sm">
            <Ionicons name="restaurant" size={32} color="#7D9C83" className="mb-2" />
            <Text className="text-slate-600 text-sm text-center">
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
                  className="bg-white border border-[#E4E1D8] p-4 rounded-xl mb-3 shadow-sm shadow-[#E4E1D8]/10"
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center space-x-3">
                      {/* Photo or Category Icon */}
                      {log.image_url ? (
                        <Image source={{ uri: log.image_url }} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <View className="bg-[#F5F2EA] p-2.5 rounded-lg">
                          <Ionicons
                            name={
                              log.meal_type === 'breakfast' ? 'cafe-outline' :
                              log.meal_type === 'lunch' ? 'pizza-outline' :
                              log.meal_type === 'dinner' ? 'flame-outline' : 'fast-food-outline'
                            }
                            size={20}
                            color="#7D9C83"
                          />
                        </View>
                      )}
                      
                      <View className="ml-3">
                        <Text className="text-[#2E3A2F] font-bold text-sm capitalize font-serif">{log.food_name}</Text>
                        <Text className="text-slate-500 text-xs capitalize mt-0.5 font-mono">
                          {log.meal_type} • {log.quantity_g}g
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-[#2E3A2F] font-extrabold text-base">
                        {log.calories_kcal} kcal
                      </Text>
                      <Ionicons 
                        name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                        size={14} 
                        color="#607C64" 
                        className="mt-1"
                      />
                    </View>
                  </View>

                  {/* Expanded Breakdown Drawer */}
                  {isExpanded && log.nutrition_analysis && (
                    <View className="mt-4 pt-4 border-t border-[#E4E1D8]/65 space-y-4">
                      
                      {/* Macronutrients distribution circles */}
                      <View className="flex-row justify-between bg-[#F5F2EA]/40 p-3 rounded-lg border border-[#E4E1D8]">
                        <View className="items-center flex-1">
                          <Text className="text-[#607C64]/70 text-[9px] uppercase font-bold font-mono">Carbs</Text>
                          <Text className="text-[#2E3A2F] font-bold text-xs mt-0.5">{log.nutrition_analysis.carbs_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-[#E4E1D8]/60">
                          <Text className="text-[#607C64]/70 text-[9px] uppercase font-bold font-mono">Protein</Text>
                          <Text className="text-[#5C788A] font-bold text-xs mt-0.5">{log.nutrition_analysis.protein_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-[#E4E1D8]/60">
                          <Text className="text-[#607C64]/70 text-[9px] uppercase font-bold font-mono">Fat</Text>
                          <Text className="text-[#C07A65] font-bold text-xs mt-0.5">{log.nutrition_analysis.fat_g}g</Text>
                        </View>
                        <View className="items-center flex-1 border-l border-[#E4E1D8]/60">
                          <Text className="text-[#607C64]/70 text-[9px] uppercase font-bold font-mono">Fiber</Text>
                          <Text className="text-[#7A9482] font-bold text-xs mt-0.5">{log.nutrition_analysis.fiber_g}g</Text>
                        </View>
                      </View>

                      {/* Ayurvedic breakdown details */}
                      <View className="space-y-1">
                        <Text className="text-[#607C64] text-xs font-bold font-serif">Ayurvedic Properties</Text>
                        <Text className="text-[#2E3A2F] text-xs">
                          Taste (Rasa): <Text className="text-[#7D9C83] capitalize font-bold font-serif">{log.nutrition_analysis.ayurvedic_taste}</Text>
                        </Text>
                        <Text className="text-slate-600 text-xs italic leading-relaxed mt-0.5 font-serif">
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
