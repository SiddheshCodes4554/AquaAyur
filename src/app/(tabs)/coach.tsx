import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Modal,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';
import { generateCoachResponse, ChatHistoryRecord } from '../../services/aiCoachService';
import { generatePhysicianConsultation, PhysicianConsultation } from '../../services/physicianService';

type ConsultationPhase = 'morning' | 'afternoon' | 'evening' | 'weekly' | 'monthly';

export default function CoachScreen() {
  const { user } = useAuthStore();
  
  const [subTab, setSubTab] = useState<'assessment' | 'chat'>('assessment');
  const [activePhase, setActivePhase] = useState<ConsultationPhase>('morning');
  const [consultation, setConsultation] = useState<PhysicianConsultation | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Follow up Chat states
  const [chatMessages, setChatMessages] = useState<ChatHistoryRecord[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const voiceWaveAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (voiceModeActive) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(voiceWaveAnim, {
            toValue: 1.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(voiceWaveAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      );
      anim.start();
    } else {
      voiceWaveAnim.setValue(1);
    }
    return () => anim?.stop();
  }, [voiceModeActive]);

  const handleTriggerVoiceSpeech = () => {
    setVoiceModeActive(true);
  };

  const toggleVoiceModeOff = () => {
    setVoiceModeActive(false);
    setInputText("Explain the benefits of drinking warm water with dry ginger for digestion.");
  };
  
  const scrollViewRef = useRef<ScrollView>(null);

  // Load Proactive Consultation
  useEffect(() => {
    async function loadConsult() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await generatePhysicianConsultation(user.id, activePhase);
        setConsultation(data);
      } catch (err) {
        console.warn('Failed loading consult:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConsult();
  }, [user?.id, activePhase]);

  // Load chat history for follow-ups
  const fetchChatHistory = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('chat_history')
        .select('sender, message_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(30);

      if (error) throw error;
      if (data && data.length > 0) {
        setChatMessages(data.map(d => ({ sender: d.sender as any, message_text: d.message_text })));
      } else {
        setChatMessages([
          { sender: 'ai', message_text: "Namaste. I am AquaGuru, your Ayurvedic Physician. Feel free to ask any follow-up questions about today's prescription." }
        ]);
      }
    } catch (err) {
      console.warn('Chat history load failed: ', err);
    }
  };

  useEffect(() => {
    if (subTab === 'chat') {
      fetchChatHistory();
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [subTab]);

  // Handle follow up send
  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !user?.id || thinking) return;

    setInputText('');
    const newUserMsg: ChatHistoryRecord = { sender: 'user', message_text: text };
    setChatMessages(prev => [...prev, newUserMsg]);
    setThinking(true);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      // 1. Log User message
      await supabase.from('chat_history').insert({
        user_id: user.id,
        sender: 'user',
        message_text: text
      });

      // 2. Query Grounded AI Response
      const reply = await generateCoachResponse(user.id, chatMessages, text);

      const newAiMsg: ChatHistoryRecord = { sender: 'ai', message_text: reply };
      setChatMessages(prev => [...prev, newAiMsg]);

      // 3. Log AI Response
      await supabase.from('chat_history').insert({
        user_id: user.id,
        sender: 'ai',
        message_text: reply
      });
    } catch (err: any) {
      console.warn('Follow up message failed: ', err);
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', message_text: `⚠️ **Connection Alert:** ${err.message || 'Failed to send message.'}` }
      ]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const getPhaseTitle = (phase: ConsultationPhase) => {
    switch (phase) {
      case 'morning': return 'Morning Consultation';
      case 'afternoon': return 'Afternoon Check-in';
      case 'evening': return 'Evening Review';
      case 'weekly': return 'Weekly Summary';
      case 'monthly': return 'Monthly Health Summary';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#01140f]" edges={['top']}>
      <LinearGradient
        colors={['#022c22', '#01140f']}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-3 border-b border-emerald-950 flex-row justify-between items-center">
          <View>
            <Text className="text-white text-lg font-black tracking-wide">AquaGuru Physician</Text>
            <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">Clinical Ayurvedic Consultations</Text>
          </View>
          <View className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-900/35 items-center justify-center">
            <Ionicons name="medical" size={16} color="#34d399" />
          </View>
        </View>

        {/* Subtab Segment Control */}
        <View className="flex-row p-1.5 bg-[#051a14]/60 border-b border-emerald-950/50">
          <TouchableOpacity
            onPress={() => setSubTab('assessment')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${subTab === 'assessment' ? 'bg-[#10b981]/15 border border-[#10b981]/30' : 'opacity-60'}`}
          >
            <Text className="text-white text-xs font-serif font-black">Physician Assessment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSubTab('chat')}
            className={`flex-1 py-2 rounded-xl items-center justify-center ${subTab === 'chat' ? 'bg-[#10b981]/15 border border-[#10b981]/30' : 'opacity-60'}`}
          >
            <Text className="text-white text-xs font-serif font-black">AquaGuru Chatbot</Text>
          </TouchableOpacity>
        </View>

        {subTab === 'assessment' ? (
          <>
            {/* Dynamic Consult Phase Tab Selectors */}
            <View className="px-4 py-3 bg-emerald-950/20 border-b border-emerald-900/10">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 10 }} className="flex-row">
                {(['morning', 'afternoon', 'evening', 'weekly', 'monthly'] as ConsultationPhase[]).map((phase) => {
                  const isSelected = activePhase === phase;
                  const label = phase === 'morning' ? 'Morning' : phase === 'afternoon' ? 'Midday' : phase === 'evening' ? 'Evening' : phase === 'weekly' ? 'Weekly' : 'Monthly';
                  return (
                    <TouchableOpacity
                      key={phase}
                      onPress={() => setActivePhase(phase)}
                      className={`px-4 py-2 rounded-xl mr-2 border ${
                        isSelected 
                          ? 'bg-emerald-500 border-emerald-400' 
                          : 'bg-emerald-950/40 border-emerald-900/30'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${isSelected ? 'text-emerald-950' : 'text-emerald-400'}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
              {loading ? (
                <View className="flex-1 py-20 items-center justify-center">
                  <ActivityIndicator size="large" color="#10b981" />
                  <Text className="text-emerald-400 text-xs font-medium mt-4">Compiling physician's assessment...</Text>
                </View>
              ) : consultation ? (
                <View className="space-y-5">
                  
                  {/* Prescription Sheet Card */}
                  <View className="bg-[#051f18]/30 border-2 border-emerald-800/30 p-6 rounded-3xl relative overflow-hidden">
                    <View className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-emerald-500/5 rounded-full pointer-events-none" />
                    
                    {/* Header */}
                    <View className="border-b border-emerald-850/40 pb-4 mb-4 flex-row justify-between items-start">
                      <View>
                        <Text className="text-white text-base font-extrabold">{getPhaseTitle(consultation.phase)}</Text>
                        <Text className="text-emerald-400/50 text-[10px] mt-0.5 font-mono">B.A.M.S. Certified Counselor</Text>
                      </View>
                      <View className="bg-emerald-950/60 border border-emerald-900/40 px-2.5 py-0.5 rounded-full">
                        <Text className="text-emerald-400 text-[8px] font-mono uppercase">State: {consultation.dominantDoshaLabel}</Text>
                      </View>
                    </View>

                    {/* Assessment text */}
                    <View className="mb-6">
                      <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest mb-1.5">Physician's Assessment</Text>
                      <Text className="text-emerald-100 text-xs italic leading-relaxed pl-3 border-l-2 border-emerald-500">
                        "{consultation.assessment}"
                      </Text>
                    </View>

                    {/* Prescriptions Grid */}
                    <Text className="text-emerald-400 text-[9px] uppercase font-bold tracking-widest mb-3">Therapeutic Prescriptions</Text>
                    <View className="space-y-3">
                      {consultation.prescriptions.map((pres, idx) => (
                        <View key={idx} className="bg-emerald-950/30 border border-emerald-900/20 p-4 rounded-2xl">
                          <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-white text-xs font-bold">{pres.instruction}</Text>
                            <View className="bg-emerald-500/10 border border-emerald-500/35 px-2 py-0.5 rounded">
                              <Text className="text-emerald-400 text-[8px] font-bold uppercase">{pres.category}</Text>
                            </View>
                          </View>
                          <Text className="text-slate-300 text-[10px] leading-relaxed font-sans">
                            Rationale: {pres.rationale}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Diagnostic Indexes used */}
                    <View className="mt-6 pt-4 border-t border-emerald-850/40 flex-row justify-between items-center">
                      <View>
                        <Text className="text-emerald-400/50 text-[8px] font-mono uppercase">Digestion Index: {consultation.agniClassification}</Text>
                        <Text className="text-emerald-400/50 text-[8px] font-mono uppercase mt-0.5">Immunity Index: {consultation.ojasClassification}</Text>
                      </View>
                      <Ionicons name="finger-print-outline" size={16} color="#047857" />
                    </View>
                  </View>

                  {/* Clinical Evidence badges */}
                  <View className="bg-[#051f18]/30 border border-emerald-800/20 p-5 rounded-2xl">
                    <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-3">Referenced Biometrics</Text>
                    <View className="flex-row flex-wrap">
                      {consultation.vitalMetricsUsed.map((metric, idx) => (
                        <View key={idx} className="bg-emerald-950/40 border border-emerald-900/30 px-3 py-2 rounded-xl mr-2 mb-2 flex-row items-center">
                          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
                          <Text className="text-emerald-300 text-[10px] font-medium mr-1.5">{metric.label}:</Text>
                          <Text className="text-white text-[10px] font-bold font-mono">{metric.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Ask Follow Up Button */}
                  <TouchableOpacity
                    onPress={() => setSubTab('chat')}
                    className="bg-emerald-500 py-4 rounded-2xl flex-row justify-center items-center active:bg-emerald-600 shadow-md mb-6"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#022c22" style={{ marginRight: 8 }} />
                    <Text className="text-emerald-950 font-black text-xs uppercase tracking-wider">Ask Follow-up Question</Text>
                  </TouchableOpacity>

                </View>
              ) : (
                <View className="py-20 items-center justify-center">
                  <Text className="text-emerald-400/50 text-xs italic">No consultation records available today.</Text>
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <View className="flex-1">
            {/* Chat messages */}
            <ScrollView 
              ref={scrollViewRef}
              className="flex-1 px-5 pt-4"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <View 
                    key={idx} 
                    className={`mb-4 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <View 
                      className={`max-w-[85%] p-4.5 rounded-3xl border ${
                        isUser 
                          ? 'bg-emerald-500 border-emerald-400 rounded-tr-none' 
                          : 'bg-[#111d19]/65 border-[#1f372f] rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <Text className="text-emerald-950 font-bold text-xs leading-relaxed font-sans">
                          {msg.message_text}
                        </Text>
                      ) : (
                        <DoctorMessageContent text={msg.message_text} />
                      )}
                    </View>
                  </View>
                );
              })}

              {thinking && <WellnessTypingIndicator />}
            </ScrollView>

            {/* Suggestion Chips Panel */}
            {inputText.trim() === '' && (
              <View className="px-4 py-2 border-t border-[#1f372f]/30">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {[
                    "Explain Kapha pacifying herbs.",
                    "Are warm spices good for Pitta?",
                    "Breathing for high stress index.",
                    "How does hydration affect Agni?"
                  ].map((sug, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setInputText(sug)}
                      className="bg-[#111d19] border border-[#1f372f] px-3.5 py-1.5 rounded-full mr-2 active:bg-emerald-950"
                    >
                      <Text className="text-emerald-400 text-[9px] font-bold font-mono">{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input section */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              className="border-t border-[#1f372f] bg-[#091310] p-4 flex-row items-center font-sans"
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask for dietary adjustments, dosage guidelines..."
                placeholderTextColor="#064e3b"
                style={{ flex: 1, marginRight: 8 }}
                className="h-12 bg-[#111d19]/40 border border-[#1f372f] rounded-xl px-4 text-white text-xs font-sans"
              />
              
              {/* Voice Intake Toggle button */}
              <TouchableOpacity
                onPress={handleTriggerVoiceSpeech}
                className="w-12 h-12 rounded-xl bg-[#111d19] border border-[#1f372f] justify-center items-center active:bg-emerald-900/10 mr-2"
              >
                <Ionicons name="mic-outline" size={20} color="#34d399" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={thinking || !inputText.trim()}
                className="w-12 h-12 rounded-xl bg-emerald-500 justify-center items-center active:bg-emerald-600 disabled:bg-[#111d19] disabled:border disabled:border-[#1f372f]"
              >
                <Ionicons name="send" size={16} color={inputText.trim() ? '#022c22' : '#047857'} />
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        )}

        {/* VOICE INPUT SIMULATOR MODAL */}
        <Modal
          visible={voiceModeActive}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setVoiceModeActive(false)}
        >
          <View className="flex-1 bg-[#091310]/95 items-center justify-center">
            <View className="w-72 bg-[#111d19] border border-[#1f372f] p-8 rounded-3xl items-center shadow-2xl">
              <Text className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Voice Consultation</Text>
              <Text className="text-white text-base font-serif font-bold text-center px-4 leading-normal mb-8">
                Speak your symptoms or wellness questions...
              </Text>

              {/* Pulsing Mic Ring */}
              <View className="w-24 h-24 items-center justify-center mb-8 relative">
                <Animated.View 
                  style={{
                    transform: [{ scale: voiceWaveAnim }],
                    opacity: voiceWaveAnim.interpolate({ inputRange: [1, 1.4], outputRange: [0.6, 0] }),
                    position: 'absolute'
                  }}
                  className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40"
                />
                <TouchableOpacity
                  onPress={toggleVoiceModeOff}
                  className="w-16 h-16 rounded-full bg-emerald-500 justify-center items-center active:bg-emerald-600 shadow"
                >
                  <Ionicons name="mic" size={28} color="#022c22" />
                </TouchableOpacity>
              </View>

              <Text className="text-slate-400 text-[9px] text-center font-mono uppercase tracking-widest">Listening... Tap Mic to Stop</Text>
              
              <TouchableOpacity
                onPress={() => setVoiceModeActive(false)}
                className="mt-6 border border-red-500/20 bg-red-500/5 px-6 py-2.5 rounded-full active:bg-red-500/10"
              >
                <Text className="text-red-400 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const DoctorMessageContent = React.memo(function DoctorMessageContent({ text }: { text: string }) {
  const sourceMatches = text.match(/Source:\s*([^\n\r]+)/i);
  let mainText = text;
  let sourceText = "";
  if (sourceMatches) {
    mainText = text.replace(sourceMatches[0], '').trim();
    sourceText = sourceMatches[1];
  }

  const bpmMatches = text.match(/(\d+)\s*bpm/i);
  const tempMatches = text.match(/(\d+(?:\.\d+)?)\s*°?C/i);

  const lines = mainText.split('\n');

  return (
    <View className="space-y-3">
      <View>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const content = trimmed.substring(1).trim();
            const boldMatch = content.match(/^\*\*([^*]+)\*\*:\s*(.*)/);
            if (boldMatch) {
              return (
                <View key={idx} className="bg-[#172722]/60 border border-[#1f372f]/50 p-3 rounded-2xl my-1 flex-row items-start">
                  <View className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2.5" />
                  <View className="flex-1">
                    <Text className="text-white text-xs font-bold font-serif">{boldMatch[1]}</Text>
                    <Text className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{boldMatch[2]}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={idx} className="bg-[#172722]/30 border border-[#1f372f]/30 p-2.5 rounded-xl my-0.5 flex-row items-center">
                <Ionicons name="sparkles" size={10} color="#10b981" style={{ marginRight: 8 }} />
                <Text className="text-slate-300 text-xs flex-1 leading-relaxed">{content}</Text>
              </View>
            );
          }

          if (trimmed.startsWith('###')) {
            return (
              <Text key={idx} className="text-white text-sm font-serif font-black mt-2.5 mb-1">
                {trimmed.replace(/###/g, '').trim()}
              </Text>
            );
          }

          return (
            <Text key={idx} className="text-slate-200 text-xs leading-relaxed mb-1.5 font-sans">
              {trimmed}
            </Text>
          );
        })}
      </View>

      {(bpmMatches || tempMatches) && (
        <View className="bg-[#172722] border border-[#1f372f] p-4.5 rounded-2xl flex-row justify-between items-center my-2">
          <View>
            <Text className="text-emerald-400 text-[8px] uppercase font-bold tracking-widest font-mono">Biometric References</Text>
            {bpmMatches && (
              <Text className="text-white text-xs font-bold font-mono mt-1">Heart Rate: {bpmMatches[1]} BPM</Text>
            )}
            {tempMatches && (
              <Text className="text-white text-xs font-bold font-mono mt-0.5">Skin Temp: {tempMatches[1]} °C</Text>
            )}
          </View>
          <View className="flex-row items-end space-x-1.5 pr-2">
            <View className="w-1 bg-[#10b981]/20 h-4 rounded-full" />
            <View className="w-1 bg-[#10b981]/40 h-6 rounded-full" />
            <View className="w-1 bg-[#10b981]/60 h-8 rounded-full" />
            <View className="w-1 bg-[#10b981]/90 h-5 rounded-full" />
            <View className="w-1 bg-[#10b981] h-7 rounded-full" />
          </View>
        </View>
      )}

      {sourceText ? (
        <View className="flex-row items-center border-t border-[#1f372f]/45 pt-2.5 mt-2">
          <Ionicons name="document-text-outline" size={10} color="#34d399" />
          <Text className="text-emerald-400/60 text-[9px] font-serif font-bold italic ml-1">
            Source: {sourceText}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center border-t border-[#1f372f]/45 pt-2.5 mt-2">
          <Ionicons name="shield-checkmark" size={10} color="#10b981" />
          <Text className="text-emerald-500/50 text-[9px] font-mono uppercase tracking-widest ml-1">
            Grounded Ayurvedic Knowledge Base
          </Text>
        </View>
      )}
    </View>
  );
});

const WellnessTypingIndicator = React.memo(function WellnessTypingIndicator() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View className="flex-row justify-start mb-4">
      <View className="bg-[#111d19]/45 border border-[#1f372f]/60 p-4.5 rounded-3xl rounded-tl-none flex-row items-center">
        <Animated.View style={{ opacity: pulseAnim }}>
          <Ionicons name="leaf-outline" size={14} color="#34d399" />
        </Animated.View>
        <Text className="text-emerald-400 text-[10px] font-bold tracking-wider font-mono ml-2.5 uppercase">
          Physician formulating prescription...
        </Text>
      </View>
    </View>
  );
});
