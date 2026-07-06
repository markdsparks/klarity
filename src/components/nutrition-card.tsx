import { Pressable, StyleSheet, Text, View } from 'react-native';

import { explainerForLine, getExplainer, type NutritionExplainer } from '@/data/nutrition-explainers';
import { nutritionToneToLadderLevel } from '@/data/verdict-ladder';
import type { VerdictExplainerInput } from '@/components/verdict-explainer-sheet';
import { sugarBasisDv, type NutritionAssessment, type ServingNutrients } from '@/services/nutrition';
import type { AskContext } from '@/services/qa/ask';
import type { NutritionTone } from '@/types/index';

// Spec 016 — the nutrition card.
// M1 (2026-07-05): extracted from [barcode].tsx into one shared component,
// restaurant.tsx ported onto it, closing the cross-screen drift the audit found.
// M2 (2026-07-05, this pass) — the actual declutter, per the audit's findings:
//   - dropped the tone pill's text (duplicated the hero chip above it) for a
//     peripheral 3px accent border + a plain chevron; the WORD lives in one
//     place now, the color still gives a glance-able cue here.
//   - every annotation (context line, profile note, personalization footnote)
//     now renders through ONE row style and is individually tappable into
//     ExplainerSheet — not hidden, just no longer three different visual
//     languages for the same kind of thing. See nutrition-explainers.ts for
//     the 5 new entries this needed (protein-quality/goal/condition lines
//     that rendered as dead text before this pass).
//   - provenance (USDA/"Computed") demoted from a colored pill to plain
//     muted meta text — it's data provenance, not a judgment, and
//     shouldn't share pill+color language with tone signals.

const TONE_ACCENT: Record<NutritionTone, string> = {
  good: '#1f9d6b',
  ok: '#c8821a',
  warn: '#c2410c',
};

const BADGE_LABEL = { usda: 'USDA', computed: 'Computed' } as const;

export interface NutritionCardProps {
  nutrition: NutritionAssessment;
  sn: ServingNutrients;
  thresholds: { sugar: number; sodium: number; satFat: number };
  bloodSugar: boolean;
  personalizedRef: boolean;
  askContext: AskContext;
  servingText?: string | null;
  badge?: keyof typeof BADGE_LABEL;
  basisNotes?: string[];
  onOpenLadder: (input: VerdictExplainerInput) => void;
  onOpenExplainer: (explainer: NutritionExplainer) => void;
}

interface Annotation {
  key: string;
  text: string;
  explainer: NutritionExplainer | null;
}

export function NutritionCard({
  nutrition, sn, thresholds, bloodSugar, personalizedRef, askContext,
  servingText, badge, basisNotes, onOpenLadder, onOpenExplainer,
}: NutritionCardProps) {
  const sugarHot = sugarBasisDv(sn) >= thresholds.sugar;

  // One meta line instead of a colored badge — provenance is metadata, not
  // judgment, so it reads as plain small text next to the serving caption.
  const metaCaption = [servingText, badge ? BADGE_LABEL[badge] : null].filter(Boolean).join(' · ');

  // Profile notes lead — the most personally-tailored line, most likely to be
  // what the user actually wants explained — followed by the rest of the
  // context lines in the order the nutrition service already builds them,
  // then the personalization footnote last (a methodology note, not a
  // decision driver). Ordering is presentation only: nothing here is hidden.
  const annotations: Annotation[] = [
    ...nutrition.profileNotes.map(note => ({ key: note, text: note, explainer: explainerForLine(note) })),
    ...nutrition.contextLines.map(line => ({ key: line, text: line, explainer: explainerForLine(line) })),
    ...(personalizedRef ? [{
      key: 'personalized_reference',
      text: 'Fiber & protein %DV use your reference intake (sex/age), not the generic label value.',
      explainer: getExplainer('personalized_reference'),
    }] : []),
  ];

  return (
    <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: TONE_ACCENT[nutrition.tone] }]}>
      <Pressable
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
        onPress={() => onOpenLadder({
          axis: 'nutrition',
          level: nutritionToneToLadderLevel(nutrition.tone),
          productContext: nutrition.summary,
          askContext,
        })}>
        <Text style={styles.cardTitle}>Nutrition</Text>
        <Text style={styles.cardChevron}>›</Text>
      </Pressable>
      {metaCaption ? <Text style={styles.metaCaption}>{metaCaption}</Text> : null}
      <Text style={styles.nutritionSummary}>{nutrition.summary}</Text>
      {annotations.map((a, i) => (
        <Pressable
          key={a.key}
          style={styles.annotationRow}
          disabled={!a.explainer}
          onPress={a.explainer ? () => onOpenExplainer(a.explainer!) : undefined}>
          <Text style={[styles.annotationText, i === 0 && styles.annotationTextPrimary]}>{a.text}</Text>
          {a.explainer ? <Text style={styles.annotationChevron}>›</Text> : null}
        </Pressable>
      ))}
      <NutrientRow label="Calories"      value={sn.calories} unit="kcal" />
      <NutrientRow label="Total Fat"     value={sn.totalFat} unit="g" dvPct={sn.fatDv}    />
      <NutrientRow label="Saturated Fat" value={sn.satFat}   unit="g" dvPct={sn.satFatDv} highlight={sn.satFatDv != null && sn.satFatDv >= thresholds.satFat ? 'warn' : null} sub />
      <NutrientRow label="Trans Fat"     value={sn.transFat} unit="g" highlight={sn.transFat != null && sn.transFat >= 0.5 ? 'warn' : null} sub />
      <NutrientRow label="Total Carbs"   value={sn.carbs}    unit="g" dvPct={sn.carbsDv}  />
      <NutrientRow label="Sugar"         value={sn.sugar}    unit="g" dvPct={sn.sugarDv}  highlight={sn.addedSugar == null && sugarHot ? 'warn' : null} sub />
      {sn.addedSugar != null && (
        <NutrientRow label="of which added" value={sn.addedSugar} unit="g" dvPct={sn.addedSugarDv} highlight={sugarHot ? 'warn' : null} sub />
      )}
      <NutrientRow label={personalizedRef ? 'Fiber *' : 'Fiber'} value={sn.fiber} unit="g" dvPct={sn.fiberDv} highlight={sn.fiberDv != null && sn.fiberDv >= 10 ? 'good' : null} sub />
      {sn.carbs != null && sn.fiber != null && (
        <NutrientRow
          label="Net carbs"
          value={sn.carbs - sn.fiber}
          unit="g"
          sub
          computed={!bloodSugar}
          highlight={bloodSugar ? 'warn' : null}
        />
      )}
      <NutrientRow label={personalizedRef ? 'Protein *' : 'Protein'} value={sn.protein} unit="g" dvPct={sn.proteinDv} highlight={sn.proteinDv != null && sn.proteinDv >= 10 ? 'good' : null} />
      <NutrientRow label="Sodium"        value={sn.sodium != null ? Math.round(sn.sodium * 1000) : undefined} unit="mg" dvPct={sn.sodiumDv}  highlight={sn.sodiumDv != null && sn.sodiumDv >= thresholds.sodium ? 'warn' : null} />
      <NutrientRow label="Potassium"     value={sn.potassium} unit="g" dvPct={sn.potassiumDv} highlight={sn.potassiumDv != null && sn.potassiumDv >= 10 ? 'good' : null} sub />
      {basisNotes?.map(note => (
        <Text key={note} style={styles.basisNote}>{note}</Text>
      ))}
    </View>
  );
}

