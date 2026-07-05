import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getLadderExplainer, type AdditiveLink, type LadderAxis, type LadderLevel } from '@/data/verdict-ladder';
import { AskAboutThis } from '@/components/ask-about-this';
import { BottomSheetBase } from '@/components/bottom-sheet-base';
import type { AskContext } from '@/services/qa/ask';

// "What does this word mean, and why did THIS product get it?" bottom sheet
// (spec 013 follow-up). Tapping any ladder badge (the hero glance chips, or
// the nutrition-card tone tag) opens this: the generic meaning of the word on
// that axis's ladder, how we calculate it, the full ladder for context, and a
// product-specific line composed by the caller from data already on screen.
// Renders through BottomSheetBase (ADR-004) rather than a hand-rolled Modal.
//
// When the caller identifies one specific additive as the driver, `link`
// renders as a real tappable row that closes the sheet and jumps straight to
// that additive's evidence page — the sheet covers the additives list below,
// so it never tells the user to "tap it below" and leave them nowhere to tap.

export interface VerdictExplainerInput {
  axis: LadderAxis;
  level: LadderLevel;
  productContext: string;
  productLink?: AdditiveLink;
  askContext?: AskContext;
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
  const explainer = input ? getLadderExplainer(input.axis, input.level) : null;
  const color = input ? LEVEL_COLOR[input.level] : null;

  function openLink(link: AdditiveLink) {
    onClose();
    router.push(`/additive/${link.id}`);
  }

  return (
    <BottomSheetBase
      visible={explainer != null}
      onClose={onClose}
      footer={
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Got it</Text>
        </Pressable>
      }>
      {explainer && color && input ? (
        <>
          <View style={[styles.levelPill, { backgroundColor: color.bg }]}>
            <Text style={[styles.levelPillText, { color: color.fg }]}>{explainer.title}</Text>
          </View>

          <Text style={styles.body}>{explainer.body}</Text>

          <Text style={styles.sectionLabel}>For this product</Text>
          <Text style={styles.productText}>{input.productContext}</Text>
          {input.productLink ? (
            <Pressable
              style={({ pressed }) => [styles.productLinkRow, pressed && styles.productLinkRowPressed]}
              onPress={() => openLink(input.productLink!)}>
              <Text style={styles.productLinkName} numberOfLines={1}>{input.productLink.name}</Text>
              <View style={[styles.productLinkPill, { backgroundColor: LEVEL_COLOR[input.productLink.verdict].bg }]}>
                <Text style={[styles.productLinkPillText, { color: LEVEL_COLOR[input.productLink.verdict].fg }]}>
                  {input.productLink.verdict === 'contested' ? 'Contested' : 'Sometimes'}
                </Text>
              </View>
              <Text style={styles.productLinkChevron}>›</Text>
            </Pressable>
          ) : null}

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

          {input.askContext ? <AskAboutThis context={input.askContext} /> : null}
        </>
      ) : null}
    </BottomSheetBase>
  );
}

const styles = StyleSheet.create({
  levelPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 14 },
  levelPillText: { fontSize: 15, fontWeight: '800' },

  body: { fontSize: 15, lineHeight: 23, color: '#3c4654' },

  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#9aa4b2', textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },

  productText: { fontSize: 14, lineHeight: 20, color: '#1a1f29', fontWeight: '500' },

  productLinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f6f8fa', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    marginTop: 10,
  },
  productLinkRowPressed: { opacity: 0.6 },
  productLinkName: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#1a1f29' },
  productLinkPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  productLinkPillText: { fontSize: 11.5, fontWeight: '800' },
  productLinkChevron: { fontSize: 17, color: '#c3cad4' },

  ladder: { gap: 10 },
  ladderRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', opacity: 0.5 },
  ladderRowActive: { opacity: 1 },
  ladderDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  ladderText: { flex: 1, gap: 1 },
  ladderLabel: { fontSize: 14, fontWeight: '700', color: '#1a1f29' },
  ladderBlurb: { fontSize: 12.5, color: '#8896a7', lineHeight: 17 },

  method: { fontSize: 13, lineHeight: 19, color: '#5a6472', fontStyle: 'italic' },

  closeBtn: { backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
