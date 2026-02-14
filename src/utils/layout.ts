import type { Node, Edge } from '@xyflow/react';
import type { MindMap, MindMapNode, CrossReference, GraphEntity, GraphRelationship } from '../types/mindmap';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force';

interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

// Count total descendants (including self) for proportional arc allocation + node weighting
function subtreeSize(node: MindMapNode): number {
  let size = 1;
  for (const child of node.children) {
    size += subtreeSize(child);
  }
  return size;
}

function flattenNodes(
  node: MindMapNode,
  parentId: string | null,
  nodes: Node[],
  edges: Edge[],
  depth: number = 0,
  speakerNames: Record<number, string> = {},
  activeNodeIds: Set<string> = new Set()
): void {
  const weight = subtreeSize(node);

  // Resolve speaker display name from settings mapping
  const speakerNum = node.speaker ? parseInt(node.speaker.replace('Speaker ', '')) : null;
  const speakerDisplay = speakerNum !== null
    ? (speakerNames[speakerNum] || node.speaker)
    : node.speaker;

  const flowNode: Node = {
    id: node.id,
    type: 'mindMapNode',
    position: { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      speaker: node.speaker,
      speakerDisplay,
      timestamp: node.timestamp,
      depth,
      weight,
      isActive: activeNodeIds.has(node.id),
      confidence: node.confidence || 'high',
    },
  };
  nodes.push(flowNode);

  if (parentId) {
    edges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: 'simplebezier',
      style: { stroke: 'rgba(255,255,255,0.35)', strokeWidth: 2 },
      animated: false,
    });
  }

  for (const child of node.children) {
    flattenNodes(child, node.id, nodes, edges, depth + 1, speakerNames, activeNodeIds);
  }
}

function addCrossReferenceEdges(crossRefs: CrossReference[], edges: Edge[]): void {
  for (const ref of crossRefs) {
    edges.push({
      id: `xref-${ref.sourceId}-${ref.targetId}`,
      source: ref.sourceId,
      target: ref.targetId,
      type: 'simplebezier',
      style: {
        stroke: 'rgba(139, 92, 246, 0.6)',
        strokeWidth: 2,
        strokeDasharray: '6,4',
      },
      animated: true,
      label: ref.relationship,
      labelStyle: { fill: 'rgba(139, 92, 246, 0.8)', fontSize: 10, fontFamily: 'Space Mono' },
    });
  }
}

// Radial layout: root at center, children in concentric rings
// Dynamic spacing based on total node count
function radialLayout(
  node: MindMapNode,
  positions: Map<string, { x: number; y: number }>,
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  depth: number,
  totalNodes: number
): void {
  positions.set(node.id, { x: cx, y: cy });

  if (node.children.length === 0) return;

  // Dynamic radius: tighter for small maps, expanding for large ones
  const baseRadius = totalNodes < 10 ? 140 : totalNodes < 20 ? 160 : 180;
  const depthMultiplier = totalNodes < 10 ? 120 : totalNodes < 20 ? 140 : 160;
  const radius = baseRadius + depth * depthMultiplier;

  const childWeights = node.children.map((c) => subtreeSize(c));
  const totalWeight = childWeights.reduce((a, b) => a + b, 0);
  const arcSpan = endAngle - startAngle;

  let currentAngle = startAngle;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    const weight = childWeights[i];
    const childArc = (weight / totalWeight) * arcSpan;
    const midAngle = currentAngle + childArc / 2;

    const childX = cx + radius * Math.cos(midAngle);
    const childY = cy + radius * Math.sin(midAngle);

    const childStartAngle = midAngle - childArc / 2;
    const childEndAngle = midAngle + childArc / 2;

    radialLayout(child, positions, childX, childY, childStartAngle, childEndAngle, depth + 1, totalNodes);

    currentAngle += childArc;
  }
}

