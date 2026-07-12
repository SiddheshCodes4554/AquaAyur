import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExplanationContext } from '../services/recommendationExplainer';

interface AyurExplanationSheetProps {
  visible: boolean;
  onClose: () => void;
  context: ExplanationContext | null;
}

export default function AyurExplanationSheet({ visible, onClose, context }: AyurExplanationSheetProps) {
  if (!context) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      {/* Semi-transparent Backdrop overlay */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={onClose} 
        className="flex-1 bg-black/60 justify-end"
      >
        {/* Bottom Sheet Body */}
        <TouchableOpacity 
          activeOpacity={1} 
          style={{ 
            borderTopLeftRadius: 28, 
            borderTopRightRadius: 28, 
            maxHeight: '75%', 
            backgroundColor: 'rgba(3, 20, 16, 0.96)',
            borderColor: 'rgba(16, 185, 129, 0.25)',
            borderTopWidth: 1.5,
            borderLeftWidth: 1,
            borderRightWidth: 1
          }} 
          className="w-full px-6 pt-5 pb-8 shadow-2xl"
        >
          {/* Top handle pill for aesthetics */}
          <View className="w-12 h-1 bg-emerald-900/40 rounded-full self-center mb-5" />

          {/* Header */}
          <View className="flex-row justify-between items-start mb-5">
            <View className="flex-1 pr-4">
              <Text className="text-emerald-450 text-[10px] uppercase font-bold tracking-wider">Ayurvedic Reasonings</Text>
              <Text className="text-white text-lg font-bold mt-0.5">{context.recommendationTitle}</Text>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-900/35 items-center justify-center active:bg-emerald-900/30"
            >
              <Ionicons name="close" size={18} color="#34d399" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Context Details */}
          <ScrollView showsVerticalScrollIndicator={false} className="space-y-5">
            
            {/* 1. SENSOR DATA & BIOMETRICS USED */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4 rounded-2xl">
              <Text className="text-emerald-400 text-xs font-bold flex-row items-center mb-3">
                <Ionicons name="hardware-chip-outline" size={14} style={{ marginRight: 6 }} /> IoT Biometrics Analyzed
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {context.sensorDataUsed.map((data, idx) => (
                  <View key={idx} className="bg-emerald-950/50 border border-emerald-900/30 px-3 py-1.5 rounded-xl">
                    <Text className="text-emerald-250 text-[10px] font-mono font-medium">{data}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 2. FOOD LOGGING snapshot */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4 rounded-2xl">
              <Text className="text-emerald-400 text-xs font-bold flex-row items-center mb-2.5">
                <Ionicons name="nutrition-outline" size={14} style={{ marginRight: 6 }} /> Nutritional Logs
              </Text>
              {context.foodLogs.map((log, idx) => (
                <Text key={idx} className="text-emerald-200/70 text-xs leading-relaxed font-sans">• {log}</Text>
              ))}
            </View>

            {/* 3. DOSHA & AGNI STATE */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4 rounded-2xl">
              <Text className="text-emerald-400 text-xs font-bold flex-row items-center mb-3">
                <Ionicons name="body-outline" size={14} style={{ marginRight: 6 }} /> Constitutional Context
              </Text>
              <View className="flex-row space-x-3">
                <View className="flex-1 bg-emerald-950/50 border border-emerald-900/30 p-3 rounded-xl items-center">
                  <Text className="text-emerald-450/60 text-[8px] uppercase font-bold tracking-wider">Active Dosha</Text>
                  <Text className="text-white text-xs font-bold text-center mt-1">{context.dosha}</Text>
                </View>
                <View className="flex-1 bg-emerald-950/50 border border-emerald-900/30 p-3 rounded-xl items-center">
                  <Text className="text-emerald-450/60 text-[8px] uppercase font-bold tracking-wider">Active Agni</Text>
                  <Text className="text-white text-xs font-bold text-center mt-1">{context.agni}</Text>
                </View>
              </View>
            </View>

            {/* 4. SCIENTIFIC REASONING */}
            <View className="bg-emerald-950/20 border border-emerald-900/20 p-4.5 rounded-2xl">
              <View className="flex-row items-center mb-2">
                <Ionicons name="pulse" size={15} color="#34d399" style={{ marginRight: 6 }} />
                <Text className="text-emerald-300 text-xs font-bold">Western Scientific Reasoning</Text>
              </View>
              <Text className="text-emerald-100/80 text-[11px] leading-relaxed font-sans">
                {context.scientificReasoning}
              </Text>
            </View>

            {/* 5. AYURVEDIC REASONING */}
            <View className="bg-emerald-950/20 border border-emerald-900/20 p-4.5 rounded-2xl">
              <View className="flex-row items-center mb-2">
                <Ionicons name="leaf-outline" size={15} color="#34d399" style={{ marginRight: 6 }} />
                <Text className="text-emerald-300 text-xs font-bold">Traditional Ayurvedic Reasoning</Text>
              </View>
              <Text className="text-emerald-100/80 text-[11px] leading-relaxed font-sans">
                {context.ayurvedicReasoning}
              </Text>
            </View>

          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
