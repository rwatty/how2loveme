import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { User } from '@react-native-firebase/auth';
import { Avatar, Button, HelperText, SegmentedButtons, Surface, Text, TextInput } from 'react-native-paper';
import { LOVE_AREAS, LOVE_AREA_LABELS, LOVE_LIBRARY_ITEMS } from '../lib/loveLibrary';
import { completeOnboarding } from '../lib/relationshipSync';
import type { LoveArea } from '../store/useLoveProfileStore';
import type { NotificationPrivacyPreference, RelationshipProfile } from '../store/useRelationshipStore';

const MIN_FOCUS_AREAS = 3;
const MIN_STARTER_PREFERENCES = 5;
const MAX_STARTER_PREFERENCES = 8;
const NOTIFICATION_OPTIONS: Array<{ value: NotificationPrivacyPreference; label: string }> = [
  { value: 'detailed', label: 'Detailed' },
  { value: 'discreet', label: 'Discreet' },
  { value: 'off', label: 'Off' },
];

function getInitialDisplayName(profile: RelationshipProfile) {
  if (profile.displayName.trim()) {
    return profile.displayName.trim();
  }

  return profile.email.split('@')[0] ?? '';
}

export default function OnboardingScreen({
  user,
  profile,
}: {
  user: User;
  profile: RelationshipProfile;
}) {
  const [displayName, setDisplayName] = useState(getInitialDisplayName(profile));
  const [notificationPrivacy, setNotificationPrivacy] = useState<NotificationPrivacyPreference>(
    profile.notificationPrivacy,
  );
  const [focusAreas, setFocusAreas] = useState<LoveArea[]>(['emotional', 'communication', 'partnership']);
  const [selectedStarterIds, setSelectedStarterIds] = useState<string[]>([]);
  const [adultConfirmed, setAdultConfirmed] = useState(profile.adultConfirmed);
  const [privacyAccepted, setPrivacyAccepted] = useState(profile.privacyAccepted);
  const [safetyAccepted, setSafetyAccepted] = useState(profile.safetyAccepted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const trimmedDisplayName = displayName.trim();
  const selectedStarterItems = useMemo(
    () => LOVE_LIBRARY_ITEMS.filter(item => selectedStarterIds.includes(item.id)),
    [selectedStarterIds],
  );
  const filteredLibraryItems = useMemo(() => {
    const prioritized = LOVE_LIBRARY_ITEMS.filter(item => focusAreas.includes(item.area));
    const remaining = LOVE_LIBRARY_ITEMS.filter(item => !focusAreas.includes(item.area));
    return [...prioritized, ...remaining];
  }, [focusAreas]);
  const initials = useMemo(
    () =>
      trimmedDisplayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(chunk => chunk[0]?.toUpperCase() ?? '')
        .join('') || 'H2',
    [trimmedDisplayName],
  );
  const canSubmit =
    !saving
    && trimmedDisplayName.length >= 2
    && focusAreas.length >= MIN_FOCUS_AREAS
    && selectedStarterIds.length >= MIN_STARTER_PREFERENCES
    && adultConfirmed
    && privacyAccepted
    && safetyAccepted;

  const toggleFocusArea = (area: LoveArea) => {
    setFocusAreas(current => {
      if (current.includes(area)) {
        if (current.length <= MIN_FOCUS_AREAS) {
          return current;
        }

        return current.filter(value => value !== area);
      }

      return [...current, area];
    });
  };

  const toggleStarter = (starterId: string) => {
    setSelectedStarterIds(current => {
      if (current.includes(starterId)) {
        return current.filter(value => value !== starterId);
      }

      if (current.length >= MAX_STARTER_PREFERENCES) {
        return current;
      }

      return [...current, starterId];
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Finish every step above before entering your Love Space.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await completeOnboarding(user, {
        displayName: trimmedDisplayName,
        notificationPrivacy,
        starterPreferences: selectedStarterItems.map(item => ({
          area: item.area,
          actionText: item.description,
          actionSource: 'library',
          importance: item.importance,
          frequency: item.frequency,
          timing: item.timing,
          customTiming: item.customTiming ?? null,
          visibility: item.visibility,
          notes: '',
        })),
      });
    } catch (nextError: any) {
      setError(nextError.message ?? 'Unable to finish onboarding right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Surface style={styles.hero} elevation={0}>
        <Avatar.Text size={68} label={initials} color="#FFF3EA" style={styles.avatar} />
        <Text variant="headlineMedium" style={styles.header}>
          Build your Love Space
        </Text>
        <Text style={styles.subheader}>
          Start with a few truths about how you feel loved. We’ll use them to shape your first shared experience later.
        </Text>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          1. Your profile
        </Text>
        <TextInput
          mode="outlined"
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          outlineColor="#E7C9BF"
          activeOutlineColor="#D79395"
        />
        <HelperText type="info" visible>
          This is what your partner will see during your reveal moment.
        </HelperText>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          2. Focus areas
        </Text>
        <Text style={styles.cardBody}>Pick at least three areas you most want to feel cared for in.</Text>
        <View style={styles.choiceRow}>
          {LOVE_AREAS.map(area => {
            const selected = focusAreas.includes(area);
            return (
              <Button
                key={area}
                mode={selected ? 'contained' : 'outlined'}
                compact
                onPress={() => toggleFocusArea(area)}
                style={styles.choiceButton}
                buttonColor={selected ? '#B25B63' : undefined}
                textColor={selected ? '#FFF8F3' : '#5B4148'}
              >
                {LOVE_AREA_LABELS[area]}
              </Button>
            );
          })}
        </View>
        <HelperText type={focusAreas.length >= MIN_FOCUS_AREAS ? 'info' : 'error'} visible>
          {focusAreas.length >= MIN_FOCUS_AREAS
            ? `${focusAreas.length} focus areas selected.`
            : `Choose ${MIN_FOCUS_AREAS - focusAreas.length} more focus areas.`}
        </HelperText>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          3. Ways you feel loved
        </Text>
        <Text style={styles.cardBody}>
          Choose {MIN_STARTER_PREFERENCES}-{MAX_STARTER_PREFERENCES} starter ideas that feel true for you right now.
        </Text>
        <View style={styles.selectionRow}>
          <View style={styles.selectionPill}>
            <Text style={styles.selectionPillText}>Selected {selectedStarterIds.length}</Text>
          </View>
          <View style={styles.selectionPill}>
            <Text style={styles.selectionPillText}>Minimum {MIN_STARTER_PREFERENCES}</Text>
          </View>
        </View>
        <View style={styles.list}>
          {filteredLibraryItems.map(item => {
            const selected = selectedStarterIds.includes(item.id);
            const atLimit = !selected && selectedStarterIds.length >= MAX_STARTER_PREFERENCES;

            return (
              <Pressable
                key={item.id}
                onPress={() => toggleStarter(item.id)}
                disabled={atLimit}
                style={({ pressed }) => [
                  styles.libraryItem,
                  selected && styles.libraryItemSelected,
                  pressed && !atLimit && styles.libraryItemPressed,
                  atLimit && styles.libraryItemDisabled,
                ]}
              >
                <View style={styles.libraryItemHeader}>
                  <Text style={styles.libraryItemTitle}>{item.title}</Text>
                  <Text style={styles.libraryItemBadge}>{selected ? 'Chosen' : LOVE_AREA_LABELS[item.area]}</Text>
                </View>
                <Text style={styles.libraryItemBody}>{item.description}</Text>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          4. Notification privacy
        </Text>
        <Text style={styles.cardBody}>Choose how much detail should appear when reminders reach your lock screen.</Text>
        <SegmentedButtons
          value={notificationPrivacy}
          onValueChange={value => setNotificationPrivacy(value as NotificationPrivacyPreference)}
          buttons={NOTIFICATION_OPTIONS}
          style={styles.segmentedButtons}
        />
        <HelperText type="info" visible>
          Detailed shows more context. Discreet keeps things softer. Off is best if you prefer almost no lock-screen detail.
        </HelperText>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          5. Safety and consent
        </Text>
        <Pressable onPress={() => setAdultConfirmed(current => !current)} style={styles.checkRow}>
          <View style={[styles.checkMark, adultConfirmed && styles.checkMarkActive]} />
          <Text style={styles.checkText}>I am 18+ and using this app for a consensual adult relationship.</Text>
        </Pressable>
        <Pressable onPress={() => setPrivacyAccepted(current => !current)} style={styles.checkRow}>
          <View style={[styles.checkMark, privacyAccepted && styles.checkMarkActive]} />
          <Text style={styles.checkText}>I understand some reflections stay private while shared moments are visible to my partner.</Text>
        </Pressable>
        <Pressable onPress={() => setSafetyAccepted(current => !current)} style={styles.checkRow}>
          <View style={[styles.checkMark, safetyAccepted && styles.checkMarkActive]} />
          <Text style={styles.checkText}>I understand I can pause, leave, or withhold sharing whenever something does not feel safe.</Text>
        </Pressable>
      </Surface>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        mode="contained"
        onPress={() => void handleSubmit()}
        loading={saving}
        disabled={!canSubmit}
        style={styles.primaryButton}
        buttonColor="#B25B63"
        textColor="#FFF8F3"
      >
        Enter my Love Space
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF3EA',
  },
  content: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 36,
    gap: 14,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#F3C8BA',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    backgroundColor: '#B25B63',
  },
  header: {
    color: '#3F2831',
    fontWeight: '700',
    textAlign: 'center',
  },
  subheader: {
    color: '#3F2831',
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFF8F3',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F2D3C7',
  },
  cardTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  cardBody: {
    color: '#6B4A55',
    lineHeight: 20,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceButton: {
    borderRadius: 999,
  },
  selectionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectionPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F4D3C7',
  },
  selectionPillText: {
    color: '#5B4148',
    fontWeight: '600',
    fontSize: 12,
  },
  list: {
    gap: 10,
  },
  libraryItem: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#ECD1C5',
    gap: 8,
  },
  libraryItemSelected: {
    borderColor: '#B25B63',
    backgroundColor: '#F9E3DB',
  },
  libraryItemPressed: {
    opacity: 0.88,
  },
  libraryItemDisabled: {
    opacity: 0.55,
  },
  libraryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  libraryItemTitle: {
    flex: 1,
    color: '#3F2831',
    fontWeight: '700',
  },
  libraryItemBadge: {
    color: '#7C5964',
    fontSize: 12,
    fontWeight: '600',
  },
  libraryItemBody: {
    color: '#5B4148',
    lineHeight: 19,
  },
  segmentedButtons: {
    marginTop: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C98F95',
    backgroundColor: '#FFF3EA',
    marginTop: 2,
  },
  checkMarkActive: {
    backgroundColor: '#B25B63',
    borderColor: '#B25B63',
  },
  checkText: {
    flex: 1,
    color: '#5B4148',
    lineHeight: 20,
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 16,
    marginTop: 4,
  },
});
