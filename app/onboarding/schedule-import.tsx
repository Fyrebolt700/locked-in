import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// Required for web browser auth sessions
WebBrowser.maybeCompleteAuthSession();

export default function ScheduleImport() {
  const [icalUrl, setIcalUrl] = useState('');

  // RESTORED: Actual Google Auth Hook
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: 'YOUR_ANDROID_CLIENT_ID', // Replace with your EAS ID
    webClientId: 'YOUR_WEB_CLIENT_ID',         // Replace with your Web ID
  });

  // RESTORED: Listen for actual Google success
  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      // Here you would normally fetch the calendar data using the token
      // For now, on success, we move to the next screen.
      router.push('/onboarding/sleep-setup' as any);
    }
  }, [response]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <View style={styles.headerContainer}>
          <Ionicons name="calendar" size={64} color="#0091FF" />
          <Text style={styles.title}>Import Schedule</Text>
          <Text style={styles.subtitle}>Connect your classes and deadlines.</Text>
        </View>

        <View style={styles.formContainer}>
          {/* ACTUALLY TRIGGERS GOOGLE MODAL NOW */}
          <TouchableOpacity 
            style={styles.googleButton} 
            disabled={!request}
            onPress={() => promptAsync()}
          >
            <Ionicons name="logo-google" size={24} color="#1A1C1E" style={{ marginRight: 12 }} />
            <Text style={styles.googleButtonText}>Connect Google Calendar</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR PASTE ICAL</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="link" size={20} color="#8A8D91" style={{ marginRight: 12 }} />
            <TextInput style={styles.input} placeholder="https://..." value={icalUrl} onChangeText={setIcalUrl} autoCapitalize="none" />
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, !icalUrl && { opacity: 0.5 }]} 
            onPress={() => router.push('/onboarding/sleep-setup' as any)}
            disabled={!icalUrl}
          >
            <Text style={styles.buttonText}>Sync iCal Link</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1C1E', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#8A8D91', marginTop: 8 },
  formContainer: { width: '100%', gap: 16 },
  googleButton: { flexDirection: 'row', backgroundColor: '#F4F6F8', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EBECEF' },
  googleButtonText: { color: '#1A1C1E', fontSize: 16, fontWeight: '800' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EBECEF' },
  dividerText: { marginHorizontal: 16, color: '#A0A4A8', fontWeight: '800', fontSize: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#EBECEF' },
  input: { flex: 1, fontSize: 16, color: '#1A1C1E' },
  primaryButton: { backgroundColor: '#0091FF', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});