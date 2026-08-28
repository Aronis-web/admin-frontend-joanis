import { OrganizationPosition, PositionTreeNode } from '@/types/organization';

/**
 * Construye el árbol del organigrama en el cliente a partir de la lista plana
 * de puestos (`GET /organization/companies/:id/positions`).
 *
 * Se hace en el cliente (y no con el endpoint `.../positions/tree`) porque el
 * backend trunca el árbol a 3 niveles, perdiendo los puestos más profundos.
 * Además, aquí manejamos los nodos "huérfanos" (con `parentPositionId` que
 * apunta a un puesto que no está en la lista) para que no se pierdan ni se
 * muestren como raíces falsas: se marcan con `isOrphan` y se cuelgan a la raíz.
 *
 * @param positions Lista plana de puestos.
 * @returns Puestos raíz con sus hijos anidados (ordenados por level/displayOrder).
 */
export function buildPositionTree(positions: OrganizationPosition[]): PositionTreeNode[] {
  // 1. Crear un nodo por cada puesto e indexarlo por id.
  const nodeMap = new Map<string, PositionTreeNode>();
  positions.forEach((p) => {
    nodeMap.set(p.id, {
      id: p.id,
      code: p.code,
      name: p.name,
      level: p.level,
      scopeLevel: p.scopeLevel,
      description: p.description,
      parentPositionId: p.parentPositionId,
      maxOccupants: p.maxOccupants,
      minOccupants: p.minOccupants,
      isActive: p.isActive,
      displayOrder: p.displayOrder,
      siteId: p.siteId,
      site: p.site,
      children: [],
    });
  });

  const roots: PositionTreeNode[] = [];

  // 2. Enlazar cada nodo con su padre; si no hay padre válido, es raíz.
  nodeMap.forEach((node) => {
    const parentId = node.parentPositionId;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children!.push(node);
    } else {
      // Raíz real (parentPositionId null) u huérfano (padre no presente).
      if (parentId) {
        node.isOrphan = true;
      }
      roots.push(node);
    }
  });

  // 3. Ordenar hijos y raíces por level y displayOrder de forma estable.
  const sortNodes = (nodes: PositionTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
    nodes.forEach((n) => n.children && n.children.length > 0 && sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

export default buildPositionTree;
