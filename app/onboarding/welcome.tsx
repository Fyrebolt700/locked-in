import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Welcome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Locked In</Text>
      <Text style={styles.tagline}>Built for the student who knows what they should be doing and just cannot start.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/schedule-import')}>
        <Text style={styles.buttonText}>Let's Go</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 40, fontWeight: 'bold', marginBottom: 16 },
  tagline: { fontSize: 16, textAlign: 'center', color: '#555', marginBottom: 48, lineHeight: 24 },
  button: { backgroundColor: '#000', paddingVertical: 16, paddingHorizontal: 48, borderRadius: 12 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});