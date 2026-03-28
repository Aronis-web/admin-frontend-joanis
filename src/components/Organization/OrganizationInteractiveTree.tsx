import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { PositionTreeNode } from '@/types/organization';

interface OrganizationInteractiveTreeProps {
  data: PositionTreeNode[];
  onPositionPress: (position: PositionTreeNode) => void;
  onEditPress: (position: PositionTreeNode) => void;
  onDeletePress: (position: PositionTreeNode) => void;
  onCreateChild: (parent: PositionTreeNode) => void;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 200;
const CARD_HEIGHT = 70;
const HORIZONTAL_SPACING = 30;
const VERTICAL_SPACING = 80;

export const OrganizationInteractiveTree: React.FC<OrganizationInteractiveTreeProps> = ({
  data,
  onPositionPress,
  onEditPress,
  onDeletePress,
  onCreateChild,
}) => {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    const newCollapsed = new Set(collapsedNodes);
    if (newCollapsed.has(nodeId)) {
      newCollapsed.delete(nodeId);
    } else {
      newCollapsed.add(nodeId);
    }
    setCollapsedNodes(newCollapsed);
  };

  // Calculate tree layout with improved algorithm
  const calculateLayout = (
    nodes: PositionTreeNode[],
    level: number = 0,
    startX: number = 0
  ): { positions: Map<string, NodePosition>; totalWidth: number } => {
    const positions = new Map<string, NodePosition>();

    if (nodes.length === 0) {
      return { positions, totalWidth: 0 };
    }

    let currentX = startX;

    nodes.forEach((node, nodeIndex) => {
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = collapsedNodes.has(node.id);
      const visibleChildren = hasChildren && !isCollapsed ? node.children! : [];

      let subtreeWidth = CARD_WIDTH;

      if (visibleChildren.length > 0) {
        // Calculate children layout first
        const childLayout = calculateLayout(visibleChildren, level + 1, 0);

        // Position children relative to current position
        let childStartX = currentX;
        let childCurrentX = 0;

        visibleChildren.forEach((child) => {
          const childPos = childLayout.positions.get(child.id);
          if (childPos) {
            positions.set(child.id, {
              ...childPos,
              x: childStartX + childPos.x,
              y: (level + 1) * (CARD_HEIGHT + VERTICAL_SPACING),
            });

            // Update positions of all descendants
            updateDescendantPositions(child, childLayout.positions, positions, childStartX, level + 1);
          }
        });

        subtreeWidth = childLayout.totalWidth;
      }

      // Center parent node above children
      const nodeX = currentX + Math.max(0, (subtreeWidth - CARD_WIDTH) / 2);

      positions.set(node.id, {
        x: nodeX,
        y: level * (CARD_HEIGHT + VERTICAL_SPACING),
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });

      currentX += Math.max(CARD_WIDTH, subtreeWidth);

      // Add spacing between siblings
      if (nodeIndex < nodes.length - 1) {
        currentX += HORIZONTAL_SPACING;
      }
    });

    const totalWidth = currentX - startX;
    return { positions, totalWidth };
  };

