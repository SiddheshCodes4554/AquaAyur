import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior for when the app is foregrounded
try {
  if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('[ReminderService] Failed to set notification handler:', e);
}

const REMINDERS_KEY = '@ayurveda:scheduled_reminders';

export interface ScheduledReminder {
  taskKey: string;
  timeStr: string;
  hour: number;
  minute: number;
  notificationId: string;
}

/**
 * Attempts to parse a time (e.g. "6:00 AM", "12:30 PM") from text.
 */
export function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  if (!text) return null;
  // Match patterns like "5:30 AM", "12:00 PM", "6:00 AM"
  const match = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute };
  }
  
  // Fallbacks if no exact minute match
  const hourMatch = text.match(/(\d{1,2})\s*(AM|PM)/i);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1], 10);
    const period = hourMatch[2].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return { hour, minute: 0 };
  }

  return null;
}

/**
 * Requests permissions for local notifications.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  } catch (error) {
    console.error('[ReminderService] Error requesting permissions:', error);
    return false;
  }
}

/**
 * Schedules a daily local notification reminder for a specific Dinacharya task.
 */
export async function scheduleDinacharyaReminder(
  taskKey: string,
  title: string,
  body: string,
  timeStr: string,
  defaultHour: number = 8,
  defaultMinute: number = 0
): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[ReminderService] Notifications not supported on Web');
    return `web_sim_${taskKey}`;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('[ReminderService] Notification permissions denied. Cannot schedule.');
      return null;
    }

    // Cancel existing reminder first
    const notificationId = `dinacharya_${taskKey}`;
    await cancelDinacharyaReminder(taskKey);

    // Parse time
    const parsedTime = parseTimeFromText(timeStr);
    const hour = parsedTime ? parsedTime.hour : defaultHour;
    const minute = parsedTime ? parsedTime.minute : defaultMinute;

    console.log(`[ReminderService] Scheduling reminder for ${taskKey} at ${hour}:${minute.toString().padStart(2, '0')}`);

    // Schedule notification
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId,
      content: {
        title: title,
        body: body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
    });

    // Save reminder state locally
    const stored = await getStoredReminders();
    stored[taskKey] = {
      taskKey,
      timeStr,
      hour,
      minute,
      notificationId,
    };
    await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(stored));

    return notificationId;
  } catch (error) {
    console.error(`[ReminderService] Failed to schedule reminder for ${taskKey}:`, error);
    return null;
  }
}

/**
 * Cancels a Dinacharya reminder.
 */
export async function cancelDinacharyaReminder(taskKey: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const notificationId = `dinacharya_${taskKey}`;
    await Notifications.cancelScheduledNotificationAsync(notificationId);

    // Remove from stored reminders
    const stored = await getStoredReminders();
    if (stored[taskKey]) {
      delete stored[taskKey];
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(stored));
    }
  } catch (error) {
    console.error(`[ReminderService] Failed to cancel reminder for ${taskKey}:`, error);
  }
}

/**
 * Gets all stored reminders.
 */
export async function getStoredReminders(): Promise<Record<string, ScheduledReminder>> {
  try {
    const data = await AsyncStorage.getItem(REMINDERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('[ReminderService] Error getting stored reminders:', error);
    return {};
  }
}
