import { create } from 'zustand';
import type { BiometryType } from 'react-native-biometrics';

type SupportedBiometryType = BiometryType | null;

type BiometricLockState = {
  hydrated: boolean;
  enabled: boolean;
  available: boolean;
  biometryType: SupportedBiometryType;
  setHydrated: (hydrated: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  setAvailability: (available: boolean, biometryType: SupportedBiometryType) => void;
};

export const useBiometricLockStore = create<BiometricLockState>(set => ({
  hydrated: false,
  enabled: false,
  available: false,
  biometryType: null,
  setHydrated: hydrated => set({ hydrated }),
  setEnabled: enabled => set({ enabled }),
  setAvailability: (available, biometryType) => set({ available, biometryType }),
}));
