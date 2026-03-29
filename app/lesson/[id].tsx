import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../services/supabase';

type Phase = 'focus' | 'recording' | 'playback';

export default function FocusLock() {
  const { id, title, steps } = useLocalSearchParams<{ id: string; title: string; steps: string }>();
  const parsedSteps: string[] = steps ? JSON.parse(steps as string) : [];

  const [seconds, setSeconds] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(new Array(parsedSteps.length).fill(false));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const intervalRef = useRef<any>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [phase, setPhase] = useState<Phase>('focus');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const finalizingRef = useRef(false);

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

    await supabase
      .from('assignments')
      .update({ first_session_at: startTimeRef.current })
      .eq('id', id)
      .is('first_session_at', null);
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

  async function handleExitEarly() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        await finalizeEarlyExit(false);
        return;
      }
    }
    setPhase('recording');
  }

  async function startRecording() {
    if (!cameraRef.current || isRecording || !cameraReady) return;
    setIsRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ mute: true } as any);
      if (result?.uri) {
        setVideoUri(result.uri);
        setPhase('playback');
      } else {
        setIsRecording(false);
        await finalizeEarlyExit(false);
      }
    } catch (e) {
      console.error('Recording error:', e);
      setIsRecording(false);
      await finalizeEarlyExit(false);
    }
  }

  function stopRecording() {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    setIsRecording(false);
  }

  async function finalizeEarlyExit(videoRecorded: boolean) {
    if (videoUri) {
      try {
        await FileSystem.deleteAsync(videoUri, { idempotent: true });
        const info = await FileSystem.getInfoAsync(videoUri);
        if (info.exists) console.warn('Video file still exists after delete');
      } catch (e) {
        console.error('Error deleting video:', e);
      }
    }

    if (sessionId) {
      await supabase.from('study_sessions').update({
        end_time: new Date().toISOString(),
        actual_duration_min: Math.floor(seconds / 60),
        checklist_completed: checked.filter(Boolean).length,
        exited_early: true,
        exit_reason: videoRecorded ? 'recorded' : 'no_video',
      }).eq('id', sessionId);
    }

    router.replace('/(tabs)');
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

  // --- RECORDING PHASE ---
  if (phase === 'recording') {
    return (
      <View style={styles.fullScreen}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="video"
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.cameraOverlay}>
          <Text style={styles.cameraPrompt}>
            {!cameraReady
              ? 'Initializing camera...'
              : isRecording
              ? 'Recording... tap square to stop.'
              : "Tell yourself why you're stopping.\nTap red circle to begin."}
          </Text>
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive,
              !cameraReady && styles.recordButtonDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={!cameraReady}
            activeOpacity={0.8}
          >
            <View style={isRecording ? styles.recordStop : styles.recordDot} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- PLAYBACK PHASE ---
  const player = useVideoPlayer(videoUri ?? '', p => {
    p.play();
  });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('playingChange', async (isPlaying) => {
      if (!isPlaying && phase === 'playback' && !finalizingRef.current) {
        finalizingRef.current = true;
        await finalizeEarlyExit(true);
      }
    });
    return () => sub.remove();
  }, [player, phase]);

  if (phase === 'playback' && videoUri) {
    return (
      <View style={styles.fullScreen}>
        <VideoView
          player={player}
          style={styles.camera}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.playbackPill}>
            <Text style={styles.playbackText}>REVIEWING FOOTAGE</Text>
          </View>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={async () => {
              if (finalizingRef.current) return;
              finalizingRef.current = true;
              await finalizeEarlyExit(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.skipText}>Skip & Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- FOCUS LOCK PHASE ---
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.activePill}>
          <Text style={styles.activePillText}>SESSION ACTIVE</Text>
        </View>
        <Text style={styles.taskTitle} numberOfLines={2}>{title}</Text>
      </View>

      <Text style={styles.timer}>{formatTime(seconds)}</Text>

      <View style={styles.checklistContainer}>
        {parsedSteps.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.checklistContent}>
            {parsedSteps.map((step, i) => (
              <TouchableOpacity 
                key={i} 
                style={[styles.checkRow, checked[i] && styles.checkRowDone]} 
                onPress={() => toggleCheck(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checked[i] && styles.checkboxDone]}>
                  {checked[i] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.stepText, checked[i] && styles.stepDone]}>{step}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyChecklist}>
            <Text style={styles.emptyChecklistTitle}>Free Focus Session</Text>
            <Text style={styles.emptyChecklistSub}>No study plan generated. Get to work.</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={handleDone} activeOpacity={0.8}>
          <Text style={styles.doneText}>Complete Session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exitButton} onPress={handleExitEarly} activeOpacity={0.6}>
          <Text style={styles.exitText}>Exit Early</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8', paddingHorizontal: 20 },
  
  /* Header & Timer */
  header: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  activePill: { backgroundColor: '#0091FF15', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  activePillText: { color: '#0091FF', fontWeight: '800', fontSize: 11, letterSpacing: 1.5 },
  taskTitle: { fontSize: 24, fontWeight: '800', color: '#1A1C1E', textAlign: 'center', paddingHorizontal: 20 },
  
  timer: { fontSize: 88, fontWeight: '900', color: '#0091FF', textAlign: 'center', letterSpacing: -2, fontVariant: ['tabular-nums'], marginBottom: 32 },

  /* Checklist Bento Card */
  checklistContainer: { flex: 1, backgroundColor: '#fff', borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.03, shadowRadius: 16, elevation: 2, marginBottom: 24 },
  checklistContent: { paddingBottom: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, paddingRight: 10 },
  checkRowDone: { opacity: 0.6 },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#D0D4D8', marginRight: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', marginTop: 2 },
  checkboxDone: { backgroundColor: '#32D74B', borderColor: '#32D74B' },
  checkmark: { color: '#fff', fontSize: 16, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 16, lineHeight: 24, color: '#1A1C1E', fontWeight: '500' },
  stepDone: { textDecorationLine: 'line-through', color: '#A0A4A8' },
  
  emptyChecklist: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChecklistTitle: { fontSize: 18, fontWeight: '700', color: '#1A1C1E', marginBottom: 8 },
  emptyChecklistSub: { fontSize: 15, color: '#A0A4A8', textAlign: 'center' },

  /* Bottom Actions */
  footer: { paddingBottom: 16 },
  doneButton: { backgroundColor: '#0091FF', paddingVertical: 20, borderRadius: 24, alignItems: 'center', shadowColor: '#0091FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 4, marginBottom: 16 },
  doneText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  exitButton: { alignItems: 'center', paddingVertical: 12 },
  exitText: { color: '#A0A4A8', fontSize: 15, fontWeight: '700' },

  /* Full Screen Camera Modes */
  fullScreen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 60, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', paddingTop: 40 },
  cameraPrompt: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 40, paddingHorizontal: 32, lineHeight: 28 },
  
  recordButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  recordButtonActive: { borderColor: '#FF3B30' },
  recordButtonDisabled: { opacity: 0.3 },
  recordDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF3B30' },
  recordStop: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FF3B30' },
  
  playbackPill: { backgroundColor: '#FF9F0A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 32 },
  playbackText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  skipButton: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  skipText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});