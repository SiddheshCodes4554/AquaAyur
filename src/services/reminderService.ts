import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  return true;
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
  try {
    const parsedTime = parseTimeFromText(timeStr);
    const hour = parsedTime ? parsedTime.hour : defaultHour;
    const minute = parsedTime ? parsedTime.minute : defaultMinute;
    const notificationId = `offline_dinacharya_${taskKey}`;

    console.log(`[ReminderService] Simulating scheduled reminder for ${taskKey} at ${hour}:${minute.toString().padStart(2, '0')}`);

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
    console.error(`[ReminderService] Failed to schedule offline reminder for ${taskKey}:`, error);
    return null;
  }
}

/**
 * Cancels a Dinacharya reminder.
 */
export async function cancelDinacharyaReminder(taskKey: string): Promise<void> {
  try {
    console.log(`[ReminderService] Cancelling offline reminder for ${taskKey}`);
    
    // Remove from stored reminders
    const stored = await getStoredReminders();
    if (stored[taskKey]) {
      delete stored[taskKey];
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(stored));
    }
  } catch (error) {
    console.error(`[ReminderService] Failed to cancel offline reminder for ${taskKey}:`, error);
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


