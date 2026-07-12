import { supabase } from './supabase';
import { evaluateAyurRules, GroundedFacts } from './ayurRuleEngine';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_MODEL = 'llama-3.1-8b-instant';

export interface PhysicianConsultation {
  phase: 'morning' | 'afternoon' | 'evening' | 'weekly' | 'monthly';
  assessment: string;
  prescriptions: { category: 'Diet' | 'Lifestyle' | 'Herb' | 'Therapy'; instruction: string; rationale: string }[];
  vitalMetricsUsed: { label: string; value: string }[];
  dominantDoshaLabel: string;
  agniClassification: string;
  ojasClassification: string;
}

/**
 * Generates proactive physician consultation data.
 */
export async function generatePhysicianConsultation(
  userId: string,
  phase: 'morning' | 'afternoon' | 'evening' | 'weekly' | 'monthly'
): Promise<PhysicianConsultation> {
  const todayStr = new Date().toISOString().split('T')[0];
  const startOfDay = `${todayStr}T00:00:00.000Z`;
  const endOfDay = `${todayStr}T23:59:59.999Z`;

  // 1. Gather all current biometrics and indexes
  let profileName = 'Yogi';
  let vataVal = 33, pittaVal = 33, kaphaVal = 34;
  let agniScore = 75, ojasScore = 78;
  let avgHr = 70, avgTemp = 36.5, totalSteps = 4500, totalWater = 1500, sleepScore = 78, sleepDuration = 450;

  try {
    const [
      profileRes,
      doshaRes,
      agniRes,
      ojasRes,
      sleepRes,
      hrRes,
      tempRes,
      actRes,
      waterRes
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, dominant_dosha').eq('id', userId).single(),
      supabase.from('daily_dosha_states').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_agni_scores').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('daily_ojas_scores').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startOfDay).lte('start_time', endOfDay).maybeSingle(),
      supabase.from('heart_rate_logs').select('bpm').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('temperature_logs').select('temperature_celsius').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('activity_logs').select('steps_count').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay),
      supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', startOfDay).lte('timestamp', endOfDay)
    ]);

    profileName = profileRes.data?.full_name?.split(' ')[0] || 'Yogi';
    
    if (doshaRes.data) {
      vataVal = doshaRes.data.vata_percentage;
      pittaVal = doshaRes.data.pitta_percentage;
      kaphaVal = doshaRes.data.kapha_percentage;
    }
    if (agniRes.data) agniScore = agniRes.data.agni_score;
    if (ojasRes.data) ojasScore = ojasRes.data.ojas_score;

    const hrLogs = hrRes.data || [];
    if (hrLogs.length > 0) avgHr = Math.round(hrLogs.reduce((s, v) => s + v.bpm, 0) / hrLogs.length);

    const tempLogs = tempRes.data || [];
    if (tempLogs.length > 0) avgTemp = Number((tempLogs.reduce((s, v) => s + Number(v.temperature_celsius), 0) / tempLogs.length).toFixed(1));

    const actLogs = actRes.data || [];
    totalSteps = actLogs.reduce((s, v) => s + v.steps_count, 0);

    const waterLogs = waterRes.data || [];
    totalWater = waterLogs.reduce((s, v) => s + v.amount_ml, 0);

    if (sleepRes.data) {
      sleepScore = sleepRes.data.sleep_score;
      sleepDuration = sleepRes.data.duration_minutes;
    }
  } catch (err) {
    console.warn('[PhysicianService] Failed fetching telemetry: ', err);
  }

  // 2. Evaluate Rule Engine for Grounding Facts
  const groundedFacts = evaluateAyurRules({ vata: vataVal, pitta: pittaVal, kapha: kaphaVal }, agniScore, ojasScore);

  // 3. Assemble diagnostic metric tags
  const vitalMetricsUsed = [
    { label: 'Sleep Score', value: `${sleepScore}/100` },
    { label: 'Avg Heart Rate', value: `${avgHr} bpm` },
    { label: 'Skin Temp', value: `${avgTemp}°C` },
    { label: 'Hydration', value: `${totalWater} ml` },
    { label: 'Steps Taken', value: `${totalSteps}` }
  ];

  // 4. Generate Consultation prompt
  const phaseInstruction = getPhaseInstructions(phase, profileName, groundedFacts);

  if (GROQ_API_KEY) {
    try {
      const systemPrompt = `You are dynamic AquaGuru, acting as a wise, clinical, traditional Ayurvedic Physician.
Your task is to write a proactive physiological assessment of the user's biometrics and prescribe specific actions.
You must strictly follow the grounding instructions. Do NOT invent recommendations.

${phaseInstruction}

Your response must be strictly formatted as a JSON object with EXACTLY this structure:
{
  "assessment": "Detailed 2-3 sentence medical assessment explaining their biometrics relative to their active dosha imbalance and digestive fire state.",
  "prescriptions": [
    { "category": "Diet", "instruction": "A single specific food or spice instruction strictly from the grounding lists.", "rationale": "Why it balances them based on their vitals." },
    { "category": "Lifestyle", "instruction": "A single lifestyle routine strictly from the grounding lists.", "rationale": "Circadian benefit." },
    { "category": "Herb", "instruction": "A single herb prescription strictly from the grounding lists.", "rationale": "Immune or cellular benefit." }
  ]
}
`;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: GROQ_CHAT_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate my consultation.' }
          ],
          temperature: 0.4,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const resJson = await response.json();
        const data = JSON.parse(resJson.choices[0].message.content);
        return {
          phase,
          assessment: data.assessment,
          prescriptions: data.prescriptions,
          vitalMetricsUsed,
          dominantDoshaLabel: groundedFacts.dominantDosha,
          agniClassification: groundedFacts.agniState,
          ojasClassification: groundedFacts.ojasState
        };
      }
    } catch (err) {
      console.warn('[PhysicianService] Groq failed, running local fallback: ', err);
    }
  }

  // Local Rule-Based Fallback
  return generateLocalConsultation(phase, groundedFacts, vitalMetricsUsed);
}

