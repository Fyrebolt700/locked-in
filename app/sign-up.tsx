import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.replace('/onboarding/schedule-import');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        
        <View style={styles.logoContainer}>
          <Ionicons name="lock-open" size={64} color="#0091FF" />
          <Text style={styles.title}>Create Account</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#8A8D91" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="University Email"
              placeholderTextColor="#A0A4A8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="key-outline" size={20} color="#8A8D91" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#A0A4A8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={handleSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Sign Up</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Cancel & Go Back</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1C1E', letterSpacing: -1, marginTop: 16 },
  formContainer: { width: '100%', gap: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F6F8', borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: '#EBECEF' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1A1C1E', fontWeight: '500' },
  errorText: { color: '#FF3B30', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  primaryButton: { backgroundColor: '#0091FF', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  secondaryButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#8A8D91', fontSize: 14, fontWeight: '600' }
});