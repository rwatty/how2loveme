import React, { useMemo, useState } from 'react';
import { Image, Platform, View, StyleSheet } from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
} from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AppleButton, appleAuth } from '@invertase/react-native-apple-authentication';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStackNavigator';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const AUTH_LOGO = require('../../assets/splash/logo.png');
const GOOGLE_WEB_CLIENT_ID =
  '588803260791-c2g4ed2796lt58179dcr2ptjjna8bd08.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  '588803260791-7ju31f95247f186v57pdvvofji686e25.apps.googleusercontent.com';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

function getFriendlyAuthError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'We could not match that email and password.';
    case 'auth/wrong-password':
      return 'That password does not look right.';
    case 'auth/weak-password':
      return 'Choose a stronger password with at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled for this Firebase project yet. Turn on Email/Password in Firebase Console → Authentication → Sign-in method.';
    default:
      return error.message ?? 'Something went wrong. Please try again.';
  }
}

function getFriendlyGoogleError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return 'Google sign-in was cancelled.';
    case statusCodes.IN_PROGRESS:
      return 'Google sign-in is already in progress.';
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return 'Google Play Services is unavailable on this device.';
    default:
      return error.message ?? 'Unable to sign in with Google right now.';
  }
}

function getFriendlyAppleError(error: { code?: string; message?: string; domain?: string }) {
  const nativeDetails = error.code ? ` Native error: ${error.code}.` : '';

  switch (error.code) {
    case appleAuth.Error.CANCELED:
      return 'Apple sign-in was cancelled.';
    case appleAuth.Error.INVALID_RESPONSE:
      return 'Apple sign-in returned an invalid response.';
    case appleAuth.Error.NOT_HANDLED:
      return 'Apple sign-in could not be completed on this device.';
    case '1000':
      if (error.domain === 'com.apple.AuthenticationServices.AuthorizationError') {
        return `Apple sign-in failed before Firebase. In Simulator, sign in to an Apple ID in Settings. On device, verify Sign in with Apple is enabled for com.firstgenesis.how2loveme and refresh provisioning.${nativeDetails}`;
      }
      return error.message ?? 'Unable to sign in with Apple right now.';
    default:
      return error.message ?? 'Unable to sign in with Apple right now.';
  }
}

function toAppleErrorLog(error: any) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    domain: error?.domain ?? null,
    name: error?.name ?? null,
    userInfo: error?.userInfo ?? null,
    nativeStackIOS: error?.nativeStackIOS ?? null,
    stack: error?.stack ?? null,
    cause:
      error?.cause && typeof error.cause === 'object'
        ? {
            code: error.cause.code ?? null,
            message: error.cause.message ?? null,
            domain: error.cause.domain ?? null,
            userInfo: error.cause.userInfo ?? null,
          }
        : error?.cause ?? null,
  };
}

