import { supabase } from './supabase';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_CHAT_MODEL = 'llama-3.3-70b-versatile';

export interface CompiledAnalyticsReport {
  id: string;
  created_at: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  start_date: string;
  end_date: string;
  summary_markdown: string;
  health_score: number;
  wellness_score: number;
  meta_stats: {
    avg_hr: number;
    avg_temp: number;
    total_steps: number;
    total_water_ml: number;
    total_calories_kcal: number;
    avg_sleep_score: number;
  };
}

/**
 * Aggregates logs, calculates scores, and compiles AI wellness reports.
 *
 * @param userId User identifier
 * @param reportType Target report interval ('daily' | 'weekly' | 'monthly')
 * @returns Saved report record
 */
export async function compileAnalyticsReport(
  userId: string,
  reportType: 'daily' | 'weekly' | 'monthly'
): Promise<CompiledAnalyticsReport> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API Key is not configured. Define EXPO_PUBLIC_GROQ_API_KEY.');
  }

  // 1. Calculate time frame parameters
  const endDate = new Date();
  const startDate = new Date();
  let daysCount = 1;

  if (reportType === 'daily') {
    startDate.setDate(endDate.getDate() - 1);
    daysCount = 1;
  } else if (reportType === 'weekly') {
    startDate.setDate(endDate.getDate() - 7);
    daysCount = 7;
  } else { // monthly
    startDate.setDate(endDate.getDate() - 30);
    daysCount = 30;
  }

  const startStr = startDate.toISOString();
  const endStr = endDate.toISOString();

  // 2. Fetch User Profile Context
  const { data: profile } = await supabase
    .from('profiles')
    .select('dominant_dosha, daily_water_goal_ml, daily_calorie_goal_kcal')
    .eq('id', userId)
    .single();

  const dominantDosha = profile?.dominant_dosha || 'tridoshic';
  const waterGoal = profile?.daily_water_goal_ml || 2500;
  const calorieGoal = profile?.daily_calorie_goal_kcal || 2000;

  // 3. Query all telemetry/biometric and nutritional tables, plus Ojas, in parallel
  const [
    hrData,
    tempData,
    actData,
    sleepData,
    waterData,
    foodData,
    ojasData
  ] = await Promise.all([
    supabase.from('heart_rate_logs').select('bpm').eq('user_id', userId).gte('timestamp', startStr),
    supabase.from('temperature_logs').select('temperature_celsius').eq('user_id', userId).gte('timestamp', startStr),
    supabase.from('activity_logs').select('steps_count').eq('user_id', userId).gte('timestamp', startStr),
    supabase.from('sleep_logs').select('sleep_score, duration_minutes').eq('user_id', userId).gte('start_time', startStr),
    supabase.from('hydration_logs').select('amount_ml').eq('user_id', userId).gte('timestamp', startStr),
    supabase.from('food_logs').select('calories_kcal').eq('user_id', userId).gte('timestamp', startStr),
    supabase.from('daily_ojas_scores').select('ojas_score').eq('user_id', userId).gte('date', startStr.split('T')[0])
  ]);

  // 4. Calculate aggregate stats
  const bpmList = (hrData.data || []).map(r => r.bpm);
  const avgHr = bpmList.length > 0 ? Math.round(bpmList.reduce((s, v) => s + v, 0) / bpmList.length) : 70;

  const tempList = (tempData.data || []).map(r => Number(r.temperature_celsius));
  const avgTemp = tempList.length > 0 ? Number((tempList.reduce((s, v) => s + v, 0) / tempList.length).toFixed(1)) : 36.6;

  const totalSteps = (actData.data || []).reduce((s, r) => s + r.steps_count, 0);

  const sleepList = (sleepData.data || []).map(r => r.sleep_score);
  const avgSleepScore = sleepList.length > 0 ? Math.round(sleepList.reduce((s, v) => s + v, 0) / sleepList.length) : 75;

  const totalWater = (waterData.data || []).reduce((s, r) => s + r.amount_ml, 0);
  const totalCalories = (foodData.data || []).reduce((s, r) => s + r.calories_kcal, 0);

  const ojasList = (ojasData?.data || []).map(r => Number(r.ojas_score));
  const avgOjasScore = ojasList.length > 0
    ? Math.round(ojasList.reduce((s, v) => s + v, 0) / ojasList.length)
    : 70;

  // 5. Scoring Calculations
  // Health Score (Vitals)
  const hrScore = Math.max(20, 100 - Math.abs(avgHr - 70) * 2);
  const tempScore = Math.max(20, 100 - Math.abs(avgTemp - 36.6) * 20);
  const sleepScore = avgSleepScore;
  const healthScore = Math.round((hrScore + tempScore + sleepScore) / 3);

  // Wellness Score (Compliance)
  const expectedWater = waterGoal * daysCount;
  const hydrationScore = Math.min(100, expectedWater > 0 ? Math.round((totalWater / expectedWater) * 100) : 50);

  const expectedSteps = 8000 * daysCount;
  const stepsScore = Math.min(100, expectedSteps > 0 ? Math.round((totalSteps / expectedSteps) * 100) : 50);

  const expectedCalories = calorieGoal * daysCount;
  let dietScore = 50;
  if (totalCalories > 0) {
    const diff = Math.abs(totalCalories - expectedCalories);
    dietScore = Math.max(20, 100 - Math.round(diff / (50 * daysCount)));
  }
  const wellnessScore = Math.round((hydrationScore + stepsScore + dietScore) / 3);

  // 6. Consult Llama 3 via Groq for Trend analysis and Ayurvedic report compiling
  const systemPrompt = `You are AyurAnalytics AI, a medical analytics engine and Ayurvedic physician.
Your task is to analyze the user's aggregated vitals and nutritional compliance score for their diagnostic report and generate a clear wellness explanation.

USER PROFILE:
- Constitution: ${dominantDosha}

COMPILATION STATS (${reportType.toUpperCase()} interval - ${daysCount} days):
- Average Heart Rate: ${avgHr} bpm
- Average Temperature: ${avgTemp} °C
- Total Steps Traveled: ${totalSteps} steps
- Average Sleep Score: ${avgSleepScore}%
- Total Water Drank: ${totalWater} ml
- Total Energy Consumed: ${totalCalories} kcal
- Average Ojas Score (Vitality & Resilience): ${avgOjasScore}/100

CALCULATED INDEXES:
- Physiological Health Score: ${healthScore}/100
- Lifestyle Wellness Score: ${wellnessScore}/100

INSTRUCTIONS:
- Write a structured diagnostic report detailing:
  1. Vitals stability analysis (evaluating pulse, temperature, and sleep consistency).
  2. Habits compliance analysis (evaluating water intake, physical activity, and diet calories).
  3. Ayurvedic interpretation: discuss if these scores indicate a Vata, Pitta, or Kapha aggravation (excess heat, wind, or lethargy) relative to their dominances. Connect this specifically to their Ojas Score (vitality/resilience).
  4. Actions: 3 specific, actionable balancing guidelines.
- Output in clean, simple Markdown format without HTML. Keep response concise (under 200 words).`;

  try {
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
          { role: 'user', content: `Compile my ${reportType} report.` }
        ],
        temperature: 0.5,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq report API failed: ${errText}`);
    }

    const resJson = await response.json();
    const markdownReport = resJson.choices[0]?.message?.content || 'Failed to generate report.';

    // 7. Insert the generated report row into public.health_reports
    const { data: dbReport, error: dbErr } = await supabase
      .from('health_reports')
      .insert({
        user_id: userId,
        report_type: reportType,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        summary_markdown: markdownReport,
        health_score: healthScore,
        wellness_score: wellnessScore,
        meta_stats: {
          avg_hr: avgHr,
          avg_temp: avgTemp,
          total_steps: totalSteps,
          total_water_ml: totalWater,
          total_calories_kcal: totalCalories,
          avg_sleep_score: avgSleepScore
        }
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    return {
      id: dbReport.id,
      created_at: dbReport.created_at,
      report_type: reportType,
      start_date: dbReport.start_date,
      end_date: dbReport.end_date,
      summary_markdown: dbReport.summary_markdown,
      health_score: healthScore,
      wellness_score: wellnessScore,
      meta_stats: {
        avg_hr: avgHr,
        avg_temp: avgTemp,
        total_steps: totalSteps,
        total_water_ml: totalWater,
        total_calories_kcal: totalCalories,
        avg_sleep_score: avgSleepScore
      }
    };

  } catch (error: any) {
    console.error('[AnalyticsService] Report compilation failed:', error);
    throw error;
  }
}
