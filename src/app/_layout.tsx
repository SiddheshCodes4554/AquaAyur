import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { initDatabase } from '../services/database';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css'; // NativeWind Tailwind styles import

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { session, initialized, initializeAuth, profile } = useAuthStore();

  // 1. Initial setup for database and auth listeners
  useEffect(() => {
    initDatabase().catch(err => console.error('[RootLayout] Local database init failed:', err));
    initializeAuth();
    
    const { loadSavedSensorMode } = require('../services/sensorManager');
    loadSavedSensorMode().catch((err: any) => console.log('[SensorManager] Startup mode load failed:', err));
  }, []);

  // 2. Authentication and Onboarding routing control flow
  useEffect(() => {
    if (!initialized) return;

    const routeTimer = setTimeout(() => {
      if (!session) {
        router.replace('/(auth)/login');
      } else if (profile && !profile.dominant_dosha) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)');
        const { loadSavedSensorMode } = require('../services/sensorManager');
        loadSavedSensorMode().catch((err: any) => console.log('[SensorManager] Login mode load failed:', err));
      }
    }, 100);

    return () => clearTimeout(routeTimer);
  }, [session, initialized, profile?.dominant_dosha]);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)/onboarding" options={{ gestureEnabled: false, animation: 'slide_from_right' }} />
          <Stack.Screen name="(auth)/reset-password" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: 'fade' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
