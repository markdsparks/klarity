import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NutritionExplainer } from '@/data/nutrition-explainers';
import { AskAboutThis } from '@/components/ask-about-this';
import { BottomSheetBase } from '@/components/bottom-sheet-base';
import type { AskContext } from '@/services/qa/ask';

const TIER_LABEL: Record<string, string> = {
  A: 'Tier A · regulatory consensus / human trial',
  B: 'Tier B · human observational / limited human data',
  C: 'Tier C · animal data',
  D: 'Tier D · in-vitro or misattributed',
};

const TIER_COLOR: Record<string, string> = {
  A: '#1f9d6b', B: '#c8821a', C: '#c8821a', D: '#cf4b4b',
};

// Bottom-sheet "why this matters" for a nutrition context line. Mirrors the
// additive evidence-trail pattern: plain-language explanation, the evidence
// tier, and the authority behind the rule (spec 003/004 follow-up). Renders
// through BottomSheetBase (ADR-005) rather than a hand-rolled Modal.
export function ExplainerSheet({
  explainer,
  onClose,
  askContext,
}: {
  explainer: NutritionExplainer | null;
  onClose: () => void;
  askContext?: AskContext;
}) {
  return (
    <BottomSheetBase
      visible={explainer != null}
      onClose={onClose}
      footer={
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Got it</Text>
        </Pressable>
      }>
      {explainer ? (
        <>
          <View style={[styles.tierPill, { backgroundColor: `${TIER_COLOR[explainer.tier]}1a` }]}>
            <Text style={[styles.tierText, { color: TIER_COLOR[explainer.tier] }]}>
              {TIER_LABEL[explainer.tier] ?? `Tier ${explainer.tier}`}
            </Text>
          </View>
          <Text style={styles.title}>{explainer.title}</Text>
          <Text style={styles.body}>{explainer.body}</Text>
          <Text style={styles.sourceLabel}>Basis</Text>
          <Text style={styles.source}>{explainer.source}</Text>

          {askContext ? <AskAboutThis context={askContext} /> : null}
        </>
      ) : null}
    </BottomSheetBase>
  );
}

const styles = StyleSheet.create({
  tierPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  tierText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2330', letterSpacing: -0.3, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 23, color: '#3c4654' },
  sourceLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#9aa4b2', textTransform: 'uppercase', marginTop: 20, marginBottom: 6 },
  source: { fontSize: 13, lineHeight: 19, color: '#5a6472', fontStyle: 'italic' },
  closeBtn: { backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
