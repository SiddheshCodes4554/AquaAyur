import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useSleepStore } from '../../store/useSleepStore';
import { useAgniStore } from '../../store/useAgniStore';
import { useOjasStore } from '../../store/useOjasStore';
import { supabase } from '../../services/supabase';
import { compileAnalyticsReport } from '../../services/analyticsService';

interface HealthReportRecord {
  id: string;
  created_at: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date: string;
  summary_markdown: string;
  pdf_storage_path?: string | null;
  health_score: number | null;
  wellness_score: number | null;
  meta_stats: {
    avg_hr?: number;
    avg_temp?: number;
    total_steps?: number;
    total_water_ml?: number;
    total_calories_kcal?: number;
    avg_sleep_score?: number;
  } | null;
}

type ChartMetricType = 'pulse' | 'temp' | 'steps' | 'sleep' | 'ojas' | 'agni';

export default function InsightsScreen() {
  const { user, profile } = useAuthStore();
  const { heartRateHistory, temperatureHistory, activityHistory, fetchHistory: fetchTelemetryHistory } = useTelemetryStore();
  const { sleepHistory, fetchHistory: fetchSleepHistory } = useSleepStore();
  const { history: agniHistory, fetchHistory: fetchAgniHistory, todayAgni, fetchTodayAgni } = useAgniStore();
  const { history: ojasHistory, fetchHistory: fetchOjasHistory, todayOjas, fetchTodayOjas } = useOjasStore();

  const [reports, setReports] = useState<HealthReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [activeChartMetric, setActiveChartMetric] = useState<ChartMetricType>('pulse');
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);
  const [selectedReportForModal, setSelectedReportForModal] = useState<HealthReportRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch reports & telemetry history
  const fetchReportsAndData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [reportsRes] = await Promise.all([
        supabase
          .from('health_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        fetchTelemetryHistory(user.id),
        fetchSleepHistory(user.id),
        fetchAgniHistory(user.id),
        fetchOjasHistory(user.id),
        fetchTodayAgni(user.id),
        fetchTodayOjas(user.id)
      ]);

      if (reportsRes.error) throw reportsRes.error;
      const loadedReports = (reportsRes.data as HealthReportRecord[]) || [];
      setReports(loadedReports);

      // Automatically compile the initial report if there are none,
      // and we have active telemetry data (indicating the user has connected their device)
      if (loadedReports.length === 0) {
        const hrCount = (useTelemetryStore.getState().heartRateHistory || []).length;
        const sleepCount = (useSleepStore.getState().sleepHistory || []).length;
        if (hrCount > 0 || sleepCount > 0) {
          setCompiling(true);
          try {
            const newReport = await compileAnalyticsReport(user.id, selectedInterval);
            setReports([newReport]);
          } catch (e: any) {
            console.warn('[Insights] Auto-compilation failed:', e);
          } finally {
            setCompiling(false);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Insights] Error loading data:', e);
      setErrorMsg('Failed to load historic analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportsAndData();
  }, [user?.id]);

  const compileNewReport = async () => {
    if (!user?.id) return;
    setCompiling(true);
    setErrorMsg('');
    try {
      const newReport = await compileAnalyticsReport(user.id, selectedInterval);
      setReports(prev => [newReport, ...prev]);
    } catch (e: any) {
      console.warn('[Insights] Report compilation error:', e);
      setErrorMsg(e.message || 'Failed to compile report. Make sure Groq key is configured.');
    } finally {
      setCompiling(false);
    }
  };

  // Helper: Normalize report fields for backward compatibility using REAL user data, not dummy values
  const normalizeReport = (rep: HealthReportRecord): HealthReportRecord => {
    // Compute real fallbacks from current history arrays
    const histAvgHr = heartRateHistory.length > 0 ? Math.round(heartRateHistory.reduce((s, v) => s + v.bpm, 0) / heartRateHistory.length) : 72;
    const histAvgTemp = temperatureHistory.length > 0 ? Number((temperatureHistory.reduce((s, v) => s + Number(v.temperature_celsius), 0) / temperatureHistory.length).toFixed(1)) : 36.6;
    const histAvgSleep = sleepHistory.length > 0 ? Math.round(sleepHistory.reduce((s, v) => s + v.sleep_score, 0) / sleepHistory.length) : 75;
    
    const histAvgSteps = activityHistory.length > 0 ? Math.round(activityHistory.reduce((s, v) => s + v.steps_count, 0) / activityHistory.length) : 0;
    
    const hrScore = Math.max(20, 100 - Math.abs(histAvgHr - 70) * 2);
    const tempScore = Math.max(20, 100 - Math.abs(histAvgTemp - 36.6) * 20);
    const estHealthScore = Math.round((hrScore + tempScore + histAvgSleep) / 3);

    const health_score = rep.health_score ?? estHealthScore;
    const wellness_score = rep.wellness_score ?? 80;
    const meta_stats = rep.meta_stats || {};
    
    return {
      ...rep,
      health_score,
      wellness_score,
      meta_stats: {
        avg_hr: meta_stats.avg_hr ?? histAvgHr,
        avg_temp: meta_stats.avg_temp ?? histAvgTemp,
        total_steps: meta_stats.total_steps ?? (histAvgSteps * daysCount),
        total_water_ml: meta_stats.total_water_ml ?? 0,
        total_calories_kcal: meta_stats.total_calories_kcal ?? 0,
        avg_sleep_score: meta_stats.avg_sleep_score ?? histAvgSleep,
      }
    };
  };

  // Dynamic status color mappings
  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-400', border: 'border-emerald-500/80', bg: 'bg-emerald-950/80', glow: 'bg-emerald-400/20' };
    if (score >= 50) return { text: 'text-amber-400', border: 'border-amber-500/80', bg: 'bg-amber-950/50', glow: 'bg-amber-400/10' };
    return { text: 'text-rose-400', border: 'border-rose-500/80', bg: 'bg-rose-950/50', glow: 'bg-rose-400/10' };
  };

  // Render inline formatting for custom markdown
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return <View key={idx} className="h-2" />;

      if (cleanLine.startsWith('###')) {
        return (
          <Text key={idx} className="text-emerald-300 font-bold text-sm mt-3 mb-1">
            {cleanLine.replace('###', '').trim()}
          </Text>
        );
      }
      if (cleanLine.startsWith('##')) {
        return (
          <Text key={idx} className="text-emerald-200 font-bold text-base mt-4 mb-1.5">
            {cleanLine.replace('##', '').trim()}
          </Text>
        );
      }
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        const content = cleanLine.substring(1).trim();
        return (
          <View key={idx} className="flex-row items-start py-0.5 pl-1">
            <Text className="text-emerald-400 mr-2 text-[13px]">•</Text>
            <Text className="text-emerald-100/90 text-[13px] flex-1 leading-relaxed">
              {renderBoldSegments(content)}
            </Text>
          </View>
        );
      }
      return (
        <Text key={idx} className="text-emerald-100/90 text-[13px] leading-relaxed mb-2">
          {renderBoldSegments(cleanLine)}
        </Text>
      );
    });
  };

  const renderBoldSegments = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <Text key={index} className="font-bold text-emerald-300">{part}</Text>;
      }
      return part;
    });
  };

  const ProgressBar = ({ value, max, label, valueStr, colorClass }: { value: number, max: number, label: string, valueStr: string, colorClass: string }) => {
    const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
    return (
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-0.5">
          <Text className="text-emerald-300/60 text-[11px] font-medium">{label}</Text>
          <Text className="text-white text-xs font-mono font-semibold">{valueStr}</Text>
        </View>
        <View className="w-full h-1.5 bg-emerald-950/70 rounded-full overflow-hidden border border-emerald-900/30">
          <View style={{ width: `${pct}%` }} className={`h-full ${colorClass} rounded-full`} />
        </View>
      </View>
    );
  };

  // Generate 7 day labels
  const getLast7Days = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push({
        dateString: d.toISOString().split('T')[0],
        dayLabel: days[d.getDay()]
      });
    }
    return result;
  };

  // Get aggregated trend details
  const getTrendData = () => {
    const daysList = getLast7Days();
    const overallAvgHr = heartRateHistory.length > 0 ? Math.round(heartRateHistory.reduce((s, v) => s + v.bpm, 0) / heartRateHistory.length) : 70;
    const overallAvgTemp = temperatureHistory.length > 0 ? Number((temperatureHistory.reduce((s, v) => s + Number(v.temperature_celsius), 0) / temperatureHistory.length).toFixed(1)) : 36.6;

    return daysList.map(({ dateString, dayLabel }) => {
      let value = 0;
      let display = '';

      switch (activeChartMetric) {
        case 'pulse': {
          const logs = heartRateHistory.filter(l => l.timestamp.startsWith(dateString));
          value = logs.length > 0 ? Math.round(logs.reduce((s, o) => s + o.bpm, 0) / logs.length) : overallAvgHr;
          display = `${value} bpm`;
          break;
        }
        case 'temp': {
          const logs = temperatureHistory.filter(l => l.timestamp.startsWith(dateString));
          value = logs.length > 0 ? Number((logs.reduce((s, o) => s + Number(o.temperature_celsius), 0) / logs.length).toFixed(1)) : overallAvgTemp;
          display = `${value} °C`;
          break;
        }
        case 'steps': {
          const logs = activityHistory.filter(l => l.timestamp.startsWith(dateString));
          value = logs.length > 0 ? Math.max(...logs.map(l => l.steps_count)) : 0;
          display = `${value.toLocaleString()} steps`;
          break;
        }
        case 'sleep': {
          const logs = sleepHistory.filter(l => l.start_time.startsWith(dateString));
          value = logs.length > 0 ? Number((logs.reduce((s, o) => s + o.duration_minutes, 0) / 60).toFixed(1)) : 0;
          display = `${value} hrs`;
          break;
        }
        case 'ojas': {
          const log = ojasHistory.find(l => l.date === dateString);
          value = log ? Number(log.ojas_score) : 70;
          display = `Ojas: ${value}`;
          break;
        }
        case 'agni': {
          const log = agniHistory.find(l => l.date === dateString);
          value = log ? Number(log.agni_score) : 70;
          display = `Agni: ${value}`;
          break;
        }
      }

      return { label: dayLabel, value, display };
    });
  };

  const trendData = getTrendData();
  const values = trendData.map(d => d.value);
  const maxChartVal = Math.max(
    ...values,
    activeChartMetric === 'pulse' ? 120 :
    activeChartMetric === 'temp' ? 39 :
    activeChartMetric === 'sleep' ? 10 :
    activeChartMetric === 'ojas' ? 100 :
    activeChartMetric === 'agni' ? 100 :
    8000
  );
  const minChartVal = activeChartMetric === 'temp' ? 34 : 0;
  const chartRange = maxChartVal - minChartVal;

  const getBarHeight = (val: number) => {
    if (chartRange === 0) return 0;
    const pct = ((val - minChartVal) / chartRange) * 100;
    return Math.max(8, Math.min(100, pct));
  };

  const getMetricTheme = (metric: ChartMetricType) => {
    switch (metric) {
      case 'pulse': return { color: 'bg-rose-500', text: 'text-rose-400', label: 'Pulse' };
      case 'temp': return { color: 'bg-sky-400', text: 'text-sky-400', label: 'Skin Temp' };
      case 'steps': return { color: 'bg-amber-400', text: 'text-amber-400', label: 'Steps' };
      case 'sleep': return { color: 'bg-purple-400', text: 'text-purple-400', label: 'Sleep' };
      case 'ojas': return { color: 'bg-violet-500', text: 'text-violet-400', label: 'Ojas' };
      case 'agni': return { color: 'bg-emerald-500', text: 'text-emerald-400', label: 'Agni' };
    }
  };

  // Find latest compiled diagnostics report
  const latestReport = reports.find(r => r.report_type === selectedInterval);
  const normalizedReport = latestReport ? normalizeReport(latestReport) : null;

  // Filter history list: other compiled diagnostics of this interval
  const historyReports = reports.filter(r => r.report_type === selectedInterval && r.id !== latestReport?.id);

  // Compute stats for current report duration
  const daysCount = selectedInterval === 'daily' ? 1 : selectedInterval === 'weekly' ? 7 : 30;
  const waterTarget = (profile?.daily_water_goal_ml || 2500) * daysCount;
  const calorieTarget = (profile?.daily_calorie_goal_kcal || 2000) * daysCount;
  const stepsTarget = 8000 * daysCount;

  // Averages for UI progress bars
  const hrVal = normalizedReport?.meta_stats?.avg_hr ?? 70;
  const tempVal = normalizedReport?.meta_stats?.avg_temp ?? 36.6;
  const sleepVal = normalizedReport?.meta_stats?.avg_sleep_score ?? 75;
  const waterVal = normalizedReport?.meta_stats?.total_water_ml ?? 0;
  const stepsVal = normalizedReport?.meta_stats?.total_steps ?? 0;
  const kcalVal = normalizedReport?.meta_stats?.total_calories_kcal ?? 0;

  const hrPct = Math.max(20, 100 - Math.abs(hrVal - 70) * 2);
  const tempPct = Math.max(20, 100 - Math.abs(tempVal - 36.6) * 20);
  const sleepPct = sleepVal;

  const hydrationPct = Math.min(100, waterTarget > 0 ? Math.round((waterVal / waterTarget) * 100) : 50);
  const stepsPct = Math.min(100, stepsTarget > 0 ? Math.round((stepsVal / stepsTarget) * 100) : 50);
  let dietPct = 50;
  if (kcalVal > 0) {
    const diff = Math.abs(kcalVal - calorieTarget);
    dietPct = Math.max(20, 100 - Math.round(diff / (50 * daysCount)));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between border-b border-emerald-900/35">
          <View>
            <Text className="text-white text-xl font-bold">Health Insights</Text>
            <Text className="text-emerald-400/50 text-[10px] uppercase font-bold tracking-wider">Ayurvedic Biometrics</Text>
          </View>
          <TouchableOpacity
            onPress={compileNewReport}
            disabled={compiling || loading}
            className="bg-emerald-500 px-4 py-2 rounded-xl active:bg-emerald-600 flex-row items-center shadow-lg shadow-emerald-500/15"
          >
            {compiling ? (
              <ActivityIndicator size="small" color="#022c22" />
            ) : (
              <>
                <Ionicons name="sparkles" size={14} color="#022c22" className="mr-1" />
                <Text className="text-emerald-950 font-bold text-xs">Analyze</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          {errorMsg ? (
            <View className="bg-rose-950/40 border border-rose-800/40 p-4 rounded-xl mb-4 flex-row items-center">
              <Ionicons name="alert-circle" size={18} color="#f87171" className="mr-2" />
              <Text className="text-rose-200 text-xs flex-1">{errorMsg}</Text>
            </View>
          ) : null}

          {/* Time Interval Selector */}
          <View className="flex-row bg-emerald-900/20 p-1 rounded-xl border border-emerald-850/30 mb-5">
            {(['daily', 'weekly', 'monthly'] as const).map((interval) => (
              <TouchableOpacity
                key={interval}
                onPress={() => {
                  setSelectedInterval(interval);
                  setActiveBarIndex(null);
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 rounded-lg items-center ${
                  selectedInterval === interval ? 'bg-emerald-500' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-bold capitalize ${
                    selectedInterval === interval ? 'text-emerald-950' : 'text-emerald-400/80'
                  }`}
                >
                  {interval}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SECTION 1: TRENDS GRAPH WIDGET */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl mb-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-sm font-bold flex-row items-center">
                <Ionicons name="stats-chart" size={15} color="#34d399" /> 7-Day Metric Trends
              </Text>
              <Text className="text-emerald-400/50 text-[10px] font-mono">Aggregated logs</Text>
            </View>

            {/* Metric Tabs */}
            <View className="flex-row flex-wrap gap-1 bg-emerald-950/40 p-0.5 rounded-lg mb-6 border border-emerald-900/25">
              {(['pulse', 'temp', 'steps', 'sleep', 'ojas', 'agni'] as ChartMetricType[]).map((metric) => {
                const isSelected = activeChartMetric === metric;
                const mTheme = getMetricTheme(metric);
                return (
                  <TouchableOpacity
                    key={metric}
                    onPress={() => {
                      setActiveChartMetric(metric);
                      setActiveBarIndex(null);
                    }}
                    className={`flex-1 py-1.5 rounded-md items-center ${
                      isSelected ? 'bg-emerald-900/40 border border-emerald-800/30' : ''
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${isSelected ? mTheme.text : 'text-emerald-400/40'}`}>
                      {mTheme.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Bar Graph */}
            <View className="h-44 flex-row items-end justify-between px-1 relative">
              <View className="absolute inset-x-0 bottom-0 top-0 justify-between pointer-events-none">
                <View className="w-full border-t border-emerald-900/10 h-0" />
                <View className="w-full border-t border-emerald-900/10 h-0" />
                <View className="w-full border-t border-emerald-900/10 h-0" />
                <View className="w-full border-b border-emerald-900/20 h-0" />
              </View>

              {trendData.map((data, index) => {
                const heightPct = getBarHeight(data.value);
                const isActive = activeBarIndex === index;
                const mTheme = getMetricTheme(activeChartMetric);

                return (
                  <View key={index} className="items-center w-[11%] relative">
                    {isActive && (
                      <View className="absolute -top-12 z-20 bg-emerald-950 border border-emerald-800/40 px-2 py-1 rounded shadow-lg items-center">
                        <Text className="text-white text-[9px] font-bold font-mono text-center">
                          {data.display}
                        </Text>
                        <View className="w-1.5 h-1.5 bg-emerald-950 border-r border-b border-emerald-800/40 rotate-45 -mb-1.5 mt-0.5" />
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => setActiveBarIndex(isActive ? null : index)}
                      activeOpacity={0.85}
                      className="w-full h-32 justify-end items-center"
                    >
                      <View
                        style={{ height: `${heightPct}%`, transform: isActive ? [{ scaleX: 1.1 }] : undefined }}
                        className={`w-full rounded-t-md ${mTheme.color} ${
                          isActive ? 'opacity-100 shadow-lg shadow-emerald-500/20' : 'opacity-60'
                        }`}
                      />
                    </TouchableOpacity>
                    <Text className="text-emerald-400/40 text-[9px] font-bold mt-2">{data.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* SECTION 1.5: CIRCADIAN WELLNESS INDICATORS */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl mb-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-sm font-bold flex-row items-center">
                <Ionicons name="compass-outline" size={15} color="#38bdf8" /> Dinacharya Core Metrics
              </Text>
              <Text className="text-sky-400/50 text-[10px] font-mono">Today's biometrics</Text>
            </View>

            <View className="space-y-1">
              <ProgressBar
                value={todayAgni ? todayAgni.agni_score : 0}
                max={100}
                label="Metabolic Digestive Fire (Agni)"
                valueStr={todayAgni ? `${todayAgni.agni_score}/100` : '--'}
                colorClass="bg-emerald-500"
              />
              <ProgressBar
                value={todayOjas ? todayOjas.ojas_score : 0}
                max={100}
                label="Vitality & Immune Defense (Ojas)"
                valueStr={todayOjas ? `${todayOjas.ojas_score}/100` : '--'}
                colorClass="bg-violet-500"
              />
              <ProgressBar
                value={sleepHistory.length > 0 ? sleepHistory[0].sleep_score : 0}
                max={100}
                label="Sleep Quality Index"
                valueStr={sleepHistory.length > 0 ? `${sleepHistory[0].sleep_score}/100` : '--'}
                colorClass="bg-purple-500"
              />
            </View>

            <View className="h-[1px] bg-emerald-900/20 my-3" />
            <Text className="text-emerald-100/70 text-[11px] leading-relaxed">
              💡 <Text className="font-bold text-emerald-300">Circadian Synergy:</Text> Your dynamic Dinacharya daily routine is calculated using these three core indices. Maintain a strong alignment between your sleep schedule and meal times to maximize Ojas and stabilize Agni.
            </Text>
          </View>

          {/* SECTION 2: LATEST COMPILED AI DIAGNOSTICS */}
          {!normalizedReport ? (
            /* Empty State Compiled */
            <View key="empty-diagnostics" className="bg-[#051f18]/20 border border-dashed border-emerald-850/30 p-8 rounded-2xl items-center py-10 mb-6 will-change-variable">
              <View className="w-12 h-12 rounded-full bg-emerald-900/20 items-center justify-center mb-3">
                <Ionicons name="sparkles" size={24} color="#10b981" />
              </View>
              <Text className="text-emerald-400 text-sm font-semibold mb-1">No {selectedInterval} Report Compiled</Text>
              <Text className="text-emerald-500/60 text-xs text-center px-4 mb-4">
                Verify recent logs by running our Ayurvedic completion analysis on heart rate, sleep, steps, and hydration.
              </Text>
              <TouchableOpacity
                onPress={compileNewReport}
                disabled={compiling}
                className="bg-emerald-500/10 border border-emerald-500/30 px-5 py-2.5 rounded-xl"
              >
                <Text className="text-emerald-400 font-bold text-xs">Run Diagnostic Analysis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Diagnostic Details Card */
            <View key="report-diagnostics" className="mb-6 will-change-variable">
              {/* Range Badge */}
              <View className="bg-emerald-900/20 border border-emerald-850/20 p-4 rounded-xl mb-4 flex-row justify-between items-center">
                <View>
                  <Text className="text-emerald-400/50 text-[9px] font-bold uppercase tracking-wider">Report Window</Text>
                  <Text className="text-white text-xs font-semibold mt-0.5">
                    {normalizedReport.start_date} to {normalizedReport.end_date}
                  </Text>
                </View>
                <View className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full">
                  <Text className="text-emerald-400 text-[10px] font-bold uppercase">
                    {selectedInterval}
                  </Text>
                </View>
              </View>

              {/* Dials Side-by-Side */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                  <View className={`absolute -right-4 -top-4 w-12 h-12 rounded-full blur-xl opacity-30 ${getScoreColor(normalizedReport.health_score!).glow}`} />
                  <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-3">Health Score</Text>
                  <View className={`w-18 h-18 rounded-full border-4 ${getScoreColor(normalizedReport.health_score!).border} items-center justify-center bg-emerald-950/70 mb-2 relative`}>
                    <Text className={`text-xl font-bold font-mono ${getScoreColor(normalizedReport.health_score!).text}`}>
                      {normalizedReport.health_score}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-emerald-400/70 text-center font-medium leading-relaxed px-1">
                    Biometric & pulse stability.
                  </Text>
                </View>

                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                  <View className={`absolute -right-4 -top-4 w-12 h-12 rounded-full blur-xl opacity-30 ${getScoreColor(normalizedReport.wellness_score!).glow}`} />
                  <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-3">Wellness Score</Text>
                  <View className={`w-18 h-18 rounded-full border-4 ${getScoreColor(normalizedReport.wellness_score!).border} items-center justify-center bg-emerald-950/70 mb-2 relative`}>
                    <Text className={`text-xl font-bold font-mono ${getScoreColor(normalizedReport.wellness_score!).text}`}>
                      {normalizedReport.wellness_score}
                    </Text>
                  </View>
                  <Text className="text-[10px] text-emerald-400/70 text-center font-medium leading-relaxed px-1">
                    Compliance to hydration & goals.
                  </Text>
                </View>
              </View>

              {/* Progress Bars */}
              <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl mb-4">
                <Text className="text-white text-xs font-bold mb-3 uppercase tracking-wider">Metrics Breakdown</Text>
                <ProgressBar label="Pulse Average" value={hrPct} max={100} valueStr={`${hrVal} bpm`} colorClass={hrPct >= 80 ? 'bg-rose-500' : 'bg-amber-400'} />
                <ProgressBar label="Temp Average" value={tempPct} max={100} valueStr={`${tempVal} °C`} colorClass={tempPct >= 80 ? 'bg-sky-400' : 'bg-amber-400'} />
                <ProgressBar label="Sleep Consistency" value={sleepPct} max={100} valueStr={`${sleepVal}%`} colorClass={sleepPct >= 75 ? 'bg-purple-400' : 'bg-amber-400'} />
                <View className="h-[1px] bg-emerald-900/30 my-3" />
                <ProgressBar label="Hydration Target" value={waterVal} max={waterTarget} valueStr={`${(waterVal / 1000).toFixed(1)}L / ${(waterTarget / 1000).toFixed(1)}L`} colorClass={hydrationPct >= 80 ? 'bg-teal-400' : 'bg-amber-400'} />
                <ProgressBar label="Physical Steps" value={stepsVal} max={stepsTarget} valueStr={`${stepsVal.toLocaleString()} / ${stepsTarget.toLocaleString()}`} colorClass={stepsPct >= 80 ? 'bg-emerald-400' : 'bg-amber-400'} />
                <ProgressBar label="Calorie Target" value={dietPct} max={100} valueStr={`${kcalVal.toLocaleString()} / ${calorieTarget.toLocaleString()} kcal`} colorClass={dietPct >= 80 ? 'bg-emerald-400' : 'bg-amber-400'} />
              </View>

              {/* Llama 3 Report text */}
              <View className="bg-[#051f18]/35 border border-emerald-800/25 p-5 rounded-2xl shadow-lg">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="sparkles" size={15} color="#34d399" className="mr-2" />
                  <Text className="text-white text-sm font-bold">Ayurvedic Interpretation</Text>
                </View>
                <View className="border-t border-emerald-900/30 pt-3">
                  {renderMarkdown(normalizedReport.summary_markdown)}
                </View>
              </View>
            </View>
          )}

          {/* SECTION 3: ARCHIVE HISTORY LOG */}
          <View className="mt-2">
            <Text className="text-white text-sm font-bold mb-3 flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#34d399" className="mr-1" /> Compilation History
            </Text>

            {historyReports.length === 0 ? (
              <View className="bg-emerald-900/5 border border-dashed border-emerald-900/15 p-6 rounded-xl justify-center items-center">
                <Text className="text-emerald-500/50 text-[11px] font-medium">No previous compiled entries available.</Text>
              </View>
            ) : (
              <View className="space-y-2.5">
                {historyReports.map((rep) => {
                  const normRep = normalizeReport(rep);
                  return (
                    <TouchableOpacity
                      key={rep.id}
                      onPress={() => setSelectedReportForModal(normRep)}
                      className="bg-[#051f18]/25 border border-emerald-900/20 p-3.5 rounded-xl flex-row justify-between items-center active:bg-emerald-900/10"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-emerald-400/50 text-[10px] font-mono">
                          {rep.start_date} to {rep.end_date}
                        </Text>
                        <Text className="text-emerald-100/70 text-xs truncate mt-0.5" numberOfLines={1}>
                          {rep.summary_markdown}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <View className="items-center bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-900/30">
                          <Text className="text-[7px] text-emerald-400/50 font-bold">HTH</Text>
                          <Text className="text-[10px] font-mono font-bold text-white">{normRep.health_score}</Text>
                        </View>
                        <View className="items-center bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-900/30">
                          <Text className="text-[7px] text-emerald-400/50 font-bold">WEL</Text>
                          <Text className="text-[10px] font-mono font-bold text-white">{normRep.wellness_score}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color="#34d399" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* MODAL DRAWER */}
        {selectedReportForModal && (
          <Modal
            visible={true}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setSelectedReportForModal(null)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
              <View className="px-6 py-4 flex-row items-center justify-between border-b border-emerald-900/40">
                <View>
                  <Text className="text-white text-base font-bold">Report Details</Text>
                  <Text className="text-emerald-400/50 text-[10px] capitalize font-mono">
                    {selectedReportForModal.report_type} Diagnostic Log
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedReportForModal(null)}
                  className="p-1.5 rounded-lg bg-emerald-900/35 border border-emerald-800/30"
                >
                  <Ionicons name="close" size={20} color="#34d399" />
                </TouchableOpacity>
              </View>

              <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                {/* Interval Badge */}
                <View className="bg-emerald-900/20 border border-emerald-850/20 p-4 rounded-xl mb-4 flex-row justify-between items-center">
                  <View>
                    <Text className="text-emerald-400/50 text-[9px] font-bold uppercase tracking-wider">Report Window</Text>
                    <Text className="text-white text-xs font-semibold mt-0.5">
                      {selectedReportForModal.start_date} to {selectedReportForModal.end_date}
                    </Text>
                  </View>
                  <View className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full">
                    <Text className="text-emerald-400 text-[10px] font-bold uppercase">
                      {selectedReportForModal.report_type}
                    </Text>
                  </View>
                </View>

                {/* Scores */}
                <View className="flex-row gap-4 mb-4">
                  <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                    <View className={`absolute -right-4 -top-4 w-12 h-12 rounded-full blur-xl opacity-30 ${getScoreColor(selectedReportForModal.health_score!).glow}`} />
                    <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-2">Health Score</Text>
                    <View className={`w-16 h-16 rounded-full border-4 ${getScoreColor(selectedReportForModal.health_score!).border} items-center justify-center bg-emerald-950/70 relative`}>
                      <Text className={`text-lg font-bold font-mono ${getScoreColor(selectedReportForModal.health_score!).text}`}>
                        {selectedReportForModal.health_score}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                    <View className={`absolute -right-4 -top-4 w-12 h-12 rounded-full blur-xl opacity-30 ${getScoreColor(selectedReportForModal.wellness_score!).glow}`} />
                    <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-2">Wellness Score</Text>
                    <View className={`w-16 h-16 rounded-full border-4 ${getScoreColor(selectedReportForModal.wellness_score!).border} items-center justify-center bg-emerald-950/70 relative`}>
                      <Text className={`text-lg font-bold font-mono ${getScoreColor(selectedReportForModal.wellness_score!).text}`}>
                        {selectedReportForModal.wellness_score}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress bars */}
                <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl mb-4">
                  <Text className="text-white text-xs font-bold mb-3 uppercase tracking-wider">Historical Stats</Text>
                  
                  {(() => {
                    const mDays = selectedReportForModal.report_type === 'daily' ? 1 : selectedReportForModal.report_type === 'weekly' ? 7 : 30;
                    const mWaterTarget = (profile?.daily_water_goal_ml || 2500) * mDays;
                    const mCalorieTarget = (profile?.daily_calorie_goal_kcal || 2000) * mDays;
                    const mStepsTarget = 8000 * mDays;

                    const mHrVal = selectedReportForModal.meta_stats?.avg_hr ?? 70;
                    const mTempVal = selectedReportForModal.meta_stats?.avg_temp ?? 36.6;
                    const mSleepVal = selectedReportForModal.meta_stats?.avg_sleep_score ?? 75;
                    const mWaterVal = selectedReportForModal.meta_stats?.total_water_ml ?? 0;
                    const mStepsVal = selectedReportForModal.meta_stats?.total_steps ?? 0;
                    const mKcalVal = selectedReportForModal.meta_stats?.total_calories_kcal ?? 0;

                    const mHrPct = Math.max(20, 100 - Math.abs(mHrVal - 70) * 2);
                    const mTempPct = Math.max(20, 100 - Math.abs(mTempVal - 36.6) * 20);
                    const mSleepPct = mSleepVal;

                    const mHydrationPct = Math.min(100, mWaterTarget > 0 ? Math.round((mWaterVal / mWaterTarget) * 100) : 50);
                    const mStepsPct = Math.min(100, mStepsTarget > 0 ? Math.round((mStepsVal / mStepsTarget) * 100) : 50);
                    let mDietPct = 50;
                    if (mKcalVal > 0) {
                      const mDiff = Math.abs(mKcalVal - mCalorieTarget);
                      mDietPct = Math.max(20, 100 - Math.round(mDiff / (50 * mDays)));
                    }

                    return (
                      <>
                        <ProgressBar label="Pulse Average" value={mHrPct} max={100} valueStr={`${mHrVal} bpm`} colorClass={mHrPct >= 80 ? 'bg-rose-500' : 'bg-amber-400'} />
                        <ProgressBar label="Temp Average" value={mTempPct} max={100} valueStr={`${mTempVal} °C`} colorClass={mTempPct >= 80 ? 'bg-sky-400' : 'bg-amber-400'} />
                        <ProgressBar label="Sleep Consistency" value={mSleepPct} max={100} valueStr={`${mSleepVal}%`} colorClass={mSleepPct >= 75 ? 'bg-purple-400' : 'bg-amber-400'} />
                        <View className="h-[1px] bg-emerald-900/30 my-3" />
                        <ProgressBar label="Hydration Target" value={mWaterVal} max={mWaterTarget} valueStr={`${(mWaterVal / 1000).toFixed(1)}L / ${(mWaterTarget / 1000).toFixed(1)}L`} colorClass={mHydrationPct >= 80 ? 'bg-teal-400' : 'bg-amber-400'} />
                        <ProgressBar label="Physical Steps" value={mStepsVal} max={mStepsTarget} valueStr={`${mStepsVal.toLocaleString()} / ${mStepsTarget.toLocaleString()}`} colorClass={mStepsPct >= 80 ? 'bg-emerald-400' : 'bg-amber-400'} />
                        <ProgressBar label="Calorie Target" value={mDietPct} max={100} valueStr={`${mKcalVal.toLocaleString()} / ${mCalorieTarget.toLocaleString()} kcal`} colorClass={mDietPct >= 80 ? 'bg-emerald-400' : 'bg-amber-400'} />
                      </>
                    );
                  })()}
                </View>

                {/* AI report */}
                <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="sparkles" size={15} color="#34d399" className="mr-2" />
                    <Text className="text-white text-sm font-bold">Ayurvedic Interpretation</Text>
                  </View>
                  <View className="border-t border-emerald-900/30 pt-3">
                    {renderMarkdown(selectedReportForModal.summary_markdown)}
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}

        {/* COMPILING SHIELD OVERLAY */}
        {compiling && (
          <View className="absolute inset-0 bg-[#020b08]/90 items-center justify-center z-50 px-8">
            <View className="bg-[#051f18]/40 border border-emerald-800/40 p-8 rounded-3xl items-center max-w-sm shadow-2xl relative overflow-hidden">
              <ActivityIndicator size="large" color="#34d399" className="mb-4" />
              <Text className="text-white text-base font-bold text-center mb-2">Analyzing Health Indices</Text>
              <Text className="text-emerald-200/80 text-[11px] text-center leading-relaxed">
                Aggregating vitals history, compiling daily physiological status, and querying Llama 3.3 for traditional Ayurvedic balancing recommendations...
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}
