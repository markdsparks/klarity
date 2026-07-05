import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheetBase } from '@/components/bottom-sheet-base';
import type { VerdictKey } from '@/types/index';

// Bottom sheet for build choices (spec 006 M2). Each option shows its calorie
// delta AND its additive consequence — evidence-guided ordering at the moment
// of decision (Q3). One component serves both slot pickers (single-select,
// closes on pick) and add-ons (multi-select, stays open). Renders through
// BottomSheetBase (ADR-004) rather than a hand-rolled Modal.

export interface BuildOption {
  id: string;                 // catalog id, or 'none'
  name: string;
  calDelta: number;           // vs the current selection (slots) or the build (add-ons)
  additiveNote: string;       // 'Adds annatto' · 'No rated additives'
  additiveTone: VerdictKey | null;  // worst base verdict among introduced additives
  selected: boolean;
}

const TONE_COLOR: Record<VerdictKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'everyday'  },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'sometimes' },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'contested' },
};

function calDeltaLabel(delta: number): string {
  if (delta === 0) return '±0 cal';
  return `${delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta))} cal`;
}

export function OptionSheet({
  title,
  options,
  multi,
  onSelect,
  onClose,
}: {
  title: string | null;       // null = hidden
  options: BuildOption[];
  multi: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheetBase
      visible={title != null}
      onClose={onClose}
      footer={
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>{multi ? 'Done' : 'Cancel'}</Text>
        </Pressable>
      }>
      <Text style={styles.title}>{title}</Text>
      {options.map(opt => {
        const tone = opt.additiveTone ? TONE_COLOR[opt.additiveTone] : null;
        return (
          <Pressable
            key={opt.id}
            style={[styles.optionRow, opt.selected && styles.optionRowSelected]}
            onPress={() => {
              onSelect(opt.id);
              if (!multi) onClose();
            }}>
            <View style={[styles.radio, opt.selected && styles.radioSelected]}>
              {opt.selected ? <Text style={styles.radioCheck}>✓</Text> : null}
            </View>
            <View style={styles.optionInfo}>
              <Text style={styles.optionName}>{opt.name}</Text>
              <View style={styles.optionMetaRow}>
                <Text style={styles.optionNote}>{opt.additiveNote}</Text>
                {tone ? (
                  <View style={[styles.tonePill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.tonePillText, { color: tone.fg }]}>{tone.label}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Text style={styles.calDelta}>{calDeltaLabel(opt.calDelta)}</Text>
          </Pressable>
        );
      })}
    </BottomSheetBase>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', color: '#1b2330', letterSpacing: -0.3, marginBottom: 8 },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 10,
    borderRadius: 14,
  },
  optionRowSelected: { backgroundColor: '#f0faf5' },
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#d0d8e4',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#1f9d6b', backgroundColor: '#1f9d6b' },
  radioCheck: { color: '#fff', fontSize: 13, fontWeight: '800' },
  optionInfo: { flex: 1, gap: 3 },
  optionName: { fontSize: 15, fontWeight: '700', color: '#1b2330' },
  optionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  optionNote: { fontSize: 12, color: '#8a94a3', flexShrink: 1 },
  tonePill: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  tonePillText: { fontSize: 10, fontWeight: '800' },
  calDelta: { fontSize: 13, fontWeight: '700', color: '#5a6472' },

  closeBtn: { backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
