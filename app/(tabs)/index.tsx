import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, Dimensions, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type ScheduleEvent = {
  id: string;
  title: string;
  type: string;
  start_time: string;
  end_time: string;
  location: string | null;
};

type Assignment = {
  id: string;
  title: string;
  subject: string;
  type: string;
  due_date: string;
  estimated_hours: number;
};

const TYPE_COLORS: Record<string, string> = {
  class: '#0091FF',
  class_prep: '#0091FF',
  study_block: '#32D74B',
  tutorial: '#32D74B',
  extracurricular: '#FF9F0A',
  project: '#FF9F0A',
  personal: '#FF9F0A',
  assignment: '#AF52DE',
};

const TYPE_LABELS: Record<string, string> = {
  class: 'Classes',
  study_block: 'Study Block',
  class_prep: 'Class Prep',
  tutorial: 'Tutorial',
  extracurricular: 'Extracurricular',
  project: 'Project',
  personal: 'Personal',
  assignment: 'Assignment',
};

const SELECTABLE_TYPES = ['assignment', 'tutorial', 'class_prep', 'project', 'extracurricular'];
const SHOW_AS_DOTS = ['assignment', 'tutorial', 'project', 'extracurricular'];

function toDateString(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(anchor: Date): Date[] {
  const monday = getMondayOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthDays(anchor: Date): Date[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  let startDayOfWeek = firstDay.getDay();
  const diff = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = diff; i > 0; i--) { days.push(new Date(year, month, 1 - i)); }
  for (let i = 1; i <= lastDay.getDate(); i++) { days.push(new Date(year, month, i)); }
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) { for (let i = 1; i <= remaining; i++) { days.push(new Date(year, month + 1, i)); } }
  return days;
}

function getFreeWindows(events: ScheduleEvent[], day: string, wakeTime: string, bedTime: string): { start: string; end: string }[] {
  const dayEvents = events.filter(e => e.start_time.startsWith(day)).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const windows: { start: string; end: string }[] = [];

  const dayStart = new Date(`${day}T${wakeTime}`);
  let dayEnd = new Date(`${day}T${bedTime}`);
  if (dayEnd <= dayStart) dayEnd.setDate(dayEnd.getDate() + 1);

  let cursor = dayStart.getTime();

  for (const event of dayEvents) {
    const evStart = new Date(event.start_time).getTime();
    const evEnd = new Date(event.end_time).getTime();
    if (evEnd <= cursor) continue;
    if (evStart > cursor) {
      const gapMins = (evStart - cursor) / 60000;
      if (gapMins >= 45) {
        windows.push({ start: new Date(cursor).toISOString(), end: new Date(evStart).toISOString() });
      }
    }
    cursor = Math.max(cursor, evEnd);
  }

  const finalGap = (dayEnd.getTime() - cursor) / 60000;
  if (finalGap >= 45) {
    windows.push({ start: new Date(cursor).toISOString(), end: dayEnd.toISOString() });
  }

  return windows;
}

