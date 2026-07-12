import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function ResetPasswordScreen() {
  return (
    <View className="flex-1 bg-emerald-950 justify-center items-center px-6">
      <View className="bg-emerald-900/40 border border-emerald-800/30 p-8 rounded-3xl shadow-2xl backdrop-blur-md w-full max-w-sm">
        <Text className="text-center text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-2">
          AquaAyur Security
        </Text>
        <Text className="text-center text-white text-2xl font-bold mb-4">
          Reset Password
        </Text>
        <Text className="text-emerald-300/80 text-center text-sm mb-8 leading-relaxed">
          Password recovery and resets are now unified within the main login flow. Please use the "Forgot your password?" option on the welcome screen.
        </Text>

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600"
        >
          <Text className="text-emerald-950 text-base font-bold">
            Back to Welcome Screen
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
