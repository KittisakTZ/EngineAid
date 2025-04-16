// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import { PaperProvider, DefaultTheme } from 'react-native-paper';

export default function RootLayout() {
  return (
    // vvv ครอบด้วย PaperProvider vvv
    <PaperProvider /* theme={theme} */ >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </PaperProvider>
    // ^^^ ครอบด้วย PaperProvider ^^^
  );
}