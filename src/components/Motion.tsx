import React, { useEffect } from 'react';
import { Pressable, ViewProps, PressableProps } from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  Layout, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { CALM_SPRING_CONFIG } from '../hooks/useMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Motion = {
  // Entrances animation for cards (staggered index entrances)
  Card: React.memo(function MotionCard({ children, style, index = 0, ...props }: ViewProps & { index?: number }) {
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 90).springify().damping(CALM_SPRING_CONFIG.damping).stiffness(CALM_SPRING_CONFIG.stiffness)}
        layout={Layout.springify()}
        style={style}
        {...props}
      >
        {children}
      </Animated.View>
    );
  }),

  // Sliding sheet animation for modals/bottom sheets
  SlideUp: React.memo(function MotionSlideUp({ children, style, ...props }: ViewProps) {
    return (
      <Animated.View
        entering={FadeInUp.springify().damping(20).stiffness(130)}
        style={style}
        {...props}
      >
        {children}
      </Animated.View>
    );
  }),

  // Spring pressable button feedback
  Button: React.memo(function MotionButton({ children, style, onPress, ...props }: PressableProps & { style?: any }) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      'worklet';
      scale.value = withSpring(0.96, CALM_SPRING_CONFIG);
    };

    const handlePressOut = () => {
      'worklet';
      scale.value = withSpring(1, CALM_SPRING_CONFIG);
    };

    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[style, animatedStyle]}
        {...props}
      >
        {children}
      </AnimatedPressable>
    );
  }),

  // Heart rate pulse/radar circle breathing animation
  Pulse: React.memo(function MotionPulse({ children, style, min = 0.94, max = 1.08, speed = 1800, ...props }: ViewProps & { min?: number; max?: number; speed?: number }) {
    const scale = useSharedValue(1);

    useEffect(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(max, { duration: speed / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(min, { duration: speed / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, [min, max, speed]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }]
    }));

    return (
      <Animated.View style={[style, animatedStyle]} {...props}>
        {children}
      </Animated.View>
    );
  }),

  // Rotating loading orbit
  Loader: React.memo(function MotionLoader({ children, style, duration = 2000, ...props }: ViewProps & { duration?: number }) {
    const rotation = useSharedValue(0);

    useEffect(() => {
      rotation.value = withRepeat(
        withTiming(360, { duration, easing: Easing.linear }),
        -1,
        false
      );
    }, [duration]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${rotation.value}deg` }]
    }));

    return (
      <Animated.View style={[style, animatedStyle]} {...props}>
        {children}
      </Animated.View>
    );
  }),

  // Sliding laser line scanner for food logs
  Scanner: React.memo(function MotionScanner({ style, height = 200, duration = 2200, ...props }: ViewProps & { height?: number; duration?: number }) {
    const laserY = useSharedValue(0);

    useEffect(() => {
      laserY.value = withRepeat(
        withSequence(
          withTiming(height, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, [height, duration]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: laserY.value }]
    }));

    return (
      <Animated.View style={[style, animatedStyle]} {...props} />
    );
  })
};
