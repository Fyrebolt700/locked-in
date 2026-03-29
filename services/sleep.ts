import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// ---- DND ----
// React Native / Expo has no direct DND API.
// We simulate it by cancelling all scheduled notifications at bedtime
// and rescheduling them at wake time.
// True DND requires a native module — not available in Expo Go.
// For the demo, this cancels all notifications as a stand-in.

export async function activateBedtimeDND(userId: string, bedtime: string) {
  try {
    // Cancel all pending notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Log to sleep_logs
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('sleep_logs')
      .upsert({
        user_id: userId,
        date: today,
        bedtime_set: bedtime,
        dnd_activated: true,
        phone_used_after_bedtime: false,
        minutes_used_after_bedtime: 0,
      }, { onConflict: 'user_id,date' });

    if (error) throw error;
  } catch (e) {
    console.error('activateBedtimeDND error:', e);
  }
}

export async function logMorningScreenTime(userId: string, minutesUsed: number) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('sleep_logs')
      .upsert({
        user_id: userId,
        date: today,
        phone_used_after_bedtime: minutesUsed > 0,
        minutes_used_after_bedtime: minutesUsed,
      }, { onConflict: 'user_id,date' });

    if (error) throw error;
  } catch (e) {
    console.error('logMorningScreenTime error:', e);
  }
}

export async function scheduleBedtimeNotification(bedtime: string) {
  // bedtime is "HH:MM" format
  const [hours, minutes] = bedtime.split(':').map(Number);

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to wind down',
      body: 'Locked In is enabling Do Not Disturb. Put the phone down.',
      sound: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });
}

export async function scheduleWakeNotification(wakeTime: string) {
  const [hours, minutes] = wakeTime.split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good morning',
      body: "Here's what you have today.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });
}

// PACKAGE_USAGE_STATS is Android-only and requires a native module
// not available in Expo Go. This is a placeholder that returns 0
// for the demo. In a standalone EAS build you'd use
// react-native-device-info or a custom native module to read it.
export async function readScreenTimeAfterBedtime(bedtime: string): Promise<number> {
  console.log('Screen time reading not available in Expo Go — returning 0');
  return 0;
}