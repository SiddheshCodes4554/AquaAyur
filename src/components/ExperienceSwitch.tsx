import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { useExperienceStore } from '../store/useExperienceStore';

export function ExperienceSwitch() {
  const { mode, setMode } = useExperienceStore();
  const { width } = useWindowDimensions();
  
  const containerWidth = width - 48; // 24px margins on each side
  const tabWidth = containerWidth / 2;
  
  const slideAnim = useRef(new Animated.Value(mode === 'wellness' ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: mode === 'wellness' ? 0 : 1,
      tension: 60,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [mode]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, tabWidth - 4],
  });

  return (
    <View style={[styles.container, { width: containerWidth }]}>
      <Animated.View
        style={[
          styles.activePill,
          {
            width: tabWidth - 4,
            transform: [{ translateX }],
          },
        ]}
      />
      <TouchableOpacity
        onPress={() => setMode('wellness')}
        style={styles.tab}
        activeOpacity={0.85}
      >
        <Text style={[styles.text, mode === 'wellness' ? styles.activeText : styles.inactiveText]}>
          🌿 Wellness View
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setMode('evidence')}
        style={styles.tab}
        activeOpacity={0.85}
      >
        <Text style={[styles.text, mode === 'evidence' ? styles.activeText : styles.inactiveText]}>
          📊 Evidence View
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 46,
    backgroundColor: '#F2EFE8',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#E4E1D8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    position: 'relative',
    alignSelf: 'center',
    marginVertical: 14,
  },
  activePill: {
    position: 'absolute',
    height: 38,
    backgroundColor: '#7D9C83',
    borderRadius: 19,
    shadowColor: '#607C64',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  text: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  activeText: {
    color: '#FFFFFF',
  },
  inactiveText: {
    color: '#607C64',
    opacity: 0.8,
  },
});
