import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Phase 3: history of scanned products. Placeholder for now.
export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.body}>Your scanned products will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1f29',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    color: '#5b6675',
    textAlign: 'center',
  },
});
