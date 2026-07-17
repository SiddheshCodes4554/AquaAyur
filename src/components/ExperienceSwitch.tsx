import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, useWindowDimensions } from 'react-native';
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
    backgroundColor: '#0c1713',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#1e322a',
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
    backgroundColor: '#10b981',
    borderRadius: 19,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    fontFamily: 'System',
  },
  activeText: {
    color: '#042f1a',
  },
  inactiveText: {
    color: '#34d399',
    opacity: 0.75,
  },
});
