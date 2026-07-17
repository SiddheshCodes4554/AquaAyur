import { DarkTheme, DefaultTheme, ThemeProvider, Stack, router, useSegments } from 'expo-router';
import { useColorScheme, View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { initDatabase } from '../services/database';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import '../global.css'; // NativeWind Tailwind styles import

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

if (!publishableKey) {
  console.warn('[Clerk] Publishable key is missing. Ensure EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is configured in your environment variables.');
}

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.error('[Clerk] SecureStore get item error:', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error('[Clerk] SecureStore save item error:', err);
    }
  },
};

function InitialLayout() {
  const { isLoaded, isSignedIn, userId, getToken, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const { profile, loading, initialized, setClerkSession, clearClerkSession } = useAuthStore();
  const segments = useSegments();

  // 1. Initial setup for database
  useEffect(() => {
    initDatabase().catch(err => console.error('[RootLayout] Local database init failed:', err));
    
    const { autoConnectLastPairedDevice } = require('../services/bleManager');
    autoConnectLastPairedDevice().catch((err: any) => console.log('[BLE] Startup autoconnect failed:', err));
  }, []);

  // 2. Sync Clerk auth state to Zustand store & Supabase
  useEffect(() => {
    if (!isLoaded) return;

    // Bind global signOut to Clerk's authentication signout action
    useAuthStore.setState({
      signOut: async () => {
        try {
          await clerkSignOut();
        } catch (err) {
          console.log('[RootLayout] SignOut error:', err);
        }
        clearClerkSession();
      }
    });

    if (isSignedIn && userId && user) {
      getToken({ template: 'supabase' })
        .then((token) => {
          setClerkSession({
            token,
            userId,
            email: user.primaryEmailAddress?.emailAddress || '',
            name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Yogi',
            photoUrl: user.imageUrl || null,
          });
        })
        .catch((err) => {
          console.warn(
            '\n=======================================================\n' +
            '[Clerk + Supabase Integration Warning]\n' +
            'No JWT Template named "supabase" was found in your Clerk dashboard.\n' +
            'Please follow these quick steps to set it up:\n' +
            '1. Go to your Clerk Dashboard (https://dashboard.clerk.com)\n' +
            '2. Select your application, then navigate to "JWT Templates" in the sidebar.\n' +
            '3. Click "New Template" and choose "Supabase".\n' +
            '4. Keep the template name as "supabase" and save it.\n' +
            '=======================================================\n'
          );
          
          // Fallback: Fetch standard Clerk token to allow login to proceed
          getToken().then((token) => {
            setClerkSession({
              token,
              userId,
              email: user.primaryEmailAddress?.emailAddress || '',
              name: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Yogi',
              photoUrl: user.imageUrl || null,
            });
          }).catch(tokenErr => console.error('[RootLayout] Fallback getToken failed:', tokenErr));
        });
    } else {
      clearClerkSession();
    }
  }, [isLoaded, isSignedIn, userId, user, clerkSignOut]);

  // 3. Routing Control flow
  useEffect(() => {
    if (!isLoaded || !initialized || loading) return;

    const routeTimer = setTimeout(() => {
      const inAuthGroup = segments[0] === '(auth)';
      const inTabsGroup = segments[0] === '(tabs)';

      if (!isSignedIn) {
        // Not logged in: force login screen unless they are reset password
        if (segments[0] !== '(auth)' || (segments[1] !== 'login' && segments[1] !== 'reset-password')) {
          router.replace('/(auth)/login');
        }
      } else {
        // Logged in
        if (!profile || !profile.dominant_dosha) {
          // Intake not complete: redirect to onboarding unless already there
          if (segments[1] !== 'onboarding') {
            router.replace('/(auth)/onboarding');
          }
        } else {
          // Intake complete: go to tabs, unless explicitly viewing onboarding (to redo assessment)
          if (inAuthGroup && segments[1] !== 'onboarding') {
            router.replace('/(tabs)');
          } else if (!inAuthGroup && !inTabsGroup) {
            router.replace('/(tabs)');
          }
        }
      }
    }, 100);

    return () => clearTimeout(routeTimer);
  }, [isLoaded, isSignedIn, initialized, loading, profile?.dominant_dosha, segments]);

  // Premium full screen loader during auth handshake
  if (!isLoaded || !initialized || (isSignedIn && loading)) {
    return (
      <View className="flex-1 bg-emerald-950 justify-center items-center">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/onboarding" options={{ gestureEnabled: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="(auth)/reset-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <ClerkLoaded>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <InitialLayout />
          </ThemeProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}
