import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
    marginBottom: 16,
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
    backgroundColor: '#D1D5DB',
  },
  verticalLine: {
    position: 'absolute',
    top: 30,
    bottom: -16,
    left: 0,
    width: 2,
    backgroundColor: '#D1D5DB',
  },
  positionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  positionCardInactive: {
    opacity: 0.6,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  positionInfo: {
    flex: 1,
    marginRight: 12,
  },
  positionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  positionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  positionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#DC2626',
  },
  positionCode: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  positionDescription: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  actionButtonDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  actionButtonTextDanger: {
    color: '#DC2626',
  },
  childrenContainer: {
    marginTop: 16,
    marginLeft: 20,
  },
});

export default OrganizationTreeView;
