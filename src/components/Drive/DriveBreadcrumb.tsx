import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

export interface BreadcrumbItem {
  id: string | null; // null => raíz del espacio
  name: string;
}

interface Props {
  items: BreadcrumbItem[];
  onNavigate: (item: BreadcrumbItem, index: number) => void;
}

export const DriveBreadcrumb: React.FC<Props> = ({ items, onNavigate }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <View key={`${item.id ?? 'root'}-${i}`} style={styles.row}>
            <TouchableOpacity
              onPress={() => onNavigate(item, i)}
              disabled={isLast}
              activeOpacity={activeOpacity.medium}
              style={styles.crumb}
            >
              <Text
                variant={isLast ? 'bodyMedium' : 'bodySmall'}
                color={isLast ? theme.color.text.heading : theme.color.text.body}
                numberOfLines={1}
                style={isLast ? styles.currentLabel : styles.label}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
            {!isLast && (
              <Ionicons
                name="chevron-forward"
                size={iconSizes.sm}
                color={theme.color.icon.subtle}
                style={styles.sep}
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      alignItems: 'center',
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2],
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    crumb: {
      paddingHorizontal: theme.space[1],
      paddingVertical: 2,
      maxWidth: 200,
    },
    label: {},
    currentLabel: {
      fontWeight: '600',
    },
    sep: {
      marginHorizontal: 2,
    },
  });

export default DriveBreadcrumb;
