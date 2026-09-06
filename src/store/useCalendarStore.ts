import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CalendarFoodInterestFor = 'me' | 'partner' | 'both';

export type CalendarEvent = {
  id: string;
  title: string;
  note: string;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
  foodQuery: string;
  foodInterestFor: CalendarFoodInterestFor;
  restaurantPlaceId: string | null;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLatitude: number | null;
  restaurantLongitude: number | null;
  status: 'active' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  createdByUserId: string;
  createdByEmail: string;
};

type CalendarState = {
  hydrated: boolean;
  syncing: boolean;
  events: CalendarEvent[];
  selectedDateKey: string;
  visibleMonthKey: string;
  setHydrated: (hydrated: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  replaceEvents: (events: CalendarEvent[]) => void;
  setSelectedDateKey: (selectedDateKey: string) => void;
  setVisibleMonthKey: (visibleMonthKey: string) => void;
  clearEvents: () => void;
};

const CALENDAR_STORAGE_KEY = '@how2loveme/calendar-store';

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthKey() {
  return getTodayDateKey().slice(0, 7);
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    set => ({
      hydrated: false,
      syncing: false,
      events: [],
      selectedDateKey: getTodayDateKey(),
      visibleMonthKey: getCurrentMonthKey(),
      setHydrated: hydrated => set({ hydrated }),
      setSyncing: syncing => set({ syncing }),
      replaceEvents: events => set({ events }),
      setSelectedDateKey: selectedDateKey => set({ selectedDateKey }),
      setVisibleMonthKey: visibleMonthKey => set({ visibleMonthKey }),
      clearEvents: () =>
        set({
          events: [],
          syncing: false,
          selectedDateKey: getTodayDateKey(),
          visibleMonthKey: getCurrentMonthKey(),
        }),
    }),
    {
      name: CALENDAR_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        events: state.events,
        selectedDateKey: state.selectedDateKey,
        visibleMonthKey: state.visibleMonthKey,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
