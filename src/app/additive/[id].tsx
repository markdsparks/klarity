import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ADDITIVES } from '@/data/additives';
import type { EvidenceTier, VerdictKey } from '@/types/index';
import { TIER_LABEL } from '@/types/index';

const VERDICT_STYLE: Record<VerdictKey, { bg: string; fg: string; label: string; blurb: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday',  blurb: 'No concern at typical intake' },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes', blurb: 'Real evidence — frequency matters' },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested', blurb: 'Credible authorities genuinely disagree' },
};

const TIER_COLOUR: Record<EvidenceTier, { bg: string; fg: string }> = {
  A: { bg: '#e8f7ef', fg: '#1f9d6b' },
  B: { bg: '#e8f0fe', fg: '#3d6bcc' },
  C: { bg: '#fdf3e3', fg: '#c8821a' },
  D: { bg: '#f1f4f8', fg: '#8896a7' },
};

export default function AdditiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const additive = id ? ADDITIVES[id] : undefined;

  if (!additive) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.errorText}>Additive not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  const vs = VERDICT_STYLE[additive.baseVerdict];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}>

      {/* Back */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back to product</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.name}>{additive.name}</Text>
          {additive.eNumber ? <Text style={styles.eNumber}>{additive.eNumber}</Text> : null}
        </View>
        <Text style={styles.role}>{additive.role}</Text>
      </View>

      {/* Verdict pill */}
      <View style={[styles.verdictBadge, { backgroundColor: vs.bg }]}>
        <View style={[styles.verdictDot, { backgroundColor: vs.fg }]} />
        <View>
          <Text style={[styles.verdictLabel, { color: vs.fg }]}>{vs.label}</Text>
          <Text style={[styles.verdictBlurb, { color: vs.fg }]}>{vs.blurb}</Text>
        </View>
      </View>

      {/* Headline */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Summary</Text>
        <Text style={styles.headline}>{additive.headline}</Text>
      </View>

      {/* Exposure */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Exposure context</Text>
        <View style={styles.exposureRow}>
          <Text style={styles.exposureKey}>Typical use</Text>
          <Text style={styles.exposureVal}>{additive.exposure.typical}</Text>
        </View>
        {additive.exposure.concerning !== 'None at food levels' && (
          <View style={styles.exposureRow}>
            <Text style={styles.exposureKey}>Concerning range</Text>
            <Text style={styles.exposureVal}>{additive.exposure.concerning}</Text>
          </View>
        )}
        <Text style={styles.exposureNote}>{additive.exposure.note}</Text>
      </View>

      {/* Evidence trail */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Evidence trail</Text>
        {additive.evidence.map((item, i) => {
          const tc = TIER_COLOUR[item.tier];
          const dismissed = item.applies === false;
          return (
            <View key={i} style={[styles.evidenceItem, dismissed && styles.evidenceDismissed]}>
              <View style={styles.evidenceHeader}>
                <View style={[styles.tierBadge, { backgroundColor: tc.bg }]}>
                  <Text style={[styles.tierText, { color: tc.fg }]}>Tier {item.tier}</Text>
                </View>
                {dismissed && <Text style={styles.dismissedTag}>DISMISSED</Text>}
                {item.applies === 'split' && <Text style={styles.splitTag}>SPLIT</Text>}
              </View>
              <Text style={[styles.evidenceClaim, dismissed && styles.strikethrough]}>
                {item.claim}
              </Text>
              <Text style={styles.evidenceWhy}>{item.why}</Text>
              <Text style={styles.tierLabel}>{TIER_LABEL[item.tier]}</Text>
            </View>
          );
        })}
      </View>

      {/* Open question */}
      {additive.openQuestion && (
        <View style={[styles.card, styles.openQuestionCard]}>
          <Text style={styles.cardLabel}>Open question</Text>
          <Text style={styles.openQuestionText}>{additive.openQuestion.text}</Text>
        </View>
      )}

      {/* Contested guidance */}
      {additive.contestedGuidance && (
        <View style={[styles.card, styles.guidanceCard]}>
          <Text style={styles.cardLabel}>Practical take</Text>
          <Text style={styles.guidanceText}>{additive.contestedGuidance}</Text>
        </View>
      )}

      {/* Benefit / avoidability chips */}
      <View style={styles.chips}>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Benefit</Text>
          <Text style={styles.chipValue}>{additive.benefit}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>Avoidability</Text>
          <Text style={styles.chipValue}>{additive.avoidability}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f6f8fa' },
  content: { paddingHorizontal: 16, gap: 12 },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f6f8fa' },
  errorText: { fontSize: 16, color: '#5b6675' },
  backLink: { fontSize: 14, color: '#1f9d6b', fontWeight: '600' },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#5b6675' },

  header: { gap: 4, paddingHorizontal: 2 },
  headerTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  name: { fontSize: 24, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.5, flex: 1 },
  eNumber: { fontSize: 14, fontWeight: '600', color: '#8896a7' },
  role: { fontSize: 13, color: '#5b6675', lineHeight: 18 },

  verdictBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
  },
  verdictDot: { width: 12, height: 12, borderRadius: 6 },
  verdictLabel: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  verdictBlurb: { fontSize: 12, fontWeight: '500', marginTop: 1, opacity: 0.85 },

  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e7ebf0', gap: 10 },
  cardLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: '#8896a7' },

  headline: { fontSize: 15, color: '#1a1f29', lineHeight: 22 },

  exposureRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  exposureKey: { fontSize: 12, fontWeight: '700', color: '#1a1f29', minWidth: 110 },
  exposureVal: { fontSize: 12, color: '#5b6675', flex: 1 },
  exposureNote: { fontSize: 12.5, color: '#5b6675', lineHeight: 18, fontStyle: 'italic' },

  evidenceItem: {
    borderTopWidth: 1, borderColor: '#f1f4f8',
    paddingTop: 10, gap: 5,
  },
  evidenceDismissed: { opacity: 0.55 },
  evidenceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tierText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  dismissedTag: { fontSize: 10, fontWeight: '800', color: '#cf4b4b', letterSpacing: 0.4 },
  splitTag: { fontSize: 10, fontWeight: '800', color: '#6b5bd2', letterSpacing: 0.4 },
  evidenceClaim: { fontSize: 13.5, fontWeight: '600', color: '#1a1f29', lineHeight: 19 },
  strikethrough: { textDecorationLine: 'line-through' },
  evidenceWhy: { fontSize: 12.5, color: '#5b6675', lineHeight: 18 },
  tierLabel: { fontSize: 11, color: '#9fadbf', fontStyle: 'italic' },

  openQuestionCard: { borderColor: '#d5dce6', backgroundColor: '#fafbfc' },
  openQuestionText: { fontSize: 13.5, color: '#1a1f29', lineHeight: 20, fontStyle: 'italic' },

  guidanceCard: { borderColor: '#c3e6d5', backgroundColor: '#f0faf5' },
  guidanceText: { fontSize: 13.5, color: '#1a1f29', lineHeight: 20 },

  chips: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e7ebf0', gap: 3 },
  chipLabel: { fontSize: 10, fontWeight: '700', color: '#9fadbf', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipValue: { fontSize: 13, fontWeight: '600', color: '#1a1f29', textTransform: 'capitalize' },
});
