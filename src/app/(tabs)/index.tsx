import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCAN_COOLDOWN_MS = 2000;

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const lastScanAt = useRef(0);
  const insets = useSafeAreaInsets();

  function handleBarcode({ data }: { data: string }) {
    const now = Date.now();
    if (scanning || now - lastScanAt.current < SCAN_COOLDOWN_MS) return;
    lastScanAt.current = now;
    setScanning(true);
    router.push(`/result/${encodeURIComponent(data)}`);
    // Reset after navigation settles
    setTimeout(() => setScanning(false), SCAN_COOLDOWN_MS);
  }

  // ── Permission not yet determined ──
  if (!permission) {
    return <View style={styles.container} />;
  }

  // ── Permission denied ──
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Klarity needs your camera to scan barcodes.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Enable camera</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Camera ready ──
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
        }}
        onBarcodeScanned={scanning ? undefined : handleBarcode}
      />

      {/* Top branding */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.brand}>
          <Text style={styles.brandGreen}>K</Text>larity
        </Text>
        <Text style={styles.brandSub}>Point at a barcode to scan</Text>
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinderWrapper} pointerEvents="none">
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* Loading overlay */}
      {scanning && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7fd3aa" />
          <Text style={styles.loadingText}>Looking up product…</Text>
        </View>
      )}
    </View>
  );
}

const CORNER = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1116',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: 'rgba(14,17,22,0.55)',
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  brandGreen: { color: '#7fd3aa' },
  brandSub: {
    marginTop: 3,
    fontSize: 13,
    color: '#9fadbf',
  },
  viewfinderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 260,
    height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#7fd3aa',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14,17,22,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#cdd6e3',
    fontSize: 15,
  },
  permissionBox: {
    margin: 32,
    padding: 28,
    backgroundColor: '#fff',
    borderRadius: 20,
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1f29',
  },
  permissionBody: {
    fontSize: 14,
    color: '#5b6675',
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionBtn: {
    marginTop: 8,
    backgroundColor: '#1f9d6b',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
