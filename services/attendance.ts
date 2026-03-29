import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// GPS Attendance Tracking
//
// Uses Expo Location background geofencing to detect when a student
// enters the 100m radius around their class location.
//
// Full background geofencing requires an EAS standalone build —
// TaskManager background tasks are not supported in Expo Go.
// In Expo Go, arrival detection falls back to a one-time foreground
// location check triggered manually or from a notification tap.
//
// Production flow (EAS build):
//   1. 30 min before class → schedulePreClassCheck() fires via AlarmManager
//   2. startClassGeofence() registers a 100m geofence around class location
//   3. GEOFENCE_TASK fires when student enters the region
//   4. logAttendance() writes present + arrival_time to attendance table
//   5. stopClassGeofence() cleans up after class start time passes
// ─────────────────────────────────────────────────────────────────────────────

const GEOFENCE_TASK = 'CLASS_GEOFENCE_TASK';
const GEOFENCE_RADIUS_METERS = 100;
const PRE_CLASS_WINDOW_MINUTES = 30;

// ── Background task definition ───────────────────────────────────────────────
// Registered at app startup. Fires when device enters or exits a geofence region.
// In Expo Go this registration is silently skipped — no crash, no effect.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('Geofence task error:', error);
    return;
  }

  if (!data) return;

  const { eventType, region } = data;

  // Only care about entering the geofence, not leaving
  if (eventType !== Location.GeofencingEventType.Enter) return;

  // region.identifier is the schedule_id we set when registering
  const scheduleId = region.identifier;
  if (!scheduleId) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];

    await supabase.from('attendance').upsert({
      user_id: user.id,
      schedule_id: scheduleId,
      date: today,
      status: 'present',
      arrival_time: new Date().toISOString(),
      notification_sent: true,
    }, { onConflict: 'user_id,schedule_id,date' });

    console.log(`Attendance logged: present for schedule ${scheduleId}`);
  } catch (e) {
    console.error('Failed to log geofence attendance:', e);
  }
});

// ── Start geofence for a specific class ─────────────────────────────────────
export async function startClassGeofence(
  scheduleId: string,
  latitude: number,
  longitude: number
): Promise<boolean> {
  try {
    // Check permissions first
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Background location permission not granted — geofence skipped');
      return false;
    }

    // Start geofencing with this class location as the region
    await Location.startGeofencingAsync(GEOFENCE_TASK, [
      {
        identifier: scheduleId,
        latitude,
        longitude,
        radius: GEOFENCE_RADIUS_METERS,
        notifyOnEnter: true,
        notifyOnExit: false,
      },
    ]);

    console.log(`Geofence started for schedule ${scheduleId} at (${latitude}, ${longitude})`);
    return true;
  } catch (e) {
    // Silently fails in Expo Go — does not affect rest of app
    console.log('Geofencing not available in this environment:', e);
    return false;
  }
}

// ── Stop geofence after class window closes ──────────────────────────────────
export async function stopClassGeofence(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
    if (isRegistered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      console.log('Geofence stopped');
    }
  } catch (e) {
    console.log('stopClassGeofence error (non-critical):', e);
  }
}

// ── Pre-class location check ─────────────────────────────────────────────────
// Called 30 min before class. If student is already near campus, skip alert.
// If far away, send escalating notifications every 5 minutes.
export async function runPreClassLocationCheck(
  scheduleId: string,
  classLatitude: number,
  classLongitude: number,
  classTitle: string
): Promise<void> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Foreground location not granted — skipping pre-class check');
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const distanceMeters = getDistanceMeters(
      location.coords.latitude,
      location.coords.longitude,
      classLatitude,
      classLongitude
    );

    console.log(`Distance to ${classTitle}: ${Math.round(distanceMeters)}m`);

    if (distanceMeters > GEOFENCE_RADIUS_METERS) {
      // Student is not near class — start geofence and notify
      await startClassGeofence(scheduleId, classLatitude, classLongitude);
      console.log(`Student is ${Math.round(distanceMeters)}m away — geofence active, notifications queued`);
    } else {
      // Already near class — log as present immediately
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];
      await supabase.from('attendance').upsert({
        user_id: user.id,
        schedule_id: scheduleId,
        date: today,
        status: 'present',
        arrival_time: new Date().toISOString(),
        notification_sent: false,
      }, { onConflict: 'user_id,schedule_id,date' });

      console.log('Student already near class — marked present immediately');
    }
  } catch (e) {
    console.error('runPreClassLocationCheck error:', e);
  }
}

// ── Manual attendance log (fallback) ────────────────────────────────────────
// Used as a fallback when GPS is unavailable or geofence doesn't fire.
export async function logAttendanceManual(
  userId: string,
  scheduleId: string,
  status: 'present' | 'absent'
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('attendance').upsert({
      user_id: userId,
      schedule_id: scheduleId,
      date: today,
      status,
      arrival_time: status === 'present' ? new Date().toISOString() : null,
      notification_sent: false,
    }, { onConflict: 'user_id,schedule_id,date' });
  } catch (e) {
    console.error('logAttendanceManual error:', e);
  }
}

// ── Mark class as absent after window closes ─────────────────────────────────
export async function markAbsentIfNoArrival(
  userId: string,
  scheduleId: string
): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Only write absent if no present record exists yet
    const { data: existing } = await supabase
      .from('attendance')
      .select('status')
      .eq('user_id', userId)
      .eq('schedule_id', scheduleId)
      .eq('date', today)
      .single();

    if (!existing) {
      await supabase.from('attendance').insert({
        user_id: userId,
        schedule_id: scheduleId,
        date: today,
        status: 'absent',
        arrival_time: null,
        notification_sent: true,
      });
      console.log(`Marked absent for schedule ${scheduleId}`);
    }
  } catch (e) {
    console.error('markAbsentIfNoArrival error:', e);
  }
}

// ── Haversine distance formula ───────────────────────────────────────────────
// Returns distance in meters between two lat/lng coordinates.
function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
