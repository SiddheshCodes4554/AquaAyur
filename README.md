# AquaAyur 🌿📱

AquaAyur is a modern, production-ready mobile health and wellness platform built on **React Native (Expo)**, **TypeScript**, **Zustand**, **SQLite**, **Supabase (Postgres)**, and **Groq AI**. 

It merges the ancient medical wisdom of **Ayurveda** (Dosha assessment, tastes, lifestyle corrections) with state-of-the-art **IoT biometrics** streamed via Bluetooth Low Energy (BLE) from an ESP32 wearable sensor suite.

---

## 🚀 What We Have Built (System Features)

### 📊 1. Intelligent Health & Recovery Dashboard (`index.tsx`)
- **Dynamic Wellness Index:** Calculates a daily Health & Recovery Index dynamically by pulling the user's last 24-48 hours of average heart rate, skin temperature, and sleep scores.
- **Trend Indexing:** Compares active metrics against yesterday's benchmarks (e.g. `+4 points vs yesterday`) to show immediate health trajectory.
- **Ayurvedic Recommendation Engine:** Suggests real-time personalized daily recommendations depending on biometric states (e.g. balancing Pitta if skin temperature rises, or grounding Vata if heart rate fluctuates).
- **Offline Logger Modals:** Log sleep duration, bedtime, and wake times offline which queue automatically for cloud syncing.

### 💬 2. Personal AI Ayurvedic Coach Chat (`coach.tsx`)
- **Conversational Expert:** Chat directly with an AI coach loaded with Ayurvedic texts. It uses Llama3 via Groq to answer dietary, herbal, and daily routine questions.
- **Structured Cards UI:** Features rich interactive cards (e.g., `[card: ...]`) displaying custom insights, recommended routines, or recipes.
- **Automatic Output Sanitizing:** Sanitizes messages by stripping markdown ticks, cleaning trailing tags, parsing raw JSON responses, and converting lists to clean, human-readable bold bullet points.

### 🌐 3. ESP32 Wearable Bluetooth Low Energy Integration (`device.tsx` / `bleManager.ts`)
- **Real-Time Data Streaming:** Connects to the custom AquaAyur wearable to stream live telemetry (Heart Rate, Skin Temperature, Steps, and active Activity state).
- **Persistent Pairing Profiles:** Persists paired hardware details (MAC address and friendly name) to the backend database.
- **Manual Autoconnect:** Restores connection to the previously paired wearable immediately on app start or upon explicit trigger via the **Previously Paired Device** dashboard card.
- **Robust Cancellation Interceptors:** Case-insensitive check filters that catch and suppress native `BleError: Operation was cancelled` and `BleError: BleManager was destroyed` messages when connections are cleanly cancelled or the app context unmounts.
- **Permissions Module:** Fully handles Android 12+ scan, connect, and legacy location permissions dynamically.

### 🍽️ 4. AI Food Journal & Analysis (`food-analysis.tsx` / `food-journal.tsx`)
- **Smart Calorie Tracker:** Log foods, meal times (Breakfast, Lunch, Dinner, Snack), and portion sizes.
- **Ayurvedic Taste & Dosha Mapping:** AI-powered analysis resolves the Ayurvedic taste (Sweet, Sour, Salty, Bitter, Pungent, Astringent) and outlines its positive or negative effects on the user's dominant Dosha.
- **OCR Scanner:** Features a nutrition label camera scanner to analyze macronutrients (Carbs, Protein, Fat, Fiber) and log entries instantly.

### 📈 5. Weekly Analytics & Groq Reports (`insights.tsx`)
- **Auto-Compilation:** Checks if the user has biometric logs but no report, and automatically compiles their initial week-long wellness overview using Groq Llama3 analysis.
- **Historical Trends:** Dynamic line graphs rendering metrics (Heart Rate, Skin Temperature, Steps, Sleep) across the last 7 days.
- **Baseline Normalization:** Normalizes missing data using overall historical telemetry averages rather than generic hardcoded values.

### 🔄 6. Reliable Offline Sync Manager (`syncManager.ts` / `database.ts`)
- **Local Cache Queuing:** Writes data to a local SQLite database (`expo-sqlite`) using Write-Ahead Logging (WAL) when offline.
- **Auto-Sync Trigger:** Syncs cached telemetry, sleep, and hydration logs automatically to Supabase tables once internet connectivity is restored.
- **Constraint Boundaries Filter:** Coerces and sanitizes heart rates (filtering out 0 or >300 bpm) and temperatures to strictly satisfy Postgres check constraints, preventing insertion failures.

---

## 🛠️ Technology Stack & Libraries

| Dependency | Purpose |
| :--- | :--- |
| **Expo Router v56.0.0** | Native routing using a file-based structure. |
| **React Native (TypeScript)** | Main development environment. |
| **NativeWind & Tailwind CSS** | Unified responsive styling engine. |
| **react-native-ble-plx** | Handles Bluetooth Low Energy interactions, scans, and subscriptions. |
| **expo-sqlite** | Fast local SQLite database for offline buffering. |
| **Supabase JS Client** | Handles user authentication, profile queries, and remote storage. |
| **@groq/sdk** | Connects to high-performance Llama3 endpoints for OCR, chat, and reports. |
| **react-native-safe-area-context** | SafeArea inset calculators for multiple screen sizes. |

---

## 📂 Codebase Directory Structure

