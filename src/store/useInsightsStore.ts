import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type InsightVisibility = 'private' | 'decideLater' | 'shared';

export type InsightEntry = {
  id: string;
  mood: number;
  connection: number;
  tension: number;
  appreciation: string;
  need: string;
  reflection: string;
  nextStep: string;
  visibility: InsightVisibility;
  sharedInsightId: string | null;
  createdAt: number;
  updatedAt: number;
  createdByUserId: string;
  createdByEmail: string;
};

type InsightsState = {
  hydrated: boolean;
  syncingPrivate: boolean;
  syncingShared: boolean;
  privateEntries: InsightEntry[];
  sharedEntries: InsightEntry[];
  setHydrated: (hydrated: boolean) => void;
  setSyncingPrivate: (syncing: boolean) => void;
  setSyncingShared: (syncing: boolean) => void;
  replacePrivateEntries: (entries: InsightEntry[]) => void;
  replaceSharedEntries: (entries: InsightEntry[]) => void;
  clearEntries: () => void;
};

const INSIGHTS_STORAGE_KEY = '@how2loveme/insights-store';

export const useInsightsStore = create<InsightsState>()(
  persist(
    set => ({
      hydrated: false,
      syncingPrivate: false,
      syncingShared: false,
      privateEntries: [],
      sharedEntries: [],
      setHydrated: hydrated => set({ hydrated }),
      setSyncingPrivate: syncingPrivate => set({ syncingPrivate }),
      setSyncingShared: syncingShared => set({ syncingShared }),
      replacePrivateEntries: privateEntries => set({ privateEntries }),
      replaceSharedEntries: sharedEntries => set({ sharedEntries }),
      clearEntries: () =>
        set({
          privateEntries: [],
          sharedEntries: [],
          syncingPrivate: false,
          syncingShared: false,
        }),
    }),
    {
      name: INSIGHTS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        privateEntries: state.privateEntries,
        sharedEntries: state.sharedEntries,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