export function computeLayout(
  mindMap: MindMap,
  speakerNames: Record<number, string> = {},
  activeNodeIds: Set<string> = new Set()
): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  flattenNodes(mindMap.root, null, nodes, edges, 0, speakerNames, activeNodeIds);
  addCrossReferenceEdges(mindMap.crossReferences, edges);

  // Compute radial positions
  const totalNodes = nodes.length;
  const positions = new Map<string, { x: number; y: number }>();
  radialLayout(mindMap.root, positions, 0, 0, 0, 2 * Math.PI, 0, totalNodes);

  const layoutedNodes = nodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    return {
      ...node,
      position: { x: pos.x, y: pos.y },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// --- Force-directed layout for knowledge graph mode ---

type EdgeStyle = { stroke: string; strokeWidth: number; strokeDasharray?: string; animated?: boolean };

const DEFAULT_EDGE_STYLE: EdgeStyle = { stroke: 'rgba(156, 163, 175, 0.4)', strokeWidth: 1.5 };

// Map Graphiti relationship types to visual styles by category
function getEdgeStyle(relType: string): EdgeStyle {
  const t = relType.toUpperCase();
  // Hierarchy / taxonomy: IS_A, IS_TYPE_OF, IS_SUBSET_OF, BELONGS_TO
  if (t.startsWith('IS_') || t.includes('SUBSET') || t === 'BELONGS_TO')
    return { stroke: 'rgba(59, 130, 246, 0.6)', strokeWidth: 2 };
  // Composition / creation: BUILT_WITH, USES, CREATED_BY, CONTAINS, HAS
  if (['USES', 'BUILT_WITH', 'CONTAINS', 'HAS'].includes(t) || t.includes('CREATED') || t.includes('MADE'))
    return { stroke: 'rgba(34, 197, 94, 0.6)', strokeWidth: 2 };
  // Causation: CAUSES, LEADS_TO, RESULTS_IN, ENABLES
  if (t.includes('CAUSE') || t.includes('LEADS') || t.includes('RESULT') || t === 'ENABLES')
    return { stroke: 'rgba(249, 115, 22, 0.6)', strokeWidth: 2 };
  // Opposition: CONTRADICTS, OPPOSES, CONFLICTS
  if (t.includes('CONTRA') || t.includes('OPPOS') || t.includes('CONFLICT'))
    return { stroke: 'rgba(239, 68, 68, 0.6)', strokeWidth: 2, strokeDasharray: '6,4' };
  // Ability / quality: EXCELS_AT, KNOWN_FOR, SPECIALIZES
  if (t.includes('EXCEL') || t.includes('KNOWN') || t.includes('SPECIAL'))
    return { stroke: 'rgba(168, 85, 247, 0.6)', strokeWidth: 1.5 };
  // Processing / action verbs: PROCESSES, GENERATES, PERFORMS
  if (t.includes('PROCESS') || t.includes('GENERAT') || t.includes('PERFORM'))
    return { stroke: 'rgba(6, 182, 212, 0.6)', strokeWidth: 1.5 };
  return DEFAULT_EDGE_STYLE;
}

// Cluster colors for community-based coloring
const COMMUNITY_COLORS = [
  { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', text: '#fbbf24' },
  { bg: 'rgba(6, 182, 212, 0.25)',   border: '#06b6d4', text: '#22d3ee' },
  { bg: 'rgba(139, 92, 246, 0.25)',  border: '#8b5cf6', text: '#a78bfa' },
  { bg: 'rgba(16, 185, 129, 0.25)',  border: '#10b981', text: '#34d399' },
  { bg: 'rgba(244, 63, 94, 0.25)',   border: '#f43f5e', text: '#fb7185' },
  { bg: 'rgba(59, 130, 246, 0.25)',  border: '#3b82f6', text: '#93c5fd' },
  { bg: 'rgba(236, 72, 153, 0.25)',  border: '#ec4899', text: '#f9a8d4' },
  { bg: 'rgba(20, 184, 166, 0.25)',  border: '#14b8a6', text: '#5eead4' },
];

interface ForceNode extends SimulationNodeDatum {
  id: string;
  entity: GraphEntity;
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  id: string;
  relationship: GraphRelationship;
}

export function computeForceLayout(
  entities: GraphEntity[],
  relationships: GraphRelationship[],
  activeNodeIds: Set<string> = new Set()
): LayoutResult {
  if (entities.length === 0) return { nodes: [], edges: [] };

  const entityIds = new Set(entities.map((e) => e.id));

  // Create force simulation nodes
  const simNodes: ForceNode[] = entities.map((e) => ({
    id: e.id,
    entity: e,
    x: undefined,
    y: undefined,
  }));

  // Filter relationships to only include those whose source/target exist
  const validRelationships = relationships.filter(
    (r) => entityIds.has(r.source_id) && entityIds.has(r.target_id)
  );

  const simLinks: ForceLink[] = validRelationships.map((r) => ({
    id: r.id,
    source: r.source_id,
    target: r.target_id,
    relationship: r,
  }));

  // Run d3-force simulation synchronously
  const simulation = forceSimulation<ForceNode>(simNodes)
    .force(
      'link',
      forceLink<ForceNode, ForceLink>(simLinks)
        .id((d) => d.id)
        .distance(150)
        .strength(0.5)
    )
    .force('charge', forceManyBody<ForceNode>().strength(-300))
    .force('center', forceCenter<ForceNode>(0, 0))
    .force('collide', forceCollide<ForceNode>().radius((d) => 30 + Math.sqrt(d.entity.degree) * 15).strength(0.7))
    .stop();

  // Run 300 ticks synchronously
  for (let i = 0; i < 300; i++) {
    simulation.tick();
  }

  // Convert to React Flow nodes
  const nodes: Node[] = simNodes.map((sn) => {
    const e = sn.entity;
    const communityIdx = e.community ?? 0;
    const colors = COMMUNITY_COLORS[communityIdx % COMMUNITY_COLORS.length];

    return {
      id: e.id,
      type: 'mindMapNode',
      position: { x: sn.x ?? 0, y: sn.y ?? 0 },
      data: {
        label: e.name,
        nodeType: e.type as 'topic' | 'point' | 'detail' | 'action' | 'question',
        speaker: null,
        speakerDisplay: null,
        timestamp: null,
        depth: 0,
        weight: e.degree || 1,
        isActive: activeNodeIds.has(e.id),
        confidence: 'high',
        entitySummary: e.summary,
        graphColors: colors,
        isGraphMode: true,
        degree: e.degree,
      },
    };
  });

  // Convert to React Flow edges
  const edges: Edge[] = simLinks.map((sl) => {
    const r = sl.relationship;
    const style = getEdgeStyle(r.type);
    const sourceId = typeof sl.source === 'string' ? sl.source : (sl.source as ForceNode).id;
    const targetId = typeof sl.target === 'string' ? sl.target : (sl.target as ForceNode).id;

    return {
      id: r.id,
      source: sourceId,
      target: targetId,
      type: 'simplebezier',
      style,
      animated: style.animated ?? false,
      label: r.type !== 'related_to' ? r.type.toLowerCase().replace(/_/g, ' ') : (r.fact.length > 50 ? r.fact.slice(0, 47) + '...' : r.fact),
      labelStyle: {
        fill: 'rgba(255, 255, 255, 0.5)',
        fontSize: 9,
        fontFamily: 'Space Mono, monospace',
      },
      labelBgStyle: {
        fill: 'rgba(10, 10, 22, 0.8)',
        fillOpacity: 0.8,
      },
      labelBgPadding: [4, 2] as [number, number],
    };
  });

  return { nodes, edges };
}

export function generateNodeId(): string {
  return `n${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
