import React, { useEffect, useState, useRef } from 'react';
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
  const { user, profile } = useAuthStore();
  
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
        setChatMessages(data.map(d => ({ sender: d.sender as any, message_text: d.message_text || '' })));
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
    <SafeAreaView className="flex-1 bg-[#F8F6F0]" edges={['top']}>
      <LinearGradient
        colors={['#F8F6F0', '#F2EFE8']}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-3 border-b border-[#E4E1D8] flex-row justify-between items-center bg-white">
          <View>
            <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest font-mono">AQUAGURU PHYSICIAN</Text>
            <Text className="text-[#2E3A2F] text-lg font-serif font-black mt-0.5">Ayurvedic Consultations</Text>
          </View>
          <View className="w-8 h-8 rounded-full bg-[#F5F2EA] border border-[#E4E1D8] items-center justify-center">
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#607C64" />
          </View>
        </View>

        {/* Subtab Segment Control */}
        <View className="flex-row p-1.5 bg-white border-b border-[#E4E1D8]">
          <TouchableOpacity
            onPress={() => setSubTab('assessment')}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${subTab === 'assessment' ? 'bg-[#7D9C83]' : 'opacity-60'}`}
          >
            <Text className={`text-xs font-serif font-black ${subTab === 'assessment' ? 'text-white' : 'text-[#607C64]'}`}>Physician Assessment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSubTab('chat')}
            className={`flex-1 py-2.5 rounded-xl items-center justify-center ${subTab === 'chat' ? 'bg-[#7D9C83]' : 'opacity-60'}`}
          >
            <Text className={`text-xs font-serif font-black ${subTab === 'chat' ? 'text-white' : 'text-[#607C64]'}`}>AquaGuru Chat</Text>
          </TouchableOpacity>
        </View>

        {subTab === 'assessment' ? (
          <>
            {/* Dynamic Consult Phase Tab Selectors */}
            <View className="px-4 py-3 bg-[#F5F2EA]/45 border-b border-[#E4E1D8]">
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
                          ? 'bg-[#7D9C83] border-[#607C64]' 
                          : 'bg-white border-[#E4E1D8]'
                      }`}
                    >
                      <Text className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-[#607C64]'}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View className="flex-1 py-20 items-center justify-center">
                  <ActivityIndicator size="large" color="#607C64" />
                  <Text className="text-[#607C64] text-xs font-medium mt-4 font-mono">Compiling physician's assessment...</Text>
                </View>
              ) : consultation ? (
                <View className="space-y-5">
                  
                  {/* Prescription Sheet Card */}
                  <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl relative overflow-hidden shadow-sm">
                    {/* Header */}
                    <View className="border-b border-[#E4E1D8] pb-3.5 mb-4 flex-row justify-between items-start">
                      <View>
                        <Text className="text-[#2E3A2F] text-base font-extrabold font-serif">{getPhaseTitle(consultation.phase)}</Text>
                        <Text className="text-slate-400 text-[10px] mt-0.5 font-mono">B.A.M.S. Certified Advisor</Text>
                      </View>
                      <View className="bg-[#F5F2EA] border border-[#E4E1D8] px-2.5 py-0.5 rounded-full">
                        <Text className="text-[#607C64] text-[8px] font-mono uppercase">State: {consultation.dominantDoshaLabel}</Text>
                      </View>
                    </View>

                    {/* Assessment text */}
                    <View className="mb-5">
                      <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest mb-1.5 font-mono">Physician's Assessment</Text>
                      <Text className="text-[#2E3A2F] text-xs italic leading-relaxed pl-3.5 border-l-2 border-[#7D9C83] font-serif">
                        "{consultation.assessment}"
                      </Text>
                    </View>

                    {/* Prescriptions Grid */}
                    <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-widest mb-3 font-mono">Therapeutic Prescriptions</Text>
                    <View className="space-y-3">
                      {consultation.prescriptions.map((pres, idx) => (
                        <View key={idx} className="bg-[#F8F6F0] border border-[#E4E1D8] p-4 rounded-2xl">
                          <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-[#2E3A2F] text-xs font-bold font-serif">{pres.instruction}</Text>
                            <View className="bg-[#E4E1D8]/60 border border-[#E4E1D8] px-2 py-0.5 rounded">
                              <Text className="text-[#607C64] text-[8px] font-bold uppercase">{pres.category}</Text>
                            </View>
                          </View>
                          <Text className="text-slate-500 text-[10px] leading-relaxed">
                            Rationale: {pres.rationale}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Diagnostic Indexes used */}
                    <View className="mt-5 pt-4 border-t border-[#E4E1D8] flex-row justify-between items-center">
                      <View>
                        <Text className="text-slate-400 text-[8px] font-mono uppercase">Digestion Index: {consultation.agniClassification}</Text>
                        <Text className="text-slate-400 text-[8px] font-mono uppercase mt-0.5">Immunity Index: {consultation.ojasClassification}</Text>
                      </View>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#607C64" />
                    </View>
                  </View>

                  {/* Clinical Evidence badges */}
                  <View className="bg-white border border-[#E4E1D8] p-5 rounded-3xl shadow-sm">
                    <Text className="text-[#607C64] text-[9px] uppercase font-bold tracking-wider mb-3 font-mono">Referenced Biometrics</Text>
                    <View className="flex-row flex-wrap">
                      {consultation.vitalMetricsUsed.map((metric, idx) => (
                        <View key={idx} className="bg-[#F8F6F0] border border-[#E4E1D8] px-3 py-2 rounded-xl mr-2 mb-2 flex-row items-center">
                          <View className="w-1.5 h-1.5 rounded-full bg-[#607C64] mr-2" />
                          <Text className="text-[#607C64] text-[10px] font-medium mr-1.5">{metric.label}:</Text>
                          <Text className="text-[#2E3A2F] text-[10px] font-bold font-mono">{metric.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Ask Follow Up Button */}
                  <TouchableOpacity
                    onPress={() => setSubTab('chat')}
                    className="bg-[#607C64] py-4 rounded-2xl flex-row justify-center items-center active:bg-[#7D9C83] shadow-sm mb-6"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text className="text-white font-black text-xs uppercase tracking-wider">Ask Follow-up Question</Text>
                  </TouchableOpacity>

                </View>
              ) : (
                <View className="py-20 items-center justify-center">
                  <Text className="text-slate-400 text-xs italic font-serif">No consultation records available today.</Text>
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
              contentContainerStyle={{ paddingBottom: 110 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <View 
                    key={idx} 
                    className={`mb-4 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <View 
                      className={`max-w-[85%] p-4 rounded-2xl border ${
                        isUser 
                          ? 'bg-[#7D9C83] border-[#607C64] rounded-tr-none' 
                          : 'bg-white border-[#E4E1D8] rounded-tl-none'
                      }`}
                    >
                      {isUser ? (
                        <Text className="text-white font-bold text-xs leading-relaxed font-sans">
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
              <View className="px-4 py-2 border-t border-[#E4E1D8] bg-white">
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
                      className="bg-[#F8F6F0] border border-[#E4E1D8] px-3.5 py-1.5 rounded-full mr-2 active:bg-[#E4E1D8]"
                    >
                      <Text className="text-[#607C64] text-[9px] font-bold font-mono">{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input section */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              className="border-t border-[#E4E1D8] bg-[#F2EFE8] p-4 flex-row items-center"
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask for adjustments, herbs, guidelines..."
                placeholderTextColor="#8C958E"
                style={{ flex: 1, marginRight: 8 }}
                className="h-12 bg-white border border-[#E4E1D8] rounded-xl px-4 text-[#2E3A2F] text-xs font-sans"
              />
              
              {/* Voice Intake Toggle button */}
              <TouchableOpacity
                onPress={handleTriggerVoiceSpeech}
                className="w-12 h-12 rounded-xl bg-white border border-[#E4E1D8] justify-center items-center active:bg-slate-100 mr-2"
              >
                <Ionicons name="mic-outline" size={20} color="#607C64" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={thinking || !inputText.trim()}
                className="w-12 h-12 rounded-xl bg-[#607C64] justify-center items-center active:bg-[#7D9C83] disabled:bg-white disabled:border disabled:border-[#E4E1D8]"
              >
                <Ionicons name="send" size={16} color={inputText.trim() ? '#FFFFFF' : '#8C958E'} />
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
          <View className="flex-1 bg-black/60 items-center justify-center">
            <View className="w-72 bg-white border border-[#E4E1D8] p-8 rounded-3xl items-center shadow-2xl">
              <Text className="text-[#607C64] text-[10px] uppercase font-bold tracking-widest font-mono mb-2">Voice Consultation</Text>
              <Text className="text-[#2E3A2F] text-base font-serif font-bold text-center px-4 leading-normal mb-8">
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
                  className="w-20 h-20 rounded-full bg-[#607C64]/20 border border-[#607C64]/40"
                />
                <TouchableOpacity
                  onPress={toggleVoiceModeOff}
                  className="w-16 h-16 rounded-full bg-[#607C64] justify-center items-center active:bg-[#7D9C83] shadow"
                >
                  <Ionicons name="mic" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text className="text-slate-400 text-[9px] text-center font-mono uppercase tracking-widest">Listening... Tap Mic to Stop</Text>
              
              <TouchableOpacity
                onPress={() => setVoiceModeActive(false)}
                className="mt-6 border border-red-500/20 bg-red-500/5 px-6 py-2.5 rounded-full active:bg-red-500/10"
              >
                <Text className="text-red-500 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </SafeAreaView>
  );
}

const DoctorMessageContent = React.memo(function DoctorMessageContent({ text = '' }: { text?: string }) {
  const safeText = text || '';
  const sourceMatches = safeText.match(/Source:\s*([^\n\r]+)/i);
  let mainText = safeText;
  let sourceText = "";
  if (sourceMatches) {
    mainText = safeText.replace(sourceMatches[0], '').trim();
    sourceText = sourceMatches[1];
  }

  const bpmMatches = safeText.match(/(\d+)\s*bpm/i);
  const tempMatches = safeText.match(/(\d+(?:\.\d+)?)\s*°?C/i);

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
                <View key={idx} className="bg-[#F8F6F0] border border-[#E4E1D8] p-3 rounded-2xl my-1 flex-row items-start">
                  <View className="w-1.5 h-1.5 rounded-full bg-[#607C64] mt-1.5 mr-2.5" />
                  <View className="flex-1">
                    <Text className="text-[#2E3A2F] text-xs font-bold font-serif">{boldMatch[1]}</Text>
                    <Text className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">{boldMatch[2]}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={idx} className="bg-[#F8F6F0] border border-[#E4E1D8] p-2.5 rounded-xl my-0.5 flex-row items-center">
                <Ionicons name="sparkles" size={10} color="#607C64" style={{ marginRight: 8 }} />
                <Text className="text-slate-655 text-xs flex-1 leading-relaxed">{content}</Text>
              </View>
            );
          }

          if (trimmed.startsWith('###')) {
            return (
              <Text key={idx} className="text-[#2E3A2F] text-sm font-serif font-black mt-2.5 mb-1">
                {trimmed.replace(/###/g, '').trim()}
              </Text>
            );
          }

          return (
            <Text key={idx} className="text-[#2E3A2F] text-xs leading-relaxed mb-1.5 font-sans">
              {trimmed}
            </Text>
          );
        })}
      </View>

      {(bpmMatches || tempMatches) && (
        <View className="bg-[#F8F6F0] border border-[#E4E1D8] p-4.5 rounded-2xl flex-row justify-between items-center my-2">
          <View>
            <Text className="text-[#607C64] text-[8px] uppercase font-bold tracking-widest font-mono">Biometric References</Text>
            {bpmMatches && (
              <Text className="text-[#2E3A2F] text-xs font-bold font-mono mt-1">Heart Rate: {bpmMatches[1]} BPM</Text>
            )}
            {tempMatches && (
              <Text className="text-[#2E3A2F] text-xs font-bold font-mono mt-0.5">Skin Temp: {tempMatches[1]} °C</Text>
            )}
          </View>
          <View className="flex-row items-end space-x-1.5 pr-2">
            <View className="w-1 bg-[#607C64]/20 h-4 rounded-full" />
            <View className="w-1 bg-[#607C64]/40 h-6 rounded-full" />
            <View className="w-1 bg-[#607C64]/60 h-8 rounded-full" />
            <View className="w-1 bg-[#607C64]/80 h-5 rounded-full" />
            <View className="w-1 bg-[#607C64] h-7 rounded-full" />
          </View>
        </View>
      )}

      {sourceText ? (
        <View className="flex-row items-center border-t border-[#E4E1D8] pt-2.5 mt-2">
          <Ionicons name="document-text-outline" size={10} color="#607C64" />
          <Text className="text-[#607C64]/60 text-[9px] font-serif font-bold italic ml-1">
            Source: {sourceText}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center border-t border-[#E4E1D8] pt-2.5 mt-2">
          <Ionicons name="shield-checkmark" size={10} color="#607C64" />
          <Text className="text-[#607C64]/50 text-[9px] font-mono uppercase tracking-widest ml-1">
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
      <View className="bg-white border border-[#E4E1D8] p-4 rounded-3xl rounded-tl-none flex-row items-center shadow-sm">
        <Animated.View style={{ opacity: pulseAnim }}>
          <Ionicons name="leaf-outline" size={14} color="#607C64" />
        </Animated.View>
        <Text className="text-[#607C64] text-[10px] font-bold tracking-wider font-mono ml-2.5 uppercase">
          Guru formulating response...
        </Text>
      </View>
    </View>
  );
});
