import { create } from 'zustand';

export type RelationshipProfile = {
  userId: string;
  email: string;
  normalizedEmail: string;
  partnerId: string | null;
  partnerEmail: string | null;
  coupleId: string | null;
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
  syncing: boolean;
  error: string;
  profile: RelationshipProfile | null;
  incomingInvites: PartnerInvite[];
  outgoingInvite: PartnerInvite | null;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string) => void;
  setProfile: (profile: RelationshipProfile | null) => void;
  setIncomingInvites: (invites: PartnerInvite[]) => void;
  setOutgoingInvite: (invite: PartnerInvite | null) => void;
  reset: () => void;
};

export const useRelationshipStore = create<RelationshipState>(set => ({
  syncing: false,
  error: '',
  profile: null,
  incomingInvites: [],
  outgoingInvite: null,
  setSyncing: syncing => set({ syncing }),
  setError: error => set({ error }),
  setProfile: profile => set({ profile }),
  setIncomingInvites: incomingInvites => set({ incomingInvites }),
  setOutgoingInvite: outgoingInvite => set({ outgoingInvite }),
  reset: () =>
    set({
      syncing: false,
      error: '',
      profile: null,
      incomingInvites: [],
      outgoingInvite: null,
    }),
}));