function NutrientRow({ label, value, unit, dvPct, highlight, sub, computed }: {
  label: string; value?: number; unit: string;
  dvPct?: number; highlight?: 'warn' | 'good' | null; sub?: boolean; computed?: boolean;
}) {
  if (value == null) return null;
  const valueColor = computed    ? '#9fadbf'
    : highlight === 'warn'       ? '#c8821a'
    : highlight === 'good'       ? '#1f9d6b'
    : '#1a1f29';
  const dvColor = highlight != null ? valueColor : '#b0bcc9';
  return (
    <View style={[styles.nutrientRow, sub && styles.nutrientSubRow]}>
      <Text style={[styles.nutrientLabel, sub && styles.nutrientSubLabel, computed && styles.nutrientComputedLabel]}>
        {label}
      </Text>
      <View style={styles.nutrientRight}>
        <Text style={[styles.nutrientValue, sub && styles.nutrientSubValue, { color: valueColor }]}>
          {unit === 'kcal' || unit === 'mg' ? Math.round(value) : value.toFixed(1)} {unit}
        </Text>
        {dvPct != null && (
          <Text style={[styles.nutrientDv, { color: dvColor }]}>{dvPct}% DV</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ebf0',
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: '#8896a7' },
  cardChevron: { fontSize: 16, color: '#c7cfd9' },
  metaCaption: { fontSize: 12, color: '#b0bcc9', marginBottom: 6 },

  pressed: { opacity: 0.6 },
  nutritionSummary: { fontSize: 13, color: '#5b6675', lineHeight: 19, marginBottom: 6 },

  // One shared treatment for every annotation (context line, profile note,
  // personalization footnote) — replaces three previously-distinct styles
  // (bulleted lines, a bordered "FOR YOU" banner, a small-print footnote).
  annotationRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingVertical: 6,
  },
  annotationText: { flex: 1, fontSize: 12.5, color: '#6b7787', lineHeight: 18 },
  annotationTextPrimary: { color: '#3c4654', fontWeight: '600' },
  annotationChevron: { fontSize: 15, color: '#c7cfd9', lineHeight: 18 },
  basisNote: { fontSize: 12, color: '#8a94a3', marginTop: 10, lineHeight: 17 },

  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f4f8',
  },
  nutrientLabel:    { fontSize: 13.5, color: '#5b6675' },
  nutrientSubRow:      { paddingLeft: 16 },
  nutrientSubLabel:    { fontSize: 12.5, color: '#9fadbf' },
  nutrientSubValue:    { fontSize: 12.5, fontWeight: '500' },
  nutrientComputedLabel: { fontStyle: 'italic' },
  nutrientRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nutrientValue: { fontSize: 13.5, fontWeight: '700' },
  nutrientDv:    { fontSize: 11, fontWeight: '700', opacity: 0.85 },
});
