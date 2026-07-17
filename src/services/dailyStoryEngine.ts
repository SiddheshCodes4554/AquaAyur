export interface DailyStoryInput {
  userName: string;
  dominantDosha: string;
  vata: number;
  pitta: number;
  kapha: number;
  agni: number;
  ojas: number;
  sleepMinutes: number;
  avgSleepMinutes: number;
  heartRate: number;
  avgHeartRate: number;
  temperature: number;
  avgTemperature: number;
  steps: number;
  waterMl: number;
}

export interface DailyStory {
  greeting: string;
  currentCondition: string;
  reason: string;
  prediction: string;
  recommendations: string[];
  expectedOutcome: string;
  confidence: number; // percentage based on sensor sync completeness
  rawMarkdown: string;
}

export function generateDailyStory(input: DailyStoryInput): DailyStory {
  const currentHour = new Date().getHours();
  
  // 1. GREETING
  let greeting = `Namaste ${input.userName} 🌿`;
  if (currentHour < 12) {
    greeting = `Good Morning ${input.userName} 🌿`;
  } else if (currentHour < 17) {
    greeting = `Good Afternoon ${input.userName} 🌿`;
  } else {
    greeting = `Good Evening ${input.userName} 🌿`;
  }

  // 2. CURRENT CONDITION
  let currentCondition = 'Today your body appears well balanced, resting in a peaceful state of equilibrium.';
  const maxDosha = Math.max(input.vata, input.pitta, input.kapha);
  
  if (maxDosha === input.vata && input.vata > 35) {
    currentCondition = 'Today your system shows signs of Vata air flow, indicating active mental energy and slight physical dryness.';
  } else if (maxDosha === input.pitta && input.pitta > 35) {
    currentCondition = 'Today your system shows elevated Pitta fire, indicating intense metabolic activity and internal warmth.';
  } else if (maxDosha === input.kapha && input.kapha > 35) {
    currentCondition = 'Today your body shows signs of Kapha earth dominance, bringing deep structural stability but potential physical heaviness.';
  }

  // 3. REASON
  const reasons: string[] = [];
  
  // Heart rate reason
  if (input.heartRate > 0) {
    const hrDiff = input.heartRate - input.avgHeartRate;
    if (Math.abs(hrDiff) <= 5) {
      reasons.push('Your heart rate remained stable overnight, suggesting a calm nervous system.');
    } else if (hrDiff > 5) {
      reasons.push('Your heart rate is running slightly higher than your average, indicating active metabolic fire.');
    } else {
      reasons.push('Your heart rate is running cool and slow, showing a deeply relaxed state.');
    }
  } else {
    reasons.push('Your baseline heart rate is calibrating.');
  }

  // Temperature reason
  if (input.temperature > 0) {
    const tempDiff = input.temperature - input.avgTemperature;
    if (Math.abs(tempDiff) <= 0.4) {
      reasons.push('Your skin temperature is within your healthy optimal range.');
    } else if (tempDiff > 0.4) {
      reasons.push('Your skin temperature is slightly elevated, suggesting heat processing.');
    } else {
      reasons.push('Your skin temperature is slightly lower than your baseline average.');
    }
  }

  // Sleep reason
  if (input.sleepMinutes > 0) {
    const sleepDiff = input.sleepMinutes - input.avgSleepMinutes;
    if (sleepDiff < -45) {
      reasons.push('You slept slightly less than your historical average.');
    } else if (sleepDiff > 45) {
      reasons.push('Your sleep was long and restorative, allowing deep tissue repair.');
    } else {
      reasons.push('You achieved your target sleep duration, replenishing Ojas.');
    }
  } else {
    reasons.push('Sleep logs are pending sync.');
  }

  const reason = reasons.join(' ');

  // 4. PREDICTION
  let prediction = 'You are predicted to maintain steady, productive energy throughout the day.';
  if (input.sleepMinutes > 0 && input.sleepMinutes < input.avgSleepMinutes - 45) {
    prediction = 'Because you slept less, your body may become slightly tired or sluggish this afternoon.';
  } else if (maxDosha === input.pitta && input.pitta > 35) {
    prediction = 'With dominant Pitta fire, you might experience mild acidity or high hunger spikes around midday.';
  } else if (maxDosha === input.vata && input.vata > 35) {
    prediction = 'With active Vata wind, your mind may wander easily, leading to racing thoughts or light distraction.';
  } else if (maxDosha === input.kapha && input.kapha > 35) {
    prediction = 'With heavy Kapha earth, you may experience a slight afternoon brain fog or desire to nap.';
  }

  // 5. RECOMMENDATIONS
  const recommendations: string[] = [];
  if (maxDosha === input.vata) {
    recommendations.push('Hydration with warm water');
    recommendations.push('Nourishing warm soup for lunch');
    recommendations.push('Avoid cold drinks or caffeine');
    recommendations.push('Sleep before 10:00 PM');
  } else if (maxDosha === input.pitta) {
    recommendations.push('Hydration with coconut water');
    recommendations.push('Enjoy a light, cooling lunch');
    recommendations.push('Avoid highly spicy seasonings');
    recommendations.push('Quiet evening walk in nature');
  } else {
    recommendations.push('Hydration with warm ginger tea');
    recommendations.push('Eat a light, stimulating lunch');
    recommendations.push('Avoid heavy sweets or dairy');
    recommendations.push('Keep moving or stand hourly');
  }

  // Add water recommendations if hydration is low
  if (input.waterMl < 1000) {
    recommendations.unshift('Drink 2 glasses of water now');
  }

  // 6. EXPECTED OUTCOME
  let expectedOutcome = 'Improved recovery and metabolic fire tomorrow.';
  if (maxDosha === input.vata) {
    expectedOutcome = 'Calmer focus and settled nervous energy tomorrow.';
  } else if (maxDosha === input.pitta) {
    expectedOutcome = 'Stabilized body temperature and lighter digestion tomorrow.';
  } else if (maxDosha === input.kapha) {
    expectedOutcome = 'Lighter physical energy and clearer alertness tomorrow.';
  }

  // 7. CONFIDENCE CALCULATION
  let confidence = 20; // base value
  if (input.heartRate > 0) confidence += 25;
  if (input.temperature > 0) confidence += 25;
  if (input.steps > 0) confidence += 15;
  if (input.sleepMinutes > 0) confidence += 15;
  confidence = Math.min(100, confidence);

  // 8. RAW MARKDOWN GENERATION
  const rawMarkdown = `${greeting}

${currentCondition}

${reason}

${prediction}

### Today's Focus:
${recommendations.map(r => `• ${r}`).join('\n')}

### Expected Outcome:
${expectedOutcome}`;

  return {
    greeting,
    currentCondition,
    reason,
    prediction,
    recommendations,
    expectedOutcome,
    confidence,
    rawMarkdown
  };
}
