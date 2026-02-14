import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import type { MindMap, MindMapNode, CrossReference } from '../types/mindmap';

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

function flattenNodes(
  node: MindMapNode,
  parentId: string | null,
  nodes: Node[],
  edges: Edge[],
  depth: number = 0
): void {
  const flowNode: Node = {
    id: node.id,
    type: 'mindMapNode',
    position: { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      speaker: node.speaker,
      timestamp: node.timestamp,
      depth,
      childCount: node.children.length,
    },
  };
  nodes.push(flowNode);

  if (parentId) {
    edges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: 'smoothstep',
      style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1.5 },
      animated: false,
    });
  }

  for (const child of node.children) {
    flattenNodes(child, node.id, nodes, edges, depth + 1);
  }
}

function addCrossReferenceEdges(crossRefs: CrossReference[], edges: Edge[]): void {
  for (const ref of crossRefs) {
    edges.push({
      id: `xref-${ref.sourceId}-${ref.targetId}`,
      source: ref.sourceId,
      target: ref.targetId,
      type: 'smoothstep',
      style: {
        stroke: 'rgba(139, 92, 246, 0.4)',
        strokeWidth: 1,
        strokeDasharray: '5,5',
      },
      animated: true,
      label: ref.relationship,
      labelStyle: { fill: 'rgba(139, 92, 246, 0.6)', fontSize: 10, fontFamily: 'Space Mono' },
    });
  }
}

export function computeLayout(mindMap: MindMap): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  flattenNodes(mindMap.root, null, nodes, edges, 0);
  addCrossReferenceEdges(mindMap.crossReferences, edges);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 120,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const width = Math.max(160, Math.min(280, (node.data.label as string).length * 8 + 60));
    const height = 60;
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    if (!edge.id.startsWith('xref-')) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - (dagreNode.width ?? 160) / 2,
        y: dagreNode.y - (dagreNode.height ?? 60) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function generateNodeId(): string {
  return `n${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
