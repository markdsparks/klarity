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

  return (
    <View style={styles.container}>
      {/* Camera always mounted when permission granted — instant switch-back */}
      {permission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={mode === 'scan' && !scanning ? handleBarcode : undefined}
        />
      )}

      {mode === 'scan' ? (
        <ScanOverlay
          permission={permission}
          requestPermission={requestPermission}
          scanning={scanning}
          onSearchOpen={() => setMode('search')}
          safeTop={insets.top}
        />
      ) : (
        <SearchOverlay
          onClose={() => { setMode('scan'); Keyboard.dismiss(); }}
          safeTop={insets.top}
          safeBottom={insets.bottom}
        />
      )}
    </View>
  );
}

// ── Scan overlay — floats above the camera ────────────────────────────────────

function ScanOverlay({
  permission,
  requestPermission,
  scanning,
  onSearchOpen,
  safeTop,
}: {
  permission: { granted: boolean } | null;
  requestPermission: () => unknown;
  scanning: boolean;
  onSearchOpen: () => void;
  safeTop: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Header */}
      <View style={[styles.scanHeader, { paddingTop: safeTop + 10 }]}>
        <Text style={styles.scanBrand}>
          <Text style={styles.brandK}>K</Text>larity
        </Text>
        <Pressable style={styles.searchPill} onPress={onSearchOpen} hitSlop={12}>
          <Text style={styles.searchPillText}>Search</Text>
        </Pressable>
      </View>

      {/* Permission prompt */}
      {permission && !permission.granted && (
        <View style={styles.permissionBox} pointerEvents="box-none">
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Klarity needs your camera to scan barcodes.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission} pointerEvents="auto">
            <Text style={styles.permissionBtnText}>Enable camera</Text>
          </Pressable>
        </View>
      )}

      {/* Viewfinder */}
      {permission?.granted && (
        <View style={styles.viewfinderWrapper} pointerEvents="none">
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scanHint}>Point at a barcode</Text>
        </View>
      )}

      {/* Scan in-progress overlay */}
      {scanning && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7fd3aa" />
          <Text style={styles.loadingText}>Looking up product…</Text>
        </View>
      )}
    </View>
  );
}

// ── Search overlay — white full-screen, header in normal flow ─────────────────

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; results: OFFSearchProduct[] };

function SearchOverlay({
  onClose,
  safeTop,
  safeBottom,
}: {
  onClose: () => void;
  safeTop: number;
  safeBottom: number;
}) {
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
    <View style={styles.searchOverlay}>
      {/* Header is in normal document flow — input falls naturally below it */}
      <View style={[styles.searchHeader, { paddingTop: safeTop + 10 }]}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Scan</Text>
        </Pressable>
        <Text style={styles.searchHeaderBrand}>
          <Text style={styles.brandK}>K</Text>larity
        </Text>
        <View style={styles.backBtnSpacer} />
      </View>

      {/* Search input — directly below header, no manual offset needed */}
      <View style={styles.searchInputWrap}>
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
          <ActivityIndicator color="#1f9d6b" size="large" />
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>Search failed — check your connection</Text>
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
          contentContainerStyle={{ paddingBottom: safeBottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <SearchResultRow product={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ── Search result row ─────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { bg: '#e8f7ef', fg: '#1f9d6b' },
  { bg: '#fdf3e3', fg: '#c8821a' },
  { bg: '#efecfb', fg: '#6b5bd2' },
  { bg: '#e8f0fe', fg: '#3d6bcc' },
  { bg: '#fce8e8', fg: '#c04a4a' },
];

function SearchResultRow({ product }: { product: OFFSearchProduct }) {
  const brand = product.brands?.split(',')[0].trim();
  const initial = (product.product_name?.[0] ?? '?').toUpperCase();
  const color = AVATAR_PALETTE[initial.charCodeAt(0) % AVATAR_PALETTE.length];

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
      onPress={() => router.push(`/result/${encodeURIComponent(product.code)}`)}>
      <View style={[styles.resultAvatar, { backgroundColor: color.bg }]}>
        <Text style={[styles.resultAvatarText, { color: color.fg }]}>{initial}</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>{product.product_name}</Text>
        {brand ? <Text style={styles.resultBrand}>{brand}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CORNER = 26;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1116',
  },

  // ── Scan overlay ──────────────────────────────────────────────────────────

  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: 'rgba(14,17,22,0.62)',
  },
  scanBrand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  brandK: { color: '#7fd3aa' },
  searchPill: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  viewfinderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  viewfinder: { width: 280, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#7fd3aa' },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: 4 },
  scanHint: { color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: 0.3 },

  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  permissionBody: { fontSize: 14, color: '#9fadbf', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  permissionBtn: { backgroundColor: '#1f9d6b', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(14,17,22,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  loadingText: { color: '#cdd6e3', fontSize: 15 },

  // ── Search overlay ────────────────────────────────────────────────────────

  searchOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#f6f8fa',
  },
  searchHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dde4ee',
  },
  backBtn: { width: 68 },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#1f9d6b' },
  backBtnSpacer: { width: 68 },
  searchHeaderBrand: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1f29',
    letterSpacing: -0.5,
  },

  searchInputWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dde4ee',
  },
  searchInput: {
    height: 48,
    backgroundColor: '#f1f4f8',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1f29',
  },

  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  searchEmptyText: {
    fontSize: 14,
    color: '#9fadbf',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  // Results
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    gap: 13,
    minHeight: 68,
  },
  resultRowPressed: { backgroundColor: '#f3f6f9' },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  resultAvatarText: { fontSize: 18, fontWeight: '800' },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#1a1f29', lineHeight: 19 },
  resultBrand: { fontSize: 12, color: '#8896a7', lineHeight: 16 },
  chevron: { color: '#bec9d4', fontSize: 20 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e4eaf2',
    marginLeft: 71,
  },
});
