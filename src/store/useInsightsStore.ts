import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RelationshipMetricSnapshot } from '../lib/relationshipMetrics';

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
  syncingSnapshots: boolean;
  privateEntries: InsightEntry[];
  sharedEntries: InsightEntry[];
  metricSnapshots: RelationshipMetricSnapshot[];
  setHydrated: (hydrated: boolean) => void;
  setSyncingPrivate: (syncing: boolean) => void;
  setSyncingShared: (syncing: boolean) => void;
  setSyncingSnapshots: (syncing: boolean) => void;
  replacePrivateEntries: (entries: InsightEntry[]) => void;
  replaceSharedEntries: (entries: InsightEntry[]) => void;
  replaceMetricSnapshots: (snapshots: RelationshipMetricSnapshot[]) => void;
  clearEntries: () => void;
};

const INSIGHTS_STORAGE_KEY = '@how2loveme/insights-store';

export const useInsightsStore = create<InsightsState>()(
  persist(
    set => ({
      hydrated: false,
      syncingPrivate: false,
      syncingShared: false,
      syncingSnapshots: false,
      privateEntries: [],
      sharedEntries: [],
      metricSnapshots: [],
      setHydrated: hydrated => set({ hydrated }),
      setSyncingPrivate: syncingPrivate => set({ syncingPrivate }),
      setSyncingShared: syncingShared => set({ syncingShared }),
      setSyncingSnapshots: syncingSnapshots => set({ syncingSnapshots }),
      replacePrivateEntries: privateEntries => set({ privateEntries }),
      replaceSharedEntries: sharedEntries => set({ sharedEntries }),
      replaceMetricSnapshots: metricSnapshots => set({ metricSnapshots }),
      clearEntries: () =>
        set({
          privateEntries: [],
          sharedEntries: [],
          metricSnapshots: [],
          syncingPrivate: false,
          syncingShared: false,
          syncingSnapshots: false,
        }),
    }),
    {
      name: INSIGHTS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        privateEntries: state.privateEntries,
        sharedEntries: state.sharedEntries,
        metricSnapshots: state.metricSnapshots,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
