import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FeedbackCategory } from '@/services/diagnostics';

// One-tap feedback capture (spec 009 M2). Tap a category, optionally add a
// note, submit. Local only — the human signal that raw outcome stats can't
// give ("this verdict felt wrong"). Reuses the bottom-sheet pattern.

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  'wrong-verdict': 'The verdict felt wrong',
  'wrong-data': 'The numbers look off',
  'missing-additive': 'Missed an ingredient',
  'not-found': 'Here’s what this was',
  other: 'Something else',
};

export function FeedbackSheet({
  title,
  categories,
  notePlaceholder,
  onSubmit,
  onClose,
}: {
  title: string | null;                 // null = hidden
  categories: FeedbackCategory[];
  notePlaceholder?: string;
  onSubmit: (category: FeedbackCategory, note: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<FeedbackCategory | null>(null);
  const [note, setNote] = useState('');

  // A single-category sheet (not-found) preselects it so it's one tap + note.
  const effective = selected ?? (categories.length === 1 ? categories[0] : null);

  function reset() {
    setSelected(null);
    setNote('');
  }

  function submit() {
    if (!effective) return;
    onSubmit(effective, note.trim());
    reset();
    onClose();
  }

  return (
    <Modal visible={title != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={() => { reset(); onClose(); }}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title}</Text>

          {categories.length > 1 && (
            <View style={styles.chips}>
              {categories.map(c => (
                <Pressable
                  key={c}
                  style={[styles.chip, effective === c && styles.chipOn]}
                  onPress={() => setSelected(c)}>
                  <Text style={[styles.chipText, effective === c && styles.chipTextOn]}>
                    {CATEGORY_LABEL[c]}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <TextInput
            style={styles.note}
            placeholder={notePlaceholder ?? 'Add a note (optional)'}
            placeholderTextColor="#9fadbf"
            value={note}
            onChangeText={setNote}
            multiline
          />

          <Pressable
            style={[styles.submit, !effective && styles.submitDisabled]}
            disabled={!effective}
            onPress={submit}>
            <Text style={styles.submitText}>Send feedback</Text>
          </Pressable>
          <Text style={styles.privacy}>Stays on this device — nothing is sent anywhere.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,17,22,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d7dce3', marginBottom: 16 },
  title: { fontSize: 19, fontWeight: '800', color: '#1b2330', letterSpacing: -0.3, marginBottom: 14 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderRadius: 99, borderWidth: 1, borderColor: '#dde4ee',
    paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#fff',
  },
  chipOn: { borderColor: '#1f9d6b', backgroundColor: '#f0faf5' },
  chipText: { fontSize: 13.5, fontWeight: '600', color: '#5b6675' },
  chipTextOn: { color: '#1f9d6b', fontWeight: '700' },

  note: {
    minHeight: 64, borderRadius: 14, backgroundColor: '#f1f4f8',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1a1f29',
    textAlignVertical: 'top',
  },

  submit: { marginTop: 14, backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitDisabled: { backgroundColor: '#c3cad4' },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  privacy: { fontSize: 11.5, color: '#9fadbf', textAlign: 'center', marginTop: 10 },
});
