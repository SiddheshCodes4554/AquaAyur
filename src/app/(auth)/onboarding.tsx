import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../services/supabase';

interface QuizQuestion {
  id: number;
  question: string;
  category: 'Physical' | 'Physiology' | 'Psychology';
  options: {
    text: string;
    dosha: 'vata' | 'pitta' | 'kapha';
  }[];
}

const DOSHA_QUIZ: QuizQuestion[] = [
  // 1. PHYSICAL STRUCTURE
  {
    id: 1,
    category: 'Physical',
    question: 'How would you describe your physical body frame structure?',
    options: [
      { text: 'Slender, tall or short, bony, struggles to gain weight', dosha: 'vata' },
      { text: 'Medium build, muscular, maintains weight easily', dosha: 'pitta' },
      { text: 'Large build, broad shoulders, gains weight easily, slow metabolism', dosha: 'kapha' }
    ]
  },
  {
    id: 2,
    category: 'Physical',
    question: 'How does your skin feel and look most of the time?',
    options: [
      { text: 'Dry, rough, cool to touch, thin, cracks easily in cold weather', dosha: 'vata' },
      { text: 'Warm, oily, reddish/flushed, prone to freckles or inflammation', dosha: 'pitta' },
      { text: 'Thick, soft, smooth, oily, pale, cool to touch', dosha: 'kapha' }
    ]
  },
  {
    id: 3,
    category: 'Physical',
    question: 'Describe your hair characteristics (thickness, texture, quality):',
    options: [
      { text: 'Dry, frizzy, thin, coarse, or brittle', dosha: 'vata' },
      { text: 'Fine, oily, early graying or thinning, reddish tones', dosha: 'pitta' },
      { text: 'Thick, oily, strong, wavy, dark, or highly lustrous', dosha: 'kapha' }
    ]
  },
  {
    id: 4,
    category: 'Physical',
    question: 'How do your physical joints behave (knees, elbows, knuckles)?',
    options: [
      { text: 'Prominent, thin, crack or pop easily, prone to stiffness', dosha: 'vata' },
      { text: 'Flexible, moderate sizing, normal joint structure', dosha: 'pitta' },
      { text: 'Padded, strong, large, stable, and well-lubricated', dosha: 'kapha' }
    ]
  },
  {
    id: 5,
    category: 'Physical',
    question: 'Describe your weight gain and weight loss patterns:',
    options: [
      { text: 'Hard to gain weight; loses weight rapidly when stressed', dosha: 'vata' },
      { text: 'Gains or loses weight easily; maintains target weight with minor effort', dosha: 'pitta' },
      { text: 'Gains weight very easily; struggles to lose weight even with dieting', dosha: 'kapha' }
    ]
  },
  // 2. PHYSIOLOGY & HABITS
  {
    id: 6,
    category: 'Physiology',
    question: 'What are your digestion and appetite patterns?',
    options: [
      { text: 'Irregular, variable hunger, prone to gas, bloating, and constipation', dosha: 'vata' },
      { text: 'Strong appetite, digests quickly, gets irritable/acidic when hungry', dosha: 'pitta' },
      { text: 'Slow digestion, moderate but steady hunger, feels heavy after eating', dosha: 'kapha' }
    ]
  },
  {
    id: 7,
    category: 'Physiology',
    question: 'How do you react to different climates and weather conditions?',
    options: [
      { text: 'Hates cold, dry, and windy climates; thrives in warmth', dosha: 'vata' },
      { text: 'Hates hot weather, direct sun, and humidity; loves cool weather', dosha: 'pitta' },
      { text: 'Hates damp, cold, and cloudy weather; thrives in dry warmth', dosha: 'kapha' }
    ]
  },
  {
    id: 8,
    category: 'Physiology',
    question: 'Describe your sleep quality and patterns:',
    options: [
      { text: 'Light, easily disrupted, wakes up frequently, needs 6 hours', dosha: 'vata' },
      { text: 'Moderate, sound sleep, wakes up feeling alert, needs 7-8 hours', dosha: 'pitta' },
      { text: 'Deep, long, hard to wake up, needs 8+ hours, prone to morning sluggishness', dosha: 'kapha' }
    ]
  },
  {
    id: 9,
    category: 'Physiology',
    question: 'How are your typical hydration needs and thirst levels?',
    options: [
      { text: 'Thirsty at irregular intervals, forgets to drink water easily', dosha: 'vata' },
      { text: 'Frequently thirsty, drinks large volumes of cold water', dosha: 'pitta' },
      { text: 'Rarely feels intense thirst, can go long hours without water comfortably', dosha: 'kapha' }
    ]
  },
  {
    id: 10,
    category: 'Physiology',
    question: 'What is your typical energy endurance and physical stamina level?',
    options: [
      { text: 'Short bursts of high energy, fatigues quickly, needs regular rest', dosha: 'vata' },
      { text: 'Medium stamina, highly focused, pushes self to exhaustion', dosha: 'pitta' },
      { text: 'High endurance and physical strength, slow starting but steady', dosha: 'kapha' }
    ]
  },
  // 3. PSYCHOLOGY & EMOTIONS
  {
    id: 11,
    category: 'Psychology',
    question: 'Which describes your memory style best?',
    options: [
      { text: 'Learns very quickly, forgets quickly; short-term focus', dosha: 'vata' },
      { text: 'Learns systematically, remembers logically with facts and context', dosha: 'pitta' },
      { text: 'Takes time to learn, remembers forever; excellent long-term memory', dosha: 'kapha' }
    ]
  },
  {
    id: 12,
    category: 'Psychology',
    question: 'How do you respond to stress or emotional challenges?',
    options: [
      { text: 'Prone to anxiety, worry, fear, and overthinking; easily unsettled', dosha: 'vata' },
      { text: 'Prone to impatience, anger, irritability, and competitiveness', dosha: 'pitta' },
      { text: 'Prone to calmness, patience, avoidance, attachment, or complacency', dosha: 'kapha' }
    ]
  },
  {
    id: 13,
    category: 'Psychology',
    question: 'How would you describe your speech and thinking pacing?',
    options: [
      { text: 'Fast talker, jumps between ideas, quick-witted but scattered', dosha: 'vata' },
      { text: 'Clear, precise, direct, logical, debating, or sharp-minded', dosha: 'pitta' },
      { text: 'Slow, deliberate, calm voice, excellent listener, speaks sparingly', dosha: 'kapha' }
    ]
  },
  {
    id: 14,
    category: 'Psychology',
    question: 'How do you typically make decisions?',
    options: [
      { text: 'Hesitant, changes mind frequently, doubts choices', dosha: 'vata' },
      { text: 'Decisive, logical, firm, takes action quickly', dosha: 'pitta' },
      { text: 'Slow, thoughtful, conservative, dislikes being rushed', dosha: 'kapha' }
    ]
  },
  {
    id: 15,
    category: 'Psychology',
    question: 'What is your daily habits and scheduling style?',
    options: [
      { text: 'Irregular routines, spontaneous, dislikes structured timetables', dosha: 'vata' },
      { text: 'Organized, planned, uses checklists, goal-driven and structured', dosha: 'pitta' },
      { text: 'Routine-bound, steady, predictable, resistant to sudden changes', dosha: 'kapha' }
    ]
  }
];

