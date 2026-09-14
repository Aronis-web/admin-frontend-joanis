import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ChipGroup } from '@/design-system';

export interface PayrollTabItem<K extends string = string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  tabs: PayrollTabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

/**
 * Barra de tabs simple para pantallas Payroll (usa ChipGroup single-select).
 */
export function PayrollTabs<K extends string>({ tabs, active, onChange }: Props<K>) {
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChipGroup
          options={tabs.map((t) => ({ label: t.label, value: t.key }))}
          selected={[active]}
          onChange={(sel) => {
            const next = sel[0] as K | undefined;
            if (next) onChange(next);
          }}
          variant="filled"
          size="small"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
});
