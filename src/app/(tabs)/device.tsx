import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useBLEStore } from '../../store/useBLEStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { startScanning, stopScanning, connectToDevice, disconnectDevice, sendControlCommand, autoConnectLastPairedDevice, SERVICE_UUID } from '../../services/bleManager';

export default function DeviceScreen() {
  const { scannedDevices, connectedDevice, errorMsg } = useBLEStore();
  const { status } = useSensorStore();
  const [pulseGlow, setPulseGlow] = useState(1);
  const [showOtherDevices, setShowOtherDevices] = useState(false);
  const [pairedDevice, setPairedDevice] = useState<{ mac_address: string, device_name: string } | null>(null);
  const [loadingPairing, setLoadingPairing] = useState(false);

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
    fetchPairedDevice();
  }, [connectedDevice]);

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

  // Pulse animation timer for BLE wave radar
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseGlow(p => (p === 1 ? 0.35 : 1));
    }, 900);
    return () => clearInterval(timer);
  }, []);

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

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return { text: 'text-emerald-400', dot: 'bg-emerald-400 shadow-emerald-400/50' };
      case 'connecting': return { text: 'text-amber-400', dot: 'bg-amber-400 shadow-amber-400/50' };
      case 'scanning': return { text: 'text-sky-400', dot: 'bg-sky-400 shadow-sky-400/50' };
      default: return { text: 'text-rose-500', dot: 'bg-rose-500' };
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View className="mb-6 mt-2">
            <Text className="text-emerald-400/50 text-[10px] font-bold uppercase tracking-wider">Device Settings</Text>
            <Text className="text-white text-2xl font-bold font-sans">AquaAyur Wearable</Text>
          </View>


          {/* Connection Status & Pulse Wave Radar */}
          <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 items-center relative overflow-hidden">
            <View className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            
            <View className="w-full flex-row justify-between items-center mb-6">
              <Text className="text-white text-sm font-bold">Bluetooth Connection</Text>
              <View className="flex-row items-center bg-emerald-950/60 border border-emerald-900/35 px-3 py-1 rounded-full">
                <View key={status} style={{ opacity: status === 'scanning' || status === 'connecting' ? pulseGlow : 1 }} className={`w-2 h-2 rounded-full mr-2 ${getStatusColor().dot} will-change-variable`} />
                <Text className={`text-[10px] font-bold uppercase font-mono tracking-wider ${getStatusColor().text}`}>
                  {status}
                </Text>
              </View>
            </View>

            {/* BLE Wave Radar Animation (nested concentric circles) */}
            <View className="h-44 justify-center items-center relative mb-6 w-full">
              {/* Outer wave */}
              <View
                style={{ opacity: status === 'connected' || status === 'scanning' ? pulseGlow * 0.2 : 0.05 }}
                className="w-36 h-36 rounded-full border border-emerald-500/20 justify-center items-center absolute"
              />
              {/* Middle wave */}
              <View
                style={{ opacity: status === 'connected' || status === 'scanning' ? (1.35 - pulseGlow) * 0.35 : 0.1 }}
                className="w-26 h-26 rounded-full border border-emerald-500/30 justify-center items-center absolute"
              />
              {/* Inner core */}
              <View className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500/60 justify-center items-center shadow-xl shadow-black/35 relative">
                <Ionicons 
                  name="bluetooth" 
                  size={26} 
                  color={status === 'connected' ? '#34d399' : '#6b7280'} 
                />
              </View>
            </View>

            {connectedDevice ? (
              <View className="w-full">
                {/* Device Info */}
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/device-details')}
                  className="bg-[#020b08]/85 border border-emerald-900/40 p-4 rounded-xl mb-4 flex-row justify-between items-center active:bg-emerald-900/10"
                >
                  <View>
                    <Text className="text-white text-xs font-bold">{connectedDevice.name || 'AquaAyur Wearable'}</Text>
                    <Text className="text-emerald-400/50 text-[10px] font-mono mt-0.5">{connectedDevice.id}</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-emerald-400 text-[10px] font-bold font-sans">Details</Text>
                    <Ionicons name="chevron-forward" size={14} color="#34d399" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={disconnectDevice}
                  className="bg-rose-500/15 border border-rose-500/35 rounded-xl py-3 items-center active:bg-rose-500/25"
                >
                  <Text className="text-rose-400 font-bold text-xs">Disconnect Device</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleScanToggle}
                className="bg-emerald-500 rounded-xl py-3.5 w-full flex-row justify-center items-center shadow-lg shadow-emerald-500/15 active:bg-emerald-600"
              >
                {status === 'scanning' ? (
                  <>
                    <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                    <Text className="text-emerald-950 font-bold text-xs uppercase tracking-wider">Stop Scanning</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="search" size={14} color="#022c22" className="mr-1.5" />
                    <Text className="text-emerald-950 font-bold text-xs uppercase tracking-wider">Scan for Sensors</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {errorMsg ? (
              <View className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-xl mt-4 w-full">
                <Text className="text-rose-300 text-xs text-center">{errorMsg}</Text>
              </View>
            ) : null}
          </View>

          {/* TELEMETRY CONTROLS & DIAGNOSTICS */}
          {connectedDevice && (
            <View key="connected-telemetry" className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 will-change-variable">
              <View className="flex-row items-center mb-3">
                <Ionicons name="build" size={18} color="#10b981" />
                <Text className="text-white font-bold text-sm ml-2">Diagnostic Testers</Text>
              </View>
              <Text className="text-emerald-200/80 text-xs leading-relaxed mb-5">
                Trigger a command directly to the ESP32 firmware loop to test native actuator and haptic vibrotactile responses.
              </Text>
              <TouchableOpacity
                onPress={testHapticVibration}
                className="bg-emerald-500 rounded-xl py-3 flex-row justify-center items-center active:bg-emerald-600"
              >
                <Ionicons name="pulse" size={14} color="#022c22" className="mr-1.5" />
                <Text className="text-emerald-950 font-bold text-xs uppercase">Trigger Haptic Vibration</Text>
              </TouchableOpacity>
            </View>
          )}
          {!connectedDevice && (
            <View className="flex-1 mt-2">
              {/* PREVIOUSLY PAIRED DEVICE */}
              {pairedDevice && (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="link-outline" size={16} color="#10b981" className="mr-1.5" />
                    <Text className="text-white text-sm font-bold">Previously Paired Device</Text>
                  </View>
                  <View className="bg-[#051f18]/35 border border-emerald-500/20 p-4 rounded-xl flex-row justify-between items-center">
                    <View className="flex-1 mr-3">
                      <Text className="text-white text-xs font-bold">{pairedDevice.device_name}</Text>
                      <Text className="text-emerald-400/50 text-[10px] font-mono mt-0.5">{pairedDevice.mac_address}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        autoConnectLastPairedDevice().catch((e: any) => console.log(e));
                      }}
                      disabled={status === 'connecting' || status === 'scanning'}
                      className="bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-lg flex-row items-center gap-1 active:bg-emerald-500/25"
                    >
                      {status === 'connecting' ? (
                        <ActivityIndicator size="small" color="#34d399" />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={12} color="#34d399" />
                          <Text className="text-emerald-400 font-bold text-[10px]">Autoconnect</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* RECOMMENDED DEVICES SECTION */}
              <View className="flex-row items-center mb-3">
                <Ionicons name="sparkles" size={16} color="#34d399" className="mr-1.5" />
                <Text className="text-white text-sm font-bold">Recommended Sensors ({recommendedDevices.length})</Text>
              </View>

              {recommendedDevices.length === 0 ? (
                <View key="no-recommended" className="bg-[#051f18]/15 border border-dashed border-emerald-850/25 p-6 rounded-2xl justify-center items-center py-8 mb-6 will-change-variable">
                  <Ionicons name="bluetooth" size={24} color="#047857" className="mb-2" />
                  <Text className="text-emerald-500/80 text-xs text-center font-sans">
                    {status === 'scanning' 
                      ? 'Scanning for compatible AquaAyur wearables...' 
                      : 'No recommended sensors nearby. Tap Scan for Sensors above.'}
                  </Text>
                </View>
              ) : (
                <View key="recommended-list" className="space-y-2.5 mb-6 will-change-variable">
                  {recommendedDevices.map((device) => (
                    <TouchableOpacity
                      key={device.id}
                      onPress={() => connectToDevice(device)}
                      className="bg-[#051f18]/35 border border-emerald-500/30 p-4 rounded-xl flex-row justify-between items-center active:bg-emerald-900/20 shadow-md shadow-emerald-950/20"
                    >
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center">
                          <Text className="text-white text-xs font-bold mr-2">{device.name || 'AquaAyur Sensor'}</Text>
                          <View className="bg-emerald-500/25 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                            <Text className="text-emerald-300 text-[8px] font-bold uppercase font-sans">Match</Text>
                          </View>
                        </View>
                        <Text className="text-emerald-400/50 text-[10px] font-mono mt-1">{device.id}</Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-1 rounded-lg">
                        <Text className="text-emerald-450 font-bold text-[10px]">Connect</Text>
                        <Ionicons name="chevron-forward" size={12} color="#34d399" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* OTHER DEVICES COLLAPSIBLE SECTION */}
              {otherDevices.length > 0 && (
                <View key="other-devices-section" className="mb-6 will-change-variable">
                  <TouchableOpacity
                    onPress={() => setShowOtherDevices(!showOtherDevices)}
                    className="flex-row justify-between items-center bg-[#051f18]/15 border border-emerald-900/20 px-4 py-3 rounded-xl active:bg-[#051f18]/30"
                  >
                    <View className="flex-row items-center">
                      <Ionicons name="radio" size={16} color="#6b7280" className="mr-1.5" />
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
                    <View className="space-y-2.5 mt-2.5">
                      {otherDevices.map((device) => (
                        <TouchableOpacity
                          key={device.id}
                          onPress={() => connectToDevice(device)}
                          className="bg-[#051f18]/15 border border-emerald-900/10 p-4 rounded-xl flex-row justify-between items-center active:bg-emerald-900/10"
                        >
                          <View className="flex-1 mr-3">
                            <Text className="text-white/70 text-xs font-sans">{device.name || 'Unknown Device'}</Text>
                            <Text className="text-emerald-500/35 text-[10px] font-mono mt-0.5">{device.id}</Text>
                          </View>
                          <View className="flex-row items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded">
                            <Text className="text-emerald-450/70 text-[9px] font-semibold">Pair</Text>
                            <Ionicons name="chevron-forward" size={10} color="#34d399" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* DIAGNOSTIC / TROUBLESHOOTING HELP */}
              {(status === 'scanning' || scannedDevices.length === 0) && (
                <View className="bg-[#051f18]/25 border border-emerald-900/20 p-5 rounded-2xl mt-2">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="help-circle" size={18} color="#10b981" />
                    <Text className="text-white font-bold text-xs ml-2 font-sans">Troubleshooting ESP32 Discovery</Text>
                  </View>
                  <View className="space-y-2.5">
                    <View className="flex-row items-start">
                      <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" className="mt-0.5 mr-2" />
                      <Text className="text-emerald-200/60 text-[10px] leading-normal flex-1 font-sans">
                        <Text className="font-bold text-white/80">Location Services (GPS):</Text> Make sure GPS is enabled on your phone. Android requires location settings to be ON for Bluetooth scans.
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" className="mt-0.5 mr-2" />
                      <Text className="text-emerald-200/60 text-[10px] leading-normal flex-1 font-sans">
                        <Text className="font-bold text-white/80">Check Active Connections:</Text> BLE devices only connect to one central. Verify your ESP32 is not connected/bonded to your computer, another phone, or a serial terminal.
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" className="mt-0.5 mr-2" />
                      <Text className="text-emerald-200/60 text-[10px] leading-normal flex-1 font-sans">
                        <Text className="font-bold text-white/80">Proximity:</Text> Place the ESP32 directly next to your phone (within 1-2 meters) to guarantee strong RSSI signal advertisement receipt.
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <Ionicons name="checkmark-circle-outline" size={14} color="#34d399" className="mt-0.5 mr-2" />
                      <Text className="text-emerald-200/60 text-[10px] leading-normal flex-1 font-sans">
                        <Text className="font-bold text-white/80">Check Other Bluetooth Devices:</Text> If your device name is not recognized as a recommended sensor, it will appear under the <Text className="font-bold text-emerald-300">Other Bluetooth Devices</Text> section.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
