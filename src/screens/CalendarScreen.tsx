import React, { useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import Geolocation from '@react-native-community/geolocation';
import {
  Button,
  Card,
  Dialog,
  HelperText,
  Portal,
  SegmentedButtons,
  Snackbar,
  Surface,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import JumpToSectionFab, { type JumpSection } from '../components/JumpToSectionFab';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  searchNearbyRestaurants,
  type NearbyRestaurant,
  updateCalendarEvent,
} from '../lib/relationshipSync';
import { MainTabParamList } from '../navigation/MainNavigator';
import { type CalendarEvent, type CalendarFoodInterestFor, useCalendarStore } from '../store/useCalendarStore';
import { useLoveActionStore } from '../store/useLoveActionStore';
import { useRelationshipStore } from '../store/useRelationshipStore';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_RESTAURANT_SEARCH_RADIUS_MILES = 15;
const MIN_RESTAURANT_SEARCH_RADIUS_MILES = 1;
const MAX_RESTAURANT_SEARCH_RADIUS_MILES = 30;
const CALENDAR_JUMP_SECTIONS: JumpSection[] = [
  { key: 'month', label: 'Month View' },
  { key: 'agenda', label: 'Day Agenda' },
  { key: 'dueActions', label: 'Due Love Actions' },
];

type CalendarDayCell = {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
};

type DayEventMeta = {
  count: number;
  spanningCount: number;
};

type PickerTarget = 'startDate' | 'endDate' | 'startTime' | 'endTime' | null;

type QuickAction = {
  key: 'tomorrow' | 'this-weekend' | 'next-week';
  label: string;
  startDateKey: string;
  endDateKey: string;
  allDay: boolean;
};

function getFoodInterestOptions(isConnected: boolean) {
  return [
    { value: 'me', label: 'Me' },
    { value: 'partner', label: isConnected ? 'Partner' : 'Later' },
    { value: 'both', label: 'Both' },
  ];
}

function getFoodInterestSummary(value: CalendarFoodInterestFor, isConnected: boolean) {
  switch (value) {
    case 'partner':
      return isConnected ? 'Searching with your partner in mind.' : 'Saving this as a future partner idea.';
    case 'both':
      return 'Searching for something both of you could enjoy.';
    default:
      return 'Searching with your own craving in mind.';
  }
}

function parseSearchRadiusMiles(value: string) {
  const trimmed = value.trim();

  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return null;
  }

  const numeric = Number(trimmed);

  if (
    !Number.isFinite(numeric)
    || numeric < MIN_RESTAURANT_SEARCH_RADIUS_MILES
    || numeric > MAX_RESTAURANT_SEARCH_RADIUS_MILES
  ) {
    return null;
  }

  return numeric;
}

function buildAppleMapsUrl(name: string, latitude: number, longitude: number) {
  return `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${encodeURIComponent(name)}`;
}

function buildGoogleMapsUrl(placeId: string | null, latitude: number, longitude: number) {
  const query = new URLSearchParams({
    api: '1',
    destination: `${latitude},${longitude}`,
  });

  if (placeId) {
    query.set('destination_place_id', placeId);
  }

  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

async function ensureLocationPermission() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return new Promise<boolean>(resolve => {
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    );
  });
}

function getFriendlyLocationError(error: { code?: number; message?: string }) {
  switch (error.code) {
    case 1:
      return 'Location permission is required to search for nearby restaurants.';
    case 2:
      return 'Your location is unavailable right now. Try again in a moment.';
    case 3:
      return 'Location lookup timed out. Try again where GPS reception is stronger.';
    default:
      return error.message ?? 'Unable to read your current location right now.';
  }
}

async function getCurrentCoordinates() {
  const granted = await ensureLocationPermission();

  if (!granted) {
    throw new Error('Location permission is required to search for nearby restaurants.');
  }

  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      error => {
        reject(new Error(getFriendlyLocationError(error)));
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000,
      },
    );
  });
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function shiftMonth(monthKey: string, delta: number) {
  const next = parseMonthKey(monthKey);
  next.setMonth(next.getMonth() + delta);
  return formatMonthKey(next);
}

function shiftDateKey(dateKey: string, delta: number) {
  const next = parseDateKey(dateKey);
  next.setDate(next.getDate() + delta);
  return formatDateKey(next);
}

function getMonthGrid(monthKey: string) {
  const firstOfMonth = parseMonthKey(monthKey);
  const start = new Date(firstOfMonth);
  start.setDate(1 - start.getDay());
  const todayKey = formatDateKey(new Date());
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    cells.push({
      dateKey: formatDateKey(date),
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === firstOfMonth.getMonth(),
      isToday: formatDateKey(date) === todayKey,
    });
  }

  return Array.from({ length: 6 }, (_, weekIndex) => cells.slice(weekIndex * 7, weekIndex * 7 + 7));
}

