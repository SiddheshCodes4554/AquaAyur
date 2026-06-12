import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { authService } from '../../services/authService';

type AuthMode = 'login' | 'signup' | 'forgot_password';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async () => {
    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (mode !== 'forgot_password' && !password) {
      setErrorMsg('Please enter your password.');
      return;
    }
    if (mode === 'signup' && !fullName) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signup') {
        await authService.signUp(email, password, fullName);
        setSuccessMsg('Account created successfully! Please check email or log in.');
        setMode('login');
      } else if (mode === 'login') {
        await authService.signIn(email, password);
      } else if (mode === 'forgot_password') {
        await authService.sendPasswordReset(email);
        setSuccessMsg('Password reset link sent to your email.');
      }
    } catch (err: any) {
      console.error('[Login] Authentication error:', err);
      setErrorMsg(err.message || 'An error occurred during authentication.');
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
          {/* Header Title */}
          <Text className="text-center text-emerald-400 font-semibold tracking-wider uppercase text-sm mb-2">
            AquaAyur
          </Text>
          <Text className="text-center text-white text-3xl font-bold mb-8">
            {mode === 'signup' ? 'Create Account' : mode === 'login' ? 'Welcome Back' : 'Reset Password'}
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

          {mode === 'signup' && (
            <View className="mb-4">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                placeholderTextColor="#065f46"
                autoCapitalize="words"
                className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
              />
            </View>
          )}

          <View className="mb-4">
            <Text className="text-emerald-300 text-sm font-semibold mb-2">Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              placeholderTextColor="#065f46"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-emerald-950 border border-emerald-800/40 rounded-xl px-4 py-3 text-white text-base"
            />
          </View>

          {mode !== 'forgot_password' && (
            <View className="mb-8">
              <Text className="text-emerald-300 text-sm font-semibold mb-2">Password</Text>
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
          )}

          <TouchableOpacity
            onPress={handleAuth}
            disabled={loading}
            className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow-lg active:bg-emerald-600 mb-6"
          >
            {loading ? (
              <ActivityIndicator color="#022c22" />
            ) : (
              <Text className="text-emerald-950 text-base font-bold capitalize">
                {mode === 'signup' ? 'Sign Up' : mode === 'login' ? 'Log In' : 'Send Reset Link'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Navigation toggles */}
          <View className="space-y-3">
            {mode === 'login' ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="py-1.5"
                >
                  <Text className="text-emerald-400 text-center text-sm">
                    Don't have an account? Sign Up
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setMode('forgot_password');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="py-1.5"
                >
                  <Text className="text-emerald-400/60 text-center text-xs">
                    Forgot your password?
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="py-2"
              >
                <Text className="text-emerald-400 text-center text-sm">
                  Back to Login
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>
  );
}
