import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSignIn, useSignUp, useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'welcome' | 'login' | 'signup' | 'verify_email' | 'forgot_password' | 'reset_password_code';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login'); // Default directly to login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  
  // Google OAuth
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });

  // WebBrowser warm-up and cool-down for stable Android OAuth redirect sessions
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const handleOAuthLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const redirectUrl = Linking.createURL('/(tabs)', { scheme: 'ayurveda' });
      const { createdSessionId, setActive } = await startOAuthFlow({ redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error('[Clerk OAuth] Google Auth Error:', err);
      setErrorMsg(err.errors?.[0]?.message || err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };



  const handleCredentialsAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email && mode !== 'verify_email' && mode !== 'reset_password_code') {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        if (!isSignInLoaded) return;
        
        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === 'complete') {
          await setSignInActive({ session: result.createdSessionId });
        } else {
          setErrorMsg('Authentication incomplete. Please check credentials.');
        }

      } else if (mode === 'signup') {
        if (!isSignUpLoaded) return;
        if (!fullName) {
          setErrorMsg('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        await signUp.create({
          emailAddress: email,
          password,
          firstName,
          lastName,
        });

        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setMode('verify_email');
        setSuccessMsg('A 6-digit verification code has been sent to your email.');

      } else if (mode === 'verify_email') {
        if (!isSignUpLoaded) return;
        if (!code) {
          setErrorMsg('Please enter the verification code.');
          setLoading(false);
          return;
        }

        const result = await signUp.attemptEmailAddressVerification({ code });
        if (result.status === 'complete') {
          await setSignUpActive({ session: result.createdSessionId });
        } else {
          setErrorMsg('Email verification failed. Please try again.');
        }

      } else if (mode === 'forgot_password') {
        if (!isSignInLoaded) return;

        await signIn.create({
          strategy: 'reset_password_email_code',
          identifier: email,
        });

        setMode('reset_password_code');
        setSuccessMsg('Reset code sent to your email.');

      } else if (mode === 'reset_password_code') {
        if (!isSignInLoaded) return;
        if (!code || !newPassword) {
          setErrorMsg('Please enter the code and your new password.');
          setLoading(false);
          return;
        }

        const result = await signIn.attemptFirstFactor({
          strategy: 'reset_password_email_code',
          code,
          password: newPassword,
        });

        if (result.status === 'complete') {
          setSuccessMsg('Password updated successfully! Signing in...');
          await setSignInActive({ session: result.createdSessionId });
        } else {
          setErrorMsg('Failed to reset password. Please check the code.');
        }
      }
    } catch (err: any) {
      console.error('[Clerk Auth] Action Error:', err);
      setErrorMsg(err.errors?.[0]?.message || err.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const renderWelcomeScreen = () => (
    <View className="flex-1 justify-between py-12 px-6">
      {/* Botanical Mandala Element */}
      <View className="items-center justify-center pt-16">
        <View className="w-48 h-48 rounded-full border border-emerald-800/25 bg-[#111d19]/35 items-center justify-center relative overflow-hidden mb-8 shadow-2xl">
          <Ionicons name="leaf-outline" size={48} color="#10b981" />
        </View>
        
        <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest mb-2 font-mono">AquaAyur Sanctuary</Text>
        <Text className="text-white text-3xl font-serif font-black tracking-tight text-center leading-tight px-4">
          Reclaim Your Vitality
        </Text>
        <Text className="text-slate-300 text-xs text-center leading-relaxed px-6 mt-4">
          Discover your dynamic dosha balance, fuel your metabolic fire, and align with your natural circadian rhythm.
        </Text>
      </View>

      {/* Structured CTAs */}
      <View className="space-y-3.5 mb-6">
        <TouchableOpacity
          onPress={() => setMode('signup')}
          className="w-full bg-emerald-500 py-4 rounded-xl flex-row justify-center items-center active:bg-emerald-600 shadow"
        >
          <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Begin Consultation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode('login')}
          className="w-full bg-[#111d19] border border-[#1f372f] py-4 rounded-xl flex-row justify-center items-center active:bg-emerald-900/10"
        >
          <Text className="text-emerald-400 font-bold text-xs uppercase tracking-wider">Enter Sanctuary</Text>
        </TouchableOpacity>

        <View className="flex-row items-center justify-between my-4 px-2">
          <View className="flex-1 h-[1px] bg-emerald-950/65" />
          <Text className="text-emerald-500/40 text-[9px] px-3 font-mono tracking-wider">OR CONTINUE WITH</Text>
          <View className="flex-1 h-[1px] bg-emerald-950/65" />
        </View>

        <TouchableOpacity
          onPress={handleOAuthLogin}
          className="w-full bg-[#111d19] border border-[#1f372f] py-4 rounded-xl flex-row justify-center items-center active:bg-emerald-900/10"
        >
          <Ionicons name="logo-google" size={16} color="#10b981" style={{ marginRight: 8 }} />
          <Text className="text-white font-bold text-xs uppercase tracking-wider">Continue with Google</Text>
        </TouchableOpacity>


      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#091310]" edges={['top', 'bottom']}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        {mode === 'welcome' ? (
          renderWelcomeScreen()
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6" showsVerticalScrollIndicator={false}>
              
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => {
                  setMode('welcome');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="w-10 h-10 rounded-lg bg-[#111d19] border border-[#1f372f] justify-center items-center mb-10 active:bg-emerald-900/20"
              >
                <Ionicons name="arrow-back" size={18} color="#34d399" />
              </TouchableOpacity>

              <View className="flex-grow justify-center pb-20">
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-7 rounded-3xl shadow-xl">
                  
                  {/* Branded Title */}
                  <Text style={{ color: '#34d399' }} className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest mb-1.5 font-mono">
                    AquaAyur Sanctuary
                  </Text>
                  <Text style={{ color: '#ffffff' }} className="text-white text-2xl font-serif font-black mb-6">
                    {mode === 'signup' 
                      ? 'Begin Consultation' 
                      : mode === 'verify_email'
                      ? 'Verify Email'
                      : mode === 'login' 
                      ? 'Enter Sanctuary' 
                      : mode === 'forgot_password'
                      ? 'Reset Credentials'
                      : 'Submit Reset Code'}
                  </Text>

                  {errorMsg && (
                    <View className="bg-red-950/40 border border-red-900/40 p-4 rounded-xl mb-6">
                      <Text style={{ color: '#f87171' }} className="text-red-400 text-xs text-center font-sans font-medium">{errorMsg}</Text>
                    </View>
                  )}

                  {successMsg && (
                    <View className="bg-emerald-950/40 border border-emerald-900/40 p-4 rounded-xl mb-6">
                      <Text style={{ color: '#34d399' }} className="text-emerald-400 text-xs text-center font-sans font-medium">{successMsg}</Text>
                    </View>
                  )}

                  {/* Signup Details */}
                  {mode === 'signup' && (
                    <View className="mb-4">
                      <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">Full Name</Text>
                      <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="John Doe"
                        placeholderTextColor="#064e3b"
                        autoCapitalize="words"
                        style={{ color: '#ffffff' }}
                        className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                      />
                    </View>
                  )}

                  {mode !== 'verify_email' && mode !== 'reset_password_code' && (
                    <View className="mb-4">
                      <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">Email Address</Text>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="john@example.com"
                        placeholderTextColor="#064e3b"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        style={{ color: '#ffffff' }}
                        className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                      />
                    </View>
                  )}

                  {/* Verification Email */}
                  {mode === 'verify_email' && (
                    <View className="mb-6">
                      <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">Verification Code</Text>
                      <TextInput
                        value={code}
                        onChangeText={setCode}
                        placeholder="123456"
                        placeholderTextColor="#064e3b"
                        keyboardType="number-pad"
                        maxLength={6}
                        style={{ color: '#ffffff' }}
                        className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-14 text-white text-center text-xl font-bold tracking-widest"
                      />
                    </View>
                  )}

                  {/* Reset Password */}
                  {mode === 'reset_password_code' && (
                    <>
                      <View className="mb-4">
                        <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">Reset Code</Text>
                        <TextInput
                          value={code}
                          onChangeText={setCode}
                          placeholder="123456"
                          placeholderTextColor="#064e3b"
                          keyboardType="number-pad"
                          maxLength={6}
                          style={{ color: '#ffffff' }}
                          className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-center text-sm font-bold tracking-wider"
                        />
                      </View>
                      <View className="mb-6">
                        <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">New Password</Text>
                        <TextInput
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry
                          placeholder="••••••••"
                          placeholderTextColor="#064e3b"
                          autoCapitalize="none"
                          style={{ color: '#ffffff' }}
                          className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                        />
                      </View>
                    </>
                  )}

                  {mode !== 'forgot_password' && mode !== 'verify_email' && mode !== 'reset_password_code' && (
                    <View className="mb-6">
                      <Text style={{ color: '#6ee7b7' }} className="text-emerald-300 text-xs font-semibold mb-2">Password</Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="••••••••"
                        placeholderTextColor="#064e3b"
                        autoCapitalize="none"
                        style={{ color: '#ffffff' }}
                        className="bg-[#172722] border border-[#1f372f] rounded-xl px-4 h-12 text-white text-sm"
                      />
                    </View>
                  )}

                  {/* Google OAuth Login Button */}
                  {mode === 'login' && (
                    <TouchableOpacity
                      onPress={handleOAuthLogin}
                      disabled={loading}
                      className="bg-[#111d19] border border-[#1f372f] rounded-xl py-4 flex-row justify-center items-center active:bg-emerald-900/10 mb-4"
                    >
                      <Ionicons name="logo-google" size={16} color="#10b981" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#ffffff' }} className="text-white font-bold text-xs uppercase tracking-wider">
                        Continue with Google
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Standard Form Actions */}
                  <TouchableOpacity
                    onPress={handleCredentialsAuth}
                    disabled={loading}
                    className="bg-emerald-500 rounded-xl py-4 flex-row justify-center items-center shadow active:bg-emerald-600 mb-6"
                  >
                    {loading ? (
                      <ActivityIndicator color="#091310" />
                    ) : (
                      <Text style={{ color: '#022c22' }} className="text-emerald-950 font-black text-xs uppercase tracking-wider">
                        {mode === 'signup' 
                          ? 'Register Profile' 
                          : mode === 'verify_email'
                          ? 'Confirm Code'
                          : mode === 'login' 
                          ? 'Enter Sanctuary' 
                          : mode === 'forgot_password'
                          ? 'Request Code'
                          : 'Update Password'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Alternative Switch State triggers */}
                  <View className="space-y-3.5">
                    {mode === 'login' ? (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            setMode('signup');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="py-1"
                        >
                          <Text style={{ color: '#34d399' }} className="text-emerald-400 text-center text-xs font-semibold">
                            Create a new account
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setMode('forgot_password');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className="py-1"
                        >
                          <Text style={{ color: '#10b981', opacity: 0.6 }} className="text-emerald-500/60 text-center text-[10px] font-medium">
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
                        className="py-1"
                      >
                        <Text style={{ color: '#34d399' }} className="text-emerald-400 text-center text-xs font-semibold">
                          Back to Login
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}
