import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/useAuthStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { useSleepStore } from '../../store/useSleepStore';
import { useAgniStore } from '../../store/useAgniStore';
import { useOjasStore } from '../../store/useOjasStore';
import { useDigitalTwinStore } from '../../store/useDigitalTwinStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useDoshaStore } from '../../store/useDoshaStore';
import { supabase } from '../../services/supabase';
import { compileAnalyticsReport } from '../../services/analyticsService';
import { generateDailyBriefing, DailyBriefingSnapshot } from '../../services/dailyIntelligence';
import { generateHealthPredictions } from '../../services/predictiveEngine';
import AyurExplanationSheet from '../../components/AyurExplanationSheet';
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';

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
  const liveData = useSensorStore(state => state.liveData);
  const currentDosha = useDoshaStore(state => state.currentDosha);
  const { agni, ojas } = useDigitalTwinStore();

  const [reports, setReports] = useState<HealthReportRecord[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<DailyBriefingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [activeChartMetric, setActiveChartMetric] = useState<ChartMetricType>('pulse');
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);
  const [selectedReportForModal, setSelectedReportForModal] = useState<HealthReportRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [storyInterval, setStoryInterval] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedTimelineDay, setSelectedTimelineDay] = useState(6);

  const last7DaysData = useMemo(() => {
    const days = [];
    const dateNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      const dayIndex = (d.getDay() + 6) % 7;
      const label = dateNames[dayIndex];
      const dateIso = d.toISOString().split('T')[0];
      
      const hrLog = heartRateHistory.find(h => h.timestamp.startsWith(dateIso))?.bpm || 68 + (dayIndex % 3) * 3;
      const sleepLog = sleepHistory.find(s => s.start_time.startsWith(dateIso))?.sleep_score || 75 + (dayIndex % 2) * 6;
      const stepsLog = activityHistory.find(a => a.timestamp.startsWith(dateIso))?.steps_count || 5500 + (dayIndex % 3) * 1400;
      
      let story = "";
      let doshaStr = "";
      let recovery = 72 + (dayIndex % 3) * 8;
      let agniScore = 75 + (dayIndex % 2) * 5;
      let ojasScore = 78 - (dayIndex % 3) * 4;
      
      if (dayIndex % 3 === 0) {
        doshaStr = "Vata Accumulated";
        story = `Late-night heart rate variations (${hrLog} bpm) coincided with a slight sleep score dip to ${sleepLog}/100. This combination aggravated Vata wind elements, bringing recovery down to ${recovery}%. To counteract this, warm chamomile herbal pairings were recommended to calm the nervous channels.`;
      } else if (dayIndex % 3 === 1) {
        doshaStr = "Pitta Fire Peak";
        story = `Strong metabolic Agni was active today, scaling digestive efficiency to ${agniScore}%. Your active steps reached ${stepsLog}, supporting cardiovascular channels with stable pulse averages. Avoid adding spicy seasonings tonight to prevent Pitta acid accumulations.`;
      } else {
        doshaStr = "Kapha Homeostasis";
        story = `A deeply grounding day. Restorative sleep peaked at ${sleepLog}/100, nourishing your tissue Ojas immune shield to ${ojasScore}%. Steady hydration and timely meals balanced Kapha water energies, maintaining optimal metabolic stasis and bringing recovery to ${recovery}%.`;
      }

      days.push({
        label,
        date: dateStr,
        hr: hrLog,
        sleep: sleepLog,
        steps: stepsLog,
        dosha: doshaStr,
        recovery,
        agni: agniScore,
        ojas: ojasScore,
        story
      });
    }
    return days;
  }, [heartRateHistory, sleepHistory, activityHistory]);

  const [explanationVisible, setExplanationVisible] = useState(false);
  const [explanationContext, setExplanationContext] = useState<ExplanationContext | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleShareWeeklyPdf = async () => {
    if (!user?.id) return;
    setPdfLoading(true);
    try {
      const { generateWeeklyReportPdf } = require('../../services/weeklyPdfService');
      const { pdfUri } = await generateWeeklyReportPdf(user.id);
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Weekly Ayurvedic Intelligence Report',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Sharing Unavailable', 'PDF successfully generated at ' + pdfUri);
      }
    } catch (err: any) {
      console.warn('[WeeklyPDF] Share failed:', err);
      Alert.alert('Export Failed', err.message || 'Unable to compile PDF document.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleOpenExplanation = (recommendationTitle: string) => {
    const biometricsSnapshot = liveData ? {
      heartRate: liveData.heartRate,
      temperature: liveData.temperature,
      steps: liveData.steps,
      activity: liveData.activity
    } : null;
    const doshaPercentages = currentDosha ? {
      vata: currentDosha.vata,
      pitta: currentDosha.pitta,
      kapha: currentDosha.kapha
    } : null;
    const agniScoreVal = todayAgni?.agni_score || agni || 75;
    const ojasScoreVal = todayOjas?.ojas_score || ojas || 78;

    const ctx = getExplanationForRecommendation(
      recommendationTitle,
      biometricsSnapshot,
      doshaPercentages,
      agniScoreVal,
      ojasScoreVal
    );
    setExplanationContext(ctx);
    setExplanationVisible(true);
  };

  const fetchReportsAndData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const [reportsRes, briefingRes] = await Promise.all([
        supabase
          .from('health_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('ai_insights')
          .select('*')
          .eq('user_id', user.id)
          .eq('insight_type', 'daily_summary')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle(),
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

      if (briefingRes.data && briefingRes.data.metadata_snapshot) {
        setTodayBriefing(briefingRes.data.metadata_snapshot as any);
      } else {
        setTodayBriefing(null);
      }

      // Auto compile report if empty
      if (loadedReports.length === 0) {
        const hrCount = (useTelemetryStore.getState().heartRateHistory || []).length;
        if (hrCount > 0) {
          setCompiling(true);
          try {
            const newReport = await compileAnalyticsReport(user.id, selectedInterval);
            setReports([newReport]);
          } catch (e) {
            console.warn('[Oracle] Auto report compilation failed:', e);
          } finally {
            setCompiling(false);
          }
        }
      }
    } catch (e) {
      console.warn('[Oracle] Error loading data:', e);
      setErrorMsg('Failed to load historic forecast analytics.');
    } finally {
      setLoading(false);
    }
  };

  const compileTodayBriefing = async () => {
    if (!user?.id) return;
    setBriefingLoading(true);
    setErrorMsg('');
    try {
      const result = await generateDailyBriefing(user.id);
      setTodayBriefing(result.metadata);
    } catch (e: any) {
      console.warn('[Oracle] Briefing compilation failed:', e);
      setErrorMsg(e.message || 'Failed to generate Daily Intelligence Briefing.');
    } finally {
      setBriefingLoading(false);
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
      console.warn('[Oracle] Report compilation error:', e);
      setErrorMsg(e.message || 'Failed to compile report. Make sure Groq key is configured.');
    } finally {
      setCompiling(false);
    }
  };

  const normalizeReport = (rep: HealthReportRecord): HealthReportRecord => {
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

    const daysCount = selectedInterval === 'daily' ? 1 : selectedInterval === 'weekly' ? 7 : 30;

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-400', border: 'border-emerald-500/80', bg: 'bg-emerald-950/80', glow: 'bg-emerald-400/20' };
    if (score >= 50) return { text: 'text-amber-400', border: 'border-amber-500/80', bg: 'bg-amber-950/50', glow: 'bg-amber-400/10' };
    return { text: 'text-rose-400', border: 'border-rose-500/80', bg: 'bg-rose-950/50', glow: 'bg-rose-400/10' };
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return <View key={idx} className="h-2" />;

      if (cleanLine.startsWith('###')) {
        return <Text key={idx} className="text-emerald-300 font-bold text-sm mt-3 mb-1">{cleanLine.replace('###', '').trim()}</Text>;
      }
      if (cleanLine.startsWith('##')) {
        return <Text key={idx} className="text-emerald-200 font-bold text-base mt-4 mb-1.5">{cleanLine.replace('##', '').trim()}</Text>;
      }
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        return (
          <View key={idx} className="flex-row items-start py-0.5 pl-1">
            <Text className="text-emerald-400 mr-2 text-[13px]">•</Text>
            <Text className="text-emerald-100/90 text-[13px] flex-1 leading-relaxed">{renderBoldSegments(cleanLine.substring(1).trim())}</Text>
          </View>
        );
      }
      return <Text key={idx} className="text-emerald-100/90 text-[13px] leading-relaxed mb-2">{renderBoldSegments(cleanLine)}</Text>;
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

  const latestReport = reports.find(r => r.report_type === selectedInterval);
  const normalizedReport = latestReport ? normalizeReport(latestReport) : null;
  const historyReports = reports.filter(r => r.report_type === selectedInterval && r.id !== latestReport?.id);

  const daysCount = selectedInterval === 'daily' ? 1 : selectedInterval === 'weekly' ? 7 : 30;
  const waterTarget = (profile?.daily_water_goal_ml || 2500) * daysCount;
  const calorieTarget = (profile?.daily_calorie_goal_kcal || 2000) * daysCount;
  const stepsTarget = 8000 * daysCount;

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
            <Text className="text-white text-lg font-serif font-black">Ayurvedic Oracle</Text>
            <Text className="text-emerald-400/50 text-[10px] uppercase font-bold tracking-wider">Imbalance Forecasting & Trends</Text>
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
                <Text className="text-emerald-950 font-bold text-xs">Forecast</Text>
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

          {/* ================= SECTION: DUAL INTELLIGENCE BRIEFING ================= */}
          {todayBriefing ? (
            <View className="bg-emerald-950/20 border border-emerald-800/35 p-5 rounded-3xl mb-6 shadow-xl shadow-emerald-950/20">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="sparkles" size={18} color="#10b981" style={{ marginRight: 8 }} />
                  <Text className="text-white text-base font-bold">Daily Intelligence Briefing</Text>
                </View>
                <TouchableOpacity
                  onPress={compileTodayBriefing}
                  disabled={briefingLoading}
                  className="bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-900/30 flex-row items-center"
                >
                  {briefingLoading ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={13} color="#34d399" style={{ marginRight: 4 }} />
                      <Text className="text-emerald-400 text-[10px] font-bold">Re-Calibrate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Greeting Summary */}
              <Text className="text-emerald-100/90 text-sm leading-relaxed mb-4">
                {todayBriefing.summary}
              </Text>

              {/* Health Mission */}
              <View className="bg-emerald-900/10 border border-emerald-800/30 p-4 rounded-2xl mb-4 flex-row items-center">
                <Text className="text-xl mr-3">🎯</Text>
                <View className="flex-1">
                  <Text className="text-emerald-400 text-[10px] uppercase font-serif font-bold tracking-wider">Today's Health Mission</Text>
                  <Text className="text-white text-sm font-bold mt-0.5">{todayBriefing.mission}</Text>
                </View>
              </View>

              {/* Risks & Opportunities side-by-side */}
              <View className="flex-row space-x-3 mb-4">
                {/* Risks */}
                <View className="flex-1 bg-red-950/20 border border-red-900/20 p-4 rounded-2xl">
                  <Text className="text-red-400 text-xs font-serif font-bold flex-row items-center">
                    <Ionicons name="warning-outline" size={12} style={{ marginRight: 4 }} /> Today's Risks
                  </Text>
                  <Text className="text-red-200/70 text-[11px] leading-relaxed mt-1.5">{todayBriefing.risks}</Text>
                </View>
                
                {/* Opportunities */}
                <View className="flex-1 bg-emerald-950/40 border border-emerald-900/20 p-4 rounded-2xl">
                  <Text className="text-emerald-400 text-xs font-serif font-bold flex-row items-center">
                    <Ionicons name="bulb-outline" size={12} style={{ marginRight: 4 }} /> Opportunities
                  </Text>
                  <Text className="text-emerald-200/70 text-[11px] leading-relaxed mt-1.5">{todayBriefing.opportunities}</Text>
                </View>
              </View>

              {/* Forecast Outcome Scores (Dosha, Agni, Ojas) */}
              <View className="bg-emerald-950/30 border border-emerald-900/20 p-4 rounded-2xl mb-4">
                <Text className="text-emerald-400 text-xs font-serif font-bold uppercase tracking-wider mb-2.5">Expected Outcomes Tomorrow</Text>
                <View className="flex-row justify-around items-center pt-1">
                  <View className="items-center">
                    <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Expected Dosha</Text>
                    <Text className="text-white text-xs font-bold mt-1">
                      V:{Math.round(todayBriefing.expectedDosha?.vata || 33)}% | P:{Math.round(todayBriefing.expectedDosha?.pitta || 33)}%
                    </Text>
                  </View>
                  <View className="h-6 w-[1px] bg-emerald-800/20" />
                  <View className="items-center">
                    <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Expected Agni</Text>
                    <Text className="text-white text-xs font-bold mt-1">{todayBriefing.expectedAgni || 75}%</Text>
                  </View>
                  <View className="h-6 w-[1px] bg-emerald-800/20" />
                  <View className="items-center">
                    <Text className="text-emerald-400/50 text-[9px] uppercase font-bold">Expected Ojas</Text>
                    <Text className="text-white text-xs font-bold mt-1">{todayBriefing.expectedOjas || 78}%</Text>
                  </View>
                </View>
              </View>

              {/* Recommendations */}
              <View className="mb-4">
                <Text className="text-emerald-300 text-xs font-serif font-bold mb-2">Actions to Take</Text>
                <View className="space-y-2">
                  {todayBriefing.recommendations.map((rec, idx) => (
                    <View key={idx} className="flex-row items-center bg-emerald-950/40 px-3.5 py-3 rounded-xl border border-emerald-900/20 justify-between">
                      <View className="flex-row items-center flex-1 mr-2">
                        <Ionicons name="checkbox-outline" size={16} color="#10b981" style={{ marginRight: 8 }} />
                        <Text className="text-emerald-100/90 text-xs flex-1 leading-relaxed">{rec}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleOpenExplanation(rec)}
                        className="bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/20"
                      >
                        <Text className="text-emerald-400 font-bold text-[8px] uppercase tracking-wider">WHY?</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>

              {/* Expected Recovery */}
              <View className="bg-emerald-900/10 border border-emerald-800/20 p-3.5 rounded-xl">
                <Text className="text-emerald-400 text-xs font-serif font-bold">Expected Recovery</Text>
                <Text className="text-emerald-200/60 text-xs mt-0.5 leading-relaxed">{todayBriefing.expectedRecovery}</Text>
              </View>
            </View>
          ) : (
            <View className="bg-emerald-950/20 border border-emerald-800/35 p-6 rounded-3xl mb-6 items-center">
              <Ionicons name="sparkles-outline" size={32} color="#047857" style={{ marginBottom: 12 }} />
              <Text className="text-white text-sm font-serif font-bold text-center mb-1">Calibration Required</Text>
              <Text className="text-emerald-400/60 text-xs text-center px-4 mb-4">
                Generate today's morning diagnostic briefing based on your latest steps, heart rates, sleep, and constitution tags.
              </Text>
              
              <TouchableOpacity
                onPress={compileTodayBriefing}
                disabled={briefingLoading}
                className="bg-emerald-500 py-3 px-6 rounded-xl flex-row justify-center items-center active:bg-emerald-600 shadow-md shadow-emerald-500/10"
              >
                {briefingLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                    <Text className="text-emerald-950 font-bold text-xs">Analyzing Biometrics...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color="#022c22" style={{ marginRight: 6 }} />
                    <Text className="text-emerald-950 font-bold text-xs">Generate Today's Intelligence</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* DYNAMIC SHAT KRIYA KALA PATHOLOGY METER */}
          <ShatKriyaMeter />

          {/* DYNAMIC PREDICTIVE IMBLANCE WARNING */}
          <PredictiveWarningCard />

          {/* DYNAMIC PREDICTIVE HEALTH FORECAST */}
          <PredictiveForecastCard />

          {/* COACH QUICK ACCESS CONSULT TRIGGER */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/coach')}
            activeOpacity={0.85}
            className="bg-[#051f18]/30 border border-emerald-800/30 p-5 rounded-3xl mb-6 flex-row items-center justify-between active:bg-emerald-900/10"
          >
            <View className="flex-1 mr-4">
              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-0.5">Need Ayurvedic Corrections?</Text>
              <Text className="text-white text-base font-extrabold mb-1">Consult AquaGuru AI</Text>
              <Text className="text-emerald-200/60 text-[10px] leading-relaxed">
                Get step-by-step corrections, daily tips, and custom tea recipes to clear these predicted element accumulations.
              </Text>
            </View>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#34d399" />
          </TouchableOpacity>

          {/* ================= SECTION: STORYTELLER ANALYTICS ================= */}
          <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-3xl mb-6">
            <View className="flex-row justify-between items-center mb-4 border-b border-emerald-950 pb-3">
              <View className="flex-row items-center">
                <Ionicons name="journal-outline" size={16} color="#34d399" />
                <Text className="text-white text-sm font-serif font-black ml-2">Ayurvedic Biometric Story</Text>
              </View>
              
              {/* Weekly/Monthly Story Toggle */}
              <View className="flex-row bg-[#111d19] p-0.5 rounded-lg border border-[#1f372f]">
                {(['weekly', 'monthly'] as const).map((type) => {
                  const isSelected = storyInterval === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setStoryInterval(type)}
                      className={`px-3 py-1 rounded-md ${isSelected ? 'bg-emerald-500' : ''}`}
                    >
                      <Text className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-emerald-955' : 'text-emerald-400/60'}`}>
                        {type === 'weekly' ? 'Weekly' : 'Monthly'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {storyInterval === 'weekly' ? (
              <View className="space-y-4">
                {/* 7-DAY INTERACTIVE TIMELINE SWIPER */}
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono">Interactive Daily Storyline</Text>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                  {last7DaysData.map((day, idx) => {
                    const isSelected = selectedTimelineDay === idx;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => setSelectedTimelineDay(idx)}
                        className={`items-center justify-center w-12 h-12 rounded-full mr-2.5 border ${
                          isSelected 
                            ? 'bg-emerald-500 border-emerald-400' 
                            : 'bg-[#111d19] border-[#1f372f]'
                        }`}
                      >
                        <Text className={`text-[9px] font-black ${isSelected ? 'text-emerald-955' : 'text-emerald-400/50'}`}>
                          {day.label}
                        </Text>
                        <Text className={`text-[8px] font-mono mt-0.5 ${isSelected ? 'text-emerald-950 font-bold' : 'text-slate-400'}`}>
                          {day.recovery}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Day narrative detail card */}
                {last7DaysData[selectedTimelineDay] && (
                  <View className="bg-[#111d19]/45 border border-[#1f372f] p-4.5 rounded-2xl">
                    <View className="flex-row justify-between items-center mb-2.5">
                      <Text className="text-white text-xs font-serif font-black">
                        {last7DaysData[selectedTimelineDay].date} Story
                      </Text>
                      <View className="bg-emerald-500/10 border border-emerald-500/35 px-2 py-0.5 rounded-full">
                        <Text className="text-emerald-400 text-[8px] font-bold uppercase font-mono">
                          {last7DaysData[selectedTimelineDay].dosha}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-slate-200 text-xs leading-relaxed font-sans">
                      {last7DaysData[selectedTimelineDay].story}
                    </Text>

                    {/* Vitals snapshot layout */}
                    <View className="flex-row justify-around mt-4 pt-3 border-t border-[#1f372f]/45">
                      <View className="items-center">
                        <Text className="text-emerald-400/50 text-[8px] uppercase font-bold">Pulse Rate</Text>
                        <Text className="text-white text-xs font-bold font-mono mt-0.5">{last7DaysData[selectedTimelineDay].hr} bpm</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-emerald-400/50 text-[8px] uppercase font-bold">Sleep Index</Text>
                        <Text className="text-white text-xs font-bold font-mono mt-0.5">{last7DaysData[selectedTimelineDay].sleep}/100</Text>
                      </View>
                      <View className="items-center">
                        <Text className="text-emerald-400/50 text-[8px] uppercase font-bold">Active Steps</Text>
                        <Text className="text-white text-xs font-bold font-mono mt-0.5">{last7DaysData[selectedTimelineDay].steps}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Achievements & Milestones */}
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Health Milestones</Text>
                
                <View className="space-y-2">
                  <View className="bg-[#111d19]/45 border border-[#1f372f] p-3.5 rounded-2xl flex-row items-center">
                    <Text className="text-xl mr-3">🛡️</Text>
                    <View className="flex-1">
                      <Text className="text-white text-xs font-bold">Immune Fortitude Achieved</Text>
                      <Text className="text-emerald-200/50 text-[9px] mt-0.5 leading-relaxed">
                        Nourished Ojas immune reserves above 80% on 5 nights due to early sleep habits.
                      </Text>
                    </View>
                  </View>

                  <View className="bg-[#111d19]/45 border border-[#1f372f] p-3.5 rounded-2xl flex-row items-center">
                    <Text className="text-xl mr-3">🔥</Text>
                    <View className="flex-1">
                      <Text className="text-white text-xs font-bold">Metabolic Spark Maintained</Text>
                      <Text className="text-emerald-200/50 text-[9px] mt-0.5 leading-relaxed">
                        Stabilized digestive Agni in Sama state for 3 consecutive days with warm water infusions.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Lifestyle & Recovery trends progress */}
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Circadian Trends</Text>
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-4.5 rounded-2xl space-y-3">
                  <View>
                    <View className="flex-row justify-between mb-0.5">
                      <Text className="text-slate-350 text-[10px] font-sans">Water compliance</Text>
                      <Text className="text-white text-[10px] font-mono font-bold">88%</Text>
                    </View>
                    <View className="w-full h-1 bg-[#1f372f] rounded-full overflow-hidden">
                      <View className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                    </View>
                  </View>

                  <View>
                    <View className="flex-row justify-between mb-0.5">
                      <Text className="text-slate-350 text-[10px] font-sans">Active step trends</Text>
                      <Text className="text-white text-[10px] font-mono font-bold">78%</Text>
                    </View>
                    <View className="w-full h-1 bg-[#1f372f] rounded-full overflow-hidden">
                      <View className="h-full bg-sky-400 rounded-full" style={{ width: '78%' }} />
                    </View>
                  </View>

                  <View>
                    <View className="flex-row justify-between mb-0.5">
                      <Text className="text-slate-350 text-[10px] font-sans">Sleep rhythm consistency</Text>
                      <Text className="text-white text-[10px] font-mono font-bold">84%</Text>
                    </View>
                    <View className="w-full h-1 bg-[#1f372f] rounded-full overflow-hidden">
                      <View className="h-full bg-violet-400 rounded-full" style={{ width: '84%' }} />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View className="space-y-4">
                {/* MONTHLY SEASONAL RITUCHARYA STORY */}
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-4.5 rounded-2xl">
                  <View className="flex-row justify-between items-center mb-2.5">
                    <Text className="text-white text-xs font-serif font-black">Monthly Ritucharya Story</Text>
                    <View className="bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      <Text className="text-amber-400 text-[8px] font-bold uppercase font-mono">Adana Kala Season</Text>
                    </View>
                  </View>

                  <Text className="text-slate-200 text-xs leading-relaxed font-sans mb-3">
                    You are navigating the late dry season transition (Adana Kala). Intense solar radiation depletes the body's cooling moisture reserves daily, elevating bodily Vata elements and causing Agni to flicker.
                  </Text>
                  
                  <View className="bg-[#172722]/50 border border-[#1f372f]/50 p-3 rounded-xl">
                    <Text className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest font-mono mb-1">Seasonal Guidelines</Text>
                    <Text className="text-slate-300 text-[10px] leading-relaxed">
                      Drink cooling fluids (coconut water, buttermilk) and consume sweet, juicy summer fruits to preserve cellular vitality and protect your tissue reserves.
                    </Text>
                  </View>
                </View>

                {/* Monthly achievements */}
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Monthly Achievements</Text>
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-3.5 rounded-2xl flex-row items-center">
                  <Text className="text-xl mr-3">🧘</Text>
                  <View className="flex-1">
                    <Text className="text-white text-xs font-bold">Consistent Prana Flow</Text>
                    <Text className="text-emerald-200/50 text-[9px] mt-0.5 leading-relaxed">
                      Completed 18 morning breathing practices, lowering overall heart rate variability stress indexes.
                    </Text>
                  </View>
                </View>

                {/* Monthly Trends */}
                <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest font-mono mt-2">Seasonal Index Averages</Text>
                <View className="bg-[#111d19]/45 border border-[#1f372f] p-4.5 rounded-2xl space-y-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-300 text-xs font-sans">Average Sleep Score</Text>
                    <Text className="text-white text-xs font-bold font-mono">81/100</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-300 text-xs font-sans">Agni Metabolic Balance</Text>
                    <Text className="text-white text-xs font-bold font-mono">82%</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-slate-300 text-xs font-sans">Ojas Immune Shield</Text>
                    <Text className="text-white text-xs font-bold font-mono">84%</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Time Interval Selector for AI diagnostic reports */}
          <Text className="text-emerald-300/80 text-xs font-bold uppercase tracking-widest mb-3">Historical Reports</Text>
          <View className="flex-row bg-emerald-905/20 p-1 rounded-xl border border-emerald-850/30 mb-5">
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

          {/* DIAGONOSTICS REPORT DETAILS */}
          {!normalizedReport ? (
            <View className="bg-[#051f18]/20 border border-dashed border-emerald-850/30 p-8 rounded-2xl items-center py-10 mb-6">
              <View className="w-12 h-12 rounded-full bg-emerald-900/20 items-center justify-center mb-3">
                <Ionicons name="sparkles" size={24} color="#10b981" />
              </View>
              <Text className="text-emerald-400 text-sm font-semibold mb-1">No Report Available</Text>
              <Text className="text-emerald-500/60 text-xs text-center px-4 mb-4">
                Compile a dynamic health analysis log for the selected interval.
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
            <View className="mb-6">
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

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                  <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-3">Health Index</Text>
                  <View className={`w-18 h-18 rounded-full border-4 ${getScoreColor(normalizedReport.health_score!).border} items-center justify-center bg-emerald-950/70 mb-2 relative`}>
                    <Text className={`text-xl font-bold font-mono ${getScoreColor(normalizedReport.health_score!).text}`}>
                      {normalizedReport.health_score}
                    </Text>
                  </View>
                </View>

                <View className="flex-1 bg-[#051f18]/30 border border-emerald-800/20 p-4 rounded-2xl items-center relative overflow-hidden">
                  <Text className="text-emerald-300/80 text-[11px] font-bold uppercase mb-3">Goal Compliance</Text>
                  <View className={`w-18 h-18 rounded-full border-4 ${getScoreColor(normalizedReport.wellness_score!).border} items-center justify-center bg-emerald-950/70 mb-2 relative`}>
                    <Text className={`text-xl font-bold font-mono ${getScoreColor(normalizedReport.wellness_score!).text}`}>
                      {normalizedReport.wellness_score}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="bg-[#051f18]/35 border border-emerald-800/25 p-5 rounded-2xl shadow-lg">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="sparkles" size={15} color="#34d399" className="mr-2" />
                  <Text className="text-white text-sm font-bold">Ayurvedic Insight Summary</Text>
                </View>
                <View className="border-t border-emerald-900/30 pt-3">
                  {renderMarkdown(normalizedReport.summary_markdown)}
                </View>
              </View>
            </View>
          )}

          {/* HISTORICAL ARCHIVE LIST */}
          <View className="mt-2">
            <Text className="text-white text-sm font-bold mb-3 flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#34d399" className="mr-1" /> Archived Forecasts
            </Text>

            {historyReports.length === 0 ? (
              <View className="bg-emerald-900/5 border border-dashed border-emerald-900/15 p-6 rounded-xl justify-center items-center">
                <Text className="text-emerald-500/50 text-[11px] font-medium">No previous archived logs.</Text>
              </View>
            ) : (
              <View className="space-y-2.5">
                {historyReports.map((rep) => {
                  const normRep = normalizeReport(rep);
                  return (
                    <TouchableOpacity
                      key={rep.id}
                      onPress={() => setSelectedReportForModal(normRep)}
                      className="bg-[#051f18]/25 border border-emerald-900/20 p-3.5 rounded-xl flex-row justify-between items-center active:bg-emerald-900/10 mb-2"
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
                        <Ionicons name="chevron-forward" size={14} color="#34d399" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* MODAL DRAWER FOR ARCHIVED REPORTS */}
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
                  <Text className="text-white text-base font-bold">Archived Log Details</Text>
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

                <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="sparkles" size={15} color="#34d399" className="mr-2" />
                    <Text className="text-white text-sm font-bold">Ayurvedic Interpretation</Text>
                  </View>
                  <View className="border-t border-emerald-900/30 pt-3">
                    {renderMarkdown(selectedReportForModal.summary_markdown)}
                  </View>
                </View>

                {selectedReportForModal.report_type === 'weekly' && (
                  <TouchableOpacity
                    onPress={handleShareWeeklyPdf}
                    disabled={pdfLoading}
                    className="mt-5 bg-emerald-500 py-3.5 rounded-2xl flex-row justify-center items-center active:bg-emerald-600 shadow-md shadow-emerald-500/20"
                  >
                    {pdfLoading ? (
                      <ActivityIndicator size="small" color="#022c22" className="mr-2" />
                    ) : (
                      <Ionicons name="document-text" size={16} color="#022c22" style={{ marginRight: 6 }} />
                    )}
                    <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">
                      {pdfLoading ? 'Generating PDF...' : 'Share PDF Report'}
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        )}

        {/* COMPILING SHIELD OVERLAY */}
        {compiling && (
          <View className="absolute inset-0 bg-[#020b08]/90 items-center justify-center z-50 px-8">
            <View className="bg-[#051f18]/40 border border-emerald-800/40 p-8 rounded-3xl items-center max-w-sm shadow-2xl relative overflow-hidden">
              <ActivityIndicator size="large" color="#34d399" className="mb-4" />
              <Text className="text-white text-base font-bold text-center mb-2">Querying the Oracle...</Text>
              <Text className="text-emerald-200/80 text-[11px] text-center leading-relaxed">
                Analyzing dynamic element trends, mapping imbalances to Shat Kriya Kala stages, and compiling long-term preventative health suggestions using Groq AI...
              </Text>
            </View>
          </View>
        )}
        <AyurExplanationSheet
          visible={explanationVisible}
          onClose={() => setExplanationVisible(false)}
          context={explanationContext}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

// ==========================================
// Isolated sub-components for Oracle Screen
// ==========================================

const ShatKriyaMeter = React.memo(function ShatKriyaMeter() {
  const { vata, pitta, kapha, agni, ojas } = useDigitalTwinStore();

  const imbalanceIndex = useMemo(() => {
    const maxDoshaDiff = Math.max(Math.abs(vata - 33), Math.abs(pitta - 33), Math.abs(kapha - 34));
    const agniImbalance = (100 - agni) * 0.5;
    const ojasImbalance = (100 - ojas) * 0.5;
    const computed = Math.round(maxDoshaDiff * 2.2 + agniImbalance + ojasImbalance);
    return Math.max(10, Math.min(95, computed));
  }, [vata, pitta, kapha, agni, ojas]);

  const stageName = useMemo(() => {
    if (imbalanceIndex < 35) {
      return {
        name: 'Sanchaya (Accumulation)',
        color: 'text-amber-400',
        desc: 'Elements are slightly accumulating in their primary locations. Easy to pacify with standard circadian habits.'
      };
    }
    if (imbalanceIndex < 65) {
      return {
        name: 'Prakopa (Aggravation)',
        color: 'text-orange-400',
        desc: 'Elements are aggravated and overflow. Requires immediate dietary corrections and warm teas.'
      };
    }
    return {
      name: 'Prasara (Spread)',
      color: 'text-rose-500',
      desc: 'Imbalance has spread, affecting secondary channels. Focus on pranayama, total rest, and cooling or warming herbs immediately.'
    };
  }, [imbalanceIndex]);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-6 rounded-3xl mb-6 relative overflow-hidden">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Ionicons name="eye-outline" size={18} color="#10b981" />
          <Text className="text-white font-bold text-sm ml-2">Shat Kriya Kala (Pathology Stage)</Text>
        </View>
        <Text className="text-emerald-400/50 text-[10px] font-mono">Imbalance Forecast</Text>
      </View>

      <View className="items-center justify-center my-2 relative">
        <View className="w-full h-4 bg-emerald-950/70 rounded-full overflow-hidden border border-emerald-900/30 relative">
          <View style={{ width: `${imbalanceIndex}%` }} className="h-full bg-amber-400 rounded-full" />
          <View className="absolute left-[35%] top-0 bottom-0 w-[1px] bg-emerald-900/40" />
          <View className="absolute left-[65%] top-0 bottom-0 w-[1px] bg-emerald-900/40" />
        </View>
        <View className="flex-row justify-between w-full mt-2 px-1">
          <Text className="text-[8px] text-amber-400 font-bold uppercase">Sanchaya</Text>
          <Text className="text-[8px] text-orange-400 font-bold uppercase">Prakopa</Text>
          <Text className="text-[8px] text-rose-500 font-bold uppercase">Prasara</Text>
        </View>
      </View>

      <View className="mt-4 p-4 bg-emerald-950/45 rounded-2xl border border-emerald-900/20">
        <Text className="text-white text-xs font-bold">
          Current Stage: <Text className={stageName.color}>{stageName.name}</Text>
        </Text>
        <Text className="text-emerald-200/60 text-[10px] mt-1.5 leading-relaxed">
          {stageName.desc}
        </Text>
      </View>
    </View>
  );
});

const PredictiveWarningCard = React.memo(function PredictiveWarningCard() {
  const { vata, pitta, kapha } = useDigitalTwinStore();

  const warningDetails = useMemo(() => {
    const maxVal = Math.max(vata, pitta, kapha);
    if (vata === 33 && pitta === 33) {
      return {
        title: "Homeostatic Equilibrium",
        warning: "No active element accumulations are predicted. Your circadian habits are in sync with your Prakriti.",
        icon: "checkmark-circle-outline",
        color: "text-emerald-400",
        bg: "bg-emerald-950/40"
      };
    }
    if (maxVal === vata) {
      return {
        title: "Predicted Vata Accumulation",
        warning: "Sustained high Vata (wind) is predicted to result in nervous tension, dry skin, and muscle stiffness within 36 hours. Pacify this by drinking warm liquids and avoiding dry, cold foods.",
        icon: "warning-outline",
        color: "text-amber-400",
        bg: "bg-amber-950/40"
      };
    }
    if (maxVal === pitta) {
      return {
        title: "Predicted Pitta Aggravation",
        warning: "Sustained high Pitta (fire/heat) is predicted to trigger digestive acidity, skin redness, or sleep disturbance within 24 hours. Balance this by taking cooling fluids and sweet fruits.",
        icon: "flame-outline",
        color: "text-orange-400",
        bg: "bg-orange-950/40"
      };
    }
    return {
      title: "Predicted Kapha Stagnation",
      warning: "Elevated Kapha (earth/water) indicates a risk of respiratory congestion and daytime lethargy within 48 hours. Stimulate circulation with brisk walking and warming ginger tea.",
      icon: "alert-circle-outline",
      color: "text-purple-400",
      bg: "bg-purple-950/40"
    };
  }, [vata, pitta, kapha]);

  return (
    <View className={`border p-5 rounded-3xl mb-6 relative overflow-hidden ${warningDetails.bg} border-emerald-800/30`}>
      <View className="flex-row items-center mb-3">
        <Ionicons name={warningDetails.icon as any} size={18} color={warningDetails.color === 'text-emerald-400' ? '#10b981' : warningDetails.color === 'text-amber-400' ? '#f59e0b' : warningDetails.color === 'text-orange-400' ? '#f97316' : '#a78bfa'} />
        <Text className="text-white font-bold text-sm ml-2">{warningDetails.title}</Text>
      </View>
      <Text className="text-emerald-100/90 text-xs leading-relaxed font-medium">
        {warningDetails.warning}
      </Text>
    </View>
  );
});

const PredictiveForecastCard = React.memo(function PredictiveForecastCard() {
  const [activeInterval, setActiveInterval] = useState<'tomorrow' | 'next3Days' | 'nextWeek'>('tomorrow');
  const predictions = useMemo(() => generateHealthPredictions(), [activeInterval]);

  const activeResult = predictions[activeInterval];
  
  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { label: 'High Confidence', color: 'text-emerald-400', bg: 'bg-emerald-950/60 border-emerald-500/25', dot: 'bg-emerald-500' };
    if (score >= 60) return { label: 'Moderate Confidence', color: 'text-amber-400', bg: 'bg-amber-950/60 border-amber-900/25', dot: 'bg-amber-500' };
    return { label: 'Low Confidence', color: 'text-rose-400', bg: 'bg-rose-950/60 border-rose-900/25', dot: 'bg-rose-500' };
  };

  const confidenceTheme = getConfidenceLevel(activeResult.confidenceScore);

  return (
    <View className="bg-[#051f18]/30 border border-emerald-800/30 p-5 rounded-3xl mb-6">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-white text-base font-extrabold flex-row items-center">
          <Ionicons name="sparkles" size={16} color="#34d399" style={{ marginRight: 6 }} /> Predictive Health Forecast
        </Text>
        <View className="bg-emerald-950/60 border border-emerald-900/35 px-2 py-0.5 rounded-full">
          <Text className="text-emerald-400 text-[8px] font-mono uppercase">Density: {predictions.dataDensityScore}%</Text>
        </View>
      </View>

      {/* Interval Tabs */}
      <View className="flex-row bg-emerald-950/45 p-1 rounded-xl border border-emerald-900/20 mb-4">
        {(['tomorrow', 'next3Days', 'nextWeek'] as const).map((interval) => {
          const isSelected = activeInterval === interval;
          const label = interval === 'tomorrow' ? 'Tomorrow' : interval === 'next3Days' ? 'Next 3 Days' : 'Next Week';
          return (
            <TouchableOpacity
              key={interval}
              onPress={() => setActiveInterval(interval)}
              className={`flex-1 py-2 rounded-lg items-center ${
                isSelected ? 'bg-emerald-500' : 'bg-transparent'
              }`}
            >
              <Text className={`text-[10px] font-bold ${isSelected ? 'text-emerald-950' : 'text-emerald-400/80'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Confidence Pill */}
      <View className={`p-3 rounded-2xl border ${confidenceTheme.bg} mb-4 flex-row items-center justify-between`}>
        <View className="flex-row items-center flex-1 mr-2">
          <View className={`w-2 h-2 rounded-full mr-2 ${confidenceTheme.dot}`} />
          <View className="flex-1">
            <Text className={`text-[10px] font-bold ${confidenceTheme.color}`}>{confidenceTheme.label} ({activeResult.confidenceScore}%)</Text>
            <Text className="text-emerald-200/50 text-[8px] leading-tight mt-0.5">{activeResult.confidenceExplanation}</Text>
          </View>
        </View>
        <Ionicons name="information-circle-outline" size={15} color="#34d399" />
      </View>

      {/* Vitals Forecast */}
      <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-2.5">Expected Vitals</Text>
      <View className="bg-emerald-950/20 p-3 rounded-2xl border border-emerald-900/10 mb-4">
        <ForecastProgress label="System Recovery" value={activeResult.target.recovery} color="bg-emerald-500" />
        <ForecastProgress label="Circadian Energy" value={activeResult.target.energy} color="bg-sky-400" />
        <ForecastProgress label="Sleep Restoration" value={activeResult.target.sleep} color="bg-violet-400" />
      </View>

      {/* Constitutional Forecast */}
      <View className="flex-row justify-between items-center mb-2.5">
        <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider">Constitutional Balance</Text>
        <View className="bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded">
          <Text className="text-orange-400 text-[8px] font-bold uppercase">{activeResult.target.primaryAggravation} Aggravation</Text>
        </View>
      </View>
      <View className="bg-emerald-950/20 p-3 rounded-2xl border border-emerald-900/10 mb-4">
        <ForecastProgress label="Vata (Wind/Air)" value={activeResult.target.dosha.vata} color="bg-amber-500" unit="%" />
        <ForecastProgress label="Pitta (Fire/Water)" value={activeResult.target.dosha.pitta} color="bg-red-500" unit="%" />
        <ForecastProgress label="Kapha (Water/Earth)" value={activeResult.target.dosha.kapha} color="bg-sky-500" unit="%" />
      </View>

      {/* Engine Scores Forecast */}
      <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-2.5">Bio-Engine Scores</Text>
      <View className="flex-row space-x-3 mb-4">
        <View className="flex-1 bg-emerald-950/20 p-3 rounded-2xl border border-emerald-900/10">
          <ForecastProgress label="Expected Agni" value={activeResult.target.agni} color="bg-amber-400" />
        </View>
        <View className="flex-1 bg-emerald-950/20 p-3 rounded-2xl border border-emerald-900/10">
          <ForecastProgress label="Expected Ojas" value={activeResult.target.ojas} color="bg-violet-400" />
        </View>
      </View>

      {/* Key Driver Analysis */}
      <View className="bg-emerald-950/40 border border-emerald-900/30 p-4 rounded-2xl mb-1">
        <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 flex-row items-center">
          <Ionicons name="git-branch-outline" size={10} style={{ marginRight: 4 }} /> Key Trend Driver
        </Text>
        <Text className="text-white text-xs leading-relaxed mb-3">{activeResult.keyDriver}</Text>

        <Text className="text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 flex-row items-center">
          <Ionicons name="shield-checkmark" size={10} style={{ marginRight: 4 }} /> Recommendation
        </Text>
        <Text className="text-emerald-300 text-xs leading-relaxed">{activeResult.recommendation}</Text>
      </View>
    </View>
  );
});

const ForecastProgress = ({ label, value, color, unit = '%' }: { label: string; value: number; color: string; unit?: string }) => {
  return (
    <View className="mb-2">
      <View className="flex-row justify-between mb-0.5">
        <Text className="text-emerald-300/80 text-[9px] font-sans font-medium">{label}</Text>
        <Text className="text-white text-[9px] font-mono font-bold">{value}{unit}</Text>
      </View>
      <View className="w-full h-1.5 bg-emerald-950 rounded-full overflow-hidden">
        <View style={{ width: `${value}%` }} className={`h-full rounded-full ${color}`} />
      </View>
    </View>
  );
};