function getPhaseInstructions(phase: string, name: string, facts: GroundedFacts): string {
  const baseRules = `
1. Foods allowed: ${facts.matchedFoods.map(f => f.name).join(', ')}
2. Herbs allowed: ${facts.matchedHerbs.map(h => h.name).join(', ')}
3. Spices allowed: ${facts.doshaBestSpices.join(', ')}
4. Dinacharya routines: ${facts.recommendedRoutines.map(r => r.activity).join(', ')}
5. Agni corrective actions: ${facts.correctiveAgniActions.join(', ')}
6. Ojas Rejuvenation: ${facts.rejuvenatingOjasTherapies.join(', ')}
  `;

  switch (phase) {
    case 'morning':
      return `
[Phase: Morning Consultation]
Draft a morning assessment for ${name}. Review their rest quality and prime their digestive system.
Grounding:
${baseRules}
Focus: Priming the digestive fire (Agni) and morning Dinacharya.
`;
    case 'afternoon':
      return `
[Phase: Afternoon Check-in]
Draft a midday check-in for ${name}. Assess their solar-peak metabolic activity (Pitta high point).
Grounding:
${baseRules}
Focus: Hydration, midday energy stamina, and avoiding Pitta inflammatory thermal shifts.
`;
    case 'evening':
      return `
[Phase: Evening Review]
Draft a sunset review for ${name}. Reflect on the total day's stress index, food logged, and sleep prep.
Grounding:
${baseRules}
Focus: Calming the nervous system (Vata wind), digesting any Ama, and preparing sleep hygiene.
`;
    case 'weekly':
      return `
[Phase: Weekly Review]
Draft a weekly summary review. Analyze the past 7 days of HRV stability and Dosha trends.
Grounding:
${baseRules}
Focus: Overall consistency, tissue build (Dhatus), and identifying chronic imbalances.
`;
    case 'monthly':
    default:
      return `
[Phase: Monthly Health Summary]
Draft a monthly health summary. Analyze structural improvements in Agni fire and Ojas immunity.
Grounding:
${baseRules}
Focus: Overall cellular resilience, constitutional shifts, and seasonal Ritucharya changes.
`;
  }
}

/**
 * Local rules-based Ayurvedic physician fallback engine.
 */
