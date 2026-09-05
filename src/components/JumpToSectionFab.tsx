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
  const bottomOffset = Math.max(insets.bottom + 78, 92);

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
      <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset }]}>
        {open ? (
          <Surface style={styles.menu} elevation={4}>
            <View style={styles.menuHeader}>
              <Text variant="titleSmall" style={styles.menuTitle}>
                Jump to section
              </Text>
              <Text style={styles.menuMeta}>{`${sections.length} sections`}</Text>
            </View>
            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menuList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {sections.map(section => (
                <Button
                  key={section.key}
                  mode="contained-tonal"
                  icon="chevron-right"
                  style={styles.menuButton}
                  buttonColor="#F8E8DE"
                  textColor="#7C5964"
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
    minWidth: 204,
    maxWidth: 252,
    borderRadius: 22,
    backgroundColor: '#FFF8F3',
    borderWidth: 1,
    borderColor: '#F0D0C0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  menuHeader: {
    gap: 2,
    paddingHorizontal: 4,
  },
  menuTitle: {
    color: '#3F2831',
    fontWeight: '700',
  },
  menuMeta: {
    color: '#8D7279',
    fontSize: 12,
  },
  menuScroll: {
    maxHeight: 280,
  },
  menuList: {
    gap: 6,
  },
  menuButton: {
    borderRadius: 16,
  },
  menuButtonContent: {
    justifyContent: 'flex-start',
    minHeight: 42,
    paddingHorizontal: 4,
  },
  menuButtonLabel: {
    color: '#7C5964',
    fontWeight: '700',
  },
  fab: {
    backgroundColor: '#B25B63',
    borderRadius: 18,
  },
});
