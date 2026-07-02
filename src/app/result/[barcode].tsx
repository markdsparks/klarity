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
import { matchByIngredientText } from '@/data/ingredient-text-index';
import { ADDITIVES } from '@/data/additives';
import { DEFAULT_PROFILE, useProfile } from '@/hooks/use-profile';
import { fetchProduct } from '@/services/off';
import {
  distinctScanDays,
  frequencyLineEligible,
  saveToHistory,
  setBuySignal,
} from '@/services/history';
import {
  computeServingNutrients,
  isPersonalizedReference,
  referenceValues,
  sugarBasisDv,
  toneNutrition,
  warnThresholds,
} from '@/services/nutrition';
import { fetchUSDANutrition } from '@/services/usda';
import { resolveVerdict } from '@/services/verdict';
import type { BuySignal, ScanHistoryEntry } from '@/types/history';
import type { OFFProduct } from '@/types/off';
import type { USDANutrition } from '@/types/usda';
import type {
  Additive,
  AdditiveResult,
  NutritionTone,
  RegulatoryAdditive,
  UnknownAdditive,
  VerdictKey,
} from '@/types/index';

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

// History stores the base-verdict glance (objective); the on-screen glance uses
// profile-resolved verdicts so the hero badge agrees with the rows below it.
function overallAdditiveGlance(verdicts: VerdictKey[], unknownCount: number): GlanceKey {
  if (verdicts.length === 0 && unknownCount === 0) return 'clean';
  if (verdicts.length === 0) return 'unrated';
  if (verdicts.includes('contested')) return 'contested';
  if (verdicts.includes('sometimes')) return 'sometimes';
  return 'everyday';
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

// ── State type ─────────────────────────────────────────────────────────────────
type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | {
      status: 'ready';
      product: OFFProduct;
      additiveIds: string[];
      regulatoryAdditives: RegulatoryAdditive[];
      unknownAdditives: UnknownAdditive[];
      usdaNutrition: USDANutrition | null;
      historyEntry: ScanHistoryEntry | null;
    };

// ── Screen ─────────────────────────────────────────────────────────────────────
export default function ResultScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!barcode) return;
    let cancelled = false;
    Promise.all([fetchProduct(barcode), fetchUSDANutrition(barcode)])
      .then(async ([product, usdaNutrition]) => {
        if (!product) {
          if (!cancelled) setState({ status: 'not_found' });
          return;
        }
        const { matched: tagMatched, regulatory: regulatoryAdditives, unknown: unknownAdditives } =
          matchByETags(product.additives_tags ?? []);
        // OFF's own additives_tags parsing sometimes misses ingredients (nutrition
        // filled in, ingredient parser never ran) — scan the raw text as a fallback.
        const textMatched = matchByIngredientText(
          product.ingredients_text ?? '', new Set(tagMatched)
        );
        const additiveIds = [...tagMatched, ...textMatched];

        // Paint first — history persistence must never delay the result screen
        if (!cancelled) {
          setState({
            status: 'ready', product, additiveIds, regulatoryAdditives, unknownAdditives,
            usdaNutrition, historyEntry: null,
          });
        }

        // History stores the profile-independent baseline so entries stay
        // objective if the profile changes later. Regulatory-status additives
        // count as "not a rated verdict" alongside unknowns — a bare permitted-
        // status entry carries no dose/frequency judgment to build a glance on.
        const matchedAdditives = additiveIds
          .map(id => ADDITIVES[id])
          .filter((a): a is Additive => !!a);
        const sn = computeServingNutrients(product, usdaNutrition);
        const historyEntry = await saveToHistory({
          barcode,
          productName: product.product_name || 'Unknown product',
          brand: product.brands?.split(',')[0].trim() || '',
          imageUrl: product.image_front_url ?? product.image_url,
          additiveGlance: overallAdditiveGlance(
            matchedAdditives.map(a => a.baseVerdict),
            regulatoryAdditives.length + unknownAdditives.length,
          ),
          nutritionTone: toneNutrition(sn, DEFAULT_PROFILE).tone,
          scannedAt: Date.now(),
        });

        if (!cancelled) {
          setState(s => s.status === 'ready' ? { ...s, historyEntry } : s);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setState({
          status: 'error',
          message: err.message === 'NETWORK' ? 'No internet connection.' : 'Could not load product.',
        });
      });
    return () => { cancelled = true; };
  }, [barcode]);

  function answerBuySignal(signal: BuySignal) {
    if (state.status !== 'ready' || !state.historyEntry || !barcode) return;
    void setBuySignal(barcode, signal);
    setState({ ...state, historyEntry: { ...state.historyEntry, buySignal: signal } });
  }

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
  const { product, additiveIds, regulatoryAdditives, unknownAdditives, usdaNutrition, historyEntry } = state;
  const name     = product.product_name || 'Unknown product';
  const brand    = product.brands?.split(',')[0].trim() || '';
  const imageUrl = product.image_front_url ?? product.image_url;
  const sn = computeServingNutrients(product, usdaNutrition, referenceValues(profile));
  const nutrition = toneNutrition(sn, profile);
  const thresholds = warnThresholds(profile);
  const bloodSugar = profile.conditions.includes('blood_sugar');
  const personalizedRef = isPersonalizedReference(profile);

  const matchedAdditives = additiveIds
    .map(id => ADDITIVES[id])
    .filter((a): a is Additive => !!a);
  // Profile-resolved verdicts; condition matches float to the top for visibility
  const additiveResults: AdditiveResult[] = matchedAdditives
    .map(a => resolveVerdict(a, profile))
    .sort((a, b) => (b.profileNote ? 1 : 0) - (a.profileNote ? 1 : 0));

  const glanceKey       = overallAdditiveGlance(
    additiveResults.map(r => r.verdict), regulatoryAdditives.length + unknownAdditives.length,
  );
  const additiveGlance  = GLANCE[glanceKey];
  const nutritionGlance = NUTRITION_GLANCE[nutrition.tone];

  // Frequency context — eligibility rule lives in the history service
  const amber = glanceKey === 'sometimes' || glanceKey === 'contested' || nutrition.tone === 'warn';
  const showFrequency = historyEntry != null && frequencyLineEligible(historyEntry, amber);
  const scanDays = historyEntry ? distinctScanDays(historyEntry, 14) : 0;
  const frequencyFocus = additiveResults.find(r => r.verdict === 'sometimes')?.additive;

  const sugarHot = sugarBasisDv(sn) >= thresholds.sugar;

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

        {/* Frequency context */}
        {showFrequency && historyEntry && (
          <View style={styles.freqCard}>
            {historyEntry.buySignal === 'regular' ? (
              <Text style={styles.freqText}>
                A regular buy for you — {frequencyFocus
                  ? `for ${frequencyFocus.name.toLowerCase()}, frequency is the whole game.`
                  : 'how often matters more than any single serving.'}
              </Text>
            ) : (
              <>
                <Text style={styles.freqText}>
                  This keeps showing up in your scans — {ordinal(scanDays)} day in two weeks.
                </Text>
                <View style={styles.freqAskRow}>
                  <Text style={styles.freqAskLabel}>Regular buy?</Text>
                  <Pressable style={styles.freqBtn} onPress={() => answerBuySignal('regular')}>
                    <Text style={styles.freqBtnText}>Yes</Text>
                  </Pressable>
                  <Pressable style={styles.freqBtn} onPress={() => answerBuySignal('just_checking')}>
                    <Text style={styles.freqBtnText}>Just checking</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* ── Light content ── */}
      <View style={styles.content}>

        {/* Additives */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Additives</Text>
            {(additiveResults.length + regulatoryAdditives.length + unknownAdditives.length) > 0 && (
              <Text style={styles.cardMeta}>
                {additiveResults.length + regulatoryAdditives.length + unknownAdditives.length} in product
              </Text>
            )}
          </View>

          {additiveResults.length === 0 && regulatoryAdditives.length === 0 && unknownAdditives.length === 0 && (
            <Text style={styles.emptyText}>No additives detected.</Text>
          )}

          {additiveResults.map((result, i) => (
            <AdditiveRow key={result.additive.id} result={result} first={i === 0} />
          ))}

          {regulatoryAdditives.length > 0 && additiveResults.length > 0 && (
            <View style={styles.unknownDivider}>
              <View style={styles.unknownDividerLine} />
              <Text style={styles.unknownDividerLabel}>Regulatory status only</Text>
              <View style={styles.unknownDividerLine} />
            </View>
          )}

          {regulatoryAdditives.map((r, i) => (
            <RegulatoryAdditiveRow
              key={r.eNumber}
              additive={r}
              first={i === 0 && additiveResults.length === 0}
            />
          ))}

          {unknownAdditives.length > 0 && (additiveResults.length > 0 || regulatoryAdditives.length > 0) && (
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
              first={i === 0 && additiveResults.length === 0 && regulatoryAdditives.length === 0}
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
          {nutrition.contextLines.map(line => (
            <View key={line} style={styles.contextRow}>
              <Text style={styles.contextBullet}>·</Text>
              <Text style={styles.contextText}>{line}</Text>
            </View>
          ))}
          {nutrition.profileNotes.map(note => (
            <View key={note} style={styles.profileNoteBanner}>
              <Text style={styles.profileNoteLabel}>FOR YOU</Text>
              <Text style={styles.profileNoteText}>{note}</Text>
            </View>
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
          <NutrientRow label="Sodium"        value={sn.sodium}   unit="g" dvPct={sn.sodiumDv}  highlight={sn.sodiumDv != null && sn.sodiumDv >= thresholds.sodium ? 'warn' : null} />
          <NutrientRow label="Potassium"     value={sn.potassium} unit="g" dvPct={sn.potassiumDv} highlight={sn.potassiumDv != null && sn.potassiumDv >= 10 ? 'good' : null} sub />
          {personalizedRef && (
            <Text style={styles.refFootnote}>
              * Fiber &amp; protein %DV use your reference intake (sex/age), not the generic label value.
            </Text>
          )}
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

function AdditiveRow({ result, first }: { result: AdditiveResult; first: boolean }) {
  const { additive, verdict, profileNote } = result;
  const vs = VERDICT_STYLE[verdict];
  // Only contested verdicts resolve differently — the marker keeps the
  // disagreement visible even when the pill reflects the user's lean
  const resolvedContested = verdict !== additive.baseVerdict;
  return (
    <Pressable
      style={[styles.additiveRow, first && styles.rowNoBorder]}
      onPress={() => router.push(`/additive/${additive.id}`)}>
      <View style={styles.additiveRowInner}>
        <View style={styles.additiveMain}>
          <View style={styles.additiveInfo}>
            <Text style={styles.additiveName}>{additive.name}</Text>
            <Text style={styles.additiveRole} numberOfLines={1}>
              {[additive.eNumber, additive.role].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={styles.pillCol}>
            <View style={[styles.verdictPill, { backgroundColor: vs.bg }]}>
              <Text style={[styles.verdictPillText, { color: vs.fg }]}>{vs.label}</Text>
            </View>
            {resolvedContested && (
              <Text style={styles.contestedMarker}>contested</Text>
            )}
          </View>
          <Text style={styles.rowChevron}>›</Text>
        </View>
        {profileNote && (
          <View style={styles.profileNoteBanner}>
            <Text style={styles.profileNoteLabel}>FOR YOU</Text>
            <Text style={styles.profileNoteText}>{profileNote}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function RegulatoryAdditiveRow({ additive, first }: { additive: RegulatoryAdditive; first: boolean }) {
  return (
    <Pressable
      style={[styles.additiveRow, first && styles.rowNoBorder]}
      onPress={() => router.push(`/additive/${additive.id}`)}>
      <View style={styles.additiveMain}>
        <View style={styles.additiveInfo}>
          <Text style={styles.additiveName}>{additive.name}</Text>
          <Text style={styles.additiveRole}>{additive.eNumber} · Permitted (EU)</Text>
        </View>
        <View style={styles.regulatoryPill}>
          <Text style={styles.regulatoryPillText}>Regulatory status</Text>
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </View>
    </Pressable>
  );
}

function UnknownAdditiveRow({ additive, first }: { additive: UnknownAdditive; first: boolean }) {
  return (
    <View style={[styles.additiveRow, first && styles.rowNoBorder]}>
      <View style={styles.additiveMain}>
        <View style={styles.additiveInfo}>
          <Text style={styles.unknownAdditiveName}>{additive.name}</Text>
          <Text style={styles.unknownAdditiveRole}>{additive.eNumber}</Text>
        </View>
        <View style={styles.unratedPill}>
          <Text style={styles.unratedPillText}>Not rated</Text>
        </View>
      </View>
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
          {unit === 'kcal' ? Math.round(value) : value.toFixed(1)} {unit}
        </Text>
        {dvPct != null && (
          <Text style={[styles.nutrientDv, { color: dvColor }]}>{dvPct}% DV</Text>
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

  // Frequency context card
  freqCard: {
    backgroundColor: 'rgba(240,184,117,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  freqText: { fontSize: 13, color: '#f0b875', lineHeight: 19, fontWeight: '500' },
  freqAskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  freqAskLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(240,184,117,0.8)' },
  freqBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(240,184,117,0.35)',
  },
  freqBtnText: { fontSize: 12, fontWeight: '700', color: '#f0b875' },

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
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: '#f1f4f8',
  },
  rowNoBorder: { borderTopWidth: 0 },
  additiveRowInner: { gap: 10 },
  additiveMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  additiveInfo:  { flex: 1, gap: 3 },
  additiveName:  { fontSize: 14, fontWeight: '700', color: '#1a1f29' },
  additiveRole:  { fontSize: 11.5, color: '#9fadbf' },
  pillCol: { alignItems: 'center', gap: 3 },
  verdictPill:   { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  verdictPillText: { fontSize: 11.5, fontWeight: '800' },
  contestedMarker: { fontSize: 9.5, fontWeight: '700', color: '#6b5bd2', letterSpacing: 0.3 },
  rowChevron:    { fontSize: 18, color: '#d0d8e4' },
  unknownAdditiveName: { fontSize: 14, fontWeight: '600', color: '#8896a7' },
  unknownAdditiveRole: { fontSize: 11.5, color: '#b0bcc9' },
  unratedPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f1f4f8' },
  unratedPillText: { fontSize: 11.5, fontWeight: '700', color: '#9fadbf' },
  // Deliberately distinct from the everyday/sometimes/contested verdict colors —
  // this is EFSA permitted-status data, not a dose/frequency evidence verdict.
  regulatoryPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#e8f0fe' },
  regulatoryPillText: { fontSize: 11.5, fontWeight: '800', color: '#3d6bcc' },

  // Profile note banner (shared by additive rows and nutrition card)
  profileNoteBanner: {
    backgroundColor: '#f0faf5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c3e6d5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
    marginBottom: 4,
  },
  profileNoteLabel: { fontSize: 9, fontWeight: '800', color: '#1f9d6b', letterSpacing: 0.6 },
  profileNoteText:  { fontSize: 12.5, color: '#1a1f29', lineHeight: 18 },

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

  contextRow:    { flexDirection: 'row', gap: 6, paddingLeft: 2, marginBottom: 4 },
  contextBullet: { fontSize: 13, color: '#9fadbf', lineHeight: 18 },
  contextText:   { flex: 1, fontSize: 12.5, color: '#6b7787', lineHeight: 18 },
  refFootnote:   { fontSize: 11, color: '#9fadbf', lineHeight: 16, marginTop: 8 },

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
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
