export interface ConceptExplanation {
  id: string;
  title: string;
  subtitle: string;
  whatItMeans: string;
  whyDetected: string;
  howEstimated: string;
  whatToDo: string;
  ifIgnored: string;
  relatedLessonId: string;
  relatedLessonTitle: string;
  illustrationType: 'vata' | 'pitta' | 'kapha' | 'agni' | 'ojas' | 'dinacharya';
}

export type ConceptId = 'vata' | 'pitta' | 'kapha' | 'agni' | 'ojas' | 'sleep';

export const conceptExplanations: Record<ConceptId, ConceptExplanation> = {
  vata: {
    id: 'vata',
    title: 'Vata (Air & Space)',
    subtitle: 'The Energy of Movement',
    whatItMeans: 'Vata represents the elements of Air and Space. It controls all nervous impulses, breathing, heartbeat, and motor functions. When balanced, it brings creativity and light energy. When high, it causes dryness, nervousness, and wind accumulation.',
    whyDetected: 'AquaAyur detected elevated Vata activity due to slight fluctuations in your heartbeat rhythms and temporary drops in your skin temperature.',
    howEstimated: 'Vata is estimated using your Heart Rate Variability (HRV) patterns. High fluctuations or irregular intervals in your pulse stream signal an active autonomic nervous system (Vata wind).',
    whatToDo: 'Focus on warming, moist foods (soups, stews, warm milk). Keep warm, avoid sudden cold drafts, and practice 5 minutes of slow, deep breathing (Pranayama).',
    ifIgnored: 'Ignoring Vata excess leads to restless sleep, racing thoughts, muscle tension, dry skin, and irregular digestive capacity (Vishamagni).',
    relatedLessonId: 'vata',
    relatedLessonTitle: 'What is Vata?',
    illustrationType: 'vata'
  },
  pitta: {
    id: 'pitta',
    title: 'Pitta (Fire & Water)',
    subtitle: 'The Energy of Transformation',
    whatItMeans: 'Pitta governs fire and heat. It is responsible for digestive enzymes, body temperature, liver function, and daytime focus. When balanced, it brings leadership and sharp digestion. When high, it causes inflammation, acidity, and internal heat.',
    whyDetected: 'AquaAyur detected Pitta accumulation from your elevated resting heart rate and warm skin temperature readings.',
    howEstimated: 'Pitta is estimated by tracking your skin temperature thermistor data alongside average resting pulse rates. Elevated base thermal parameters reflect active metabolism (Pitta fire).',
    whatToDo: 'Consume cooling foods like sweet fruits, cucumbers, mint, and coconut water. Avoid spicy seasonings, caffeine, and direct sun exposure during midday.',
    ifIgnored: 'Unchecked Pitta fire leads to digestive acidity, acid reflux, skin inflammation (rashes), night sweating, and irritability.',
    relatedLessonId: 'pitta',
    relatedLessonTitle: 'What is Pitta?',
    illustrationType: 'pitta'
  },
  kapha: {
    id: 'kapha',
    title: 'Kapha (Earth & Water)',
    subtitle: 'The Energy of Stability',
    whatItMeans: 'Kapha governs structure and physical lubrication. It forms bones, joints, muscles, and holds your natural immune shield. When balanced, it brings love, calm, and strength. When high, it causes heaviness, lethargy, and fluid retention.',
    whyDetected: 'AquaAyur detected Kapha accumulation due to lower physical activity steps combined with highly stable, slower pulse patterns.',
    howEstimated: 'Kapha is estimated by tracking daily step velocities and total activity minutes. Low steps combined with steady, slow heart rates reflect stable Kapha earth elements.',
    whatToDo: 'Activate your system. Perform 10-15 minutes of brisk cardiovascular exercise, enjoy warming spices (ginger, black pepper), and avoid sleeping during the daytime.',
    ifIgnored: 'Neglecting Kapha accumulation leads to physical lethargy, sinus congestion, weight gain, sluggish circulation, and low digestive drive (Mandagni).',
    relatedLessonId: 'kapha',
    relatedLessonTitle: 'What is Kapha?',
    illustrationType: 'kapha'
  },
  agni: {
    id: 'agni',
    title: 'Agni (Metabolic Fire)',
    subtitle: 'The Engine of Digestion',
    whatItMeans: 'Agni is your digestive fire. It is responsible for breaking down food, absorbing nutrients, and maintaining immune defense. Clean Agni creates Ojas (vitality), while weak Agni creates toxic buildup (Ama).',
    whyDetected: 'AquaAyur evaluated your Agni status based on the timing of your logged meals, water volume intake, and activity metrics.',
    howEstimated: 'Agni is estimated by calculating a compliance score across water hydration balance, step intervals, and circadian meal timings logged throughout the day.',
    whatToDo: 'Eat your largest meal at solar noon (12:00 PM - 1:30 PM). Sip warm water throughout the day. Avoid drinking ice water during or immediately after meals.',
    ifIgnored: 'Suppressed Agni (Mandagni) causes bloating, gas, chronic fatigue, sluggish bowel movements, and poor nutrient assimilation.',
    relatedLessonId: 'agni',
    relatedLessonTitle: 'What is Agni?',
    illustrationType: 'agni'
  },
  ojas: {
    id: 'ojas',
    title: 'Ojas (Immune Shield)',
    subtitle: 'Your Cell Vitality and Protection',
    whatItMeans: 'Ojas is the pure essence of all body tissues, representing your natural immune resilience, vitality, and radiant wellness. When Ojas is strong, you resist fatigue and environmental stress.',
    whyDetected: 'AquaAyur calculated your Ojas immunity level from your cumulative sleep cycles, heart rate recovery, and stress indexes.',
    howEstimated: 'Ojas is estimated using your sleep duration, sleep latency, resting heart rate recovery patterns, and overall daily stress data.',
    whatToDo: 'Prioritize deep, restorative sleep. Wind down by 9:30 PM, drink warm almond milk with a pinch of cardamom, and practice meditation to calm stress.',
    ifIgnored: 'Depleted Ojas leaves your system vulnerable to physical fatigue, low immune defenses, and emotional anxiety.',
    relatedLessonId: 'ojas',
    relatedLessonTitle: 'What is Ojas?',
    illustrationType: 'ojas'
  },
  sleep: {
    id: 'sleep',
    title: 'Nidra (Circadian Rest)',
    subtitle: 'The Pillar of Tissue Repair',
    whatItMeans: 'Restful sleep (Nidra) is one of the three pillars of life in Ayurveda. It is when your tissues are repaired, your brain is cleared of wastes, and your Ojas energy is fully replenished.',
    whyDetected: 'AquaAyur monitors your sleep cycles and autonomic stability indices during rest to measure physical recovery.',
    howEstimated: 'Sleep is estimated by measuring your heart rate drop and temperature alignment during nocturnal hours.',
    whatToDo: 'Avoid screens for 1 hour before bed. Keep your bedroom cool, dark, and quiet. Drink warm water or milk, and sleep before 10:00 PM.',
    ifIgnored: 'Chronic sleep loss aggravates Vata (causes anxiety/racing mind) and suppresses Agni (leading to morning lethargy and sluggishness).',
    relatedLessonId: 'dinacharya',
    relatedLessonTitle: 'What is Dinacharya?',
    illustrationType: 'dinacharya'
  }
};
