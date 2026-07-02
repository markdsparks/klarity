import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matchByIngredientText } from '@/data/ingredient-text-index';
import { ADDITIVES } from '@/data/additives';
import { explainerForLine, type NutritionExplainer } from '@/data/nutrition-explainers';
import { ExplainerSheet } from '@/components/explainer-sheet';
import { OptionSheet, type BuildOption } from '@/components/option-sheet';
import { getCatalogComponent, getChain, getMenuItem } from '@/data/restaurants';
import { useProfile } from '@/hooks/use-profile';
import {
  restaurantHistoryKey,
  saveToHistory,
  updateRestaurantBuild,
} from '@/services/history';
import { referenceValues, toneNutrition } from '@/services/nutrition';
import {
  adjustedNutrition,
  effectiveIngredientText,
  menuItemGlance,
  restaurantServingNutrients,
} from '@/services/restaurant-search';
import { resolveVerdict } from '@/services/verdict';
import { verdictSentence } from '@/services/verdict-sentence';
import type { AdditiveResult, VerdictKey } from '@/types/index';
import type { ItemSlot } from '@/types/restaurant';

// Restaurant menu item result (specs 004–006). Same two-axis layout as the
// barcode result, plus the build customizer: topping toggles (spec 005), and
// choice slots + add-ons (spec 006 M2) where a swap is remove-default +
// add-option, so everything still derives from {removedIds, addedIds} through
// the same pure math. Recompute is synchronous; adjusted nutrition is always
// labeled "computed".

// The additive consequence of one catalog component — shown per option in the
// sheet ("Adds annatto · everyday"). This is the evidence-guided-ordering
// moment (spec 006 Q3).
function additiveNoteFor(ingredientText: string): { note: string; tone: VerdictKey | null } {
  const adds = matchByIngredientText(ingredientText)
    .map(id => ADDITIVES[id])
    .filter(Boolean);
  if (adds.length === 0) return { note: 'No rated additives', tone: null };
  const worst: VerdictKey = adds.some(a => a.baseVerdict === 'contested') ? 'contested'
    : adds.some(a => a.baseVerdict === 'sometimes') ? 'sometimes' : 'everyday';
  const names = adds.slice(0, 3).map(a => a.name);
  const more = adds.length > 3 ? ` +${adds.length - 3} more` : '';
  return { note: `Adds ${names.join(', ')}${more}`, tone: worst };
}

