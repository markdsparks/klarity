import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CONDITIONS } from '@/data/conditions';
import { useProfile } from '@/hooks/use-profile';
import type { ProfileValues } from '@/types/index';

const VALUES_OPTIONS: { value: ProfileValues; label: string; hint: string }[] = [
  {
    value: 'balanced',
    label: 'Balanced',
    hint: 'Contested additives stay contested — both sides shown, no lean.',
  },
  {
    value: 'precaution',
    label: 'Precaution-leaning',
    hint: 'When regulators genuinely disagree, treat it as “sometimes”.',
  },
  {
    value: 'risk',
    label: 'Risk-tolerant',
    hint: 'When regulators genuinely disagree, treat it as “everyday”.',
  },
];

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useProfile();

  function selectValues(values: ProfileValues) {
    setProfile({ ...profile, values });
  }

  function toggleCondition(id: string) {
    const conditions = profile.conditions.includes(id)
      ? profile.conditions.filter(c => c !== id)
      : [...profile.conditions, id];
    setProfile({ ...profile, conditions });
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, {
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 48,
      }]}
      showsVerticalScrollIndicator={false}>

      <Text style={styles.title}>You</Text>
      <Text style={styles.subtitle}>
        Your profile shifts how genuinely contested calls resolve and adds context
        for your situation. It never overrides the evidence.
      </Text>

      {/* Values */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>When the science is split</Text>
        {VALUES_OPTIONS.map((opt, i) => {
          const selected = profile.values === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.optionRow, i > 0 && styles.optionBorder]}
              onPress={() => selectValues(opt.value)}>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionHint}>{opt.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Conditions */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Anything that applies to you?</Text>
        {CONDITIONS.map((cond, i) => {
          const selected = profile.conditions.includes(cond.id);
          return (
            <Pressable
              key={cond.id}
              style={[styles.optionRow, i > 0 && styles.optionBorder]}
              onPress={() => toggleCondition(cond.id)}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {cond.label}
                </Text>
                <Text style={styles.optionHint}>{cond.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.footer}>
        Klarity never changes an “everyday” or “sometimes” verdict to match your
        values — evidence sets those. Everything here stays on this device.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1, backgroundColor: '#f6f8fa' },
  content: { paddingHorizontal: 16, gap: 12 },

  title:    { fontSize: 28, fontWeight: '800', color: '#1a1f29', letterSpacing: -0.5, paddingHorizontal: 4 },
  subtitle: { fontSize: 13.5, color: '#8896a7', lineHeight: 19, paddingHorizontal: 4, marginBottom: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e7ebf0',
  },
  cardLabel: {
    fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7,
    textTransform: 'uppercase', color: '#9fadbf', marginBottom: 6,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
  },
  optionBorder: { borderTopWidth: 1, borderTopColor: '#f1f4f8' },
  optionInfo:   { flex: 1, gap: 3 },
  optionLabel:  { fontSize: 15, fontWeight: '600', color: '#1a1f29' },
  optionLabelSelected: { fontWeight: '700' },
  optionHint:   { fontSize: 12.5, color: '#8896a7', lineHeight: 17 },

  radio: {
    width: 22, height: 22, borderRadius: 11, marginTop: 1,
    borderWidth: 2, borderColor: '#d0d8e4',
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#1f9d6b' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1f9d6b' },

  checkbox: {
    width: 22, height: 22, borderRadius: 7, marginTop: 1,
    borderWidth: 2, borderColor: '#d0d8e4',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { borderColor: '#1f9d6b', backgroundColor: '#1f9d6b' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 15 },

  footer: {
    fontSize: 12, color: '#9fadbf', lineHeight: 18,
    paddingHorizontal: 4, marginTop: 4,
  },
});
