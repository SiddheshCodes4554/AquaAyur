import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useSleepStore } from '../store/useSleepStore';

type MetricType = 'pulse' | 'temp' | 'steps' | 'sleep';

interface ChartDataPoint {
  label: string;      // E.g. 'Mon', 'Tue'
  value: number;      // Metric numerical value
  display: string;    // E.g. '75 bpm', '36.5°C'
}

const MetricTrendChart = React.memo(function MetricTrendChart() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('pulse');
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  const heartRateHistory = useTelemetryStore(state => state.heartRateHistory);
  const temperatureHistory = useTelemetryStore(state => state.temperatureHistory);
  const activityHistory = useTelemetryStore(state => state.activityHistory);
  const sleepHistory = useSleepStore(state => state.sleepHistory);

  // Helper to generate the last 7 days labels (stable calculation)
  const last7Days = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push({
        dateString: d.toISOString().split('T')[0],
        dayLabel: days[d.getDay()],
        rawDate: d
      });
    }
    return result;
  }, []);

  const chartData = useMemo((): ChartDataPoint[] => {
    return last7Days.map(({ dateString, dayLabel }) => {
      let value = 0;
      let display = '';

      switch (selectedMetric) {
        case 'pulse': {
          // Average heart rate for this specific day
          const dayLogs = heartRateHistory.filter(log => log.timestamp.startsWith(dateString));
          if (dayLogs.length > 0) {
            const sum = dayLogs.reduce((acc, log) => acc + log.bpm, 0);
            value = Math.round(sum / dayLogs.length);
          } else {
            value = 70; // baseline default
          }
          display = `${value} bpm`;
          break;
        }
        case 'temp': {
          // Average temperature for this day
          const dayLogs = temperatureHistory.filter(log => log.timestamp.startsWith(dateString));
          if (dayLogs.length > 0) {
            const sum = dayLogs.reduce((acc, log) => acc + Number(log.temperature_celsius), 0);
            value = Number((sum / dayLogs.length).toFixed(1));
          } else {
            value = 36.5; // baseline default
          }
          display = `${value} °C`;
          break;
        }
        case 'steps': {
          // Take the maximum step count logged on this day
          const dayLogs = activityHistory.filter(log => log.timestamp.startsWith(dateString));
          if (dayLogs.length > 0) {
            value = Math.max(...dayLogs.map(log => log.steps_count));
          } else {
            value = 0;
          }
          display = `${value.toLocaleString()} steps`;
          break;
        }
        case 'sleep': {
          // Average sleep duration in hours logged on this day
          const dayLogs = sleepHistory.filter(log => log.start_time.startsWith(dateString));
          if (dayLogs.length > 0) {
            const totalMin = dayLogs.reduce((acc, log) => acc + log.duration_minutes, 0);
            value = Number((totalMin / 60).toFixed(1));
          } else {
            value = 0;
          }
          display = `${value} hrs`;
          break;
        }
      }

      return {
        label: dayLabel,
        value,
        display
      };
    });
  }, [selectedMetric, last7Days, heartRateHistory, temperatureHistory, activityHistory, sleepHistory]);

  // Calculate range limits for y-axis scaling
  const values = chartData.map(d => d.value);
  const maxValue = Math.max(...values, selectedMetric === 'pulse' ? 120 : selectedMetric === 'temp' ? 39 : selectedMetric === 'sleep' ? 10 : 5000);
  const minValue = selectedMetric === 'temp' ? 34 : 0;
  const valueRange = maxValue - minValue;

  const getBarHeightPercent = (val: number) => {
    if (valueRange === 0) return 0;
    const pct = ((val - minValue) / valueRange) * 100;
    return Math.max(5, Math.min(100, pct)); // clamp between 5% and 100%
  };

  const getMetricColor = (metric: MetricType) => {
    switch (metric) {
      case 'pulse': return 'bg-rose-500';
      case 'temp': return 'bg-sky-400';
      case 'steps': return 'bg-yellow-400';
      case 'sleep': return 'bg-purple-400';
    }
  };

  const getMetricTextClass = (metric: MetricType) => {
    switch (metric) {
      case 'pulse': return 'text-rose-400';
      case 'temp': return 'text-sky-400';
      case 'steps': return 'text-yellow-400';
      case 'sleep': return 'text-purple-400';
    }
  };

  return (
    <View className="bg-emerald-900/20 border border-emerald-800/30 p-6 rounded-2xl mb-6">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-white text-lg font-bold">Trend Analysis</Text>
        <Text className="text-emerald-400/60 text-xs">Past 7 Days</Text>
      </View>

      {/* Selectors grid */}
      <View className="flex-row space-x-2 mb-8 bg-emerald-950/50 p-1 rounded-xl border border-emerald-850/40">
        {(['pulse', 'temp', 'steps', 'sleep'] as MetricType[]).map((metric) => (
          <TouchableOpacity
            key={metric}
            onPress={() => {
              setSelectedMetric(metric);
              setActiveBarIndex(null);
            }}
            className={`flex-1 py-2 rounded-lg items-center ${
              selectedMetric === metric 
                ? 'bg-emerald-900/50 border border-emerald-800/30' 
                : 'border border-transparent'
            }`}
          >
            <Text className={`text-xs font-bold capitalize ${
              selectedMetric === metric ? getMetricTextClass(metric) : 'text-emerald-400/50'
            }`}>
              {metric}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Bar Chart Canvas */}
      <View className="h-48 flex-row items-end justify-between px-2 relative">
        
        {/* Background Y-Axis Grid Lines */}
        <View className="absolute inset-x-0 bottom-0 top-0 justify-between pointer-events-none">
          <View className="w-full border-t border-emerald-800/10 h-0" />
          <View className="w-full border-t border-emerald-800/10 h-0" />
          <View className="w-full border-t border-emerald-800/10 h-0" />
          <View className="w-full border-b border-emerald-800/20 h-0" />
        </View>

        {chartData.map((data, index) => {
          const heightPercent = getBarHeightPercent(data.value);
          const isActive = activeBarIndex === index;

          return (
            <View key={index} className="items-center w-[11%] relative">
              
              {/* Floating Tooltip Indicator */}
              {isActive && (
                <View className="absolute -top-12 z-20 bg-emerald-950/95 border border-emerald-800/60 px-2 py-1 rounded-md shadow-lg min-w-[50px] items-center">
                  <Text className="text-white text-[9px] font-bold font-mono text-center">
                    {data.display}
                  </Text>
                  {/* Tooltip caret */}
                  <View className="w-1.5 h-1.5 bg-emerald-950 border-r border-b border-emerald-800/60 rotate-45 -mb-1 mt-0.5" />
                </View>
              )}

              {/* Bar Handle */}
              <TouchableOpacity
                onPress={() => setActiveBarIndex(isActive ? null : index)}
                activeOpacity={0.8}
                className="w-full h-36 justify-end items-center"
              >
                <View
                  style={{ height: `${heightPercent}%`, transform: isActive ? [{ scaleX: 1.1 }] : undefined }}
                  className={`w-full rounded-t-lg transition-all duration-350 ${getMetricColor(selectedMetric)} ${
                    isActive ? 'opacity-100 shadow-md' : 'opacity-65'
                  }`}
                />
              </TouchableOpacity>

              {/* Day Label */}
              <Text className="text-emerald-400/40 text-[10px] font-bold mt-2">
                {data.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export default MetricTrendChart;
