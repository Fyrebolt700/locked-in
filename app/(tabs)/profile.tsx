import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { activateBedtimeDND, scheduleBedtimeNotification, scheduleWakeNotification } from '../../services/sleep';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dndActive, setDndActive] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUser(user);
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      setProfile(data);
      if (data?.wake_time) await scheduleWakeNotification(data?.wake_time);
      if (data?.bedtime) await scheduleBedtimeNotification(data?.bedtime);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivateDND() {
    if (!user || !profile) return;
    try {
      await activateBedtimeDND(user.id, profile.bedtime);
      setDndActive(true);
      Alert.alert('Bedtime mode activated', 'Notifications cancelled. Sleep log recorded.');
    } catch (e) {
      Alert.alert('Error', 'Could not activate bedtime mode.');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/onboarding/welcome');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0091FF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        
        {/* Identity Card */}
        <View style={styles.identityContainer}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLetter}>{profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}</Text>
          </View>
          <Text style={styles.identityName}>{profile?.name ?? 'Student'}</Text>
          <Text style={styles.identityEmail}>{user?.email ?? '—'}</Text>
          <View style={[styles.pill, { backgroundColor: '#0091FF15', marginTop: 16 }]}>
            <Text style={[styles.pillText, { color: '#0091FF' }]}>{profile?.university?.toUpperCase() ?? 'UNIVERSITY'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SLEEP ARCHITECTURE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.halfCard}>
              <View style={styles.iconCircleSleep}>
                <Ionicons name="moon" size={20} color="#5E5CE6" />
              </View>
              <Text style={styles.cardLabel}>BEDTIME</Text>
              <Text style={styles.cardValue}>{profile?.bedtime ?? '—'}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.halfCard}>
              <View style={styles.iconCircleWake}>
                <Ionicons name="sunny" size={20} color="#FF9F0A" />
              </View>
              <Text style={styles.cardLabel}>WAKE TIME</Text>
              <Text style={styles.cardValue}>{profile?.wake_time ?? '—'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>SYSTEM CONTROLS</Text>
        
        {/* Bedtime Mode (Demo Toggle) */}
        <View style={[styles.card, { borderLeftColor: '#5E5CE6' }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="bed" size={22} color="#1A1C1E" />
              <Text style={styles.cardTitle}>Bedtime Mode</Text>
            </View>
          </View>
          <Text style={styles.cardHint}>
            Triggers automatically at your configured bedtime to silence distractions. Tap to demo.
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, dndActive ? styles.actionButtonActive : { backgroundColor: '#5E5CE6' }]}
            onPress={handleActivateDND}
            disabled={dndActive}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, dndActive && { color: '#A0A4A8' }]}>
              {dndActive ? '🔒 MODE ACTIVE' : 'FORCE ACTIVATE NOW'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hard Mode Status */}
        <View style={[styles.card, { borderLeftColor: profile?.hard_mode_enabled ? '#32D74B' : '#A0A4A8' }]}>
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="shield-checkmark" size={22} color="#1A1C1E" />
              <Text style={styles.cardTitle}>Hard Mode</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: profile?.hard_mode_enabled ? '#32D74B15' : '#F4F6F8' }]}>
              <Text style={[styles.pillText, { color: profile?.hard_mode_enabled ? '#32D74B' : '#A0A4A8' }]}>
                {profile?.hard_mode_enabled ? 'ENABLED' : 'DISABLED'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardHint}>
            Configured via Android Accessibility during onboarding. Reinstall the app to modify.
          </Text>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutCard} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, // Pure white background
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 16, fontSize: 14, fontWeight: '700', color: '#A0A4A8', letterSpacing: 0.5 },
  
  /* Header */
  headerContainer: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  header: { fontSize: 32, fontWeight: '800', color: '#1A1C1E', letterSpacing: -1 },
  
  content: { paddingHorizontal: 24, paddingBottom: 120 },

  /* Identity Section */
  identityContainer: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 32, marginBottom: 32, borderWidth: 1, borderColor: '#F0F2F5', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.03, shadowRadius: 24, elevation: 2 },
  avatarLarge: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1A1C1E', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  avatarLetter: { fontSize: 40, fontWeight: '800', color: '#fff' },
  identityName: { fontSize: 26, fontWeight: '800', color: '#1A1C1E', marginBottom: 6 },
  identityEmail: { fontSize: 16, color: '#8A8D91', fontWeight: '500' },
  
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#A0A4A8', letterSpacing: 1.5, marginBottom: 16, marginLeft: 8 },
  
  /* Cards */
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderLeftWidth: 8, borderLeftColor: '#EBECEF', borderWidth: 1, borderColor: '#F0F2F5', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.02, shadowRadius: 16, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#1A1C1E' },
  cardHint: { fontSize: 15, color: '#8A8D91', lineHeight: 22, fontWeight: '500', marginBottom: 20 },
  
  /* Split Row (Sleep Schedule) */
  row: { flexDirection: 'row', alignItems: 'center' },
  halfCard: { flex: 1, alignItems: 'center' },
  verticalDivider: { width: 1, height: 60, backgroundColor: '#F0F2F5' },
  iconCircleSleep: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#5E5CE615', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  iconCircleWake: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF9F0A15', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 10, fontWeight: '800', color: '#A0A4A8', letterSpacing: 1, marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: '800', color: '#1A1C1E', letterSpacing: -0.5 },

  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  pillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  /* Action Buttons */
  actionButton: { borderRadius: 20, paddingVertical: 18, alignItems: 'center', shadowColor: '#5E5CE6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  actionButtonActive: { backgroundColor: '#F4F6F8', shadowOpacity: 0, elevation: 0 },
  actionButtonText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  signOutCard: { flexDirection: 'row', justifyContent: 'center', gap: 10, backgroundColor: '#FF3B3010', borderRadius: 20, padding: 20, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#FF3B3020' },
  signOutText: { color: '#FF3B30', fontSize: 16, fontWeight: '800' },
});