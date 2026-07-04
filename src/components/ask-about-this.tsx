import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { askAboutProduct, isQAAvailable, type AskContext } from '@/services/qa/ask';

// Spec 014 M2 — "Ask about this," mounted inside the existing evidence sheets
// (ExplainerSheet, VerdictExplainerSheet — spec 013). Renders NOTHING until
// availability is confirmed, and stays hidden permanently if it's false —
// that's the whole graceful-fallback story: on a device/runtime that can't
// run the on-device model (pre-iOS 26, no Apple Intelligence, Expo Go, web),
// this component is invisible and the sheet behaves exactly as it did before
// this feature existed. No error banner, no "unsupported" message — just absent.

type State =
  | { phase: 'checking' }
  | { phase: 'hidden' }
  | { phase: 'idle' }
  | { phase: 'asking' }
  | { phase: 'answered'; text: string; debug?: string }
  | { phase: 'error' };

export function AskAboutThis({ context }: { context: AskContext }) {
  const [state, setState] = useState<State>({ phase: 'checking' });
  const [question, setQuestion] = useState('');

  useEffect(() => {
    let cancelled = false;
    isQAAvailable().then(available => {
      if (!cancelled) setState({ phase: available ? 'idle' : 'hidden' });
    });
    return () => { cancelled = true; };
  }, []);

  if (state.phase === 'checking' || state.phase === 'hidden') return null;

  async function submit() {
    const q = question.trim();
    if (!q) return;
    setState({ phase: 'asking' });
    try {
      const result = await askAboutProduct(q, context);
      setState({ phase: 'answered', text: result.text, debug: result.debug });
    } catch {
      setState({ phase: 'error' });
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionLabel}>Ask about this</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="e.g. what if I add flax seed?"
          placeholderTextColor="#9aa4b2"
          editable={state.phase !== 'asking'}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable
          style={({ pressed }) => [styles.askBtn, (pressed || state.phase === 'asking') && styles.askBtnPressed]}
          onPress={submit}
          disabled={state.phase === 'asking'}>
          {state.phase === 'asking'
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.askBtnText}>Ask</Text>}
        </Pressable>
      </View>

      {state.phase === 'answered' && (
        <View style={styles.answerBox}>
          <Text style={styles.answerText}>{state.text}</Text>
          {/* Temporary — spec 014 M2 on-device debugging, remove once verified */}
          {state.debug ? <Text style={styles.debugText}>DEBUG: {state.debug}</Text> : null}
        </View>
      )}
      {state.phase === 'error' && (
        <Text style={styles.errorText}>Couldn't get an answer just now — try again in a moment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22, gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#9aa4b2', textTransform: 'uppercase' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1, backgroundColor: '#f6f8fa', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#1a1f29',
  },
  askBtn: {
    backgroundColor: '#1f9d6b', borderRadius: 12, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center', minWidth: 60,
  },
  askBtnPressed: { opacity: 0.7 },
  askBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  answerBox: { backgroundColor: '#f0faf5', borderRadius: 12, borderWidth: 1, borderColor: '#c3e6d5', padding: 14 },
  answerText: { fontSize: 14, lineHeight: 20, color: '#1a1f29' },
  debugText: { fontSize: 10.5, color: '#9aa4b2', marginTop: 8, fontFamily: 'Menlo' },
  errorText: { fontSize: 12.5, color: '#c04a4a' },
});
