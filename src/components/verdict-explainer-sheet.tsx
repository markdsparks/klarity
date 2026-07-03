import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getLadderExplainer, type LadderAxis, type LadderLevel } from '@/data/verdict-ladder';

// "What does this word mean, and why did THIS product get it?" bottom sheet
// (spec 013 follow-up). Tapping any ladder badge (the hero glance chips, or
// the nutrition-card tone tag) opens this: the generic meaning of the word on
// that axis's ladder, how we calculate it, the full ladder for context, and a
// product-specific line composed by the caller from data already on screen.

export interface VerdictExplainerInput {
  axis: LadderAxis;
  level: LadderLevel;
  productContext: string;
}

const LEVEL_COLOR: Record<LadderLevel, { bg: string; fg: string }> = {
  everyday: { bg: '#e8f7ef', fg: '#1f9d6b' },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a' },
  occasionally: { bg: '#fbe7db', fg: '#c2410c' },
  contested: { bg: '#efecfb', fg: '#6b5bd2' },
};

export function VerdictExplainerSheet({
  input,
  onClose,
}: {
  input: VerdictExplainerInput | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const explainer = input ? getLadderExplainer(input.axis, input.level) : null;
  const color = input ? LEVEL_COLOR[input.level] : null;

  return (
    <Modal
      visible={explainer != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {explainer && color && input ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.levelPill, { backgroundColor: color.bg }]}>
                <Text style={[styles.levelPillText, { color: color.fg }]}>{explainer.title}</Text>
              </View>

              <Text style={styles.body}>{explainer.body}</Text>

              <Text style={styles.sectionLabel}>For this product</Text>
              <View style={styles.productBox}>
                <Text style={styles.productText}>{input.productContext}</Text>
              </View>

              <Text style={styles.sectionLabel}>The full ladder</Text>
              <View style={styles.ladder}>
                {explainer.steps.map(step => {
                  const active = step.level === explainer.level;
                  const stepColor = LEVEL_COLOR[step.level];
                  return (
                    <View key={step.level} style={[styles.ladderRow, active && styles.ladderRowActive]}>
                      <View style={[styles.ladderDot, { backgroundColor: stepColor.fg }]} />
                      <View style={styles.ladderText}>
                        <Text style={[styles.ladderLabel, active && { color: stepColor.fg }]}>{step.label}</Text>
                        <Text style={styles.ladderBlurb}>{step.blurb}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>How we calculate this</Text>
              <Text style={styles.method}>{explainer.method}</Text>
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        ) : <View />}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(14,17,22,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 12,
    maxHeight: '85%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d7dce3', marginBottom: 18 },

  levelPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 14 },
  levelPillText: { fontSize: 15, fontWeight: '800' },

  body: { fontSize: 15, lineHeight: 23, color: '#3c4654' },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#9aa4b2', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },

  productBox: { backgroundColor: '#f6f8fa', borderRadius: 14, padding: 14 },
  productText: { fontSize: 14, lineHeight: 20, color: '#1a1f29', fontWeight: '500' },

  ladder: { gap: 10 },
  ladderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', opacity: 0.5 },
  ladderRowActive: { opacity: 1 },
  ladderDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  ladderText: { flex: 1, gap: 1 },
  ladderLabel: { fontSize: 14, fontWeight: '700', color: '#1a1f29' },
  ladderBlurb: { fontSize: 12.5, color: '#8896a7', lineHeight: 17 },

  method: { fontSize: 13, lineHeight: 19, color: '#5a6472', fontStyle: 'italic' },

  closeBtn: { marginTop: 20, backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