function catalogCalories(id: string | null): number {
  return id ? getCatalogComponent(id)?.nutrition.calories ?? 0 : 0;
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
  const params = useLocalSearchParams<{ item: string; remove?: string; add?: string }>();

  const item = params.item ? getMenuItem(params.item) : undefined;
  const chain = item ? getChain(item.chainId) : undefined;

  // The `remove`/`add` params are the entry contract (search modifiers,
  // history replay, deep links); after mount the build card owns the state
  // (spec 005 Part C, extended by 006 M2).
  const [removedIds, setRemovedIds] = useState<string[]>(() => {
    const seeded = params.remove ? params.remove.split(',').filter(Boolean) : [];
    const removable = new Set(item?.components.filter(c => c.removable).map(c => c.id));
    return seeded.filter(id => removable.has(id));
  });
  const [addedIds, setAddedIds] = useState<string[]>(() => {
    const seeded = params.add ? params.add.split(',').filter(Boolean) : [];
    const addable = new Set([
      ...(item?.addOnIds ?? []),
      ...(item?.slots ?? []).flatMap(s => s.optionIds),
    ]);
    return seeded.filter(id => addable.has(id));
  });
  const [sheet, setSheet] = useState<null | { kind: 'slot'; slot: ItemSlot } | { kind: 'addons' }>(null);

  // First render records the scan (per-item frequency merge); later build
  // changes edit the entry in place so customizing never inflates the scan count.
  const buildKey = `${removedIds.join(',')}|${addedIds.join(',')}`;
  const scanRecorded = useRef(false);
  useEffect(() => {
    if (!item || !chain) return;
    const glance = menuItemGlance(item, removedIds, addedIds);
    if (!scanRecorded.current) {
      scanRecorded.current = true;
      void saveToHistory({
        barcode: restaurantHistoryKey(item.id),
        productName: item.name,
        brand: chain.name,
        ...glance,
        scannedAt: Date.now(),
        restaurant: { itemId: item.id, removedIds, addedIds },
      });
    } else {
      void updateRestaurantBuild(item.id, { removedIds, addedIds, ...glance });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, buildKey]);

  function toggleComponent(id: string) {
    setRemovedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  // Current slot selection: an added option wins; otherwise the default if it
  // hasn't been removed; otherwise none.
  function slotSelection(slot: ItemSlot): string | null {
    const chosen = slot.optionIds.find(id => addedIds.includes(id));
    if (chosen) return chosen;
    if (slot.defaultComponentId && !removedIds.includes(slot.defaultComponentId)) {
      return slot.defaultCatalogId;
    }
    return null;
  }

  // Swap = remove the default component + add the chosen option. Selecting the
  // default (or none) clears the slot's additions; the default's removal state
  // tracks whether the selection is the default.
  function selectSlotOption(slot: ItemSlot, optionId: string) {
    const isDefault = optionId === slot.defaultCatalogId && slot.defaultCatalogId != null;
    setAddedIds(prev => [
      ...prev.filter(id => !slot.optionIds.includes(id)),
      ...(optionId !== 'none' && !isDefault ? [optionId] : []),
    ]);
    if (slot.defaultComponentId) {
      setRemovedIds(prev => {
        const without = prev.filter(id => id !== slot.defaultComponentId);
        return isDefault ? without : [...without, slot.defaultComponentId!];
      });
    }
  }

  function toggleAddOn(id: string) {
    setAddedIds(prev =>
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
  const added = addedIds
    .map(id => getCatalogComponent(id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  // Slot-controlled components render as slot rows, not toggles
  const slotComponentIds = new Set(
    (item.slots ?? []).map(s => s.defaultComponentId).filter(Boolean) as string[],
  );
  const toggleComponents = item.components.filter(c => !slotComponentIds.has(c.id));

  // Additives — exact both ways: removed ingredients aren't analyzed, added ones are
  const additiveIds = matchByIngredientText(effectiveIngredientText(item, removedIds, addedIds));
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

  // Nutrition — published values, minus removals with data, plus additions
  const adj = adjustedNutrition(item, removedIds, addedIds);
  const sn = restaurantServingNutrients(adj.nutrition, referenceValues(profile));
  const nutrition = toneNutrition(sn, profile, { wholeFoodSugarMatrix: item.wholeFoodSugarMatrix });
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

  // Sheet contents — slot options show deltas vs the current selection;
  // add-ons show their absolute addition. Both show additive consequences.
  const sheetProps = (() => {
    if (!sheet) return null;
    if (sheet.kind === 'slot') {
      const slot = sheet.slot;
      const current = slotSelection(slot);
      const optionIds = [...slot.optionIds, ...(slot.allowNone ? ['none'] : [])];
      const options: BuildOption[] = optionIds.map(id => {
        if (id === 'none') {
          return {
            id,
            name: `No ${slot.label.toLowerCase()}`,
            calDelta: -catalogCalories(current),
            additiveNote: 'Nothing added to analyze',
            additiveTone: null,
            selected: current === null,
          };
        }
        const cat = getCatalogComponent(id)!;
        const { note, tone } = additiveNoteFor(cat.ingredientText);
        return {
          id,
          name: cat.name,
          calDelta: cat.nutrition.calories - catalogCalories(current),
          additiveNote: note,
          additiveTone: tone,
          selected: current === id,
        };
      });
      return {
        title: slot.label,
        options,
        multi: false,
        onSelect: (id: string) => selectSlotOption(slot, id),
      };
    }
    const options: BuildOption[] = (item.addOnIds ?? [])
      .map(id => getCatalogComponent(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map(cat => {
        const { note, tone } = additiveNoteFor(cat.ingredientText);
        return {
          id: cat.id,
          name: cat.name,
          calDelta: cat.nutrition.calories,
          additiveNote: note,
          additiveTone: tone,
          selected: addedIds.includes(cat.id),
        };
      });
    return { title: 'Add to this build', options, multi: true, onSelect: toggleAddOn };
  })();

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

        {/* Modifier chips — removals amber, additions green */}
        {(removed.length > 0 || added.length > 0) && (
          <View style={styles.modRow}>
            {removed.map(c => (
              <View key={c.id} style={styles.modChip}>
                <Text style={styles.modChipText}>– {c.name}</Text>
              </View>
            ))}
            {added.map(c => (
              <View key={c.id} style={[styles.modChip, styles.addChip]}>
                <Text style={[styles.modChipText, styles.addChipText]}>+ {c.name}</Text>
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
        {/* Your build (specs 005 + 006) — fixed components for full-recipe
            transparency, toggles for toppings, slot rows for choices
            (cheese …), and an extras section for chain add-ons. Everything
            recomputes both axes live. */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your build</Text>
            {(removed.length > 0 || added.length > 0) && (
              <Text style={styles.cardMeta}>
                {[
                  removed.length > 0 ? `${removed.length} removed` : null,
                  added.length > 0 ? `${added.length} added` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </View>
          {toggleComponents.map((c, i) => {
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

          {/* Choice slots — tap to swap (spec 006 M2) */}
          {(item.slots ?? []).map(slot => {
            const selectionId = slotSelection(slot);
            const selectionName = selectionId
              ? getCatalogComponent(selectionId)?.name ?? '—'
              : 'None';
            return (
              <Pressable
                key={slot.id}
                style={styles.buildRow}
                onPress={() => setSheet({ kind: 'slot', slot })}>
                <View style={styles.buildInfo}>
                  <Text style={styles.buildName}>{slot.label}</Text>
                  <Text style={styles.buildDelta}>{selectionName}</Text>
                </View>
                <Text style={styles.slotChange}>Change ›</Text>
              </Pressable>
            );
          })}

          {/* Add-ons */}
          {(item.addOnIds?.length ?? 0) > 0 && (
            <>
              {added
                .filter(c => item.addOnIds?.includes(c.id))
                .map(c => (
                  <View key={c.id} style={styles.buildRow}>
                    <View style={styles.buildInfo}>
                      <Text style={styles.buildName}>{c.name}</Text>
                      <Text style={styles.buildDelta}>+{c.nutrition.calories} cal · added</Text>
                    </View>
                    <Pressable onPress={() => toggleAddOn(c.id)} hitSlop={10}>
                      <Text style={styles.removeAddOn}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              <Pressable style={styles.addRow} onPress={() => setSheet({ kind: 'addons' })}>
                <Text style={styles.addRowText}>+ Add sauce or extra</Text>
              </Pressable>
            </>
          )}
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

      <OptionSheet
        title={sheetProps?.title ?? null}
        options={sheetProps?.options ?? []}
        multi={sheetProps?.multi ?? false}
        onSelect={sheetProps?.onSelect ?? (() => {})}
        onClose={() => setSheet(null)}
      />
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
  addChip: { backgroundColor: 'rgba(127,211,170,0.16)' },
  addChipText: { color: '#7fd3aa' },

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
  slotChange: { fontSize: 13, fontWeight: '700', color: '#1f9d6b' },
  removeAddOn: { fontSize: 15, fontWeight: '700', color: '#9aa4b2', paddingHorizontal: 4 },
  addRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eef0f3' },
  addRowText: { fontSize: 14, fontWeight: '700', color: '#1f9d6b' },

  sourceCard: { paddingHorizontal: 6 },
  sourceText: { fontSize: 12, color: '#8a94a3', lineHeight: 17 },

  errorWrap: { flex: 1, alignItems: 'center', gap: 16, backgroundColor: '#f4f5f7' },
  errorText: { fontSize: 16, color: '#3c4654' },
  errorBtn:  { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#0e1116', borderRadius: 12 },
  errorBtnText: { color: '#ffffff', fontWeight: '600' },
});
