/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, StatusBar, StyleSheet, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  signOut,
  type User,
} from '@react-native-firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from '@react-native-firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
} from '@react-native-firebase/functions';
import ReactNativeBiometrics, { type BiometryType } from 'react-native-biometrics';
import {
  Button,
  MD3LightTheme,
  Provider as PaperProvider,
  Surface,
  Text,
} from 'react-native-paper';
import MainNavigator from './src/navigation/MainNavigator';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import {
  disableNotifications,
  refreshPushRegistration,
  subscribeToForegroundMessages,
  subscribeToTokenRefresh,
  syncDueActionNotifications,
} from './src/lib/notifications';
import {
  resetRelationshipState,
  startRelationshipSync,
} from './src/lib/relationshipSync';
import { useBiometricLockStore } from './src/store/useBiometricLockStore';
import { useLoveActionStore } from './src/store/useLoveActionStore';
import { useNotificationStore } from './src/store/useNotificationStore';

const BIOMETRIC_LOCK_STORAGE_KEY = '@how2loveme/biometric-lock-enabled';
const SPLASH_IMAGE = require('./assets/splash/splash.png');
const USE_FIREBASE_EMULATORS = false;
const FIREBASE_EMULATOR_HOST = '127.0.0.1';
const FIREBASE_AUTH_EMULATOR_PORT = 9099;
const FIRESTORE_EMULATOR_PORT = 8080;
const FUNCTIONS_EMULATOR_PORT = 5001;
const rnBiometrics = new ReactNativeBiometrics();
let firebaseEmulatorsConfigured = false;

const theme = {
  ...MD3LightTheme,
  roundness: 14,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#B25B63',
    onPrimary: '#FFF3EA',
    primaryContainer: '#E59A9A',
    onPrimaryContainer: '#3F2831',
    secondary: '#E59A9A',
    onSecondary: '#3F2831',
    secondaryContainer: '#F3C8BA',
    onSecondaryContainer: '#3F2831',
    tertiary: '#F3C8BA',
    onTertiary: '#3F2831',
    tertiaryContainer: '#FFF3EA',
    onTertiaryContainer: '#3F2831',
    background: '#FFF3EA',
    onBackground: '#3F2831',
    surface: '#FFF3EA',
    onSurface: '#3F2831',
    surfaceVariant: '#F3C8BA',
    onSurfaceVariant: '#3F2831',
    outline: '#B25B63',
    outlineVariant: '#E59A9A',
    error: '#B25B63',
    onError: '#FFF3EA',
    errorContainer: '#E59A9A',
    onErrorContainer: '#3F2831',
    inverseSurface: '#3F2831',
    inverseOnSurface: '#FFF3EA',
    inversePrimary: '#F3C8BA',
    backdrop: 'rgba(63, 40, 49, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: '#FFF3EA',
      level2: '#F8E2D8',
      level3: '#F3C8BA',
      level4: '#EDB5AE',
      level5: '#E59A9A',
    },
  },
};

const paperSettings = {
  icon: (props: any) => <MaterialDesignIcons {...props} />,
};

function getBiometricLabel(biometryType: BiometryType | null) {
  switch (biometryType) {
    case 'FaceID':
      return 'Face ID';
    case 'TouchID':
      return 'Touch ID';
    default:
      return 'biometrics';
  }
}

