import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../services/supabase';

export default function FocusLock() {
  const { id, title, steps } = useLocalSearchParams<{ id: string; title: string; steps: string }>();
  const parsedSteps: string[] = steps ? JSON.parse(steps as string) : [];

  const [seconds, setSeconds] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(new Array(parsedSteps.length).fill(false));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<any>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    startSession();
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      clearInterval(intervalRef.current);
      backHandler.remove();
    };
  }, []);

  async function startSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      assignment_id: id,
      actual_start: startTimeRef.current,
      study_plan_used: parsedSteps.length > 0,
      checklist_total: parsedSteps.length,
      checklist_completed: 0,
      exited_early: false,
    }).select().single();
    if (data) setSessionId(data.id);
  }

  async function handleDone() {
    clearInterval(intervalRef.current);
    const endTime = new Date().toISOString();
    const completedCount = checked.filter(Boolean).length;
    if (sessionId) {
      await supabase.from('study_sessions').update({
        end_time: endTime,
        actual_duration_min: Math.floor(seconds / 60),
        checklist_completed: completedCount,
        exited_early: false,
      }).eq('id', sessionId);
    }
    await supabase.from('assignments').update({
      status: 'submitted',
      submitted_at: endTime,
    }).eq('id', id);
    router.replace('/(tabs)');
  }

  function handleExitEarly() {
    Alert.alert('Exit Early?', 'Are you sure?', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: async () => {
        clearInterval(intervalRef.current);
        if (sessionId) {
          const { error } = await supabase.from('study_sessions').update({
            end_time: new Date().toISOString(),
            actual_duration_min: Math.floor(seconds / 60),
            checklist_completed: checked.filter(Boolean).length,
            exited_early: true,
          }).eq('id', sessionId);
          if (error) alert(JSON.stringify(error));
        }
        router.replace('/(tabs)');
      }}
    ]);
  }

  function toggleCheck(index: number) {
    const updated = [...checked];
    updated[index] = !updated[index];
    setChecked(updated);
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.taskTitle}>{title}</Text>
      <Text style={styles.timer}>{formatTime(seconds)}</Text>
      <ScrollView style={styles.checklist}>
        {parsedSteps.map((step, i) => (
          <TouchableOpacity key={i} style={styles.checkRow} onPress={() => toggleCheck(i)}>
            <View style={[styles.checkbox, checked[i] && styles.checkboxDone]}>
              {checked[i] && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.stepText, checked[i] && styles.stepDone]}>{step}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
        <Text style={styles.doneText}>I'm Done</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.exitButton} onPress={handleExitEarly}>
        <Text style={styles.exitText}>Exit Early</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 60 },
  taskTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  timer: { fontSize: 64, fontWeight: '200', textAlign: 'center', marginVertical: 24 },
  checklist: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ccc', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#000', borderColor: '#000' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  stepDone: { textDecorationLine: 'line-through', color: '#aaa' },
  doneButton: { backgroundColor: '#000', padding: 18, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  doneText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  exitButton: { alignItems: 'center', padding: 12 },
  exitText: { color: '#888', fontSize: 14 },
});