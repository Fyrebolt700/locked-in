import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function SleepSetup() {
  const [bedtime, setBedtime] = useState(new Date());
  const [wakeTime, setWakeTime] = useState(new Date());
  const [showBedtime, setShowBedtime] = useState(false);
  const [showWake, setShowWake] = useState(false);
  const [saving, setSaving] = useState(false);

  function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function handleContinue() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('users').upsert({
      id: user.id,
      bedtime: `${bedtime.getHours().toString().padStart(2, '0')}:${bedtime.getMinutes().toString().padStart(2, '0')}`,
      wake_time: `${wakeTime.getHours().toString().padStart(2, '0')}:${wakeTime.getMinutes().toString().padStart(2, '0')}`,
    });

    // if (error) console.error(error);
    if (error) alert(JSON.stringify(error));
    else router.push('/onboarding/permissions');
    setSaving(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sleep Schedule</Text>
      <Text style={styles.subtitle}>Locked In will activate Do Not Disturb at bedtime automatically.</Text>

      <TouchableOpacity style={styles.timeRow} onPress={() => setShowBedtime(true)}>
        <Text style={styles.label}>Bedtime</Text>
        <Text style={styles.timeValue}>{formatTime(bedtime)}</Text>
      </TouchableOpacity>

      {showBedtime && (
        <DateTimePicker
          value={bedtime}
          mode="time"
          is24Hour={false}
          onChange={(_, date) => { setShowBedtime(false); if (date) setBedtime(date); }}
        />
      )}

      <TouchableOpacity style={styles.timeRow} onPress={() => setShowWake(true)}>
        <Text style={styles.label}>Wake Time</Text>
        <Text style={styles.timeValue}>{formatTime(wakeTime)}</Text>
      </TouchableOpacity>

      {showWake && (
        <DateTimePicker
          value={wakeTime}
          mode="time"
          is24Hour={false}
          onChange={(_, date) => { setShowWake(false); if (date) setWakeTime(date); }}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={handleContinue} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Continue'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 40, lineHeight: 22 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 8 },
  label: { fontSize: 18, fontWeight: '500' },
  timeValue: { fontSize: 18, color: '#888' },
  button: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 48 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});