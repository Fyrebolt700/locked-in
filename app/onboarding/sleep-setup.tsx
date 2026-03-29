import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SleepSetup() {
  const [bedtime, setBedtime] = useState(new Date());
  const [wakeTime, setWakeTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  // Controls for the native pickers
  const [showBedPicker, setShowBedPicker] = useState(false);
  const [showWakePicker, setShowWakePicker] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  async function handleSaveSleep() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      await supabase.from('users').update({ 
        bedtime: formatTime(bedtime), 
        wake_time: formatTime(wakeTime) 
      }).eq('id', user.id);
    }
    
    setLoading(false);
    router.push('/onboarding/permissions' as any);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Ionicons name="moon" size={64} color="#5E5CE6" />
          <Text style={styles.title}>Sleep Architecture</Text>
          <Text style={styles.subtitle}>When should we lock you out?</Text>
        </View>

        <View style={styles.formContainer}>
          <Text style={styles.label}>BEDTIME</Text>
          {/* TRIGGERS NATIVE ANDROID/IOS TIME PICKER */}
          <TouchableOpacity style={styles.timeBox} onPress={() => setShowBedPicker(true)}>
            <Text style={styles.timeText}>{formatTime(bedtime)}</Text>
          </TouchableOpacity>

          {showBedPicker && (
            <DateTimePicker
              value={bedtime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowBedPicker(Platform.OS === 'ios');
                if (selectedDate) setBedtime(selectedDate);
              }}
            />
          )}

          <Text style={[styles.label, { marginTop: 16 }]}>WAKE TIME</Text>
          <TouchableOpacity style={styles.timeBox} onPress={() => setShowWakePicker(true)}>
            <Text style={styles.timeText}>{formatTime(wakeTime)}</Text>
          </TouchableOpacity>

          {showWakePicker && (
            <DateTimePicker
              value={wakeTime}
              mode="time"
              display="default"
              onChange={(event, selectedDate) => {
                setShowWakePicker(Platform.OS === 'ios');
                if (selectedDate) setWakeTime(selectedDate);
              }}
            />
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveSleep} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Set Schedule'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1C1E', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#8A8D91', marginTop: 8, textAlign: 'center' },
  formContainer: { width: '100%' },
  label: { fontSize: 12, fontWeight: '800', color: '#A0A4A8', letterSpacing: 1, marginBottom: 8 },
  timeBox: { backgroundColor: '#F4F6F8', borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EBECEF' },
  timeText: { fontSize: 24, fontWeight: '800', color: '#1A1C1E' },
  primaryButton: { backgroundColor: '#5E5CE6', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});