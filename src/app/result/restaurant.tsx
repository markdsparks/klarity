import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matchByIngredientText } from '@/data/ingredient-text-index';
import { ADDITIVES } from '@/data/additives';
import { explainerForLine, type NutritionExplainer } from '@/data/nutrition-explainers';
import { ExplainerSheet } from '@/components/explainer-sheet';
import { getChain, getMenuItem } from '@/data/restaurants';
import { DEFAULT_PROFILE, useProfile } from '@/hooks/use-profile';
import {
  restaurantHistoryKey,
  saveToHistory,
  updateRestaurantBuild,
} from '@/services/history';
import { referenceValues, toneNutrition } from '@/services/nutrition';
import {
  adjustedNutrition,
  effectiveIngredientText,
  restaurantServingNutrients,
} from '@/services/restaurant-search';
import { resolveVerdict } from '@/services/verdict';
import { verdictSentence } from '@/services/verdict-sentence';
import type { AdditiveGlanceKey } from '@/types/history';
import type { AdditiveResult, VerdictKey } from '@/types/index';
import type { MenuItem } from '@/types/restaurant';

// Restaurant menu item result (specs 004 + 005). Same two-axis layout as the
// barcode result, plus: chain provenance line, and the build customizer —
// search modifiers seed a "Your build" card whose toggles recompute both axes
// live (all modifier math is pure and local, so recompute is synchronous).
// Nutrition adjusted by removals is always labeled "computed".

// History stores the profile-independent baseline (base verdicts, default-
// profile tone), same rule as the barcode screen.
function baseHistoryGlance(item: MenuItem, removedIds: string[]): {
  additiveGlance: AdditiveGlanceKey;
  nutritionTone: ReturnType<typeof toneNutrition>['tone'];
} {
  const verdicts = matchByIngredientText(effectiveIngredientText(item, removedIds))
    .map(id => ADDITIVES[id])
    .filter(Boolean)
    .map(a => a.baseVerdict);
  const additiveGlance: AdditiveGlanceKey = verdicts.length === 0 ? 'clean'
    : verdicts.includes('contested') ? 'contested'
    : verdicts.includes('sometimes') ? 'sometimes' : 'everyday';
  const sn = restaurantServingNutrients(
    adjustedNutrition(item, removedIds).nutrition,
    referenceValues(DEFAULT_PROFILE),
  );
  return { additiveGlance, nutritionTone: toneNutrition(sn, DEFAULT_PROFILE).tone };
}

const GLANCE: Record<VerdictKey | 'clean', { bg: string; fg: string; label: string }> = {
  everyday:  { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'Everyday'  },
  sometimes: { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Sometimes' },
  contested: { bg: 'rgba(176,158,232,0.16)', fg: '#b09ee8', label: 'Contested' },
  clean:     { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'No additives' },
};

const NUTRITION_GLANCE = {
  good: { bg: 'rgba(127,211,170,0.16)', fg: '#7fd3aa', label: 'Good'     },
  ok:   { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Moderate' },
  warn: { bg: 'rgba(240,184,117,0.16)', fg: '#f0b875', label: 'Watch'    },
};

const VERDICT_PILL: Record<VerdictKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday'  },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes' },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested' },
};

