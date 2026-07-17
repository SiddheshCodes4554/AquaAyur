import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  Dimensions, 
  ActivityIndicator, 
  Animated, 
  Easing 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Vibration } from 'react-native';

// Mock Haptics using built-in React Native Vibration to resolve the missing expo-haptics dependency
const Haptics = {
  impactAsync: (style?: any) => {
    try {
      Vibration.vibrate(15);
    } catch (e) {}
  },
  notificationAsync: (type?: any) => {
    try {
      if (type === 'success') {
        Vibration.vibrate([0, 15, 40, 15]);
      } else {
        Vibration.vibrate([0, 40, 100, 40]);
      }
    } catch (e) {}
  },
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy'
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error'
  }
};
import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';
import { useLearnStore, Achievement, AVAILABLE_ACHIEVEMENTS } from '../../store/useLearnStore';
import { lessonsData, Lesson, LessonSlide } from '../../services/learnLessonsData';
import { useSensorStore } from '../../store/useSensorStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Simple static SVG illustrations matching the topics
function LessonIllustration({ type }: { type: string }) {
  switch (type) {
    case 'intro':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#047857" opacity="0.15" />
          <Path d="M50 20 C65 20 80 35 80 50 C80 65 65 80 50 80 C35 80 20 65 20 50 C20 35 35 20 50 20 Z" fill="none" stroke="#10b981" strokeWidth="2.5" />
          <Path d="M50 25 C45 35 45 45 50 55 C55 45 55 35 50 25 Z" fill="#34d399" />
          <Path d="M50 55 C45 65 45 75 50 85 C55 75 55 65 50 55 Z" fill="#6ee7b7" />
        </Svg>
      );
    case 'doshas':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="none" stroke="#1f372f" strokeWidth="1.5" />
          {/* Vata circle */}
          <Circle cx="50" cy="32" r="14" fill="#06b6d4" opacity="0.3" />
          {/* Pitta circle */}
          <Circle cx="64" cy="60" r="14" fill="#ea580c" opacity="0.3" />
          {/* Kapha circle */}
          <Circle cx="36" cy="60" r="14" fill="#14b8a6" opacity="0.3" />
          <Circle cx="50" cy="50" r="6" fill="#ffffff" />
        </Svg>
      );
    case 'vata':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#06b6d4" opacity="0.12" />
          {/* Wind gusts */}
          <Path d="M25 40 Q40 32 55 40 T85 40" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" />
          <Path d="M15 50 Q35 42 55 50 T75 50" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M30 60 Q45 52 60 60 T90 60" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
      );
    case 'pitta':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#ea580c" opacity="0.12" />
          {/* Fire flames */}
          <Path d="M50 15 C60 30 70 42 70 58 C70 70 60 80 50 80 C40 80 30 70 30 58 C30 42 40 30 50 15 Z" fill="#f97316" />
          <Path d="M50 35 C55 45 60 52 60 62 C60 70 55 75 50 75 C45 75 40 70 40 62 C40 52 45 45 50 35 Z" fill="#facc15" />
        </Svg>
      );
    case 'kapha':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#14b8a6" opacity="0.12" />
          {/* Steady mountain / water drop shape */}
          <Path d="M50 20 L80 75 L20 75 Z" fill="#0d9488" opacity="0.4" />
          <Path d="M50 35 L70 75 L30 75 Z" fill="#14b8a6" />
          <Circle cx="50" cy="72" r="16" fill="#0d9488" opacity="0.2" />
        </Svg>
      );
    case 'agni':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#fbbf24" opacity="0.12" />
          <Path d="M50 25 L62 55 L38 55 Z" fill="#fbbf24" />
          <Path d="M50 40 L58 65 L42 65 Z" fill="#f59e0b" />
          <Path d="M50 55 L54 75 L46 75 Z" fill="#ef4444" />
        </Svg>
      );
    case 'ojas':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#8b5cf6" opacity="0.12" />
          {/* Shield outline */}
          <Path d="M50 20 L80 30 V55 C80 70 65 82 50 85 C35 82 20 70 20 55 V30 L50 20 Z" fill="none" stroke="#a78bfa" strokeWidth="2.5" />
          <Path d="M50 28 L72 36 V53 C72 65 60 75 50 78 C40 75 28 65 28 53 V36 L50 28 Z" fill="#8b5cf6" opacity="0.3" />
        </Svg>
      );
    case 'dinacharya':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="none" stroke="#34d399" strokeWidth="1" strokeDasharray="3,3" />
          {/* Sun */}
          <Circle cx="50" cy="50" r="14" fill="#fbbf24" />
          {/* Solar rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <Line
              key={angle}
              x1="50"
              y1="22"
              x2="50"
              y2="10"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
        </Svg>
      );
    case 'ritucharya':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#10b981" opacity="0.15" />
          <Rect x="20" y="20" width="60" height="60" rx="10" fill="none" stroke="#34d399" strokeWidth="2" />
          {/* Grid splits */}
          <Line x1="50" y1="20" x2="50" y2="80" stroke="#34d399" strokeWidth="1" />
          <Line x1="20" y1="50" x2="80" y2="50" stroke="#34d399" strokeWidth="1" />
          {/* Seasons items */}
          <Circle cx="35" cy="35" r="4" fill="#fbbf24" /> {/* Summer sun */}
          <Path d="M60 35 L68 35" stroke="#38bdf8" strokeWidth="1.5" /> {/* Winter ice */}
        </Svg>
      );
    case 'sensors':
      return (
        <Svg width="110" height="110" viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="42" fill="#6366f1" opacity="0.12" />
          <Rect x="30" y="30" width="40" height="40" rx="6" fill="#1e1e2f" stroke="#6366f1" strokeWidth="2" />
          {/* Chip pins */}
          {[15, 25, 35].map((val) => (
            <G key={val}>
              <Line x1="20" y1={25 + val} x2="30" y2={25 + val} stroke="#6366f1" strokeWidth="2" />
              <Line x1="70" y1={25 + val} x2="80" y2={25 + val} stroke="#6366f1" strokeWidth="2" />
            </G>
          ))}
          <Circle cx="50" cy="50" r="8" fill="#4f46e5" />
        </Svg>
      );
    default:
      return null;
  }
}

