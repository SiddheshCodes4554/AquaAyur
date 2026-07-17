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
  Easing,
  StyleSheet
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <LinearGradient
        colors={['#F8F6F0', '#F2EFE8']}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>AQUAGURU PHYSICIAN</Text>
            <Text style={styles.headerTitle}>Ayurvedic Consultations</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#607C64" />
          </View>
        </View>

        {/* Subtab Segment Control */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            onPress={() => setSubTab('assessment')}
            style={[styles.tabButton, subTab === 'assessment' ? styles.tabButtonActive : styles.tabButtonInactive]}
          >
            <Text style={[styles.tabText, subTab === 'assessment' ? styles.tabTextActive : styles.tabTextInactive]}>
              Physician Assessment
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSubTab('chat')}
            style={[styles.tabButton, subTab === 'chat' ? styles.tabButtonActive : styles.tabButtonInactive]}
          >
            <Text style={[styles.tabText, subTab === 'chat' ? styles.tabTextActive : styles.tabTextInactive]}>
              AquaGuru Chat
            </Text>
          </TouchableOpacity>
        </View>

        {subTab === 'assessment' ? (
          <View style={{ flex: 1 }}>
            {/* Dynamic Consult Phase Tab Selectors */}
            <View style={styles.phaseSelectorContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 10 }} className="flex-row">
                {(['morning', 'afternoon', 'evening', 'weekly', 'monthly'] as ConsultationPhase[]).map((phase) => {
                  const isSelected = activePhase === phase;
                  const label = phase === 'morning' ? 'Morning' : phase === 'afternoon' ? 'Midday' : phase === 'evening' ? 'Evening' : phase === 'weekly' ? 'Weekly' : 'Monthly';
                  return (
                    <TouchableOpacity
                      key={phase}
                      onPress={() => setActivePhase(phase)}
                      style={[styles.phaseButton, isSelected ? styles.phaseButtonActive : styles.phaseButtonInactive]}
                    >
                      <Text style={[styles.phaseButtonText, isSelected ? styles.phaseButtonTextActive : styles.phaseButtonTextInactive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#607C64" />
                  <Text style={styles.loadingText}>Compiling physician's assessment...</Text>
                </View>
              ) : consultation ? (
                <View style={{ gap: 16 }}>
                  
                  {/* Prescription Sheet Card */}
                  <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.cardTitle}>{getPhaseTitle(consultation.phase)}</Text>
                        <Text style={styles.cardSubtitle}>B.A.M.S. Certified Advisor</Text>
                      </View>
                      <View style={styles.pill}>
                        <Text style={styles.pillText}>State: {consultation.dominantDoshaLabel}</Text>
                      </View>
                    </View>

                    {/* Assessment text */}
                    <View style={{ marginBottom: 20 }}>
                      <Text style={styles.cardSectionLabel}>Physician's Assessment</Text>
                      <Text style={styles.assessmentQuote}>
                        "{consultation.assessment}"
                      </Text>
                    </View>

                    {/* Prescriptions Grid */}
                    <Text style={styles.cardSectionLabel}>Therapeutic Prescriptions</Text>
                    <View style={{ gap: 12 }}>
                      {consultation.prescriptions.map((pres, idx) => (
                        <View key={idx} style={styles.prescriptionItem}>
                          <View style={styles.prescriptionHeader}>
                            <Text style={styles.prescriptionInstruction}>{pres.instruction}</Text>
                            <View style={styles.prescriptionCategory}>
                              <Text style={styles.prescriptionCategoryText}>{pres.category}</Text>
                            </View>
                          </View>
                          <Text style={styles.prescriptionRationale}>
                            Rationale: {pres.rationale}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Diagnostic Indexes used */}
                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.footerMetric}>Digestion Index: {consultation.agniClassification}</Text>
                        <Text style={styles.footerMetric}>Immunity Index: {consultation.ojasClassification}</Text>
                      </View>
                      <Ionicons name="shield-checkmark-outline" size={16} color="#607C64" />
                    </View>
                  </View>

                  {/* Clinical Evidence badges */}
                  <View style={styles.card}>
                    <Text style={styles.cardSectionLabel}>Referenced Biometrics</Text>
                    <View style={styles.badgeContainer}>
                      {consultation.vitalMetricsUsed.map((metric, idx) => (
                        <View key={idx} style={styles.badge}>
                          <View style={styles.badgeDot} />
                          <Text style={styles.badgeLabel}>{metric.label}:</Text>
                          <Text style={styles.badgeValue}>{metric.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Ask Follow Up Button */}
                  <TouchableOpacity
                    onPress={() => setSubTab('chat')}
                    style={styles.ctaButton}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.ctaButtonText}>Ask Follow-up Question</Text>
                  </TouchableOpacity>

                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <Text style={styles.emptyText}>No consultation records available today.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Chat messages */}
            <ScrollView 
              ref={scrollViewRef}
              style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((msg, idx) => {
                const isUser = msg.sender === 'user';
                return (
                  <View 
                    key={idx} 
                    style={[styles.messageRow, isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}
                  >
                    <View 
                      style={[
                        styles.messageBubble, 
                        isUser ? styles.userBubble : styles.doctorBubble
                      ]}
                    >
                      {isUser ? (
                        <Text style={styles.userMessageText}>
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
              <View style={styles.chipsContainer}>
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
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{sug}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input section */}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
              style={styles.inputContainer}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask for adjustments, herbs, guidelines..."
                placeholderTextColor="#8C958E"
                style={styles.textInput}
              />
              
              {/* Voice Intake Toggle button */}
              <TouchableOpacity
                onPress={handleTriggerVoiceSpeech}
                style={styles.iconButton}
              >
                <Ionicons name="mic-outline" size={20} color="#607C64" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={thinking || !inputText.trim()}
                style={[styles.sendButton, (!inputText.trim() || thinking) ? styles.sendButtonDisabled : null]}
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
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>Voice Consultation</Text>
              <Text style={styles.modalTitle}>
                Speak your symptoms or wellness questions...
              </Text>

              {/* Pulsing Mic Ring */}
              <View style={styles.micContainer}>
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
                  style={styles.micCircle}
                >
                  <Ionicons name="mic" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalFooterText}>Listening... Tap Mic to Stop</Text>
              
              <TouchableOpacity
                onPress={() => setVoiceModeActive(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
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
    <View style={{ gap: 10 }}>
      <View>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;
          
          if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
            const content = trimmed.substring(1).trim();
            const boldMatch = content.match(/^\*\*([^*]+)\*\*:\s*(.*)/);
            if (boldMatch) {
              return (
                <View key={idx} style={styles.richBulletItem}>
                  <View style={styles.bulletDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bulletTitle}>{boldMatch[1]}</Text>
                    <Text style={styles.bulletDesc}>{boldMatch[2]}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View key={idx} style={styles.simpleBulletItem}>
                <Ionicons name="sparkles" size={10} color="#607C64" style={{ marginRight: 8 }} />
                <Text style={styles.simpleBulletText}>{content}</Text>
              </View>
            );
          }

          if (trimmed.startsWith('###')) {
            return (
              <Text key={idx} style={styles.sectionHeader}>
                {trimmed.replace(/###/g, '').trim()}
              </Text>
            );
          }

          return (
            <Text key={idx} style={styles.normalText}>
              {trimmed}
            </Text>
          );
        })}
      </View>

      {(bpmMatches || tempMatches) && (
        <View style={styles.biometricReferenceCard}>
          <View>
            <Text style={styles.biometricHeader}>Biometric References</Text>
            {bpmMatches && (
              <Text style={styles.biometricValue}>Heart Rate: {bpmMatches[1]} BPM</Text>
            )}
            {tempMatches && (
              <Text style={styles.biometricValue}>Skin Temp: {tempMatches[1]} °C</Text>
            )}
          </View>
          <View style={styles.biometricVisualizer}>
            <View style={[styles.visualBar, { height: 16, opacity: 0.3 }]} />
            <View style={[styles.visualBar, { height: 24, opacity: 0.5 }]} />
            <View style={[styles.visualBar, { height: 32, opacity: 0.7 }]} />
            <View style={[styles.visualBar, { height: 20, opacity: 0.9 }]} />
            <View style={[styles.visualBar, { height: 28 }]} />
          </View>
        </View>
      )}

      {sourceText ? (
        <View style={styles.footerSourceContainer}>
          <Ionicons name="document-text-outline" size={10} color="#607C64" />
          <Text style={styles.footerSourceText}>
            Source: {sourceText}
          </Text>
        </View>
      ) : (
        <View style={styles.footerSourceContainer}>
          <Ionicons name="shield-checkmark" size={10} color="#607C64" />
          <Text style={styles.footerVerifyText}>
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
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16 }}>
      <View style={styles.typingBubble}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <Ionicons name="leaf-outline" size={14} color="#607C64" />
        </Animated.View>
        <Text style={styles.typingText}>
          Guru formulating response...
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F6F0'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E4E1D8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  headerSubtitle: {
    color: '#607C64',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  headerTitle: {
    color: '#2E3A2F',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginTop: 2
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F2EA',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E4E1D8'
  },
  tabButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  tabButtonActive: {
    backgroundColor: '#7D9C83'
  },
  tabButtonInactive: {
    opacity: 0.6
  },
  tabText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '900'
  },
  tabTextActive: {
    color: '#FFFFFF'
  },
  tabTextInactive: {
    color: '#607C64'
  },
  phaseSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FBF9F4',
    borderBottomWidth: 1,
    borderColor: '#E4E1D8'
  },
  phaseButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1
  },
  phaseButtonActive: {
    backgroundColor: '#7D9C83',
    borderColor: '#607C64'
  },
  phaseButtonInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1D8'
  },
  phaseButtonText: {
    fontSize: 10,
    fontWeight: '700'
  },
  phaseButtonTextActive: {
    color: '#FFFFFF'
  },
  phaseButtonTextInactive: {
    color: '#607C64'
  },
  loadingContainer: {
    flex: 1,
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#607C64',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 16
  },
  emptyText: {
    color: '#8C958E',
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center'
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 20,
    borderRadius: 24,
    shadowColor: '#E4E1D8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderColor: '#E4E1D8',
    paddingBottom: 14,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  cardTitle: {
    color: '#2E3A2F',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  cardSubtitle: {
    color: '#8C958E',
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  pill: {
    backgroundColor: '#F5F2EA',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 99
  },
  pillText: {
    color: '#607C64',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700'
  },
  cardSectionLabel: {
    color: '#607C64',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  assessmentQuote: {
    color: '#2E3A2F',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
    paddingLeft: 14,
    borderLeftWidth: 2,
    borderColor: '#7D9C83',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  prescriptionItem: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 14,
    borderRadius: 16
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  prescriptionInstruction: {
    color: '#2E3A2F',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    flex: 1,
    marginRight: 8
  },
  prescriptionCategory: {
    backgroundColor: '#E4E1D8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  prescriptionCategoryText: {
    color: '#607C64',
    fontSize: 8,
    fontWeight: '700'
  },
  prescriptionRationale: {
    color: '#8C958E',
    fontSize: 10,
    lineHeight: 14
  },
  cardFooter: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#E4E1D8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerMetric: {
    color: '#8C958E',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  badge: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#607C64',
    marginRight: 8
  },
  badgeLabel: {
    color: '#607C64',
    fontSize: 10,
    fontWeight: '500',
    marginRight: 6
  },
  badgeValue: {
    color: '#2E3A2F',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  ctaButton: {
    backgroundColor: '#607C64',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#607C64',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 100
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1
  },
  userBubble: {
    backgroundColor: '#7D9C83',
    borderColor: '#607C64',
    borderTopRightRadius: 0
  },
  doctorBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E4E1D8',
    borderTopLeftRadius: 0
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    lineHeight: 18
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#E4E1D8',
    backgroundColor: '#FFFFFF'
  },
  chip: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
    marginRight: 8
  },
  chipText: {
    color: '#607C64',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  inputContainer: {
    borderTopWidth: 1,
    borderColor: '#E4E1D8',
    backgroundColor: '#F2EFE8',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 96 : 88
  },
  textInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    borderRadius: 12,
    paddingHorizontal: 16,
    color: '#2E3A2F',
    fontSize: 12,
    marginRight: 8
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#607C64',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalContent: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5
  },
  modalSubtitle: {
    color: '#607C64',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8
  },
  modalTitle: {
    color: '#2E3A2F',
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  micContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative'
  },
  micCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#607C64',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2
  },
  modalFooterText: {
    color: '#8C958E',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.2,
    textAlign: 'center'
  },
  cancelBtn: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E4E1D8',
    backgroundColor: '#F8F6F0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 99
  },
  cancelBtnText: {
    color: '#607C64',
    fontWeight: '700',
    fontSize: 10
  },
  richBulletItem: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 10,
    borderRadius: 14,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#607C64',
    marginTop: 5,
    marginRight: 8
  },
  bulletTitle: {
    color: '#2E3A2F',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  bulletDesc: {
    color: '#8C958E',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14
  },
  simpleBulletItem: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 8,
    borderRadius: 10,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center'
  },
  simpleBulletText: {
    color: '#8C958E',
    fontSize: 10,
    flex: 1,
    lineHeight: 14
  },
  sectionHeader: {
    color: '#2E3A2F',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '900',
    marginTop: 10,
    marginBottom: 4
  },
  normalText: {
    color: '#2E3A2F',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  biometricReferenceCard: {
    backgroundColor: '#F8F6F0',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6
  },
  biometricHeader: {
    color: '#607C64',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  biometricValue: {
    color: '#2E3A2F',
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2
  },
  biometricVisualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingRight: 6
  },
  visualBar: {
    width: 3,
    backgroundColor: '#607C64',
    borderRadius: 2
  },
  footerSourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#E4E1D8',
    paddingTop: 8,
    marginTop: 8
  },
  footerSourceText: {
    color: '#607C64',
    fontSize: 8,
    fontStyle: 'italic',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginLeft: 4
  },
  footerVerifyText: {
    color: '#607C64',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '500',
    letterSpacing: 1,
    marginLeft: 4
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E1D8',
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#E4E1D8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1
  },
  typingText: {
    color: '#607C64',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginLeft: 8,
    textTransform: 'uppercase'
  }
});
