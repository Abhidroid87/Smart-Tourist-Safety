import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert,
  Vibration,
  Platform
} from 'react-native';
import { Button } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing
} from 'react-native-reanimated';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

interface PanicScreenProps {
  navigation: any;
}

export default function PanicScreen({ navigation }: PanicScreenProps) {
  const { user } = useAuth();
  const [isPressed, setIsPressed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // Animation values
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.5);
  const ringScale = useSharedValue(1);

  useEffect(() => {
    getCurrentLocation();
    startPulseAnimation();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            triggerPanicAlert();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [countdown]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Error', 'Location permission is required for emergency alerts');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      
      setLocation(currentLocation);
    } catch (error) {
      console.error('Failed to get location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
    }
  };

  const startPulseAnimation = () => {
    pulseOpacity.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease)
      }),
      -1,
      true
    );

    ringScale.value = withRepeat(
      withTiming(1.5, {
        duration: 2000,
        easing: Easing.out(Easing.ease)
      }),
      -1,
      false
    );
  };

  const handlePanicPress = async () => {
    if (isPressed || countdown > 0) return;

    setIsPressed(true);
    setCountdown(5); // 5 second countdown

    // Haptic feedback
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      Vibration.vibrate([0, 100, 50, 100]);
    }

    // Scale animation
    scale.value = withSpring(0.9, {
      damping: 15,
      stiffness: 150
    });

    Alert.alert(
      'Emergency Alert',
      `Emergency alert will be sent in 5 seconds. Press "Cancel" to stop.`,
      [
        {
          text: 'Cancel',
          onPress: cancelPanicAlert,
          style: 'cancel'
        },
        {
          text: 'Send Now',
          onPress: triggerPanicAlert,
          style: 'destructive'
        }
      ]
    );
  };

  const cancelPanicAlert = () => {
    setIsPressed(false);
    setCountdown(0);
    scale.value = withSpring(1);
    
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const triggerPanicAlert = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      if (!location) {
        await getCurrentLocation();
      }

      if (!location) {
        throw new Error('Unable to get location');
      }

      // Send panic alert to backend
      const response = await api.post('/alerts/panic', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        message: 'Emergency assistance needed - Panic button activated',
        severity: 'critical',
        type: 'panic'
      });

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate(200);
      }

      Alert.alert(
        'Alert Sent',
        'Emergency alert has been sent successfully. Authorities have been notified of your location.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('AlertStatus', { 
              alertId: response.data.alert.id 
            })
          }
        ]
      );

    } catch (error: any) {
      console.error('Failed to send panic alert:', error);
      
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      Alert.alert(
        'Alert Failed',
        'Failed to send emergency alert. Please try again or contact emergency services directly.',
        [
          { text: 'Retry', onPress: triggerPanicAlert },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsLoading(false);
      setIsPressed(false);
      setCountdown(0);
      scale.value = withSpring(1);
    }
  };

  const animatedButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }]
    };
  });

  const animatedPulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
      transform: [{ scale: ringScale.value }]
    };
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency</Text>
        <Text style={styles.subtitle}>
          Press and hold the panic button in case of emergency
        </Text>
        {user && (
          <Text style={styles.userInfo}>
            Signed in as: {user.name}
          </Text>
        )}
      </View>

      {/* Panic Button Area */}
      <View style={styles.buttonContainer}>
        {/* Pulse rings */}
        <Animated.View style={[styles.pulseRing, animatedPulseStyle]} />
        <Animated.View 
          style={[
            styles.pulseRing, 
            animatedPulseStyle,
            { 
              position: 'absolute',
              animationDelay: '1s'
            }
          ]} 
        />

        {/* Main panic button */}
        <Animated.View style={animatedButtonStyle}>
          <Button
            mode="contained"
            onPress={handlePanicPress}
            disabled={isLoading}
            style={[
              styles.panicButton,
              isPressed && styles.panicButtonPressed
            ]}
            contentStyle={styles.panicButtonContent}
            labelStyle={styles.panicButtonLabel}
            buttonColor={isPressed ? '#DC2626' : '#EF4444'}
          >
            <View style={styles.buttonInner}>
              <Ionicons
                name={isLoading ? 'hourglass' : 'warning'}
                size={40}
                color="white"
              />
              <Text style={styles.panicText}>
                {countdown > 0 ? countdown : isLoading ? 'SENDING...' : 'PANIC'}
              </Text>
            </View>
          </Button>
        </Animated.View>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>How it works:</Text>
        <Text style={styles.instructionText}>
          • Press the panic button to start emergency alert{'\n'}
          • Your location will be sent to authorities{'\n'}
          • Emergency contacts will be notified{'\n'}
          • Help is on the way
        </Text>
      </View>

      {/* Emergency Contacts */}
      <View style={styles.emergencyContacts}>
        <Text style={styles.emergencyTitle}>Emergency Hotlines</Text>
        <View style={styles.contactRow}>
          <Ionicons name="call" size={16} color={theme.colors.primary} />
          <Text style={styles.contactText}>Police: 100</Text>
        </View>
        <View style={styles.contactRow}>
          <Ionicons name="medical" size={16} color={theme.colors.primary} />
          <Text style={styles.contactText}>Medical: 102</Text>
        </View>
        <View style={styles.contactRow}>
          <Ionicons name="flame" size={16} color={theme.colors.primary} />
          <Text style={styles.contactText}>Fire: 101</Text>
        </View>
      </View>

      {/* Location Status */}
      {location && (
        <View style={styles.locationStatus}>
          <Ionicons name="location" size={16} color="#10B981" />
          <Text style={styles.locationText}>
            Location ready ({location.coords.accuracy?.toFixed(0)}m accuracy)
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center'
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 60
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22
  },
  userInfo: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8
  },
  buttonContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60
  },
  pulseRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FEE2E2',
    opacity: 0.3
  },
  panicButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  panicButtonPressed: {
    backgroundColor: '#DC2626'
  },
  panicButtonContent: {
    width: 200,
    height: 200,
    borderRadius: 100
  },
  panicButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  buttonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  panicText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8
  },
  instructions: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    width: '100%'
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12
  },
  instructionText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20
  },
  emergencyContacts: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 20
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 12
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  contactText: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    fontWeight: '500'
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  locationText: {
    fontSize: 12,
    color: '#065F46',
    marginLeft: 6,
    fontWeight: '500'
  }
});