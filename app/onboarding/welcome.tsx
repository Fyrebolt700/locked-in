import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Welcome() {
  const [step, setStep] = useState(1); // 1: Branding, 2: Identity Setup
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');

  const canContinue = name.trim().length > 0 && university.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* KeyboardAvoidingView ensures the keyboard doesn't hide what you're typing */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: LOGO & BRANDING */}
          <View style={[styles.logoContainer, step === 2 && { marginTop: 20 }]}>
            <Ionicons name="lock-closed" size={step === 1 ? 80 : 40} color="#0091FF" />
            <Text style={[styles.title, step === 2 && { fontSize: 24, marginTop: 12 }]}>LOCKED IN</Text>
            {step === 1 && (
              <Text style={styles.subtitle}>
                Built for the student who knows what they should be doing and just cannot start.
              </Text>
            )}
          </View>

          {/* STEP 2: IDENTITY INPUTS */}
          {step === 2 && (
            <View style={styles.setupContainer}>
              <Text style={styles.stepIndicator}>STEP 1 OF 7</Text>
              <Text style={styles.setupTitle}>Initialization</Text>
              
              <View style={styles.inputCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter name"
                    placeholderTextColor="#8A8D91"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>UNIVERSITY</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. University of Waterloo"
                    placeholderTextColor="#8A8D91"
                    value={university}
                    onChangeText={setUniversity}
                  />
                </View>
              </View>
            </View>
          )}

          {/* DYNAMIC BUTTONS - Now part of the scroll flow */}
          <View style={styles.buttonContainer}>
            {step === 1 ? (
              <>
                <TouchableOpacity 
                  style={styles.primaryButton} 
                  onPress={() => setStep(2)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.secondaryButton}
                  onPress={() => router.push('/sign-in')}
                  activeOpacity={0.6}
                >
                  <Text style={styles.secondaryButtonText}>Already have an account? Log In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={[styles.primaryButton, !canContinue && styles.disabledButton]} 
                onPress={() => router.push({
                  pathname: '/sign-up',
                  params: { name, university }
                })}
                disabled={!canContinue}
              >
                <Text style={styles.primaryButtonText}>Continue Setup</Text>
                <Ionicons name="chevron-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { 
    flexGrow: 1, 
    paddingHorizontal: 32, 
    paddingVertical: 60,
    justifyContent: 'space-between' // Keeps items spread out when keyboard is closed
  },
  
  logoContainer: { alignItems: 'center' },
  title: { fontSize: 40, fontWeight: '900', color: '#1A1C1E', letterSpacing: -1, marginTop: 24 },
  subtitle: { fontSize: 16, color: '#8A8D91', fontWeight: '500', marginTop: 16, textAlign: 'center', lineHeight: 24 },
  
  /* Setup Section */
  setupContainer: { marginTop: 40 },
  stepIndicator: { fontSize: 10, fontWeight: '900', color: '#8A8D91', letterSpacing: 1.5, marginBottom: 8 },
  setupTitle: { fontSize: 32, fontWeight: '800', color: '#1A1C1E', marginBottom: 24 },
  inputCard: { backgroundColor: '#F4F6F8', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#EBECEF' },
  inputGroup: { paddingVertical: 8 },
  inputLabel: { fontSize: 10, fontWeight: '800', color: '#8A8D91', marginBottom: 4, letterSpacing: 0.5 },
  input: { fontSize: 16, fontWeight: '700', color: '#1A1C1E' },
  divider: { height: 1, backgroundColor: '#EBECEF', marginVertical: 12 },

  buttonContainer: { width: '100%', gap: 16, marginTop: 40 },
  primaryButton: { 
    backgroundColor: '#0091FF', 
    flexDirection: 'row',
    height: 64, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#0091FF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 4
  },
  disabledButton: { backgroundColor: '#EBECEF', shadowOpacity: 0, elevation: 0, opacity: 0.7 },
  primaryButtonText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  secondaryButton: { height: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#1A1C1E', fontSize: 15, fontWeight: '700' }
});