function generateLocalConsultation(
  phase: 'morning' | 'afternoon' | 'evening' | 'weekly' | 'monthly',
  facts: GroundedFacts,
  vitalMetrics: { label: string; value: string }[]
): PhysicianConsultation {
  const dominant = facts.dominantDosha;
  const agni = facts.agniState.toUpperCase();
  const ojas = facts.ojasState.toUpperCase();

  let assessment = '';
  const prescriptions: { category: 'Diet' | 'Lifestyle' | 'Herb' | 'Therapy'; instruction: string; rationale: string }[] = [];

  const food = facts.matchedFoods[0]?.name || 'Warm water with ginger';
  const herb = facts.matchedHerbs[0]?.name || 'Ashwagandha';
  const routine = facts.recommendedRoutines[0]?.activity || 'Ushapan';
  const spice = facts.doshaBestSpices[0] || 'Ginger';

  if (phase === 'morning') {
    assessment = `Good morning. Your biometrics indicate a ${dominant} dominant constitution. Your Agni is classified as ${agni}, requiring gentle kindling as you begin the day. Sleep recovery was tracked as ${ojas} protective level.`;
    prescriptions.push({ category: 'Diet', instruction: `Drink a cup of ${food} before breakfast.`, rationale: 'Primers your stomach lining, igniting digestive enzymes.' });
    prescriptions.push({ category: 'Lifestyle', instruction: `Perform ${routine} immediately.`, rationale: 'Flushes out colon toxins (Ama) accumulated overnight.' });
    prescriptions.push({ category: 'Herb', instruction: `Take a small dose of ${herb}.`, rationale: 'Supports adrenal recovery and stabilizes morning cortisol levels.' });
  } else if (phase === 'afternoon') {
    assessment = `Midday review. We are currently in the solar Pitta peak. Your heart rate trends are stable, indicating reasonable metabolic regulation. Ensure your hydration is maintained to prevent element heat spikes.`;
    prescriptions.push({ category: 'Diet', instruction: `Favor meals cooked with ${spice} and coconut oil.`, rationale: 'Keeps Pitta metabolic fire under control while preventing acidity.' });
    prescriptions.push({ category: 'Lifestyle', instruction: 'Avoid direct heat exposure and take a 5-minute deep breathing break.', rationale: 'Prevents emotional irritability and calms heart rate variability.' });
    prescriptions.push({ category: 'Herb', instruction: `Prepare an infusion of ${food}.`, rationale: 'Cools internal inflammation and builds blood plasma vitality.' });
  } else if (phase === 'evening') {
    assessment = `Evening sunset reflection. Your daily step activity and stress indexes are completed. The Vata wind period is active, meaning nervous regulation and thermal cooling require warm grounding.`;
    prescriptions.push({ category: 'Diet', instruction: `Consume a light, warm soup seasoned with ${spice}.`, rationale: 'Prevents evening digestive gas and bloating.' });
    prescriptions.push({ category: 'Lifestyle', instruction: 'Perform alternate nostril breathing exercises (Pranayama) before sleep.', rationale: 'Directly lowers resting heart rate, calming erratic brain activity.' });
    prescriptions.push({ category: 'Herb', instruction: `Take ${herb} with warm milk.`, rationale: 'Conserves Ojas tissue repair and induces deep sleep cycles.' });
  } else {
    // Weekly / Monthly
    assessment = `Clinical cycle report. Your aggregate 7-day indicators show a strong trend of ${dominant} regulation. Agni scores are consistent at ${agni} level, while Ojas immune reserves remain ${ojas}.`;
    prescriptions.push({ category: 'Diet', instruction: `Maintain a diet rich in Tridoshic items like ${food}.`, rationale: 'Maintains tissue equilibrium and balances blood glucose.' });
    prescriptions.push({ category: 'Lifestyle', instruction: `Strictly adhere to your morning ${routine} schedule.`, rationale: 'Establishes circadian rhythm stability.' });
    prescriptions.push({ category: 'Herb', instruction: `Incorporate ${herb} into your daily regimen.`, rationale: 'Builds cellular immunity (Ojas) and muscle resilience.' });
  }

  return {
    phase,
    assessment,
    prescriptions,
    vitalMetricsUsed: vitalMetrics,
    dominantDoshaLabel: dominant,
    agniClassification: facts.agniState,
    ojasClassification: facts.ojasState
  };
}
