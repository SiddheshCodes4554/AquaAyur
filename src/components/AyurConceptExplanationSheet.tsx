import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { useLearnStore } from '../store/useLearnStore';
import { conceptExplanations, ConceptId } from '../services/conceptExplanations';

interface AyurConceptExplanationSheetProps {
  visible: boolean;
  onClose: () => void;
  conceptId: ConceptId | null;
}

// Simple matching SVGs inside the sheet
function ConceptIllustration({ type }: { type: string }) {
  switch (type) {
    case 'vata':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#06b6d4" opacity="0.15" />
          <Path d="M20 45 Q40 35 60 45 T90 45" fill="none" stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
          <Path d="M10 55 Q35 45 60 55 T80 55" fill="none" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" />
        </Svg>
      );
    case 'pitta':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#ea580c" opacity="0.15" />
          <Path d="M50 15 C60 30 70 42 70 58 C70 70 60 80 50 80 C40 80 30 70 30 58 C30 42 40 30 50 15 Z" fill="#f97316" />
          <Path d="M50 35 C55 45 60 52 60 62 C60 70 55 75 50 75 C45 75 40 70 40 62 C40 52 45 45 50 35 Z" fill="#facc15" />
        </Svg>
      );
    case 'kapha':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#14b8a6" opacity="0.15" />
          <Path d="M50 20 L80 75 L20 75 Z" fill="#14b8a6" />
        </Svg>
      );
    case 'agni':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#fbbf24" opacity="0.15" />
          <Path d="M50 25 L65 60 L35 60 Z" fill="#fbbf24" />
        </Svg>
      );
    case 'ojas':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#8b5cf6" opacity="0.15" />
          <Path d="M50 20 L80 30 V55 C80 70 65 82 50 85 C35 82 20 70 20 55 V30 L50 20 Z" fill="none" stroke="#a78bfa" strokeWidth="3" />
        </Svg>
      );
    case 'dinacharya':
      return (
        <Svg width="55" height="55" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#f59e0b" opacity="0.15" />
          <Circle cx="50" cy="50" r="14" fill="#f59e0b" />
        </Svg>
      );
    default:
      return null;
  }
}

export default function AyurConceptExplanationSheet({ visible, onClose, conceptId }: AyurConceptExplanationSheetProps) {
  const { setActiveLessonId } = useLearnStore();

  if (!conceptId) return null;
  const explanation = conceptExplanations[conceptId];
  if (!explanation) return null;

  const handleStartLesson = () => {
    setActiveLessonId(explanation.relatedLessonId);
    onClose();
    // Navigate to Learn tab using router
    router.push('/learn');
  };

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
            maxHeight: '82%', 
            backgroundColor: 'rgba(3, 20, 16, 0.98)',
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
          <View className="flex-row justify-between items-center mb-5 border-b border-[#1f372f]/45 pb-4">
            <View className="flex-row items-center flex-1 mr-4">
              <ConceptIllustration type={explanation.illustrationType} />
              <View className="ml-3.5 flex-1">
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-wider font-mono">Concept Guide</Text>
                <Text className="text-white text-lg font-serif font-bold mt-0.5">{explanation.title}</Text>
                <Text className="text-slate-400 text-[10px]">{explanation.subtitle}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-900/35 items-center justify-center active:bg-emerald-900/30"
            >
              <Ionicons name="close" size={18} color="#34d399" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Concept Details */}
          <ScrollView showsVerticalScrollIndicator={false} className="space-y-4" contentContainerStyle={{ paddingBottom: 24 }}>
            
            {/* 1. WHAT DOES IT MEAN */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4.5 rounded-2xl mb-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="book-outline" size={14} color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 text-xs font-serif font-bold">What does this mean?</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed font-sans">{explanation.whatItMeans}</Text>
            </View>

            {/* 2. WHY DETECTED */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4.5 rounded-2xl mb-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="eye-outline" size={14} color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 text-xs font-serif font-bold">Why did AquaAyur detect this?</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed font-sans">{explanation.whyDetected}</Text>
            </View>

            {/* 3. HOW ESTIMATED */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4.5 rounded-2xl mb-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="hardware-chip-outline" size={14} color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 text-xs font-serif font-bold">How is it estimated?</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed font-sans font-mono text-[11px] bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-950/30">
                {explanation.howEstimated}
              </Text>
            </View>

            {/* 4. WHAT TO DO */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4.5 rounded-2xl mb-3">
              <View className="flex-row items-center mb-2">
                <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" className="mr-2" />
                <Text className="text-emerald-400 text-xs font-serif font-bold">What should I do?</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed font-sans">{explanation.whatToDo}</Text>
            </View>

            {/* 5. IF IGNORED */}
            <View className="bg-[#051f18]/30 border border-emerald-900/20 p-4.5 rounded-2xl mb-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="warning-outline" size={14} color="#fbbf24" className="mr-2" />
                <Text className="text-amber-400 text-xs font-serif font-bold">What happens if ignored?</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed font-sans">{explanation.ifIgnored}</Text>
            </View>

            {/* 6. JUMP TO LESSON ACTION */}
            <TouchableOpacity
              onPress={handleStartLesson}
              className="bg-emerald-500 py-3.5 rounded-2xl items-center flex-row justify-center shadow shadow-emerald-500/15"
            >
              <Ionicons name="school-outline" size={16} color="#031410" className="mr-2" />
              <Text className="text-emerald-955 font-black text-xs uppercase tracking-wider">
                Start Lesson: {explanation.relatedLessonTitle}
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
