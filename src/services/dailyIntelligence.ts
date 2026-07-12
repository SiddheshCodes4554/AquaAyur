import { supabase } from './supabase';
import { evaluateAyurRules, buildGroundedAIPrompt } from './ayurRuleEngine';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

export interface DailyBriefingSnapshot {
  summary: string;
  risks: string;
  opportunities: string;
  mission: string;
  recommendations: string[];
  expectedRecovery: string;
  expectedDosha: { vata: number; pitta: number; kapha: number };
  expectedAgni: number;
  expectedOjas: number;
}

/**
 * Generates and saves a Daily Intelligence Briefing for a user.
 */
export async function generateDailyBriefing(userId: string): Promise<{ id: string; title: string; content_markdown: string; metadata: DailyBriefingSnapshot }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const startStr = `${todayStr}T00:00:00.000Z`;
    const endStr = `${todayStr}T23:59:59.999Z`;

    // 1. Fetch User Profile constitution
    const { data: profile } = await supabase
      .from('profiles')
      .select('dominant_dosha, first_name, full_name')
      .eq('id', userId)
      .single();

    const userName = profile?.first_name || profile?.full_name?.split(' ')[0] || 'Yogi';
    const dosha = profile?.dominant_dosha || 'tridoshic';

    // 2. Fetch parallel logs for today to feed context
    const [hrRes, tempRes, actRes, sleepRes, waterRes, lifeRes, doshaRes, agniRes, ojasRes] = await Promise.all([
      supabase.from('heart_rate_logs').select('bpm').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('temperature_logs').select('temperature_celsius').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('activity_logs').select('steps_count').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startStr).lte('start_time', endStr),
      supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', startStr).lte('timestamp', endStr),
      supabase.from('lifestyle').select('stress_level').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_dosha_states').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_agni_scores').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_ojas_scores').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle()
    ]);

    const hrLogs = hrRes.data || [];
    const tempLogs = tempRes.data || [];
    const actLogs = actRes.data || [];
    const sleepLogs = sleepRes.data || [];
    const waterLogs = waterRes.data || [];
    const stress = lifeRes.data?.stress_level || 'medium';

    const avgHr = hrLogs.length > 0 ? Math.round(hrLogs.reduce((s, v) => s + v.bpm, 0) / hrLogs.length) : 70;
    const avgTemp = tempLogs.length > 0 ? Number((tempLogs.reduce((s, v) => s + Number(v.temperature_celsius), 0) / tempLogs.length).toFixed(1)) : 36.5;
    const totalSteps = actLogs.reduce((s, v) => s + v.steps_count, 0);
    const totalSleep = sleepLogs.reduce((s, v) => s + v.duration_minutes, 0);
    const avgSleepScore = sleepLogs.length > 0 ? sleepLogs.reduce((s, v) => s + v.sleep_score, 0) / sleepLogs.length : 78;
    const totalWater = waterLogs.reduce((s, v) => s + v.amount_ml, 0);

    // 2b. Run Rule Engine for Grounding
    const vataVal = doshaRes.data?.vata_percentage || 33;
    const pittaVal = doshaRes.data?.pitta_percentage || 33;
    const kaphaVal = doshaRes.data?.kapha_percentage || 34;
    const agniVal = agniRes.data?.agni_score || 75;
    const ojasVal = ojasRes.data?.ojas_score || 78;

    const groundedFacts = evaluateAyurRules({ vata: vataVal, pitta: pittaVal, kapha: kaphaVal }, agniVal, ojasVal);
    const groundingPromptBlock = buildGroundedAIPrompt(groundedFacts);

    // 3. Prepare AI Prompts
    const systemPrompt = `You are AyurIntel, a senior Ayurvedic physician, clinical pathologist, and AI health coach.
Your job is to generate a comprehensive "Daily Intelligence Briefing" for a user based on their dominant Dosha and current biometrics snapshot.

${groundingPromptBlock}

You MUST format the output strictly as a JSON object with EXACTLY these fields:
{
  "summary": "A friendly, premium greeting and summary briefing of how they feel today (1-2 sentences). Addressed to the user.",
  "risks": "Identify 1-2 constitutional risk elements based on their high stress, sleep deficits, or temperature shifts (e.g., Vata dehydration or Pitta heat acidity). Only mention risks present in the grounding rules.",
  "opportunities": "Identify wellness opportunities matching the grounding guidelines.",
  "mission": "A single focus health mission for today (e.g., 'Hydrate with warm ginger water before lunch'). Only use recommendations from the grounding block.",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "expectedRecovery": "Forecast recovery expectations (e.g. resting heart rate normalization or sleep restoration).",
  "expectedDosha": { "vata": 33, "pitta": 33, "kapha": 34 },
  "expectedAgni": 80,
  "expectedOjas": 82
}

Make expectedDosha keys sum to exactly 100. expectedAgni and expectedOjas scores should be integers out of 100.
Avoid pharmaceutical prescriptions or diagnosing diseases. Frame everything inside preventative Ayurvedic wellness parameters.`;

    const userPrompt = `User: ${userName}
Dominant Dosha constitution: ${dosha}
Current stress level: ${stress}

Today's Biometric Data:
- Average Heart Rate: ${avgHr} bpm
- Average Skin Temp: ${avgTemp}°C
- Steps Traveled: ${totalSteps}
- Sleep Last Night: ${(totalSleep/60).toFixed(1)} hrs (Sleep Score: ${avgSleepScore})
- Hydration Today: ${totalWater} ml

Please generate their customized Daily Intelligence Briefing in the requested JSON structure.`;

    let briefingResult: DailyBriefingSnapshot;

    if (GROQ_API_KEY) {
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 800,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          throw new Error(`Groq HTTP error: ${response.status}`);
        }

        const data = await response.json();
        briefingResult = JSON.parse(data.choices[0].message.content);
      } catch (err) {
        console.warn('[DailyIntelligence] Groq API call failed, calling local engine:', err);
        briefingResult = generateLocalBriefing(userName, dosha, stress, avgHr, avgTemp, totalSteps, totalSleep, avgSleepScore, totalWater);
      }
    } else {
      console.log('[DailyIntelligence] Groq API key is missing. Using local rule-based engine.');
      briefingResult = generateLocalBriefing(userName, dosha, stress, avgHr, avgTemp, totalSteps, totalSleep, avgSleepScore, totalWater);
    }

    // 4. Format markdown content
    const content_markdown = `### Today's Briefing
${briefingResult.summary}

---

### Constitutional Risks & Opportunities
- **Risks**: ${briefingResult.risks}
- **Opportunities**: ${briefingResult.opportunities}

---

### Daily Mission
🎯 **${briefingResult.mission}**

---

### Actions & Recommendations
1. ${briefingResult.recommendations[0] || 'Maintain regular meal timings.'}
2. ${briefingResult.recommendations[1] || 'Stay hydrated with warm water.'}
3. ${briefingResult.recommendations[2] || 'Practice alternate nostril breathing.'}

---

### Recovery Outlook
- **Expected Recovery**: ${briefingResult.expectedRecovery}
`;

    // 5. Upsert daily summary to public.ai_insights table
    const title = `Daily Briefing - ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    const { data: dbInsight, error: dbError } = await supabase
      .from('ai_insights')
      .insert({
        user_id: userId,
        insight_type: 'daily_summary',
        title,
        content_markdown,
        metadata_snapshot: briefingResult
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return {
      id: dbInsight.id,
      title: dbInsight.title,
      content_markdown: dbInsight.content_markdown,
      metadata: dbInsight.metadata_snapshot as any
    };

  } catch (error) {
    console.error('[DailyIntelligence] Failed to generate briefing:', error);
    throw error;
  }
}

/**
 * Local Rule-based Ayurvedic Engine fallback.
 */
function generateLocalBriefing(
  name: string,
  dosha: string,
  stress: string,
  avgHr: number,
  avgTemp: number,
  steps: number,
  sleepMinutes: number,
  sleepScore: number,
  waterMl: number
): DailyBriefingSnapshot {
  let summary = `Welcome back, ${name}. Your vital feeds indicate moderate equilibrium. Today, focus on staying attuned to solar cycles.`;
  let risks = 'Slight accumulation of metabolic residues (Ama) due to minor timing irregularities.';
  let opportunities = 'Strong solar peak after noon offers an ideal window to digest your largest meal of the day.';
  let mission = 'Hydrate with warm ginger water before lunch to prime digestive fire.';
  let recommendations = [
    'Drink 500ml of warm water before noon.',
    'Take a 10-minute walk after your principal meal.',
    'Wind down screen activity by 9:30 PM.'
  ];
  let expectedRecovery = 'Steady resting heart rate stabilization is expected if routines are followed.';
  let expectedDosha = { vata: 33, pitta: 33, kapha: 34 };
  let expectedAgni = 75;
  let expectedOjas = 78;

  // Customizations based on metrics & constitution
  if (dosha === 'vata' || (avgHr > 78 && sleepMinutes < 360)) {
    summary = `Namaste, ${name}. Wind elements (Vata) are active in your pulse. Grounding routines and soothing warmth are recommended today.`;
    risks = 'Vata accumulation could cause minor nervous tension or hydration dryness.';
    opportunities = 'Grounding breathing sessions will calm your central nervous system.';
    mission = 'Engage in a 5-minute alternate nostril breathing session before bed.';
    recommendations = [
      'Incorporate sweet, grounding oils or warm ghee in your lunch.',
      'Sip warm water at regular intervals, avoiding caffeine.',
      'Practice slow, deep breathing if Vata wind surges.'
    ];
    expectedRecovery = 'Sleep efficiency predicted to rise by +8% with grounding breathwork.';
    expectedDosha = { vata: 42, pitta: 28, kapha: 30 };
    expectedAgni = 70;
    expectedOjas = 72;
  } else if (dosha === 'pitta' || avgTemp > 36.8) {
    summary = `Namaste, ${name}. Metabolic fire (Pitta) is highly active. Focus on cooling elements and quiet spaces today.`;
    risks = 'Elevated Pitta heat might trigger stomach acidity or mental irritability in the afternoon.';
    opportunities = 'Midday cooling rests will stabilize cardiorespiratory baselines.';
    mission = 'Consume fresh sweet fruits and drink cooling coconut water today.';
    recommendations = [
      'Avoid fried, hot, or highly spicy seasonings in your meals.',
      'Allow a 15-minute quiet rest in the shade after lunch.',
      'Stay hydrated with cooling mint-infused water.'
    ];
    expectedRecovery = 'Resting heart rate expected to normalize to 64 bpm with cooling rests.';
    expectedDosha = { vata: 25, pitta: 45, kapha: 30 };
    expectedAgni = 82;
    expectedOjas = 76;
  } else if (dosha === 'kapha' || steps < 3000) {
    summary = `Namaste, ${name}. Earth elements (Kapha) are running heavy. Introduce circulation and warm stimulating spices today.`;
    risks = 'Sedentary intervals will aggravate sluggish Kapha metabolism and cause lethargy.';
    opportunities = 'Warming spices and light workouts will ignite your physical energy.';
    mission = 'Complete a 15-minute brisk walk immediately after lunch.';
    recommendations = [
      'Incorporate drying, warming spices like black pepper and ginger in foods.',
      'Execute dynamic stretches or brisk walking intervals.',
      'Avoid heavy, cold, or sugary desserts.'
    ];
    expectedRecovery = 'Metabolic Agni clearance and step-rate recovery will clear tissue sluggishness.';
    expectedDosha = { vata: 30, pitta: 25, kapha: 45 };
    expectedAgni = 68;
    expectedOjas = 80;
  }

  return {
    summary,
    risks,
    opportunities,
    mission,
    recommendations,
    expectedRecovery,
    expectedDosha,
    expectedAgni,
    expectedOjas
  };
}
