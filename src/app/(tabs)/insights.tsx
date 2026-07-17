import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Line as SvgLine, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
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
import BodyIntelligenceTimeline from '../../components/BodyIntelligenceTimeline';
import { getExplanationForRecommendation, ExplanationContext } from '../../services/recommendationExplainer';
import { useExperienceStore } from '../../store/useExperienceStore';
import { ExperienceSwitch } from '../../components/ExperienceSwitch';
import { 
  getLocalizedAgni, 
  getLocalizedOjas 
} from '../../services/translationEngine';

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
  const { mode, locale } = useExperienceStore();
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
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);

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
    if (score >= 80) return { text: 'text-[#607C64]', border: 'border-[#E4E1D8]', bg: 'bg-[#F2EFE8]', glow: 'bg-[#7D9C83]/10' };
    if (score >= 50) return { text: 'text-amber-700', border: 'border-[#E4E1D8]', bg: 'bg-amber-50', glow: 'bg-amber-500/10' };
    return { text: 'text-rose-700', border: 'border-[#E4E1D8]', bg: 'bg-rose-50', glow: 'bg-rose-500/10' };
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return <View key={idx} className="h-2" />;

      if (cleanLine.startsWith('###')) {
        return <Text key={idx} className="text-[#607C64] font-bold text-sm mt-3 mb-1 font-serif">{cleanLine.replace('###', '').trim()}</Text>;
      }
      if (cleanLine.startsWith('##')) {
        return <Text key={idx} className="text-[#2E3A2F] font-bold text-base mt-4 mb-1.5 font-serif">{cleanLine.replace('##', '').trim()}</Text>;
      }
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        return (
          <View key={idx} className="flex-row items-start py-0.5 pl-1">
            <Text className="text-[#7D9C83] mr-2 text-[13px]">•</Text>
            <Text className="text-slate-650 text-[13px] flex-1 leading-relaxed">{renderBoldSegments(cleanLine.substring(1).trim())}</Text>
          </View>
        );
      }
      return <Text key={idx} className="text-slate-655 text-[13px] leading-relaxed mb-2 font-serif">{renderBoldSegments(cleanLine)}</Text>;
    });
  };

  const renderBoldSegments = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <Text key={index} className="font-bold text-[#2E3A2F]">{part}</Text>;
      }
      return part;
    });
  };

  const ProgressBar = ({ value, max, label, valueStr, colorClass }: { value: number, max: number, label: string, valueStr: string, colorClass: string }) => {
    const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
    return (
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-0.5">
          <Text className="text-[#607C64]/70 text-[11px] font-medium font-mono">{label}</Text>
          <Text className="text-[#2E3A2F] text-xs font-mono font-semibold">{valueStr}</Text>
        </View>
        <View className="w-full h-1.5 bg-[#F2EFE8] rounded-full overflow-hidden border border-[#E4E1D8]/40">
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
      <LinearGradient colors={['#F8F6F0', '#F2EFE8']} className="flex-1">
        {/* Header */}
        <View className="px-6 py-4 border-b border-[#E4E1D8]">
          <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono">ORACLE - INSIGHTS</Text>
          <Text className="text-[#2E3A2F] text-2xl font-serif font-black mt-0.5">Good morning, {profile?.first_name || 'Siddhesh'}</Text>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 110 }} className="px-6 py-4" showsVerticalScrollIndicator={false}>
          {/* ================= SECTION: DUAL INTELLIGENCE BRIEFING ================= */}
          {todayBriefing ? (
            <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/20">
              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-row items-center">
                  <Ionicons name="sunny-outline" size={18} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-[#2E3A2F] text-sm font-serif font-black">Today's Briefing</Text>
                </View>
                <TouchableOpacity
                  onPress={compileTodayBriefing}
                  disabled={briefingLoading}
                  className="bg-[#F2EFE8] px-3 py-1.5 rounded-xl border border-[#E4E1D8] flex-row items-center"
                >
                  {briefingLoading ? (
                    <ActivityIndicator size="small" color="#607C64" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={13} color="#607C64" style={{ marginRight: 4 }} />
                      <Text className="text-[#607C64] text-[10px] font-bold">Re-Calibrate</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Greeting Summary */}
              <Text className="text-slate-650 text-xs leading-relaxed mb-4">
                {todayBriefing.summary}
              </Text>

              {/* Recommendations bullets */}
              <View className="space-y-2">
                <View className="flex-row items-center mt-1">
                  <Ionicons name="flame-outline" size={13} color="#C07A65" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Energy is good</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="water-outline" size={13} color="#5C788A" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Drink a little more water</Text>
                </View>
                <View className="flex-row items-center mt-1">
                  <Ionicons name="leaf-outline" size={13} color="#607C64" style={{ marginRight: 8 }} />
                  <Text className="text-slate-600 text-xs font-sans">Take short breaks at work</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-6 items-center shadow-sm">
              <Ionicons name="sparkles-outline" size={32} color="#607C64" style={{ marginBottom: 12 }} />
              <Text className="text-[#2E3A2F] text-sm font-serif font-bold text-center mb-1">Calibration Required</Text>
              <Text className="text-slate-500 text-xs text-center px-4 mb-4 leading-relaxed">
                Generate today's morning diagnostic briefing based on your latest steps, heart rates, sleep, and constitution tags.
              </Text>
              
              <TouchableOpacity
                onPress={compileTodayBriefing}
                disabled={briefingLoading}
                className="bg-[#7D9C83] py-3 px-6 rounded-xl flex-row justify-center items-center active:bg-[#607C64] shadow-md shadow-emerald-500/10"
              >
                {briefingLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-xs">Analyzing Biometrics...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text className="text-white font-bold text-xs">Generate Today's Intelligence</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ================= SECTION: HEALTH SCORES ================= */}
          <View className="flex-row justify-between items-center mb-4 mt-2">
            <Text className="text-[#2E3A2F] text-xs font-serif font-bold uppercase tracking-widest">Health Scores</Text>
            
            {/* Interval switch */}
            <View className="flex-row bg-[#F2EFE8] p-0.5 rounded-lg border border-[#E4E1D8]">
              {(['daily', 'weekly', 'monthly'] as const).map((type) => {
                const isSelected = selectedInterval === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => setSelectedInterval(type)}
                    className={`px-3 py-1 rounded-md ${isSelected ? 'bg-[#7D9C83]' : ''}`}
                  >
                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${isSelected ? 'text-white' : 'text-[#607C64]/60'}`}>
                      {type === 'daily' ? 'Daily' : type === 'weekly' ? 'Weekly' : 'Monthly'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Concentric rings grid */}
          <View className="flex-row gap-3 mb-3">
            <ConcentricRing label="Energy" value={todayOjas?.ojas_score || 78} color="#C07A65" icon="flame" subtitle="how active you feel" />
            <ConcentricRing label="Recovery" value={last7DaysData[6]?.recovery || 83} color="#607C64" icon="shield-checkmark" subtitle="body strength" />
            <ConcentricRing label="Hydration" value={hydrationPct} color="#5C788A" icon="water" subtitle="water balance" />
          </View>
          <View className="flex-row gap-3 mb-6">
            <ConcentricRing label="Sleep" value={todayBriefing?.expectedOjas || 80} color="#8B5CF6" icon="moon" subtitle="sleep restoration" />
            <ConcentricRing label="Activity" value={stepsPct} color="#607C64" icon="footsteps" subtitle="body movement" />
            <ConcentricRing label="Mind" value={69} color="#D97706" icon="happy" subtitle="mental stillness" />
          </View>

          <VitalTrendsChart data={last7DaysData.map(d => ({ label: d.label, recovery: d.recovery, energy: d.ojas }))} />

          {/* ================= SECTION: BODY BALANCE ================= */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/20">
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-[#2E3A2F] text-sm font-serif font-black">Body Balance</Text>
                <Text className="text-slate-450 text-[9px] font-mono">Your natural body type today</Text>
              </View>
              <Ionicons name="body-outline" size={16} color="#607C64" />
            </View>

            <View className="space-y-3.5 mb-4">
              <View>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-slate-600 text-xs font-bold">Movement (Vata)</Text>
                  <Text className="text-[#5C788A] text-xs font-bold font-mono">{currentDosha?.vata || 24}%</Text>
                </View>
                <View className="w-full h-2 bg-[#F2EFE8] rounded-full overflow-hidden">
                  <View style={{ width: `${currentDosha?.vata || 24}%` }} className="h-full bg-[#5C788A] rounded-full" />
                </View>
              </View>

              <View>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-slate-600 text-xs font-bold">Heat (Pitta)</Text>
                  <Text className="text-[#C07A65] text-xs font-bold font-mono">{currentDosha?.pitta || 49}%</Text>
                </View>
                <View className="w-full h-2 bg-[#F2EFE8] rounded-full overflow-hidden">
                  <View style={{ width: `${currentDosha?.pitta || 49}%` }} className="h-full bg-[#C07A65] rounded-full" />
                </View>
              </View>

              <View>
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-slate-600 text-xs font-bold">Stability (Kapha)</Text>
                  <Text className="text-[#607C64] text-xs font-bold font-mono">{currentDosha?.kapha || 27}%</Text>
                </View>
                <View className="w-full h-2 bg-[#F2EFE8] rounded-full overflow-hidden">
                  <View style={{ width: `${currentDosha?.kapha || 27}%` }} className="h-full bg-[#607C64] rounded-full" />
                </View>
              </View>
            </View>

            <View className="bg-red-50 border border-red-100 p-4.5 rounded-2xl flex-row items-center mt-2">
              <Text className="text-lg mr-2.5">🔥</Text>
              <Text className="text-red-800 text-[11px] leading-relaxed flex-1 font-medium">
                Your body runs a little warm today. Choose cooling foods and calmer activities.
              </Text>
            </View>
          </View>

          {/* ================= SECTION: TODAY'S RECOMMENDATIONS ================= */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/20">
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-[#2E3A2F] text-sm font-serif font-black">Today's Recommendations</Text>
                <Text className="text-slate-450 text-[9px] font-mono">Small habits, big shift</Text>
              </View>
              <Ionicons name="checkmark-circle-outline" size={16} color="#607C64" />
            </View>

            <View className="flex-row flex-wrap gap-2 mt-2">
              {[
                { title: 'Drink Water', icon: 'water-outline' },
                { title: 'Eat Fresh Food', icon: 'leaf-outline' },
                { title: 'Walk 20 min', icon: 'walk-outline' },
                { title: 'Sleep Earlier', icon: 'moon-outline' },
                { title: 'Deep Breathing', icon: 'body-outline' },
                { title: 'Morning Sun', icon: 'sunny-outline' }
              ].map((rec) => (
                <TouchableOpacity
                  key={rec.title}
                  onPress={() => handleOpenExplanation(rec.title)}
                  className="flex-row items-center bg-[#F2EFE8] border border-[#E4E1D8] px-3.5 py-2.5 rounded-2xl active:bg-[#E4E1D8]/50"
                >
                  <Ionicons name={rec.icon as any} size={12} color="#607C64" style={{ marginRight: 6 }} />
                  <Text className="text-[#2E3A2F] text-[11px] font-bold">{rec.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ================= SECTION: HEALTH FORECAST ================= */}
          <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/20">
            <View className="flex-row justify-between items-center mb-3">
              <View>
                <Text className="text-[#2E3A2F] text-sm font-serif font-black">Health Forecast</Text>
                <Text className="text-slate-450 text-[9px] font-mono">What tomorrow looks like</Text>
              </View>
              <Ionicons name="sparkles-outline" size={16} color="#607C64" />
            </View>

            {/* Direction indicators */}
            <View className="flex-row gap-2 mb-4 mt-2">
              <View className="flex-1 bg-[#FDF4F2] border border-[#FBE3DC] p-3 rounded-2xl items-center">
                <Ionicons name="arrow-up" size={14} color="#C07A65" />
                <Text className="text-[#C07A65] text-[10px] font-bold mt-1">Energy</Text>
              </View>
              <View className="flex-1 bg-[#F3F6F4] border border-[#E5ECE7] p-3 rounded-2xl items-center">
                <Ionicons name="trending-up" size={14} color="#607C64" />
                <Text className="text-[#607C64] text-[10px] font-bold mt-1">Recovery</Text>
              </View>
              <View className="flex-1 bg-[#F4F7F9] border border-[#E6EEF2] p-3 rounded-2xl items-center">
                <Ionicons name="arrow-down" size={14} color="#5C788A" />
                <Text className="text-[#5C788A] text-[10px] font-bold mt-1">Hydration</Text>
              </View>
              <View className="flex-1 bg-[#F6F4FB] border border-[#EBE6F6] p-3 rounded-2xl items-center">
                <Ionicons name="arrow-up" size={14} color="#8B5CF6" />
                <Text className="text-[#8B5CF6] text-[10px] font-bold mt-1">Sleep</Text>
              </View>
            </View>

            <ForecastLineChart />
          </View>

          {/* ================= SECTION: ACCORDION EXPANDABLE PANELS ================= */}
          
          {/* Today vs This Week Accordion */}
          <TouchableOpacity
            onPress={() => setExpandedPanel(expandedPanel === 'comparison' ? null : 'comparison')}
            className="bg-white border border-[#E4E1D8] p-4.5 rounded-2xl mb-3 flex-row justify-between items-center active:bg-[#F2EFE8]/40 shadow-sm"
          >
            <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Today vs This Week</Text>
            <Ionicons name={expandedPanel === 'comparison' ? 'chevron-up' : 'chevron-down'} size={14} color="#607C64" />
          </TouchableOpacity>
          {expandedPanel === 'comparison' && (
            <View className="bg-white border border-[#E4E1D8] p-5 rounded-2xl mb-3 -mt-1 shadow-sm">
              <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-2">Metrics comparison</Text>
              <Text className="text-slate-600 text-xs leading-relaxed">
                Your recovery today ({last7DaysData[6]?.recovery || 83}%) is 4% higher than your weekly average. Digestive fire (Agni) peaks are holding stable.
              </Text>
            </View>
          )}

          {/* Wellness History (Archived logs) */}
          <TouchableOpacity
            onPress={() => setExpandedPanel(expandedPanel === 'history' ? null : 'history')}
            className="bg-white border border-[#E4E1D8] p-4.5 rounded-2xl mb-3 flex-row justify-between items-center active:bg-[#F2EFE8]/40 shadow-sm"
          >
            <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Wellness History</Text>
            <Ionicons name={expandedPanel === 'history' ? 'chevron-up' : 'chevron-down'} size={14} color="#607C64" />
          </TouchableOpacity>
          {expandedPanel === 'history' && (
            <View className="bg-white border border-[#E4E1D8] p-5 rounded-2xl mb-3 -mt-1 shadow-sm">
              <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-3">Your last 5 diagnostic reports</Text>
              {reports.slice(0, 5).map((rep) => {
                const normRep = normalizeReport(rep);
                return (
                  <TouchableOpacity
                    key={rep.id}
                    onPress={() => setSelectedReportForModal(normRep)}
                    className="border-b border-[#E4E1D8]/45 py-3 flex-row justify-between items-center active:bg-emerald-955/5"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-slate-500 text-[10px] font-mono">{rep.start_date}</Text>
                      <Text className="text-[#2E3A2F] text-xs font-bold mt-0.5" numberOfLines={1}>{rep.summary_markdown}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={12} color="#607C64" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Habit Progress */}
          <TouchableOpacity
            onPress={() => setExpandedPanel(expandedPanel === 'habits' ? null : 'habits')}
            className="bg-white border border-[#E4E1D8] p-4.5 rounded-2xl mb-6 flex-row justify-between items-center active:bg-[#F2EFE8]/40 shadow-sm"
          >
            <Text className="text-[#2E3A2F] text-xs font-bold font-serif">Habit Progress</Text>
            <Ionicons name={expandedPanel === 'habits' ? 'chevron-up' : 'chevron-down'} size={14} color="#607C64" />
          </TouchableOpacity>
          {expandedPanel === 'habits' && (
            <View className="bg-white border border-[#E4E1D8] p-5 rounded-2xl mb-6 -mt-4 shadow-sm">
              <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider font-mono mb-2">This week at a glance</Text>
              <Text className="text-slate-600 text-xs leading-relaxed">
                Hydration: 6/7 days logged successfully. Breathwork: 5/7 days completed. Sleep lock reached 4 nights.
              </Text>
            </View>
          )}

          {/* View Full Diagnostic Report CTA */}
          <TouchableOpacity
            onPress={handleShareWeeklyPdf}
            disabled={pdfLoading}
            className="bg-[#607C64] py-4 rounded-2xl flex-row justify-center items-center active:bg-[#7D9C83] shadow shadow-[#607C64]/20 mb-6"
          >
            {pdfLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
            ) : (
              <Ionicons name="document-text-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            )}
            <Text className="text-white font-black text-xs uppercase tracking-wider">
              {pdfLoading ? 'Compiling PDF...' : 'View Full Diagnostic Report'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* MODAL DRAWER FOR ARCHIVED REPORTS */}
        {selectedReportForModal && (
          <Modal
            visible={true}
            transparent={false}
            animationType="slide"
            onRequestClose={() => setSelectedReportForModal(null)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F6F0' }}>
              <View className="px-6 py-4 flex-row items-center justify-between border-b border-[#E4E1D8]">
                <View>
                  <Text className="text-[#2E3A2F] text-base font-bold">Archived Log Details</Text>
                  <Text className="text-[#607C64] text-[10px] capitalize font-mono">
                    {selectedReportForModal.report_type} Diagnostic Log
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedReportForModal(null)}
                  className="p-1.5 rounded-full bg-[#F2EFE8] border border-[#E4E1D8]"
                >
                  <Ionicons name="close" size={20} color="#607C64" />
                </TouchableOpacity>
              </View>

              <ScrollView className="px-6 py-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-xl mb-4 flex-row justify-between items-center">
                  <View>
                    <Text className="text-[#607C64] text-[9px] font-bold uppercase tracking-wider font-mono">Report Window</Text>
                    <Text className="text-[#2E3A2F] text-xs font-semibold mt-0.5">
                      {selectedReportForModal.start_date} to {selectedReportForModal.end_date}
                    </Text>
                  </View>
                  <View className="bg-white border border-[#E4E1D8] px-3 py-1 rounded-full">
                    <Text className="text-[#607C64] text-[10px] font-bold uppercase font-mono">
                      {selectedReportForModal.report_type}
                    </Text>
                  </View>
                </View>

                <View className="bg-white border border-[#E4E1D8] p-5 rounded-2xl shadow-sm">
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="sparkles" size={15} color="#607C64" className="mr-2" />
                    <Text className="text-[#2E3A2F] text-sm font-bold">Ayurvedic Interpretation</Text>
                  </View>
                  <View className="border-t border-[#E4E1D8]/60 pt-3">
                    <Text className="text-slate-600 text-xs leading-relaxed">{selectedReportForModal.summary_markdown}</Text>
                  </View>
                </View>

                {selectedReportForModal.report_type === 'weekly' && (
                  <TouchableOpacity
                    onPress={handleShareWeeklyPdf}
                    disabled={pdfLoading}
                    className="mt-5 bg-[#7D9C83] py-3.5 rounded-2xl flex-row justify-center items-center active:bg-[#607C64] shadow-sm"
                  >
                    {pdfLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />
                    ) : (
                      <Ionicons name="document-text" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    )}
                    <Text className="text-white font-black text-xs uppercase tracking-wider">
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
          <View className="absolute inset-0 bg-[#F8F6F0]/95 items-center justify-center z-50 px-8">
            <View className="bg-white border border-[#E4E1D8] p-8 rounded-3xl items-center max-w-sm shadow-xl relative overflow-hidden">
              <ActivityIndicator size="large" color="#607C64" className="mb-4" />
              <Text className="text-[#2E3A2F] text-base font-bold text-center mb-2 font-serif">Querying the Oracle...</Text>
              <Text className="text-slate-500 text-[11px] text-center leading-relaxed">
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

const ConcentricRing = React.memo(function ConcentricRing({
  label,
  value,
  color,
  icon,
  subtitle
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
  subtitle: string;
}) {
  const radius = 22;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <View className="bg-white border border-[#E4E1D8] p-4 rounded-2xl items-center flex-1 shadow-sm relative overflow-hidden">
      <View className="w-12 h-12 justify-center items-center mb-1 relative">
        <Svg width={52} height={52} viewBox="0 0 52 52">
          {/* Background track circle */}
          <Circle
            cx={26}
            cy={26}
            r={radius}
            stroke="#F2EFE8"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <Circle
            cx={26}
            cy={26}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
        </Svg>
        {/* Inner Text or Icon */}
        <View className="absolute inset-0 justify-center items-center">
          <Ionicons name={icon as any} size={14} color={color} />
        </View>
      </View>
      <Text className="text-[#2E3A2F] text-sm font-bold font-mono">{value}%</Text>
      <Text className="text-[#2E3A2F] text-[10px] font-bold mt-0.5">{label}</Text>
      <Text className="text-slate-405 text-[7px] font-mono mt-0.5">{subtitle}</Text>
    </View>
  );
});

const VitalTrendsChart = React.memo(function VitalTrendsChart({
  data
}: {
  data: Array<{ label: string; recovery: number; energy: number }>
}) {
  const { width: screenWidth } = Dimensions.get('window');
  const width = screenWidth - 72; // chart margin adjusted
  const height = 120;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 20;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Helper to calculate SVG points
  const getPointsStr = (key: 'recovery' | 'energy') => {
    return data.map((d, idx) => {
      const x = paddingLeft + (idx * chartW) / (data.length - 1);
      const val = d[key];
      const y = height - paddingBottom - (val / 100) * chartH;
      return { x, y };
    });
  };

  const recoveryPoints = getPointsStr('recovery');
  const energyPoints = getPointsStr('energy');

  const makePath = (points: Array<{ x: number; y: number }>) => {
    return points.map((p, idx) => (idx === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  };

  const makeAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return '';
    const path = makePath(points);
    const startX = points[0].x.toFixed(1);
    const endX = points[points.length - 1].x.toFixed(1);
    const bottomY = (height - paddingBottom).toFixed(1);
    return `${path} L ${endX} ${bottomY} L ${startX} ${bottomY} Z`;
  };

  return (
    <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/20">
      <View className="flex-row justify-between items-center mb-3">
        <View>
          <Text className="text-[#2E3A2F] text-sm font-serif font-black">Vital Trends</Text>
          <Text className="text-slate-400 text-[9px] font-mono">7-day recovery & energy history</Text>
        </View>
        <Ionicons name="stats-chart-outline" size={16} color="#607C64" />
      </View>

      <View className="my-2" style={{ width, height }}>
        <Svg width={width} height={height}>
          <Defs>
            <SvgGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#607C64" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#607C64" stopOpacity="0" />
            </SvgGradient>
            <SvgGradient id="gradEn" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#C07A65" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#C07A65" stopOpacity="0" />
            </SvgGradient>
          </Defs>

          {/* Dotted Grid lines */}
          {[25, 50, 75, 100].map((level) => {
            const y = height - paddingBottom - (level / 100) * chartH;
            return (
              <SvgLine
                key={level}
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#E4E1D8"
                strokeWidth="0.8"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Areas */}
          <Path d={makeAreaPath(recoveryPoints)} fill="url(#gradRec)" />
          <Path d={makeAreaPath(energyPoints)} fill="url(#gradEn)" />

          {/* Lines */}
          <Path d={makePath(recoveryPoints)} fill="none" stroke="#607C64" strokeWidth="2" />
          <Path d={makePath(energyPoints)} fill="none" stroke="#C07A65" strokeWidth="1.8" />

          {/* Y Axis Labels */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = height - paddingBottom - (val / 100) * chartH;
            return (
              <SvgLine
                key={val}
                x1={paddingLeft - 4}
                y1={y}
                x2={paddingLeft}
                y2={y}
                stroke="#2E3A2F"
                strokeWidth="1"
              />
            );
          })}

          {/* X Labels */}
          {data.map((d, idx) => {
            const x = paddingLeft + (idx * chartW) / (data.length - 1);
            return (
              <SvgLine
                key={idx}
                x1={x}
                y1={height - paddingBottom}
                x2={x}
                y2={height - paddingBottom + 4}
                stroke="#2E3A2F"
                strokeWidth="1"
              />
            );
          })}
        </Svg>

        {/* Label text overlays */}
        <View className="absolute left-0 right-0 bottom-0 flex-row justify-between pl-[30px]" style={{ width }}>
          {data.map((d, idx) => (
            <Text key={idx} className="text-slate-400 text-[8px] font-mono text-center font-bold" style={{ width: chartW / 6 }}>
              {d.label}
            </Text>
          ))}
        </View>
        <View className="absolute left-0 top-0 bottom-[20px] justify-between items-end pr-1.5" style={{ width: 30 }}>
          <Text className="text-slate-400 text-[8px] font-mono font-bold">100</Text>
          <Text className="text-slate-400 text-[8px] font-mono font-bold">75</Text>
          <Text className="text-slate-400 text-[8px] font-mono font-bold">50</Text>
          <Text className="text-slate-400 text-[8px] font-mono font-bold">25</Text>
          <Text className="text-slate-400 text-[8px] font-mono font-bold">0</Text>
        </View>
      </View>

      {/* Legend */}
      <View className="flex-row justify-center items-center gap-4 mt-3 pt-2 border-t border-[#E4E1D8]/30">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-[#607C64] mr-1.5" />
          <Text className="text-[#2E3A2F] text-[9px] font-bold">Recovery</Text>
        </View>
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-[#C07A65] mr-1.5" />
          <Text className="text-[#2E3A2F] text-[9px] font-bold">Energy</Text>
        </View>
      </View>
    </View>
  );
});

const ForecastLineChart = React.memo(function ForecastLineChart() {
  const { width: screenWidth } = Dimensions.get('window');
  const width = screenWidth - 72;
  const height = 90;
  const paddingLeft = 20;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 18;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // Static predicted recovery curve indices
  const data = [
    { label: 'Today', val: 74 },
    { label: 'Tue', val: 76 },
    { label: 'Wed', val: 73 },
    { label: 'Thu', val: 78 },
    { label: 'Fri', val: 80 },
    { label: 'Sat', val: 79 },
    { label: 'Sun', val: 82 }
  ];

  const points = data.map((d, idx) => {
    const x = paddingLeft + (idx * chartW) / (data.length - 1);
    const y = height - paddingBottom - ((d.val - 50) / 40) * chartH; // mapped 50-90 range
    return { x, y, label: d.label, val: d.val };
  });

  const pathD = points.map((p, idx) => (idx === 0 ? 'M' : 'L') + ` ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <View className="my-2 relative" style={{ width, height }}>
      <Svg width={width} height={height}>
        {/* Horizontal Grid lines */}
        {[60, 70, 80, 90].map((level) => {
          const y = height - paddingBottom - ((level - 50) / 40) * chartH;
          return (
            <SvgLine
              key={level}
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#E4E1D8"
              strokeWidth="0.8"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Dotted indicator line */}
        <Path d={pathD} fill="none" stroke="#607C64" strokeWidth="1.5" />

        {/* Node Points circles */}
        {points.map((p, idx) => (
          <Circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#607C64"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        ))}
      </Svg>

      {/* Labels below */}
      <View className="absolute left-0 right-0 bottom-0 flex-row justify-between pl-[20px]" style={{ width }}>
        {data.map((d, idx) => (
          <Text key={idx} className="text-slate-400 text-[8px] font-mono text-center font-bold" style={{ width: chartW / 6 }}>
            {d.label}
          </Text>
        ))}
      </View>
      
      {/* Y labels */}
      <View className="absolute left-0 top-0 bottom-[18px] justify-between items-end pr-1.5" style={{ width: 20 }}>
        <Text className="text-slate-400 text-[7px] font-mono font-bold">90</Text>
        <Text className="text-slate-400 text-[7px] font-mono font-bold">78</Text>
        <Text className="text-slate-400 text-[7px] font-mono font-bold">66</Text>
        <Text className="text-slate-400 text-[7px] font-mono font-bold">54</Text>
      </View>
    </View>
  );
});

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
        color: 'text-amber-600',
        desc: 'Elements are slightly accumulating in their primary locations. Easy to pacify with standard circadian habits.'
      };
    }
    if (imbalanceIndex < 65) {
      return {
        name: 'Prakopa (Aggravation)',
        color: 'text-orange-600',
        desc: 'Elements are aggravated and overflow. Requires immediate dietary corrections and warm teas.'
      };
    }
    return {
      name: 'Prasara (Spread)',
      color: 'text-red-500',
      desc: 'Imbalance has spread, affecting secondary channels. Focus on pranayama, total rest, and cooling or warming herbs immediately.'
    };
  }, [imbalanceIndex]);

  return (
    <View className="bg-white border border-[#E4E1D8] p-6 rounded-3xl mb-6 relative overflow-hidden shadow-sm">
      <View className="flex-row justify-between items-center mb-4">
        <View className="flex-row items-center">
          <Ionicons name="eye-outline" size={18} color="#607C64" />
          <Text className="text-[#2E3A2F] font-bold text-sm ml-2">Shat Kriya Kala (Pathology Stage)</Text>
        </View>
        <Text className="text-[#607C64]/70 text-[10px] font-mono">Imbalance Forecast</Text>
      </View>

      <View className="items-center justify-center my-2 relative">
        <View className="w-full h-4 bg-[#F2EFE8] rounded-full overflow-hidden border border-[#E4E1D8] relative">
          <View style={{ width: `${imbalanceIndex}%` }} className="h-full bg-amber-400 rounded-full" />
          <View className="absolute left-[35%] top-0 bottom-0 w-[1px] bg-[#E4E1D8]" />
          <View className="absolute left-[65%] top-0 bottom-0 w-[1px] bg-[#E4E1D8]" />
        </View>
        <View className="flex-row justify-between w-full mt-2 px-1">
          <Text className="text-[8px] text-amber-600 font-bold uppercase">Sanchaya</Text>
          <Text className="text-[8px] text-orange-600 font-bold uppercase">Prakopa</Text>
          <Text className="text-[8px] text-red-500 font-bold uppercase">Prasara</Text>
        </View>
      </View>

      <View className="mt-4 p-4 bg-[#F5F2EA] rounded-2xl border border-[#E4E1D8]">
        <Text className="text-[#2E3A2F] text-xs font-bold">
          Current Stage: <Text className={stageName.color}>{stageName.name}</Text>
        </Text>
        <Text className="text-slate-600 text-[10px] mt-1.5 leading-relaxed">
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
        color: "#607C64",
        bg: "bg-white border-[#E4E1D8]"
      };
    }
    if (maxVal === vata) {
      return {
        title: "Predicted Vata Accumulation",
        warning: "Sustained high Vata (wind) is predicted to result in nervous tension, dry skin, and muscle stiffness within 36 hours. Pacify this by drinking warm liquids and avoiding dry, cold foods.",
        icon: "warning-outline",
        color: "#5C788A",
        bg: "bg-white border-[#E4E1D8]"
      };
    }
    if (maxVal === pitta) {
      return {
        title: "Predicted Pitta Aggravation",
        warning: "Sustained high Pitta (fire/heat) is predicted to trigger digestive acidity, skin redness, or sleep disturbance within 24 hours. Balance this by taking cooling fluids and sweet fruits.",
        icon: "flame-outline",
        color: "#C07A65",
        bg: "bg-white border-[#E4E1D8]"
      };
    }
    return {
      title: "Predicted Kapha Stagnation",
      warning: "Elevated Kapha (earth/water) indicates a risk of respiratory congestion and daytime lethargy within 48 hours. Stimulate circulation with brisk walking and warming ginger tea.",
      icon: "alert-circle-outline",
      color: "#607C64",
      bg: "bg-white border-[#E4E1D8]"
    };
  }, [vata, pitta, kapha]);

  return (
    <View className={`border p-5 rounded-3xl mb-6 relative overflow-hidden ${warningDetails.bg} shadow-sm`}>
      <View className="flex-row items-center mb-3">
        <Ionicons name={warningDetails.icon as any} size={18} color={warningDetails.color} />
        <Text className="text-[#2E3A2F] font-bold text-sm ml-2">{warningDetails.title}</Text>
      </View>
      <Text className="text-slate-650 text-xs leading-relaxed font-medium">
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
    if (score >= 80) return { label: 'High Confidence', color: 'text-[#607C64]', bg: 'bg-[#F5F2EA]/45 border-[#E4E1D8]', dot: 'bg-[#607C64]' };
    if (score >= 60) return { label: 'Moderate Confidence', color: 'text-amber-600', bg: 'bg-amber-500/5 border-amber-500/10', dot: 'bg-amber-500' };
    return { label: 'Low Confidence', color: 'text-rose-600', bg: 'bg-rose-500/5 border-rose-500/10', dot: 'bg-rose-500' };
  };

  const confidenceTheme = getConfidenceLevel(activeResult.confidenceScore);

  return (
    <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl mb-6 shadow-sm shadow-[#E4E1D8]/30">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-[#2E3A2F] text-base font-extrabold flex-row items-center font-serif">
          <Ionicons name="sparkles" size={16} color="#607C64" style={{ marginRight: 6 }} /> Predictive Health Forecast
        </Text>
        <View className="bg-[#F2EFE8] border border-[#E4E1D8] px-2 py-0.5 rounded-full">
          <Text className="text-[#607C64] text-[8px] font-mono uppercase">Density: {predictions.dataDensityScore}%</Text>
        </View>
      </View>

      {/* Interval Tabs */}
      <View className="flex-row bg-[#F2EFE8] p-1 rounded-xl border border-[#E4E1D8] mb-4">
        {(['tomorrow', 'next3Days', 'nextWeek'] as const).map((interval) => {
          const isSelected = activeInterval === interval;
          const label = interval === 'tomorrow' ? 'Tomorrow' : interval === 'next3Days' ? 'Next 3 Days' : 'Next Week';
          return (
            <TouchableOpacity
              key={interval}
              onPress={() => setActiveInterval(interval)}
              className={`flex-1 py-2 rounded-lg items-center ${
                isSelected ? 'bg-[#7D9C83]' : 'bg-transparent'
              }`}
            >
              <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-[#607C64]/80'}`}>
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
            <Text className="text-slate-500 text-[8px] leading-tight mt-0.5">{activeResult.confidenceExplanation}</Text>
          </View>
        </View>
        <Ionicons name="information-circle-outline" size={15} color="#607C64" />
      </View>

      {/* Vitals Forecast */}
      <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-wider mb-2.5 font-mono">Expected Vitals</Text>
      <View className="bg-[#F8F6F0] p-3 rounded-2xl border border-[#E4E1D8] mb-4">
        <ForecastProgress label="System Recovery" value={activeResult.target.recovery} color="bg-[#607C64]" />
        <ForecastProgress label="Circadian Energy" value={activeResult.target.energy} color="bg-[#5C788A]" />
        <ForecastProgress label="Sleep Restoration" value={activeResult.target.sleep} color="bg-[#7A9482]" />
      </View>

      {/* Constitutional Forecast */}
      <View className="flex-row justify-between items-center mb-2.5">
        <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-wider font-mono">Constitutional Balance</Text>
        <View className="bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
          <Text className="text-orange-600 text-[8px] font-bold uppercase">{activeResult.target.primaryAggravation} Aggravation</Text>
        </View>
      </View>
      <View className="bg-[#F8F6F0] p-3 rounded-2xl border border-[#E4E1D8] mb-4">
        <ForecastProgress label="Vata (Wind/Air)" value={activeResult.target.dosha.vata} color="bg-[#5C788A]" unit="%" />
        <ForecastProgress label="Pitta (Fire/Water)" value={activeResult.target.dosha.pitta} color="bg-[#C07A65]" unit="%" />
        <ForecastProgress label="Kapha (Water/Earth)" value={activeResult.target.dosha.kapha} color="bg-[#7A9482]" unit="%" />
      </View>

      {/* Engine Scores Forecast */}
      <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-wider mb-2.5 font-mono">Bio-Engine Scores</Text>
      <View className="flex-row space-x-3 mb-4">
        <View className="flex-1 bg-[#F8F6F0] p-3 rounded-2xl border border-[#E4E1D8]">
          <ForecastProgress label="Expected Agni" value={activeResult.target.agni} color="bg-[#C07A65]" />
        </View>
        <View className="flex-1 bg-[#F8F6F0] p-3 rounded-2xl border border-[#E4E1D8]">
          <ForecastProgress label="Expected Ojas" value={activeResult.target.ojas} color="bg-[#607C64]" />
        </View>
      </View>

      {/* Key Driver Analysis */}
      <View className="bg-[#F5F2EA] border border-[#E4E1D8] p-4 rounded-2xl mb-1">
        <Text className="text-[#607C64] text-[10px] font-bold uppercase tracking-wider mb-1.5 flex-row items-center font-mono">
          <Ionicons name="git-branch-outline" size={10} style={{ marginRight: 4 }} /> Key Trend Driver
        </Text>
        <Text className="text-[#2E3A2F] text-xs leading-relaxed mb-3">{activeResult.keyDriver}</Text>

        <Text className="text-[#607C64] text-[10px] font-bold uppercase tracking-wider mb-1.5 flex-row items-center font-mono">
          <Ionicons name="shield-checkmark" size={10} style={{ marginRight: 4 }} /> Recommendation
        </Text>
        <Text className="text-[#607C64] text-xs leading-relaxed font-semibold">{activeResult.recommendation}</Text>
      </View>
    </View>
  );
});

const ForecastProgress = ({ label, value, color, unit = '%' }: { label: string; value: number; color: string; unit?: string }) => {
  return (
    <View className="mb-2">
      <View className="flex-row justify-between mb-0.5">
        <Text className="text-slate-650 text-[9px] font-sans font-medium">{label}</Text>
        <Text className="text-[#2E3A2F] text-[9px] font-mono font-bold">{value}{unit}</Text>
      </View>
      <View className="w-full h-1.5 bg-[#E4E1D8] rounded-full overflow-hidden">
        <View style={{ width: `${value}%` }} className={`h-full rounded-full ${color}`} />
      </View>
    </View>
  );
};
