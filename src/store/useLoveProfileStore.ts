import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LoveArea =
  | 'emotional'
  | 'physicalIntimate'
  | 'communication'
  | 'financial'
  | 'spiritual'
  | 'mental'
  | 'social'
  | 'partnership';

export type LovePreferenceImportance = 'low' | 'medium' | 'high' | 'essential';
export type LovePreferenceFrequency =
  | 'daily'
  | 'severalTimesWeekly'
  | 'weekly'
  | 'monthly'
  | 'occasionally'
  | 'surpriseMe';
export type LovePreferenceTiming = 'morning' | 'evening' | 'weekend' | 'anytime' | 'custom';
export type LovePreferenceVisibility = 'private' | 'shared' | 'surprise';
export type LovePreferenceSource = 'library' | 'custom';

export type LovePreference = {
  id: string;
  area: LoveArea;
  actionText: string;
  actionSource: LovePreferenceSource;
  importance: LovePreferenceImportance;
  frequency: LovePreferenceFrequency;
  timing: LovePreferenceTiming;
  customTiming: string | null;
  visibility: LovePreferenceVisibility;
  notes: string;
  createdAt: number;
  updatedAt: number;
  createdByUserId: string;
  createdByEmail: string;
};

type LoveProfileState = {
  hydrated: boolean;
  syncing: boolean;
  preferences: LovePreference[];
  setHydrated: (hydrated: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  replacePreferences: (preferences: LovePreference[]) => void;
  clearPreferences: () => void;
};

const LOVE_PROFILE_STORAGE_KEY = '@how2loveme/love-profile-store';

export const useLoveProfileStore = create<LoveProfileState>()(
  persist(
    set => ({
      hydrated: false,
      syncing: false,
      preferences: [],
      setHydrated: hydrated => set({ hydrated }),
      setSyncing: syncing => set({ syncing }),
      replacePreferences: preferences => set({ preferences }),
      clearPreferences: () => set({ preferences: [], syncing: false }),
    }),
    {
      name: LOVE_PROFILE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        preferences: state.preferences,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
