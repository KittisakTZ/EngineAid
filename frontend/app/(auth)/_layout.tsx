// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout() {
  // Can add specific headers or styles for auth screens if needed
  return <Stack screenOptions={{ headerShown: false }} />;
}