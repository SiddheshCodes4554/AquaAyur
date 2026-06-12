/**
 * Biometrics Data Validation Utility
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RawBiometricsPayload {
  heartRate?: any;
  temperature?: any;
  steps?: any;
  activity?: any;
  timestamp?: any;
}

export const VALID_ACTIVITIES = ['sedentary', 'walking', 'running', 'yoga', 'other', 'still'];

/**
 * Validates incoming BLE telemetry payload.
 * Expected schema:
 * {
 *   heartRate: number,
 *   temperature: number,
 *   steps: number,
 *   activity: string,
 *   timestamp: number
 * }
 */
export function validateBiometrics(payload: RawBiometricsPayload): ValidationResult {
  const errors: string[] = [];

  if (payload === null || typeof payload !== 'object') {
    return { isValid: false, errors: ['Payload must be a non-null object'] };
  }

  // 1. Heart Rate Validation
  if (payload.heartRate === undefined || payload.heartRate === null) {
    errors.push('heartRate is missing');
  } else {
    const hrVal = String(payload.heartRate).trim();
    if (hrVal === 'No Finger') {
      // Valid state: device is not on a finger
    } else {
      const hr = Number(hrVal);
      if (isNaN(hr)) {
        errors.push('heartRate must be a numeric value or "No Finger"');
      } else if (!Number.isInteger(hr)) {
        errors.push('heartRate must be an integer');
      } else if (hr !== 0 && (hr < 30 || hr > 220)) {
        errors.push(`heartRate (${hr}) is out of safe physiological range [30, 220] or 0`);
      }
    }
  }

  // 2. Temperature Validation
  if (payload.temperature === undefined || payload.temperature === null) {
    errors.push('temperature is missing');
  } else {
    const temp = Number(payload.temperature);
    if (isNaN(temp)) {
      errors.push('temperature must be a numeric value');
    } else if (temp < 30.0 || temp > 45.0) {
      errors.push(`temperature (${temp}) is out of safe physiological range [30.0, 45.0]`);
    }
  }

  // 3. Steps Validation
  if (payload.steps === undefined || payload.steps === null) {
    errors.push('steps is missing');
  } else {
    const steps = Number(payload.steps);
    if (isNaN(steps)) {
      errors.push('steps must be a numeric value');
    } else if (!Number.isInteger(steps)) {
      errors.push('steps must be an integer');
    } else if (steps < 0) {
      errors.push('steps must be a non-negative value');
    }
  }

  // 4. Activity Validation
  if (payload.activity === undefined || payload.activity === null) {
    errors.push('activity is missing');
  } else {
    const act = String(payload.activity).trim().toLowerCase();
    if (!VALID_ACTIVITIES.includes(act)) {
      errors.push(`activity ("${payload.activity}") must be one of: ${VALID_ACTIVITIES.join(', ')}`);
    }
  }

  // 5. Timestamp Validation
  if (payload.timestamp === undefined || payload.timestamp === null) {
    errors.push('timestamp is missing');
  } else {
    const ts = Number(payload.timestamp);
    if (isNaN(ts) || ts <= 0) {
      errors.push('timestamp must be a positive numeric epoch value');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