function getTomorrowISO() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sleepLimits, setSleepLimits] = useState({ wake: '08:00:00', bed: '22:00:00' });
  const [selectedDay, setSelectedDay] = useState(toDateString(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [isMonthView, setIsMonthView] = useState(false);
  const [userName, setUserName] = useState<string>('');

  // Quick Add State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formType, setFormType] = useState('assignment');
  const [formDate, setFormDate] = useState(getTomorrowISO());
  const [formHours, setFormHours] = useState('1');

  const [quickStart, setQuickStart] = useState(new Date());
  const [quickEnd, setQuickEnd] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [selectedDay]);

  async function fetchAllData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase.from('users').select('wake_time, bedtime, name').eq('id', user.id).single();
    if (userData) {
      setSleepLimits({ wake: userData.wake_time || '08:00:00', bed: userData.bedtime || '22:00:00' });
      if (userData.name) setUserName(userData.name.split(' ')[0]);
    }

    const { data: schedData } = await supabase.from('schedule').select('*').order('start_time', { ascending: true });
    if (schedData) setEvents(schedData);

    const { data: assignData } = await supabase.from('assignments').select('*').eq('status', 'pending').order('due_date', { ascending: true });
    if (assignData) setAssignments(assignData);
  }

  async function handleQuickAdd() {
    if (!formTitle.trim() || !formSubject.trim()) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: assignmentData, error: assignmentError } = await supabase.from('assignments').insert({
        user_id: user.id,
        title: formTitle.trim(),
        subject: formSubject.trim(),
        type: formType,
        due_date: new Date(formDate).toISOString(),
        estimated_hours: parseFloat(formHours) || 1,
        status: 'pending'
      }).select().single();

      if (assignmentError) throw assignmentError;

      const finalTitle = `${formSubject.trim()} • ${formTitle.trim()}`;
      await supabase.from('schedule').insert({
        user_id: user.id,
        title: finalTitle,
        type: formType,
        start_time: quickStart.toISOString(),
        end_time: quickEnd.toISOString(),
        location: 'Manual'
      });

      const durationMins = Math.round((quickEnd.getTime() - quickStart.getTime()) / 60000);
      await supabase.from('study_sessions').insert({
        user_id: user.id,
        assignment_id: assignmentData.id,
        scheduled_start: quickStart.toISOString(),
        planned_duration_min: durationMins
      });

      setFormTitle(''); setFormSubject(''); setFormType('assignment');
      setFormDate(getTomorrowISO()); setFormHours('1');
      setShowQuickAdd(false);
      await fetchAllData();
    } catch (e) {
      console.error("Insert Failed:", e);
    } finally {
      setIsSaving(false);
    }
  }

  const adjustTime = (type: 'start' | 'end', minutes: number) => {
    if (type === 'start') {
      const newTime = new Date(quickStart.getTime() + minutes * 60000);
      if (newTime < quickEnd) setQuickStart(newTime);
    } else {
      const newTime = new Date(quickEnd.getTime() + minutes * 60000);
      if (newTime > quickStart) setQuickEnd(newTime);
    }
  };

  function formatTime(iso: string | Date) {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const weekDays = getWeekDays(weekAnchor);
  const monthDays = getMonthDays(weekAnchor);

  const dayEvents = events.filter(e => e.start_time.startsWith(selectedDay));
  const freeWindows = getFreeWindows(events, selectedDay, sleepLimits.wake, sleepLimits.bed);
  const urgentEvent = events.filter(e => new Date(e.start_time) >= new Date()).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];
  const dayAssigned = assignments.filter(a => toDateString(new Date(a.due_date)) === selectedDay);

  // Minutes until urgent event
  const minutesUntilUrgent = urgentEvent
    ? Math.max(0, Math.round((new Date(urgentEvent.start_time).getTime() - Date.now()) / 60000))
    : null;

  const timeline = [
    ...dayEvents.map(e => ({ kind: 'event' as const, time: e.start_time, data: e })),
    ...freeWindows.map(w => ({ kind: 'free' as const, time: w.start, data: w })),
    ...dayAssigned.map(a => ({ kind: 'assignment' as const, time: a.due_date, data: a }))
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          <Text style={styles.greeting}>{getGreeting()}{userName ? `, ${userName}` : ''}</Text>

          {urgentEvent && (
            <TouchableOpacity
              style={styles.commandCard}
              activeOpacity={0.9}
              onPress={() => setSelectedEvent(urgentEvent)}
            >
              <View style={styles.heroRow}>
                <View style={styles.urgentTag}>
                  <Text style={styles.urgentTagText}>NEXT UP</Text>
                </View>
                <Text style={styles.dueTime}>
                  {minutesUntilUrgent !== null && minutesUntilUrgent < 60
                    ? `Starts in ${minutesUntilUrgent}m`
                    : formatTime(urgentEvent.start_time)}
                </Text>
              </View>
              <Text style={styles.heroTaskTitle} numberOfLines={2}>{urgentEvent.title}</Text>
              <TouchableOpacity
                style={styles.tactileButton}
                activeOpacity={0.85}
                onPress={() => {
                  const first = assignments[0];
                  if (first) {
                    router.push({ pathname: '/lesson/[id]', params: { id: first.id, title: first.title, steps: JSON.stringify([]) } });
                  }
                }}
              >
                <Text style={styles.buttonText}>Lock In Now</Text>
                <Ionicons name="flash" size={18} color="white" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Timeline ── */}
        <View style={styles.timeline}>
          <View style={styles.timelineLine} />

          {timeline.length === 0 && (
            <View style={styles.emptyDay}>
              <Text style={styles.emptyDayText}>Nothing scheduled — free day 🎉</Text>
            </View>
          )}

          {timeline.map((item, idx) => {

            if (item.kind === 'assignment') {
              const isMidnight = item.time.includes('T00:00:00');
              const timeDisplay = isMidnight ? 'DUE' : formatTime(item.time);
              return (
                <View key={`assignment-${idx}`} style={styles.timelineRow}>
                  <Text style={[styles.timeLabel, isMidnight && { color: '#AF52DE' }]}>{timeDisplay}</Text>
                  <TouchableOpacity style={[styles.eventCard, { borderLeftColor: '#AF52DE' }]} activeOpacity={0.9}>
                    <View style={styles.eventCardTop}>
                      <View style={[styles.pill, { backgroundColor: '#AF52DE15', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Ionicons name="warning" size={12} color="#AF52DE" />
                        <Text style={[styles.pillText, { color: '#AF52DE' }]}>DEADLINE</Text>
                      </View>
                      <Text style={styles.durationLabel}>Est. {item.data.estimated_hours}h</Text>
                    </View>
                    <Text style={styles.eventTitle}>{item.data.title}</Text>
                    <Text style={styles.cardSubject}>{item.data.subject}</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (item.kind === 'event') {
              const durationMins = Math.round((new Date(item.data.end_time).getTime() - new Date(item.data.start_time).getTime()) / 60000);
              const durationText = durationMins >= 60 ? `${(durationMins / 60).toFixed(1).replace('.0', '')}h` : `${durationMins}m`;
              return (
                <View key={`event-${idx}`} style={styles.timelineRow}>
                  <Text style={styles.timeLabel}>{formatTime(item.time)}</Text>
                  <TouchableOpacity
                    style={[styles.eventCard, { borderLeftColor: TYPE_COLORS[item.data.type] ?? '#888' }]}
                    onPress={() => setSelectedEvent(item.data)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.eventCardTop}>
                      <View style={[styles.pill, { backgroundColor: (TYPE_COLORS[item.data.type] ?? '#888') + '15' }]}>
                        <Text style={[styles.pillText, { color: TYPE_COLORS[item.data.type] ?? '#888' }]}>
                          {TYPE_LABELS[item.data.type]?.toUpperCase() || 'EVENT'}
                        </Text>
                      </View>
                      <Text style={styles.durationLabel}>{durationText}</Text>
                    </View>
                    <Text style={styles.eventTitle}>{item.data.title}</Text>
                    {item.data.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={13} color="#A0A4A8" />
                        <Text style={styles.locationText}>{item.data.location}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            // Free Window — height scales with available time
            const windowMins = Math.round((new Date(item.data.end).getTime() - new Date(item.data.start).getTime()) / 60000);
            const windowHours = (windowMins / 60).toFixed(1).replace('.0', '');
            const blockHeight = Math.max(80, windowMins * 1.4);
            const endLabel = formatTime(item.data.end);

            return (
              <View key={`free-${idx}`} style={styles.timelineRow}>
                <Text style={styles.timeLabel}>{formatTime(item.time)}</Text>
                <TouchableOpacity
                  style={[styles.freeWindow, { height: blockHeight }]}
                  onPress={() => {
                    setQuickStart(new Date(item.data.start));
                    setQuickEnd(new Date(item.data.end));
                    setShowQuickAdd(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.freeWindowInner}>
                    <View style={styles.freeWindowTop}>
                      <Ionicons name="add-circle-outline" size={20} color="#A0A4A8" />
                      <Text style={styles.freeWindowText}>Schedule study block?</Text>
                    </View>
                    <Text style={styles.freeWindowDuration}>{windowHours}h free · until {endLabel}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* ── Calendar (below the fold — plan after you act) ── */}
        <View style={styles.capacityHeader}>
          <Text style={styles.sectionTitle}>Daily Architecture</Text>
          <View style={styles.capacityPill}>
            <Text style={styles.capacityPillText}>
              {freeWindows.reduce((sum, w) => sum + Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 3600000), 0).toFixed(1)}h Potential
            </Text>
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <View style={styles.monthHeaderRow}>
            <TouchableOpacity onPress={() => {
              const d = new Date(weekAnchor);
              d.setDate(d.getDate() - (isMonthView ? 30 : 7));
              setWeekAnchor(new Date(d));
            }}>
              <Ionicons name="chevron-back" size={24} color="#C0C4C8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.monthToggleBtn} onPress={() => setIsMonthView(!isMonthView)}>
              <Text style={styles.monthText}>{weekAnchor.toLocaleString('default', { month: 'long', year: 'numeric' })}</Text>
              <Ionicons name={isMonthView ? "chevron-up" : "chevron-down"} size={18} color="#1A1C1E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const d = new Date(weekAnchor);
              d.setDate(d.getDate() + (isMonthView ? 30 : 7));
              setWeekAnchor(new Date(d));
            }}>
              <Ionicons name="chevron-forward" size={24} color="#C0C4C8" />
            </TouchableOpacity>
          </View>

          <View style={styles.daysGrid}>
            {(isMonthView ? monthDays : weekDays).map((day, i) => {
              const ds = toDateString(day);
              const isSelected = ds === selectedDay;
              const dayHasDeadline = assignments.some(a => toDateString(new Date(a.due_date)) === ds);
              let dots = [...new Set(events.filter(e => e.start_time.startsWith(ds) && SHOW_AS_DOTS.includes(e.type)).map(e => TYPE_COLORS[e.type] ?? '#888'))];
              if (dayHasDeadline) dots.unshift('#AF52DE');
              dots = dots.slice(0, 3);

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.gridDayCell, isSelected && styles.dayCellSelected]}
                  onPress={() => {
                    setSelectedDay(ds);
                    if (isMonthView) { setWeekAnchor(day); setIsMonthView(false); }
                  }}
                >
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{day.getDate()}</Text>
                  <View style={styles.dotsRow}>
                    {dots.map((c, j) => <View key={j} style={[styles.dot, { backgroundColor: isSelected ? '#fff' : c }]} />)}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </ScrollView>

      {/* ── Event Detail Modal ── */}
      <Modal visible={!!selectedEvent} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSelectedEvent(null)} activeOpacity={1}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.eventModalTop}>
              <View style={[styles.pill, { backgroundColor: (TYPE_COLORS[selectedEvent?.type ?? ''] ?? '#888') + '20' }]}>
                <Text style={[styles.pillText, { color: TYPE_COLORS[selectedEvent?.type ?? ''] ?? '#888' }]}>
                  {TYPE_LABELS[selectedEvent?.type ?? '']?.toUpperCase() || 'EVENT'}
                </Text>
              </View>
            </View>
            <Text style={styles.sheetQuestion}>{selectedEvent?.title}</Text>
            {selectedEvent && (
              <Text style={styles.sheetTime}>
                {formatTime(selectedEvent.start_time)} → {formatTime(selectedEvent.end_time)}
              </Text>
            )}
            {selectedEvent?.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="#A0A4A8" />
                <Text style={styles.locationText}>{selectedEvent.location}</Text>
              </View>
            )}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => {
                  const match = assignments.find(a => selectedEvent && a.subject === selectedEvent.title) ?? assignments[0];
                  setSelectedEvent(null);
                  if (match) {
                    router.push({ pathname: '/lesson/[id]', params: { id: match.id, title: match.title, steps: JSON.stringify([]) } });
                  }
                }}>
                <Text style={styles.primaryButtonText}>Start Studying</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setSelectedEvent(null)}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Quick Add Modal ── */}
      <Modal visible={showQuickAdd} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetQuestion}>Lock in a block</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>

              <Text style={styles.inputLabel}>TASK TITLE</Text>
              <TextInput style={styles.input} placeholder="e.g. Midterm Essay Draft" value={formTitle} onChangeText={setFormTitle} placeholderTextColor="#A0A4A8" />

              <Text style={styles.inputLabel}>SUBJECT</Text>
              <TextInput style={styles.input} placeholder="e.g. History 101" value={formSubject} onChangeText={setFormSubject} placeholderTextColor="#A0A4A8" />

              <Text style={styles.inputLabel}>TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelectorRow}>
                {SELECTABLE_TYPES.map(key => {
                  const isSelected = formType === key;
                  const color = TYPE_COLORS[key] || '#0091FF';
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.typePill, isSelected ? { backgroundColor: color } : { backgroundColor: '#F4F6F8' }]}
                      onPress={() => setFormType(key)}
                    >
                      <Text style={[styles.typePillText, { color: isSelected ? '#FFFFFF' : '#8A8D91' }]}>
                        {TYPE_LABELS[key]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>DUE DATE (YYYY-MM-DD)</Text>
                  <TextInput style={styles.input} value={formDate} onChangeText={setFormDate} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>EST. HOURS</Text>
                  <TextInput style={styles.input} value={formHours} onChangeText={setFormHours} keyboardType="decimal-pad" />
                </View>
              </View>

              <Text style={styles.inputLabel}>TIME WINDOW</Text>
              <View style={styles.timeAdjustContainer}>
                <View style={styles.timeAdjuster}>
                  <Text style={styles.timeAdjusterLabel}>Start</Text>
                  <View style={styles.timeControls}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => adjustTime('start', -15)}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                    <Text style={styles.timeDisplay}>{formatTime(quickStart)}</Text>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => adjustTime('start', 15)}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={styles.timeAdjuster}>
                  <Text style={styles.timeAdjusterLabel}>End</Text>
                  <View style={styles.timeControls}>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => adjustTime('end', -15)}><Text style={styles.timeBtnText}>−</Text></TouchableOpacity>
                    <Text style={styles.timeDisplay}>{formatTime(quickEnd)}</Text>
                    <TouchableOpacity style={styles.timeBtn} onPress={() => adjustTime('end', 15)}><Text style={styles.timeBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleQuickAdd} disabled={isSaving || !formTitle || !formSubject}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Lock it in</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowQuickAdd(false)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingBottom: 120, paddingTop: 16 },

  // Hero
  heroSection: { paddingHorizontal: 20, marginBottom: 32, marginTop: 8 },
  greeting: { fontSize: 16, color: '#8A8D91', marginBottom: 14, fontWeight: '500' },
  commandCard: { backgroundColor: '#1A1C1E', borderRadius: 32, padding: 24, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  urgentTag: { backgroundColor: '#FF453A25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  urgentTagText: { color: '#FF453A', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  dueTime: { color: '#8A8D91', fontSize: 12, fontWeight: '600' },
  heroTaskTitle: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  tactileButton: { backgroundColor: '#0091FF', paddingVertical: 16, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderBottomWidth: 4, borderBottomColor: '#007ACC' },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },

  // Section header
  capacityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1A1C1E' },
  capacityPill: { backgroundColor: '#EBECEF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  capacityPillText: { fontSize: 12, color: '#1A1C1E', fontWeight: '700' },

  // Calendar
  calendarContainer: { backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 28, marginBottom: 32, padding: 20, borderWidth: 1, borderColor: '#F0F2F5', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.02, shadowRadius: 20, elevation: 2 },
  monthHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  monthToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthText: { fontSize: 18, fontWeight: '800', color: '#1A1C1E' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridDayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 12, borderRadius: 24 },
  dayCellSelected: { backgroundColor: '#0091FF' },
  dayNum: { fontSize: 16, fontWeight: '700', color: '#1A1C1E' },
  dayNumSelected: { color: '#fff' },
  dotsRow: { flexDirection: 'row', gap: 3, marginTop: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },

  // Timeline
  timeline: { paddingHorizontal: 20, marginBottom: 40 },
  timelineLine: { position: 'absolute', left: 85, top: 10, bottom: -50, width: 2, backgroundColor: '#F0F2F5' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 24, paddingRight: 16 },
  timeLabel: { width: 60, fontSize: 11, fontWeight: '700', color: '#A0A4A8', paddingTop: 22, textAlign: 'right' },
  eventCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderLeftWidth: 8, borderWidth: 1, borderColor: '#F0F2F5', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.03, shadowRadius: 24, elevation: 1 },
  eventCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  durationLabel: { fontSize: 13, fontWeight: '700', color: '#A0A4A8' },
  eventTitle: { fontSize: 17, fontWeight: '700', color: '#1A1C1E' },
  cardSubject: { fontSize: 14, color: '#8A8D91', fontWeight: '600', marginTop: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 12, color: '#A0A4A8', fontWeight: '500' },
  freeWindow: { flex: 1, marginLeft: 2, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C0C4C8', backgroundColor: '#FAFAFA', justifyContent: 'flex-start', overflow: 'hidden' },
  freeWindowInner: { flex: 1, padding: 20, justifyContent: 'space-between' },
  freeWindowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  freeWindowText: { fontSize: 14, fontWeight: '700', color: '#A0A4A8' },
  freeWindowDuration: { fontSize: 12, fontWeight: '600', color: '#C0C4C8', marginTop: 8 },
  emptyDay: { paddingVertical: 40, alignItems: 'center' },
  emptyDayText: { fontSize: 15, color: '#A0A4A8', fontWeight: '600' },

  // Event detail modal
  eventModalTop: { marginBottom: 12 },
  sheetTime: { fontSize: 16, color: '#8A8D91', fontWeight: '600', marginTop: 6, marginBottom: 8 },

  // Shared modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  bottomSheet: { backgroundColor: '#FFFFFF', padding: 24, borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: '90%' },
  sheetHandle: { width: 48, height: 5, backgroundColor: '#E1E3E5', borderRadius: 999, alignSelf: 'center', marginBottom: 24 },
  sheetQuestion: { fontSize: 24, fontWeight: '800', color: '#1A1C1E', marginBottom: 12 },
  formScroll: { flexGrow: 0 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#A0A4A8', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F4F6F8', borderRadius: 16, padding: 16, fontSize: 16, color: '#1A1C1E', marginBottom: 8, fontWeight: '500' },
  typeSelectorRow: { flexDirection: 'row', marginBottom: 12, paddingBottom: 8 },
  typePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  typePillText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  timeAdjustContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 },
  timeAdjuster: { flex: 1, backgroundColor: '#F4F6F8', borderRadius: 16, padding: 16 },
  timeAdjusterLabel: { fontSize: 11, fontWeight: '800', color: '#A0A4A8', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
  timeControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeBtn: { backgroundColor: '#E1E3E5', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  timeBtnText: { fontSize: 16, fontWeight: '800', color: '#1A1C1E' },
  timeDisplay: { fontSize: 15, fontWeight: '700', color: '#1A1C1E' },
  actionButtons: { gap: 12, marginTop: 8 },
  primaryButton: { backgroundColor: '#0091FF', paddingVertical: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#0091FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { backgroundColor: '#F4F6F8', paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  secondaryButtonText: { color: '#1A1C1E', fontSize: 16, fontWeight: '700' },
});
