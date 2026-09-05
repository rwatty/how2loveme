import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, FAB, Portal, Surface, Text } from 'react-native-paper';

export type JumpSection = {
  key: string;
  label: string;
};

type JumpToSectionFabProps = {
  sections: JumpSection[];
  onSelectSection: (key: string) => void;
};

export default function JumpToSectionFab({ sections, onSelectSection }: JumpToSectionFabProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sections.length < 2 && open) {
      setOpen(false);
    }
  }, [open, sections.length]);

  if (sections.length < 2) {
    return null;
  }

  return (
    <Portal>
      {open ? <Pressable style={styles.scrim} onPress={() => setOpen(false)} /> : null}
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 82 }]}> 
        {open ? (
          <Surface style={styles.menu} elevation={4}>
            <Text variant="titleSmall" style={styles.menuTitle}>
              Jump to section
            </Text>
            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menuList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sections.map(section => (
                <Button
                  key={section.key}
                  mode="text"
                  compact
                  contentStyle={styles.menuButtonContent}
                  labelStyle={styles.menuButtonLabel}
                  accessibilityLabel={`Jump to ${section.label}`}
                  accessibilityHint="Scroll this screen to the selected section"
                  onPress={() => {
                    setOpen(false);
                    onSelectSection(section.key);
                  }}
                >
                  {section.label}
                </Button>
              ))}
            </ScrollView>
          </Surface>
        ) : null}
        <FAB
          icon={open ? 'close' : 'format-list-bulleted'}
          label={open ? 'Close' : 'Jump to'}
          accessibilityLabel={open ? 'Close section jump menu' : 'Open section jump menu'}
          accessibilityHint={open ? 'Close the list of sections for this screen' : 'Open a list of sections to jump through this screen'}
          onPress={() => setOpen(current => !current)}
          style={styles.fab}
          color="#FFF8F3"
          customSize={56}
        />
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(63, 40, 49, 0.12)',
  },
  wrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'flex-end',
    gap: 10,
  },
  menu: {
    minWidth: 188,
    maxWidth: 240,
    borderRadius: 20,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0D0C0',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  menuTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  menuScroll: {
    maxHeight: 280,
  },
  menuList: {
    gap: 4,
  },
  menuButtonContent: {
    justifyContent: 'flex-start',
    minHeight: 36,
  },
  menuButtonLabel: {
    color: '#7C5964',
    fontWeight: '700',
  },
  fab: {
    backgroundColor: '#B25B63',
  },
});
