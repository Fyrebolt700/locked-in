import { View, Text, Button } from 'react-native';
import { router } from 'expo-router';

export default function Welcome() {
  return (
    <View>
      <Text>Welcome</Text>
      <Button title="Continue" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}