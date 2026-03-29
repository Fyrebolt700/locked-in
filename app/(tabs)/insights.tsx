import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { calculateWeeklyScores, getMondayOfCurrentWeek } from '@/services/scoring';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  text: '#1A1C1E',
  subtext: '#8A8D91',
  border: '#EBECEF',
  red: '#FF453A',
  yellow: '#FFD60A',
  green: '#32D74B',
};

const getScoreColor = (score: number) => {
  if (score < 50) return COLORS.red;
  if (score < 70) return COLORS.yellow;
  return COLORS.green;
};

// ── Greyscale breakdown components ──────────────────────────────────────────

function AttendanceDetail() {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const monday = getMondayOfCurrentWeek();
      const { data } = await supabase
        .from('attendance').select('date, status')
        .eq('user_id', user.id).gte('date', monday)
        .order('date', { ascending: true });
      if (data) setRecords(data);
    })();
  }, []);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const grouped: Record<string, any[]> = {};
  records.forEach(r => {
    const parts = r.date.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const key = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    if (key) { if (!grouped[key]) grouped[key] = []; grouped[key].push(r); }
  });

  return (
    <View style={styles.detailBody}>
      <Text style={styles.detailSectionLabel}>THIS WEEK</Text>
      {days.map(day => {
        const dayRecords = grouped[day] || [];
        const noData = dayRecords.length === 0;
        const anyAbsent = dayRecords.some(r => r.status === 'absent');
        const label = noData ? 'No class' : anyAbsent ? 'Absent' : 'Present';
        const dotStyle = noData ? styles.dotEmpty : anyAbsent ? styles.dotDark : styles.dotFilled;
        return (
          <View key={day} style={styles.detailRow}>
            <View style={[styles.dot, dotStyle]} />
            <Text style={styles.detailDayText}>{day}</Text>
            <Text style={[styles.detailStatus, noData && { color: '#C0C4C8' }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function StudyHoursDetail() {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const monday = getMondayOfCurrentWeek();
      const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
      const sundayStr = sunday.toISOString().split('T')[0];
      const { data } = await supabase
        .from('study_sessions').select('actual_start, planned_duration_min, actual_duration_min')
        .eq('user_id', user.id)
        .gte('actual_start', `${monday}T00:00:00+00`)
        .lte('actual_start', `${sundayStr}T23:59:59+00`)
        .order('actual_start', { ascending: true });
      if (data) setSessions(data);
    })();
  }, []);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const planned: Record<string, number> = {};
  const actual: Record<string, number> = {};
  sessions.forEach(s => {
    const d = new Date(s.actual_start);
    const key = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
    planned[key] = (planned[key] || 0) + (s.planned_duration_min || 0) / 60;
    actual[key] = (actual[key] || 0) + (s.actual_duration_min || 0) / 60;
  });

  const totalPlanned = Object.values(planned).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(actual).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.detailBody}>
      <Text style={styles.detailSectionLabel}>WEEKLY SUMMARY</Text>
      <View style={styles.studySummaryRow}>
        <View style={styles.studyStat}>
          <Text style={styles.studyStatNum}>{totalActual.toFixed(1)}h</Text>
          <Text style={styles.studyStatLabel}>Actual</Text>
        </View>
        <View style={styles.studyDivider} />
        <View style={styles.studyStat}>
          <Text style={styles.studyStatNum}>{totalPlanned.toFixed(1)}h</Text>
          <Text style={styles.studyStatLabel}>Planned</Text>
        </View>
        <View style={styles.studyDivider} />
        <View style={styles.studyStat}>
          <Text style={[styles.studyStatNum, totalActual < totalPlanned && { color: '#8A8D91' }]}>
            {totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0}%
          </Text>
          <Text style={styles.studyStatLabel}>Hit rate</Text>
        </View>
      </View>
      <Text style={[styles.detailSectionLabel, { marginTop: 16 }]}>DAY BY DAY</Text>
      {days.map(day => {
        const p = planned[day] || 0;
        const a = actual[day] || 0;
        if (p === 0 && a === 0) return null;
        const hit = p > 0 && a >= p;
        return (
          <View key={day} style={styles.detailRow}>
            <View style={[styles.dot, hit ? styles.dotFilled : styles.dotEmpty]} />
            <Text style={styles.detailDayText}>{day}</Text>
            <Text style={styles.detailStatus}>{a.toFixed(1)}h of {p.toFixed(1)}h</Text>
          </View>
        );
      })}
    </View>
  );
}

function SleepDetail() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const monday = getMondayOfCurrentWeek();
      const { data } = await supabase
        .from('sleep_logs').select('*').eq('user_id', user.id)
        .gte('date', monday).order('date', { ascending: true });
      if (data) setLogs(data);
    })();
  }, []);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  return (
    <View style={styles.detailBody}>
      <Text style={styles.detailSectionLabel}>NIGHT BY NIGHT</Text>
      {days.map((day, i) => {
        const log = logs[i];
        if (!log) return (
          <View key={day} style={styles.detailRow}>
            <View style={[styles.dot, styles.dotEmpty]} />
            <Text style={styles.detailDayText}>{day}</Text>
            <Text style={[styles.detailStatus, { color: '#C0C4C8' }]}>No data</Text>
          </View>
        );
        const good = log.dnd_activated && !log.hard_mode_deactivated && (log.minutes_used_after_bedtime || 0) < 10;
        const ok = !good && log.dnd_activated && (log.minutes_used_after_bedtime || 0) < 30;
        const label = good ? 'Clean night' : ok ? `${log.minutes_used_after_bedtime}m screen time` : 'Hard mode off';
        return (
          <View key={day} style={styles.detailRow}>
            <View style={[styles.dot, good ? styles.dotFilled : ok ? styles.dotMid : styles.dotDark]} />
            <Text style={styles.detailDayText}>{day}</Text>
            <Text style={styles.detailStatus}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AssignmentsDetail() {
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('assignments').select('title, subject, status, due_date, first_session_at')
        .eq('user_id', user.id).order('due_date', { ascending: true });
      if (data) setAssignments(data);
    })();
  }, []);

  return (
    <View style={styles.detailBody}>
      <Text style={styles.detailSectionLabel}>ALL ASSIGNMENTS</Text>
      {assignments.map((a, i) => {
        const submitted = a.status === 'submitted';
        const overdue = !submitted && new Date(a.due_date) < new Date();
        const startedEarly = a.first_session_at &&
          (new Date(a.due_date).getTime() - new Date(a.first_session_at).getTime()) > 48 * 60 * 60 * 1000;
        const statusLabel = overdue ? 'Overdue' : submitted && startedEarly ? 'Early' : submitted ? 'Submitted' : 'Pending';
        const dotStyle = overdue ? styles.dotDark : submitted ? styles.dotFilled : styles.dotEmpty;
        return (
          <View key={i} style={styles.detailRow}>
            <View style={[styles.dot, dotStyle]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailDayText} numberOfLines={1}>{a.title}</Text>
              <Text style={styles.detailSubtext}>{a.subject}</Text>
            </View>
            <Text style={styles.detailStatus}>{statusLabel}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ExtrasDetail() {
  const [extras, setExtras] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('assignments').select('title, subject, status')
        .eq('user_id', user.id).eq('type', 'extracurricular')
        .order('due_date', { ascending: true });
      if (data) setExtras(data);
    })();
  }, []);

  if (extras.length === 0) return (
    <View style={styles.detailBody}>
      <Text style={[styles.detailStatus, { color: '#C0C4C8' }]}>No extracurriculars this week</Text>
    </View>
  );

  return (
    <View style={styles.detailBody}>
      <Text style={styles.detailSectionLabel}>EXTRACURRICULARS</Text>
      {extras.map((item, i) => (
        <View key={i} style={styles.detailRow}>
          <View style={[styles.dot, item.status === 'submitted' ? styles.dotFilled : styles.dotEmpty]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailDayText, item.status === 'submitted' && styles.strikethrough]} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.detailSubtext}>{item.subject}</Text>
          </View>
          <Text style={styles.detailStatus}>{item.status === 'submitted' ? 'Done' : 'Pending'}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Expandable MetricCard ────────────────────────────────────────────────────

const DETAIL_MAP: Record<string, React.ComponentType> = {
  sleep:       SleepDetail,
  attendance:  AttendanceDetail,
  assignments: AssignmentsDetail,
  studyhours:  StudyHoursDetail,
  extras:      ExtrasDetail,
};

function MetricCard({ title, score, weight, icon, detailKey }: {
  title: string; score: number; weight: number; icon: string; detailKey: string;
}) {
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  function toggle() {
    LayoutAnimation.configureNext({
      duration: 320,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.85 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });

    const toValue = open ? 0 : 1;
    Animated.parallel([
      Animated.spring(rotateAnim, { toValue, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(fadeAnim, { toValue, duration: 260, useNativeDriver: true }),
    ]).start();

    setOpen(o => !o);
  }

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const DetailComponent = DETAIL_MAP[detailKey];

  return (
    <View style={[styles.metricCard, open && styles.metricCardOpen]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.metricTouchable}>
        <View style={styles.metricHeader}>
          <Ionicons name={icon as any} size={18} color={COLORS.subtext} />
          <View style={styles.metricHeaderRight}>
            <Text style={styles.weightText}>{weight}%</Text>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name="chevron-down" size={14} color="#C0C4C8" />
            </Animated.View>
          </View>
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
        <Text style={[styles.metricScore, { color: getScoreColor(score) }]}>{score}</Text>
      </TouchableOpacity>

      {open && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.detailDivider} />
          <DetailComponent />
        </Animated.View>
      )}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function WeeklyMirror() {
  const [scores, setScores] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadScores(); }, []);

  async function loadScores() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const weekStart = getMondayOfCurrentWeek();
      const { data: existing } = await supabase
        .from('weekly_scores').select('*')
        .eq('user_id', user.id).eq('week_start', weekStart).single();

      if (existing) {
        setScores(existing);
      } else {
        const result = await calculateWeeklyScores(user.id, weekStart);
        setScores({
          overall_score: result.overallScore,
          attendance_score: result.attendanceScore,
          assignments_score: result.assignmentsScore,
          study_hours_score: result.studyHoursScore,
          sleep_score: result.sleepScore,
          extras_score: result.extrasScore,
          avoidance_subject: null,
          avoidance_suggestion: null,
        });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.text} />
    </SafeAreaView>
  );

  const overall = scores?.overall_score ?? 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Weekly Mirror</Text>
        <TouchableOpacity onPress={loadScores}>
          <Ionicons name="refresh" size={22} color={COLORS.subtext} />
        </TouchableOpacity>
      </View>

      <View style={styles.integrityCard}>
        <Text style={styles.integrityLabel}>SYSTEM INTEGRITY</Text>
        <Text style={[styles.integrityScore, { color: getScoreColor(overall) }]}>{overall}</Text>
        <View style={styles.scaleTrack}>
          <View style={[styles.scaleProgress, { width: `${overall}%` as any, backgroundColor: getScoreColor(overall) }]} />
        </View>
      </View>

      <View style={styles.categoryGrid}>
        <MetricCard title="Sleep"       score={scores?.sleep_score ?? 0}       weight={15} icon="moon"          detailKey="sleep"      />
        <MetricCard title="Attendance"  score={scores?.attendance_score ?? 0}  weight={25} icon="location"      detailKey="attendance" />
        <MetricCard title="Assignments" score={scores?.assignments_score ?? 0} weight={30} icon="document-text" detailKey="assignments"/>
        <MetricCard title="Study Hours" score={scores?.study_hours_score ?? 0} weight={20} icon="time"          detailKey="studyhours" />
        <MetricCard title="Extras"      score={scores?.extras_score ?? 0}      weight={10} icon="star"          detailKey="extras"     />
      </View>

      {scores?.avoidance_subject ? (
        <View style={styles.avoidanceCard}>
          <Text style={styles.avoidanceLabel}>AVOIDANCE DETECTED</Text>
          <Text style={styles.avoidanceSubject}>{scores.avoidance_subject}</Text>
          <Text style={styles.avoidanceDescription}>{scores.avoidance_suggestion}</Text>
        </View>
      ) : null}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 24 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text },

  integrityCard: { backgroundColor: COLORS.surface, borderRadius: 32, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  integrityLabel: { fontSize: 10, fontWeight: '900', color: COLORS.subtext, letterSpacing: 2, marginBottom: 8 },
  integrityScore: { fontSize: 80, fontWeight: '800', letterSpacing: -2 },
  scaleTrack: { width: '100%', height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 20, overflow: 'hidden' },
  scaleProgress: { height: '100%' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 32 },

  // Card — collapses to half-width, expands to full when open
  metricCard: { backgroundColor: COLORS.surface, width: '47%', borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  metricCardOpen: { width: '100%' },
  metricTouchable: { padding: 20 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  metricHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  weightText: { fontSize: 10, fontWeight: '800', color: COLORS.subtext },
  metricTitle: { fontSize: 14, fontWeight: '600', color: COLORS.subtext, marginBottom: 4 },
  metricScore: { fontSize: 28, fontWeight: '700' },

  // Detail content — all greyscale
  detailDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
  detailBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  detailSectionLabel: { fontSize: 9, fontWeight: '900', color: '#C0C4C8', letterSpacing: 1.5, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F4F6F8' },
  detailDayText: { fontSize: 13, fontWeight: '700', color: '#3A3C3E', flex: 1 },
  detailSubtext: { fontSize: 11, fontWeight: '500', color: '#A0A4A8', marginTop: 1 },
  detailStatus: { fontSize: 12, fontWeight: '600', color: '#8A8D91' },

  // Dot indicators — greyscale only
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotFilled: { backgroundColor: '#3A3C3E' },
  dotMid: { backgroundColor: '#A0A4A8' },
  dotEmpty: { backgroundColor: '#E1E3E5' },
  dotDark: { backgroundColor: '#8A8D91' },

  strikethrough: { textDecorationLine: 'line-through', color: '#A0A4A8' },

  // Study summary
  studySummaryRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 16, padding: 16, marginBottom: 16 },
  studyStat: { flex: 1, alignItems: 'center' },
  studyStatNum: { fontSize: 20, fontWeight: '800', color: '#1A1C1E' },
  studyStatLabel: { fontSize: 10, fontWeight: '700', color: '#A0A4A8', marginTop: 2 },
  studyDivider: { width: 1, height: 32, backgroundColor: COLORS.border },

  // Avoidance
  avoidanceCard: { backgroundColor: '#FF453A08', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#FF453A20' },
  avoidanceLabel: { fontSize: 10, fontWeight: '900', color: COLORS.red, letterSpacing: 1, marginBottom: 12 },
  avoidanceSubject: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  avoidanceDescription: { fontSize: 15, color: COLORS.text, lineHeight: 22, opacity: 0.8 },
});
