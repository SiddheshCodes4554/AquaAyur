import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useBLEStore } from '../../store/useBLEStore';
import { sendControlCommand, disconnectDevice } from '../../services/bleManager';

export default function DeviceDetailsScreen() {
  const { connectedDevice: bleDevice, liveData } = useBLEStore();
  
  const isConnected = !!bleDevice;
    
  const deviceName = bleDevice?.name || 'AquaAyur Wearable';
    
  const deviceId = bleDevice?.id || '';

  const [calibrating, setCalibrating] = useState(false);
  const [deviceStats, setDeviceStats] = useState({
    battery: 100,
    heap: 218520,
    uptime: 0,
    firmware: 'v1.0.4',
    model: 'AA-Wear-ESP32'
  });

  // Increment simulated uptime for active connections
  useEffect(() => {
    let interval: any;
    if (isConnected) {
      interval = setInterval(() => {
        setDeviceStats((prev) => ({
          ...prev,
          uptime: prev.uptime + 1,
          battery: liveData ? Math.max(30, prev.battery - (Math.random() > 0.95 ? 1 : 0)) : prev.battery
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected, liveData]);

  const handleCalibration = async () => {
    setCalibrating(true);
    // Send calibration control command 0x02 to ESP32
    await sendControlCommand(2);
    setTimeout(() => {
      setCalibrating(false);
    }, 15000);
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
    router.replace('/(tabs)/device');
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#34d399" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Wearable Details</Text>
        </View>

        {!isConnected ? (
          <View className="flex-1 justify-center items-center py-20 bg-emerald-900/10 border border-dashed border-emerald-800/30 rounded-2xl">
            <Ionicons name="bluetooth" size={48} color="#047857" className="mb-4" />
            <Text className="text-emerald-400 text-lg font-bold">No Device Connected</Text>
            <Text className="text-emerald-500/80 text-sm mt-2 text-center px-8">
              Connect to your AquaAyur ESP32 sensor suite in the Wearable tab to inspect health indicators.
            </Text>
          </View>
        ) : (
          <View className="space-y-6">
            
            {/* Battery & MAC card */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white font-bold text-lg">{deviceName}</Text>
                <View className="flex-row items-center">
                  <Ionicons name="battery-charging" size={20} color="#34d399" className="mr-1.5" />
                  <Text className="text-emerald-400 font-extrabold text-sm">{deviceStats.battery}%</Text>
                </View>
              </View>

              <Text className="text-emerald-400/60 text-xs font-mono">ID: {deviceId}</Text>
            </View>

            {/* Hardware Vitals Diagnostic Specs */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
              <Text className="text-white font-bold text-lg mb-4">Device Diagnostics</Text>

              <View className="flex-row justify-between py-3 border-b border-emerald-800/20">
                <Text className="text-emerald-300/80 text-sm">Model Number</Text>
                <Text className="text-white font-bold text-sm">{deviceStats.model}</Text>
              </View>

              <View className="flex-row justify-between py-3 border-b border-emerald-800/20">
                <Text className="text-emerald-300/80 text-sm">Firmware Revision</Text>
                <Text className="text-white font-bold text-sm">{deviceStats.firmware}</Text>
              </View>

              <View className="flex-row justify-between py-3 border-b border-emerald-800/20">
                <Text className="text-emerald-300/80 text-sm">Uptime</Text>
                <Text className="text-white font-bold text-sm font-mono">{formatUptime(deviceStats.uptime)}</Text>
              </View>

              <View className="flex-row justify-between py-3">
                <Text className="text-emerald-300/80 text-sm">Free Heap Memory</Text>
                <Text className="text-white font-bold text-sm font-mono">{deviceStats.heap} Bytes</Text>
              </View>
            </View>

            {/* Calibration & Control tools */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-2xl">
              <Text className="text-white font-bold text-lg mb-2">Sensor Calibration</Text>
              <Text className="text-emerald-200/80 text-xs leading-relaxed mb-6">
                If the pedometer or posture tracking values seem off, lay the wearable flat on a stable surface and trigger accelerometer calibration.
              </Text>

              <TouchableOpacity
                onPress={handleCalibration}
                disabled={calibrating}
                className="bg-emerald-500 rounded-xl py-3.5 flex-row justify-center items-center active:bg-emerald-600 mb-4"
              >
                {calibrating ? (
                  <>
                    <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                    <Text className="text-emerald-950 font-bold text-sm">Calibrating Offsets...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="git-compare-outline" size={16} color="#022c22" className="mr-2" />
                    <Text className="text-emerald-950 font-bold text-sm">Calibrate Sensors</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDisconnect}
                className="bg-red-500/10 border border-red-500/30 py-3.5 rounded-xl justify-center items-center active:bg-red-500/20"
              >
                <Text className="text-red-400 font-bold text-sm">Disconnect Wearable</Text>
              </TouchableOpacity>
            </View>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
