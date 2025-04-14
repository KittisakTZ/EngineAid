// app/(app)/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, Redirect } from 'expo-router';
import { getToken } from '../../services/auth';
import { View, ActivityIndicator } from 'react-native'; // Import loading indicator

export default function AppLayout() {
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = await getToken();
            setIsAuthenticated(!!token); // Set true if token exists, false otherwise
            setIsLoading(false);
        };
        checkAuth();
    }, []); // Run only once on mount

    if (isLoading) {
        // Show a loading spinner while checking auth
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!isAuthenticated) {
        // If not authenticated after check, redirect to login
        console.log("AppLayout: Not authenticated, redirecting to login.");
        return <Redirect href="/(auth)/login" />;
    }

    // If authenticated, render the stack for the (app) group
    console.log("AppLayout: Authenticated, rendering app stack.");
    return <Stack screenOptions={{ headerShown: false }} />;

}