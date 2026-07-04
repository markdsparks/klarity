import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { NutritionExplainer } from '@/data/nutrition-explainers';
import { AskAboutThis } from '@/components/ask-about-this';
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
// tier, and the authority behind the rule (spec 003/004 follow-up).
export function ExplainerSheet({
  explainer,
  onClose,
  askContext,
}: {
  explainer: NutritionExplainer | null;
  onClose: () => void;
  askContext?: AskContext;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={explainer != null}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {explainer ? (
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <ScrollView showsVerticalScrollIndicator={false}>
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
            </ScrollView>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        ) : <View />}
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(14,17,22,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 22, paddingTop: 12,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#d7dce3', marginBottom: 18 },
  tierPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  tierText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2330', letterSpacing: -0.3, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 23, color: '#3c4654' },
  sourceLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#9aa4b2', textTransform: 'uppercase', marginTop: 20, marginBottom: 6 },
  source: { fontSize: 13, lineHeight: 19, color: '#5a6472', fontStyle: 'italic' },
  closeBtn: { marginTop: 18, backgroundColor: '#0e1116', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