export default function AuthScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [error, setError] = useState('');
  const trimmedEmail = email.trim();

  const emailError = useMemo(
    () => trimmedEmail.length > 0 && !EMAIL_REGEX.test(trimmedEmail),
    [trimmedEmail],
  );
  const passwordError = useMemo(() => {
    if (password.length === 0) {
      return false;
    }
    return mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH;
  }, [mode, password]);
  const canSubmit =
    !loading &&
    trimmedEmail.length > 0 &&
    password.length > 0 &&
    !emailError &&
    !passwordError;

  async function handleAuth() {
    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setSnackbar('');
    setError('');

    try {
      const firebaseAuth = getAuth();

      if (mode === 'signUp') {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          trimmedEmail,
          password,
        );
        await sendEmailVerification(credential.user);
        setSnackbar('Account created. Check your inbox to verify your email.');
        navigation.navigate('EmailVerification');
        return;
      }

      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        trimmedEmail,
        password,
      );

      if (!credential.user.emailVerified) {
        setSnackbar('Please verify your email before continuing.');
        navigation.navigate('EmailVerification');
      }
    } catch (e: any) {
      setError(getFriendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setSnackbar('');
    setError('');

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success') {
        setSnackbar('Google sign-in was cancelled.');
        return;
      }

      const { idToken } = response.data;

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), credential);
      setSnackbar('Signed in with Google.');
    } catch (e: any) {
      setError(getFriendlyGoogleError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setLoading(true);
    setSnackbar('');
    setError('');

    try {
      console.log('[Apple Sign-In] Starting native Apple sign-in request');
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      const { identityToken, nonce, fullName, user, email, state, realUserStatus } =
        appleAuthRequestResponse;

      console.log('[Apple Sign-In] Native Apple sign-in succeeded', {
        user,
        email,
        state: state ?? null,
        realUserStatus: realUserStatus ?? null,
        hasIdentityToken: Boolean(identityToken),
        hasNonce: Boolean(nonce),
        hasFullName: Boolean(fullName),
      });

      if (!identityToken) {
        throw new Error('Apple sign-in did not return an identity token.');
      }

      if (!nonce) {
        throw new Error('Apple sign-in did not return a nonce.');
      }

      const appleProvider = new OAuthProvider('apple.com');
      const credential = appleProvider.credential({
        idToken: identityToken,
        rawNonce: nonce,
        fullName: fullName ?? undefined,
      });

      console.log('[Apple Sign-In] Exchanging Apple credential with Firebase');
      await signInWithCredential(getAuth(), credential);
      console.log('[Apple Sign-In] Firebase credential exchange succeeded');
      setSnackbar('Signed in with Apple.');
    } catch (e: any) {
      console.log('[Apple Sign-In] Failed', toAppleErrorLog(e));
      setError(getFriendlyAppleError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.card} elevation={2}>
        <Image source={AUTH_LOGO} style={styles.logo} resizeMode="contain" />
        <Text variant="headlineMedium" style={styles.header}>
          {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={styles.subheader}>
          {mode === 'signIn'
            ? 'Pick up where intentional love left off.'
            : 'Start with a secure account you can build your Love Space around.'}
        </Text>
        <SegmentedButtons
          value={mode}
          onValueChange={val => setMode(val as 'signIn' | 'signUp')}
          buttons={[
            { value: 'signIn', label: 'Sign In' },
            { value: 'signUp', label: 'Sign Up' },
          ]}
          style={styles.segments}
        />
        <TextInput
          mode="outlined"
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          disabled={loading}
          error={emailError}
          left={<TextInput.Icon icon="email-outline" />}
        />
        <HelperText type="error" visible={emailError}>
          Please enter a valid email address.
        </HelperText>
        <TextInput
          mode="outlined"
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={secureTextEntry}
          style={styles.input}
          disabled={loading}
          error={passwordError}
          left={<TextInput.Icon icon="lock-outline" />}
          right={
            <TextInput.Icon
              icon={secureTextEntry ? 'eye-off-outline' : 'eye-outline'}
              onPress={() => setSecureTextEntry(current => !current)}
            />
          }
        />
        <HelperText type={passwordError ? 'error' : 'info'} visible>
          {mode === 'signUp'
            ? 'Use at least 8 characters for a stronger password.'
            : 'Use the password tied to your account.'}
        </HelperText>
        <Button
          mode="contained"
          loading={loading}
          onPress={handleAuth}
          style={styles.button}
          contentStyle={styles.buttonContent}
          disabled={!canSubmit}
        >
          {mode === 'signIn' ? 'Sign In' : 'Create Account'}
        </Button>
        <Button
          mode="outlined"
          icon="google"
          onPress={handleGoogleSignIn}
          style={styles.secondaryButton}
          contentStyle={styles.buttonContent}
          disabled={loading}
        >
          Continue with Google
        </Button>
        {Platform.OS === 'ios' && appleAuth.isSupported ? (
          <AppleButton
            buttonStyle={AppleButton.Style.WHITE}
            buttonType={AppleButton.Type.SIGN_IN}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        ) : null}
        {mode === 'signIn' ? (
          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.link}
            compact
            disabled={loading}
          >
            Forgot Password?
          </Button>
        ) : null}
        {loading ? <ActivityIndicator style={styles.loader} /> : null}
      </Surface>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={3500}
        style={styles.snackbar}
      >
        {snackbar}
      </Snackbar>
      <Snackbar
        visible={!!error}
        onDismiss={() => setError('')}
        duration={4000}
        style={[styles.snackbar, styles.errorSnackbar]}
      >
        {error}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#FFF3EA',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#F3C8BA',
  },
  logo: {
    alignSelf: 'center',
    width: 188,
    height: 188,
    marginBottom: 14,
  },
  header: {
    color: '#3F2831',
    fontWeight: '700',
    textAlign: 'center',
  },
  subheader: {
    color: '#3F2831',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 22,
    opacity: 0.76,
  },
  input: {
    backgroundColor: '#FFF3EA',
  },
  segments: {
    marginBottom: 16,
  },
  button: {
    borderRadius: 14,
    marginTop: 8,
  },
  secondaryButton: {
    borderRadius: 14,
    marginTop: 12,
  },
  appleButton: {
    marginTop: 12,
    width: '100%',
    height: 52,
  },
  buttonContent: {
    height: 52,
  },
  link: {
    alignSelf: 'center',
    marginTop: 4,
  },
  loader: {
    marginTop: 12,
  },
  snackbar: {
    marginHorizontal: 16,
    borderRadius: 12,
  },
  errorSnackbar: {
    backgroundColor: '#B25B63',
  },
});
