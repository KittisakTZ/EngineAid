// app/index.tsx
import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { getToken } from '../services/auth';
import { View, ActivityIndicator } from 'react-native'; // Loading indicator

export default function StartScreen() {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const token = await getToken();
            setIsAuthenticated(!!token);
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    if (isLoading) {
        return (
             <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // Redirect based on authentication status
    if (isAuthenticated) {
        console.log("Index: Authenticated, redirecting to chat.");
        return <Redirect href="/(app)/chat" />;
    } else {
        console.log("Index: Not authenticated, redirecting to login.");
        return <Redirect href="/(auth)/login" />;
    }
}