import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildExport,
  clearDiagnostics,
  loadFeedback,
  loadOutcomes,
  summarize,
  type DiagnosticsSummary,
  type FeedbackCategory,
  type FeedbackRecord,
  type ScanOutcome,
} from '@/services/diagnostics';

// "How Klarity's doing" (spec 009 M1). A mirror, not a scoreboard: shows how
// often real scans land a confident verdict vs. each gap type, so the next
// round of depth is aimed at real gaps. All local; nothing leaves the device.

const OUTCOME_META: Record<ScanOutcome, { label: string; tone: 'good' | 'gap' | 'neutral' }> = {
  confident:          { label: 'Confident verdict',      tone: 'good' },
  clean:              { label: 'No additives',           tone: 'good' },
  'unrated-additive': { label: 'Unrated additive',       tone: 'gap' },
  'regulatory-only':  { label: 'Permitted-status only',  tone: 'gap' },
  'thin-nutrition':   { label: 'No nutrition data',      tone: 'gap' },
  'not-found':        { label: 'Not found',              tone: 'gap' },
  restaurant:         { label: 'Restaurant item',        tone: 'neutral' },
};

const ORDER: ScanOutcome[] = [
  'confident', 'clean', 'restaurant',
  'unrated-additive', 'regulatory-only', 'thin-nutrition', 'not-found',
];

const SUGAR_LABEL: Record<string, string> = {
  'added-known': 'Added sugar (from label)',
  'total-only': 'Total — couldn’t split added',
  'whole-food': 'Whole-food matrix',
  disqualified: 'Juice/soda — scored on total',
  negligible: 'Low sugar',
};

const BAR_COLOR = { good: '#1f9d6b', gap: '#c8821a', neutral: '#8896a7' };

const FEEDBACK_LABEL: Record<FeedbackCategory, string> = {
  'wrong-verdict': 'Verdict felt wrong',
  'wrong-data': 'Numbers look off',
  'missing-additive': 'Missed an ingredient',
  'not-found': 'Not found',
  other: 'Other',
};

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<DiagnosticsSummary | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);

  const refresh = useCallback(() => {
    loadOutcomes().then(recs => setSummary(summarize(recs)));
    loadFeedback().then(setFeedback);
  }, []);

  useFocusEffect(refresh);

  function handleClear() {
    Alert.alert('Clear diagnostics', 'Erase all logged scan outcomes and feedback on this device?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearDiagnostics().then(refresh) },
    ]);
  }

  async function handleExport() {
    try {
      const data = await buildExport();
      await Share.share({ title: 'Klarity diagnostics', message: JSON.stringify(data, null, 2) });
    } catch {
      // user dismissed or share unavailable — no-op
    }
  }

  const total = summary?.total ?? 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const sugarEntries = summary
    ? Object.entries(summary.sugarBasis).sort((a, b) => b[1] - a[1])
    : [];
  const sugarTotal = sugarEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}>
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
        <Text style={styles.backText}>← You</Text>
      </Pressable>

      <Text style={styles.title}>How Klarity’s doing</Text>
      <Text style={styles.subtitle}>
        How your recent scans resolved — a mirror of where the data is strong and where
        it has gaps. Stays on this device.
      </Text>

      {total === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No scans logged yet. Scan a few products and check back.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.count}>{total} scan{total === 1 ? '' : 's'} logged</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>OUTCOMES</Text>
            {ORDER.map(o => {
              const n = summary!.outcomes[o];
              if (n === 0) return null;
              const meta = OUTCOME_META[o];
              return (
                <View key={o} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowLabel}>{meta.label}</Text>
                    <Text style={styles.rowVal}>{pct(n)}% · {n}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${pct(n)}%`, backgroundColor: BAR_COLOR[meta.tone] }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {sugarTotal > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SUGAR BASIS</Text>
              <Text style={styles.cardHint}>What the sugar verdict rested on (spec 008).</Text>
              {sugarEntries.map(([basis, n]) => (
                <View key={basis} style={styles.row}>
                  <View style={styles.rowHead}>
                    <Text style={styles.rowLabel}>{SUGAR_LABEL[basis] ?? basis}</Text>
                    <Text style={styles.rowVal}>{Math.round((n / sugarTotal) * 100)}% · {n}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round((n / sugarTotal) * 100)}%`, backgroundColor: '#6b5bd2' }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {feedback.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>FLAGGED BY YOU</Text>
              {feedback.slice(0, 20).map((f, i) => (
                <View key={`${f.at}-${i}`} style={styles.flagRow}>
                  <Text style={styles.flagCat}>{FEEDBACK_LABEL[f.category]}</Text>
                  <Text style={styles.flagName} numberOfLines={1}>
                    {f.productName || f.note || f.barcode || '—'}
                  </Text>
                  {f.note && f.productName ? (
                    <Text style={styles.flagNote} numberOfLines={2}>“{f.note}”</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.exportBtn} onPress={handleExport}>
            <Text style={styles.exportText}>Export data (JSON)</Text>
          </Pressable>
          <Pressable style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearText}>Clear diagnostics</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f6f8fa' },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '700', color: '#1f9d6b' },
  title: { fontSize: 26, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.5 },
  subtitle: { fontSize: 13.5, color: '#5b6675', lineHeight: 20, marginTop: 6, marginBottom: 18 },
  count: { fontSize: 13, fontWeight: '700', color: '#8896a7', marginBottom: 10 },

  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#8896a7', textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: '#e7ebf0',
  },
  cardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: '#8896a7' },
  cardHint: { fontSize: 12, color: '#9fadbf', marginTop: 3, marginBottom: 4 },

  row: { marginTop: 14 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
  rowLabel: { fontSize: 14, color: '#1a1f29', fontWeight: '600' },
  rowVal: { fontSize: 12.5, color: '#8896a7', fontWeight: '600' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#eef1f5', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },

  flagRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f4f8' },
  flagCat: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: '#c8821a', textTransform: 'uppercase' },
  flagName: { fontSize: 14, fontWeight: '600', color: '#1a1f29', marginTop: 3 },
  flagNote: { fontSize: 13, color: '#5b6675', marginTop: 3, fontStyle: 'italic' },

  exportBtn: {
    marginTop: 8, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
    alignItems: 'center', borderWidth: 1, borderColor: '#dde4ee',
  },
  exportText: { fontSize: 14, fontWeight: '700', color: '#1f9d6b' },
  clearBtn: { marginTop: 6, paddingVertical: 12, alignItems: 'center' },
  clearText: { fontSize: 14, fontWeight: '600', color: '#9fadbf' },
});
