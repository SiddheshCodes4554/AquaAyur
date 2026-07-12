import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Animated, 
  Easing 
} from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useBLEStore } from '../../store/useBLEStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { 
  startScanning, 
  stopScanning, 
  connectToDevice, 
  disconnectDevice, 
  sendControlCommand, 
  autoConnectLastPairedDevice, 
  SERVICE_UUID 
} from '../../services/bleManager';
import { switchSensorMode } from '../../services/sensorManager';

export default function DeviceScreen() {
  const { scannedDevices, connectedDevice, errorMsg } = useBLEStore();
  const { status, dataSource, liveData } = useSensorStore();
  const [showOtherDevices, setShowOtherDevices] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<{ mac_address: string, device_name: string } | null>(null);
  const [loadingPairing, setLoadingPairing] = useState(false);

  // Animations Setup
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.95)).current;
  const signalAnim = useRef(new Animated.Value(0)).current;

  // Concentric slow rotating ring animation
  useEffect(() => {
    let rotationLoop: Animated.CompositeAnimation | null = null;
    if (status === 'scanning' || status === 'connecting') {
      rotationLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );
      rotationLoop.start();
    } else {
      rotateAnim.setValue(0);
    }
    return () => rotationLoop?.stop();
  }, [status]);

  // Breathing pulse animation
  useEffect(() => {
    let breathingLoop: Animated.CompositeAnimation | null = null;
    if (status === 'connected' || status === 'scanning') {
      breathingLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      breathingLoop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => breathingLoop?.stop();
  }, [status]);

  // Signal bars loader animation during scan
  useEffect(() => {
    let signalLoop: Animated.CompositeAnimation | null = null;
    if (status === 'scanning') {
      signalLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(signalAnim, { toValue: 4, duration: 1500, useNativeDriver: false }),
          Animated.timing(signalAnim, { toValue: 0, duration: 0, useNativeDriver: false })
        ])
      );
      signalLoop.start();
    } else {
      signalAnim.setValue(status === 'connected' ? 4 : 0);
    }
    return () => signalLoop?.stop();
  }, [status]);

  const fetchPairedDevice = async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    setLoadingPairing(true);
    try {
      const { data, error } = await supabase
        .from('pairings')
        .select('*, devices(*)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!error && data && data.devices) {
        setPairedDevice({
          mac_address: data.devices.mac_address,
          device_name: data.devices.device_name
        });
      } else {
        setPairedDevice(null);
      }
    } catch (e) {
      console.warn('[Device] Error fetching pairing record:', e);
    } finally {
      setLoadingPairing(false);
    }
  };

  useEffect(() => {
    if (dataSource === 'physical') {
      fetchPairedDevice();
    }
  }, [connectedDevice, dataSource]);

  const isRecommended = (device: any) => {
    if (!device) return false;
    const name = device.name ? device.name.toLowerCase() : '';
    const hasMatchedName = name.includes('ayur') || 
                           name.includes('aqua') || 
                           name.includes('esp32') || 
                           name.includes('wearable') || 
                           name.includes('sensor');
    const hasMatchedService = device.serviceUUIDs && device.serviceUUIDs.includes(SERVICE_UUID);
    return hasMatchedName || hasMatchedService;
  };

  const recommendedDevices = scannedDevices.filter(d => isRecommended(d));
  const otherDevices = scannedDevices.filter(d => !isRecommended(d));

  const handleScanToggle = () => {
    if (status === 'scanning') {
      stopScanning();
    } else {
      startScanning().catch(err => console.error('[Device] Scan failed:', err));
    }
  };

  const testHapticVibration = async () => {
    await sendControlCommand(1);
  };

  const getStatusDetails = () => {
    switch (status) {
      case 'connected': return { label: 'Connected', text: 'text-emerald-400', dot: 'bg-emerald-400 shadow-emerald-400/50' };
      case 'connecting': return { label: 'Connecting', text: 'text-amber-400', dot: 'bg-amber-400 shadow-amber-400/50' };
      case 'scanning': return { label: 'Scanning', text: 'text-sky-400', dot: 'bg-sky-400 shadow-sky-400/50' };
      default: return { label: 'Disconnected', text: 'text-rose-500', dot: 'bg-rose-500' };
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#091310' }} edges={['top']}>
      <LinearGradient colors={['#091310', '#111d19']} className="flex-1">
        
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#1f372f]">
          <View>
            <Text className="text-white text-base font-serif font-black">Sensors & Devices</Text>
            <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono">Biometric Wearable Hardware</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="px-6 py-5" showsVerticalScrollIndicator={false}>
          
          {errorMsg && (
            <View className="bg-rose-950/40 border border-rose-900/40 p-4 rounded-xl mb-6">
              <Text className="text-rose-400 text-xs text-center font-sans font-medium">{errorMsg}</Text>
            </View>
          )}

          {/* TELEMETRY DATA SOURCE toggle */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl mb-6">
            <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mb-3">Telemetry Data Source</Text>
            <View className="flex-row space-x-2 bg-[#172722]/50 p-1 rounded-xl border border-[#1f372f]">
              <TouchableOpacity
                onPress={() => switchSensorMode('physical')}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  dataSource === 'physical' ? 'bg-emerald-500 border border-emerald-400/20' : ''
                }`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${dataSource === 'physical' ? 'text-emerald-955' : 'text-emerald-400/60'}`}>
                  Physical Band
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => switchSensorMode('simulator')}
                className={`flex-1 py-2.5 rounded-lg items-center ${
                  dataSource === 'simulator' ? 'bg-emerald-500 border border-emerald-400/20' : ''
                }`}
              >
                <Text className={`text-[10px] font-black uppercase tracking-wider ${dataSource === 'simulator' ? 'text-emerald-955' : 'text-emerald-400/60'}`}>
                  Simulator Mode
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* APPLE WATCH STYLE BLE PAIRING HUB CONTAINER */}
          <View className="bg-[#111d19]/45 border border-[#1f372f] p-6 rounded-3xl mb-6 items-center relative overflow-hidden">
            <View className="w-full flex-row justify-between items-center mb-6">
              <Text className="text-white text-xs font-bold font-serif">Connection Hub</Text>
              <View className="flex-row items-center bg-[#172722]/80 border border-[#1f372f]/60 px-3 py-1 rounded-full">
                <View className={`w-2 h-2 rounded-full mr-2 ${getStatusDetails().dot}`} />
                <Text className={`text-[9px] font-bold uppercase font-mono tracking-widest ${getStatusDetails().text}`}>
                  {getStatusDetails().label}
                </Text>
              </View>
            </View>

            {/* Apple Watch style radar rings */}
            <View className="h-48 justify-center items-center relative mb-6 w-full">
              {/* Outer pulsing ring */}
              <Animated.View 
                style={{
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({ inputRange: [0.95, 1.12], outputRange: [0.12, 0.02] })
                }}
                className="w-40 h-40 rounded-full border-2 border-emerald-500 absolute"
              />
              {/* Inner pulsing ring */}
              <Animated.View 
                style={{
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({ inputRange: [0.95, 1.12], outputRange: [0.25, 0.08] })
                }}
                className="w-28 h-28 rounded-full border border-emerald-500 absolute"
              />

              {/* Rotating particle orbit ring */}
              <Animated.View 
                style={{ transform: [{ rotate: spin }] }} 
                className="w-32 h-32 absolute items-center justify-between"
              >
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400" />
                <View className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />
              </Animated.View>

              {/* Central Core Emblem */}
              <View className="w-18 h-18 rounded-full bg-[#172722] border border-[#1f372f] justify-center items-center shadow-xl shadow-black/45 z-10">
                <Ionicons 
                  name={dataSource === 'simulator' ? "hardware-chip" : "bluetooth"} 
                  size={26} 
                  color={status === 'connected' ? '#34d399' : '#047857'} 
                />
              </View>
            </View>

            {/* Device Stats (Signal, Battery, Firmware) */}
            {status === 'connected' && (
              <View className="w-full border-t border-[#1f372f]/45 pt-5 mb-5 space-y-3.5">
                
                {/* Signal Strength (RSSI) & Battery */}
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1 mr-3">
                    <Ionicons name="wifi-outline" size={14} color="#34d399" style={{ marginRight: 6 }} />
                    <Text className="text-slate-350 text-[10px] mr-2">Signal Strength</Text>
                    {/* Visual Signal segments */}
                    <View className="flex-row items-end space-x-0.5 h-3">
                      {[1, 2, 3, 4].map((bar) => (
                        <View 
                          key={bar} 
                          className={`w-0.75 rounded-t-sm ${
                            bar <= 4 ? 'bg-emerald-500' : 'bg-[#1f372f]'
                          }`}
                          style={{ height: bar * 3 }}
                        />
                      ))}
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <Ionicons name="battery-charging" size={16} color="#10b981" style={{ marginRight: 6 }} />
                    <Text className="text-slate-300 text-[10px] font-bold font-mono">
                      {liveData?.battery || 85}%
                    </Text>
                  </View>
                </View>

                {/* Firmware and Node Info */}
                <View className="flex-row justify-between items-center pt-2 border-t border-[#1f372f]/10">
                  <View>
                    <Text className="text-white text-[11px] font-bold">
                      {dataSource === 'simulator' ? 'Virtual AyurWearable' : (connectedDevice?.name || 'AquaAyur Band-V1')}
                    </Text>
                    <Text className="text-emerald-400/40 text-[9px] font-mono mt-0.5">
                      Firmware: v1.4.2 | MAC: {dataSource === 'simulator' ? '00:1A:7D:DA:71:11' : (connectedDevice?.id || 'ESP32-Aqua-AYUR')}
                    </Text>
                  </View>
                  <View className="bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded">
                    <Text className="text-emerald-400 text-[8px] font-bold uppercase font-mono">Secure</Text>
                  </View>
                </View>

                {/* Hardware Health Status Checks */}
                <View className="bg-[#172722]/30 border border-[#1f372f]/40 p-3.5 rounded-2xl mt-2.5">
                  <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono mb-2">Hardware Health Check</Text>
                  
                  <View className="space-y-1.5">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-300 text-[10px]">PPG Optical Heart Sensor</Text>
                      <Text className="text-emerald-400 text-[9px] font-bold uppercase">Optimal</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-300 text-[10px]">Core Thermistor Calibration</Text>
                      <Text className="text-emerald-400 text-[9px] font-bold uppercase">Optimal</Text>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-slate-300 text-[10px]">Internal IMU Accelometer</Text>
                      <Text className="text-emerald-400 text-[9px] font-bold uppercase">Active</Text>
                    </View>
                  </View>
                </View>

              </View>
            )}

            {/* Actions Panel */}
            <View className="w-full">
              {dataSource === 'simulator' ? (
                <View className="space-y-2.5 w-full">
                  <TouchableOpacity
                    onPress={() => router.push('/(tabs)/simulator')}
                    className="bg-emerald-500 rounded-2xl py-3.5 w-full flex-row justify-center items-center shadow shadow-emerald-500/20 active:bg-emerald-600"
                  >
                    <Ionicons name="options-outline" size={15} color="#022c22" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Configure Telemetry</Text>
                  </TouchableOpacity>

                  {status === 'connected' && (
                    <TouchableOpacity
                      onPress={disconnectDevice}
                      className="bg-red-500/15 border border-red-500/35 rounded-2xl py-3 items-center active:bg-red-500/25"
                    >
                      <Text className="text-red-400 font-bold text-xs">Disconnect Simulator</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View className="w-full">
                  {status === 'connected' ? (
                    <TouchableOpacity
                      onPress={disconnectDevice}
                      className="bg-red-500/15 border border-red-500/35 rounded-2xl py-3.5 items-center active:bg-red-500/25 w-full"
                    >
                      <Text className="text-red-400 font-black text-xs uppercase tracking-wider">Disconnect Bluetooth</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={handleScanToggle}
                      className="bg-emerald-500 rounded-2xl py-3.5 w-full flex-row justify-center items-center shadow shadow-emerald-500/20 active:bg-emerald-600"
                    >
                      {status === 'scanning' ? (
                        <>
                          <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                          <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Stop Scanning</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="search" size={14} color="#022c22" style={{ marginRight: 6 }} />
                          <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Scan for Sensors</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

          </View>

          {/* REALTIME SENSOR BIOMETRICS PREVIEW HUD */}
          {status === 'connected' && (
            <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl mb-6">
              <View className="flex-row justify-between items-center mb-4 border-b border-emerald-950 pb-3">
                <View className="flex-row items-center">
                  <Ionicons name="stats-chart" size={16} color="#34d399" />
                  <Text className="text-white text-sm font-serif font-black ml-2">Live Biofeedback HUD</Text>
                </View>
                <View className="bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <Text className="text-emerald-400 text-[8px] font-mono uppercase">1 Hz stream</Text>
                </View>
              </View>

              <View className="grid grid-cols-2 gap-3.5 flex-row flex-wrap">
                {/* Heart Rate */}
                <View className="w-[47%] bg-[#172722]/50 border border-[#1f372f] p-3.5 rounded-2xl">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="heart" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                    <Text className="text-slate-350 text-[10px]">Pulse Rate</Text>
                  </View>
                  <Text className="text-white text-base font-bold font-mono">
                    {liveData?.heartRate || 72} <Text className="text-[10px] text-slate-400 font-sans">bpm</Text>
                  </Text>
                </View>

                {/* Skin Temperature */}
                <View className="w-[47%] bg-[#172722]/50 border border-[#1f372f] p-3.5 rounded-2xl">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="thermometer" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                    <Text className="text-slate-350 text-[10px]">Skin Temp</Text>
                  </View>
                  <Text className="text-white text-base font-bold font-mono">
                    {liveData?.temperature || 36.5} <Text className="text-[10px] text-slate-400 font-sans">°C</Text>
                  </Text>
                </View>

                {/* Steps count */}
                <View className="w-[47%] bg-[#172722]/50 border border-[#1f372f] p-3.5 rounded-2xl">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="footsteps" size={14} color="#10b981" style={{ marginRight: 6 }} />
                    <Text className="text-slate-350 text-[10px]">Daily Steps</Text>
                  </View>
                  <Text className="text-white text-base font-bold font-mono">
                    {liveData?.steps || 1200} <Text className="text-[10px] text-slate-400 font-sans">steps</Text>
                  </Text>
                </View>

                {/* Stress score */}
                <View className="w-[47%] bg-[#172722]/50 border border-[#1f372f] p-3.5 rounded-2xl">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="pulse" size={14} color="#a78bfa" style={{ marginRight: 6 }} />
                    <Text className="text-slate-350 text-[10px]">Stress Index</Text>
                  </View>
                  <Text className="text-white text-base font-bold font-mono">
                    {liveData?.stress || 35} <Text className="text-[10px] text-slate-400 font-sans">/100</Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* DIAGNOSTIC COMMAND BOARD FOR ESP32 ACTUATORS */}
          {status === 'connected' && dataSource === 'physical' && (
            <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl mb-6">
              <View className="flex-row items-center mb-3">
                <Ionicons name="build-outline" size={16} color="#34d399" />
                <Text className="text-white text-sm font-serif font-black ml-2">Diagnostic Tools</Text>
              </View>
              <Text className="text-slate-300 text-xs leading-relaxed mb-4">
                Trigger local hardware test commands directly to the paired band device to audit haptic actuator responses.
              </Text>
              <TouchableOpacity
                onPress={testHapticVibration}
                className="bg-emerald-500 rounded-2xl py-3 w-full flex-row justify-center items-center active:bg-emerald-600"
              >
                <Ionicons name="pulse" size={15} color="#022c22" style={{ marginRight: 6 }} />
                <Text className="text-emerald-950 font-bold text-xs uppercase tracking-wider">Trigger Haptic Test</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PHYSICAL PAIRINGS SEARCH LIST (WHEN DISCONNECTED) */}
          {dataSource === 'physical' && !connectedDevice && (
            <View className="space-y-6">
              {pairedDevice && (
                <View className="mb-2">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="link-outline" size={15} color="#34d399" style={{ marginRight: 6 }} />
                    <Text className="text-white text-sm font-bold font-serif">Previously Paired Device</Text>
                  </View>
                  <View className="bg-[#111d19]/45 border border-[#1f372f] p-4.5 rounded-2xl flex-row justify-between items-center">
                    <View>
                      <Text className="text-white text-xs font-bold">{pairedDevice.device_name}</Text>
                      <Text className="text-emerald-400/40 text-[9px] font-mono mt-0.5">{pairedDevice.mac_address}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => autoConnectLastPairedDevice().catch((e: any) => console.log(e))}
                      disabled={status === 'connecting' || status === 'scanning'}
                      className="bg-emerald-500/10 border border-emerald-500/35 px-3 py-2 rounded-xl flex-row items-center active:bg-emerald-500/20"
                    >
                      {status === 'connecting' ? (
                        <ActivityIndicator size="small" color="#34d399" />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={13} color="#34d399" style={{ marginRight: 4 }} />
                          <Text className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">Link</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* RECOMMENDED BLUETOOTH DEVICES */}
              <View>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="sparkles" size={15} color="#34d399" style={{ marginRight: 6 }} />
                  <Text className="text-white text-sm font-bold font-serif">Recommended Sensors ({recommendedDevices.length})</Text>
                </View>

                {recommendedDevices.length === 0 ? (
                  <View className="bg-[#111d19]/45 border border-dashed border-[#1f372f]/50 p-8 rounded-2xl justify-center items-center">
                    <Ionicons name="bluetooth" size={24} color="#047857" className="mb-2" />
                    <Text className="text-emerald-400/60 text-xs text-center font-sans">
                      {status === 'scanning' 
                        ? 'Scanning for compatible AquaAyur wearables...' 
                        : 'No recommended sensors nearby. Tap Scan for Sensors above.'}
                    </Text>
                  </View>
                ) : (
                  <View className="space-y-2.5">
                    {recommendedDevices.map((device) => (
                      <TouchableOpacity
                        key={device.id}
                        onPress={() => connectToDevice(device)}
                        className="bg-[#111d19]/45 border border-emerald-500/30 p-4 rounded-xl flex-row justify-between items-center active:bg-emerald-950"
                      >
                        <View className="flex-1 mr-3">
                          <View className="flex-row items-center">
                            <Text className="text-white text-xs font-bold mr-2">{device.name || 'AquaAyur Sensor'}</Text>
                            <View className="bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                              <Text className="text-emerald-300 text-[8px] font-bold uppercase font-mono">Match</Text>
                            </View>
                          </View>
                          <Text className="text-emerald-400/50 text-[10px] font-mono mt-1">{device.id}</Text>
                        </View>
                        <View className="flex-row items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/35 px-2.5 py-1.5 rounded-xl">
                          <Text className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">Connect</Text>
                          <Ionicons name="chevron-forward" size={10} color="#34d399" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* COLLAPSIBLE OTHER BLUETOOTH DEVICES */}
              {otherDevices.length > 0 && (
                <View>
                  <TouchableOpacity
                    onPress={() => setShowOtherDevices(!showOtherDevices)}
                    className="flex-row justify-between items-center bg-[#111d19]/45 border border-[#1f372f] px-4 py-3 rounded-2xl active:bg-[#172722]"
                  >
                    <View className="flex-row items-center">
                      <Ionicons name="radio" size={16} color="#6b7280" style={{ marginRight: 6 }} />
                      <Text className="text-emerald-300/80 text-xs font-bold font-sans">
                        Other Bluetooth Devices ({otherDevices.length})
                      </Text>
                    </View>
                    <Ionicons 
                      name={showOtherDevices ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      color="#6b7280" 
                    />
                  </TouchableOpacity>

                  {showOtherDevices && (
                    <View className="space-y-2 mt-2">
                      {otherDevices.map((device) => (
                        <TouchableOpacity
                          key={device.id}
                          onPress={() => connectToDevice(device)}
                          className="bg-[#111d19]/45 border border-[#1f372f]/40 p-4 rounded-xl flex-row justify-between items-center active:bg-emerald-950"
                        >
                          <View className="flex-1 mr-3">
                            <Text className="text-white/70 text-xs">{device.name || 'Unknown Device'}</Text>
                            <Text className="text-emerald-500/35 text-[9px] font-mono mt-0.5">{device.id}</Text>
                          </View>
                          <View className="flex-row items-center bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                            <Text className="text-emerald-400/70 text-[9px] font-semibold uppercase tracking-wider">Pair</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* DISCOVERY TROUBLESHOOTING HELP */}
              <View className="bg-[#111d19]/45 border border-[#1f372f] p-5 rounded-3xl">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="help-circle-outline" size={16} color="#34d399" />
                  <Text className="text-white font-bold text-xs ml-2 font-serif">Discovery Help</Text>
                </View>
                <View className="space-y-2.5">
                  <View className="flex-row items-start">
                    <Ionicons name="checkmark-circle-outline" size={13} color="#34d399" className="mt-0.5 mr-2" />
                    <Text className="text-slate-350 text-[9px] leading-normal flex-1 font-sans">
                      <Text className="font-bold text-white">Location GPS Required:</Text> Ensure GPS location is active on your device. OS models require location permissions to capture Bluetooth BLE advertisement packets.
                    </Text>
                  </View>
                  <View className="flex-row items-start">
                    <Ionicons name="checkmark-circle-outline" size={13} color="#34d399" className="mt-0.5 mr-2" />
                    <Text className="text-slate-350 text-[9px] leading-normal flex-1 font-sans">
                      <Text className="font-bold text-white">Bonding Lockouts:</Text> BLE devices pair with one master client at a time. Verify the smartband isn't currently connected to a nearby computer or another device.
                    </Text>
                  </View>
                </View>
              </View>

            </View>
          )}

        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
