import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';

export default function Permissions() {

  async function handleRequestPermissions() {
    // 1. LOCATION PERMISSION
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus === 'granted') {
      // Request background location for the 30-min geofence check
      await Location.requestBackgroundPermissionsAsync();
    }

    // 2. NOTIFICATIONS PERMISSION
    await Notifications.requestPermissionsAsync();

    // 3. PACKAGE_USAGE_STATS (Android Only - Direct to Settings)
    if (Platform.OS === 'android') {
      Alert.alert(
        "Screen Time Access",
        "Locked In needs Usage Access to verify you stayed off your phone after bedtime. We will open Settings now. Please find 'Locked In' and grant access.",
        [
          { 
            text: "Skip", 
            style: "cancel", 
            onPress: () => router.replace('/(tabs)' as any) 
          },
          {
            text: "Open Settings",
            onPress: async () => {
              try {
                // Opens the specific Android settings menu for Usage Access
                await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.USAGE_ACCESS_SETTINGS);
              } catch (error) {
                console.log("Could not open settings", error);
              } finally {
                // Drop them into the app after they return from settings
                router.replace('/(tabs)' as any);
              }
            }
          }
        ]
      );
    } else {
      // Fallback for iOS/Web
      router.replace('/(tabs)' as any);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <Ionicons name="shield-checkmark" size={64} color="#32D74B" />
          <Text style={styles.title}>Final Setup</Text>
          <Text style={styles.subtitle}>Locked In requires a few permissions to automate your discipline.</Text>
        </View>

        {/* Location Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="location" size={24} color="#1A1C1E" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Location (Background)</Text>
              <Text style={styles.cardSubtitle}>Required to automatically check you into class.</Text>
            </View>
          </View>
        </View>

        {/* Notifications Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="notifications" size={24} color="#1A1C1E" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Notifications</Text>
              <Text style={styles.cardSubtitle}>Required for bedtime enforcement and class warnings.</Text>
            </View>
          </View>
        </View>

        {/* Usage Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Ionicons name="phone-portrait" size={24} color="#1A1C1E" />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Usage Access</Text>
              <Text style={styles.cardSubtitle}>Required to track late-night screen time.</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleRequestPermissions}>
          <Text style={styles.buttonText}>Enable All & Enter App</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '900', color: '#1A1C1E', marginTop: 16 },
  subtitle: { fontSize: 16, color: '#8A8D91', marginTop: 8, textAlign: 'center', lineHeight: 24 },
  card: { backgroundColor: '#F4F6F8', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#EBECEF' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardText: { marginLeft: 16, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1A1C1E' },
  cardSubtitle: { fontSize: 13, color: '#8A8D91', marginTop: 2, lineHeight: 18 },
  primaryButton: { backgroundColor: '#32D74B', height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 32 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});