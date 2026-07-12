import { useSensorStore, SimulatorSettings, SensorData, ActivityType } from '../store/useSensorStore';
import { batchInsertLocalTelemetry } from './database';
import { triggerSync } from './syncManager';

let simulationInterval: any = null;
let databaseFlushInterval: any = null;

// Physiological internal trackers (actual values)
let actualHR = 72;
let actualTemp = 36.5;
let actualSteps = 4200;
let actualStress = 30;
let actualHydration = 80;
let actualBattery = 100;

// Memory buffer for database persistence (similar to BLE)
let simulatedBuffer: { timestamp: string; heart_rate: number; skin_temperature: number; steps: number; activity: string }[] = [];
let lastSyncTimestamp = 0;

export const PRESETS: Record<string, Partial<SimulatorSettings>> = {
  Walking: {
    heartRate: 90,
    activity: 'Walking',
    stress: 35,
    hydration: 75,
    autoIncrementSteps: true
  },
  Running: {
    heartRate: 145,
    activity: 'Running',
    stress: 55,
    hydration: 60,
    autoIncrementSteps: true
  },
  Sleeping: {
    heartRate: 60,
    activity: 'Sleeping',
    stress: 15,
    sleepQuality: 92,
    autoIncrementSteps: false
  },
  Meditating: {
    heartRate: 58,
    activity: 'Meditating',
    stress: 10,
    autoIncrementSteps: false
  },
  'Work Mode': {
    heartRate: 74,
    activity: 'Resting',
    stress: 65,
    autoIncrementSteps: false
  },
  'Exercise Mode': {
    heartRate: 125,
    activity: 'Cycling',
    stress: 45,
    autoIncrementSteps: true
  },
  'Recovery Mode': {
    heartRate: 64,
    activity: 'Resting',
    stress: 20,
    autoIncrementSteps: false
  }
};

export const SCENARIOS: Record<string, Partial<SimulatorSettings>> = {
  'Healthy Adult': {
    heartRate: 70,
    temperature: 36.5,
    steps: 5400,
    activity: 'Resting',
    battery: 95,
    sleepQuality: 85,
    stress: 30,
    hydration: 80,
    connectionQuality: 100,
    autoIncrementSteps: false
  },
  'Office Worker': {
    heartRate: 78,
    temperature: 36.6,
    steps: 1200,
    activity: 'Resting',
    battery: 88,
    sleepQuality: 55,
    stress: 70,
    hydration: 45,
    connectionQuality: 95,
    autoIncrementSteps: false
  },
  Athlete: {
    heartRate: 54,
    temperature: 36.3,
    steps: 12500,
    activity: 'Walking',
    battery: 92,
    sleepQuality: 94,
    stress: 15,
    hydration: 90,
    connectionQuality: 100,
    autoIncrementSteps: true
  },
  'Poor Sleep': {
    heartRate: 82,
    temperature: 36.7,
    steps: 3200,
    activity: 'Resting',
    battery: 75,
    sleepQuality: 40,
    stress: 60,
    hydration: 65,
    connectionQuality: 90,
    autoIncrementSteps: false
  },
  Dehydrated: {
    heartRate: 84,
    temperature: 37.1,
    steps: 4100,
    activity: 'Resting',
    battery: 80,
    sleepQuality: 70,
    stress: 55,
    hydration: 15,
    connectionQuality: 85,
    autoIncrementSteps: false
  },
  'High Stress': {
    heartRate: 95,
    temperature: 36.9,
    steps: 2800,
    activity: 'Resting',
    battery: 78,
    sleepQuality: 48,
    stress: 85,
    hydration: 50,
    connectionQuality: 90,
    autoIncrementSteps: false
  },
  'Recovery Day': {
    heartRate: 62,
    temperature: 36.4,
    steps: 2000,
    activity: 'Meditating',
    battery: 90,
    sleepQuality: 88,
    stress: 18,
    hydration: 85,
    connectionQuality: 100,
    autoIncrementSteps: false
  },
  'Fever Simulation': {
    heartRate: 112,
    temperature: 38.9,
    steps: 50,
    activity: 'Sleeping',
    battery: 65,
    sleepQuality: 35,
    stress: 80,
    hydration: 30,
    connectionQuality: 80,
    autoIncrementSteps: false
  },
  'Long Walk': {
    heartRate: 98,
    temperature: 36.8,
    steps: 9200,
    activity: 'Walking',
    battery: 70,
    sleepQuality: 80,
    stress: 30,
    hydration: 55,
    connectionQuality: 95,
    autoIncrementSteps: true
  },
  'Morning Routine': {
    heartRate: 75,
    temperature: 36.5,
    steps: 2300,
    activity: 'Walking',
    battery: 99,
    sleepQuality: 82,
    stress: 25,
    hydration: 95,
    connectionQuality: 100,
    autoIncrementSteps: true
  }
};

