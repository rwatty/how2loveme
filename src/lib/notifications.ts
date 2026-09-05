import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@react-native-firebase/auth';
import {
  deleteToken,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';
import type { LoveAction } from '../store/useLoveActionStore';
import { useNotificationStore, type NotificationPermissionState } from '../store/useNotificationStore';
import {
  registerDevicePushToken,
  unregisterDevicePushToken,
} from './relationshipSync';

const DEVICE_INSTALLATION_ID_KEY = '@how2loveme/device-installation-id';
const LOVE_REMINDER_CHANNEL_ID = 'love-reminders';
const firebaseMessaging = getMessaging();

function mapAuthorizationStatus(status: number): NotificationPermissionState {
  switch (status) {
    case AuthorizationStatus.AUTHORIZED:
      return 'authorized';
    case AuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case AuthorizationStatus.DENIED:
      return 'denied';
    default:
      return 'unknown';
  }
}

async function getOrCreateInstallationId() {
  const stored = await AsyncStorage.getItem(DEVICE_INSTALLATION_ID_KEY);

  if (stored) {
    return stored;
  }

  const created = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_INSTALLATION_ID_KEY, created);
  return created;
}

async function ensureNotificationChannel() {
  if (Platform.OS !== 'android') {
    return LOVE_REMINDER_CHANNEL_ID;
  }

  return notifee.createChannel({
    id: LOVE_REMINDER_CHANNEL_ID,
    name: 'Love reminders',
    vibration: true,
    sound: 'default',
    importance: AndroidImportance.HIGH,
  });
}

function buildDueNotificationBody(action: LoveAction) {
  return action.status === 'due'
    ? `${action.title} is due now.`
    : `${action.title} is coming due soon.`;
}

async function unregisterInstallation(user: User, installationId: string) {
  try {
    await unregisterDevicePushToken(user, { installationId });
  } catch {}
}

export async function enableNotifications(user: User) {
  await ensureNotificationChannel();
  const settings = await notifee.requestPermission();
  const permission = mapAuthorizationStatus(settings.authorizationStatus);
  useNotificationStore.getState().setPermission(permission);

  if (permission !== 'authorized' && permission !== 'provisional') {
    useNotificationStore.getState().setEnabled(false);
    throw new Error('Notification permission was not granted on this device.');
  }

  await registerDeviceForRemoteMessages(firebaseMessaging);
  const token = await getToken(firebaseMessaging);
  const installationId = await getOrCreateInstallationId();
  await registerDevicePushToken(user, {
    installationId,
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });

  useNotificationStore.getState().setEnabled(true);
  useNotificationStore.getState().setToken(token);
  useNotificationStore.getState().setLastSyncedAt(Date.now());
  return token;
}

export async function disableNotifications(user: User | null) {
  const installationId = await getOrCreateInstallationId();

  if (user) {
    await unregisterInstallation(user, installationId);
  }

  try {
    await deleteToken(firebaseMessaging);
  } catch {}

  await notifee.cancelTriggerNotifications();
  useNotificationStore.getState().setEnabled(false);
  useNotificationStore.getState().setToken(null);
  useNotificationStore.getState().setLastSyncedAt(Date.now());
}

export async function refreshPushRegistration(user: User) {
  const store = useNotificationStore.getState();

  if (!store.enabled) {
    return null;
  }

  await ensureNotificationChannel();
  const settings = await notifee.getNotificationSettings();
  const permission = mapAuthorizationStatus(settings.authorizationStatus);
  store.setPermission(permission);

  if (permission !== 'authorized' && permission !== 'provisional') {
    const installationId = await getOrCreateInstallationId();
    await unregisterInstallation(user, installationId);

    try {
      await deleteToken(firebaseMessaging);
    } catch {}

    await notifee.cancelTriggerNotifications();
    store.setEnabled(false);
    store.setToken(null);
    store.setLastSyncedAt(Date.now());
    return null;
  }

  await registerDeviceForRemoteMessages(firebaseMessaging);
  const token = await getToken(firebaseMessaging);
  const installationId = await getOrCreateInstallationId();
  await registerDevicePushToken(user, {
    installationId,
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });

  store.setToken(token);
  store.setLastSyncedAt(Date.now());
  return token;
}

export function subscribeToTokenRefresh(user: User) {
  return onTokenRefresh(firebaseMessaging, async (token: string) => {
    try {
      const installationId = await getOrCreateInstallationId();
      await registerDevicePushToken(user, {
        installationId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      });
      useNotificationStore.getState().setToken(token);
      useNotificationStore.getState().setLastSyncedAt(Date.now());
    } catch {}
  });
}

export function subscribeToForegroundMessages() {
  return onMessage(firebaseMessaging, async (message: RemoteMessage) => {
    await ensureNotificationChannel();
    await notifee.displayNotification({
      title: message.notification?.title ?? 'Love reminder',
      body: message.notification?.body ?? 'You have a new relationship reminder.',
      android: {
        channelId: LOVE_REMINDER_CHANNEL_ID,
        pressAction: { id: 'default' },
      },
      ios: {
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
      },
    });
  });
}

export async function syncDueActionNotifications(actions: LoveAction[], currentUserId: string | null, enabled: boolean) {
  await ensureNotificationChannel();
  await notifee.cancelTriggerNotifications();

  if (!enabled || !currentUserId) {
    return;
  }

  const upcomingDueActions = actions
    .filter(
      action =>
        action.responsibleUserId === currentUserId
        && !!action.nextDueAt
        && action.nextDueAt > Date.now()
        && action.status !== 'appreciated'
        && action.status !== 'cancelled',
    )
    .sort((left, right) => (left.nextDueAt ?? 0) - (right.nextDueAt ?? 0))
    .slice(0, 12);

  await Promise.all(
    upcomingDueActions.map(async action => {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: action.nextDueAt!,
      };

      return notifee.createTriggerNotification(
        {
          id: `love-action-due-${action.id}`,
          title: 'Love Action due',
          body: buildDueNotificationBody(action),
          android: {
            channelId: LOVE_REMINDER_CHANNEL_ID,
            pressAction: { id: 'default' },
          },
          ios: {
            foregroundPresentationOptions: {
              alert: true,
              badge: true,
              sound: true,
            },
          },
        },
        trigger,
      );
    }),
  );
}
