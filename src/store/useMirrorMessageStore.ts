import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LoveNoteTag, LoveNoteType } from '../lib/loveNotes';

export type MirrorPoint = {
  x: number;
  y: number;
};

export type MirrorStroke = MirrorPoint[];

export type MirrorMessage = {
  id: string;
  text: string;
  strokes: MirrorStroke[];
  createdAt: number;
  revealProgress: number;
  senderId: string;
  senderEmail: string;
  noteType: LoveNoteType;
  tags: LoveNoteTag[];
  promptId: string | null;
};

type MirrorMessageState = {
  hydrated: boolean;
  syncing: boolean;
  messages: MirrorMessage[];
  selectedMessageId: string | null;
  setHydrated: (hydrated: boolean) => void;
  setSyncing: (syncing: boolean) => void;
  replaceMessages: (messages: MirrorMessage[]) => void;
  selectMessage: (messageId: string) => void;
  setRevealProgress: (messageId: string, progress: number) => void;
  clearMessages: () => void;
};

const MIRROR_MESSAGE_STORAGE_KEY = '@how2loveme/mirror-message-store';

export const useMirrorMessageStore = create<MirrorMessageState>()(
  persist(
    set => ({
      hydrated: false,
      syncing: false,
      messages: [],
      selectedMessageId: null,
      setHydrated: hydrated => set({ hydrated }),
      setSyncing: syncing => set({ syncing }),
      replaceMessages: messages =>
        set(state => {
          const existingRevealProgress = new Map(
            state.messages.map(message => [message.id, message.revealProgress]),
          );
          const mergedMessages = messages.map(message => ({
            ...message,
            revealProgress: existingRevealProgress.get(message.id) ?? message.revealProgress,
          }));
          const selectedMessageId = mergedMessages.some(message => message.id === state.selectedMessageId)
            ? state.selectedMessageId
            : mergedMessages[0]?.id ?? null;

          return {
            messages: mergedMessages,
            selectedMessageId,
          };
        }),
      selectMessage: messageId => set({ selectedMessageId: messageId }),
      setRevealProgress: (messageId, progress) =>
        set(state => ({
          messages: state.messages.map(message =>
            message.id === messageId
              ? { ...message, revealProgress: Math.max(0, Math.min(1, progress)) }
              : message,
          ),
        })),
      clearMessages: () => set({ messages: [], selectedMessageId: null, syncing: false }),
    }),
    {
      name: MIRROR_MESSAGE_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        messages: state.messages,
        selectedMessageId: state.selectedMessageId,
      }),
      onRehydrateStorage: () => state => {
        state?.setHydrated(true);
      },
    },
  ),
);
