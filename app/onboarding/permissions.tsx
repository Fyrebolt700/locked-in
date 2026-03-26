import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';

export default function Permissions() {
  const [locationGranted, setLocationGranted] = useState(false);
//   const [notificationsGranted, setNotificationsGranted] = useState(false);

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') setLocationGranted(true);
    else Alert.alert('Location needed', 'GPS attendance tracking requires location access. You can enable it later in Settings.');
  }

//   async function requestNotifications() {
//     const { status } = await Notifications.requestPermissionsAsync();
//     if (status === 'granted') setNotificationsGranted(true);
//     else Alert.alert('Notifications needed', 'You can enable notifications later in Settings.');
//   }

  async function handleFinish() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('users').upsert({
      id: user.id,
      hard_mode_enabled: false,
      hard_mode_setup_complete: false,
    });

    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>One Last Step</Text>
      <Text style={styles.subtitle}>Locked In needs a couple of permissions to work properly.</Text>

      <TouchableOpacity
        style={[styles.permRow, locationGranted && styles.granted]}
        onPress={requestLocation}
      >
        <Text style={styles.permTitle}>📍 Location</Text>
        <Text style={styles.permDesc}>For GPS attendance tracking</Text>
        <Text style={styles.status}>{locationGranted ? '✓ Granted' : 'Tap to enable'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        // style={[styles.permRow, notificationsGranted && styles.granted]}
        // onPress={requestNotifications}
      >
        {/* <Text style={styles.permTitle}>🔔 Notifications</Text> */}
        {/* <Text style={styles.permDesc}>For class reminders and evening planner</Text> */}
        {/* <Text style={styles.status}>{notificationsGranted ? '✓ Granted' : 'Tap to enable'}</Text> */}
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleFinish}>
        <Text style={styles.buttonText}>Finish Setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#555', marginBottom: 40, lineHeight: 22 },
  permRow: { padding: 20, borderWidth: 1, borderColor: '#eee', borderRadius: 12, marginBottom: 16 },
  granted: { borderColor: '#1a7f3c', backgroundColor: '#e6ffed' },
  permTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  permDesc: { fontSize: 14, color: '#555', marginBottom: 8 },
  status: { fontSize: 13, color: '#888' },
  button: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});