  const updateDescendantPositions = (
    node: PositionTreeNode,
    sourcePositions: Map<string, NodePosition>,
    targetPositions: Map<string, NodePosition>,
    offsetX: number,
    baseLevel: number
  ) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);

    if (hasChildren && !isCollapsed) {
      node.children!.forEach((child) => {
        const childPos = sourcePositions.get(child.id);
        if (childPos) {
          const currentPos = targetPositions.get(child.id);
          if (!currentPos) {
            targetPositions.set(child.id, {
              ...childPos,
              x: offsetX + childPos.x,
              y: childPos.y,
            });
          }
          updateDescendantPositions(child, sourcePositions, targetPositions, offsetX, baseLevel);
        }
      });
    }
  };

  const { positions, totalWidth } = calculateLayout(data);

  // Calculate total height
  let maxLevel = 0;
  positions.forEach((pos) => {
    const level = Math.floor(pos.y / (CARD_HEIGHT + VERTICAL_SPACING));
    maxLevel = Math.max(maxLevel, level);
  });
  const totalHeight = (maxLevel + 1) * (CARD_HEIGHT + VERTICAL_SPACING);

  // Render connections
  const renderConnections = () => {
    const lines: React.ReactElement[] = [];

    const processNode = (node: PositionTreeNode) => {
      const parentPos = positions.get(node.id);
      if (!parentPos) return;

      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = collapsedNodes.has(node.id);

      if (hasChildren && !isCollapsed) {
        const parentCenterX = parentPos.x + CARD_WIDTH / 2;
        const parentBottomY = parentPos.y + CARD_HEIGHT;

        node.children!.forEach((child) => {
          const childPos = positions.get(child.id);
          if (childPos) {
            const childCenterX = childPos.x + CARD_WIDTH / 2;
            const childTopY = childPos.y;

            // Vertical line from parent
            const midY = parentBottomY + VERTICAL_SPACING / 2;

            lines.push(
              <Line
                key={`v-${node.id}-${child.id}`}
                x1={parentCenterX}
                y1={parentBottomY}
                x2={parentCenterX}
                y2={midY}
                stroke={colors.neutral[400]}
                strokeWidth="2"
              />
            );

            // Horizontal line
            lines.push(
              <Line
                key={`h-${node.id}-${child.id}`}
                x1={parentCenterX}
                y1={midY}
                x2={childCenterX}
                y2={midY}
                stroke={colors.neutral[400]}
                strokeWidth="2"
              />
            );

            // Vertical line to child
            lines.push(
              <Line
                key={`vc-${node.id}-${child.id}`}
                x1={childCenterX}
                y1={midY}
                x2={childCenterX}
                y2={childTopY}
                stroke={colors.neutral[400]}
                strokeWidth="2"
              />
            );

            processNode(child);
          }
        });
      }
    };

    data.forEach(processNode);
    return lines;
  };

  // Render node card
  const renderNode = (node: PositionTreeNode) => {
    const pos = positions.get(node.id);
    if (!pos) return null;

    const hasChildren = node.children && node.children.length > 0;
    const isCollapsed = collapsedNodes.has(node.id);
    const isActive = node.isActive !== false;

    // Determine card color based on level
    const getCardColor = (level: number) => {
      const levelColors = [colors.primary[500], colors.success[500], '#8B5CF6', colors.warning[500], colors.danger[500]];
      return levelColors[(level - 1) % levelColors.length];
    };

    const cardColor = getCardColor(node.level);

    return (
      <View
        key={node.id}
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
        }}
      >
        <TouchableOpacity
          style={[
            styles.nodeCard,
            { backgroundColor: cardColor },
            !isActive && styles.nodeCardInactive,
          ]}
          onPress={() => onPositionPress(node)}
          activeOpacity={0.8}
          onLongPress={() => {
            // Show action menu on long press
          }}
        >
          {/* Avatar and Content */}
          <View style={styles.nodeContent}>
            {/* Avatar Circle */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {node.scopeLevel === 'COMPANY' ? '🏢' : '🏪'}
                </Text>
              </View>
            </View>

            {/* Text Content */}
            <View style={styles.textContent}>
              <Text style={styles.nodeName} numberOfLines={2}>
                {node.name}
              </Text>
              <Text style={styles.nodeCode} numberOfLines={1}>
                {node.code}
              </Text>
            </View>

            {/* Collapse Button */}
            {hasChildren && (
              <TouchableOpacity
                style={styles.collapseButtonInline}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleNode(node.id);
                }}
              >
                <Text style={styles.collapseIconInline}>
                  {isCollapsed ? '▶' : '▼'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Inactive Badge */}
          {!isActive && (
            <View style={styles.inactiveBadgeOverlay}>
              <Text style={styles.inactiveBadgeText}>Inactivo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Floating Action Menu */}
        <View style={styles.floatingActions}>
          <TouchableOpacity
            style={styles.floatingActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onCreateChild(node);
            }}
          >
            <Text style={styles.floatingActionIcon}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onEditPress(node);
            }}
          >
            <Text style={styles.floatingActionIcon}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.floatingActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onDeletePress(node);
            }}
          >
            <Text style={styles.floatingActionIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAllNodes = (nodes: PositionTreeNode[]) => {
    const result: React.ReactElement[] = [];

    const processNode = (node: PositionTreeNode) => {
      const nodeElement = renderNode(node);
      if (nodeElement) {
        result.push(nodeElement);
      }

      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = collapsedNodes.has(node.id);

      if (hasChildren && !isCollapsed) {
        node.children!.forEach(processNode);
      }
    };

    nodes.forEach(processNode);
    return result;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={true}
      style={styles.container}
      contentContainerStyle={{
        minWidth: totalWidth + 100,
        minHeight: totalHeight + 100,
        padding: 50,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <View style={{ width: totalWidth + 100, height: totalHeight + 100 }}>
          {/* SVG for connections */}
          <Svg
            width={totalWidth + 100}
            height={totalHeight + 100}
            style={StyleSheet.absoluteFill}
          >
            {renderConnections()}
          </Svg>

          {/* Nodes */}
          {renderAllNodes(data)}
        </View>
      </ScrollView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  nodeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'visible',
  },
  nodeCardInactive: {
    opacity: 0.5,
  },
  nodeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  avatarContainer: {
    marginRight: spacing[3],
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  avatarText: {
    fontSize: 20,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  nodeName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.neutral[0],
    marginBottom: spacing[0.5],
    lineHeight: 15,
  },
  nodeCode: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  collapseButtonInline: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
  collapseIconInline: {
    fontSize: 10,
    color: colors.neutral[0],
    fontWeight: 'bold',
  },
  inactiveBadgeOverlay: {
    position: 'absolute',
    top: 5,
    right: 10,
    backgroundColor: colors.danger[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    borderRadius: borderRadius.xl,
  },
  inactiveBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.danger[600],
  },
  floatingActions: {
    position: 'absolute',
    top: -12,
    right: -12,
    flexDirection: 'row',
    gap: spacing[1],
    opacity: 0.9,
  },
  floatingActionBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingActionIcon: {
    fontSize: 12,
  },
});

export default OrganizationInteractiveTree;
