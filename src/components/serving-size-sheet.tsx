import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheetBase } from './bottom-sheet-base';
import { toGrams, type ServingUnit } from '@/services/user-serving';

// Spec 023 — user-entered serving size, offered only when the serving is a
// guess (racc-estimate / per-100g). The user is holding the package; the
// label's serving size beats any category estimate we can make.

export function ServingSizeSheet({ visible, initialGrams, onSave, onClear, onClose }: {
  visible: boolean;
  initialGrams: number | null;   // an existing user-entered value, for editing
  onSave: (grams: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<ServingUnit>('g');

  // Re-seed the fields on each open transition (render-time state
  // adjustment, per react.dev's "adjusting state when a prop changes" —
  // not an effect). Only on the closed→open edge, so typing wins while
  // the sheet is up.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setText(initialGrams != null ? String(initialGrams) : '');
      setUnit('g');
    }
  }

  const grams = toGrams(parseFloat(text.replace(',', '.')), unit);
  const canSave = grams != null;

  return (
    <BottomSheetBase
      visible={visible}
      onClose={onClose}
      footer={
        <View style={styles.footerRow}>
          {initialGrams != null && (
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { onClear(); onClose(); }}>
              <Text style={styles.btnGhostText}>Clear</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.btn, styles.btnPrimary, !canSave && styles.btnDisabled]}
            disabled={!canSave}
            onPress={() => { if (grams != null) { onSave(grams); onClose(); } }}>
            <Text style={styles.btnPrimaryText}>Save</Text>
          </Pressable>
        </View>
      }>
      <Text style={styles.title}>Serving size</Text>
      <Text style={styles.body}>
        We couldn&apos;t find this product&apos;s serving size, so the numbers use an estimate.
        The Nutrition Facts panel on the package lists the real one — enter it here and
        we&apos;ll remember it for this product.
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={unit === 'g' ? 'e.g. 30' : 'e.g. 1'}
          placeholderTextColor="#9aa4b2"
          autoFocus
        />
        <View style={styles.unitChips}>
          {(['g', 'oz'] as const).map(u => (
            <Pressable
              key={u}
              style={[styles.unitChip, unit === u && styles.unitChipActive]}
              onPress={() => setUnit(u)}>
              <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {unit === 'oz' && grams != null && (
        <Text style={styles.conversionHint}>= {grams} g</Text>
      )}
      {text.length > 0 && grams == null && (
        <Text style={styles.invalidHint}>Enter a serving between 0 and 2,000 g.</Text>
      )}
    </BottomSheetBase>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '700', color: '#17202b', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: '#5b6675', marginBottom: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#d5dbe3', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: '#17202b',
    backgroundColor: '#f7f8fa',
  },
  unitChips: { flexDirection: 'row', gap: 6 },
  unitChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#d5dbe3', backgroundColor: '#ffffff',
  },
  unitChipActive: { backgroundColor: '#17202b', borderColor: '#17202b' },
  unitChipText: { fontSize: 15, fontWeight: '600', color: '#5b6675' },
  unitChipTextActive: { color: '#ffffff' },
  conversionHint: { marginTop: 8, fontSize: 13, color: '#5b6675' },
  invalidHint: { marginTop: 8, fontSize: 13, color: '#cf4b4b' },
  footerRow: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#1f9d6b' },
  btnPrimaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  btnGhost: { borderWidth: 1, borderColor: '#d5dbe3', backgroundColor: '#ffffff' },
  btnGhostText: { color: '#5b6675', fontSize: 16, fontWeight: '600' },
});