/**
 * Starts the interval simulation loops.
 */
export function startSimulatorStream(): void {
  if (simulationInterval) return;

  const store = useSensorStore.getState();
  
  // Set initial actual values from store settings
  actualHR = store.simulatorSettings.heartRate;
  actualTemp = store.simulatorSettings.temperature;
  actualSteps = store.simulatorSettings.steps;
  actualStress = store.simulatorSettings.stress;
  actualHydration = store.simulatorSettings.hydration;
  actualBattery = store.simulatorSettings.battery;

  store.setStatus('connected');
  store.resetUptimeAndPackets();

  // 1. Telemetry loop (every 1 second)
  simulationInterval = setInterval(() => {
    tickSimulation();
  }, 1000);

  // 2. Database batch flush loop (every 15 seconds)
  databaseFlushInterval = setInterval(async () => {
    await flushSimulatedBuffer();
  }, 15000);

  console.log('[Simulator] Virtual wearable streaming activated.');
}

/**
 * Stops simulation loops.
 */
export function stopSimulatorStream(): void {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (databaseFlushInterval) {
    clearInterval(databaseFlushInterval);
    databaseFlushInterval = null;
  }
  
  // Flush final records
  flushSimulatedBuffer().catch(err => console.error('[Simulator] Buffer flush failed during stop:', err));

  const store = useSensorStore.getState();
  store.setStatus('idle');
  store.setLiveData(null);
  console.log('[Simulator] Virtual wearable streaming stopped.');
}

/**
 * Simulation mathematical trend step calculation.
 */
