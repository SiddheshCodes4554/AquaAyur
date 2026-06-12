import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  KeyboardAvoidingView, 
  Platform,
  Keyboard,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { useSensorStore } from '../../store/useSensorStore';
import { useHydrationStore } from '../../store/useHydrationStore';
import { supabase } from '../../services/supabase';
import { generateCoachResponse, ChatHistoryRecord } from '../../services/aiCoachService';

const SUGGESTED_PROMPTS = [
  { label: 'Analyze my health', text: 'Analyze my biometrics, hydration levels, and general wearable stats for today.' },
  { label: 'Check my dosha balance', text: 'Check my current dosha status and suggest if my Pitta, Vata, or Kapha is aggravated.' },
  { label: 'Suggest today\'s meals', text: 'Suggest today\'s meals to balance my dominant Dosha profile.' },
  { label: 'Improve my sleep', text: 'What are some Ayurvedic tips to improve my sleep score and nightly rest?' },
  { label: 'Explain my heart rate trends', text: 'Explain my heart rate trends and how it relates to my stress and energy levels.' }
];

type DetailSheetType = 'pulse' | 'temp' | 'steps' | 'water' | null;

export default function CoachScreen() {
  const { profile, user } = useAuthStore();
  const { liveData, status: sensorStatus } = useSensorStore();
  const { todayTotalMl } = useHydrationStore();

  const [chatMessages, setChatMessages] = useState<ChatHistoryRecord[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [avatarPulse, setAvatarPulse] = useState(1);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [detailSheet, setDetailSheet] = useState<DetailSheetType>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  // 1. Monitor keyboard states to dynamically adjust input padding above the floating tab bar
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    
    // Fallbacks for Android
    const showSubAndroid = Keyboard.addListener('keyboardDidShow', (e) => {
      if (Platform.OS === 'android') setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSubAndroid = Keyboard.addListener('keyboardDidHide', () => {
      if (Platform.OS === 'android') setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      showSubAndroid.remove();
      hideSubAndroid.remove();
    };
  }, []);

  // 2. Avatar breathing pulse animation
  useEffect(() => {
    const pulseTimer = setInterval(() => {
      setAvatarPulse(p => (p === 1 ? 0.35 : 1));
    }, 1100);
    return () => clearInterval(pulseTimer);
  }, []);

  // 3. Fetch dialogue logs on load
  const fetchChatHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setChatMessages((data as ChatHistoryRecord[]) || []);
    } catch (e) {
      console.warn('[CoachChat] Failed to load chat logs:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, [user?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, thinking]);

  // Send Message Logic
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !user?.id || thinking) return;

    if (!textToSend) setInputText('');
    
    const newUserMsg: ChatHistoryRecord = { sender: 'user', message_text: text };
    setChatMessages(prev => [...prev, newUserMsg]);
    setThinking(true);

    try {
      // 1. Log to DB
      const { error: userErr } = await supabase
        .from('chat_history')
        .insert({
          user_id: user.id,
          sender: 'user',
          message_text: text
        });
      
      if (userErr) throw userErr;

      // 2. Generate response using updated Groq service with database context loading
      const response = await generateCoachResponse(
        user.id,
        chatMessages,
        text
      );

      const newAiMsg: ChatHistoryRecord = { sender: 'ai', message_text: response };
      setChatMessages(prev => [...prev, newAiMsg]);

      // 4. Log AI response
      const { error: aiErr } = await supabase
        .from('chat_history')
        .insert({
          user_id: user.id,
          sender: 'ai',
          message_text: response
        });

      if (aiErr) throw aiErr;

    } catch (error: any) {
      console.warn('[CoachChat] Messaging error:', error);
      const errorMsg: ChatHistoryRecord = { 
        sender: 'ai', 
        message_text: `⚠️ **Connection Alert:** ${error.message || 'Failed to sync message.'} Verify your network or credentials.`
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setThinking(false);
    }
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    const name = profile?.full_name?.split(' ')[0] || 'Yogi';
    if (hrs < 12) return `Good morning, ${name}`;
    if (hrs < 17) return `Good afternoon, ${name}`;
    return `Good evening, ${name}`;
  };

  // Card segment structure
  interface ParsedSegment {
    type: 'text' | 'card';
    content?: string;
    cardType?: 'Health' | 'Recovery' | 'Dosha' | 'Nutrition' | 'Trend';
    cardData?: Record<string, string>;
  }

  const parseMessageContent = (text: string): ParsedSegment[] => {
    const segments: ParsedSegment[] = [];
    const regex = /\[[Cc]ard:\s*(\w+)\]([\s\S]*?)(?:\[\/[Cc]ard\]|$)/gi;
    
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const precedingText = text.substring(lastIndex, matchIndex);
      if (precedingText.trim()) {
        segments.push({ type: 'text', content: precedingText });
      }
      
      const cardType = match[1];
      const cardBody = match[2];
      
      const cardData: Record<string, string> = {};
      const lines = cardBody.split('\n');
      lines.forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          const key = line.substring(0, colonIdx).trim().toLowerCase();
          const value = line.substring(colonIdx + 1).trim();
          cardData[key] = value;
        }
      });
      
      segments.push({
        type: 'card',
        cardType: cardType as any,
        cardData
      });
      
      lastIndex = regex.lastIndex;
    }
    
    const remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
      segments.push({ type: 'text', content: remainingText });
    }
    
    return segments;
  };

  const renderAICard = (cardType: string, cardData: Record<string, string>) => {
    const title = cardData['title'] || `${cardType} Analysis`;

    switch (cardType.toLowerCase()) {
      case 'health': {
        const score = cardData['score'] || '--';
        const status = cardData['status'] || 'Stable';
        const details = cardData['details'] || '';
        return (
          <View key={JSON.stringify(cardData)} className="bg-[#052219]/75 border border-emerald-500/25 rounded-2xl p-4 my-2.5 shadow-md shadow-black/30">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 items-center justify-center">
                  <Ionicons name="fitness" size={16} color="#10b981" />
                </View>
                <Text className="text-white text-xs font-bold">{title}</Text>
              </View>
              <View className="bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-0.5 rounded-full">
                <Text className="text-emerald-300 text-[10px] font-bold font-mono">{score}</Text>
              </View>
            </View>
            <View className="space-y-2">
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Status</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{status}</Text>
              </View>
              {details && (
                <Text className="text-emerald-100/80 text-[11px] leading-relaxed mt-1">
                  {details}
                </Text>
              )}
            </View>
          </View>
        );
      }
      case 'recovery': {
        const score = cardData['score'] || '--';
        const sleep = cardData['sleep'] || '--';
        const vitals = cardData['vitals'] || '--';
        return (
          <View key={JSON.stringify(cardData)} className="bg-[#052219]/75 border border-[#0ea5e9]/25 rounded-2xl p-4 my-2.5 shadow-md shadow-black/30">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-[#0ea5e9]/10 border border-[#0ea5e9]/25 items-center justify-center">
                  <Ionicons name="refresh-circle" size={16} color="#0ea5e9" />
                </View>
                <Text className="text-white text-xs font-bold">{title}</Text>
              </View>
              <View className="bg-[#0ea5e9]/20 border border-[#0ea5e9]/35 px-2.5 py-0.5 rounded-full">
                <Text className="text-sky-300 text-[10px] font-bold font-mono">{score}</Text>
              </View>
            </View>
            <View className="space-y-2">
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Sleep Recovery</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{sleep}</Text>
              </View>
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Autonomic Vitals</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{vitals}</Text>
              </View>
            </View>
          </View>
        );
      }
      case 'dosha': {
        const vata = cardData['vata'] || 'Stable';
        const pitta = cardData['pitta'] || 'Stable';
        const kapha = cardData['kapha'] || 'Stable';
        const aggravated = cardData['aggravated'] || 'None';
        return (
          <View key={JSON.stringify(cardData)} className="bg-[#052219]/75 border border-amber-500/25 rounded-2xl p-4 my-2.5 shadow-md shadow-black/30">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/25 items-center justify-center">
                  <Ionicons name="sunny" size={15} color="#f59e0b" />
                </View>
                <Text className="text-white text-xs font-bold">{title}</Text>
              </View>
              {aggravated !== 'None' && (
                <View className="bg-rose-500/15 border border-rose-500/35 px-2.5 py-0.5 rounded-full">
                  <Text className="text-rose-400 text-[8.5px] font-bold uppercase tracking-wider font-mono">Aggravated: {aggravated}</Text>
                </View>
              )}
            </View>
            <View className="space-y-1">
              <View className="flex-row justify-between border-b border-emerald-950/40 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Vata (Air)</Text>
                <Text className={`text-[10px] font-bold font-mono ${vata.toLowerCase() === 'aggravated' ? 'text-rose-400' : 'text-emerald-400'}`}>{vata}</Text>
              </View>
              <View className="flex-row justify-between border-b border-emerald-950/40 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Pitta (Fire)</Text>
                <Text className={`text-[10px] font-bold font-mono ${pitta.toLowerCase() === 'aggravated' ? 'text-rose-400' : 'text-emerald-400'}`}>{pitta}</Text>
              </View>
              <View className="flex-row justify-between border-b border-emerald-950/40 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Kapha (Earth)</Text>
                <Text className={`text-[10px] font-bold font-mono ${kapha.toLowerCase() === 'aggravated' ? 'text-rose-400' : 'text-emerald-400'}`}>{kapha}</Text>
              </View>
            </View>
          </View>
        );
      }
      case 'nutrition': {
        const calories = cardData['calories'] || '--';
        const macro = cardData['macro'] || '--';
        const advice = cardData['advice'] || '';
        return (
          <View key={JSON.stringify(cardData)} className="bg-[#052219]/75 border border-emerald-500/25 rounded-2xl p-4 my-2.5 shadow-md shadow-black/30">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 items-center justify-center">
                  <Ionicons name="restaurant" size={14} color="#10b981" />
                </View>
                <Text className="text-white text-xs font-bold">{title}</Text>
              </View>
            </View>
            <View className="space-y-2">
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Calorie Target</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{calories}</Text>
              </View>
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Ayurvedic Balance</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{macro}</Text>
              </View>
              {advice && (
                <Text className="text-emerald-250/90 text-[11px] leading-relaxed mt-1 italic">
                  Advice: {advice}
                </Text>
              )}
            </View>
          </View>
        );
      }
      case 'trend': {
        const metric = cardData['metric'] || '';
        const direction = cardData['direction'] || 'Stable';
        const explanation = cardData['explanation'] || '';
        
        let arrowIcon: any = 'trending-up';
        let arrowColor = '#10b981';
        if (direction.toLowerCase() === 'declining') {
          arrowIcon = 'trending-down';
          arrowColor = '#f43f5e';
        } else if (direction.toLowerCase() === 'stable') {
          arrowIcon = 'remove';
          arrowColor = '#9ca3af';
        }

        return (
          <View key={JSON.stringify(cardData)} className="bg-[#052219]/75 border border-emerald-500/15 rounded-2xl p-4 my-2.5 shadow-md shadow-black/30">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 items-center justify-center">
                  <Ionicons name={arrowIcon} size={15} color={arrowColor} />
                </View>
                <Text className="text-white text-xs font-bold">{title}</Text>
              </View>
              <View className="bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                <Ionicons name={arrowIcon} size={10} color={arrowColor} />
                <Text className="text-emerald-300 text-[9px] font-bold uppercase tracking-wider font-mono">{direction}</Text>
              </View>
            </View>
            <View className="space-y-1">
              <View className="flex-row justify-between border-b border-emerald-950 py-1">
                <Text className="text-emerald-400/60 text-[10px] uppercase font-bold">Metric</Text>
                <Text className="text-white text-[10px] font-bold font-mono">{metric}</Text>
              </View>
              {explanation && (
                <Text className="text-emerald-100/80 text-[11px] leading-relaxed mt-1">
                  {explanation}
                </Text>
              )}
            </View>
          </View>
        );
      }
      default:
        return null;
    }
  };

  // Render message bubble with markdown and card support
  const renderMessageContentParsed = (text: string, isUser: boolean) => {
    if (!text) return null;
    
    if (isUser) {
      return renderMessageText(text, true);
    }

    const segments = parseMessageContent(text);
    return segments.map((seg, sIdx) => {
      if (seg.type === 'card' && seg.cardType && seg.cardData) {
        return renderAICard(seg.cardType, seg.cardData);
      }
      return <View key={sIdx}>{renderMessageText(seg.content || '', false)}</View>;
    });
  };

  // Render message bubble with markdown support
  const cleanMessageText = (inputText: string): string => {
    let cleaned = inputText;
    
    // Strip markdown code blocks containing JSON or raw text
    cleaned = cleaned.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1');
    cleaned = cleaned.replace(/```\s*([\s\S]*?)\s*```/gi, '$1');

    // If it's a raw JSON structure, format it nicely
    const trimmed = cleaned.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Object.entries(parsed)
          .map(([key, val]) => {
            const capKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
            if (typeof val === 'object' && val !== null) {
              return `**${capKey}**:\n${JSON.stringify(val, null, 2)}`;
            }
            return `**${capKey}**: ${val}`;
          })
          .join('\n');
      } catch (e) {
        // Keep as is if invalid JSON
      }
    }

    // Strip any accidental dangling card tags (case-insensitive)
    cleaned = cleaned.replace(/\[[Cc]ard:\s*\w+\]/gi, '');
    cleaned = cleaned.replace(/\[\/[Cc]ard\]/gi, '');
    
    return cleaned;
  };

  const renderMessageText = (text: string, isUser: boolean) => {
    if (!text) return null;
    const cleanedText = cleanMessageText(text);
    const lines = cleanedText.split('\n');

    return lines.map((line, idx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return <View key={idx} className="h-1.5" />;

      // Sub-headings inside response
      if (cleanLine.startsWith('###') || cleanLine.startsWith('##')) {
        const headerText = cleanLine.replace(/^[#\s]+/, '');
        return (
          <Text key={idx} className={`font-bold mt-3 mb-1 text-[13px] ${isUser ? 'text-emerald-950' : 'text-emerald-300'}`}>
            {headerText}
          </Text>
        );
      }

      // Bullet points
      if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
        const content = cleanLine.substring(1).trim();
        return (
          <View key={idx} className="flex-row items-start py-0.5">
            <Text className={`mr-1 text-[12px] ${isUser ? 'text-emerald-900' : 'text-emerald-400'}`}>•</Text>
            <Text className={`text-[12px] flex-1 leading-relaxed ${isUser ? 'text-emerald-950 font-bold' : 'text-emerald-100/90'}`}>
              {renderBoldInline(content, isUser)}
            </Text>
          </View>
        );
      }

      return (
        <Text key={idx} className={`text-[12.5px] leading-relaxed mb-1.5 ${isUser ? 'text-emerald-950 font-bold' : 'text-emerald-100/90'}`}>
          {renderBoldInline(cleanLine, isUser)}
        </Text>
      );
    });
  };

  const renderBoldInline = (text: string, isUser: boolean) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    if (parts.length === 1) return text;
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <Text key={index} className={`font-bold ${isUser ? 'text-emerald-950 underline' : 'text-emerald-300'}`}>{part}</Text>;
      }
      return part;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020b08' }}>
      <LinearGradient colors={['#03120f', '#010605']} className="flex-1">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          className="flex-1"
        >
          {/* Header */}
          <View className="px-6 py-4 flex-row items-center justify-between border-b border-emerald-900/35 bg-[#03120f]/60">
            <View className="flex-row items-center gap-3">
              {/* Breathing Avatar Container */}
              <View className="relative w-11 h-11 items-center justify-center rounded-full bg-emerald-950/60 border border-emerald-500/20 shadow-md shadow-emerald-500/5">
                <View style={{ opacity: avatarPulse, transform: [{ scale: 1.05 }] }} className="absolute inset-0 rounded-full border border-emerald-400/30" />
                <Ionicons name="sparkles" size={20} color="#10b981" />
              </View>
              <View>
                <Text className="text-white text-lg font-bold tracking-tight">AquaGuru</Text>
                <Text className="text-emerald-400/60 text-[10.5px] font-semibold tracking-wide">
                  Your AI Wellness Companion
                </Text>
              </View>
            </View>

            <View className="items-end gap-1">
              <View className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex-row items-center">
                <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sensorStatus === 'connected' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                <Text className="text-emerald-400 text-[8.5px] font-bold uppercase tracking-wider font-mono">
                  {sensorStatus === 'connected' ? 'ESP32 Connected' : 'AquaGuru Online'}
                </Text>
              </View>
              <Text className="text-emerald-500/40 text-[8px] font-mono tracking-wide uppercase">
                {sensorStatus === 'connected' ? 'Realtime streaming active' : 'Last Synced 2 min ago'}
              </Text>
            </View>
          </View>

          {/* Today's Context Chips (Interactive Vitals) */}
          <View className="bg-[#051f18]/25 border-b border-emerald-900/30 py-2.5 px-4 flex-row justify-around">
            {/* Pulse */}
            <TouchableOpacity onPress={() => setDetailSheet('pulse')} className="items-center bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-900/25 flex-row gap-1 active:bg-emerald-900/10">
              <Ionicons name="heart" size={12} color="#f43f5e" />
              <Text className="text-white text-[10px] font-bold font-mono">
                {liveData ? `${liveData.heartRate}` : '--'}
                <Text className="text-rose-400/60 font-sans font-normal"> bpm</Text>
              </Text>
            </TouchableOpacity>

            {/* Temp */}
            <TouchableOpacity onPress={() => setDetailSheet('temp')} className="items-center bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-900/25 flex-row gap-1 active:bg-emerald-900/10">
              <Ionicons name="thermometer" size={12} color="#0ea5e9" />
              <Text className="text-white text-[10px] font-bold font-mono">
                {liveData ? `${liveData.temperature.toFixed(1)}` : '--'}
                <Text className="text-sky-400/60 font-sans font-normal"> °C</Text>
              </Text>
            </TouchableOpacity>

            {/* Steps */}
            <TouchableOpacity onPress={() => setDetailSheet('steps')} className="items-center bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-900/25 flex-row gap-1 active:bg-emerald-900/10">
              <Ionicons name="footsteps" size={12} color="#eab308" />
              <Text className="text-white text-[10px] font-bold font-mono">
                {liveData ? `${liveData.steps}` : '--'}
                <Text className="text-amber-400/60 font-sans font-normal"> st</Text>
              </Text>
            </TouchableOpacity>

            {/* Water */}
            <TouchableOpacity onPress={() => setDetailSheet('water')} className="items-center bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-900/25 flex-row gap-1 active:bg-emerald-900/10">
              <Ionicons name="water" size={12} color="#38bdf8" />
              <Text className="text-white text-[10px] font-bold font-mono">
                {todayTotalMl}
                <Text className="text-sky-400/60 font-sans font-normal"> ml</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Chat Stream */}
          <ScrollView
            ref={scrollViewRef}
            onContentSizeChange={scrollToBottom}
            className="flex-1 px-6 py-4"
            contentContainerStyle={{ paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
            {loadingHistory ? (
              <View className="flex-1 justify-center items-center py-24">
                <ActivityIndicator size="small" color="#34d399" />
                <Text className="text-emerald-400/60 text-xs mt-2.5">Fetching conversation cache...</Text>
              </View>
            ) : chatMessages.length === 0 ? (
              /* EMPTY STATE ONBOARDING */
              <View key="empty-state" className="py-10 items-center px-4">
                <View className="relative w-18 h-18 items-center justify-center rounded-full bg-emerald-950/40 border border-emerald-500/25 mb-6 will-change-variable shadow-lg shadow-emerald-500/5">
                  <View style={{ opacity: avatarPulse, transform: [{ scale: 1.1 }] }} className="absolute inset-0 rounded-full border border-emerald-400/35" />
                  <Ionicons name="sparkles" size={32} color="#10b981" />
                </View>
                <Text className="text-white text-2xl font-bold mb-2 text-center">{getGreeting()}</Text>
                <Text className="text-emerald-350 text-xs font-semibold mb-4 text-center font-mono">AI Readiness: Optimal</Text>
                <Text className="text-emerald-100/70 text-[12.5px] text-center px-6 leading-relaxed mb-8">
                  I analyzed your wearable data and I'm ready to help. Choose one of the options below to get started or ask me anything.
                </Text>

                {/* Suggested actions list */}
                <Text className="text-emerald-400/50 text-[10px] uppercase tracking-wider font-bold mb-4 font-mono">Suggested Actions</Text>
                <View className="w-full space-y-3 px-2">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleSendMessage(prompt.text)}
                      className="bg-emerald-950/35 border border-emerald-900/40 p-4 rounded-2xl flex-row justify-between items-center active:bg-emerald-900/30 shadow-sm"
                    >
                      <Text className="text-emerald-250 text-xs font-bold">{prompt.label}</Text>
                      <View className="w-6 h-6 rounded-full bg-emerald-950/80 border border-emerald-900/40 items-center justify-center">
                        <Ionicons name="chevron-forward" size={12} color="#34d399" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View className="space-y-4">
                {chatMessages.map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <View key={index} className={`flex-row w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <View className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-2 self-end mb-1">
                          <Ionicons name="sparkles" size={12} color="#34d399" />
                        </View>
                      )}
                      
                      <View className={`max-w-[85%] rounded-2xl px-4 py-3 border ${
                        isUser 
                          ? 'bg-emerald-500 border-emerald-450/30 rounded-br-none shadow-md shadow-emerald-500/5' 
                          : 'bg-[#051f18]/30 border-emerald-900/35 rounded-bl-none shadow-sm'
                      }`}>
                        {renderMessageContentParsed(msg.message_text, isUser)}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Typing thinking indicator */}
            {thinking && (
              <View className="flex-row justify-start w-full mt-4">
                <View className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 items-center justify-center mr-2 self-end mb-1">
                  <Ionicons name="sparkles" size={12} color="#34d399" />
                </View>
                <View className="bg-[#051f18]/30 border border-emerald-900/35 rounded-2xl rounded-bl-none px-4 py-3 flex-row items-center shadow-sm">
                  <ActivityIndicator size="small" color="#34d399" className="mr-2" />
                  <Text className="text-emerald-400 text-xs font-semibold font-mono">Thinking...</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Quick Action Pills above the input */}
          <View className="px-4 py-2 border-t border-emerald-900/25 flex-row gap-2 bg-[#020b08]/50">
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} className="py-1">
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSendMessage(p.text)}
                  className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full mr-2 active:bg-emerald-500/20"
                >
                  <Text className="text-emerald-400 text-[10px] font-bold">{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Panel Dialogue Bar */}
          <View 
            style={{ 
              paddingBottom: keyboardHeight > 0 ? 10 : (Platform.OS === 'ios' ? 92 : 82) 
            }} 
            className="p-4 bg-[#03120f] border-t border-emerald-900/30 flex-row items-center gap-2"
          >
            {/* Attachment Button */}
            <TouchableOpacity className="p-2.5 rounded-full bg-emerald-950/60 border border-emerald-900/30 active:bg-emerald-900/20">
              <Ionicons name="attach-outline" size={18} color="#34d399" />
            </TouchableOpacity>

            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask AquaGuru about your health..."
              placeholderTextColor="#046a4d"
              onSubmitEditing={() => handleSendMessage()}
              className="flex-1 bg-emerald-950/80 border border-emerald-900/40 rounded-full px-4 py-3 text-white text-xs font-medium"
            />

            {/* Audio microphone button (Voice assistant prep) */}
            <TouchableOpacity className="p-2.5 rounded-full bg-emerald-950/60 border border-emerald-900/30 active:bg-emerald-900/20">
              <Ionicons name="mic-outline" size={18} color="#34d399" />
            </TouchableOpacity>

            {/* Send Button */}
            <TouchableOpacity
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || thinking}
              className={`p-3 rounded-full justify-center items-center ${
                inputText.trim() && !thinking ? 'bg-emerald-500 active:bg-emerald-600 shadow-md shadow-emerald-500/20' : 'bg-emerald-950/60 border border-emerald-900/45'
              }`}
            >
              <Ionicons 
                name="send" 
                size={14} 
                color={inputText.trim() && !thinking ? '#022c22' : '#046a4d'} 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* VITALS INTERACTIVE BOTTOM SHEET MODAL */}
        {detailSheet && (
          <Modal
            visible={true}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setDetailSheet(null)}
          >
            <View className="flex-1 bg-[#020b08]/85 justify-end">
              <View className="bg-[#03120f] border-t border-emerald-800/40 rounded-t-3xl p-6 min-h-[300px]">
                {/* Drag handle visual */}
                <View className="w-12 h-1 bg-emerald-900/40 rounded-full align-self-center mb-6 mx-auto" />

                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center gap-2">
                    <Ionicons 
                      name={
                        detailSheet === 'pulse' ? 'heart' : 
                        detailSheet === 'temp' ? 'thermometer' : 
                        detailSheet === 'steps' ? 'footsteps' : 'water'
                      } 
                      size={20} 
                      color={
                        detailSheet === 'pulse' ? '#f43f5e' : 
                        detailSheet === 'temp' ? '#0ea5e9' : 
                        detailSheet === 'steps' ? '#eab308' : '#38bdf8'
                      } 
                    />
                    <Text className="text-white text-base font-bold capitalize">{detailSheet} Indicator</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDetailSheet(null)}
                    className="p-1 rounded-lg bg-emerald-950 border border-emerald-900/30"
                  >
                    <Ionicons name="close" size={18} color="#34d399" />
                  </TouchableOpacity>
                </View>

                {/* Detailed Vitals content */}
                {detailSheet === 'pulse' && (
                  <View className="space-y-4 mt-2">
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Vitals Mode</Text>
                      <Text className="text-white font-bold text-xs font-mono">Heart Rate Monitor</Text>
                    </View>
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Target Range</Text>
                      <Text className="text-white font-bold text-xs font-mono">60 - 80 bpm</Text>
                    </View>
                    <Text className="text-emerald-200/80 text-[11px] leading-relaxed mt-2">
                      Pulse stability indicates healthy autonomic sleep-recovery loops. High variations may point to a Vata aggravation (excess biological wind/stress). Keep warm, grounded, and stay hydrated.
                    </Text>
                  </View>
                )}

                {detailSheet === 'temp' && (
                  <View className="space-y-4 mt-2">
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Sensor Mode</Text>
                      <Text className="text-white font-bold text-xs font-mono">Skin Temperature</Text>
                    </View>
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Standard Reference</Text>
                      <Text className="text-white font-bold text-xs font-mono">36.1 - 37.2 °C</Text>
                    </View>
                    <Text className="text-emerald-200/80 text-[11px] leading-relaxed mt-2">
                      High skin temperature points directly to Pitta elevation (excess metabolic heat/fire). Focus on cooling meals (mint, fennel, cucumber) and avoid mid-day sunlight or strenuous training.
                    </Text>
                  </View>
                )}

                {detailSheet === 'steps' && (
                  <View className="space-y-4 mt-2">
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Pedometer Mode</Text>
                      <Text className="text-white font-bold text-xs font-mono">Physical Steps</Text>
                    </View>
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Daily Goal</Text>
                      <Text className="text-white font-bold text-xs font-mono">8,000 steps</Text>
                    </View>
                    <Text className="text-emerald-200/80 text-[11px] leading-relaxed mt-2">
                      Steps count tracks daily exercise compliance. Steady cardiovascular movement stimulates blood circulation and metabolic processes, helping counteract Kapha lethargy standard.
                    </Text>
                  </View>
                )}

                {detailSheet === 'water' && (
                  <View className="space-y-4 mt-2">
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Hydration Mode</Text>
                      <Text className="text-white font-bold text-xs font-mono">Fluids intake</Text>
                    </View>
                    <View className="flex-row justify-between py-2 border-b border-emerald-900/20">
                      <Text className="text-emerald-300/70 text-xs">Target Intake</Text>
                      <Text className="text-white font-bold text-xs font-mono">{profile?.daily_water_goal_ml || 2500} ml</Text>
                    </View>
                    <Text className="text-emerald-200/80 text-[11px] leading-relaxed mt-2">
                      Consistent water intake regulates fluid balance, supports skin health, and balances Vata dry qualities. Avoid extremely ice-cold liquids in the evening.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setDetailSheet(null)}
                  className="bg-emerald-500 py-3 rounded-xl active:bg-emerald-600 mt-8 items-center"
                >
                  <Text className="text-emerald-950 font-bold text-xs">Acknowledge</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

      </LinearGradient>
    </SafeAreaView>
  );
}
