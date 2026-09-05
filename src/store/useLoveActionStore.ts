import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  LoveArea,
  LovePreferenceFrequency,
  LovePreferenceImportance,
  LovePreferenceTiming,
  LovePreferenceVisibility,
} from './useLoveProfileStore';

export type LoveActionStatus =
  | 'proposed'
  | 'scheduled'
  | 'due'
  | 'performed'
  | 'confirmed'
  | 'appreciated'
  | 'needsAttention'
  | 'cancelled';

export type LoveAction = {
  id: string;
  title: string;
  area: LoveArea;
  preferenceId: string | null;
  notes: string;
  importance: LovePreferenceImportance;
  frequency: LovePreferenceFrequency;
  timing: LovePreferenceTiming;
  customTiming: string | null;
  visibility: LovePreferenceVisibility;
  status: LoveActionStatus;
  nextDueAt: number | null;
  lastCompletedAt: number | null;
  respondedAt: number | null;
  respondedByUserId: string | null;
  respondedByEmail: string | null;
  confirmationReaction: string | null;
  confirmationNote: string;
  appreciationReaction: string | null;
  appreciationNote: string;
  proposedByUserId: string;
  proposedByEmail: string;
  responsibleUserId: string;
  responsibleUserEmail: string;
  recipientUserId: string;
  recipientUserEmail: string;
  createdAt: number;
  updatedAt: number;
};

type LoveActionState = {
  hydrated: boolean;
  syncing: boolean;
  actions: LoveAction[];
  setHydrated: (hydrated: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  replaceActions: (actions: LoveAction[]) => void;
  clearActions: () => void;
};

const LOVE_ACTION_STORAGE_KEY = '@how2loveme/love-action-store';

export const useLoveActionStore = create<LoveActionState>()(
  persist(
    set => ({
      hydrated: false,
      syncing: false,
      actions: [],
      setHydrated: hydrated => set({ hydrated }),
      setSyncing: syncing => set({ syncing }),
      replaceActions: actions => set({ actions }),
      clearActions: () => set({ actions: [], syncing: false }),
    }),
    {
      name: LOVE_ACTION_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        actions: state.actions,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
