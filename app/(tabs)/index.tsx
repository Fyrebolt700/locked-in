import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../services/supabase';

type ScheduleEvent = {
  id: string;
  title: string;
  type: string;
  start_time: string;
  end_time: string;
  location: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  class: '#3b82f6',
  study_block: '#22c55e',
  extracurricular: '#a855f7',
  personal: '#f97316',
};

export default function HomeScreen() {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [todayUrgent, setTodayUrgent] = useState<ScheduleEvent | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('schedule')
      .select('*')
      .order('start_time', { ascending: true });

    if (data) {
      setEvents(data);
      const today = new Date().toISOString().split('T')[0];
      const todayEvents = data.filter(e => e.start_time.startsWith(today));
      if (todayEvents.length > 0) setTodayUrgent(todayEvents[0]);
    }
  }

  function getMarkedDates() {
    const marked: Record<string, any> = {};
    events.forEach(event => {
      const day = event.start_time.split('T')[0];
      if (!marked[day]) marked[day] = { dots: [] };
      marked[day].dots.push({
        color: TYPE_COLORS[event.type] ?? '#888',
      });
    });
    if (marked[selectedDay]) {
      marked[selectedDay].selected = true;
      marked[selectedDay].selectedColor = '#000';
    } else {
      marked[selectedDay] = { selected: true, selectedColor: '#000' };
    }
    return marked;
  }

  function getDayEvents() {
    return events.filter(e => e.start_time.startsWith(selectedDay));
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.container}>
      {todayUrgent && (
        <TouchableOpacity style={styles.banner} onPress={() => setSelectedEvent(todayUrgent)}>
          <Text style={styles.bannerText}>▶ Next up: {todayUrgent.title} at {formatTime(todayUrgent.start_time)}</Text>
        </TouchableOpacity>
      )}

      <Calendar
        markingType="multi-dot"
        markedDates={getMarkedDates()}
        onDayPress={day => setSelectedDay(day.dateString)}
        theme={{ todayTextColor: '#000', arrowColor: '#000' }}
      />

      <ScrollView style={styles.eventList}>
        <Text style={styles.dayLabel}>{new Date(selectedDay + 'T12:00:00').toDateString()}</Text>
        {getDayEvents().length === 0 && (
          <Text style={styles.empty}>No events scheduled</Text>
        )}
        {getDayEvents().map(event => (
          <TouchableOpacity
            key={event.id}
            style={[styles.eventCard, { borderLeftColor: TYPE_COLORS[event.type] ?? '#888' }]}
            onPress={() => setSelectedEvent(event)}
          >
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventTime}>{formatTime(event.start_time)} → {formatTime(event.end_time)}</Text>
            {event.location && <Text style={styles.eventLocation}>📍 {event.location}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!selectedEvent} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <View style={styles.bottomSheet}>
            <Text style={styles.sheetTitle}>{selectedEvent?.title}</Text>
            <Text style={styles.sheetDetail}>Type: {selectedEvent?.type}</Text>
            <Text style={styles.sheetDetail}>
              {selectedEvent ? formatTime(selectedEvent.start_time) : ''} → {selectedEvent ? formatTime(selectedEvent.end_time) : ''}
            </Text>
            {selectedEvent?.location && <Text style={styles.sheetDetail}>📍 {selectedEvent.location}</Text>}
            <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedEvent(null)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  banner: { backgroundColor: '#000', padding: 12, margin: 12, borderRadius: 8 },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  eventList: { flex: 1, padding: 16 },
  dayLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  empty: { color: '#888', fontSize: 14 },
  eventCard: { borderLeftWidth: 4, padding: 12, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 10 },
  eventTitle: { fontSize: 15, fontWeight: '600' },
  eventTime: { fontSize: 13, color: '#555', marginTop: 2 },
  eventLocation: { fontSize: 12, color: '#888', marginTop: 2 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  bottomSheet: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  sheetDetail: { fontSize: 15, color: '#555', marginBottom: 6 },
  closeButton: { marginTop: 16, backgroundColor: '#000', padding: 14, borderRadius: 10, alignItems: 'center' },
  closeButtonText: { color: '#fff', fontWeight: '600' },
});