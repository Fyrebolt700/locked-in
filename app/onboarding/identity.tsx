import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

const COLORS = {
  bg: '#F4F6F8',
  surface: '#FFFFFF',
  text: '#1A1C1E',
  subtext: '#8A8D91',
  border: '#EBECEF',
  primary: '#0091FF',
};

export default function IdentityScreen() {
  const [name, setName] = useState('');
  const [university, setUniversity] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!name || !university) return;
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Update the users table with identity info 
        await supabase
          .from('users')
          .update({ name, university })
          .eq('id', user.id);
        
        router.push('/onboarding/schedule-import');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.sectionLabel}>STEP 1 OF 7</Text>
        <Text style={styles.title}>Who is using this system?</Text>
        
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rithanya"
            value={name}
            onChangeText={setName}
            placeholderTextColor={COLORS.subtext}
          />
          
          <View style={styles.divider} />
          
          <Text style={styles.inputLabel}>UNIVERSITY</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. University of Waterloo"
            value={university}
            onChangeText={setUniversity}
            placeholderTextColor={COLORS.subtext}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, (!name || !university) && styles.buttonDisabled]} 
          onPress={handleContinue}
          disabled={!name || !university || loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'INITIALIZING...' : 'CONTINUE'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: COLORS.subtext, letterSpacing: 1.5, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 32 },
  
  inputCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: 28, 
    padding: 24, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    marginBottom: 24
  },
  inputLabel: { fontSize: 10, fontWeight: '800', color: COLORS.subtext, marginBottom: 8, letterSpacing: 1 },
  input: { fontSize: 18, fontWeight: '600', color: COLORS.text, paddingVertical: 8 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  
  button: { 
    backgroundColor: COLORS.text, 
    padding: 20, 
    borderRadius: 20, 
    alignItems: 'center' 
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 14, letterSpacing: 1 }
});