// Curated Dosha Recommendations
const DOSHA_DEFAULTS = {
  vata: {
    title: 'Vata Dominant (Air & Ether)',
    desc: 'You have a Vata-dominant constitution. Your biological forces are light, cold, dry, and mobile. Balanced Vata promotes creativity and vitality, while aggravated Vata leads to anxiety, dry skin, insomnia, and irregular digestion.',
    gunas: 'Dry, light, cold, rough, subtle, mobile.',
    nutrition: 'Prioritize warm, heavy, oily, and cooked foods with Sweet, Sour, and Salty tastes. Eat cooked grains, avocados, root vegetables, nuts, and ghee. Avoid dry raw salads, cold drinks, and beans.',
    lifestyle: 'Maintain a strict daily routine. Perform warm oil self-massages (Abhyanga), engage in grounding, slow-paced yoga, meditate, and keep warm.'
  },
  pitta: {
    title: 'Pitta Dominant (Fire & Water)',
    desc: 'You have a Pitta-dominant constitution. Your biological forces are hot, sharp, light, and spreading. Balanced Pitta promotes sharp intellect, digestion, and passion, while aggravated Pitta leads to anger, acid reflux, skin rashes, and inflammation.',
    gunas: 'Hot, sharp, light, oily, spreading.',
    nutrition: 'Prioritize cooling, sweet, bitter, and astringent tastes. Eat sweet fruits, leafy greens, coconut oil, cucumber, fennel, and mint. Avoid hot spices, alcohol, coffee, tomatoes, and red meat.',
    lifestyle: 'Avoid direct midday sun. Stay calm and practice moderation (do not over-work). Practice cooling sheetali pranayama, swim, or take walks in nature.'
  },
  kapha: {
    title: 'Kapha Dominant (Earth & Water)',
    desc: 'You have a Kapha-dominant constitution. Your biological forces are heavy, slow, cool, oily, and stable. Balanced Kapha promotes strength, endurance, patience, and compassion, while aggravated Kapha leads to weight gain, lethargy, congestion, and attachment.',
    gunas: 'Heavy, slow, cool, oily, smooth, stable.',
    nutrition: 'Prioritize warm, light, dry, and stimulating foods with Pungent, Bitter, and Astringent tastes. Eat leafy greens, sprouts, ginger, garlic, cayenne pepper, quinoa, and millet. Avoid sweets, dairy, and cold water.',
    lifestyle: 'Engage in active routines and vigorous physical exercises (running, active vinyasa yoga). Wake up early, dry-brush skin (Garshana), and avoid daytime naps.'
  },
  dual_vata_pitta: {
    title: 'Vata-Pitta Dominant',
    desc: 'Your constitution is dual, combining characteristics of both Vata (Air) and Pitta (Fire). You are likely energetic and sharp but prone to dry heat, irregular digestion, or anxiety.',
    gunas: 'Light, warm/cool fluctuations, sharp, mobile.',
    nutrition: 'Prioritize sweet and sweet-grounding tastes. Ground Vata with warm cooked foods, and cool Pitta by avoiding spicy, fermented items.',
    lifestyle: 'Balance intense mental focus with grounding routines. Practice moderate exercise, swim, and use gentle oils.'
  },
  dual_pitta_kapha: {
    title: 'Pitta-Kapha Dominant',
    desc: 'Your constitution combines Pitta (Fire) and Kapha (Earth/Water). You have strong physical endurance and digestion but can collect excess heat or congestion.',
    gunas: 'Hot, heavy, oily, stable.',
    nutrition: 'Prioritize bitter and astringent tastes. Keep foods light and cooling. Avoid heavy, sweet, oily foods and extremely hot spices.',
    lifestyle: 'Vigorous workouts (cool conditions) keep you active. Stay motivated and avoid sedentary patterns.'
  },
  dual_vata_kapha: {
    title: 'Vata-Kapha Dominant',
    desc: 'Your constitution combines Vata (Air) and Kapha (Earth/Water). You are generally cool to touch, with a sluggish metabolism and variable digestion.',
    gunas: 'Cold, light/heavy fluctuations, dry/oily fluctuations.',
    nutrition: 'Prioritize warm, cooked, dry spiced foods (ginger, black pepper) with pungent and bitter tastes. Avoid cold drinks and heavy dairy.',
    lifestyle: 'Keep warm. Engage in active, warming cardio and dynamic stretching to stimulate blood flow and dispel lethargy.'
  },
  tridoshic: {
    title: 'Tridoshic Balance (Equal Vata, Pitta, Kapha)',
    desc: 'You have a rare Tridoshic constitution, where all three doshas are equally represented. You enjoy strong immunity and physical stability.',
    gunas: 'Balanced equilibrium.',
    nutrition: 'Eat a balanced diet, altering food styles according to seasons (warm/oily in winter, cooling in summer, light/dry in spring).',
    lifestyle: 'Maintain steady, balanced habits. Stay in tune with seasonal shifts.'
  }
};

