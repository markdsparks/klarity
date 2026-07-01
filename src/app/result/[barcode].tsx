import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matchByETags } from '@/data/additive-index';
import { ADDITIVES } from '@/data/additives';
import { fetchProduct } from '@/services/off';
import { fetchUSDANutrition } from '@/services/usda';
import type { OFFProduct } from '@/types/off';
import type { USDANutrition } from '@/types/usda';
import type { Additive, NutritionTone, UnknownAdditive, VerdictKey } from '@/types/index';

// ── Glance badge colours (hero dark section) ───────────────────────────────────
type GlanceKey = VerdictKey | 'clean' | 'unrated';

const GLANCE: Record<GlanceKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'Everyday'    },
  sometimes: { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Sometimes'   },
  contested: { bg: 'rgba(176,158,232,0.16)', fg: '#b09ee8', label: 'Contested'   },
  clean:     { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'No additives'},
  unrated:   { bg: 'rgba(159,173,191,0.12)', fg: '#9fadbf', label: 'Not rated'   },
};

const NUTRITION_GLANCE: Record<NutritionTone, { bg: string; fg: string; label: string }> = {
  good: { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'Good'     },
  ok:   { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Moderate' },
  warn: { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Watch'    },
};

// Verdict pill colours (light card section)
const VERDICT_STYLE: Record<VerdictKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday'  },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes' },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested' },
};

// ── FDA 2020 Daily Values (per serving reference) ─────────────────────────────
const FDA_DV = { sugar: 50, satFat: 20, sodium: 2.3, fiber: 28, protein: 50 };

type ServingNutrients = {
  source: 'usda' | 'off';
  factor: number;
  calories?: number;
  sugar?: number;   sugarDv?: number;
  satFat?: number;  satFatDv?: number;
  sodium?: number;  sodiumDv?: number;
  protein?: number; proteinDv?: number;
  fiber?: number;   fiberDv?: number;
};

function computeServingNutrients(p: OFFProduct, usda: USDANutrition | null): ServingNutrients {
  const dv = (val: number | undefined, ref: number): number | undefined =>
    val != null ? Math.round(val / ref * 100) : undefined;

  // USDA data is already per-serving (manufacturer-submitted label values)
  if (usda) {
    return {
      source: 'usda',
      factor: 1,
      calories: usda.calories,
      sugar:    usda.sugar,        sugarDv:   dv(usda.sugar,        FDA_DV.sugar),
      satFat:   usda.saturatedFat, satFatDv:  dv(usda.saturatedFat, FDA_DV.satFat),
      sodium:   usda.sodium,       sodiumDv:  dv(usda.sodium,       FDA_DV.sodium),
      protein:  usda.protein,      proteinDv: dv(usda.protein,      FDA_DV.protein),
      fiber:    usda.fiber,        fiberDv:   dv(usda.fiber,        FDA_DV.fiber),
    };
  }

  // Fall back to OFF per-100g values scaled to serving size
  const n = p.nutriments ?? {};
  const factor = p.serving_quantity ? p.serving_quantity / 100 : 1;
  const scale = (val: number | undefined) => val != null ? val * factor : undefined;

  const calories = scale(n['energy-kcal_100g']);
  const sugar    = scale(n.sugars_100g);
  const satFat   = scale(n['saturated-fat_100g']);
  const sodium   = scale(n.sodium_100g);
  const protein  = scale(n.proteins_100g);
  const fiber    = scale(n.fiber_100g);

  return {
    source: 'off',
    factor,
    calories,
    sugar,   sugarDv:   dv(sugar,   FDA_DV.sugar),
    satFat,  satFatDv:  dv(satFat,  FDA_DV.satFat),
    sodium,  sodiumDv:  dv(sodium,  FDA_DV.sodium),
    protein, proteinDv: dv(protein, FDA_DV.protein),
    fiber,   fiberDv:   dv(fiber,   FDA_DV.fiber),
  };
}

function toneNutrition(sn: ServingNutrients): { tone: NutritionTone; summary: string } {
  const { sugarDv = 0, sodiumDv = 0, satFatDv = 0 } = sn;

  const highItems: string[] = [];
  if (sugarDv  >= 20) highItems.push(`sugar (${sugarDv}% DV)`);
  if (sodiumDv >= 20) highItems.push(`sodium (${sodiumDv}% DV)`);
  if (satFatDv >= 20) highItems.push(`sat fat (${satFatDv}% DV)`);
  if (highItems.length > 0) return { tone: 'warn', summary: `High in ${highItems.join(' and ')}` };

  const modItems: string[] = [];
  if (sugarDv  >= 10) modItems.push('sugar');
  if (sodiumDv >= 10) modItems.push('sodium');
  if (satFatDv >= 10) modItems.push('sat fat');
  if (modItems.length > 0) return { tone: 'ok', summary: `Moderate ${modItems.join(', ')} — frequency matters` };

  return { tone: 'good', summary: 'Clean nutrition per serving' };
}