export default function RestaurantResultScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [explainer, setExplainer] = useState<NutritionExplainer | null>(null);
  const params = useLocalSearchParams<{ item: string; remove?: string }>();

  const item = params.item ? getMenuItem(params.item) : undefined;
  const chain = item ? getChain(item.chainId) : undefined;

  // The `remove` param is the entry contract (search modifiers, history replay);
  // after mount the build card's toggles own the state (spec 005 Part C).
  const [removedIds, setRemovedIds] = useState<string[]>(() => {
    const seeded = params.remove ? params.remove.split(',').filter(Boolean) : [];
    const removable = new Set(item?.components.filter(c => c.removable).map(c => c.id));
    return seeded.filter(id => removable.has(id));
  });

  // First render records the scan (per-item frequency merge); later build
  // changes edit the entry in place so toggling never inflates the scan count.
  const buildKey = removedIds.join(',');
  const scanRecorded = useRef(false);
  useEffect(() => {
    if (!item || !chain) return;
    const glance = baseHistoryGlance(item, removedIds);
    if (!scanRecorded.current) {
      scanRecorded.current = true;
      void saveToHistory({
        barcode: restaurantHistoryKey(item.id),
        productName: item.name,
        brand: chain.name,
        ...glance,
        scannedAt: Date.now(),
        restaurant: { itemId: item.id, removedIds },
      });
    } else {
      void updateRestaurantBuild(item.id, { removedIds, ...glance });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, buildKey]);

  function toggleComponent(id: string) {
    setRemovedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  if (!item || !chain) {
    return (
      <View style={[styles.errorWrap, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.errorText}>Menu item not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  const removed = item.components.filter(c => removedIds.includes(c.id));

  // Additives — exact: removed components' ingredients are not analyzed
  const additiveIds = matchByIngredientText(effectiveIngredientText(item, removedIds));
  const additiveResults: AdditiveResult[] = additiveIds
    .map(id => ADDITIVES[id])
    .filter(Boolean)
    .map(a => resolveVerdict(a, profile))
    .sort((a, b) => (b.profileNote ? 1 : 0) - (a.profileNote ? 1 : 0));

  const verdicts = additiveResults.map(r => r.verdict);
  const glanceKey = verdicts.length === 0 ? 'clean'
    : verdicts.includes('contested') ? 'contested'
    : verdicts.includes('sometimes') ? 'sometimes' : 'everyday';
  const additiveGlance = GLANCE[glanceKey];

  // Nutrition — published values, minus removed-component data where we have it
  const adj = adjustedNutrition(item, removedIds);
  const sn = restaurantServingNutrients(adj.nutrition, referenceValues(profile));
  const nutrition = toneNutrition(sn, profile);
  const nutritionGlance = NUTRITION_GLANCE[nutrition.tone];

  const matched = additiveIds.map(id => ADDITIVES[id]).filter(Boolean);
  const summarySentence = verdictSentence({
    contestedDriver: matched.find(a => a.baseVerdict === 'contested') ?? null,
    sometimesAdditives: matched.filter(a => a.baseVerdict === 'sometimes'),
    nutritionTone: nutrition.tone,
    highNutrients: nutrition.highNutrients,
    satFatBudget: nutrition.satFatBudget,
    profile,
    proteinDv: sn.proteinDv ?? 0,
  });

  const nutritionRows = [
    { k: 'Calories', v: `${Math.round(sn.calories ?? 0)} kcal`, dv: null as number | null },
    { k: 'Total Fat', v: `${sn.totalFat} g`, dv: sn.fatDv ?? null },
    { k: 'Saturated Fat', v: `${sn.satFat} g`, dv: sn.satFatDv ?? null },
    { k: 'Sodium', v: `${Math.round((sn.sodium ?? 0) * 1000)} mg`, dv: sn.sodiumDv ?? null },
    { k: 'Carbohydrates', v: `${sn.carbs} g`, dv: sn.carbsDv ?? null },
    { k: 'Sugars', v: `${sn.sugar} g`, dv: sn.sugarDv ?? null },
    { k: 'Fiber', v: `${sn.fiber} g`, dv: sn.fiberDv ?? null },
    { k: 'Protein', v: `${sn.protein} g`, dv: sn.proteinDv ?? null },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
      {/* ── Dark hero ── */}
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        <View>
          <Text style={styles.chainName}>{chain.name.toUpperCase()}</Text>
          <Text style={styles.itemName} numberOfLines={3}>{item.name}</Text>
          <Text style={styles.serving}>{item.serving}</Text>
        </View>

        {/* Modifier chips */}
        {removed.length > 0 && (
          <View style={styles.modRow}>
            {removed.map(c => (
              <View key={c.id} style={styles.modChip}>
                <Text style={styles.modChipText}>– {c.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Layer 1 — plain-language verdict */}
        {summarySentence ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summarySentence}</Text>
          </View>
        ) : null}

        {/* At-a-glance badges */}
        <View style={styles.glanceRow}>
          <View style={[styles.glanceBadge, { backgroundColor: additiveGlance.bg }]}>
            <Text style={[styles.glanceAxis, { color: additiveGlance.fg }]}>ADDITIVES</Text>
            <Text style={[styles.glanceVerdict, { color: additiveGlance.fg }]}>{additiveGlance.label}</Text>
          </View>
          <View style={[styles.glanceBadge, { backgroundColor: nutritionGlance.bg }]}>
            <Text style={[styles.glanceAxis, { color: nutritionGlance.fg }]}>NUTRITION</Text>
            <Text style={[styles.glanceVerdict, { color: nutritionGlance.fg }]}>{nutritionGlance.label}</Text>
          </View>
        </View>
      </View>

      {/* ── Light content ── */}
      <View style={styles.content}>
        {/* Your build (spec 005) — fixed components shown for full-recipe
            transparency; removable ones toggle and recompute both axes live */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your build</Text>
            {removed.length > 0 && (
              <Text style={styles.cardMeta}>{removed.length} removed</Text>
            )}
          </View>
          {item.components.map((c, i) => {
            const isRemoved = removedIds.includes(c.id);
            const calDelta = c.nutrition?.calories;
            return (
              <View key={c.id} style={[styles.buildRow, i === 0 && { borderTopWidth: 0 }]}>
                <View style={styles.buildInfo}>
                  <Text style={[styles.buildName, isRemoved && styles.buildNameRemoved]}>
                    {c.name}
                  </Text>
                  {c.removable && calDelta != null ? (
                    <Text style={styles.buildDelta}>−{calDelta} cal when removed</Text>
                  ) : null}
                </View>
                {c.removable ? (
                  <Switch
                    value={!isRemoved}
                    onValueChange={() => toggleComponent(c.id)}
                    trackColor={{ true: '#1f9d6b', false: '#d0d8e4' }}
                    style={styles.buildSwitch}
                  />
                ) : (
                  <View style={styles.baseTag}>
                    <Text style={styles.baseTagText}>BASE</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Additives */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Additives</Text>
            {additiveResults.length > 0 && <Text style={styles.cardMeta}>{additiveResults.length} in item</Text>}
          </View>
          {additiveResults.length === 0 && (
            <Text style={styles.emptyText}>No rated additives in this build.</Text>
          )}
          {additiveResults.map((result, i) => {
            const pill = VERDICT_PILL[result.verdict];
            return (
              <Pressable
                key={result.additive.id}
                style={[styles.additiveRow, i === 0 && { borderTopWidth: 0 }]}
                onPress={() => router.push(`/additive/${result.additive.id}`)}>
                <View style={styles.additiveInfo}>
                  <Text style={styles.additiveName}>{result.additive.name}</Text>
                  <Text style={styles.additiveRole} numberOfLines={1}>
                    {result.additive.eNumber ? `${result.additive.eNumber} · ` : ''}{result.additive.role}
                  </Text>
                  {result.profileNote ? (
                    <Text style={styles.profileNote} numberOfLines={2}>{result.profileNote}</Text>
                  ) : null}
                </View>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Nutrition */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Nutrition</Text>
              {adj.computed && (
                <View style={styles.computedBadge}>
                  <Text style={styles.computedBadgeText}>Computed</Text>
                </View>
              )}
            </View>
            <View style={[styles.pill, { backgroundColor: nutrition.tone === 'good' ? '#e8f7ef' : '#fdf3e3' }]}>
              <Text style={[styles.pillText, { color: nutrition.tone === 'good' ? '#1f9d6b' : '#c8821a' }]}>
                {nutritionGlance.label}
              </Text>
            </View>
          </View>

          <Text style={styles.nutritionSummary}>{nutrition.summary}</Text>
          {nutrition.contextLines.map(line => {
            const exp = explainerForLine(line);
            return (
              <Pressable key={line} disabled={!exp} onPress={exp ? () => setExplainer(exp) : undefined}>
                <Text style={styles.contextLine}>
                  · {line}{exp ? <Text style={styles.contextLink}>  Why?</Text> : null}
                </Text>
              </Pressable>
            );
          })}
          {nutrition.profileNotes.map(line => (
            <Text key={line} style={styles.profileNote}>{line}</Text>
          ))}

          {nutritionRows.map((row, i) => (
            <View key={row.k} style={[styles.nutritionRow, i === 0 && { borderTopWidth: 0 }]}>
              <Text style={styles.nutritionKey}>{row.k}</Text>
              <View style={styles.nutritionValueWrap}>
                <Text style={styles.nutritionValue}>{row.v}</Text>
                {row.dv != null && <Text style={styles.nutritionDv}>{row.dv}% DV</Text>}
              </View>
            </View>
          ))}

          {adj.computed && adj.basis ? (
            <Text style={styles.basisNote}>Computed: {adj.basis}. Base item as published.</Text>
          ) : null}
          {adj.unadjustedRemovals.length > 0 ? (
            <Text style={styles.basisNote}>
              Nutrition shown for the standard build — removing {adj.unadjustedRemovals.map(c => c.name.toLowerCase()).join(', ')} has
              no published nutrition data to subtract (ingredient analysis reflects the removal exactly).
            </Text>
          ) : null}
        </View>

        {/* Provenance */}
        <View style={styles.sourceCard}>
          <Text style={styles.sourceText}>
            Source: {chain.source.label} (FDA menu-labeling disclosure) · retrieved {chain.source.retrieved}
          </Text>
        </View>
      </View>

      <ExplainerSheet explainer={explainer} onClose={() => setExplainer(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f4f5f7' },

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

  chainName: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: '#4cc38a', marginBottom: 4 },
  itemName:  { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, lineHeight: 31 },
  serving:   { fontSize: 12, color: '#9fadbf', marginTop: 4 },

  modRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modChip: { backgroundColor: 'rgba(240,184,117,0.16)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  modChipText: { fontSize: 13, fontWeight: '600', color: '#f0b875' },

  summaryCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  summaryText: { fontSize: 15, color: '#e8eaed', lineHeight: 22, fontWeight: '500' },

  glanceRow:   { flexDirection: 'row', gap: 10 },
  glanceBadge: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, gap: 3 },
  glanceAxis:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7 },
  glanceVerdict: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#5a6472', textTransform: 'uppercase' },
  cardMeta:  { fontSize: 13, color: '#9aa4b2' },
  emptyText: { fontSize: 14, color: '#9aa4b2', paddingVertical: 8 },

  additiveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#eef0f3',
  },
  additiveInfo: { flex: 1, gap: 2 },
  additiveName: { fontSize: 16, fontWeight: '700', color: '#1b2330' },
  additiveRole: { fontSize: 13, color: '#8a94a3' },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '700' },
  chevron: { fontSize: 18, color: '#c3cad4' },
  profileNote: { fontSize: 13, color: '#6b5bd2', marginTop: 4, lineHeight: 18 },

  nutritionSummary: { fontSize: 15, fontWeight: '600', color: '#1b2330', marginBottom: 4, lineHeight: 21 },
  contextLine: { fontSize: 13, color: '#5a6472', lineHeight: 19 },
  contextLink: { color: '#1f9d6b', fontWeight: '700' },
  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eef0f3', marginTop: 2,
  },
  nutritionKey: { fontSize: 14, color: '#3c4654' },
  nutritionValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  nutritionValue: { fontSize: 15, fontWeight: '700', color: '#1b2330' },
  nutritionDv: { fontSize: 12, color: '#9aa4b2' },
  basisNote: { fontSize: 12, color: '#8a94a3', marginTop: 10, lineHeight: 17 },

  computedBadge: { backgroundColor: '#e8f0fe', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  computedBadgeText: { fontSize: 11, fontWeight: '700', color: '#3d6bcc' },

  buildRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#eef0f3',
  },
  buildInfo: { flex: 1, gap: 1 },
  buildName: { fontSize: 14.5, fontWeight: '600', color: '#1b2330' },
  buildNameRemoved: { color: '#9aa4b2', textDecorationLine: 'line-through' },
  buildDelta: { fontSize: 12, color: '#8a94a3' },
  buildSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  baseTag: { backgroundColor: '#f1f4f8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  baseTagText: { fontSize: 10, fontWeight: '800', color: '#9fadbf', letterSpacing: 0.5 },

  sourceCard: { paddingHorizontal: 6 },
  sourceText: { fontSize: 12, color: '#8a94a3', lineHeight: 17 },

  errorWrap: { flex: 1, alignItems: 'center', gap: 16, backgroundColor: '#f4f5f7' },
  errorText: { fontSize: 16, color: '#3c4654' },
  errorBtn:  { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#0e1116', borderRadius: 12 },
  errorBtnText: { color: '#ffffff', fontWeight: '600' },
});
