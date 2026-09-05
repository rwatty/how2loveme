import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { User } from '@react-native-firebase/auth';
import { Avatar, Button, Surface, Text } from 'react-native-paper';
import { LOVE_AREA_LABELS } from '../lib/loveLibrary';
import { markPartnerRevealSeen } from '../lib/relationshipSync';
import { useLoveProfileStore } from '../store/useLoveProfileStore';
import type { PartnerRevealProfile, RelationshipProfile } from '../store/useRelationshipStore';

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(chunk => chunk[0]?.toUpperCase() ?? '')
      .join('') || 'H2'
  );
}

export default function PartnerRevealScreen({
  user,
  profile,
  partnerReveal,
}: {
  user: User;
  profile: RelationshipProfile;
  partnerReveal: PartnerRevealProfile | null;
}) {
  const preferences = useLoveProfileStore(state => state.preferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const yourHighlights = useMemo(
    () => preferences.slice(0, 3).map(preference => preference.actionText),
    [preferences],
  );
  const partnerName = partnerReveal?.displayName || profile.partnerEmail || 'Your partner';
  const sharedAreas = useMemo(
    () => (partnerReveal?.highlightAreas ?? []).map(area => LOVE_AREA_LABELS[area as keyof typeof LOVE_AREA_LABELS] ?? area),
    [partnerReveal?.highlightAreas],
  );

  const handleContinue = async () => {
    if (!profile.coupleId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await markPartnerRevealSeen(user, profile.coupleId);
    } catch (nextError: any) {
      setError(nextError.message ?? 'Unable to open your shared Love Space right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Surface style={styles.hero} elevation={0}>
        <View style={styles.avatarRow}>
          <Avatar.Text size={66} label={getInitials(profile.displayName || profile.email)} color="#FFF3EA" style={styles.meAvatar} />
          <Avatar.Text size={66} label={getInitials(partnerName)} color="#FFF3EA" style={styles.partnerAvatar} />
        </View>
        <Text variant="headlineMedium" style={styles.header}>
          Your Love Space is open
        </Text>
        <Text style={styles.subheader}>
          You and {partnerName} are connected. Here’s the first emotional handoff before you step into the shared space.
        </Text>
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          What {partnerName} wants more of
        </Text>
        {partnerReveal?.highlightActions?.length ? (
          partnerReveal.highlightActions.map(action => (
            <View key={action} style={styles.revealItem}>
              <Text style={styles.revealItemText}>{action}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardBody}>
            Their first shared preferences are still warming up. Mirror notes, Love Actions, and future updates will keep filling this in.
          </Text>
        )}
        {!!sharedAreas.length && (
          <View style={styles.pillRow}>
            {sharedAreas.map(area => (
              <View key={area} style={styles.pill}>
                <Text style={styles.pillText}>{area}</Text>
              </View>
            ))}
          </View>
        )}
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          What you already named
        </Text>
        {yourHighlights.length ? (
          yourHighlights.map(action => (
            <View key={action} style={styles.revealItem}>
              <Text style={styles.revealItemText}>{action}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.cardBody}>Your first five starter preferences are saved and will show up here as soon as sync finishes.</Text>
        )}
      </Surface>

      <Surface style={styles.card} elevation={0}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          What opens now
        </Text>
        <Text style={styles.cardBody}>Mirror notes become shared. Love Actions can turn into real agreements. Calendar rituals and Insights can start reflecting both of you.</Text>
      </Surface>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <Button
        mode="contained"
        onPress={() => void handleContinue()}
        loading={loading}
        disabled={loading || !profile.coupleId}
        style={styles.primaryButton}
        buttonColor="#B25B63"
        textColor="#FFF8F3"
      >
        Step into our Love Space
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
    gap: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  meAvatar: {
    backgroundColor: '#B25B63',
  },
  partnerAvatar: {
    backgroundColor: '#8E6768',
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
    color: '#5B4148',
    lineHeight: 21,
  },
  revealItem: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: '#FFF3EA',
    borderWidth: 1,
    borderColor: '#ECD1C5',
  },
  revealItemText: {
    color: '#3F2831',
    lineHeight: 20,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F4D3C7',
  },
  pillText: {
    color: '#5B4148',
    fontWeight: '600',
    fontSize: 12,
  },
  errorText: {
    color: '#B25B63',
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 16,
  },
});
