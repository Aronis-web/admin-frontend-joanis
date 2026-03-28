import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  positionContainer: {
    marginBottom: spacing[4],
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
    backgroundColor: colors.neutral[300],
  },
  verticalLine: {
    position: 'absolute',
    top: 30,
    bottom: -16,
    left: 0,
    width: 2,
    backgroundColor: colors.neutral[300],
  },
  positionCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  positionCardInactive: {
    opacity: 0.6,
    borderColor: colors.neutral[300],
    borderStyle: 'dashed',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  positionInfo: {
    flex: 1,
    marginRight: spacing[3],
  },
  positionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  positionIcon: {
    fontSize: 20,
    marginRight: spacing[2],
  },
  positionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[900],
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: colors.danger[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.sm,
    marginLeft: spacing[2],
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.danger[600],
  },
  positionCode: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  positionDescription: {
    fontSize: 14,
    color: colors.neutral[700],
    marginTop: spacing[1],
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    minWidth: 40,
  },
  statLabel: {
    fontSize: 10,
    color: colors.neutral[500],
    marginBottom: spacing[0.5],
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.neutral[900],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[100],
  },
  actionButtonDanger: {
    backgroundColor: colors.danger[100],
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  actionButtonTextDanger: {
    color: colors.danger[600],
  },
  childrenContainer: {
    marginTop: spacing[4],
    marginLeft: spacing[5],
  },
});

export default OrganizationTreeView;