export default function LearnScreen() {
  const { completedLessons, xp, dailyStreak, achievements, completeLesson, checkAndResetStreak, activeLessonId, setActiveLessonId } = useLearnStore();
  const liveData = useSensorStore(state => state.liveData);

  // Lesson overlay active state
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizState, setQuizState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showUnlockModal, setShowUnlockModal] = useState<Achievement | null>(null);

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkAndResetStreak();
  }, []);

  useEffect(() => {
    if (activeLessonId) {
      const matched = lessonsData.find(l => l.id === activeLessonId);
      if (matched) {
        handleStartLesson(matched);
      }
      setActiveLessonId(null);
    }
  }, [activeLessonId]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true })
    ]).start();
  };

  const handleStartLesson = (lesson: Lesson) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveLesson(lesson);
    setCurrentSlideIndex(0);
    setSelectedOption(null);
    setQuizState('idle');
  };

  const handleNextSlide = () => {
    if (!activeLesson) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Animate slide slide
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -SCREEN_WIDTH, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: SCREEN_WIDTH, duration: 0, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true })
    ]).start();

    setCurrentSlideIndex(prev => prev + 1);
  };

  const handleQuizAnswer = (optionIdx: number) => {
    if (!activeLesson || quizState === 'correct') return;

    setSelectedOption(optionIdx);
    if (optionIdx === activeLesson.quiz.correctIndex) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setQuizState('correct');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setQuizState('wrong');
      triggerShake();
    }
  };

  const handleFinishLesson = () => {
    if (!activeLesson) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const { unlocked } = completeLesson(activeLesson.id, activeLesson.xpReward);
    
    if (unlocked.length > 0) {
      setShowUnlockModal(unlocked[0]);
    }

    setActiveLesson(null);
  };

  // Helper to connect live metrics
  const getConnectedMetricValue = (type: 'hr' | 'temp' | 'steps' | 'general'): string => {
    if (!liveData) return 'Awaiting sensor stream...';
    switch (type) {
      case 'hr': return `${liveData.heartRate} bpm`;
      case 'temp': return `${liveData.temperature.toFixed(1)} °C`;
      case 'steps': return `${liveData.steps} steps`;
      default: return 'Sensors synchronized';
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }} edges={['top']}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        
        {/* Top Header Row */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#E4E1D8]">
          <View>
            <Text className="text-[#2E3A2F] text-base font-serif font-black">Learn Ayurveda</Text>
            <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">Foundations of Vitality</Text>
          </View>

          {/* Gamified stats */}
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1.5 rounded-xl">
              <Text className="text-[10px] mr-1">🔥</Text>
              <Text className="text-[#2E3A2F] font-black font-mono text-xs">{dailyStreak}d</Text>
            </View>
            <View className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1.5 rounded-xl">
              <Text className="text-[10px] mr-1">⭐</Text>
              <Text className="text-[#607C64] font-black font-mono text-xs">{xp} XP</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-6 py-5" showsVerticalScrollIndicator={false}>
          
          {/* Progress overview */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 flex-row justify-between items-center shadow-sm shadow-[#E4E1D8]/20">
            <View className="flex-1 mr-4">
              <Text className="text-[#2E3A2F] text-sm font-bold font-serif">Your Learning Path</Text>
              <Text className="text-slate-500 text-[10px] leading-relaxed mt-1">
                Unlock lessons to balance your dynamic elements. Complete all 10 to earn the Ayur Master trophy.
              </Text>
              <View className="flex-row items-center mt-3">
                <View className="flex-1 h-1.5 bg-[#F2EFE8] rounded-full overflow-hidden mr-2">
                  <View 
                    style={{ width: `${(completedLessons.length / lessonsData.length) * 100}%` }} 
                    className="h-full bg-[#7D9C83] rounded-full" 
                  />
                </View>
                <Text className="text-[#607C64] text-[10px] font-bold font-mono">
                  {completedLessons.length}/{lessonsData.length}
                </Text>
              </View>
            </View>
            <View className="bg-[#F2EFE8] border border-[#E4E1D8] p-3 rounded-full justify-center items-center">
              <Ionicons name="school" size={24} color="#607C64" />
            </View>
          </View>

          {/* DUOLINGO MAP PATH SYSTEM */}
          <View className="space-y-4 mb-8">
            <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono">Foundational Lessons</Text>
            
            {lessonsData.map((lesson, idx) => {
              const isCompleted = completedLessons.includes(lesson.id);
              // Unlock first lesson always, or subsequent ones if previous is completed
              const isUnlocked = idx === 0 || completedLessons.includes(lessonsData[idx - 1].id);

              return (
                <TouchableOpacity
                  key={lesson.id}
                  disabled={!isUnlocked}
                  onPress={() => handleStartLesson(lesson)}
                  className={`border p-4.5 rounded-2xl flex-row items-center active:bg-emerald-950/5 ${
                    isCompleted 
                      ? 'bg-[#F5F2EA] border-[#E4E1D8]' 
                      : isUnlocked 
                        ? 'bg-white border-[#E4E1D8]' 
                        : 'bg-[#F2EFE8]/40 border-[#E4E1D8]/40 opacity-40'
                  }`}
                >
                  {/* Circular Node Icon Indicator */}
                  <View 
                    style={{ backgroundColor: isUnlocked ? lesson.color + '10' : '#E4E1D810', borderColor: isUnlocked ? lesson.color : '#E4E1D8' }}
                    className="w-11 h-11 rounded-full border justify-center items-center mr-4"
                  >
                    <Ionicons 
                      name={isCompleted ? 'checkmark-circle' : (lesson.icon as any)} 
                      size={20} 
                      color={isCompleted ? '#607C64' : isUnlocked ? lesson.color : '#8C958E'} 
                    />
                  </View>

                  <View className="flex-1 mr-2">
                    <Text className={`text-xs font-serif font-black ${isUnlocked ? 'text-[#2E3A2F]' : 'text-slate-400'}`}>
                      {lesson.title}
                    </Text>
                    <Text className="text-slate-500 text-[10px] mt-0.5" numberOfLines={1}>
                      {lesson.subtitle}
                    </Text>
                  </View>

                  <View className="flex-row items-center gap-1.5 bg-[#F2EFE8] px-2 py-1.5 rounded-xl border border-[#E4E1D8]">
                    <Text className="text-[10px]">⭐</Text>
                    <Text className="text-[#607C64] font-bold font-mono text-[9px]">{lesson.xpReward}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ACHIEVEMENTS GRID */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl shadow-sm shadow-[#E4E1D8]/20">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-[#2E3A2F] text-sm font-bold font-serif">Achievements Unlocked</Text>
              <View className="bg-[#F2EFE8] border border-[#E4E1D8] px-2 py-0.5 rounded-full">
                <Text className="text-[#607C64] text-[8px] font-mono font-bold uppercase">{achievements.length} badges</Text>
              </View>
            </View>

            <View className="flex-row flex-wrap gap-3">
              {AVAILABLE_ACHIEVEMENTS.map((badge: { id: string; name: string; desc: string; icon: string }) => {
                const isUnlocked = achievements.some(a => a.id === badge.id);
                return (
                  <View 
                    key={badge.id}
                    className={`w-[47%] p-3.5 rounded-2xl border items-center ${
                      isUnlocked 
                        ? 'bg-[#F5F2EA] border-[#E4E1D8]' 
                        : 'bg-[#F8F6F0]/40 border-[#E4E1D8]/20 opacity-30'
                    }`}
                  >
                    <Ionicons 
                      name={badge.icon as any} 
                      size={24} 
                      color={isUnlocked ? '#607C64' : '#8C958E'} 
                      className="mb-1.5"
                    />
                    <Text className={`text-[10px] font-bold text-center ${isUnlocked ? 'text-[#2E3A2F]' : 'text-slate-400'}`}>{badge.name}</Text>
                    <Text className="text-slate-500 text-[7.5px] text-center mt-0.5 leading-normal">{badge.desc}</Text>
                  </View>
                );
              })}
            </View>
          </View>

        </ScrollView>

        {/* MODAL: INTERACTIVE LESSON FLOW */}
        {activeLesson && (
          <Modal visible={true} transparent={false} animationType="slide">
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
              <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1 px-6 py-4 justify-between">
                
                {/* Close & Progress Row */}
                <View className="flex-row items-center justify-between mb-4">
                  <TouchableOpacity
                    onPress={() => setActiveLesson(null)}
                    className="p-1 rounded-lg bg-[#F2EFE8] border border-[#E4E1D8]"
                  >
                    <Ionicons name="close" size={20} color="#607C64" />
                  </TouchableOpacity>

                  {/* Header Progress Bar */}
                  <View className="flex-1 mx-4 h-2 bg-[#E4E1D8] rounded-full overflow-hidden">
                    <View 
                      style={{ width: `${((currentSlideIndex) / (activeLesson.slides.length + 1)) * 100}%` }}
                      className="h-full bg-[#7D9C83] rounded-full"
                    />
                  </View>

                  <Text className="text-[#607C64] text-[10px] font-bold font-mono">
                    {currentSlideIndex + 1}/{activeLesson.slides.length + 1}
                  </Text>
                </View>

                {/* ANIMATED SLIDES CONTAINER */}
                {currentSlideIndex < activeLesson.slides.length ? (
                  // STANDARD LESSON CONTENT SLIDE
                  <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }} className="justify-center items-center py-6">
                    <LessonIllustration type={activeLesson.slides[currentSlideIndex].illustrationType} />
                    
                    <Text className="text-[#2E3A2F] text-xl font-serif font-black text-center mt-6 mb-3">
                      {activeLesson.slides[currentSlideIndex].title}
                    </Text>
                    
                    <Text className="text-slate-650 text-xs leading-relaxed text-center px-4 mb-6 font-serif">
                      {activeLesson.slides[currentSlideIndex].content}
                    </Text>

                    {/* Analogy bubble */}
                    {activeLesson.slides[currentSlideIndex].analogy && (
                      <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4.5 rounded-2xl w-full shadow-sm">
                        <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-1">
                          {activeLesson.slides[currentSlideIndex].analogyTitle || 'Analogy'}
                        </Text>
                        <Text className="text-slate-600 text-[11px] leading-relaxed italic">
                          "{activeLesson.slides[currentSlideIndex].analogy}"
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                ) : (
                  // INTERACTIVE DYNAMIC QUIZ CARD
                  <Animated.View 
                    style={{ flex: 1, transform: [{ translateX: shakeAnim }] }} 
                    className="justify-center py-6"
                  >
                    <View className="items-center mb-5">
                      <Ionicons name="help-circle-outline" size={48} color="#607C64" />
                      <Text className="text-[#2E3A2F] text-lg font-serif font-black text-center mt-3">
                        {activeLesson.quiz.question}
                      </Text>
                    </View>

                    {/* Options list */}
                    <View className="space-y-2.5 mb-5">
                      {activeLesson.quiz.options.map((option, idx) => {
                        const isSelected = selectedOption === idx;
                        const isCorrectOption = idx === activeLesson.quiz.correctIndex;
                        let optionStyle = 'bg-white border-[#E4E1D8]';
                        let textStyle = 'text-[#2E3A2F]';
                        
                        if (isSelected) {
                          if (quizState === 'correct') {
                            optionStyle = 'bg-emerald-500/5 border-emerald-500';
                            textStyle = 'text-emerald-700 font-bold';
                          } else if (quizState === 'wrong') {
                            optionStyle = 'bg-rose-500/5 border-rose-500';
                            textStyle = 'text-rose-700 font-bold';
                          }
                        }

                        return (
                          <TouchableOpacity
                            key={idx}
                            disabled={quizState === 'correct'}
                            onPress={() => handleQuizAnswer(idx)}
                            className={`border p-4 rounded-xl flex-row justify-between items-center ${optionStyle} mb-2 shadow-sm`}
                          >
                            <Text className={`text-xs flex-1 ${textStyle}`}>
                              {option}
                            </Text>
                            {isSelected && quizState === 'correct' && (
                              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                            )}
                            {isSelected && quizState === 'wrong' && (
                              <Ionicons name="close-circle" size={16} color="#ef4444" />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Quiz Feedback Explanation */}
                    {quizState === 'correct' && (
                      <View className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl mt-2">
                        <Text className="text-emerald-700 text-[9px] uppercase font-bold tracking-wider font-mono mb-1">
                          Correct Answer Explanation
                        </Text>
                        <Text className="text-slate-600 text-[11px] leading-relaxed">
                          {activeLesson.quiz.explanation}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                )}

                {/* Active Sensor Vitals Connection bar */}
                {currentSlideIndex < activeLesson.slides.length && (
                  <View className="bg-[#F5F2EA] border border-[#E4E1D8] px-4 py-3 rounded-2xl flex-row items-center justify-between mb-5 shadow-sm">
                    <View className="flex-1 mr-2">
                      <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">Vitals Synced Link</Text>
                      <Text className="text-slate-600 text-[9px] leading-normal mt-0.5">{activeLesson.vitalsConnection.desc}</Text>
                    </View>
                    <View className="bg-[#F2EFE8] border border-[#E4E1D8] px-2.5 py-1.5 rounded-xl">
                      <Text className="text-[#607C64] font-bold font-mono text-[9px] uppercase text-center">
                        {getConnectedMetricValue(activeLesson.vitalsConnection.metricType)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Bottom Control Action Button */}
                <View className="w-full">
                  {currentSlideIndex < activeLesson.slides.length ? (
                    <TouchableOpacity
                      onPress={handleNextSlide}
                      className="bg-[#7D9C83] py-3.5 rounded-2xl items-center shadow-sm active:bg-[#607C64]"
                    >
                      <Text className="text-white font-black text-xs uppercase tracking-wider">Next Slide</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      disabled={quizState !== 'correct'}
                      onPress={handleFinishLesson}
                      className={`py-3.5 rounded-2xl items-center ${
                        quizState === 'correct' 
                          ? 'bg-[#7D9C83] shadow-sm active:bg-[#607C64]' 
                          : 'bg-[#F2EFE8] border border-[#E4E1D8]'
                      }`}
                    >
                      <Text className={`font-black text-xs uppercase tracking-wider ${quizState === 'correct' ? 'text-white' : 'text-[#607C64]/40'}`}>
                        {quizState === 'correct' ? 'Finish Lesson (+30 XP)' : 'Select Correct Answer'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

              </LinearGradient>
            </SafeAreaView>
          </Modal>
        )}

        {/* MODAL: ACHIEVEMENT UNLOCKED POPUP */}
        {showUnlockModal && (
          <Modal visible={true} transparent={true} animationType="fade">
            <View className="flex-1 bg-black/60 justify-center items-center px-8">
              <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl items-center max-w-sm w-full relative overflow-hidden shadow-2xl">
                <View className="absolute right-0 top-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-lg pointer-events-none" />
                
                <Ionicons name="trophy" size={54} color="#fbbf24" className="mb-4" />
                
                <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono">Achievement Unlocked</Text>
                <Text className="text-[#2E3A2F] text-lg font-serif font-black text-center mt-1 mb-2">{showUnlockModal.name}</Text>
                <Text className="text-slate-600 text-xs text-center leading-relaxed mb-6">{showUnlockModal.desc}</Text>
                
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowUnlockModal(null);
                  }}
                  className="bg-[#7D9C83] py-3 px-6 rounded-xl items-center active:bg-[#607C64] w-full"
                >
                  <Text className="text-white font-black text-xs uppercase tracking-wider">Claim Badge</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

      </LinearGradient>
    </SafeAreaView>
  );
}
