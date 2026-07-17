import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { useExperienceStore } from '../store/useExperienceStore';
import { CALM_SPRING_CONFIG } from '../hooks/useMotion';

export default function ExperienceModeSelector() {
  const { mode, setMode } = useExperienceStore();
  const activeIndex = useSharedValue(mode === 'wellness' ? 0 : 1);

  useEffect(() => {
    activeIndex.value = mode === 'wellness' ? 0 : 1;
  }, [mode]);

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      left: withSpring(activeIndex.value === 0 ? '2%' : '50%', CALM_SPRING_CONFIG),
    };
  });

  return (
    <View className="px-6 py-2">
      <View className="h-11 w-full bg-[#051f18]/60 border border-emerald-900/20 rounded-full flex-row p-1 relative items-center">
        {/* Animated Background Pill */}
        <Animated.View 
          style={[styles.indicator, animatedIndicatorStyle]}
          className="bg-emerald-500 rounded-full absolute top-1 bottom-1 w-[48%]"
        />

        {/* Wellness Option */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMode('wellness')}
          className="flex-1 items-center justify-center h-full z-10"
        >
          <Text 
            className={`text-xs font-bold font-sans tracking-wide transition-colors duration-200 ${
              mode === 'wellness' ? 'text-emerald-950 font-black' : 'text-emerald-400/80'
            }`}
          >
            🌿 Wellness
          </Text>
        </TouchableOpacity>

        {/* Evidence Option */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setMode('evidence')}
          className="flex-1 items-center justify-center h-full z-10"
        >
          <Text 
            className={`text-xs font-bold font-sans tracking-wide transition-colors duration-200 ${
              mode === 'evidence' ? 'text-emerald-950 font-black' : 'text-emerald-400/80'
            }`}
          >
            📊 Evidence
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  }
});
