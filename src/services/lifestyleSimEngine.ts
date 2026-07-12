export interface SimulatedHabits {
  sleepHours: number;
  hydrationLitres: number;
  exerciseMinutes: number;
  dinnerHour: number; // 24h format (e.g. 18 = 6 PM, 22 = 10 PM)
}

export interface SimulationResult {
  recovery: { base: number; simulated: number; delta: number };
  energy: { base: number; simulated: number; delta: number };
  sleepQuality: { base: number; simulated: number; delta: number };
  agni: { base: number; simulated: number; delta: number };
  ojas: { base: number; simulated: number; delta: number };
  dosha: {
    base: { vata: number; pitta: number; kapha: number };
    simulated: { vata: number; pitta: number; kapha: number };
  };
  dominantAggravation: string;
}

/**
 * Calculates the health predictions based on simulated lifestyle habit changes.
 */
export function runLifestyleSimulation(
  habits: SimulatedHabits,
  baseVata: number = 33,
  basePitta: number = 33,
  baseKapha: number = 34,
  baseAgni: number = 75,
  baseOjas: number = 78
): SimulationResult {
  
  // Baselines
  const baseRecovery = Math.round(baseOjas * 0.95);
  const baseEnergy = Math.round(baseAgni * 0.92);
  const baseSleepQuality = 80;

  // 1. SLEEP CHANGES EFFECT (4h to 10h)
  const sleepDiff = habits.sleepHours - 7.5; // Baseline 7.5h
  let sleepScoreMod = sleepDiff * 10;
  if (habits.sleepHours > 9) {
    // Oversleeping increases Kapha sluggishness and slightly lowers efficiency
    sleepScoreMod = (9 - 7.5) * 10 - (habits.sleepHours - 9) * 8;
  }
  const simSleepQuality = Math.max(30, Math.min(98, baseSleepQuality + sleepScoreMod));

  // Recovery & Ojas builds during sleep
  let recSleepMod = sleepDiff * 8;
  let ojasSleepMod = sleepDiff * 6;
  if (habits.sleepHours < 6) {
    // Severe deprivation penalty
    recSleepMod -= 15;
    ojasSleepMod -= 10;
  }

  // 2. HYDRATION CHANGES EFFECT (0.5L to 4.0L)
  // Optimal: 2.5L to 3.5L
  let hydrationMod = 0;
  if (habits.hydrationLitres < 1.5) {
    hydrationMod = -12 * (1.5 - habits.hydrationLitres);
  } else if (habits.hydrationLitres >= 2.5 && habits.hydrationLitres <= 3.5) {
    hydrationMod = 8;
  } else if (habits.hydrationLitres > 3.5) {
    // Too much water dilutes Agni slightly
    hydrationMod = 4;
  }

  // 3. EXERCISE CHANGES EFFECT (0m to 90m)
  // Optimal: 30m to 50m
  let exerciseAgniMod = 0;
  let exerciseEnergyMod = 0;

  if (habits.exerciseMinutes === 0) {
    exerciseAgniMod = -10;
    exerciseEnergyMod = -8; // Sedentary lethargy
  } else if (habits.exerciseMinutes >= 30 && habits.exerciseMinutes <= 50) {
    exerciseAgniMod = 12;
    exerciseEnergyMod = 10;
  } else if (habits.exerciseMinutes > 75) {
    // Excessive exercise depletes Ojas and increases recovery demands
    exerciseAgniMod = 5;
    exerciseEnergyMod = -6; // Exhaustion
  }

  // 4. DINNER TIME CHANGES EFFECT (6 PM to 11 PM)
  // Baseline ~ 7.30 PM (19.5). Late-night dining severely harms digestion and sleep
  const dinnerHourDiff = habits.dinnerHour - 19.5;
  let dinnerAgniMod = 0;
  let dinnerSleepMod = 0;

  if (habits.dinnerHour >= 21.5) {
    // 9:30 PM or later
    dinnerAgniMod = -18 * (habits.dinnerHour - 20);
    dinnerSleepMod = -12 * (habits.dinnerHour - 20);
  } else if (habits.dinnerHour <= 19) {
    // 7 PM or earlier is optimal (ignites Agni before sleep)
    dinnerAgniMod = 12;
    dinnerSleepMod = 5;
  }

  // 5. CALCULATE SIMULATED SCORES
  const simAgni = Math.max(25, Math.min(98, Math.round(baseAgni + (hydrationMod * 0.4) + exerciseAgniMod + dinnerAgniMod)));
  const simOjas = Math.max(30, Math.min(98, Math.round(baseOjas + ojasSleepMod + (habits.exerciseMinutes > 75 ? -8 : 4) + (habits.dinnerHour >= 22 ? -10 : 3))));
  const simRecovery = Math.max(20, Math.min(98, Math.round(baseRecovery + recSleepMod + (habits.hydrationLitres < 1.5 ? -8 : 5) + (habits.exerciseMinutes > 75 ? -12 : 4))));
  const simEnergy = Math.max(25, Math.min(98, Math.round(baseEnergy + (sleepDiff * 4) + exerciseEnergyMod + (dinnerHourDiff > 2 ? -10 : 3))));

  // 6. DOSHA CONSTITUTION MORPH
  let simVata = baseVata;
  let simPitta = basePitta;
  let simKapha = baseKapha;

  // Sleep deprivation aggregates Vata dryness
  if (habits.sleepHours < 6) {
    simVata += 12;
    simKapha -= 8;
  }
  // Over-sleeping aggregates Kapha heaviness
  if (habits.sleepHours > 9) {
    simKapha += 10;
    simVata -= 6;
  }
  // Low hydration aggregates Vata dryness
  if (habits.hydrationLitres < 1.5) {
    simVata += 10;
    simPitta += 4;
  }
  // Excess exercise aggregates Vata dispersion
  if (habits.exerciseMinutes > 60) {
    simVata += 8;
  }
  // Late-night dinner aggregates Pitta acidity and Kapha sluggishness
  if (habits.dinnerHour >= 22) {
    simPitta += 12;
    simKapha += 6;
    simVata -= 8;
  }

  // Normalize dosha totals to 100%
  const totalSim = simVata + simPitta + simKapha;
  const finalVata = Math.round((simVata / totalSim) * 100);
  const finalPitta = Math.round((simPitta / totalSim) * 100);
  const finalKapha = 100 - finalVata - finalPitta;

  const maxVal = Math.max(finalVata, finalPitta, finalKapha);
  let dominantAggravation = 'Balanced';
  if (maxVal > 38) {
    dominantAggravation = maxVal === finalVata ? 'Vata' : maxVal === finalPitta ? 'Pitta' : 'Kapha';
  }

  return {
    recovery: { base: baseRecovery, simulated: simRecovery, delta: simRecovery - baseRecovery },
    energy: { base: baseEnergy, simulated: simEnergy, delta: simEnergy - baseEnergy },
    sleepQuality: { base: baseSleepQuality, simulated: simSleepQuality, delta: simSleepQuality - baseSleepQuality },
    agni: { base: baseAgni, simulated: simAgni, delta: simAgni - baseAgni },
    ojas: { base: baseOjas, simulated: simOjas, delta: simOjas - baseOjas },
    dosha: {
      base: { vata: baseVata, pitta: basePitta, kapha: baseKapha },
      simulated: { vata: finalVata, pitta: finalPitta, kapha: finalKapha }
    },
    dominantAggravation
  };
}
