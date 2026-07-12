import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSensorStore, ActivityType } from '../../store/useSensorStore';
import { 
  PRESETS, 
  SCENARIOS, 
  randomizeSimulatorValues, 
  stopSimulatorStream, 
  startSimulatorStream 
} from '../../services/simulatorEngine';

export default function SimulatorScreen() {
  const { simulatorSettings, status, liveData, updateSimulatorSetting, resetSimulatorSettings } = useSensorStore();
  const [pulseGlow, setPulseGlow] = useState(1);
  const [showScenarios, setShowScenarios] = useState(true);

  // Concentric pulsing timer for packets and heartbeat simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setPulseGlow(p => (p === 1 ? 0.35 : 1));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApplyPreset = (presetName: string) => {
    const preset = PRESETS[presetName] as any;
    if (preset) {
      Object.keys(preset).forEach((key) => {
        updateSimulatorSetting(key as any, preset[key]);
      });
      updateSimulatorSetting('activeScenarioName', presetName);
    }
  };

  const handleApplyScenario = (scenarioName: string) => {
    const scenario = SCENARIOS[scenarioName] as any;
    if (scenario) {
      Object.keys(scenario).forEach((key) => {
        updateSimulatorSetting(key as any, scenario[key]);
      });
      updateSimulatorSetting('activeScenarioName', scenarioName);
    }
  };

  const handlePauseResume = () => {
    updateSimulatorSetting('isPaused', !simulatorSettings.isPaused);
  };

  const handleRestart = () => {
    stopSimulatorStream();
    resetSimulatorSettings();
    startSimulatorStream();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#031410', '#010605']} className="flex-1">
        
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-3 pb-2 border-b border-emerald-950/40">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={22} color="#34d399" />
            </TouchableOpacity>
            <View>
              <Text className="text-emerald-400/50 text-[9px] font-bold uppercase tracking-wider">Device Lab</Text>
              <Text className="text-white text-lg font-bold">Virtual AquaAyur Wearable</Text>
            </View>
          </View>
          <View className="bg-emerald-950/60 border border-emerald-900/35 px-2.5 py-1 rounded-full flex-row items-center">
            <View style={{ opacity: pulseGlow }} className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            <Text className="text-emerald-400 text-[9px] font-bold uppercase font-mono tracking-wider">Sim Connected</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          
          {/* SIMULATOR HUD WIDGET */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-5 relative overflow-hidden">
            <View className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-3">Simulator Telemetry HUD</Text>
            
            {/* Status Summary */}
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-emerald-900/20">
              <View>
                <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Packet counter</Text>
                <Text className="text-white text-lg font-bold font-mono">{simulatorSettings.packetCount} <Text className="text-emerald-400 text-[10px] font-normal">pkts</Text></Text>
              </View>
              <View className="h-8 w-[1px] bg-emerald-900/20" />
              <View>
                <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Uptime (MM:SS)</Text>
                <Text className="text-white text-lg font-bold font-mono">{formatUptime(simulatorSettings.uptimeSeconds)}</Text>
              </View>
              <View className="h-8 w-[1px] bg-emerald-900/20" />
              <View>
                <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Connection Quality</Text>
                <Text className="text-white text-lg font-bold font-mono">{simulatorSettings.connectionQuality}%</Text>
              </View>
            </View>

            {/* Battery Level Progress Bar */}
            <View className="mb-2">
              <View className="flex-row justify-between mb-1">
                <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Sensor Battery Charge</Text>
                <Text className="text-white text-[10px] font-mono font-bold">{Math.round(simulatorSettings.battery)}%</Text>
              </View>
              <View className="w-full h-2.5 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/30">
                <View 
                  style={{ 
                    width: `${simulatorSettings.battery}%`, 
                    backgroundColor: simulatorSettings.battery > 50 ? '#34d399' : simulatorSettings.battery > 20 ? '#fbbf24' : '#f87171' 
                  }} 
                  className="h-full rounded-full" 
                />
              </View>
            </View>
          </View>

          {/* AUTOMATIC MODES PRESETS */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-5">
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-3">Intelligent Activity Presets</Text>
            <View className="flex-row flex-wrap gap-2">
              {Object.keys(PRESETS).map((pName) => {
                const isActive = simulatorSettings.activeScenarioName === pName;
                return (
                  <TouchableOpacity
                    key={pName}
                    onPress={() => handleApplyPreset(pName)}
                    className={`px-3 py-1.5 rounded-xl border ${
                      isActive ? 'bg-emerald-500 border-emerald-400' : 'bg-emerald-950/40 border-emerald-900/30'
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${isActive ? 'text-emerald-950' : 'text-emerald-400'}`}>
                      {pName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* LIVE HARDWARE SLIDERS */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-5">
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-4">Live Biometric Controls</Text>
            
            <ValueSlider
              label="Heart Rate"
              value={simulatorSettings.heartRate}
              min={50}
              max={180}
              step={2}
              onChange={(val) => updateSimulatorSetting('heartRate', val)}
              unit="bpm"
            />

            <ValueSlider
              label="Body Temperature"
              value={simulatorSettings.temperature}
              min={35}
              max={40}
              step={0.1}
              onChange={(val) => updateSimulatorSetting('temperature', val)}
              unit="°C"
            />

            {/* Steps Controller with Buttons */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-emerald-400 text-xs font-bold font-sans">Step Counter</Text>
                <Text className="text-white text-xs font-mono font-semibold">{simulatorSettings.steps} steps</Text>
              </View>
              <View className="flex-row items-center space-x-2">
                <TouchableOpacity
                  onPress={() => updateSimulatorSetting('steps', Math.max(0, simulatorSettings.steps - 1000))}
                  className="flex-1 py-2 rounded-xl bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
                >
                  <Text className="text-emerald-400 text-[10px] font-bold">-1k</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateSimulatorSetting('steps', Math.max(0, simulatorSettings.steps - 100))}
                  className="flex-1 py-2 rounded-xl bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
                >
                  <Text className="text-emerald-400 text-[10px] font-bold">-100</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateSimulatorSetting('steps', simulatorSettings.steps + 100)}
                  className="flex-1 py-2 rounded-xl bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
                >
                  <Text className="text-emerald-400 text-[10px] font-bold">+100</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => updateSimulatorSetting('steps', simulatorSettings.steps + 1000)}
                  className="flex-1 py-2 rounded-xl bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
                >
                  <Text className="text-emerald-400 text-[10px] font-bold">+1k</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => updateSimulatorSetting('autoIncrementSteps', !simulatorSettings.autoIncrementSteps)}
                className="mt-2.5 flex-row items-center bg-emerald-950/40 border border-emerald-900/20 px-3 py-2 rounded-xl"
              >
                <Ionicons 
                  name={simulatorSettings.autoIncrementSteps ? 'checkbox' : 'square-outline'} 
                  size={14} 
                  color="#10b981" 
                  style={{ marginRight: 6 }}
                />
                <Text className="text-emerald-300 text-[10px] font-bold">Auto Increment steps (+1/s)</Text>
              </TouchableOpacity>
            </View>

            {/* Activity State Selector */}
            <View className="mb-4">
              <Text className="text-emerald-400 text-xs font-bold font-sans mb-1.5">Activity State</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(['Resting', 'Walking', 'Running', 'Cycling', 'Sleeping', 'Meditating'] as ActivityType[]).map((act) => {
                  const isActive = simulatorSettings.activity === act;
                  return (
                    <TouchableOpacity
                      key={act}
                      onPress={() => updateSimulatorSetting('activity', act)}
                      className={`px-3 py-1.5 rounded-lg border ${
                        isActive ? 'bg-emerald-500 border-emerald-400' : 'bg-emerald-950/45 border-emerald-900/20'
                      }`}
                    >
                      <Text className={`text-[9px] font-bold ${isActive ? 'text-emerald-950' : 'text-emerald-400'}`}>
                        {act}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <ValueSlider
              label="Hydration Volume"
              value={simulatorSettings.hydration}
              min={0}
              max={100}
              step={5}
              onChange={(val) => updateSimulatorSetting('hydration', val)}
              unit="%"
            />

            <ValueSlider
              label="Stress Level"
              value={simulatorSettings.stress}
              min={0}
              max={100}
              step={5}
              onChange={(val) => updateSimulatorSetting('stress', val)}
              unit="%"
            />

            <ValueSlider
              label="Sleep Quality score"
              value={simulatorSettings.sleepQuality}
              min={0}
              max={100}
              step={5}
              onChange={(val) => updateSimulatorSetting('sleepQuality', val)}
              unit="%"
            />

            <ValueSlider
              label="Battery level"
              value={simulatorSettings.battery}
              min={0}
              max={100}
              step={5}
              onChange={(val) => updateSimulatorSetting('battery', val)}
              unit="%"
            />
          </View>

          {/* SIMULATION SCENARIOS */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-5">
            <TouchableOpacity 
              onPress={() => setShowScenarios(!showScenarios)}
              className="flex-row justify-between items-center mb-3"
            >
              <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider">Simulation Scenarios ({Object.keys(SCENARIOS).length})</Text>
              <Ionicons name={showScenarios ? 'chevron-up' : 'chevron-down'} size={14} color="#047857" />
            </TouchableOpacity>
            
            {showScenarios && (
              <View className="space-y-2 mt-1">
                {Object.keys(SCENARIOS).map((sName) => {
                  const isActive = simulatorSettings.activeScenarioName === sName;
                  return (
                    <TouchableOpacity
                      key={sName}
                      onPress={() => handleApplyScenario(sName)}
                      className={`flex-row justify-between items-center p-3 rounded-xl border ${
                        isActive ? 'bg-emerald-500/10 border-emerald-400' : 'bg-emerald-950/40 border-emerald-900/20'
                      }`}
                    >
                      <View>
                        <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-emerald-200'}`}>
                          {sName}
                        </Text>
                        <Text className="text-emerald-400/40 text-[9px] mt-0.5 font-mono">
                          HR: {SCENARIOS[sName].heartRate} bpm | Temp: {SCENARIOS[sName].temperature}°C | Hyd: {SCENARIOS[sName].hydration}%
                        </Text>
                      </View>
                      <View className={`px-2 py-0.5 rounded ${isActive ? 'bg-emerald-500' : 'bg-emerald-950'}`}>
                        <Text className={`text-[8px] font-bold uppercase ${isActive ? 'text-emerald-950' : 'text-emerald-500'}`}>
                          {isActive ? 'Active' : 'Apply'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* DEVELOPER TOOLS PANEL */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-4">
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-4">Developer Tools Toolbar</Text>
            
            <View className="flex-row space-x-3 mb-3">
              {/* Play/Pause */}
              <TouchableOpacity
                onPress={handlePauseResume}
                className={`flex-1 py-3 rounded-xl border flex-row items-center justify-center ${
                  simulatorSettings.isPaused ? 'bg-amber-500 border-amber-400' : 'bg-emerald-950/50 border-emerald-900/30'
                }`}
              >
                <Ionicons 
                  name={simulatorSettings.isPaused ? 'play' : 'pause'} 
                  size={14} 
                  color={simulatorSettings.isPaused ? '#022c22' : '#34d399'} 
                  style={{ marginRight: 6 }}
                />
                <Text className={`font-bold text-xs ${simulatorSettings.isPaused ? 'text-emerald-950' : 'text-emerald-400'}`}>
                  {simulatorSettings.isPaused ? 'Resume Stream' : 'Pause Stream'}
                </Text>
              </TouchableOpacity>

              {/* Randomize noise */}
              <TouchableOpacity
                onPress={randomizeSimulatorValues}
                className="flex-1 py-3 rounded-xl bg-emerald-950/50 border border-emerald-900/30 flex-row items-center justify-center"
              >
                <Ionicons name="shuffle-outline" size={14} color="#34d399" style={{ marginRight: 6 }} />
                <Text className="text-emerald-400 font-bold text-xs">Inject Jitter</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row space-x-3">
              {/* Reset */}
              <TouchableOpacity
                onPress={resetSimulatorSettings}
                className="flex-1 py-3 rounded-xl bg-emerald-950/50 border border-emerald-900/30 flex-row items-center justify-center"
              >
                <Ionicons name="refresh-outline" size={14} color="#34d399" style={{ marginRight: 6 }} />
                <Text className="text-emerald-400 font-bold text-xs">Reset Values</Text>
              </TouchableOpacity>

              {/* Restart */}
              <TouchableOpacity
                onPress={handleRestart}
                className="flex-1 py-3 rounded-xl bg-emerald-950/50 border border-emerald-900/30 flex-row items-center justify-center"
              >
                <Ionicons name="power-outline" size={14} color="#34d399" style={{ marginRight: 6 }} />
                <Text className="text-emerald-400 font-bold text-xs">Restart Sim</Text>
              </TouchableOpacity>
            </View>
          </View>
          
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

/**
 * Custom Sliders component layout.
 */
const ValueSlider = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = ''
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  unit?: string;
}) => {
  const handleDecrement = () => {
    onChange(Number(Math.max(min, value - step).toFixed(2)));
  };
  
  const handleIncrement = () => {
    onChange(Number(Math.min(max, value + step).toFixed(2)));
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-emerald-400 text-xs font-bold font-sans">{label}</Text>
        <Text className="text-white text-xs font-mono font-semibold">
          {value} {unit}
        </Text>
      </View>
      <View className="flex-row items-center space-x-2">
        <TouchableOpacity
          onPress={handleDecrement}
          className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
        >
          <Text className="text-emerald-400 font-bold text-sm">-</Text>
        </TouchableOpacity>
        <View className="flex-1 h-3 bg-emerald-950 rounded-full overflow-hidden border border-emerald-900/20 relative justify-center">
          <View style={{ width: `${percent}%` }} className="h-full bg-emerald-500 rounded-full" />
        </View>
        <TouchableOpacity
          onPress={handleIncrement}
          className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-900/30 items-center justify-center active:bg-emerald-900/25"
        >
          <Text className="text-emerald-400 font-bold text-sm">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