function tickSimulation(): void {
  const store = useSensorStore.getState();
  const settings = store.simulatorSettings;

  if (settings.isPaused) return;

  // 1. Gradual physiological shifts (Smoothing transition toward sliders target)
  
  // Heart rate (gradual approach + minor biological heartbeat jitter)
  const hrTarget = settings.heartRate;
  const hrDelta = hrTarget - actualHR;
  actualHR += hrDelta * 0.12 + (Math.random() - 0.5) * 1.6;
  actualHR = Math.max(50, Math.min(180, actualHR));

  // Temperature (extremely slow biological changes)
  const tempTarget = settings.temperature;
  const tempDelta = tempTarget - actualTemp;
  actualTemp += tempDelta * 0.03 + (Math.random() - 0.5) * 0.02;
  actualTemp = Math.max(34, Math.min(41, actualTemp));

  // Stress
  const stressTarget = settings.stress;
  const stressDelta = stressTarget - actualStress;
  actualStress += stressDelta * 0.08 + (Math.random() - 0.5) * 1.1;
  actualStress = Math.max(0, Math.min(100, actualStress));

  // Hydration loss over time based on activity exertion
  let hydrationLoss = 0.003; // baseline rest loss per second
  if (settings.activity === 'Running') hydrationLoss = 0.025;
  else if (settings.activity === 'Walking' || settings.activity === 'Cycling') hydrationLoss = 0.012;
  
  actualHydration = Math.max(0, actualHydration - hydrationLoss);
  
  // Battery drain rate over time
  let batteryDrain = 0.003;
  if (settings.activity === 'Running') batteryDrain = 0.015;
  else if (settings.activity === 'Sleeping') batteryDrain = 0.001;
  
  actualBattery = Math.max(0, actualBattery - batteryDrain);

  // Steps updates depending on activity state
  if (settings.activity === 'Running') {
    actualSteps += 22 + Math.floor(Math.random() * 8);
  } else if (settings.activity === 'Walking') {
    actualSteps += 8 + Math.floor(Math.random() * 4);
  } else if (settings.activity === 'Cycling') {
    actualSteps += 14 + Math.floor(Math.random() * 6);
  } else if (settings.autoIncrementSteps) {
    actualSteps += 1;
  }

  // 2. Synchronize calculated settings back to the store so sliders move in UI
  store.updateSimulatorSetting('heartRate', Math.round(actualHR));
  store.updateSimulatorSetting('temperature', Number(actualTemp.toFixed(2)));
  store.updateSimulatorSetting('stress', Math.round(actualStress));
  store.updateSimulatorSetting('hydration', Math.round(actualHydration));
  store.updateSimulatorSetting('battery', Math.round(actualBattery));
  store.updateSimulatorSetting('steps', Math.round(actualSteps));

  // 3. Assemble standard SensorData payload (same structure as hardware BLE)
  const timestampStr = new Date().toISOString();
  const sensorPayload: SensorData = {
    heartRate: Math.round(actualHR),
    temperature: Number(actualTemp.toFixed(2)),
    steps: Math.round(actualSteps),
    activity: settings.activity.toLowerCase() === 'resting' ? 'sedentary' : settings.activity.toLowerCase(),
    sleep: Math.round(settings.sleepQuality),
    stress: Math.round(actualStress),
    hydration: Math.round(actualHydration),
    battery: Math.round(actualBattery),
    timestamp: timestampStr
  };

  store.setLiveData(sensorPayload);
  store.incrementPacket();
  store.tickUptime();

  // 4. Push to database buffer
  simulatedBuffer.push({
    timestamp: timestampStr,
    heart_rate: sensorPayload.heartRate,
    skin_temperature: sensorPayload.temperature,
    steps: sensorPayload.steps,
    activity: sensorPayload.activity
  });
}

/**
 * Flush simulated biometrics buffer to SQLite database.
 */
async function flushSimulatedBuffer(): Promise<void> {
  if (simulatedBuffer.length === 0) return;
  const records = [...simulatedBuffer];
  simulatedBuffer = [];

  console.log(`[Simulator] Flushing ${records.length} simulated logs to SQLite...`);
  try {
    await batchInsertLocalTelemetry(records);
    const now = Date.now();
    if (now - lastSyncTimestamp >= 60000) {
      lastSyncTimestamp = now;
      console.log('[Simulator] Running database sync task...');
      await triggerSync();
    }
  } catch (err) {
    console.error('[Simulator] Failed to commit logs to SQLite database:', err);
    // Put records back
    simulatedBuffer = [...records, ...simulatedBuffer];
  }
}

/**
 * Re-randomize sensor readings slightly.
 */
export function randomizeSimulatorValues(): void {
  actualHR = Math.max(50, Math.min(180, actualHR + (Math.random() - 0.5) * 15));
  actualTemp = Math.max(34, Math.min(41, actualTemp + (Math.random() - 0.5) * 0.5));
  actualStress = Math.max(0, Math.min(100, actualStress + (Math.random() - 0.5) * 10));
  actualHydration = Math.max(0, Math.min(100, actualHydration + (Math.random() - 0.5) * 8));
  
  const store = useSensorStore.getState();
  store.updateSimulatorSetting('heartRate', Math.round(actualHR));
  store.updateSimulatorSetting('temperature', Number(actualTemp.toFixed(2)));
  store.updateSimulatorSetting('stress', Math.round(actualStress));
  store.updateSimulatorSetting('hydration', Math.round(actualHydration));
}
