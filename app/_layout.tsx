import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { AuthProvider } from '@/context/AuthContext';

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="leave-balance" options={{ headerShown: false }} />
        <Stack.Screen name="overtime" options={{ headerShown: false }} />
        <Stack.Screen name="claim" options={{ headerShown: false }} />
        <Stack.Screen name="my-pays" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AttendanceProvider>
        <RootLayoutNav />
      </AttendanceProvider>
    </AuthProvider>
  );
}
