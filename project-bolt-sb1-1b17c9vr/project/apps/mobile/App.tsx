import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Alert } from 'react-native';

import { AuthProvider } from './src/contexts/AuthContext';
import { LocationProvider } from './src/contexts/LocationContext';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/theme';
import { supabase } from './src/services/supabase';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import LoadingScreen from './src/screens/LoadingScreen';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState<string>('');

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request permissions
      await requestPermissions();

      // Register for push notifications
      const token = await registerForPushNotificationsAsync();
      setExpoPushToken(token);

      // Initialize other services
      await initializeServices();

      setIsReady(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      Alert.alert(
        'Initialization Error',
        'The app failed to initialize properly. Some features may not work correctly.',
        [{ text: 'OK' }]
      );
      setIsReady(true); // Allow app to continue even if initialization partially fails
    }
  };

  const requestPermissions = async () => {
    try {
      // Location permissions
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'This app needs location access to provide safety features and emergency assistance.',
          [{ text: 'OK' }]
        );
      }

      // Background location permissions (for geofencing)
      const { status: backgroundLocationStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundLocationStatus !== 'granted') {
        Alert.alert(
          'Background Location',
          'Background location access helps us monitor your safety even when the app is closed.',
          [{ text: 'OK' }]
        );
      }

      // Notification permissions
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        Alert.alert(
          'Notification Permission',
          'Notifications are important for emergency alerts and safety updates.',
          [{ text: 'OK' }]
        );
      }

      // Camera permissions (for digital ID)
      // This will be requested when needed in the camera screen

    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  const initializeServices = async () => {
    try {
      // Test Supabase connection
      const { error } = await supabase.from('tourists').select('count').limit(1);
      if (error) {
        console.error('Supabase connection failed:', error);
      }

      // Set up notification listeners
      setupNotificationListeners();

    } catch (error) {
      console.error('Service initialization failed:', error);
    }
  };

  const setupNotificationListeners = () => {
    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle navigation based on notification data
      const data = response.notification.request.content.data;
      if (data.alert_id) {
        // Navigate to alert details or emergency screen
        console.log('Navigate to alert:', data.alert_id);
      }
    });
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <LocationProvider>
          <NavigationContainer>
            <StatusBar style="dark" backgroundColor="#ffffff" />
            <AppNavigator />
          </NavigationContainer>
        </LocationProvider>
      </AuthProvider>
    </PaperProvider>
  );
}