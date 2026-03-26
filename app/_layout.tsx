import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { router } from 'expo-router';
import { supabase } from '../services/supabase';

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/sign-in');
      } else {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .single();
        
        if (data) router.replace('/(tabs)');
        else router.replace('/onboarding/welcome');
      }
      setInitialized(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/sign-in');
      else router.replace('/(tabs)');
    });
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/schedule-import" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/sleep-setup" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/permissions" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
    </Stack>
  );
}