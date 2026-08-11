import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { PositionTreeNode } from '@/types/organization';

interface OrganizationTreeViewProps {
  data: PositionTreeNode[];
  onPositionPress: (position: PositionTreeNode) => void;
  onEditPress: (position: PositionTreeNode) => void;
  onDeletePress: (position: PositionTreeNode) => void;
  onCreateChild: (parent: PositionTreeNode) => void;
  level?: number;
}

export const OrganizationTreeView: React.FC<OrganizationTreeViewProps> = ({
  data,
  onPositionPress,
  onEditPress,
  onDeletePress,
  onCreateChild,
  level = 0,
}) => {
  const styles = useThemedStyles(createStyles);
  const renderPosition = (position: PositionTreeNode, index: number) => {
    const hasChildren = position.children && position.children.length > 0;
    const isActive = position.isActive !== false;

    return (
      <View key={position.id} style={styles.positionContainer}>
        {/* Connector Line */}
        {level > 0 && (
          <View style={styles.connectorContainer}>
            <View style={styles.horizontalLine} />
            {index < data.length - 1 && <View style={styles.verticalLine} />}
          </View>
        )}

        {/* Position Card */}
        <TouchableOpacity
          style={[
            styles.positionCard,
            !isActive && styles.positionCardInactive,
            { marginLeft: level * 20 },
          ]}
          onPress={() => onPositionPress(position)}
          activeOpacity={0.7}
        >
          <View style={styles.positionHeader}>
            <View style={styles.positionInfo}>
              <View style={styles.positionTitleRow}>
                <Text style={styles.positionIcon}>
                  {position.scopeLevel === 'COMPANY' ? '🏢' : '🏪'}
                </Text>
                <Text style={styles.positionName} numberOfLines={1}>
                  {position.name}
                </Text>
                {!isActive && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                  </View>
                )}
              </View>
              <Text style={styles.positionCode}>{position.code}</Text>
              {position.description && (
                <Text style={styles.positionDescription} numberOfLines={2}>
                  {position.description}
                </Text>
              )}
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Nivel</Text>
                <Text style={styles.statValue}>{position.level}</Text>
              </View>
              {position.maxOccupants !== null && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Máx</Text>
                  <Text style={styles.statValue}>{position.maxOccupants}</Text>
                </View>
              )}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Mín</Text>
                <Text style={styles.statValue}>{position.minOccupants}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onCreateChild(position);
              }}
            >
              <Text style={styles.actionButtonText}>➕ Agregar hijo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={(e) => {
                e.stopPropagation();
                onEditPress(position);
              }}
            >
              <Text style={styles.actionButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={(e) => {
                e.stopPropagation();
                onDeletePress(position);
              }}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                🗑️ Eliminar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Children */}
        {hasChildren && (
          <View style={styles.childrenContainer}>
            <OrganizationTreeView
              data={position.children!}
              onPositionPress={onPositionPress}
              onEditPress={onEditPress}
              onDeletePress={onDeletePress}
              onCreateChild={onCreateChild}
              level={level + 1}
            />
          </View>
        )}
      </View>
    );
  };

  return <View style={styles.container}>{data.map(renderPosition)}</View>;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    positionContainer: {
      marginBottom: theme.space[4],
      position: 'relative',
    },
    connectorContainer: {
      position: 'absolute',
      left: -20,
      top: 0,
      bottom: 0,
      width: 20,
    },
    horizontalLine: {
      position: 'absolute',
      top: 30,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: theme.color.border.default,
    },
    verticalLine: {
      position: 'absolute',
      top: 30,
      bottom: -16,
      left: 0,
      width: 2,
      backgroundColor: theme.color.border.default,
    },
    positionCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    positionCardInactive: {
      opacity: 0.6,
      borderColor: theme.color.border.default,
      borderStyle: 'dashed',
    },
    positionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.space[3],
    },
    positionInfo: {
      flex: 1,
      marginRight: theme.space[3],
    },
    positionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
      flexWrap: 'wrap',
    },
    positionIcon: {
      fontSize: 20,
      marginRight: theme.space[2],
    },
    positionName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      flex: 1,
    },
    inactiveBadge: {
      backgroundColor: theme.color.state.danger.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[0.5],
      borderRadius: theme.radii.sm,
      marginLeft: theme.space[2],
    },
    inactiveBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.danger,
    },
    positionCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    positionDescription: {
      fontSize: 14,
      color: theme.color.text.body,
      marginTop: theme.space[1],
    },
    statsContainer: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    statItem: {
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.md,
      minWidth: 40,
    },
    statLabel: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginBottom: theme.space[0.5],
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: theme.space[2],
      flexWrap: 'wrap',
    },
    actionButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
    },
    actionButtonDanger: {
      backgroundColor: theme.color.state.danger.background,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    actionButtonTextDanger: {
      color: theme.color.text.danger,
    },
    childrenContainer: {
      marginTop: theme.space[4],
      marginLeft: theme.space[5],
    },
  });

export default OrganizationTreeView;
