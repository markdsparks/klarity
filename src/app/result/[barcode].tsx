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
import type { OFFProduct } from '@/types/off';
import type { Additive, NutritionTone, VerdictKey } from '@/types/index';

// ── Verdict colour mapping ─────────────────────────────────────────────────────
const VERDICT_STYLE: Record<VerdictKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday' },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes' },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested' },
};

const NUTRITION_TONE_COLOUR: Record<NutritionTone, string> = {
  good: '#1f9d6b',
  ok:   '#c8821a',
  warn: '#c8821a',
};

// ── Simple nutrition toning ────────────────────────────────────────────────────
function toneNutrition(p: OFFProduct): { tone: NutritionTone; summary: string } {
  const n = p.nutriments ?? {};
  const sugar = n['sugars_100g'] ?? 0;
  const sodium = n['sodium_100g'] ?? 0;
  const satFat = n['saturated-fat_100g'] ?? 0;

  if (sugar > 20 || sodium > 0.8 || satFat > 10) {
    return { tone: 'warn', summary: 'High in ' + [
      sugar > 20 ? 'sugar' : null,
      sodium > 0.8 ? 'sodium' : null,
      satFat > 10 ? 'saturated fat' : null,
    ].filter(Boolean).join(', ') + '.' };
  }
  if (sugar > 10 || sodium > 0.4 || satFat > 5) {
    return { tone: 'ok', summary: 'Moderate levels — frequency matters.' };
  }
  return { tone: 'good', summary: 'Clean nutrition profile at typical serving.' };
}

// ── Component ──────────────────────────────────────────────────────────────────
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'ready'; product: OFFProduct; additiveIds: string[] };

