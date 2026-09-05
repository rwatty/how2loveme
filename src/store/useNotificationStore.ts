import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type NotificationPermissionState = 'unknown' | 'denied' | 'authorized' | 'provisional';

type NotificationState = {
  hydrated: boolean;
  enabled: boolean;
  permission: NotificationPermissionState;
  token: string | null;
  lastSyncedAt: number | null;
  setHydrated: (hydrated: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setPermission: (permission: NotificationPermissionState) => void;
  setToken: (token: string | null) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  reset: () => void;
};

const NOTIFICATION_STORAGE_KEY = '@how2loveme/notification-store';

export const useNotificationStore = create<NotificationState>()(
  persist(
    set => ({
      hydrated: false,
      enabled: false,
      permission: 'unknown',
      token: null,
      lastSyncedAt: null,
      setHydrated: hydrated => set({ hydrated }),
      setEnabled: enabled => set({ enabled }),
      setPermission: permission => set({ permission }),
      setToken: token => set({ token }),
      setLastSyncedAt: lastSyncedAt => set({ lastSyncedAt }),
      reset: () =>
        set({
          enabled: false,
          permission: 'unknown',
          token: null,
          lastSyncedAt: null,
        }),
    }),
    {
      name: NOTIFICATION_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        enabled: state.enabled,
        permission: state.permission,
        token: state.token,
        lastSyncedAt: state.lastSyncedAt,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