function formatMonthTitle(monthKey: string) {
  return parseMonthKey(monthKey).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthName(monthKey: string) {
  return parseMonthKey(monthKey).toLocaleDateString(undefined, {
    month: 'long',
  });
}

function formatSelectedDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateInput(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCompactDateInput(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatTimeForDisplay(date: Date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLoveActionDueLabel(timestamp: number | null) {
  if (!timestamp) {
    return 'No due time set';
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(date: Date | number) {
  const value = typeof date === 'number' ? new Date(date) : new Date(date);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(date: Date | number) {
  const value = startOfDay(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getEventStartDate(event: CalendarEvent) {
  return new Date(event.startsAt);
}

function getEventEndDate(event: CalendarEvent) {
  if (!event.endsAt) {
    return event.allDay ? endOfDay(event.startsAt) : new Date(event.startsAt);
  }

  return event.allDay ? endOfDay(event.endsAt) : new Date(event.endsAt);
}

function getEventStartDateKey(event: CalendarEvent) {
  return formatDateKey(getEventStartDate(event));
}

function getEventEndDateKey(event: CalendarEvent) {
  return formatDateKey(getEventEndDate(event));
}

function getEventDateKeys(event: CalendarEvent) {
  const keys: string[] = [];
  const cursor = startOfDay(event.startsAt);
  const last = startOfDay(getEventEndDate(event));

  while (cursor.getTime() <= last.getTime()) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function eventTouchesDateKey(event: CalendarEvent, dateKey: string) {
  return getEventDateKeys(event).includes(dateKey);
}

function eventTouchesMonthKey(event: CalendarEvent, monthKey: string) {
  const monthStart = parseMonthKey(monthKey);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
  const eventStart = startOfDay(event.startsAt);
  const eventEnd = getEventEndDate(event);
  return eventStart.getTime() <= monthEnd.getTime() && eventEnd.getTime() >= monthStart.getTime();
}

function getDaysSpanned(event: CalendarEvent) {
  const start = startOfDay(event.startsAt).getTime();
  const end = startOfDay(getEventEndDate(event)).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function formatEventTime(event: CalendarEvent) {
  const start = getEventStartDate(event);
  const end = getEventEndDate(event);
  const startKey = getEventStartDateKey(event);
  const endKey = getEventEndDateKey(event);

  if (event.allDay) {
    if (startKey === endKey) {
      return 'All day';
    }

    return `${formatDateInput(startKey)} - ${formatDateInput(endKey)} · All day`;
  }

  const startLabel = formatTimeForDisplay(start);

  if (!event.endsAt) {
    return startKey === endKey ? startLabel : `${formatDateInput(startKey)} at ${startLabel}`;
  }

  const endLabel = formatTimeForDisplay(end);

  if (startKey === endKey) {
    return `${startLabel} - ${endLabel}`;
  }

  return `${formatDateInput(startKey)} ${startLabel} - ${formatDateInput(endKey)} ${endLabel}`;
}

function getEventRangeLabel(event: CalendarEvent) {
  const daysSpanned = getDaysSpanned(event);

  if (daysSpanned <= 1) {
    return null;
  }

  return daysSpanned === 2 ? '2-day plan' : `${daysSpanned}-day plan`;
}

function getEventSelectedDayStatus(event: CalendarEvent, dateKey: string) {
  const startKey = getEventStartDateKey(event);
  const endKey = getEventEndDateKey(event);

  if (startKey === endKey || startKey === dateKey) {
    return null;
  }

  if (endKey === dateKey) {
    return 'Ends today';
  }

  return 'Continues today';
}

function getAgendaLabel(count: number) {
  if (count === 1) {
    return '1 plan';
  }

  return `${count} plans`;
}

function getDayBadgeLabel(count: number, spanningCount: number) {
  if (count <= 0) {
    return '';
  }

  if (spanningCount > 0) {
    if (count === 1) {
      return '1 continuing plan';
    }

    return spanningCount === count ? `${count} plans span` : `${count} plans · ${spanningCount} span`;
  }

  return count === 1 ? '1 plan' : `${count} plans`;
}

function getDayOverflowLabel(count: number) {
  if (count <= 3) {
    return null;
  }

  return `+${count - 3}`;
}

function getMonthSummaryLabel(count: number) {
  if (count === 0) {
    return 'Start shaping this month together';
  }

  return count === 1 ? '1 plan this month' : `${count} plans this month`;
}

function getMonthChipLabel(event: CalendarEvent) {
  const trimmedTitle = event.title.trim();

  if (trimmedTitle.length <= 9) {
    return trimmedTitle;
  }

  return `${trimmedTitle.slice(0, 8)}…`;
}

function getDayAccessibilityLabel(day: CalendarDayCell, eventMeta?: DayEventMeta, selected?: boolean, dueCount = 0) {
  const dateLabel = formatSelectedDate(day.dateKey);
  const count = eventMeta?.count ?? 0;
  const planLabel = count === 0 ? 'No plans yet' : getAgendaLabel(count);
  const dueLabel = dueCount === 0 ? 'No Love Actions due' : `${dueCount} Love Action${dueCount === 1 ? '' : 's'} due`;
  return `${dateLabel}. ${planLabel}. ${dueLabel}.${selected ? ' Selected.' : ''}`;
}

function buildEventDate(dateKey: string, timeValue?: string) {
  const base = parseDateKey(dateKey);

  if (!timeValue) {
    base.setHours(0, 0, 0, 0);
    return base;
  }

  const match = timeValue.match(TIME_REGEX);

  if (!match) {
    throw new Error('Use 24-hour time like 18:30.');
  }

  base.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return base;
}

function getDraftSummary(startDateKey: string, endDateKey: string, allDay: boolean, startTime: string, endTime: string) {
  if (allDay) {
    return startDateKey === endDateKey
      ? `All day on ${formatDateInput(startDateKey)}`
      : `All day from ${formatDateInput(startDateKey)} to ${formatDateInput(endDateKey)}`;
  }

  if (!TIME_REGEX.test(startTime)) {
    return 'Add a valid start time using 24-hour time.';
  }

  const startLabel = `${formatDateInput(startDateKey)} at ${startTime}`;

  if (!endTime) {
    return endDateKey === startDateKey
      ? `Starts ${startLabel}`
      : `Starts ${startLabel} and continues past midnight`;
  }

  if (!TIME_REGEX.test(endTime)) {
    return 'Add a valid end time using 24-hour time.';
  }

  return `From ${startLabel} to ${formatDateInput(endDateKey)} at ${endTime}`;
}

function buildQuickActions(baseDate = new Date()): QuickAction[] {
  const tomorrow = new Date(baseDate);
  tomorrow.setDate(baseDate.getDate() + 1);

  const weekendStart = new Date(baseDate);
  const daysUntilSaturday = (6 - baseDate.getDay() + 7) % 7;
  weekendStart.setDate(baseDate.getDate() + daysUntilSaturday);
  const weekendEnd = new Date(weekendStart);
  weekendEnd.setDate(weekendStart.getDate() + 1);

  const nextWeekStart = new Date(baseDate);
  const daysUntilNextMonday = ((8 - baseDate.getDay()) % 7) || 7;
  nextWeekStart.setDate(baseDate.getDate() + daysUntilNextMonday);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

  return [
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      startDateKey: formatDateKey(tomorrow),
      endDateKey: formatDateKey(tomorrow),
      allDay: false,
    },
    {
      key: 'this-weekend',
      label: 'This weekend',
      startDateKey: formatDateKey(weekendStart),
      endDateKey: formatDateKey(weekendEnd),
      allDay: true,
    },
    {
      key: 'next-week',
      label: 'Next week',
      startDateKey: formatDateKey(nextWeekStart),
      endDateKey: formatDateKey(nextWeekEnd),
      allDay: true,
    },
  ];
}

function createPreviewEvents(userId?: string, userEmail?: string): CalendarEvent[] {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const ownerId = userId ?? 'preview-user';
  const ownerEmail = userEmail ?? 'you@preview.local';
  const partnerEmail = 'partner@preview.local';

  const dateWithTime = (dayOffset: number, hour: number, minute = 0) => {
    const next = new Date(startOfToday);
    next.setDate(startOfToday.getDate() + dayOffset);
    next.setHours(hour, minute, 0, 0);
    return next.getTime();
  };

  const allDayDate = (dayOffset: number) => {
    const next = new Date(startOfToday);
    next.setDate(startOfToday.getDate() + dayOffset);
    return next.getTime();
  };

  const createdAt = Date.now();

  return [
    {
      id: 'preview-1',
      title: 'Date night reservation',
      note: 'Dress up a little and leave the phones away.',
      startsAt: dateWithTime(2, 19, 0),
      endsAt: dateWithTime(2, 21, 0),
      allDay: false,
      foodQuery: '',
      foodInterestFor: 'both',
      restaurantPlaceId: null,
      restaurantName: '',
      restaurantAddress: '',
      restaurantLatitude: null,
      restaurantLongitude: null,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      createdByUserId: ownerId,
      createdByEmail: ownerEmail,
    },
    {
      id: 'preview-2',
      title: 'Cabin overnight reset',
      note: 'Drive out after dinner, sleep in, and keep the phones mostly away.',
      startsAt: dateWithTime(4, 18, 30),
      endsAt: dateWithTime(5, 10, 0),
      allDay: false,
      foodQuery: '',
      foodInterestFor: 'both',
      restaurantPlaceId: null,
      restaurantName: '',
      restaurantAddress: '',
      restaurantLatitude: null,
      restaurantLongitude: null,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      createdByUserId: ownerId,
      createdByEmail: ownerEmail,
    },
    {
      id: 'preview-3',
      title: 'Anniversary planning weekend',
      note: 'Collect ideas, playlists, and one surprise each.',
      startsAt: allDayDate(7),
      endsAt: allDayDate(9),
      allDay: true,
      foodQuery: '',
      foodInterestFor: 'both',
      restaurantPlaceId: null,
      restaurantName: '',
      restaurantAddress: '',
      restaurantLatitude: null,
      restaurantLongitude: null,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      createdByUserId: 'preview-partner',
      createdByEmail: partnerEmail,
    },
    {
      id: 'preview-4',
      title: 'Therapy session',
      note: 'Join five minutes early and bring the notes from last week.',
      startsAt: dateWithTime(9, 18, 0),
      endsAt: dateWithTime(9, 19, 0),
      allDay: false,
      foodQuery: '',
      foodInterestFor: 'both',
      restaurantPlaceId: null,
      restaurantName: '',
      restaurantAddress: '',
      restaurantLatitude: null,
      restaurantLongitude: null,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
      createdByUserId: 'preview-partner',
      createdByEmail: partnerEmail,
    },
  ];
}

export default function CalendarScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const insets = useSafeAreaInsets();
  const user = getAuth().currentUser;
  const profile = useRelationshipStore(state => state.profile);
  const relationshipSyncing = useRelationshipStore(state => state.syncing);
  const relationshipError = useRelationshipStore(state => state.error);
  const hydrated = useCalendarStore(state => state.hydrated);
  const syncing = useCalendarStore(state => state.syncing);
  const events = useCalendarStore(state => state.events);
  const loveActions = useLoveActionStore(state => state.actions);
  const selectedDateKey = useCalendarStore(state => state.selectedDateKey);
  const visibleMonthKey = useCalendarStore(state => state.visibleMonthKey);
  const setSelectedDateKey = useCalendarStore(state => state.setSelectedDateKey);
  const setVisibleMonthKey = useCalendarStore(state => state.setVisibleMonthKey);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [startDateKey, setStartDateKey] = useState(selectedDateKey);
  const [endDateKey, setEndDateKey] = useState(selectedDateKey);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [foodQuery, setFoodQuery] = useState('');
  const [searchRadiusMiles, setSearchRadiusMiles] = useState(String(DEFAULT_RESTAURANT_SEARCH_RADIUS_MILES));
  const [foodInterestFor, setFoodInterestFor] = useState<CalendarFoodInterestFor>('me');
  const [restaurantResults, setRestaurantResults] = useState<NearbyRestaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<NearbyRestaurant | null>(null);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState('18:30');
  const [endTime, setEndTime] = useState('20:00');
  const [saving, setSaving] = useState(false);
  const [searchingRestaurants, setSearchingRestaurants] = useState(false);
  const [restaurantSearchFeedback, setRestaurantSearchFeedback] = useState('');
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewEvents, setPreviewEvents] = useState<CalendarEvent[]>([]);
  const [activePicker, setActivePicker] = useState<PickerTarget>(null);
  const [sectionOffsets, setSectionOffsets] = useState<Record<string, number>>({});
  const scrollViewRef = useRef<any>(null);
  const isConnected = !!profile?.coupleId;

  const activeEvents = previewMode ? previewEvents : events;
  const monthGrid = useMemo(() => getMonthGrid(visibleMonthKey), [visibleMonthKey]);

  const eventMetaByDate = useMemo(() => {
    const meta = new Map<string, DayEventMeta>();

    activeEvents.forEach(event => {
      const dateKeys = getEventDateKeys(event);
      const spansMultipleDays = dateKeys.length > 1;

      dateKeys.forEach(dateKey => {
        const current = meta.get(dateKey) ?? { count: 0, spanningCount: 0 };
        meta.set(dateKey, {
          count: current.count + 1,
          spanningCount: current.spanningCount + (spansMultipleDays ? 1 : 0),
        });
      });
    });

    return meta;
  }, [activeEvents]);

  const dayEventsByDate = useMemo(() => {
    const dayEvents = new Map<string, CalendarEvent[]>();

    activeEvents
      .slice()
      .sort((left, right) => left.startsAt - right.startsAt)
      .forEach(event => {
        getEventDateKeys(event).forEach(dateKey => {
          const current = dayEvents.get(dateKey) ?? [];
          current.push(event);
          dayEvents.set(dateKey, current);
        });
      });

    return dayEvents;
  }, [activeEvents]);

  const selectedDayEvents = useMemo(
    () =>
      activeEvents
        .filter(event => eventTouchesDateKey(event, selectedDateKey))
        .sort((left, right) => left.startsAt - right.startsAt),
    [activeEvents, selectedDateKey],
  );

  const selectedMonthEventsCount = useMemo(
    () => activeEvents.filter(event => eventTouchesMonthKey(event, visibleMonthKey)).length,
    [activeEvents, visibleMonthKey],
  );
  const dueActions = useMemo(
    () =>
      loveActions
        .filter(
          action =>
            !!action.nextDueAt
            && action.status !== 'proposed'
            && action.status !== 'needsAttention'
            && action.status !== 'appreciated'
            && action.status !== 'cancelled',
        )
        .sort((left, right) => (left.nextDueAt ?? 0) - (right.nextDueAt ?? 0)),
    [loveActions],
  );
  const selectedDayDueActions = useMemo(
    () => dueActions.filter(action => formatDateKey(new Date(action.nextDueAt!)) === selectedDateKey),
    [dueActions, selectedDateKey],
  );
  const dueActionCountByDate = useMemo(() => {
    const counts = new Map<string, number>();

    dueActions.forEach(action => {
      const dateKey = formatDateKey(new Date(action.nextDueAt!));
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    });

    return counts;
  }, [dueActions]);
  const selectedMonthDueCount = useMemo(
    () => dueActions.filter(action => formatDateKey(new Date(action.nextDueAt!)).startsWith(visibleMonthKey)).length,
    [dueActions, visibleMonthKey],
  );
  const quickActions = useMemo(() => buildQuickActions(), []);
  const foodInterestOptions = useMemo(() => getFoodInterestOptions(isConnected), [isConnected]);
  const summaryRow = (
    <View style={styles.summaryRow}>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Month {selectedMonthEventsCount}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Day {selectedDayEvents.length}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Due month {selectedMonthDueCount}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>Due day {selectedDayDueActions.length}</Text>
      </View>
      <View style={styles.summaryPill}>
        <Text style={styles.summaryLabel}>{previewMode ? 'Preview' : profile?.coupleId ? 'Connected' : 'Solo'}</Text>
      </View>
    </View>
  );
  const scrollContentStyle = useMemo(
    () => [styles.content, { paddingTop: Math.max(insets.top, 16) + 8 }],
    [insets.top],
  );

  const titleError = title.trim().length === 0;
  const startTimeError = !allDay && !TIME_REGEX.test(startTime);
  const endTimeError = !allDay && endTime.length > 0 && !TIME_REGEX.test(endTime);
  const dateRangeError = parseDateKey(endDateKey).getTime() < parseDateKey(startDateKey).getTime();
  const missingEndTime = !allDay && endDateKey !== startDateKey && endTime.trim().length === 0;
  const parsedSearchRadiusMiles = parseSearchRadiusMiles(searchRadiusMiles);
  const searchRadiusError = searchRadiusMiles.trim().length > 0 && parsedSearchRadiusMiles == null;
  const hasFoodQuery = foodQuery.trim().length > 0;
  const restaurantSearchDisabled = searchingRestaurants || saving || !hasFoodQuery || parsedSearchRadiusMiles == null;
  const formError = titleError || startTimeError || endTimeError || dateRangeError || missingEndTime;

  const launchPreviewMode = () => {
    setPreviewEvents(current =>
      current.length > 0 ? current : createPreviewEvents(user?.uid, user?.email ?? undefined),
    );
    setPreviewMode(true);
    const todayKey = formatDateKey(new Date());
    setSelectedDateKey(todayKey);
    setVisibleMonthKey(todayKey.slice(0, 7));
  };

  const openCreateDialog = (
    dateKey = selectedDateKey,
    options?: { endDateKey?: string; allDay?: boolean; startTime?: string; endTime?: string },
  ) => {
    setEditingEvent(null);
    setStartDateKey(dateKey);
    setEndDateKey(options?.endDateKey ?? dateKey);
    setTitle('');
    setNote('');
    setFoodQuery('');
    setSearchRadiusMiles(String(DEFAULT_RESTAURANT_SEARCH_RADIUS_MILES));
    setFoodInterestFor('me');
    setRestaurantResults([]);
    setRestaurantSearchFeedback('');
    setSelectedRestaurant(null);
    setAllDay(options?.allDay ?? true);
    setStartTime(options?.startTime ?? '18:30');
    setEndTime(options?.endTime ?? '20:00');
    setActivePicker(null);
    setDialogVisible(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setStartDateKey(getEventStartDateKey(event));
    setEndDateKey(getEventEndDateKey(event));
    setTitle(event.title);
    setNote(event.note);
    setFoodQuery(event.foodQuery);
    setSearchRadiusMiles(String(DEFAULT_RESTAURANT_SEARCH_RADIUS_MILES));
    setFoodInterestFor(event.foodInterestFor);
    setRestaurantResults([]);
    setRestaurantSearchFeedback('');
    setSelectedRestaurant(
      event.restaurantPlaceId && event.restaurantLatitude != null && event.restaurantLongitude != null
        ? {
            placeId: event.restaurantPlaceId,
            name: event.restaurantName,
            address: event.restaurantAddress,
            latitude: event.restaurantLatitude,
            longitude: event.restaurantLongitude,
            googleMapsUri: null,
          }
        : null,
    );
    setAllDay(event.allDay);
    setStartTime(event.allDay ? '18:30' : formatTimeValue(new Date(event.startsAt)));
    setEndTime(event.endsAt && !event.allDay ? formatTimeValue(new Date(event.endsAt)) : event.allDay ? '20:00' : '');
    setActivePicker(null);
    setDialogVisible(true);
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setVisibleMonthKey(dateKey.slice(0, 7));
  };

  const handleQuickAction = (action: QuickAction) => {
    setSelectedDateKey(action.startDateKey);
    setVisibleMonthKey(action.startDateKey.slice(0, 7));
    openCreateDialog(action.startDateKey, {
      endDateKey: action.endDateKey,
      allDay: action.allDay,
      startTime: action.allDay ? '18:30' : '18:30',
      endTime: action.allDay ? '20:00' : action.endDateKey === action.startDateKey ? '20:00' : '10:00',
    });
  };

  const handleSearchRestaurants = async () => {
    if (!user) {
      setSnackbar('Sign in again to search nearby restaurants.');
      return;
    }

    const trimmedQuery = foodQuery.trim();

    if (!trimmedQuery) {
      setSnackbar('Enter a food type first, like sushi, tacos, or vegan brunch.');
      return;
    }

    const radiusMiles = parseSearchRadiusMiles(searchRadiusMiles);

    if (radiusMiles == null) {
      setSnackbar(`Enter a search radius between ${MIN_RESTAURANT_SEARCH_RADIUS_MILES} and ${MAX_RESTAURANT_SEARCH_RADIUS_MILES} miles.`);
      return;
    }

    setSearchingRestaurants(true);
    setRestaurantResults([]);
    setRestaurantSearchFeedback(`Searching within ${radiusMiles} mile${radiusMiles === 1 ? '' : 's'} of your current location...`);

    try {
      const coordinates = await getCurrentCoordinates();
      const result = await searchNearbyRestaurants({
        query: trimmedQuery,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        radiusMiles,
      });

      setRestaurantResults(result.places);

      if (result.places.length === 0) {
        const message = `No ${trimmedQuery} spots showed up within ${radiusMiles} miles.`;
        setRestaurantSearchFeedback(message);
        setSnackbar(message);
      } else {
        setRestaurantSearchFeedback(
          `Found ${result.places.length} ${trimmedQuery} match${result.places.length === 1 ? '' : 'es'} nearby. Pick one to pin to this plan.`,
        );
      }
    } catch (error: any) {
      const message = error.message ?? 'Unable to search nearby restaurants right now.';
      setRestaurantResults([]);
      setRestaurantSearchFeedback(message);
      setSnackbar(message);
    } finally {
      setSearchingRestaurants(false);
    }
  };

  const handleOpenDirections = async (event: CalendarEvent, provider: 'apple' | 'google') => {
    if (event.restaurantLatitude == null || event.restaurantLongitude == null || !event.restaurantName) {
      return;
    }

    const url = provider === 'apple'
      ? buildAppleMapsUrl(event.restaurantName, event.restaurantLatitude, event.restaurantLongitude)
      : buildGoogleMapsUrl(event.restaurantPlaceId, event.restaurantLatitude, event.restaurantLongitude);

    try {
      await Linking.openURL(url);
    } catch {
      setSnackbar('Unable to open map directions right now.');
    }
  };

  const handlePickerChange = (target: Exclude<PickerTarget, null>) => (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }

    if (event.type === 'dismissed' || !value) {
      return;
    }

    if (target === 'startDate') {
      const nextStartDateKey = formatDateKey(value);
      setStartDateKey(nextStartDateKey);
      if (parseDateKey(endDateKey).getTime() < parseDateKey(nextStartDateKey).getTime()) {
        setEndDateKey(nextStartDateKey);
      }
      return;
    }

    if (target === 'endDate') {
      const nextEndDateKey = formatDateKey(value);
      setEndDateKey(nextEndDateKey);
      return;
    }

    const nextTimeValue = formatTimeValue(value);

    if (target === 'startTime') {
      setStartTime(nextTimeValue);
      if (!endTime) {
        setEndTime(nextTimeValue);
      }
      return;
    }

    setEndTime(nextTimeValue);
  };

  const handleSave = async () => {
    if (formError) {
      return;
    }

    setSaving(true);

    try {
      const startsAt = buildEventDate(startDateKey, allDay ? undefined : startTime);
      const endsAt = allDay
        ? endDateKey === startDateKey
          ? null
          : buildEventDate(endDateKey)
        : endTime
          ? buildEventDate(endDateKey, endTime)
          : null;

      if (endsAt && endsAt.getTime() < startsAt.getTime()) {
        throw new Error('End date and time need to be after the start.');
      }

      const payload = {
        title,
        note,
        startsAt,
        endsAt,
        allDay,
        foodQuery,
        foodInterestFor,
        restaurantPlaceId: selectedRestaurant?.placeId ?? null,
        restaurantName: selectedRestaurant?.name ?? '',
        restaurantAddress: selectedRestaurant?.address ?? '',
        restaurantLatitude: selectedRestaurant?.latitude ?? null,
        restaurantLongitude: selectedRestaurant?.longitude ?? null,
      };

      if (previewMode) {
        const createdAt = editingEvent?.createdAt ?? Date.now();
        const previewEvent: CalendarEvent = {
          id: editingEvent?.id ?? `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: payload.title.trim(),
          note: payload.note.trim(),
          startsAt: payload.startsAt.getTime(),
          endsAt: payload.endsAt ? payload.endsAt.getTime() : null,
          allDay: payload.allDay,
          foodQuery: payload.foodQuery.trim(),
          foodInterestFor: payload.foodInterestFor,
          restaurantPlaceId: payload.restaurantPlaceId,
          restaurantName: payload.restaurantName.trim(),
          restaurantAddress: payload.restaurantAddress.trim(),
          restaurantLatitude: payload.restaurantLatitude,
          restaurantLongitude: payload.restaurantLongitude,
          status: 'active',
          createdAt,
          updatedAt: Date.now(),
          createdByUserId: editingEvent?.createdByUserId ?? user?.uid ?? 'preview-user',
          createdByEmail: editingEvent?.createdByEmail ?? user?.email ?? 'you@preview.local',
        };

        setPreviewEvents(current => {
          if (editingEvent) {
            return current
              .map(event => (event.id === editingEvent.id ? previewEvent : event))
              .sort((left, right) => left.startsAt - right.startsAt);
          }

          return [...current, previewEvent].sort((left, right) => left.startsAt - right.startsAt);
        });
        setSnackbar(editingEvent ? 'Preview plan updated.' : 'Preview plan added.');
      } else {
        if (!user) {
          setSnackbar('Sign in again to update your calendar.');
          return;
        }

        if (editingEvent) {
          await updateCalendarEvent(user, editingEvent.id, payload);
          setSnackbar(isConnected ? 'Shared plan updated.' : 'Personal plan updated.');
        } else {
          await createCalendarEvent(user, payload);
          setSnackbar(isConnected ? 'Shared plan added to your calendar.' : 'Personal plan added to your calendar.');
        }
      }

      setSelectedDateKey(startDateKey);
      setVisibleMonthKey(startDateKey.slice(0, 7));
      setActivePicker(null);
      setDialogVisible(false);
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to save that plan right now.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: CalendarEvent) => {
    if (!previewMode && !user) {
      setSnackbar('Sign in again to manage your calendar.');
      return;
    }

    setDeletingEventId(event.id);

    try {
      if (previewMode) {
        setPreviewEvents(current => current.filter(currentEvent => currentEvent.id !== event.id));
        setSnackbar('Preview plan removed.');
      } else {
        await deleteCalendarEvent(user!, event.id);
        setSnackbar(isConnected ? 'Shared plan removed.' : 'Personal plan removed.');
      }

      if (editingEvent?.id === event.id) {
        setDialogVisible(false);
        setActivePicker(null);
      }
    } catch (error: any) {
      setSnackbar(error.message ?? 'Unable to remove that plan right now.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const renderActivePicker = () => {
    if (!activePicker) {
      return null;
    }

    const value =
      activePicker === 'startDate'
        ? parseDateKey(startDateKey)
        : activePicker === 'endDate'
          ? parseDateKey(endDateKey)
          : buildEventDate(
              activePicker === 'startTime' ? startDateKey : endDateKey,
              activePicker === 'startTime' ? startTime : endTime || startTime,
            );

    const mode = activePicker === 'startTime' || activePicker === 'endTime' ? 'time' : 'date';
    const pickerLabel =
      activePicker === 'startDate'
        ? 'Choose start date'
        : activePicker === 'endDate'
          ? 'Choose end date'
          : activePicker === 'startTime'
            ? 'Choose start time'
            : 'Choose end time';

    return (
      <View style={styles.pickerWrap}>
        <Text style={styles.pickerTitle}>{pickerLabel}</Text>
        <View style={styles.nativePickerSurface}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            textColor={Platform.OS === 'ios' ? '#2A161F' : undefined}
            accentColor="#B25B63"
            themeVariant={Platform.OS === 'ios' ? 'light' : undefined}
            onChange={handlePickerChange(activePicker)}
            style={mode === 'date' ? styles.dateNativePicker : styles.timeNativePicker}
          />
        </View>
        {Platform.OS === 'ios' ? (
          <Button
            mode="text"
            textColor="#3F2831"
            onPress={() => setActivePicker(null)}
            style={styles.donePickingButton}
            labelStyle={styles.donePickingButtonLabel}
          >
            Done
          </Button>
        ) : null}
      </View>
    );
  };

  const registerSection = (key: string) => ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const nextY = layout.y;
    setSectionOffsets(current => (current[key] === nextY ? current : { ...current, [key]: nextY }));
  };

  const visibleJumpSections = CALENDAR_JUMP_SECTIONS.filter(section => sectionOffsets[section.key] !== undefined);

  const handleJumpToSection = (key: string) => {
    const targetY = sectionOffsets[key];

    if (typeof targetY === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 12), animated: true });
    }
  };

  if (!hydrated || relationshipSyncing) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={scrollContentStyle}>
        <Text variant="headlineMedium" style={styles.header}>
          Calendar
        </Text>
        <Text style={styles.subheader}>Warming up your calendar and syncing upcoming plans.</Text>
        {summaryRow}
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        style={styles.screen}
        contentContainerStyle={scrollContentStyle}
      >
        {summaryRow}
        {!!relationshipError && !previewMode && <Text style={styles.errorText}>{relationshipError}</Text>}
        {previewMode ? (
          <Surface style={styles.previewBanner} elevation={1}>
            <View style={styles.previewBannerRow}>
              <View style={styles.previewBannerCopy}>
                <Text variant="titleSmall" style={styles.previewBannerTitle}>
                  Preview mode
                </Text>
                <Text style={styles.previewBannerBody}>
                  These sample plans live only on this device and never touch Firebase.
                </Text>
              </View>
              <Button mode="text" onPress={() => setPreviewMode(false)} accessibilityLabel="Exit calendar preview mode">
                Exit preview
              </Button>
            </View>
          </Surface>
        ) : null}
        <View onLayout={registerSection('month')}>
          <Surface style={styles.hero} elevation={1}>
            <View style={styles.monthToolbar}>
              <View style={styles.yearPill}>
                <Button
                  mode="text"
                  compact
                  onPress={() => setVisibleMonthKey(shiftMonth(visibleMonthKey, -1))}
                  accessibilityLabel={`Show ${formatMonthTitle(shiftMonth(visibleMonthKey, -1))}`}
                  style={styles.yearNavButton}
                  labelStyle={styles.yearNavLabel}
                >
                  ‹
                </Button>
                <Text style={styles.yearPillText}>{parseMonthKey(visibleMonthKey).getFullYear()}</Text>
                <Button
                  mode="text"
                  compact
                  onPress={() => setVisibleMonthKey(shiftMonth(visibleMonthKey, 1))}
                  accessibilityLabel={`Show ${formatMonthTitle(shiftMonth(visibleMonthKey, 1))}`}
                  style={styles.yearNavButton}
                  labelStyle={styles.yearNavLabel}
                >
                  ›
                </Button>
              </View>
              <View style={styles.monthToolbarActions}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => {
                    const todayKey = formatDateKey(new Date());
                    setSelectedDateKey(todayKey);
                    setVisibleMonthKey(todayKey.slice(0, 7));
                  }}
                  style={styles.todayButton}
                  labelStyle={styles.toolbarButtonLabel}
                  accessibilityLabel="Jump to today in the calendar"
                >
                  Today
                </Button>
                <Button
                  mode="contained"
                  compact
                  onPress={() => openCreateDialog()}
                  style={styles.addPlanPill}
                  labelStyle={styles.toolbarButtonLabel}
                  accessibilityLabel={isConnected ? 'Add a shared calendar plan' : 'Add a personal calendar plan'}
                >
                  Add
                </Button>
              </View>
            </View>
            <Text variant="displaySmall" style={styles.monthDisplayTitle}>
              {formatMonthName(visibleMonthKey)}
            </Text>
            <Text style={styles.monthDisplayMeta}>{getMonthSummaryLabel(selectedMonthEventsCount)}</Text>
            <View style={styles.quickActionsRow}>
              {quickActions.map(action => (
                <Button
                  key={action.key}
                  mode="text"
                  compact
                  onPress={() => handleQuickAction(action)}
                  style={styles.quickActionButton}
                  labelStyle={styles.quickActionLabel}
                  accessibilityLabel={`Quick add a ${isConnected ? 'shared' : 'personal'} plan for ${action.label.toLowerCase()}`}
                >
                  {action.label}
                </Button>
              ))}
            </View>
            <View style={styles.weekdayHeaderRow}>
              {WEEKDAY_LABELS.map(label => (
                <Text key={label} style={styles.weekdayLabel}>
                  {label.slice(0, 1)}
                </Text>
              ))}
            </View>
            <View style={styles.gridWrap}>
              {monthGrid.map((week, weekIndex) => (
                <View key={`${visibleMonthKey}-${weekIndex}`} style={styles.weekRow}>
                  {week.map(day => {
                    const selected = day.dateKey === selectedDateKey;
                    const eventMeta = eventMetaByDate.get(day.dateKey);
                    const eventCount = eventMeta?.count ?? 0;
                    const dueCount = dueActionCountByDate.get(day.dateKey) ?? 0;
                    const dayPreviewEvents = (dayEventsByDate.get(day.dateKey) ?? []).slice(0, 3);
                    const overflowLabel = getDayOverflowLabel(eventCount);

                    return (
                      <Pressable
                        key={day.dateKey}
                        onPress={() => handleSelectDay(day.dateKey)}
                        onLongPress={() => openCreateDialog(day.dateKey)}
                        style={[
                          styles.dayCell,
                          selected && styles.dayCellSelected,
                          day.isToday && styles.dayCellToday,
                          dueCount > 0 && styles.dayCellDue,
                          !day.inCurrentMonth && styles.dayCellOutsideMonth,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={getDayAccessibilityLabel(day, eventMeta, selected, dueCount)}
                        accessibilityHint="Tap to open this day in the agenda. Long press to add a plan on this day."
                        accessibilityState={{ selected }}
                      >
                        <View style={styles.dayHeaderRow}>
                          <View
                            style={[
                              styles.dayNumberBadge,
                              selected && styles.dayNumberBadgeSelected,
                              day.isToday && !selected && styles.dayNumberBadgeToday,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayNumber,
                                selected && styles.dayNumberSelected,
                                !day.inCurrentMonth && styles.dayNumberMuted,
                              ]}
                            >
                              {day.dayNumber}
                            </Text>
                          </View>
                          {overflowLabel ? (
                            <Text style={[styles.dayOverflowCount, selected && styles.dayOverflowCountSelected]}>
                              {overflowLabel}
                            </Text>
                          ) : null}
                        </View>
                        {dueCount > 0 ? (
                          <View style={styles.dueMarkerRow}>
                            <View style={[styles.dueMarkerPill, selected && styles.dueMarkerPillSelected]}>
                              <Text style={[styles.dueMarkerText, selected && styles.dueMarkerTextSelected]}>
                                Love due {dueCount}
                              </Text>
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.dayChipList}>
                          {dayPreviewEvents.map(event => {
                            const selectedDayStatus = getEventSelectedDayStatus(event, day.dateKey);
                            const continuing = selectedDayStatus === 'Continues today' || selectedDayStatus === 'Ends today';

                            return (
                              <View
                                key={`${day.dateKey}-${event.id}`}
                                style={[
                                  styles.dayEventChip,
                                  event.allDay ? styles.dayEventChipAllDay : styles.dayEventChipTimed,
                                  continuing && styles.dayEventChipContinuing,
                                  selected && styles.dayEventChipSelected,
                                ]}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.dayEventChipText,
                                    event.allDay ? styles.dayEventChipTextAllDay : styles.dayEventChipTextTimed,
                                    selected && styles.dayEventChipTextSelected,
                                  ]}
                                >
                                  {getMonthChipLabel(event)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </Surface>
        </View>
        <View onLayout={registerSection('agenda')}>
          <Card style={styles.agendaCard}>
            <Card.Content>
              <View style={styles.agendaHeaderRow}>
                <View style={styles.agendaCopy}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    {formatSelectedDate(selectedDateKey)}
                  </Text>
                  <Text style={styles.agendaMeta}>{getAgendaLabel(selectedDayEvents.length)}</Text>
                </View>
                <View style={styles.agendaActionsRow}>
                  <Button
                    mode="text"
                    onPress={() => handleSelectDay(shiftDateKey(selectedDateKey, -1))}
                    accessibilityLabel={`Show agenda for ${formatSelectedDate(shiftDateKey(selectedDateKey, -1))}`}
                  >
                    Prev day
                  </Button>
                  <Button
                    mode="contained-tonal"
                    onPress={() => openCreateDialog(selectedDateKey)}
                    accessibilityLabel={`Add a plan on ${formatSelectedDate(selectedDateKey)}`}
                  >
                    Add
                  </Button>
                  <Button
                    mode="text"
                    onPress={() => handleSelectDay(shiftDateKey(selectedDateKey, 1))}
                    accessibilityLabel={`Show agenda for ${formatSelectedDate(shiftDateKey(selectedDateKey, 1))}`}
                  >
                    Next day
                  </Button>
                </View>
              </View>
              {selectedDayEvents.length === 0 ? (
                <Surface style={styles.emptyAgenda} elevation={1}>
                  <Text variant="titleMedium" style={styles.emptyAgendaTitle}>
                    Nothing planned yet
                  </Text>
                  <Text style={styles.emptyAgendaBody}>
                    Tap Add to anchor a date night, check-in, solo reset, or shared ritual on this day.
                  </Text>
                </Surface>
              ) : (
                <View style={styles.eventList}>
                  {selectedDayEvents.map(event => {
                    const rangeLabel = getEventRangeLabel(event);
                    const selectedDayStatus = getEventSelectedDayStatus(event, selectedDateKey);

                    return (
                      <Card key={event.id} style={styles.eventCard}>
                        <Card.Content>
                          <Pressable
                            onPress={() => openEditDialog(event)}
                            style={styles.eventPressable}
                            accessibilityRole="button"
                            accessibilityLabel={`${event.title}. ${formatEventTime(event)}.${selectedDayStatus ? ` ${selectedDayStatus}.` : ''}`}
                            accessibilityHint="Open this plan to edit details."
                          >
                            <View style={styles.eventHeaderRow}>
                              <View style={styles.eventTextWrap}>
                                <View style={styles.eventTopLine}>
                                  {selectedDayStatus ? <Text style={styles.eventStatus}>{selectedDayStatus}</Text> : null}
                                  <Text style={styles.eventOwnerText}>
                                    {event.createdByUserId === user?.uid ? 'You planned this' : event.createdByEmail}
                                  </Text>
                                </View>
                                <Text variant="titleMedium" style={styles.eventTitle}>
                                  {event.title}
                                </Text>
                                <View style={styles.eventBadgeRow}>
                                  <View style={[styles.eventBadge, styles.eventPrimaryBadge]}>
                                    <Text style={[styles.eventBadgeText, styles.eventPrimaryBadgeText]}>{formatEventTime(event)}</Text>
                                  </View>
                                  {rangeLabel ? (
                                    <View style={styles.eventBadge}>
                                      <Text style={styles.eventBadgeText}>{rangeLabel}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                            {!!event.note && (
                              <Surface style={styles.eventNoteCard} elevation={0}>
                                <Text style={styles.eventNote}>{event.note}</Text>
                              </Surface>
                            )}
                            {event.restaurantName && event.restaurantLatitude != null && event.restaurantLongitude != null ? (
                              <Surface style={styles.eventPlaceCard} elevation={0}>
                                <Text style={styles.eventPlaceEyebrow}>
                                  {event.foodQuery
                                    ? `${event.foodQuery} · ${event.foodInterestFor === 'partner' ? (isConnected ? 'Partner' : 'Later') : event.foodInterestFor === 'both' ? 'Both' : 'Me'}`
                                    : 'Pinned restaurant'}
                                </Text>
                                <Text variant="titleSmall" style={styles.eventPlaceTitle}>
                                  {event.restaurantName}
                                </Text>
                                <Text style={styles.eventPlaceAddress}>{event.restaurantAddress}</Text>
                                <View style={styles.eventMapActionsRow}>
                                  {Platform.OS === 'ios' ? (
                                    <Button mode="outlined" compact onPress={() => void handleOpenDirections(event, 'apple')}>
                                      Apple Maps
                                    </Button>
                                  ) : null}
                                  <Button mode="contained-tonal" compact onPress={() => void handleOpenDirections(event, 'google')}>
                                    Google Maps
                                  </Button>
                                </View>
                              </Surface>
                            ) : null}
                            <Text style={styles.eventHint}>Tap to edit details</Text>
                          </Pressable>
                          <View style={styles.eventActionRow}>
                            <Button mode="contained-tonal" onPress={() => openEditDialog(event)}>
                              Open
                            </Button>
                            <Button
                              mode="text"
                              onPress={() => void handleDelete(event)}
                              disabled={deletingEventId === event.id}
                              loading={deletingEventId === event.id}
                              accessibilityLabel={`Delete ${event.title}`}
                            >
                              Delete
                            </Button>
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                </View>
              )}
            </Card.Content>
          </Card>
        </View>
        <View onLayout={registerSection('dueActions')}>
          <Card style={styles.agendaCard}>
            <Card.Content>
              <View style={styles.agendaHeaderRow}>
                <View style={styles.agendaCopy}>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Love Actions due this day
                  </Text>
                  <Text style={styles.agendaMeta}>
                    {selectedDayDueActions.length === 1 ? '1 Love Action is due.' : `${selectedDayDueActions.length} Love Actions are due.`}
                  </Text>
                </View>
                <Button mode="contained-tonal" onPress={() => navigation.navigate('Love')}>
                  Open Love
                </Button>
              </View>
              {selectedDayDueActions.length === 0 ? (
                <Surface style={styles.emptyAgenda} elevation={1}>
                  <Text variant="titleMedium" style={styles.emptyAgendaTitle}>
                    No Love Actions due here
                  </Text>
                  <Text style={styles.emptyAgendaBody}>
                    Love Actions with a due date will appear on the matching day here.
                  </Text>
                </Surface>
              ) : (
                <View style={styles.eventList}>
                  {selectedDayDueActions.map(action => (
                    <Card key={action.id} style={styles.eventCard}>
                      <Card.Content>
                        <View style={styles.eventPressable}>
                          <View style={styles.eventHeaderRow}>
                            <View style={styles.eventTextWrap}>
                              <View style={styles.eventTopLine}>
                                <Text style={styles.eventStatus}>{action.status}</Text>
                                <Text style={styles.eventOwnerText}>
                                  {action.responsibleUserId === user?.uid ? 'You are responsible' : action.responsibleUserEmail}
                                </Text>
                              </View>
                              <Text variant="titleMedium" style={styles.eventTitle}>
                                {action.title}
                              </Text>
                              <View style={styles.eventBadgeRow}>
                                <View style={[styles.eventBadge, styles.eventPrimaryBadge]}>
                                  <Text style={[styles.eventBadgeText, styles.eventPrimaryBadgeText]}>
                                    {formatLoveActionDueLabel(action.nextDueAt)}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                          {!!action.appreciationNote ? (
                            <Surface style={styles.eventNoteCard} elevation={0}>
                              <Text style={styles.eventNote}>{action.appreciationNote}</Text>
                            </Surface>
                          ) : null}
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>
        </View>
        {syncing && <Text style={styles.syncText}>Syncing your calendar...</Text>}
      </ScrollView>
      <JumpToSectionFab sections={visibleJumpSections} onSelectSection={handleJumpToSection} />
      <Portal>
        <Dialog
          visible={dialogVisible}
          onDismiss={() => {
            if (!saving) {
              setDialogVisible(false);
              setActivePicker(null);
            }
          }}
          style={styles.dialog}
        >
          <Dialog.Title>{editingEvent ? (isConnected ? 'Edit shared plan' : 'Edit personal plan') : isConnected ? 'Add shared plan' : 'Add personal plan'}</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              contentContainerStyle={styles.dialogContent}
            >
              <Surface style={styles.dialogSummaryCard} elevation={0}>
                <Text style={styles.dialogSummary}>
                  {getDraftSummary(startDateKey, endDateKey, allDay, startTime, endTime)}
                </Text>
              </Surface>
              <View style={styles.dialogSection}>
                <TextInput
                  mode="outlined"
                  label="Title"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                  placeholder="Dinner date"
                  accessibilityLabel="Plan title"
                />
                <HelperText type="error" visible={titleError}>
                  Add a title for this plan.
                </HelperText>
                <TextInput
                  mode="outlined"
                  label="Notes"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  style={styles.input}
                  placeholder="Dress up, candles, and no phones."
                  accessibilityLabel="Plan notes"
                />
              </View>
              <Surface style={styles.dialogSectionCard} elevation={0}>
                <Text variant="titleSmall" style={styles.sectionTitle}>
                  Food idea
                </Text>
                <TextInput
                  mode="outlined"
                  label="Food or cuisine"
                  value={foodQuery}
                  onChangeText={setFoodQuery}
                  style={styles.input}
                  placeholder="Sushi, Ethiopian, tacos, vegan brunch"
                  accessibilityLabel="Food or cuisine to search for"
                />
                <TextInput
                  mode="outlined"
                  label="Search radius (miles)"
                  value={searchRadiusMiles}
                  onChangeText={setSearchRadiusMiles}
                  style={styles.input}
                  keyboardType="number-pad"
                  accessibilityLabel="Restaurant search radius in miles"
                />
                <Surface style={styles.segmentedWrap} elevation={0}>
                  <SegmentedButtons
                    value={foodInterestFor}
                    onValueChange={value => setFoodInterestFor(value as CalendarFoodInterestFor)}
                    buttons={foodInterestOptions}
                    theme={{ roundness: 999 }}
                  />
                </Surface>
                <HelperText style={styles.inlineHelperText} type="info" visible>
                  {parsedSearchRadiusMiles == null
                    ? `${getFoodInterestSummary(foodInterestFor, isConnected)} Choose a search radius between ${MIN_RESTAURANT_SEARCH_RADIUS_MILES} and ${MAX_RESTAURANT_SEARCH_RADIUS_MILES} miles.`
                    : `${getFoodInterestSummary(foodInterestFor, isConnected)} Search within ${parsedSearchRadiusMiles} mile${parsedSearchRadiusMiles === 1 ? '' : 's'} of your current location.`}
                </HelperText>
                <HelperText type="error" visible={searchRadiusError}>
                  Enter a whole number between {MIN_RESTAURANT_SEARCH_RADIUS_MILES} and {MAX_RESTAURANT_SEARCH_RADIUS_MILES}.
                </HelperText>
                <View style={styles.restaurantActionRow}>
                  <Button
                    mode="contained"
                    onPress={() => void handleSearchRestaurants()}
                    loading={searchingRestaurants}
                    disabled={restaurantSearchDisabled}
                    buttonColor="#B25B63"
                    textColor="#FFF8F3"
                  >
                    Search nearby restaurants
                  </Button>
                  {selectedRestaurant ? (
                    <Button
                      mode="text"
                      onPress={() => setSelectedRestaurant(null)}
                      disabled={searchingRestaurants || saving}
                    >
                      Clear pin
                    </Button>
                  ) : null}
                </View>
                {restaurantSearchFeedback ? (
                  <Surface style={styles.restaurantSearchFeedbackCard} elevation={0}>
                    <Text style={styles.restaurantResultEyebrow}>
                      {searchingRestaurants ? 'Searching nearby' : restaurantResults.length > 0 ? 'Nearby matches' : 'Restaurant search'}
                    </Text>
                    <Text style={styles.restaurantSearchFeedbackText}>{restaurantSearchFeedback}</Text>
                  </Surface>
                ) : null}
                {selectedRestaurant ? (
                  <Surface style={styles.restaurantResultCardSelected} elevation={0}>
                    <Text style={styles.restaurantResultEyebrow}>Pinned restaurant</Text>
                    <Text variant="titleSmall" style={styles.restaurantResultTitle}>
                      {selectedRestaurant.name}
                    </Text>
                    <Text style={styles.restaurantResultAddress}>{selectedRestaurant.address}</Text>
                  </Surface>
                ) : null}
                {restaurantResults.length > 0 ? (
                  <View style={styles.restaurantResultsList}>
                    {restaurantResults.map(result => {
                      const selected = selectedRestaurant?.placeId === result.placeId;

                      return (
                        <Surface
                          key={result.placeId}
                          style={[styles.restaurantResultCard, selected ? styles.restaurantResultCardSelected : null]}
                          elevation={0}
                        >
                          <Text variant="titleSmall" style={styles.restaurantResultTitle}>
                            {result.name}
                          </Text>
                          <Text style={styles.restaurantResultAddress}>{result.address}</Text>
                          <View style={styles.restaurantActionRow}>
                            <Button
                              mode={selected ? 'contained' : 'outlined'}
                              compact
                              onPress={() => setSelectedRestaurant(result)}
                            >
                              {selected ? 'Pinned' : 'Pin to event'}
                            </Button>
                          </View>
                        </Surface>
                      );
                    })}
                  </View>
                ) : null}
              </Surface>
              <Surface style={styles.dialogSectionCard} elevation={0}>
                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text variant="titleSmall" style={styles.switchTitle}>
                      All-day plan
                    </Text>
                    <Text style={styles.switchBody}>
                      Keep it anchored to the day instead of a specific time.
                    </Text>
                  </View>
                  <Switch
                    value={allDay}
                    onValueChange={value => {
                      setAllDay(value);
                      setActivePicker(null);
                    }}
                    accessibilityLabel="Toggle all-day plan"
                  />
                </View>
              </Surface>
              <Surface style={styles.dialogSectionCard} elevation={0}>
                <View style={styles.dateSection}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    Starts
                  </Text>
                  <Button
                    mode="outlined"
                    textColor="#3F2831"
                    onPress={() => setActivePicker(activePicker === 'startDate' ? null : 'startDate')}
                    style={styles.pickerButton}
                    contentStyle={styles.pickerButtonContent}
                    labelStyle={styles.pickerButtonLabel}
                    accessibilityLabel="Choose the start date"
                  >
                    {formatCompactDateInput(startDateKey)}
                  </Button>
                  {activePicker === 'startDate' ? renderActivePicker() : null}
                </View>
                <View style={styles.dateSectionDivider} />
                <View style={styles.dateSection}>
                  <View style={styles.sectionHeaderRow}>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                      Ends
                    </Text>
                    <Button
                      mode={endDateKey === startDateKey ? 'contained-tonal' : 'text'}
                      textColor="#3F2831"
                      onPress={() => setEndDateKey(startDateKey)}
                      labelStyle={styles.sameDayButtonLabel}
                      accessibilityLabel="Set end date to the same day as the start"
                    >
                      Same day
                    </Button>
                  </View>
                  <Button
                    mode="outlined"
                    textColor="#3F2831"
                    onPress={() => setActivePicker(activePicker === 'endDate' ? null : 'endDate')}
                    style={styles.pickerButton}
                    contentStyle={styles.pickerButtonContent}
                    labelStyle={styles.pickerButtonLabel}
                    accessibilityLabel="Choose the end date"
                  >
                    {formatCompactDateInput(endDateKey)}
                  </Button>
                  {activePicker === 'endDate' ? renderActivePicker() : null}
                </View>
                <HelperText style={styles.inlineHelperText} type="error" visible={dateRangeError}>
                  End date needs to be on or after the start date.
                </HelperText>
              </Surface>
              {!allDay ? (
                <Surface style={styles.dialogSectionCard} elevation={0}>
                  <Text variant="titleSmall" style={styles.sectionTitle}>
                    Time
                  </Text>
                  <View style={styles.timeRow}>
                    <Button
                      mode="outlined"
                      textColor="#3F2831"
                      onPress={() => setActivePicker(activePicker === 'startTime' ? null : 'startTime')}
                      style={[styles.pickerButton, styles.timePickerButton]}
                      contentStyle={styles.pickerButtonContent}
                      labelStyle={styles.pickerButtonLabel}
                      accessibilityLabel="Choose the start time"
                    >
                      {`Start · ${startTime}`}
                    </Button>
                    <Button
                      mode="outlined"
                      textColor="#3F2831"
                      onPress={() => setActivePicker(activePicker === 'endTime' ? null : 'endTime')}
                      style={[styles.pickerButton, styles.timePickerButton]}
                      contentStyle={styles.pickerButtonContent}
                      labelStyle={styles.pickerButtonLabel}
                      accessibilityLabel="Choose the end time"
                    >
                      {`End · ${endTime || 'Optional'}`}
                    </Button>
                  </View>
                  {activePicker === 'startTime' || activePicker === 'endTime' ? renderActivePicker() : null}
                  <HelperText style={styles.inlineHelperText} type="info" visible={!allDay}>
                    Pick the start and end times. End time is optional for same-day plans.
                  </HelperText>
                  <HelperText style={styles.inlineHelperText} type="error" visible={startTimeError || endTimeError || missingEndTime}>
                    {missingEndTime
                      ? 'Add an end time for plans that continue into another day.'
                      : 'Enter valid times using HH:MM.'}
                  </HelperText>
                </Surface>
              ) : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            {editingEvent ? (
              <Button
                mode="text"
                onPress={() => void handleDelete(editingEvent)}
                disabled={saving || deletingEventId === editingEvent.id}
                loading={deletingEventId === editingEvent.id}
              >
                Delete
              </Button>
            ) : null}
            <Button
              onPress={() => {
                setDialogVisible(false);
                setActivePicker(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={() => void handleSave()} loading={saving} disabled={saving || formError}>
              {editingEvent ? 'Save changes' : 'Add plan'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={4000}
        style={styles.snackbar}
      >
        {snackbar}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF3EA',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 24,
  },
  header: {
    color: '#3F2831',
    fontWeight: '700',
  },
  subheader: {
    color: '#3F2831',
    lineHeight: 22,
    opacity: 0.78,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFF8F4',
    borderWidth: 1,
    borderColor: '#F2D3C7',
  },
  summaryLabel: {
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '700',
  },
  syncText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  hero: {
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#FFFDFC',
  },
  monthToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  yearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#F3C8BA',
  },
  yearNavButton: {
    minWidth: 30,
  },
  yearNavLabel: {
    fontSize: 20,
    lineHeight: 20,
    color: '#3F2831',
    marginHorizontal: 0,
  },
  yearPillText: {
    color: '#3F2831',
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 2,
  },
  monthToolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  todayButton: {
    borderRadius: 999,
    minWidth: 68,
  },
  addPlanPill: {
    borderRadius: 999,
    minWidth: 58,
  },
  toolbarButtonLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  monthDisplayTitle: {
    color: '#111111',
    fontWeight: '800',
    marginTop: 0,
  },
  monthDisplayMeta: {
    color: '#8F4654',
    fontWeight: '600',
    marginTop: -4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 2,
  },
  quickActionButton: {
    borderRadius: 999,
    marginRight: 2,
  },
  quickActionLabel: {
    color: '#3F2831',
    fontSize: 12,
    fontWeight: '600',
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    paddingTop: 6,
    paddingBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8D7D0',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#7C5964',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gridWrap: {
    gap: 0,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8D7D0',
  },
  dayCell: {
    flex: 1,
    minHeight: 78,
    paddingHorizontal: 4,
    paddingVertical: 5,
    backgroundColor: '#FFFDFC',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E8D7D0',
  },
  dayCellSelected: {
    backgroundColor: '#FFF3F0',
  },
  dayCellToday: {
    backgroundColor: '#FFF7F2',
  },
  dayCellDue: {
    backgroundColor: '#FFF8F1',
  },
  dayCellOutsideMonth: {
    opacity: 0.48,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 28,
    marginBottom: 4,
  },
  dayNumberBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberBadgeSelected: {
    backgroundColor: '#FF5A55',
  },
  dayNumberBadgeToday: {
    backgroundColor: '#F3C8BA',
  },
  dayNumber: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 16,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    textDecorationLine: 'none',
  },
  dayNumberMuted: {
    color: '#8B8080',
  },
  dayOverflowCount: {
    color: '#8B8080',
    fontSize: 12,
    fontWeight: '700',
  },
  dayOverflowCountSelected: {
    color: '#B25B63',
  },
  dueMarkerRow: {
    marginTop: 4,
    marginBottom: 3,
    alignItems: 'flex-start',
  },
  dueMarkerPill: {
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#F7D4D8',
    borderWidth: 1,
    borderColor: '#E4A9B1',
  },
  dueMarkerPillSelected: {
    backgroundColor: '#F4C3C9',
  },
  dueMarkerText: {
    color: '#7E3944',
    fontSize: 9,
    fontWeight: '700',
  },
  dueMarkerTextSelected: {
    color: '#52262F',
  },
  dayChipList: {
    gap: 3,
  },
  dayEventChip: {
    minHeight: 18,
    borderRadius: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  dayEventChipAllDay: {
    backgroundColor: '#F4D39B',
  },
  dayEventChipTimed: {
    backgroundColor: '#C8E5F1',
  },
  dayEventChipContinuing: {
    opacity: 0.88,
  },
  dayEventChipSelected: {
    borderWidth: 1,
    borderColor: 'rgba(178, 91, 99, 0.28)',
  },
  dayEventChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dayEventChipTextAllDay: {
    color: '#7A5317',
  },
  dayEventChipTextTimed: {
    color: '#2D6175',
  },
  dayEventChipTextSelected: {
    color: '#3F2831',
  },
  emptyIndicator: {
    height: 12,
  },
  agendaCard: {
    borderRadius: 28,
    backgroundColor: '#F8E2D8',
  },
  agendaHeaderRow: {
    gap: 14,
  },
  agendaCopy: {
    gap: 4,
  },
  cardTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  agendaMeta: {
    color: '#B25B63',
    fontWeight: '600',
  },
  agendaActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  emptyAgenda: {
    marginTop: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#FFF7F2',
    gap: 8,
  },
  emptyAgendaTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  emptyAgendaBody: {
    color: '#3F2831',
    lineHeight: 22,
    opacity: 0.78,
  },
  eventList: {
    marginTop: 14,
    gap: 12,
  },
  eventCard: {
    borderRadius: 20,
    backgroundColor: '#FFF7F2',
  },
  eventPressable: {
    gap: 8,
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  eventTextWrap: {
    flex: 1,
    gap: 6,
  },
  eventTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  eventOwnerText: {
    flex: 1,
    textAlign: 'right',
    color: '#7C5964',
    fontSize: 11,
    fontWeight: '600',
  },
  eventTitle: {
    color: '#3F2831',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
  },
  eventBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  eventBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F3C8BA',
  },
  eventPrimaryBadge: {
    backgroundColor: '#B25B63',
  },
  eventBadgeText: {
    color: '#8F4654',
    fontSize: 11,
    fontWeight: '700',
  },
  eventPrimaryBadgeText: {
    color: '#FFF3EA',
  },
  eventStatus: {
    color: '#B25B63',
    fontSize: 12,
    fontWeight: '800',
  },
  eventNoteCard: {
    marginTop: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8E2D8',
  },
  eventNote: {
    color: '#3F2831',
    lineHeight: 21,
  },
  eventPlaceCard: {
    marginTop: 2,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    gap: 6,
  },
  eventPlaceEyebrow: {
    color: '#8F4654',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  eventPlaceTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  eventPlaceAddress: {
    color: '#7C5964',
    lineHeight: 20,
  },
  eventMapActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventHint: {
    color: '#7C5964',
    fontSize: 12,
    fontWeight: '600',
  },
  eventActionRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  dialog: {
    borderRadius: 28,
    backgroundColor: '#FFF3EA',
    maxHeight: '90%',
  },
  dialogScrollArea: {
    borderTopWidth: 0,
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  dialogContent: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  dialogSummaryCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8E2D8',
  },
  dialogSummary: {
    color: '#B25B63',
    fontWeight: '600',
    lineHeight: 20,
  },
  dialogSection: {
    gap: 2,
  },
  dialogSectionCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFF7F2',
    gap: 10,
  },
  inlineHelperText: {
    marginTop: 0,
  },
  input: {
    backgroundColor: '#FFF3EA',
  },
  segmentedWrap: {
    borderRadius: 18,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    padding: 4,
  },
  restaurantActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  restaurantResultsList: {
    gap: 8,
  },
  restaurantSearchFeedbackCard: {
    borderRadius: 16,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  restaurantSearchFeedbackText: {
    color: '#7C5964',
    lineHeight: 20,
  },
  restaurantResultCard: {
    borderRadius: 16,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F3C8BA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  restaurantResultCardSelected: {
    borderColor: '#B25B63',
    backgroundColor: '#FFF8F4',
  },
  restaurantResultEyebrow: {
    color: '#8F4654',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  restaurantResultTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  restaurantResultAddress: {
    color: '#7C5964',
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  switchBody: {
    color: '#3F2831',
    lineHeight: 20,
    opacity: 0.76,
  },
  dateSection: {
    gap: 8,
  },
  dateSectionDivider: {
    height: 1,
    backgroundColor: '#F3C8BA',
    opacity: 0.7,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  pickerButton: {
    borderRadius: 16,
    borderColor: '#E59A9A',
    backgroundColor: '#FFF3EA',
  },
  pickerButtonContent: {
    minHeight: 52,
  },
  pickerButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  sameDayButtonLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeRow: {
    marginTop: 2,
    gap: 10,
  },
  timePickerButton: {
    alignSelf: 'stretch',
  },
  pickerWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingTop: 10,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#F3C8BA',
  },
  nativePickerSurface: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F0D8CF',
  },
  pickerTitle: {
    paddingHorizontal: 14,
    color: '#7C5964',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateNativePicker: {
    height: 216,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
  },
  timeNativePicker: {
    height: 180,
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
  },
  donePickingButton: {
    alignSelf: 'flex-end',
  },
  donePickingButtonLabel: {
    fontWeight: '700',
  },
  dialogActions: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  snackbar: {
    marginHorizontal: 16,
    borderRadius: 12,
  },
  previewBanner: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#F8E2D8',
  },
  previewBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewBannerCopy: {
    flex: 1,
    gap: 4,
  },
  previewBannerTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  previewBannerBody: {
    color: '#3F2831',
    lineHeight: 20,
    opacity: 0.78,
  },
  emptyHero: {
    marginTop: 12,
    padding: 24,
    borderRadius: 28,
    backgroundColor: '#F3C8BA',
    gap: 14,
  },
  emptyActionsRow: {
    gap: 10,
  },
  emptyTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  emptyBody: {
    color: '#3F2831',
    lineHeight: 22,
    opacity: 0.78,
  },
  primaryButton: {
    borderRadius: 14,
  },
  secondaryButton: {
    borderRadius: 14,
  },
});