function configureFirebaseEmulators() {
  if (!__DEV__ || !USE_FIREBASE_EMULATORS || firebaseEmulatorsConfigured) {
    return;
  }

  const auth = getAuth();
  const firestore = getFirestore();
  const functions = getFunctions();

  connectAuthEmulator(auth, `http://${FIREBASE_EMULATOR_HOST}:${FIREBASE_AUTH_EMULATOR_PORT}`);
  connectFirestoreEmulator(firestore, FIREBASE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
  connectFunctionsEmulator(functions, FIREBASE_EMULATOR_HOST, FUNCTIONS_EMULATOR_PORT);
  firebaseEmulatorsConfigured = true;
}

function App() {
  configureFirebaseEmulators();
  const [initializing, setInitializing] = useState(true);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [lockError, setLockError] = useState('');
  const hydrated = useBiometricLockStore(state => state.hydrated);
  const biometricEnabled = useBiometricLockStore(state => state.enabled);
  const biometricAvailable = useBiometricLockStore(state => state.available);
  const biometryType = useBiometricLockStore(state => state.biometryType);
  const loveActions = useLoveActionStore(state => state.actions);
  const notificationsHydrated = useNotificationStore(state => state.hydrated);
  const notificationsEnabled = useNotificationStore(state => state.enabled);
  const setHydrated = useBiometricLockStore(state => state.setHydrated);
  const setBiometricEnabled = useBiometricLockStore(state => state.setEnabled);
  const setBiometricAvailability = useBiometricLockStore(state => state.setAvailability);
  const emailVerified = user?.emailVerified ?? false;
  const shouldShowMainApp = !!user && emailVerified;
  const shouldRequireBiometricUnlock =
    shouldShowMainApp && hydrated && biometricEnabled && biometricAvailable;
  const biometricLabel = getBiometricLabel(biometryType);
  const appStateRef = useRef(AppState.currentState);
  const unlockingRef = useRef(false);
  const previousUserRef = useRef<User | null>(null);

  const refreshBiometricAvailability = useCallback(async () => {
    try {
      const result = await rnBiometrics.isSensorAvailable();
      const available = result.available;
      const nextBiometryType = result.biometryType ?? null;

      setBiometricAvailability(available, nextBiometryType);

      if (!available) {
        await AsyncStorage.setItem(BIOMETRIC_LOCK_STORAGE_KEY, 'false');
        setBiometricEnabled(false);
      }

      return available;
    } catch {
      setBiometricAvailability(false, null);
      await AsyncStorage.setItem(BIOMETRIC_LOCK_STORAGE_KEY, 'false');
      setBiometricEnabled(false);
      return false;
    }
  }, [setBiometricAvailability, setBiometricEnabled]);

  const promptForUnlock = useCallback(async () => {
    if (!shouldRequireBiometricUnlock || unlockingRef.current) {
      return;
    }

    unlockingRef.current = true;
    setUnlocking(true);
    setLockError('');

    try {
      const result = await rnBiometrics.simplePrompt({
        promptMessage: `Unlock How 2 Love Me with ${biometricLabel}`,
        fallbackPromptMessage: 'Use your device passcode',
        cancelButtonText: 'Cancel',
      });

      if (result.success) {
        setLocked(false);
        return;
      }

      setLocked(true);
      setLockError('Unlock was cancelled.');
    } catch (error: any) {
      setLocked(true);
      setLockError(error.message ?? `Unable to verify ${biometricLabel} right now.`);
    } finally {
      unlockingRef.current = false;
      setUnlocking(false);
    }
  }, [biometricLabel, shouldRequireBiometricUnlock]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const unsubscribeForegroundMessages = subscribeToForegroundMessages();
    return unsubscribeForegroundMessages;
  }, []);

  useEffect(() => {
    const firebaseAuth = getAuth();
    const subscriber = onIdTokenChanged(firebaseAuth, usr => {
      setUser(usr);
      setInitializing(false);
    });
    return subscriber;
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrateBiometrics = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(BIOMETRIC_LOCK_STORAGE_KEY);
        const storedEnabled = storedValue === 'true';
        const result = await rnBiometrics.isSensorAvailable();
        const available = result.available;
        const nextBiometryType = result.biometryType ?? null;

        if (!mounted) {
          return;
        }

        setBiometricAvailability(available, nextBiometryType);

        if (storedEnabled && !available) {
          await AsyncStorage.setItem(BIOMETRIC_LOCK_STORAGE_KEY, 'false');
          setBiometricEnabled(false);
        } else {
          setBiometricEnabled(storedEnabled);
        }
      } catch {
        if (!mounted) {
          return;
        }

        setBiometricAvailability(false, null);
        setBiometricEnabled(false);
      } finally {
        if (mounted) {
          setHydrated(true);
        }
      }
    };

    void hydrateBiometrics();

    return () => {
      mounted = false;
    };
  }, [setBiometricAvailability, setBiometricEnabled, setHydrated]);

  useEffect(() => {
    const previousUser = previousUserRef.current;

    if ((!user || !emailVerified) && previousUser) {
      void disableNotifications(previousUser);
    }

    previousUserRef.current = user;

    if (!user || !emailVerified) {
      resetRelationshipState();
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const tokenResult = await user.getIdTokenResult();

        if (tokenResult.claims.email_verified !== true) {
          await user.getIdToken(true);
        }

        if (cancelled) {
          return;
        }

        const refreshedUser = getAuth().currentUser ?? user;
        unsubscribe = startRelationshipSync(refreshedUser);
      } catch {
        if (!cancelled) {
          resetRelationshipState();
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [emailVerified, user]);

  useEffect(() => {
    if (!user || !emailVerified || !notificationsHydrated || !notificationsEnabled) {
      return;
    }

    void refreshPushRegistration(user);
    const unsubscribeTokenRefresh = subscribeToTokenRefresh(user);
    return unsubscribeTokenRefresh;
  }, [emailVerified, notificationsEnabled, notificationsHydrated, user]);

  useEffect(() => {
    void syncDueActionNotifications(
      loveActions,
      shouldShowMainApp ? user?.uid ?? null : null,
      notificationsHydrated && notificationsEnabled,
    );
  }, [loveActions, notificationsEnabled, notificationsHydrated, shouldShowMainApp, user?.uid]);

  useEffect(() => {
    if (!shouldShowMainApp || !hydrated) {
      setLocked(false);
      setLockError('');
      return;
    }

    if (!biometricEnabled || !biometricAvailable) {
      setLocked(false);
      return;
    }

    setLocked(true);
    void promptForUnlock();
  }, [
    biometricAvailable,
    biometricEnabled,
    hydrated,
    promptForUnlock,
    shouldShowMainApp,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (!shouldShowMainApp || !hydrated || !biometricEnabled || unlockingRef.current) {
        return;
      }

      if (previousAppState === 'active' && nextAppState === 'background') {
        setLocked(true);
        return;
      }

      if (previousAppState === 'background' && nextAppState === 'active') {
        void (async () => {
          const available = await refreshBiometricAvailability();

          if (!available) {
            setLocked(false);
            return;
          }

          setLocked(true);
          await promptForUnlock();
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    biometricEnabled,
    hydrated,
    promptForUnlock,
    refreshBiometricAvailability,
    shouldShowMainApp,
  ]);

  const handleLockedSignOut = async () => {
    setUnlocking(true);
    try {
      await signOut(getAuth());
      setLocked(false);
      setLockError('');
    } catch (error: any) {
      setLockError(error.message ?? 'Unable to sign out right now.');
    } finally {
      unlockingRef.current = false;
      setUnlocking(false);
    }
  };

  if (initializing || !hydrated || !minimumSplashElapsed) {
    return (
      <View style={styles.loader}>
        <View style={styles.loaderImageFrame}>
          <Image source={SPLASH_IMAGE} style={styles.loaderImage} resizeMode="contain" />
        </View>
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#B25B63" />
        </View>
      </View>
    );
  }

  return (
    <PaperProvider theme={theme} settings={paperSettings}>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" />
        {shouldRequireBiometricUnlock && locked ? (
          <View style={styles.lockScreen}>
            <Surface style={styles.lockCard} elevation={3}>
              <Text variant="headlineMedium" style={styles.lockTitle}>
                Unlock your Love Space
              </Text>
              <Text style={styles.lockBody}>
                Use {biometricLabel} to reopen your private relationship space.
              </Text>
              {!!lockError && <Text style={styles.lockError}>{lockError}</Text>}
              <Button
                mode="contained"
                onPress={() => void promptForUnlock()}
                loading={unlocking}
                disabled={unlocking}
                style={styles.primaryButton}
              >
                Unlock with {biometricLabel}
              </Button>
              <Button
                mode="text"
                onPress={() => void handleLockedSignOut()}
                disabled={unlocking}
              >
                Sign Out Instead
              </Button>
            </Surface>
          </View>
        ) : shouldShowMainApp ? (
          <MainNavigator />
        ) : (
          <AuthStackNavigator />
        )}
      </NavigationContainer>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#EAD8C6',
  },
  loaderImageFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAD8C6',
  },
  loaderImage: {
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 243, 234, 0.04)',
  },
  lockScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFF3EA',
  },
  lockCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#F3C8BA',
    gap: 16,
  },
  lockTitle: {
    color: '#3F2831',
    fontWeight: '700',
    textAlign: 'center',
  },
  lockBody: {
    color: '#3F2831',
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.82,
  },
  lockError: {
    color: '#B25B63',
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
  },
});

export default App;
