import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

type Assignment = {
  id: string;
  title: string;
  subject: string;
  type: string;
  due_date: string;
  estimated_hours: number;
  status: string;
};

function getUrgencyColor(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate);
  const daysLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return '#ef4444';
  if (daysLeft < 2) return '#f97316';
  return '#22c55e';
}

export default function StudyScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function fetchAssignments() {
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .eq('status', 'pending')
      .order('due_date', { ascending: true });
    if (data) setAssignments(data);
  }

  async function handleYesStudyPlan() {
    if (!selected) return;
    setLoadingPlan(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create a 4-7 step study plan for the following task. Return ONLY a numbered list, no headers, no markdown, no extra text.
Task: ${selected.title}
Subject: ${selected.subject}
Type: ${selected.type}
Due: ${selected.due_date}`
            }]
          }]
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const steps = text.split('\n').filter((s: string) => s.trim().length > 0);
      setShowModal(false);
      router.push({ pathname: '/lesson/[id]', params: { id: selected.id, title: selected.title, steps: JSON.stringify(steps) } });
    } catch (e) {
      console.error(e);
    }
    setLoadingPlan(false);
  }

  function handleNoStudyPlan() {
    if (!selected) return;
    setShowModal(false);
    router.push({ pathname: '/lesson/[id]', params: { id: selected.id, title: selected.title, steps: JSON.stringify([]) } });
  }

  function formatDue(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>What are you studying?</Text>
      <ScrollView>
        {assignments.map(a => (
          <TouchableOpacity
            key={a.id}
            style={styles.card}
            onPress={() => { setSelected(a); setShowModal(true); }}
          >
            <View style={[styles.urgencyBar, { backgroundColor: getUrgencyColor(a.due_date) }]} />
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              <Text style={styles.cardSubject}>{a.subject}</Text>
              <Text style={styles.cardDue}>Due {formatDue(a.due_date)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={() => setShowModal(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{selected?.title}</Text>
            <Text style={styles.sheetQuestion}>Want a study plan?</Text>
            <Text style={styles.sheetSub}>Locked In will generate a checklist to guide your session.</Text>
            {loadingPlan ? (
              <ActivityIndicator size="large" color="#000" style={{ marginTop: 24 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.yesButton} onPress={handleYesStudyPlan}>
                  <Text style={styles.yesText}>Yes, make a plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noButton} onPress={handleNoStudyPlan}>
                  <Text style={styles.noText}>No, just start</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, marginTop: 8 },
  card: { flexDirection: 'row', backgroundColor: '#f9f9f9', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 1 },
  urgencyBar: { width: 6 },
  cardContent: { padding: 14, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubject: { fontSize: 13, color: '#555', marginTop: 2 },
  cardDue: { fontSize: 12, color: '#888', marginTop: 4 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sheetQuestion: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  sheetSub: { fontSize: 14, color: '#555', marginBottom: 24 },
  yesButton: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  yesText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  noButton: { padding: 16, alignItems: 'center' },
  noText: { fontSize: 16, color: '#555' },
});