import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/hooks/use-profile';
import { searchProducts } from '@/services/off';
import { enrichSearchResults, type EnrichedSearchProduct } from '@/services/product-search';
import { menuItemGlance, searchRestaurant, type MenuHit } from '@/services/restaurant-search';
import { CHAINS } from '@/data/restaurants';
import type { MenuItem, RestaurantChain } from '@/types/restaurant';
import type { AdditiveGlanceKey } from '@/types/history';
import type { NutritionTone } from '@/types/index';
import type { OFFSearchProduct } from '@/types/off';

const PROFILE_HINT_KEY = 'KLARITY_PROFILE_HINT_DISMISSED_V1';

type Mode = 'scan' | 'search';

const SCAN_COOLDOWN_MS = 2000;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scan');
  const [scanning, setScanning] = useState(false);
  const lastScanAt = useRef(0);
  const insets = useSafeAreaInsets();

  // One-time hint pointing at the You tab — only while the profile is untouched
  const { profile, loaded: profileLoaded } = useProfile();
  const [hintDismissed, setHintDismissed] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_HINT_KEY)
      .then(v => setHintDismissed(v === '1'))
      .catch(() => {});
  }, []);
  const profileUntouched = profile.values === 'balanced' && profile.conditions.length === 0;
  const showProfileHint = profileLoaded && profileUntouched && !hintDismissed && mode === 'scan';

  function dismissHint() {
    setHintDismissed(true);
    AsyncStorage.setItem(PROFILE_HINT_KEY, '1').catch(() => {});
  }

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
          profileHint={showProfileHint ? { onDismiss: dismissHint } : null}
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
  profileHint,
}: {
  permission: { granted: boolean } | null;
  requestPermission: () => unknown;
  scanning: boolean;
  onSearchOpen: () => void;
  safeTop: number;
  profileHint: { onDismiss: () => void } | null;
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

      {/* Profile setup hint */}
      {profileHint && (
        <View style={styles.profileHint}>
          <Pressable
            style={styles.profileHintBody}
            onPress={() => router.push('/you')}
            hitSlop={6}>
            <Text style={styles.profileHintText}>
              Make verdicts yours — set up your profile →
            </Text>
          </Pressable>
          <Pressable onPress={profileHint.onDismiss} hitSlop={12}>
            <Text style={styles.profileHintClose}>✕</Text>
          </Pressable>
        </View>
      )}

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
  | { status: 'loading'; suggestion?: RestaurantChain }
  | { status: 'error'; suggestion?: RestaurantChain }
  | { status: 'done'; results: EnrichedSearchProduct[]; suggestion?: RestaurantChain }
  | { status: 'menu'; chain: RestaurantChain; hits: MenuHit[]; filtered: boolean };

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
  // Escape hatch (spec 006 Q2): chain-owned results until the user explicitly
  // asks for packaged goods; reset when the box is cleared.
  const [forceOFF, setForceOFF] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChangeText(text: string) {
    setQuery(text);
    runQuery(text, forceOFF);
  }

  // Restaurant interpretation is local and synchronous — the menu narrows on
  // every keystroke with no debounce (spec 006: one list that narrows, never
  // snaps). Only the OFF network search debounces.
  function runQuery(text: string, off: boolean) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = text.trim();
    if (!q) {
      setState({ status: 'idle' });
      setForceOFF(false);
      return;
    }

    const restaurant = off ? ({ kind: 'none' } as const) : searchRestaurant(q);
    if (restaurant.kind === 'menu') {
      setState({
        status: 'menu',
        chain: restaurant.chain,
        hits: restaurant.hits,
        filtered: restaurant.filtered,
      });
      return;
    }
    const suggestion = restaurant.kind === 'suggestion' ? restaurant.chain : undefined;
    setState({ status: 'loading', suggestion });
    debounceRef.current = setTimeout(() => runOFFSearch(q, suggestion), 500);
  }

  async function runOFFSearch(q: string, suggestion?: RestaurantChain) {
    try {
      const hits = await searchProducts(q);
      // Spec 017 — prefer USDA-verified results: OFF's search index is
      // crowdsourced and can be messy; USDA Branded (already trusted for the
      // single-product detail path) is cleaner where it has a match. Never
      // throws (enrichSearchResults degrades a failed check to unverified),
      // so this can't turn a working OFF search into an error state.
      const results = await enrichSearchResults(hits);
      setState({ status: 'done', results, suggestion });
    } catch {
      // A dead network must not eat the local suggestion — restaurant data is offline.
      setState({ status: 'error', suggestion });
    }
  }

  function browseChain(chain: RestaurantChain) {
    setForceOFF(false);
    setQuery(chain.name);
    runQuery(chain.name, false);
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

      {/* Search input — directly below header, no manual offset needed.
          Deliberately no autoFocus: the idle state below offers zero-typing
          chain browsing, and the keyboard popping up immediately covered
          those chips before the user had said they wanted to type anything.
          Tapping the field still brings the keyboard up when they do. */}
      <View style={styles.searchInputWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products…"
          placeholderTextColor="#9fadbf"
          value={query}
          onChangeText={onChangeText}
          returnKeyType="search"
          onSubmitEditing={() => query.trim() && runQuery(query, forceOFF)}
          clearButtonMode="while-editing"
        />
      </View>

      {/* States. Every searchEmpty state renders through a ScrollView, not a
          plain View, purely for keyboardShouldPersistTaps + onScrollBeginDrag
          — the keyboard can still be up here (e.g. typed, got zero results,
          wants to dismiss to read the message or tap a chain chip) and a
          plain View has no way to dismiss it short of the input's own return
          key. Same pattern as the bottom sheets (ADR-005) — a tap on
          non-interactive content dismisses, a tap on a real Pressable (the
          chain chips) still fires normally. */}
      {state.status === 'idle' && (
        <ScrollView
          style={styles.searchEmptyScroll}
          contentContainerStyle={styles.searchEmptyContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}>
          <Text style={styles.searchEmptyText}>Type a product name to search</Text>
          <Text style={styles.browseLabel}>or browse a menu</Text>
          <View style={styles.chainChips}>
            {CHAINS.map(chain => (
              <Pressable
                key={chain.id}
                style={styles.chainChip}
                onPress={() => browseChain(chain)}>
                <Text style={styles.chainChipText}>{chain.name}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Chain suggestion — rides above OFF results (or their absence), never replaced */}
      {(state.status === 'loading' || state.status === 'done' || state.status === 'error') &&
        state.suggestion && (
          <ChainSuggestionRow chain={state.suggestion} onBrowse={browseChain} />
        )}

      {state.status === 'loading' && (
        <View style={styles.searchEmpty}>
          <ActivityIndicator color="#1f9d6b" size="large" />
        </View>
      )}

      {state.status === 'error' && (
        <ScrollView
          style={styles.searchEmptyScroll}
          contentContainerStyle={styles.searchEmptyContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}>
          <Text style={styles.searchEmptyText}>Search failed — check your connection</Text>
        </ScrollView>
      )}

      {state.status === 'done' && state.results.length === 0 && (
        <ScrollView
          style={styles.searchEmptyScroll}
          contentContainerStyle={styles.searchEmptyContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}>
          <Text style={styles.searchEmptyText}>No products found for "{query}"</Text>
        </ScrollView>
      )}

      {state.status === 'menu' && (
        <MenuBrowser
          chain={state.chain}
          hits={state.hits}
          filtered={state.filtered}
          query={query}
          onEscape={() => {
            setForceOFF(true);
            runQuery(query, true);
          }}
          safeBottom={safeBottom}
        />
      )}

      {state.status === 'done' && state.results.length > 0 && (
        <FlatList
          data={state.results}
          keyExtractor={r => r.product.code}
          contentContainerStyle={{ paddingBottom: safeBottom + 20 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <SearchResultRow product={item.product} usdaVerified={item.usdaVerified} />}
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

// ── Menu browser (spec 006) ───────────────────────────────────────────────────

const MENU_ADDITIVE_STYLE: Record<AdditiveGlanceKey, { bg: string; fg: string; label: string }> = {
  everyday:  { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday'     },
  sometimes: { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes'    },
  contested: { bg: '#efecfb', fg: '#6b5bd2', label: 'Contested'    },
  clean:     { bg: '#e8f7ef', fg: '#1f9d6b', label: 'No additives' },
  unrated:   { bg: '#f1f4f8', fg: '#9fadbf', label: 'Not rated'    },
};

// Unified behavioral ladder (spec 013). Light pills: green → amber → deep orange.
const MENU_NUTRITION_STYLE: Record<NutritionTone, { bg: string; fg: string; label: string }> = {
  good: { bg: '#e8f7ef', fg: '#1f9d6b', label: 'Everyday'     },
  ok:   { bg: '#fdf3e3', fg: '#c8821a', label: 'Sometimes'    },
  warn: { bg: '#fbe7db', fg: '#c2410c', label: 'Occasionally' },
};

// Menu data is static, so standard-build glances are computed once per item.
const glanceCache = new Map<string, ReturnType<typeof menuItemGlance>>();
function glanceFor(item: MenuItem) {
  let g = glanceCache.get(item.id);
  if (!g) {
    g = menuItemGlance(item);
    glanceCache.set(item.id, g);
  }
  return g;
}

// Partial chain typed ("chick") — tappable, above OFF results, never a hijack.
function ChainSuggestionRow({
  chain,
  onBrowse,
}: {
  chain: RestaurantChain;
  onBrowse: (chain: RestaurantChain) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, styles.suggestionRow, pressed && styles.resultRowPressed]}
      onPress={() => onBrowse(chain)}>
      <View style={[styles.resultAvatar, { backgroundColor: '#e8f7ef' }]}>
        <Text style={[styles.resultAvatarText, { color: '#1f9d6b' }]}>
          {chain.name[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{chain.name}</Text>
        <Text style={styles.resultBrand}>Restaurant · browse the menu</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function MenuBrowser({
  chain,
  hits,
  filtered,
  query,
  onEscape,
  safeBottom,
}: {
  chain: RestaurantChain;
  hits: MenuHit[];
  filtered: boolean;
  query: string;
  onEscape: () => void;
  safeBottom: number;
}) {
  const escapeHatch = (
    <Pressable style={styles.escapeHatch} onPress={onEscape}>
      <Text style={styles.escapeHatchText}>
        Search packaged products for “{query.trim()}” instead →
      </Text>
    </Pressable>
  );

  // Filtered results are ranked — a flat list keeps the best match on top.
  // The full menu browses better grouped by category.
  if (filtered) {
    return (
      <FlatList
        data={hits}
        keyExtractor={h => h.item.id}
        contentContainerStyle={{ paddingBottom: safeBottom + 20 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text style={styles.menuHeader}>{chain.name}</Text>}
        ListFooterComponent={escapeHatch}
        renderItem={({ item }) => <MenuItemRow hit={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    );
  }

  const sections: { title: string; data: MenuHit[] }[] = [];
  for (const hit of hits) {
    const last = sections[sections.length - 1];
    if (last && last.title === hit.item.category) last.data.push(hit);
    else sections.push({ title: hit.item.category, data: [hit] });
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={h => h.item.id}
      contentContainerStyle={{ paddingBottom: safeBottom + 20 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<Text style={styles.menuHeader}>{chain.name} menu</Text>}
      ListFooterComponent={escapeHatch}
      renderSectionHeader={({ section }) => (
        <Text style={styles.menuSectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => <MenuItemRow hit={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      stickySectionHeadersEnabled={false}
    />
  );
}

function MenuItemRow({ hit }: { hit: MenuHit }) {
  const { item, removedIds } = hit;
  const glance = glanceFor(item);
  const removed = item.components.filter(c => removedIds.includes(c.id));
  const as = MENU_ADDITIVE_STYLE[glance.additiveGlance];
  const ns = MENU_NUTRITION_STYLE[glance.nutritionTone];

  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && styles.resultRowPressed]}
      onPress={() => router.push({
        pathname: '/result/restaurant',
        params: { item: item.id, ...(removedIds.length ? { remove: removedIds.join(',') } : {}) },
      })}>
      <View style={[styles.resultAvatar, { backgroundColor: '#e8f7ef' }]}>
        <Text style={[styles.resultAvatarText, { color: '#1f9d6b' }]}>
          {item.name[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.resultBrand}>{item.nutrition.calories} cal · {item.serving}</Text>
        {removed.length > 0 && (
          <Text style={styles.menuRemoval}>
            – {removed.map(c => c.name).join('  – ')}
          </Text>
        )}
        <View style={styles.menuPills}>
          <View style={[styles.menuPill, { backgroundColor: as.bg }]}>
            <Text style={[styles.menuPillText, { color: as.fg }]}>{as.label}</Text>
          </View>
          <View style={[styles.menuPill, { backgroundColor: ns.bg }]}>
            <Text style={[styles.menuPillText, { color: ns.fg }]}>{ns.label}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SearchResultRow({ product, usdaVerified }: { product: OFFSearchProduct; usdaVerified?: boolean }) {
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
        <View style={styles.resultNameRow}>
          <Text style={[styles.resultName, { flexShrink: 1 }]} numberOfLines={2}>{product.product_name}</Text>
          {/* Spec 017 — deliberately more prominent than the detail screen's
              demoted provenance text (spec 016): here, surfacing the trusted
              source IS the feature, front and center while picking a result,
              not a footnote after committing to one. Reuses the same blue
              "informational, not a verdict" pill language as the additive
              axis's "Regulatory status" pill, so it doesn't read as a
              green/amber/red judgment. */}
          {usdaVerified && (
            <View style={styles.usdaPill}>
              <Text style={styles.usdaPillText}>USDA</Text>
            </View>
          )}
        </View>
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

  profileHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(31,157,107,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(127,211,170,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  profileHintBody: { flex: 1 },
  profileHintText: { color: '#7fd3aa', fontSize: 13, fontWeight: '600' },
  profileHintClose: { color: 'rgba(127,211,170,0.7)', fontSize: 13, fontWeight: '700' },

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

  // Used directly as a plain View's style (the loading spinner state, which
  // has no keyboard-dismiss need). The ScrollView variants below use
  // searchEmptyScroll for their own `style` instead — RN Web enforces (and
  // native RN expects) that a ScrollView's alignItems/justifyContent live in
  // contentContainerStyle, not its outer style, so this can't be reused as
  // that outer style directly.
  searchEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  searchEmptyScroll: {
    flex: 1,
  },
  // contentContainerStyle for the ScrollView variants of searchEmpty above —
  // flexGrow (not flex) is what lets short content still center vertically
  // inside a ScrollView's content container.
  searchEmptyContent: {
    flexGrow: 1,
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
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { fontSize: 14, fontWeight: '700', color: '#1a1f29', lineHeight: 19 },
  resultBrand: { fontSize: 12, color: '#8896a7', lineHeight: 16 },
  usdaPill:     { backgroundColor: '#e8f0fe', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  usdaPillText: { fontSize: 9, fontWeight: '800', color: '#3d6bcc', letterSpacing: 0.5 },
  chevron: { color: '#bec9d4', fontSize: 20 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e4eaf2',
    marginLeft: 71,
  },
  menuHeader: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#8896a7',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  menuSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#b0bcc9',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    backgroundColor: '#f6f8fa',
  },
  menuPills: { flexDirection: 'row', gap: 6, marginTop: 3 },
  menuPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  menuPillText: { fontSize: 10.5, fontWeight: '800' },
  menuRemoval: { fontSize: 12, fontWeight: '600', color: '#c8821a' },

  suggestionRow: {
    marginTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dde4ee',
  },
  escapeHatch: { paddingHorizontal: 20, paddingVertical: 18 },
  escapeHatchText: { fontSize: 13, fontWeight: '600', color: '#1f9d6b' },

  browseLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#b0bcc9',
    marginTop: 22,
    marginBottom: 10,
  },
  chainChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 32 },
  chainChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dde4ee',
    borderRadius: 99,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chainChipText: { fontSize: 13, fontWeight: '700', color: '#1a1f29' },
});