export default function ResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!barcode) return;
    fetchProduct(barcode)
      .then(product => {
        if (!product) return setState({ status: 'not_found' });
        const additiveIds = matchByETags(product.additives_tags ?? []);
        setState({ status: 'ready', product, additiveIds });
      })
      .catch((err: Error) => {
        setState({
          status: 'error',
          message: err.message === 'NETWORK'
            ? 'No internet connection.'
            : 'Could not load product. Try again.',
        });
      });
  }, [barcode]);

  // ── Loading ──
  if (state.status === 'loading') {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#1f9d6b" />
        <Text style={styles.loadingText}>Looking up product…</Text>
      </View>
    );
  }

  // ── Error / not found ──
  if (state.status === 'error' || state.status === 'not_found') {
    return (
      <View style={[styles.centerFill, { paddingTop: insets.top }]}>
        <Text style={styles.errorEmoji}>{state.status === 'not_found' ? '🔍' : '⚠️'}</Text>
        <Text style={styles.errorTitle}>
          {state.status === 'not_found' ? 'Product not found' : 'Something went wrong'}
        </Text>
        <Text style={styles.errorBody}>
          {state.status === 'not_found'
            ? 'This product isn\'t in our database yet.'
            : (state as { status: 'error'; message: string }).message}
        </Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Scan again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Ready ──
  const { product, additiveIds } = state;
  const name = product.product_name || 'Unknown product';
  const brand = product.brands?.split(',')[0].trim() || '';
  const nutrition = toneNutrition(product);
  const matchedAdditives: Additive[] = additiveIds
    .map(id => ADDITIVES[id])
    .filter((a): a is Additive => !!a);
  const unknownCount = (product.additives_tags?.length ?? 0) - additiveIds.length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}>

      {/* Back */}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← Scan again</Text>
      </Pressable>

      {/* Product header */}
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{name}</Text>
        {brand ? <Text style={styles.productBrand}>{brand}</Text> : null}
        {product.serving_size
          ? <Text style={styles.productServing}>per {product.serving_size}</Text>
          : null}
      </View>

      {/* Nutrition card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Nutrition</Text>
          <View style={[styles.tonePill, { backgroundColor: nutrition.tone === 'good' ? '#e8f7ef' : '#fdf3e3' }]}>
            <View style={[styles.toneDot, { backgroundColor: NUTRITION_TONE_COLOUR[nutrition.tone] }]} />
            <Text style={[styles.tonePillText, { color: NUTRITION_TONE_COLOUR[nutrition.tone] }]}>
              {nutrition.tone === 'good' ? 'Good' : 'Watch'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardBody}>{nutrition.summary}</Text>
        <NutrientRow label="Calories" value={product.nutriments?.['energy-kcal_100g']} unit="kcal" />
        <NutrientRow label="Sugar" value={product.nutriments?.sugars_100g} unit="g" warnAbove={10} />
        <NutrientRow label="Sat fat" value={product.nutriments?.['saturated-fat_100g']} unit="g" warnAbove={5} />
        <NutrientRow label="Sodium" value={product.nutriments?.sodium_100g} unit="g" warnAbove={0.4} />
        <NutrientRow label="Protein" value={product.nutriments?.proteins_100g} unit="g" />
        <NutrientRow label="Fiber" value={product.nutriments?.fiber_100g} unit="g" />
      </View>

      {/* Additives card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Additives</Text>

        {matchedAdditives.length === 0 && unknownCount === 0 && (
          <Text style={styles.cardBody}>No additives detected in this product.</Text>
        )}

        {matchedAdditives.map(additive => (
          <AdditiveRow key={additive.id} additive={additive} />
        ))}

        {unknownCount > 0 && (
          <View style={styles.unknownRow}>
            <Text style={styles.unknownText}>
              +{unknownCount} additive{unknownCount > 1 ? 's' : ''} not yet in our database
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function NutrientRow({ label, value, unit, warnAbove }: {
  label: string;
  value?: number;
  unit: string;
  warnAbove?: number;
}) {
  if (value == null) return null;
  const isWarn = warnAbove != null && value > warnAbove;
  return (
    <View style={styles.nutrientRow}>
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={[styles.nutrientValue, isWarn && styles.nutrientWarn]}>
        {value.toFixed(1)} {unit}
      </Text>
    </View>
  );
}

function AdditiveRow({ additive }: { additive: Additive }) {
  const vs = VERDICT_STYLE[additive.baseVerdict];
  return (
    <Pressable
      style={styles.additiveRow}
      onPress={() => router.push(`/additive/${additive.id}`)}>
      <View style={styles.additiveLeft}>
        <Text style={styles.additiveName}>{additive.name}</Text>
        {additive.eNumber
          ? <Text style={styles.additiveRole}>{additive.eNumber} · {additive.role}</Text>
          : <Text style={styles.additiveRole}>{additive.role}</Text>}
      </View>
      <View style={[styles.verdictPill, { backgroundColor: vs.bg }]}>
        <View style={[styles.verdictDot, { backgroundColor: vs.fg }]} />
        <Text style={[styles.verdictLabel, { color: vs.fg }]}>{vs.label}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f6f8fa' },
  content: { paddingHorizontal: 16, gap: 12 },

  centerFill: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingText: { color: '#5b6675', fontSize: 14 },
  errorEmoji: { fontSize: 40, marginBottom: 4 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f29' },
  errorBody: { fontSize: 14, color: '#5b6675', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#1a1f29',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  backBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#5b6675' },

  productHeader: { paddingHorizontal: 4, paddingVertical: 8, gap: 3 },
  productName: { fontSize: 22, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.4 },
  productBrand: { fontSize: 14, color: '#5b6675' },
  productServing: { fontSize: 12, color: '#9fadbf' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e7ebf0',
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: '#8896a7' },
  cardBody: { fontSize: 14, color: '#5b6675', lineHeight: 20 },

  tonePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  toneDot: { width: 7, height: 7, borderRadius: 4 },
  tonePillText: { fontSize: 12, fontWeight: '700' },

  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderTopWidth: 1, borderColor: '#f1f4f8' },
  nutrientLabel: { fontSize: 13, color: '#5b6675' },
  nutrientValue: { fontSize: 13, fontWeight: '600', color: '#1a1f29' },
  nutrientWarn: { color: '#c8821a' },

  additiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderColor: '#f1f4f8' },
  additiveLeft: { flex: 1, gap: 2 },
  additiveName: { fontSize: 14, fontWeight: '700', color: '#1a1f29' },
  additiveRole: { fontSize: 11.5, color: '#8896a7' },
  verdictPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  verdictDot: { width: 7, height: 7, borderRadius: 4 },
  verdictLabel: { fontSize: 11, fontWeight: '700' },
  chevron: { color: '#c8d0da', fontSize: 18, fontWeight: '300' },

  unknownRow: { paddingVertical: 8, borderTopWidth: 1, borderColor: '#f1f4f8' },
  unknownText: { fontSize: 12, color: '#9fadbf', fontStyle: 'italic' },
});