export default function OnboardingScreen() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [scores, setScores] = useState({ vata: 0, pitta: 0, kapha: 0 });
  
  // Scoring results state
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<{
    dominant: 'vata' | 'pitta' | 'kapha' | 'dual_vata_pitta' | 'dual_pitta_kapha' | 'dual_vata_kapha' | 'tridoshic';
    percentages: { vata: number; pitta: number; kapha: number };
  } | null>(null);

  const { updateProfile, user } = useAuthStore();

  const handleAnswerSelect = async (dosha: 'vata' | 'pitta' | 'kapha') => {
    const updatedScores = { ...scores, [dosha]: scores[dosha] + 1 };
    setScores(updatedScores);

    if (currentIdx < DOSHA_QUIZ.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // Calculate final dominant Dosha
      setSaving(true);
      try {
        const { vata, pitta, kapha } = updatedScores;
        const total = vata + pitta + kapha;
        
        const percentages = {
          vata: Number(((vata / total) * 100).toFixed(1)),
          pitta: Number(((pitta / total) * 100).toFixed(1)),
          kapha: Number(((kapha / total) * 100).toFixed(1))
        };

        let dominant: any = 'tridoshic';

        // Dual/Single classification rules (within 10% range is dual)
        const diffVP = Math.abs(percentages.vata - percentages.pitta);
        const diffVK = Math.abs(percentages.vata - percentages.kapha);
        const diffPK = Math.abs(percentages.pitta - percentages.kapha);

        if (diffVP <= 10 && diffVK <= 10 && diffPK <= 10) {
          dominant = 'tridoshic';
        } else if (diffVP <= 8 && percentages.vata > percentages.kapha) {
          dominant = 'dual_vata_pitta';
        } else if (diffPK <= 8 && percentages.pitta > percentages.vata) {
          dominant = 'dual_pitta_kapha';
        } else if (diffVK <= 8 && percentages.vata > percentages.pitta) {
          dominant = 'dual_vata_kapha';
        } else {
          // Single dominant
          if (vata > pitta && vata > kapha) dominant = 'vata';
          else if (pitta > vata && pitta > kapha) dominant = 'pitta';
          else dominant = 'kapha';
        }

        // 1. Get current user ID and attempt database insert
        try {
          const sessionUser = (await supabase.auth.getSession()).data.session?.user;
          if (sessionUser) {
            // 2. Insert attempt into public.dosha_assessments
            const { error: dbErr } = await supabase
              .from('dosha_assessments')
              .insert({
                user_id: sessionUser.id,
                vata_score: vata,
                pitta_score: pitta,
                kapha_score: kapha,
                vata_percentage: percentages.vata,
                pitta_percentage: percentages.pitta,
                kapha_percentage: percentages.kapha,
                result_dosha: dominant
              });

            if (dbErr) {
              console.warn('[Onboarding] Supabase db insert failed, continuing locally:', dbErr);
            }
          }
        } catch (dbErr) {
          console.warn('[Onboarding] Failed to save Dosha baseline to server, continuing locally:', dbErr);
        }

        setAssessmentResult({
          dominant,
          percentages
        });
        setShowResults(true);
      } catch (err) {
        console.error('[Onboarding] Failed to compute Dosha baseline:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleProceedToDashboard = async () => {
    if (!assessmentResult || !user?.id) return;
    setSaving(true);
    try {
      const dominant = assessmentResult.dominant;
      // 3. Save dominant Dosha to Supabase user profile table
      await updateProfile({
        dominant_dosha: dominant,
        daily_water_goal_ml: dominant.includes('pitta') ? 3000 : dominant.includes('vata') ? 2500 : 2000
      });
    } catch (e) {
      console.warn('[Onboarding] Profile update failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const activeQuestion = DOSHA_QUIZ[currentIdx];
  const progressPercent = Math.round(((currentIdx + 1) / DOSHA_QUIZ.length) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#022c22' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-6 py-6">
        
        {/* Onboarding Questionnaire */}
        {!showResults && (
          <View className="flex-1 justify-center py-6">
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-3xl">
              
              {/* Category & Progress header */}
              <View className="mb-6">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-emerald-400 font-bold uppercase text-xs tracking-widest">
                    {activeQuestion.category} Assessment
                  </Text>
                  <Text className="text-emerald-300 text-xs">
                    {currentIdx + 1} / {DOSHA_QUIZ.length}
                  </Text>
                </View>
                <View className="h-1.5 w-full bg-emerald-950 rounded-full overflow-hidden">
                  <View 
                    style={{ width: `${progressPercent}%` }} 
                    className="h-full bg-emerald-400"
                  />
                </View>
              </View>

              {saving ? (
                <View className="py-20 items-center">
                  <ActivityIndicator size="large" color="#34d399" />
                  <Text className="text-white text-lg font-bold mt-4">Compiling Profile...</Text>
                  <Text className="text-emerald-400 text-sm mt-2 text-center">
                    Analyzing responses and generating recommendations.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text className="text-white text-xl font-bold mb-6 leading-relaxed">
                    {activeQuestion.question}
                  </Text>

                  <View className="space-y-4">
                    {activeQuestion.options.map((option, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => handleAnswerSelect(option.dosha)}
                        className="bg-emerald-950/80 border border-emerald-800/40 rounded-2xl p-5 active:bg-emerald-800/30"
                      >
                        <Text className="text-emerald-50 text-base leading-relaxed">
                          {option.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Results & Action Recommendations Screen */}
        {showResults && assessmentResult && (
          <View className="space-y-6 py-6">
            
            {/* Main Result Card */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-3xl items-center">
              <Ionicons name="ribbon" size={48} color="#34d399" className="mb-4" />
              <Text className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">Your Ayurvedic Prakriti</Text>
              <Text className="text-white text-2xl font-black text-center capitalize mb-4">
                {DOSHA_DEFAULTS[assessmentResult.dominant].title}
              </Text>
              <Text className="text-emerald-100/80 text-sm text-center leading-relaxed">
                {DOSHA_DEFAULTS[assessmentResult.dominant].desc}
              </Text>
            </View>

            {/* Constitution Percentage bars */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-3xl">
              <Text className="text-emerald-300 font-bold text-sm mb-4">Dosha Balance Chart</Text>
              
              <View className="space-y-4">
                {/* Vata */}
                <View>
                  <View className="flex-row justify-between text-xs mb-1">
                    <Text className="text-amber-400 font-bold">Vata (Air/Ether)</Text>
                    <Text className="text-white font-bold">{assessmentResult.percentages.vata}%</Text>
                  </View>
                  <View className="h-2 w-full bg-emerald-950 rounded-full overflow-hidden">
                    <View style={{ width: `${assessmentResult.percentages.vata}%` }} className="h-full bg-amber-400" />
                  </View>
                </View>

                {/* Pitta */}
                <View>
                  <View className="flex-row justify-between text-xs mb-1">
                    <Text className="text-sky-400 font-bold">Pitta (Fire/Water)</Text>
                    <Text className="text-white font-bold">{assessmentResult.percentages.pitta}%</Text>
                  </View>
                  <View className="h-2 w-full bg-emerald-950 rounded-full overflow-hidden">
                    <View style={{ width: `${assessmentResult.percentages.pitta}%` }} className="h-full bg-sky-400" />
                  </View>
                </View>

                {/* Kapha */}
                <View>
                  <View className="flex-row justify-between text-xs mb-1">
                    <Text className="text-emerald-400 font-bold">Kapha (Earth/Water)</Text>
                    <Text className="text-white font-bold">{assessmentResult.percentages.kapha}%</Text>
                  </View>
                  <View className="h-2 w-full bg-emerald-950 rounded-full overflow-hidden">
                    <View style={{ width: `${assessmentResult.percentages.kapha}%` }} className="h-full bg-emerald-400" />
                  </View>
                </View>
              </View>
            </View>

            {/* Ayurvedic Recommendations Panel */}
            <View className="bg-emerald-900/30 border border-emerald-800/30 p-6 rounded-3xl space-y-4">
              <View className="flex-row items-center border-b border-emerald-800/15 pb-3">
                <Ionicons name="color-palette-outline" size={20} color="#34d399" />
                <Text className="text-white font-bold text-base ml-2">Balancing Recommendations</Text>
              </View>

              <View>
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Elemental Qualities (Gunas)</Text>
                <Text className="text-emerald-100/90 text-sm italic">{DOSHA_DEFAULTS[assessmentResult.dominant].gunas}</Text>
              </View>

              <View>
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Diet & Nutrition Guidelines</Text>
                <Text className="text-emerald-100/90 text-sm leading-relaxed">{DOSHA_DEFAULTS[assessmentResult.dominant].nutrition}</Text>
              </View>

              <View>
                <Text className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Lifestyle & Physical Exercise</Text>
                <Text className="text-emerald-100/90 text-sm leading-relaxed">{DOSHA_DEFAULTS[assessmentResult.dominant].lifestyle}</Text>
              </View>
            </View>

            {/* Action buttons */}
            {saving ? (
              <ActivityIndicator size="small" color="#34d399" className="py-4" />
            ) : (
              <TouchableOpacity
                onPress={handleProceedToDashboard}
                className="bg-emerald-500 rounded-2xl py-4 items-center shadow-lg active:bg-emerald-600 mb-6"
              >
                <Text className="text-emerald-950 text-base font-extrabold">Complete & Proceed to App</Text>
              </TouchableOpacity>
            )}

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
