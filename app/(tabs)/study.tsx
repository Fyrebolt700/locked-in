import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

// Unified Azure Drift Color Mapping
const ASSIGNMENT_COLORS: Record<string, string> = {
  class_prep: '#0091FF',      // Blue
  tutorial: '#32D74B',        // Green
  project: '#FF9F0A',         // Orange
  extracurricular: '#FF9F0A', // Orange
  assignment: '#AF52DE',      // Electric Purple
};

const ASSIGNMENT_LABELS: Record<string, string> = {
  class_prep: 'Class Prep',
  tutorial: 'Tutorial',
  project: 'Project',
  extracurricular: 'Extracurricular',
  assignment: 'Assignment',
};

function getDaysLeft(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate);
  return (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

function formatDueText(iso: string) {
  const daysLeft = getDaysLeft(iso);
  if (daysLeft < 0) return 'Overdue';
  if (daysLeft < 1) return 'Due Today';
  if (daysLeft < 2) return 'Due Tomorrow';
  return `Due ${new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

// Helper for quick date formatting in the Add form
function getTomorrowISO() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export default function StudyScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  
  // Modals & State
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  
  // Add Assignment Form State
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formType, setFormType] = useState('assignment');
  const [formDate, setFormDate] = useState(getTomorrowISO());
  const [formHours, setFormHours] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleAddAssignment() {
    if (!formTitle.trim() || !formSubject.trim()) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('assignments').insert({
        user_id: user.id,
        title: formTitle.trim(),
        subject: formSubject.trim(),
        type: formType,
        due_date: new Date(formDate).toISOString(),
        estimated_hours: parseFloat(formHours) || 1,
        status: 'pending'
      });

      // Reset form and refresh
      setFormTitle('');
      setFormSubject('');
      setFormType('assignment');
      setFormDate(getTomorrowISO());
      setFormHours('1');
      setShowAddModal(false);
      await fetchAssignments();
    } catch (e) {
      console.error('Error adding assignment:', e);
    } finally {
      setIsSubmitting(false);
    }
  }

  function getGeminiPrompt(task: Assignment): string {
    const base = `Task: ${task.title}\nSubject: ${task.subject}\nDue: ${task.due_date}\n\nCreate a 4-7 step study plan. Return ONLY a numbered list, no headers, no markdown, no extra text.\n\n`;

    switch (task.type) {
      case 'class_prep': return base + 'Focus on: reviewing last session notes, identifying confusing concepts, writing 2 questions to ask in class.';
      case 'tutorial': return base + 'Focus on: reading the concept, working through example problems, attempting practice problems without looking, checking answers.';
      case 'assignment': return base + 'Focus on: breaking into parts, estimating time per part, starting with the easiest part to build momentum.';
      case 'extracurricular':
      case 'project': return base + 'Focus on: rereading the brief or spec, identifying what is unclear, listing the 3 most important things to complete this session.';
      default: return base + 'Focus on: breaking the work into clear steps, starting with what you understand best, and ending with a specific stopping point.';
    }
  }

  async function handleYesStudyPlan() {
    if (!selected) return;
    setLoadingPlan(true);
    setPlanError(null);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.EXPO_PUBLIC_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: getGeminiPrompt(selected) }] }]
          })
        }
      );
      const raw = await response.text();
      const geminiData = JSON.parse(raw);

      if (geminiData.error) {
        setPlanError("Couldn't generate a plan right now. Try again or just start.");
        return;
      }

      const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const steps = text.split('\n').map((s: string) => s.replace(/^\d+\.\s*/, '').trim()).filter((s: string) => s.length > 0);

      if (steps.length === 0) {
        setPlanError("Couldn't generate a plan right now. Try again or just start.");
        return;
      }

      setShowPlanModal(false);
      router.push({ pathname: '/lesson/[id]', params: { id: selected.id, title: selected.title, steps: JSON.stringify(steps) } });
    } catch (e) {
      setPlanError('Something went wrong. Try again or just start.');
    } finally {
      setLoadingPlan(false);
    }
  }

  function handleNoStudyPlan() {
    if (!selected) return;
    setShowPlanModal(false);
    setPlanError(null);
    router.push({ pathname: '/lesson/[id]', params: { id: selected.id, title: selected.title, steps: JSON.stringify([]) } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>What are you studying?</Text>
        <Text style={styles.subHeader}>Select a pending task to initialize a focus block.</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {assignments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You're all caught up.</Text>
            <Text style={styles.emptySub}>No pending assignments found.</Text>
          </View>
        ) : (
          assignments.map(a => {
            const typeColor = ASSIGNMENT_COLORS[a.type] || '#8A8D91';
            const typeLabel = ASSIGNMENT_LABELS[a.type] || a.type;
            const daysLeft = getDaysLeft(a.due_date);
            const isCritical = daysLeft < 1;

            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.card, { borderLeftColor: typeColor }]}
                onPress={() => { setSelected(a); setShowPlanModal(true); setPlanError(null); }}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.pill, { backgroundColor: typeColor + '15' }]}>
                    <Text style={[styles.pillText, { color: typeColor }]}>{typeLabel.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.cardDue, isCritical && styles.cardDueCritical]}>
                    {formatDueText(a.due_date)}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardSubject}>{a.subject} • Est. {a.estimated_hours}h</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add Assignment Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetQuestion}>Add Task</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
              <Text style={styles.inputLabel}>TASK TITLE</Text>
              <TextInput style={styles.input} placeholder="e.g. Midterm Essay Draft" value={formTitle} onChangeText={setFormTitle} placeholderTextColor="#A0A4A8" />
              
              <Text style={styles.inputLabel}>SUBJECT</Text>
              <TextInput style={styles.input} placeholder="e.g. History 101" value={formSubject} onChangeText={setFormSubject} placeholderTextColor="#A0A4A8" />
              
              <Text style={styles.inputLabel}>TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeSelectorRow}>
                {Object.keys(ASSIGNMENT_LABELS).map(key => {
                  const isSelected = formType === key;
                  const color = ASSIGNMENT_COLORS[key];
                  return (
                    <TouchableOpacity 
                      key={key} 
                      style={[styles.typePill, isSelected ? { backgroundColor: color } : { backgroundColor: '#F4F6F8' }]}
                      onPress={() => setFormType(key)}
                    >
                      <Text style={[styles.typePillText, { color: isSelected ? '#FFFFFF' : '#8A8D91' }]}>
                        {ASSIGNMENT_LABELS[key]}
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

              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleAddAssignment} disabled={isSubmitting || !formTitle || !formSubject}>
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Create Task</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Plan Generation Modal */}
      <Modal visible={showPlanModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowPlanModal(false); setPlanError(null); }}>
          <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            {selected && (
              <View style={[styles.pill, { backgroundColor: '#F4F6F8', alignSelf: 'flex-start', marginBottom: 16 }]}>
                <Text style={[styles.pillText, { color: '#8A8D91' }]}>{selected.subject.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.sheetQuestion}>Want a study plan?</Text>
            <Text style={styles.sheetSub}>Locked In will generate a step-by-step checklist to guide your session based on the task type.</Text>

            {planError && <View style={styles.errorContainer}><Text style={styles.errorText}>⚠️ {planError}</Text></View>}

            {loadingPlan ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#0091FF" />
                <Text style={styles.loadingText}>Structuring session...</Text>
              </View>
            ) : (
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleYesStudyPlan} activeOpacity={0.8}>
                  <Text style={styles.primaryButtonText}>Yes, make a plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleNoStudyPlan} activeOpacity={0.7}>
                  <Text style={styles.secondaryButtonText}>No, just start</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Pure White Background to match the new HomeScreen look
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  headerContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  header: { fontSize: 28, fontWeight: '800', color: '#1A1C1E', letterSpacing: -0.5, marginBottom: 6 },
  subHeader: { fontSize: 15, color: '#8A8D91', fontWeight: '500' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  
  /* Cards with Micro-borders */
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, borderLeftWidth: 8,
    borderWidth: 1, borderTopColor: '#F0F2F5', borderRightColor: '#F0F2F5', borderBottomColor: '#F0F2F5',
    marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.03, shadowRadius: 24, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardDue: { fontSize: 13, fontWeight: '700', color: '#A0A4A8' },
  cardDueCritical: { color: '#FF3B30' },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1A1C1E', marginBottom: 6 },
  cardSubject: { fontSize: 14, color: '#8A8D91', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#1A1C1E', marginBottom: 6 },
  emptySub: { fontSize: 15, color: '#8A8D91' },

  /* Floating Action Button */
  fab: { position: 'absolute', right: 24, bottom: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#0091FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#0091FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '400', marginTop: -4 },

  /* Modals */
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  bottomSheet: { backgroundColor: '#FFFFFF', padding: 24, paddingBottom: 48, borderTopLeftRadius: 36, borderTopRightRadius: 36, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.05, shadowRadius: 30 },
  sheetHandle: { width: 48, height: 5, backgroundColor: '#E1E3E5', borderRadius: 999, alignSelf: 'center', marginBottom: 24 },
  sheetQuestion: { fontSize: 26, fontWeight: '800', color: '#1A1C1E', marginBottom: 12, letterSpacing: -0.5 },
  sheetSub: { fontSize: 15, color: '#8A8D91', marginBottom: 32, lineHeight: 22 },
  
  /* Add Form Specifics */
  formScroll: { flexGrow: 0 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#A0A4A8', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#F4F6F8', borderRadius: 16, padding: 16, fontSize: 16, color: '#1A1C1E', fontWeight: '500' },
  typeSelectorRow: { flexDirection: 'row', marginBottom: 8, paddingBottom: 8 },
  typePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  typePillText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },

  /* Action Buttons */
  actionButtons: { gap: 12, marginTop: 32 },
  primaryButton: { backgroundColor: '#0091FF', paddingVertical: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#0091FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  secondaryButton: { backgroundColor: '#F4F6F8', paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  secondaryButtonText: { color: '#1A1C1E', fontSize: 16, fontWeight: '700' },

  loadingContainer: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 16, fontSize: 15, fontWeight: '600', color: '#8A8D91' },
  errorContainer: { backgroundColor: '#FF3B3015', padding: 16, borderRadius: 16, marginBottom: 24 },
  errorText: { color: '#FF3B30', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});