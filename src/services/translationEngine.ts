import { 
  translationDictionary, 
  TranslationPayload, 
  LocaleType 
} from './translationDictionary';

/**
 * Translates the current Vata, Pitta, Kapha percentages to localized descriptions.
 */
export function getLocalizedDoshaState(
  vata: number,
  pitta: number,
  kapha: number,
  locale: LocaleType
): TranslationPayload {
  const dict = translationDictionary[locale] || translationDictionary.en;
  const max = Math.max(vata, pitta, kapha);

  if (max === vata && vata > 35) {
    return dict.doshas.vata.high;
  }
  if (max === pitta && pitta > 35) {
    return dict.doshas.pitta.high;
  }
  if (max === kapha && kapha > 35) {
    return dict.doshas.kapha.high;
  }

  return dict.doshas.balanced;
}

/**
 * Translates Agni metabolic fire index to localized description.
 */
export function getLocalizedAgni(
  score: number,
  locale: LocaleType
): { label: string; desc: string } {
  const dict = translationDictionary[locale] || translationDictionary.en;

  if (score < 65) {
    return dict.agni.slow;
  }
  if (score > 85) {
    return dict.agni.strong;
  }
  return dict.agni.steady;
}

/**
 * Translates Ojas cellular shield index to localized description.
 */
export function getLocalizedOjas(
  score: number,
  locale: LocaleType
): { label: string; desc: string } {
  const dict = translationDictionary[locale] || translationDictionary.en;

  if (score < 70) {
    return dict.ojas.recovery;
  }
  return dict.ojas.resilient;
}

/**
 * Translates heart rate (bpm) to localized description.
 */
export function getLocalizedHeartRate(
  bpm: number,
  locale: LocaleType
): string {
  const dict = translationDictionary[locale] || translationDictionary.en;
  if (bpm === 0) return locale === 'sa' ? 'Naadi labhyate na' : 'No readings';
  if (bpm < 60) return dict.vitals.heartRate.slow;
  if (bpm > 85) return dict.vitals.heartRate.active;
  return dict.vitals.heartRate.steady;
}

/**
 * Translates skin temperature to localized description.
 */
export function getLocalizedTemperature(
  temp: number,
  locale: LocaleType
): string {
  const dict = translationDictionary[locale] || translationDictionary.en;
  if (temp < 36.2) return dict.vitals.temperature.cool;
  if (temp > 37.2) return dict.vitals.temperature.warm;
  return dict.vitals.temperature.balanced;
}

/**
 * Translates movement steps to localized description.
 */
export function getLocalizedMovement(
  steps: number,
  locale: LocaleType
): string {
  const dict = translationDictionary[locale] || translationDictionary.en;
  if (steps === 0) return dict.vitals.movement.sedentary;
  if (steps < 2000) return dict.vitals.movement.relaxed;
  return dict.vitals.movement.active;
}
