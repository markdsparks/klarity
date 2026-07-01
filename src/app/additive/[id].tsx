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
import { useProfile } from '@/hooks/use-profile';
import { resolveVerdict } from '@/services/verdict';
import type { EvidenceTier, VerdictKey } from '@/types/index';
import { TIER_LABEL } from '@/types/index';

const VERDICT_CONFIG: Record<VerdictKey, {
  heroBg: string; heroFg: string; pillBg: string; pillFg: string;
  label: string; blurb: string;
}> = {
  everyday: {
    heroBg: 'rgba(127,211,170,0.16)', heroFg: '#7fd3aa',
    pillBg: '#e8f7ef', pillFg: '#1f9d6b',
    label: 'Everyday', blurb: 'No concern at typical intake',
  },
  sometimes: {
    heroBg: 'rgba(240,184,117,0.16)', heroFg: '#f0b875',
    pillBg: '#fdf3e3', pillFg: '#c8821a',
    label: 'Sometimes', blurb: 'Real evidence — frequency matters',
  },
  contested: {
    heroBg: 'rgba(176,158,232,0.16)', heroFg: '#b09ee8',
    pillBg: '#efecfb', pillFg: '#6b5bd2',
    label: 'Contested', blurb: 'Credible authorities genuinely disagree',
  },
};

const TIER_COLOUR: Record<EvidenceTier, { bg: string; fg: string }> = {
  A: { bg: '#e8f7ef', fg: '#1f9d6b' },
  B: { bg: '#e8f0fe', fg: '#3d6bcc' },
  C: { bg: '#fdf3e3', fg: '#c8821a' },
  D: { bg: '#f1f4f8', fg: '#8896a7' },
};

const VALUES_LEAN_LABEL: Record<string, string> = {
  precaution: 'precaution lean',
  risk: 'risk-tolerant lean',
};

