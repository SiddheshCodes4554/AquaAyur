import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function OAuthCallbackScreen() {
  useEffect(() => {
    // Safety fallback redirection: if Clerk does not trigger the auth state change redirect 
    // within 1.5 seconds, we manually send the user back to the root router check.
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View className="flex-1 bg-emerald-950 justify-center items-center">
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}