```text
Ayurveda/
├── assets/                     # App icons, splash screens, and static image assets
├── supabase_complete_schema.sql # Master Postgres DDL tables & triggers migration script
└── src/
    ├── app/                    # Expo Router file-based screens
    │   ├── _layout.tsx         # App wrapper, initialization, & route guard control flow
    │   ├── (auth)/             # Login, Reset Password, and Dosha Quiz Onboarding
    │   └── (tabs)/             # Main app routes (Index, Coach, Device, Food, Insights, Settings)
    ├── components/             # Reusable UI widgets
    │   ├── MetricTrendChart.tsx # SVG line charts showing health metrics
    │   ├── animated-icon.tsx   # micro-animated tab bar icons
    │   └── themed-view.tsx     # custom container wrapping safe margins
    ├── services/               # Underlying application services
    │   ├── bleManager.ts       # Bluetooth connection, read/writes, and subscription handlers
    │   ├── database.ts         # SQLite instance initialization & insertion helpers
    │   ├── syncManager.ts      # NetInfo event listeners & SQLite -> Supabase push routines
    │   ├── aiCoachService.ts   # Chat completions interface using Groq SDK
    │   └── sensorManager.ts    # Manages simulation modes & sensor profiles
    ├── store/                  # Zustand global state modules
    │   ├── useAuthStore.ts     # User sessions & Supabase auth tokens
    │   ├── useBLEStore.ts      # Biometrics, live monitor charts, & BLE state
    │   ├── useSleepStore.ts    # Sleep logs, duration scoring, & local triggers
    │   └── useTelemetryStore.ts# Week-long telemetry caching for index metrics
    ├── types/                  # Shared TypeScript type definitions
    └── utils/                  # Safe validation and string decoder utilities
```

---

## 🗄️ Database Schemas

### ☁️ Supabase Cloud (PostgreSQL)
The backend utilizes PostgreSQL with Row Level Security (RLS) policies. Every table is bound to `auth.uid() = user_id`.

1. **`profiles`**: User birthdate, gender, weight, height, daily water/calorie goals, and `dominant_dosha` (Vata, Pitta, Kapha, Tridoshic).
2. **`devices` & `pairings`**: Stored MAC addresses and pairing status matching users to wearables.
3. **`heart_rate_logs`**: Timestamps, heart rates, and HRV values. Restricted to `bpm > 0 and bpm < 300`.
4. **`temperature_logs`**: Skin temperatures restricted to `temperature_celsius > 30.0 and temperature_celsius < 45.0`.
5. **`activity_logs`**: Step metrics, calorie estimations, and classifications (Yoga, Walking, Running, Sedentary).
6. **`sleep_logs`**: Bedtime, wake time, sleep stages (Deep, Light, REM, Awake), and duration.
7. **`hydration_logs`**: Hydration increments in mL, tracking source context.
8. **`food_logs` & `nutrition_analysis`**: Logged meals connected to macronutrient levels and Ayurvedic qualities.
9. **`ai_insights` & `chat_history`**: Cached weekly analysis results and chat histories.

### 💾 Local Device (SQLite)
Maintained using `expo-sqlite` to allow writing telemetry and caching logs when the user is disconnected:
- **`offline_telemetry`**: `(id, timestamp, heart_rate, skin_temperature, steps, activity)`
- **`offline_hydration`**: `(id, timestamp, amount_ml, source)`
- **`offline_sleep`**: `(id, start_time, end_time, duration_minutes, sleep_score)`

---

## ⚙️ Installation & Setup

### Prerequisites
- Node.js (v18+)
- Android SDK / Android Studio (to run on Android devices/emulators)
- iOS CocoaPods & Xcode (if running on iOS)

### Installation
1. Clone the project and install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory and add your keys:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   EXPO_PUBLIC_GROQ_API_KEY=your-groq-api-key
   ```

3. Initialize your local Android build profile:
   ```bash
   npx expo run:android
   ```

4. Run the development environment:
   ```bash
   npm run dev
   ```

---

## 💡 Key Architectural Details

### ⚠️ Android TextInput Casing Crash
Android's native `TextInput` crashes if `fontFamily` receives an array fallback (e.g. `['monospace', 'sans-serif']` compiled by NativeWind from `font-mono`). To prevent this, the input elements in the sleep modal and food inputs use an inline style bypass:
```tsx
style={{ fontFamily: 'monospace' }}
```

### 🚨 NativeWind ClassName Warnings
Dynamic/conditional rendering toggling spacing classes (like `mb-6`) sometimes triggers NativeWind reset warnings. We resolved this by:
1. Adding unique `key` parameters to conditional siblings.
2. Adding `will-change-variable` class modifiers to warning-prone nodes.

### 🛡️ BLE Stream Cancellation Handling
When a device is explicitly disconnected, the monitor subscription triggers a callback with `BleError`. We intercept this error, inspect it, and suppress standard warnings when the connection is cancelled cleanly:
```typescript
const errMsg = (error.message || '').toLowerCase();
if (
  errMsg.includes('cancelled') ||
  errMsg.includes('canceled') ||
  errMsg.includes('destroyed') ||
  error.errorCode === BleErrorCode.OperationCancelled ||
  error.errorCode === BleErrorCode.BluetoothManagerDestroyed
) {
  console.log('[BLE] Streaming monitor subscription cancelled cleanly.');
  return;
}
```