export default function AdditiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const additive = id ? ADDITIVES[id] : undefined;

  if (!additive) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        <Text style={styles.notFoundText}>Additive not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.notFoundLink}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  const result = resolveVerdict(additive, profile);
  // Contested verdicts may resolve to the user's lean — but the disagreement
  // stays visible, and the full evidence trail below never changes
  const resolvedContested = result.verdict !== additive.baseVerdict;
  const vc = VERDICT_CONFIG[result.verdict];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 48 }]}
      showsVerticalScrollIndicator={false}>

      {/* Back */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Back to product</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.name}>{additive.name}</Text>
          {additive.eNumber ? (
            <View style={styles.eNumBadge}>
              <Text style={styles.eNumText}>{additive.eNumber}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.role}>{additive.role}</Text>
      </View>

      {/* Verdict banner */}
      <View style={[styles.verdictBanner, { backgroundColor: vc.heroBg }]}>
        <View style={styles.verdictPillRow}>
          <View style={[styles.verdictPill, { backgroundColor: vc.pillBg }]}>
            <Text style={[styles.verdictPillText, { color: vc.pillFg }]}>{vc.label}</Text>
          </View>
          {resolvedContested && (
            <View style={styles.contestedTag}>
              <Text style={styles.contestedTagText}>Contested</Text>
            </View>
          )}
        </View>
        <Text style={[styles.verdictBlurb, { color: vc.heroFg }]}>
          {resolvedContested
            ? `Regulators genuinely disagree — shown as ${vc.label.toLowerCase()} to match your ${VALUES_LEAN_LABEL[profile.values] ?? profile.values}. Both sides below.`
            : vc.blurb}
        </Text>
      </View>

      {/* Subgroup note for the active profile's conditions */}
      {result.profileNote && (
        <View style={[styles.card, styles.forYouCard]}>
          <Text style={[styles.cardLabel, styles.forYouLabel]}>For you</Text>
          <Text style={styles.forYouText}>{result.profileNote}</Text>
        </View>
      )}

      {/* Summary */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Summary</Text>
        <Text style={styles.headline}>{additive.headline}</Text>
      </View>

      {/* Exposure */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Exposure context</Text>
        <View style={styles.exposureGrid}>
          <ExposureRow label="Typical use" value={additive.exposure.typical} />
          {additive.exposure.concerning !== 'None at food levels' && (
            <ExposureRow label="Concerning at" value={additive.exposure.concerning} />
          )}
        </View>
        <Text style={styles.exposureNote}>{additive.exposure.note}</Text>
      </View>

      {/* Evidence trail */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Evidence trail</Text>
        {additive.evidence.map((item, i) => {
          const tc = TIER_COLOUR[item.tier];
          const dismissed = item.applies === false;
          const split     = item.applies === 'split';
          return (
            <View key={i} style={[styles.evidenceItem, i > 0 && styles.evidenceBorder, dismissed && styles.evidenceDimmed]}>
              <View style={styles.evidenceMeta}>
                <View style={[styles.tierBadge, { backgroundColor: tc.bg }]}>
                  <Text style={[styles.tierText, { color: tc.fg }]}>Tier {item.tier}</Text>
                </View>
                {dismissed && <Text style={styles.tagDismissed}>DISMISSED</Text>}
                {split     && <Text style={styles.tagSplit}>SPLIT</Text>}
              </View>
              <Text style={[styles.evidenceClaim, dismissed && styles.strikethrough]}>
                {item.claim}
              </Text>
              <Text style={styles.evidenceWhy}>{item.why}</Text>
              <Text style={styles.tierMeta}>{TIER_LABEL[item.tier]}</Text>
            </View>
          );
        })}
      </View>

      {/* Open question */}
      {additive.openQuestion && (
        <View style={[styles.card, styles.openCard]}>
          <Text style={styles.cardLabel}>Open question</Text>
          <Text style={styles.openText}>{additive.openQuestion.text}</Text>
        </View>
      )}

      {/* Contested guidance */}
      {additive.contestedGuidance && (
        <View style={[styles.card, styles.guidanceCard]}>
          <Text style={styles.cardLabel}>Practical take</Text>
          <Text style={styles.guidanceText}>{additive.contestedGuidance}</Text>
        </View>
      )}

      {/* Meta chips */}
      <View style={styles.chipRow}>
        <MetaChip label="Benefit"       value={additive.benefit}      />
        <MetaChip label="Avoidability"  value={additive.avoidability} />
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ExposureRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.exposureRow}>
      <Text style={styles.exposureLabel}>{label}</Text>
      <Text style={styles.exposureValue}>{value}</Text>
    </View>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: '#f6f8fa' },
  content: { paddingHorizontal: 16, gap: 12 },
  fill:    { flex: 1, backgroundColor: '#f6f8fa', justifyContent: 'center', alignItems: 'center', gap: 10 },

  notFoundText: { fontSize: 16, color: '#5b6675' },
  notFoundLink: { fontSize: 14, color: '#1f9d6b', fontWeight: '600' },

  backBtn:     { alignSelf: 'flex-start', paddingVertical: 4 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#8896a7' },

  header:        { gap: 5 },
  headerTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name:          { fontSize: 26, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.5, flex: 1 },
  eNumBadge:     { backgroundColor: '#f1f4f8', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  eNumText:      { fontSize: 12, fontWeight: '700', color: '#5b6675', letterSpacing: 0.2 },
  role:          { fontSize: 13.5, color: '#8896a7', lineHeight: 19 },

  verdictBanner: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  verdictPillRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verdictPill:     { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6 },
  verdictPillText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.1 },
  contestedTag: {
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#6b5bd2',
  },
  contestedTagText: { fontSize: 11, fontWeight: '800', color: '#6b5bd2', letterSpacing: 0.2 },

  forYouCard:  { borderColor: '#c3e6d5', backgroundColor: '#f0faf5' },
  forYouLabel: { color: '#1f9d6b' },
  forYouText:  { fontSize: 14, color: '#1a1f29', lineHeight: 21 },
  verdictBlurb:    { fontSize: 14, fontWeight: '500', lineHeight: 20, opacity: 0.9 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ebf0',
    gap: 10,
  },
  cardLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: '#9fadbf' },

  headline: { fontSize: 15, color: '#1a1f29', lineHeight: 23 },

  exposureGrid: { gap: 8 },
  exposureRow:  { flexDirection: 'row', gap: 10 },
  exposureLabel:{ fontSize: 12, fontWeight: '700', color: '#1a1f29', width: 96 },
  exposureValue:{ fontSize: 12, color: '#5b6675', flex: 1, lineHeight: 17 },
  exposureNote: { fontSize: 12.5, color: '#8896a7', lineHeight: 18, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: '#f1f4f8', paddingTop: 8 },

  evidenceItem:  { gap: 5, paddingTop: 12 },
  evidenceBorder:{ borderTopWidth: 1, borderTopColor: '#f1f4f8' },
  evidenceDimmed:{ opacity: 0.45 },
  evidenceMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierBadge:     { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  tierText:      { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  tagDismissed:  { fontSize: 10, fontWeight: '800', color: '#cf4b4b', letterSpacing: 0.4 },
  tagSplit:      { fontSize: 10, fontWeight: '800', color: '#6b5bd2', letterSpacing: 0.4 },
  evidenceClaim: { fontSize: 14, fontWeight: '600', color: '#1a1f29', lineHeight: 20 },
  strikethrough: { textDecorationLine: 'line-through' },
  evidenceWhy:   { fontSize: 12.5, color: '#5b6675', lineHeight: 18 },
  tierMeta:      { fontSize: 11, color: '#b0bcc9', fontStyle: 'italic' },

  openCard:    { borderColor: '#dce4f0', backgroundColor: '#f8fafc' },
  openText:    { fontSize: 14, color: '#1a1f29', lineHeight: 21, fontStyle: 'italic' },

  guidanceCard:   { borderColor: '#c3e6d5', backgroundColor: '#f0faf5' },
  guidanceText:   { fontSize: 14, color: '#1a1f29', lineHeight: 21 },

  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e7ebf0',
    gap: 4,
  },
  chipLabel: { fontSize: 10, fontWeight: '800', color: '#9fadbf', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipValue: { fontSize: 14, fontWeight: '600', color: '#1a1f29', textTransform: 'capitalize' },
});
