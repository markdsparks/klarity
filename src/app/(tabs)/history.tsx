import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clearHistory, distinctScanDays, loadHistory } from '@/services/history';
import type { AdditiveGlanceKey, ScanHistoryEntry } from '@/types/history';
import type { NutritionTone } from '@/types/index';

// ── Verdict / nutrition style maps ────────────────────────────────────────────
const ADDITIVE_STYLE: Record<AdditiveGlanceKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday'     },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes'    },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested'    },
  clean:     { bg: '#e8f7ef', fg: '#1f9d6b', label: 'No additives' },
  unrated:   { bg: '#f1f4f8', fg: '#9fadbf', label: 'Not rated'    },
};

const NUTRITION_STYLE: Record<NutritionTone, { bg: string; fg: string; label: string }> = {
  good: { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Good'     },
  ok:   { bg: '#fdf3e3', fg: '#c8821a', label: 'Moderate' },
  warn: { bg: '#fdf3e3', fg: '#e05c5c', label: 'Watch'    },
};

// ── Avatar palette (letter fallback) ─────────────────────────────────────────
const AVATAR_PALETTE = [
  { bg: '#e8f7ef', fg: '#1f9d6b' },
  { bg: '#fdf3e3', fg: '#c8821a' },
  { bg: '#efecfb', fg: '#6b5bd2' },
  { bg: '#e8f0fe', fg: '#3d6bcc' },
  { bg: '#fce8e8', fg: '#c04a4a' },
];

// ── Relative time ─────────────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60_000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7)  return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  // Reload whenever the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setEntries);
    }, [])
  );

  function handleClear() {
    Alert.alert('Clear history', 'Remove all scanned products?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: () => clearHistory().then(() => setEntries([])),
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        {entries.length > 0 && (
          <Pressable onPress={handleClear} hitSlop={12}>
            <Text style={styles.clearBtn}>Clear</Text>
          </Pressable>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyBody}>
            Products you scan will appear here so you can look back at your grocery trips.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.barcode}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <HistoryRow entry={item} />}
        />
      )}
    </View>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function HistoryRow({ entry }: { entry: ScanHistoryEntry }) {
  const as = ADDITIVE_STYLE[entry.additiveGlance];
  const ns = NUTRITION_STYLE[entry.nutritionTone];
  const initial = (entry.productName[0] ?? '?').toUpperCase();
  const avatarColor = AVATAR_PALETTE[initial.charCodeAt(0) % AVATAR_PALETTE.length];
  const recentDays = distinctScanDays(entry, 14);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => router.push(`/result/${encodeURIComponent(entry.barcode)}`)}>

      {/* Thumbnail / avatar */}
      {entry.imageUrl ? (
        <Image source={{ uri: entry.imageUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbAvatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.thumbAvatarText, { color: avatarColor.fg }]}>{initial}</Text>
        </View>
      )}

      {/* Product info */}
      <View style={styles.info}>
        <Text style={styles.productName} numberOfLines={2}>{entry.productName}</Text>
        <Text style={styles.meta}>
          {[
            entry.brand,
            relativeTime(entry.scannedAt),
            recentDays >= 2 ? `${recentDays} days recently` : null,
          ].filter(Boolean).join(' · ')}
        </Text>
        {/* Verdict pills */}
        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: as.bg }]}>
            <Text style={[styles.pillText, { color: as.fg }]}>{as.label}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: ns.bg }]}>
            <Text style={[styles.pillText, { color: ns.fg }]}>{ns.label}</Text>
          </View>
          {entry.buySignal === 'regular' && (
            <View style={[styles.pill, styles.regularPill]}>
              <Text style={[styles.pillText, styles.regularPillText]}>Regular buy</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fa' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#f6f8fa',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.5 },
  clearBtn:    { fontSize: 14, fontWeight: '600', color: '#9fadbf' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
    marginTop: -60,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1a1f29', textAlign: 'center' },
  emptyBody:  { fontSize: 14, color: '#8896a7', textAlign: 'center', lineHeight: 21 },

  separator: { height: 1, backgroundColor: '#edf0f4', marginHorizontal: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    backgroundColor: '#f6f8fa',
  },
  rowPressed: { opacity: 0.6 },

  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#e7ebf0' },
  thumbAvatar: { alignItems: 'center', justifyContent: 'center' },
  thumbAvatarText: { fontSize: 22, fontWeight: '700' },

  info: { flex: 1, gap: 4 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1a1f29', lineHeight: 19 },
  meta:        { fontSize: 12, color: '#9fadbf' },

  pills: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  pill:     { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  regularPill:     { borderWidth: 1, borderColor: '#c3e6d5', backgroundColor: '#fff' },
  regularPillText: { color: '#1f9d6b' },

  chevron: { fontSize: 20, color: '#d0d8e4' },
});
