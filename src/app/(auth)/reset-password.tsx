import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { authService } from '../../services/authService';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      setErrorMsg('Please enter both password fields.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await authService.updatePassword(password);
      setSuccessMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 3000);
    } catch (err: any) {
      console.error('[ResetPassword] Update failed:', err);
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-emerald-950"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6">
        <View className="flex-1 justify-center py-10">
          <View className="bg-emerald-900/40 border border-emerald-800/30 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
          
          <Text className="text-center text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-2">
            AquaAyur Security
          </Text>
          <Text className="text-center text-white text-3xl font-bold mb-8">
            Reset Password
          </Text>

          {errorMsg && (
            <View key="error-alert" className="bg-red-950/50 border border-red-900/50 p-4 rounded-xl mb-6 will-change-variable">
              <Text className="text-red-400 text-sm text-center">{errorMsg}</Text>
            </View>
          )}

          {successMsg && (
            <View key="success-alert" className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl mb-6 will-change-variable">
              <Text className="text-emerald-400 text-sm text-center">{successMsg}</Text>
            </View>
          )}

          <View className="mb-4">
            <Text className="text-emerald-300 text-sm font-semibold mb-2">New Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#065f46"
              autoCapitalize="none"
              className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          <View className="mb-8">
            <Text className="text-emerald-300 text-sm font-semibold mb-2">Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#065f46"
              autoCapitalize="none"
              className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          <TouchableOpacity
            onPress={handleReset}
            disabled={loading}
            className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600 mb-6"
          >
            {loading ? (
              <ActivityIndicator color="#022c22" />
            ) : (
              <Text className="text-emerald-950 text-base font-bold">
                Update Password
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            className="py-2"
          >
            <Text className="text-emerald-400 text-center text-sm">
              Back to Login
            </Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
