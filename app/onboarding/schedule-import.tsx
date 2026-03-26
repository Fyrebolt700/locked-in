import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import ICAL from 'ical.js';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function ScheduleImport() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState(false);

  async function handleImport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(url);
      const fileContent = await response.text();

      const parsed = ICAL.parse(fileContent);
      const comp = new ICAL.Component(parsed);
      const events = comp.getAllSubcomponents('vevent');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const rows = events.map((event: any) => {
        const ev = new ICAL.Event(event);
        return {
          user_id: user.id,
          title: ev.summary,
          type: 'class',
          location: ev.location ?? null,
          start_time: ev.startDate.toJSDate().toISOString(),
          end_time: ev.endDate.toJSDate().toISOString(),
          is_recurring: !!event.getFirstPropertyValue('rrule'),
          recurrence_rule: event.getFirstPropertyValue('rrule')?.toString() ?? null,
          reviewed: false,
          source: 'ical',
        };
      });

      const { error } = await supabase.from('schedule').insert(rows);
      if (error) throw error;

      setImported(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Your Schedule</Text>
      <Text style={styles.subtitle}>Paste your iCal URL from your university portal below.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {imported && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>Schedule imported!</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="https://your-university.ca/ical/..."
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.button} onPress={handleImport} disabled={loading || !url}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Import Schedule</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipButton} onPress={() => router.push('/onboarding/sleep-setup')}>
        <Text style={styles.skipText}>{imported ? 'Continue' : 'Skip for now'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 32, lineHeight: 22 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 14, borderRadius: 10, marginBottom: 16, fontSize: 14 },
  button: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipButton: { alignItems: 'center', paddingVertical: 12 },
  skipText: { color: '#888', fontSize: 15 },
  error: { color: 'red', marginBottom: 16 },
  successBox: { backgroundColor: '#e6ffed', padding: 16, borderRadius: 8, marginBottom: 16 },
  successText: { color: '#1a7f3c', fontWeight: '600' },
});