import { supabase } from './supabase';

const WEIGHTS = {
  attendance: 0.25,
  assignments: 0.30,
  studyHours: 0.20,
  sleep: 0.15,
  extras: 0.10,
};

function getWeekEnd(weekStart: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

export async function calculateWeeklyScores(userId: string, weekStart: string) {
  const weekEnd = getWeekEnd(weekStart);

  // --- ATTENDANCE ---
  const { data: attendance } = await supabase
    .from('attendance')
    .select('status, schedule(start_time)')
    .eq('user_id', userId)
    .in('status', ['present', 'absent'])
    .gte('date', weekStart)
    .lt('date', weekEnd);

  const totalClasses = attendance?.length ?? 0;
  const presentClasses = attendance?.filter(a => a.status === 'present').length ?? 0;
  const attendanceScore = totalClasses === 0 ? 0 : Math.round((presentClasses / totalClasses) * 100);

  // --- ASSIGNMENTS ---
  const { data: assignments } = await supabase
    .from('assignments')
    .select('status, due_date, first_session_at, type')
    .eq('user_id', userId)
    .eq('type', 'assignment')
    .gte('due_date', weekStart)
    .lt('due_date', weekEnd);

  let assignmentsScore = 0;
  if (assignments && assignments.length > 0) {
    let points = 0;
    const max = assignments.length * 100;
    for (const a of assignments) {
      if (a.status === 'submitted') {
        points += 80;
        // bonus for starting 48hrs early
        if (a.first_session_at && a.due_date) {
          const hoursBeforeDue =
            (new Date(a.due_date).getTime() - new Date(a.first_session_at).getTime()) / 36e5;
          if (hoursBeforeDue >= 48) points += 20;
        }
      } else if (a.status === 'missed') {
        points += 0;
      } else {
        points += 40; // in_progress or pending but not missed
      }
    }
    assignmentsScore = Math.round((points / max) * 100);
  }

  // --- STUDY HOURS ---
  const { data: sessions } = await supabase
    .from('study_sessions')
    .select('planned_duration_min, actual_duration_min')
    .eq('user_id', userId)
    .gte('actual_start', weekStart)
    .lt('actual_start', weekEnd);

  const plannedMins = sessions?.reduce((sum, s) => sum + (s.planned_duration_min ?? 0), 0) ?? 0;
  const actualMins = sessions?.reduce((sum, s) => sum + (s.actual_duration_min ?? 0), 0) ?? 0;
  const studyHoursScore = plannedMins === 0 ? 0 : Math.min(100, Math.round((actualMins / plannedMins) * 100));

  // --- SLEEP ---
  const { data: sleepLogs } = await supabase
    .from('sleep_logs')
    .select('dnd_activated, hard_mode_active, hard_mode_deactivated, minutes_used_after_bedtime')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lt('date', weekEnd);

  let sleepScore = 0;
  if (sleepLogs && sleepLogs.length > 0) {
    let points = 0;
    const max = sleepLogs.length * 100;
    for (const log of sleepLogs) {
      if (log.dnd_activated) points += 50;
      if (log.hard_mode_active && !log.hard_mode_deactivated) points += 30;
      const lateMins = log.minutes_used_after_bedtime ?? 0;
      if (lateMins === 0) points += 20;
      else if (lateMins < 15) points += 10;
    }
    sleepScore = Math.round((points / max) * 100);
  }

  // --- EXTRAS ---
  const { data: extras } = await supabase
    .from('assignments')
    .select('status, due_date, first_session_at')
    .eq('user_id', userId)
    .eq('type', 'extracurricular')
    .gte('due_date', weekStart)
    .lt('due_date', weekEnd);

  let extrasScore = 0;
  if (extras && extras.length > 0) {
    let points = 0;
    const max = extras.length * 100;
    for (const e of extras) {
      if (e.status === 'submitted') {
        points += 80;
        if (e.first_session_at && e.due_date) {
          const hrs = (new Date(e.due_date).getTime() - new Date(e.first_session_at).getTime()) / 36e5;
          if (hrs >= 48) points += 20;
        }
      } else if (e.status !== 'missed') {
        points += 40;
      }
    }
    extrasScore = Math.round((points / max) * 100);
  }

  // --- OVERALL ---
  const overallScore = Math.round(
    attendanceScore * WEIGHTS.attendance +
    assignmentsScore * WEIGHTS.assignments +
    studyHoursScore * WEIGHTS.studyHours +
    sleepScore * WEIGHTS.sleep +
    extrasScore * WEIGHTS.extras
  );

  // --- WRITE TO DB ---
  const { error } = await supabase.from('weekly_scores').upsert({
    user_id: userId,
    week_start: weekStart,
    attendance_score: attendanceScore,
    assignments_score: assignmentsScore,
    study_hours_score: studyHoursScore,
    sleep_score: sleepScore,
    extras_score: extrasScore,
    overall_score: overallScore,
  }, { onConflict: 'user_id,week_start' });

  if (error) throw error;

  return {
    attendanceScore,
    assignmentsScore,
    studyHoursScore,
    sleepScore,
    extrasScore,
    overallScore,
  };
}

export function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}