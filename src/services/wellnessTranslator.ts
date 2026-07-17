export interface TranslatedWellness {
  whatIsHappening: string;
  why: string;
  whatTodo: string;
  whatNextDay: string;
}

/**
 * Translates raw biometric and Ayurvedic scores into plain-language wellness insights.
 */
export function translateDoshaState(
  vata: number,
  pitta: number,
  kapha: number
): TranslatedWellness {
  const max = Math.max(vata, pitta, kapha);

  if (max === vata && vata > 35) {
    return {
      whatIsHappening: "Your body and mind may feel slightly scattered, sensitive, or restless today.",
      why: "A rise in Vata (Air/Ether) element has been registered, which is linked to irregular routines, lack of grounding sleep, or stress sensitivity.",
      whatTodo: "Ground your energy. Prioritize warm, nourishing cooked meals, sip on warm herbal infusions, and take a 5-minute deep slow breathing break.",
      whatNextDay: "Adhering to these grounding habits today will stabilize your nervous system and support deep restorative sleep tonight.",
    };
  }

  if (max === pitta && pitta > 35) {
    return {
      whatIsHappening: "Your body may be generating more internal warmth, intensity, or sensitivity today.",
      why: "A rise in Pitta (Fire/Water) element has been registered, often triggered by intensity of activity, hot environments, or stimulating seasonings.",
      whatTodo: "Cool and calm your system. Opt for cooling foods like sweet fruits or coconut water, avoid heated discussions, and take a gentle shaded walk.",
      whatNextDay: "Pacifying your internal fire today will prevent midday digestive acidity and keep your sleep onset calm and refreshing.",
    };
  }

  if (max === kapha && kapha > 35) {
    return {
      whatIsHappening: "Your system may feel heavier, slow-paced, or less energetic today.",
      why: "A rise in Kapha (Earth/Water) element has been registered, which tends to accumulate from extended physical rest, heavy foods, or sluggish circulation.",
      whatTodo: "Ignite your vitality. Stimulate circulation with brisk movement or cardiovascular exercise, and drink warm water infused with fresh ginger.",
      whatNextDay: "Stimulating your body today will clear sluggishness, lift mental fog, and bring back a clean energy flow by tomorrow morning.",
    };
  }

  // Balanced Prakriti Default
  return {
    whatIsHappening: "Your inner elements are in a beautiful state of harmony and calm balance today.",
    why: "Your Vata, Pitta, and Kapha elements are distributed evenly, indicating consistent routines, good sleep patterns, and stable vital signs.",
    whatTodo: "Sustain this equilibrium. Continue your healthy nutrition, keep hydrated, and enjoy this steady state of well-being.",
    whatNextDay: "Maintaining this state will build deep vitality reserves, preparing you for a week of clear focus and high resilience.",
  };
}

export function translateAgniScore(score: number): { state: string; interpretation: string } {
  if (score < 65) {
    return {
      state: "Slower Digestive Fire",
      interpretation: "Your digestion may be slightly slower or more sensitive today. Your metabolic fire (Agni) is currently gentle.",
    };
  }
  if (score > 85) {
    return {
      state: "Strong Digestive Fire",
      interpretation: "Your digestion is highly active and efficient. Your metabolic fire (Agni) is clean and intense.",
    };
  }
  return {
    state: "Steady Digestive Fire",
    interpretation: "Your digestion is balanced, functioning steadily to nourish your body without overheating.",
  };
}

export function translateOjasScore(score: number): { state: string; interpretation: string } {
  if (score < 70) {
    return {
      state: "Recovery Mode",
      interpretation: "Your body's vital immune reserves are running lower. You may need additional rest and tissue recovery today.",
    };
  }
  return {
    state: "Resilient Immunity",
    interpretation: "Your body's protective shield (Ojas) is strong and resilient. You have great natural defense and cellular vitality today.",
  };
}

export function translateHeartRate(bpm: number): string {
  if (bpm < 60) {
    return "Circulation is deep, slow, and resting (Prana/Vata Dominant).";
  }
  if (bpm > 85) {
    return "Internal pulse fire is active and accelerated (Tejas/Pitta Peak).";
  }
  return "Heart rate is pulsing at a steady, calm rhythm (Sama/Balanced).";
}

export function translateSkinTemp(temp: number): string {
  if (temp < 36.2) {
    return "Your body feels cool and deeply relaxed.";
  }
  if (temp > 37.2) {
    return "Your system is radiating extra warmth and metabolic activity.";
  }
  return "Your thermal balance is steady and comfortable.";
}

export function translateActivity(activity?: string): string {
  const act = activity?.toLowerCase();
  if (act === 'walking') return "Movement: Steady, rhythmic steps supporting circulation.";
  if (act === 'running') return "Movement: Vigorous active output generating internal fire.";
  if (act === 'yoga') return "Movement: Centering posture flow to calm the nervous channels.";
  if (act === 'sedentary') return "State: Restorative stillness, allowing tissue recovery.";
  return "State: Steady conservation of vital energies.";
}