function overallAdditiveGlance(matched: Additive[], unknownCount: number): GlanceKey {
  if (matched.length === 0 && unknownCount === 0) return 'clean';
  if (matched.length === 0) return 'unrated';
  if (matched.some(a => a.baseVerdict === 'contested')) return 'contested';
  if (matched.some(a => a.baseVerdict === 'sometimes')) return 'sometimes';
  return 'everyday';
}

// ── State type ─────────────────────────────────────────────────────────────────
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'ready'; product: OFFProduct; additiveIds: string[]; unknownAdditives: UnknownAdditive[]; usdaNutrition: USDANutrition | null };

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function ResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!barcode) return;
    Promise.all([fetchProduct(barcode), fetchUSDANutrition(barcode)])
      .then(([product, usdaNutrition]) => {
        if (!product) return setState({ status: 'not_found' });
        const { matched: additiveIds, unknown: unknownAdditives } =
          matchByETags(product.additives_tags ?? []);
        setState({ status: 'ready', product, additiveIds, unknownAdditives, usdaNutrition });
      })
      .catch((err: Error) => setState({
        status: 'error',
        message: err.message === 'NETWORK' ? 'No internet connection.' : 'Could not load product.',
      }));
  }, [barcode]);

  // ── Loading ──
  if (state.status === 'loading') {
    return (
      <View style={[styles.fill, styles.heroBg, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#7fd3aa" />
        <Text style={styles.loadingText}>Looking up product…</Text>
      </View>
    );
  }

  // ── Error / not found ──
  if (state.status !== 'ready') {
    const isNotFound = state.status === 'not_found';
    return (
      <View style={[styles.fill, styles.heroBg, { paddingTop: insets.top }]}>
        <Text style={styles.errorEmoji}>{isNotFound ? '🔍' : '⚠️'}</Text>
        <Text style={styles.errorTitle}>
          {isNotFound ? 'Product not found' : 'Something went wrong'}
        </Text>
        <Text style={styles.errorBody}>
          {isNotFound
            ? "This barcode isn't in Open Food Facts yet."
            : (state as { status: 'error'; message: string }).message}
        </Text>
        <Pressable style={styles.errorBtn} onPress={() => router.back()}>
          <Text style={styles.errorBtnText}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── Ready ──
  const { product, additiveIds, unknownAdditives, usdaNutrition } = state;
  const name     = product.product_name || 'Unknown product';
  const brand    = product.brands?.split(',')[0].trim() || '';
  const imageUrl = product.image_front_url ?? product.image_url;
  const sn = computeServingNutrients(product, usdaNutrition);
  const nutrition = toneNutrition(sn);
  const matchedAdditives = additiveIds
    .map(id => ADDITIVES[id])
    .filter((a): a is Additive => !!a);
  const glanceKey       = overallAdditiveGlance(matchedAdditives, unknownAdditives.length);
  const additiveGlance  = GLANCE[glanceKey];
  const nutritionGlance = NUTRITION_GLANCE[nutrition.tone];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      showsVerticalScrollIndicator={false}>

      {/* ── Dark hero ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>

        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        <View style={styles.productRow}>
          <View style={styles.productMeta}>
            {brand ? <Text style={styles.productBrand}>{brand}</Text> : null}
            <Text style={styles.productName} numberOfLines={3}>{name}</Text>
            {product.serving_size
              ? <Text style={styles.productServing}>per {product.serving_size}</Text>
              : null}
          </View>

          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.productImage}
              contentFit="cover"
            />
          ) : null}
        </View>

        {/* At-a-glance badges */}
        <View style={styles.glanceRow}>
          <GlanceBadge
            axis="ADDITIVES"
            verdict={additiveGlance.label}
            bg={additiveGlance.bg}
            fg={additiveGlance.fg}
          />
          <GlanceBadge
            axis="NUTRITION"
            verdict={nutritionGlance.label}
            bg={nutritionGlance.bg}
            fg={nutritionGlance.fg}
          />
        </View>
      </View>

      {/* ── Light content ── */}
      <View style={styles.content}>

        {/* Additives */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Additives</Text>
            {(matchedAdditives.length + unknownAdditives.length) > 0 && (
              <Text style={styles.cardMeta}>
                {matchedAdditives.length + unknownAdditives.length} in product
              </Text>
            )}
          </View>

          {matchedAdditives.length === 0 && unknownAdditives.length === 0 && (
            <Text style={styles.emptyText}>No additives detected.</Text>
          )}

          {matchedAdditives.map((additive, i) => (
            <AdditiveRow key={additive.id} additive={additive} first={i === 0} />
          ))}

          {unknownAdditives.length > 0 && matchedAdditives.length > 0 && (
            <View style={styles.unknownDivider}>
              <View style={styles.unknownDividerLine} />
              <Text style={styles.unknownDividerLabel}>Not yet rated</Text>
              <View style={styles.unknownDividerLine} />
            </View>
          )}

          {unknownAdditives.map((u, i) => (
            <UnknownAdditiveRow
              key={u.eNumber}
              additive={u}
              first={i === 0 && matchedAdditives.length === 0}
            />
          ))}
        </View>

        {/* Nutrition */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Nutrition</Text>
              {sn.source === 'usda' && (
                <View style={styles.usdaBadge}>
                  <Text style={styles.usdaBadgeText}>USDA</Text>
                </View>
              )}
            </View>
            <View style={styles.cardHeaderRight}>
              {(usdaNutrition?.householdServing || product.serving_size) ? (
                <Text style={styles.cardMeta}>
                  per {usdaNutrition?.householdServing?.toLowerCase() ?? product.serving_size}
                </Text>
              ) : null}
              <View style={[styles.toneTag, {
                backgroundColor: nutrition.tone === 'good' ? '#e8f7ef' : '#fdf3e3',
              }]}>
                <Text style={[styles.toneTagText, {
                  color: nutrition.tone === 'good' ? '#1f9d6b' : '#c8821a',
                }]}>
                  {nutritionGlance.label}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.nutritionSummary}>{nutrition.summary}</Text>
          <NutrientRow label="Calories" value={sn.calories}  unit="kcal" />
          <NutrientRow label="Sugar"    value={sn.sugar}     unit="g"  dvPct={sn.sugarDv}   highlight={sn.sugarDv   != null && sn.sugarDv   >= 20 ? 'warn' : null} />
          <NutrientRow label="Sat fat"  value={sn.satFat}    unit="g"  dvPct={sn.satFatDv}  highlight={sn.satFatDv  != null && sn.satFatDv  >= 20 ? 'warn' : null} />
          <NutrientRow label="Sodium"   value={sn.sodium}    unit="g"  dvPct={sn.sodiumDv}  highlight={sn.sodiumDv  != null && sn.sodiumDv  >= 20 ? 'warn' : null} />
          <NutrientRow label="Protein"  value={sn.protein}   unit="g"  dvPct={sn.proteinDv} highlight={sn.proteinDv != null && sn.proteinDv >= 10 ? 'good' : null} />
          <NutrientRow label="Fiber"    value={sn.fiber}     unit="g"  dvPct={sn.fiberDv}   highlight={sn.fiberDv   != null && sn.fiberDv   >= 10 ? 'good' : null} />
        </View>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GlanceBadge({
  axis, verdict, bg, fg,
}: {
  axis: string; verdict: string; bg: string; fg: string;
}) {
  return (
    <View style={[styles.glanceBadge, { backgroundColor: bg }]}>
      <Text style={[styles.glanceAxis, { color: fg }]}>{axis}</Text>
      <Text style={[styles.glanceVerdict, { color: fg }]}>{verdict}</Text>
    </View>
  );
}

function AdditiveRow({ additive, first }: { additive: Additive; first: boolean }) {
  const vs = VERDICT_STYLE[additive.baseVerdict];
  return (
    <Pressable
      style={[styles.additiveRow, first && styles.rowNoBorder]}
      onPress={() => router.push(`/additive/${additive.id}`)}>
      <View style={styles.additiveInfo}>
        <Text style={styles.additiveName}>{additive.name}</Text>
        <Text style={styles.additiveRole} numberOfLines={1}>
          {[additive.eNumber, additive.role].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={[styles.verdictPill, { backgroundColor: vs.bg }]}>
        <Text style={[styles.verdictPillText, { color: vs.fg }]}>{vs.label}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

function UnknownAdditiveRow({ additive, first }: { additive: UnknownAdditive; first: boolean }) {
  return (
    <View style={[styles.additiveRow, first && styles.rowNoBorder]}>
      <View style={styles.additiveInfo}>
        <Text style={styles.unknownAdditiveName}>{additive.name}</Text>
        <Text style={styles.unknownAdditiveRole}>{additive.eNumber}</Text>
      </View>
      <View style={styles.unratedPill}>
        <Text style={styles.unratedPillText}>Not rated</Text>
      </View>
    </View>
  );
}

function NutrientRow({ label, value, unit, dvPct, highlight }: {
  label: string; value?: number; unit: string;
  dvPct?: number; highlight?: 'warn' | 'good' | null;
}) {
  if (value == null) return null;
  const color = highlight === 'warn' ? '#c8821a' : highlight === 'good' ? '#1f9d6b' : '#1a1f29';
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <View style={styles.nutrientRight}>
        <Text style={[styles.nutrientValue, { color }]}>
          {unit === 'kcal' ? Math.round(value) : value.toFixed(1)} {unit}
        </Text>
        {dvPct != null && (
          <Text style={[styles.nutrientDv, { color }]}>{dvPct}% DV</Text>
        )}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: '#f6f8fa' },
  fill:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  heroBg:  { backgroundColor: '#0e1116' },

  // Loading / error
  loadingText:   { color: '#9fadbf', fontSize: 14, marginTop: 10 },
  errorEmoji:    { fontSize: 44 },
  errorTitle:    { fontSize: 19, fontWeight: '700', color: '#fff', textAlign: 'center' },
  errorBody:     { fontSize: 14, color: '#9fadbf', textAlign: 'center', lineHeight: 20 },
  errorBtn:      { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  errorBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Hero
  hero: {
    backgroundColor: '#0e1116',
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn:     { alignSelf: 'flex-start', paddingVertical: 4 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#9fadbf' },

  productRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  productMeta: { flex: 1, gap: 4 },
  productBrand:   { fontSize: 12, fontWeight: '700', color: '#7fd3aa', letterSpacing: 0.5, textTransform: 'uppercase' },
  productName:    { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5, lineHeight: 30 },
  productServing: { fontSize: 12, color: '#9fadbf' },
  productImage:   { width: 72, height: 72, borderRadius: 14, backgroundColor: '#1c2230' },

  glanceRow: { flexDirection: 'row', gap: 10 },
  glanceBadge: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, gap: 3 },
  glanceAxis:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7 },
  glanceVerdict: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },

  // Light content
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

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
  cardMeta:  { fontSize: 12, color: '#b0bcc9' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usdaBadge:     { backgroundColor: '#e8f7ef', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  usdaBadgeText: { fontSize: 9, fontWeight: '800', color: '#1f9d6b', letterSpacing: 0.5 },

  emptyText: { fontSize: 14, color: '#9fadbf', paddingBottom: 4 },

  additiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#f1f4f8',
  },
  rowNoBorder: { borderTopWidth: 0 },
  additiveInfo:  { flex: 1, gap: 3 },
  additiveName:  { fontSize: 14, fontWeight: '700', color: '#1a1f29' },
  additiveRole:  { fontSize: 11.5, color: '#9fadbf' },
  verdictPill:   { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  verdictPillText: { fontSize: 11.5, fontWeight: '800' },
  rowChevron:    { fontSize: 18, color: '#d0d8e4' },
  unknownAdditiveName: { fontSize: 14, fontWeight: '600', color: '#8896a7' },
  unknownAdditiveRole: { fontSize: 11.5, color: '#b0bcc9' },
  unratedPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f1f4f8' },
  unratedPillText: { fontSize: 11.5, fontWeight: '700', color: '#9fadbf' },

  unknownDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
    paddingTop: 8,
  },
  unknownDividerLine: { flex: 1, height: 1, backgroundColor: '#f1f4f8' },
  unknownDividerLabel: { fontSize: 10, fontWeight: '700', color: '#b0bcc9', letterSpacing: 0.6, textTransform: 'uppercase' },

  toneTag:     { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  toneTagText: { fontSize: 11.5, fontWeight: '800' },
  nutritionSummary: { fontSize: 13, color: '#5b6675', lineHeight: 19, marginBottom: 6 },

  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f4f8',
  },
  nutrientLabel: { fontSize: 13.5, color: '#5b6675' },
  nutrientRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nutrientValue: { fontSize: 13.5, fontWeight: '600' },
  nutrientDv:    { fontSize: 11, fontWeight: '700', opacity: 0.85 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
