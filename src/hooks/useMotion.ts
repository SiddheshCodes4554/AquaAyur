import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';

// Spring configuration: calm, premium, Apple HIG style (high damping, no exaggerated overshoot)
export const CALM_SPRING_CONFIG = {
  damping: 18,
  stiffness: 120,
  mass: 1,
};

export function useSpringScale(active: boolean = false) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(active ? 0.96 : 1, CALM_SPRING_CONFIG);
  }, [active]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export function useFadeIn(duration: number = 500, delay: number = 0) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(0, { duration: delay }),
      withTiming(1, { duration, easing: Easing.out(Easing.ease) })
    );
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}

export function useSlideIn(direction: 'up' | 'down' | 'left' | 'right' = 'up', offset: number = 50) {
  const translate = useSharedValue(offset);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translate.value = withSpring(0, CALM_SPRING_CONFIG);
    opacity.value = withTiming(1, { duration: 400 });
  }, []);

  return useAnimatedStyle(() => {
    const transform = [];
    if (direction === 'up' || direction === 'down') {
      transform.push({ translateY: direction === 'up' ? translate.value : -translate.value });
    } else {
      transform.push({ translateX: direction === 'left' ? translate.value : -translate.value });
    }
    return {
      opacity: opacity.value,
      transform,
    };
  });
}

export function usePulse(minScale: number = 0.95, maxScale: number = 1.08, duration: number = 2000) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(maxScale, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(minScale, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export function useRotation(duration: number = 2500) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  return useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
}

export function useProgress(targetValue: number, duration: number = 800) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(targetValue, { duration, easing: Easing.out(Easing.ease) });
  }, [targetValue]);

  return useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
}
