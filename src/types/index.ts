import { Device } from 'react-native-ble-plx';

// =========================================================================
// AUTH & PROFILE TYPES
// =========================================================================

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  weight_kg: number | null;
  height_cm: number | null;
  dominant_dosha: 'vata' | 'pitta' | 'kapha' | 'dual_vata_pitta' | 'dual_pitta_kapha' | 'dual_vata_kapha' | 'tridoshic' | null;
  daily_water_goal_ml: number;
  daily_calorie_goal_kcal: number;
}

// =========================================================================
// BLE & BIOMETRICS TYPES
// =========================================================================

export type ConnectionStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'disconnecting' | 'error';

export interface LiveBiometrics {
  heartRate: number;
  temperature: number;
  steps: number;
  activity: string;
  timestamp: Date;
}

// =========================================================================
// DATABASE CACHE TYPES
// =========================================================================

export interface OfflineTelemetry {
  id: string;
  timestamp: string;
  heart_rate: number;
  skin_temperature: number;
  steps: number;
  activity: string;
}

export interface HeartRateLog {
  id: string;
  user_id: string;
  timestamp: string;
  bpm: number;
  hrv_ms?: number | null;
}

export interface TemperatureLog {
  id: string;
  user_id: string;
  timestamp: string;
  temperature_celsius: number;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  timestamp: string;
  steps_count: number;
  calories_burned_kcal: number;
  activity_type: string;
}

export interface OfflineHydration {
  id: string;
  timestamp: string;
  amount_ml: number;
  source: string;
}

// =========================================================================
// FOOD & NUTRITION TYPES
// =========================================================================

export interface FoodLogRecord {
  id: string;
  meal_type: string;
  food_name: string;
  quantity_g: number;
  calories_kcal: number;
  timestamp: string;
}

// =========================================================================
// AI & REPORT TYPES
// =========================================================================

export interface RecommendationLog {
  id: string;
  timestamp: string;
  recommendation_text: string;
  ayurvedic_insights: string;
  feedback_rating: number | null;
}

export interface SleepLog {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  deep_sleep_minutes?: number | null;
  light_sleep_minutes?: number | null;
  rem_sleep_minutes?: number | null;
  awake_minutes?: number | null;
  sleep_score: number;
}

export interface OfflineSleep {
  id: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  sleep_score: number;
}

export interface HealthReportRecord {
  id: string;
  created_at: string;
  report_type: 'weekly' | 'monthly';
  start_date: string;
  end_date: string;
  summary_markdown: string;
  pdf_storage_path: string | null;
}
