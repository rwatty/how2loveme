import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AuthStackNavigator';

const WELCOME_LOGO = require('../../assets/splash/logo.png');

export default function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <View style={styles.container}>
      <Image source={WELCOME_LOGO} style={styles.logoImage} resizeMode="contain" />
      <Text variant="displaySmall" style={styles.title}>Welcome!</Text>
      <Text variant="titleMedium" style={styles.subtitle}>
        Intentional Love Made Easy.
      </Text>
      <Button
        mode="contained"
        onPress={() => navigation.navigate('Auth')}
        style={styles.button}
        contentStyle={styles.buttonContent}
      >
        Get Started
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF3EA',
    paddingHorizontal: 28,
  },
  logoImage: {
    width: 220,
    height: 220,
    marginBottom: 18,
  },
  title: {
    color: '#B25B63',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#3F2831',
    textAlign: 'center',
    marginBottom: 34,
  },
  button: {
    backgroundColor: '#B25B63',
    borderRadius: 10,
    minWidth: 200,
  },
  buttonContent: {
    height: 50,
  },
});
