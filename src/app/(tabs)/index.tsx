import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { matchByETags } from '@/data/additive-index';
import { searchProducts } from '@/services/off';
import type { OFFSearchProduct } from '@/types/off';

type Mode = 'scan' | 'search';

const SCAN_COOLDOWN_MS = 2000;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scan');
  const [scanning, setScanning] = useState(false);
  const lastScanAt = useRef(0);
  const insets = useSafeAreaInsets();

  function handleBarcode({ data }: { data: string }) {
    const now = Date.now();
    if (scanning || now - lastScanAt.current < SCAN_COOLDOWN_MS) return;
    lastScanAt.current = now;
    setScanning(true);
    router.push(`/result/${encodeURIComponent(data)}`);
    setTimeout(() => setScanning(false), SCAN_COOLDOWN_MS);
  }

  const topPad = insets.top + 12;

  return (
    <View style={styles.container}>

      {/* ── Camera (always mounted when permission granted so it's instant on switch) ── */}
      {permission?.granted && (
        <CameraView
          style={[StyleSheet.absoluteFill, mode !== 'scan' && styles.hidden]}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={mode === 'scan' && !scanning ? handleBarcode : undefined}
        />
      )}

      {/* ── Top bar (branding + mode toggle) ── */}
      <View style={[styles.topBar, { paddingTop: topPad }, mode === 'search' && styles.topBarSearch]}>
        <Text style={[styles.brand, mode === 'search' && styles.brandDark]}>
          <Text style={styles.brandGreen}>K</Text>larity
        </Text>
        <View style={styles.toggle}>
          <ToggleBtn label="📷  Scan" active={mode === 'scan'} onPress={() => { setMode('scan'); Keyboard.dismiss(); }} />
          <ToggleBtn label="🔍  Search" active={mode === 'search'} onPress={() => setMode('search')} />
        </View>
      </View>

      {/* ── Scan mode content ── */}
      {mode === 'scan' && (
        <>
          {!permission && <View />}

          {permission && !permission.granted && (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionBody}>
                Klarity needs your camera to scan barcodes.
              </Text>
              <Pressable style={styles.permissionBtn} onPress={requestPermission}>
                <Text style={styles.permissionBtnText}>Enable camera</Text>
              </Pressable>
            </View>
          )}

          {permission?.granted && (
            <>
              <View style={styles.viewfinderWrapper} pointerEvents="none">
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>Point at a barcode</Text>
              </View>

              {scanning && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#7fd3aa" />
                  <Text style={styles.loadingText}>Looking up product…</Text>
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* ── Search mode content ── */}
      {mode === 'search' && (
        <SearchPanel topPad={topPad} bottomPad={insets.bottom} />
      )}
    </View>
  );
}

// ── Mode toggle button ─────────────────────────────────────────────────────────

function ToggleBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.toggleBtn, active && styles.toggleBtnActive]}
      onPress={onPress}>
      <Text style={[styles.toggleBtnText, active && styles.toggleBtnTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Search panel ───────────────────────────────────────────────────────────────

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; results: OFFSearchProduct[] };

function SearchPanel({ topPad, bottomPad }: { topPad: number; bottomPad: number }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChangeText(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setState({ status: 'idle' }); return; }
    debounceRef.current = setTimeout(() => runSearch(text.trim()), 500);
  }

  async function runSearch(q: string) {
    setState({ status: 'loading' });
    try {
      const results = await searchProducts(q);
      setState({ status: 'done', results });
    } catch {
      setState({ status: 'error' });
    }
  }

  return (
    <View style={[styles.searchPanel, { paddingTop: topPad + 72 }]}>
      {/* Input */}
      <View style={styles.searchInputRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products…"
          placeholderTextColor="#9fadbf"
          value={query}
          onChangeText={onChangeText}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={() => query.trim() && runSearch(query.trim())}
          clearButtonMode="while-editing"
        />
      </View>

      {/* States */}
      {state.status === 'idle' && (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>Type a product name to search</Text>
        </View>
      )}

      {state.status === 'loading' && (
        <View style={styles.searchEmpty}>
          <ActivityIndicator color="#1f9d6b" />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>Search failed — check your connection.</Text>
        </View>
      )}

      {state.status === 'done' && state.results.length === 0 && (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>No products found for "{query}"</Text>
        </View>
      )}

      {state.status === 'done' && state.results.length > 0 && (
        <FlatList
          data={state.results}
          keyExtractor={p => p.code}
          contentContainerStyle={{ paddingBottom: bottomPad + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <SearchResultRow product={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

function SearchResultRow({ product }: { product: OFFSearchProduct }) {
  const matchedCount = matchByETags(product.additives_tags ?? []).length;
  const totalCount = product.additives_tags?.length ?? 0;
  const brand = product.brands?.split(',')[0].trim();

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
      onPress={() => router.push(`/result/${encodeURIComponent(product.code)}`)}>
      <View style={styles.resultMain}>
        <Text style={styles.resultName} numberOfLines={2}>{product.product_name}</Text>
        {brand ? <Text style={styles.resultBrand}>{brand}</Text> : null}
      </View>
      <View style={styles.resultMeta}>
        {totalCount > 0 && (
          <View style={styles.additiveBadge}>
            <Text style={styles.additiveBadgeText}>
              {matchedCount > 0 ? `${matchedCount} flagged` : `${totalCount} additives`}
            </Text>
          </View>
        )}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CORNER = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1116',
  },
  hidden: { opacity: 0 },

  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingBottom: 14,
    backgroundColor: 'rgba(14,17,22,0.65)',
    zIndex: 10,
  },
  topBarSearch: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e7ebf0',
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  brandDark: { color: '#1a1f29' },
  brandGreen: { color: '#7fd3aa' },

  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 9,
  },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  toggleBtnTextActive: { color: '#1a1f29' },

  viewfinderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  viewfinder: { width: 260, height: 160, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#7fd3aa' },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  scanHint: { color: '#9fadbf', fontSize: 13 },

  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14,17,22,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: '#cdd6e3', fontSize: 15 },

  permissionBox: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  permissionBody: { fontSize: 14, color: '#9fadbf', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  permissionBtn: { backgroundColor: '#1f9d6b', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Search panel
  searchPanel: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  searchInputRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e7ebf0',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f1f4f8',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1a1f29',
  },
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60,
  },
  searchEmptyText: { fontSize: 14, color: '#9fadbf', textAlign: 'center', paddingHorizontal: 32 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#fff',
    gap: 12,
  },
  resultRowPressed: { backgroundColor: '#f6f8fa' },
  resultMain: { flex: 1, gap: 2 },
  resultName: { fontSize: 14, fontWeight: '600', color: '#1a1f29', lineHeight: 19 },
  resultBrand: { fontSize: 12, color: '#8896a7' },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  additiveBadge: {
    backgroundColor: '#f1f4f8',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  additiveBadgeText: { fontSize: 11, fontWeight: '600', color: '#5b6675' },
  chevron: { color: '#c8d0da', fontSize: 18 },
  separator: { height: 1, backgroundColor: '#f1f4f8', marginLeft: 16 },
});
