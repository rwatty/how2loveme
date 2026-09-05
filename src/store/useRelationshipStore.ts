import { create } from 'zustand';

export type NotificationPrivacyPreference = 'detailed' | 'discreet' | 'off';

export type RelationshipProfile = {
  userId: string;
  email: string;
  normalizedEmail: string;
  partnerId: string | null;
  partnerEmail: string | null;
  coupleId: string | null;
  displayName: string;
  notificationPrivacy: NotificationPrivacyPreference;
  adultConfirmed: boolean;
  privacyAccepted: boolean;
  safetyAccepted: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: number | null;
  revealSeenCoupleId: string | null;
};

export type PartnerRevealProfile = {
  userId: string;
  email: string;
  displayName: string;
  preferenceCount: number;
  highlightAreas: string[];
  highlightActions: string[];
  updatedAt: number | null;
};

export type PartnerInvite = {
  id: string;
  fromUserId: string;
  fromEmail: string;
  toEmail: string;
  status: string;
  createdAt: number;
};

type RelationshipState = {
  hydrated: boolean;
  syncing: boolean;
  error: string;
  profile: RelationshipProfile | null;
  partnerReveal: PartnerRevealProfile | null;
  incomingInvites: PartnerInvite[];
  outgoingInvite: PartnerInvite | null;
  setHydrated: (hydrated: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string) => void;
  setProfile: (profile: RelationshipProfile | null) => void;
  setPartnerReveal: (partnerReveal: PartnerRevealProfile | null) => void;
  setIncomingInvites: (invites: PartnerInvite[]) => void;
  setOutgoingInvite: (invite: PartnerInvite | null) => void;
  reset: () => void;
};

export const useRelationshipStore = create<RelationshipState>(set => ({
  hydrated: false,
  syncing: false,
  error: '',
  profile: null,
  partnerReveal: null,
  incomingInvites: [],
  outgoingInvite: null,
  setHydrated: hydrated => set({ hydrated }),
  setSyncing: syncing => set({ syncing }),
  setError: error => set({ error }),
  setProfile: profile => set({ profile }),
  setPartnerReveal: partnerReveal => set({ partnerReveal }),
  setIncomingInvites: incomingInvites => set({ incomingInvites }),
  setOutgoingInvite: outgoingInvite => set({ outgoingInvite }),
  reset: () =>
    set({
      hydrated: false,
      syncing: false,
      error: '',
      profile: null,
      partnerReveal: null,
      incomingInvites: [],
      outgoingInvite: null,
    }),
}));
