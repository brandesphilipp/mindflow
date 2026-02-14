import { useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './CustomNode';
import { computeLayout, computeForceLayout } from '../utils/layout';
import { getSpeakerColor } from '../utils/colors';
import type { MindMap, MindMapNode, KnowledgeGraph } from '../types/mindmap';

function collectSpeakers(node: MindMapNode, speakers: Set<number>): void {
  if (node.speaker) {
    const num = parseInt(node.speaker.replace('Speaker ', ''));
    if (!isNaN(num)) speakers.add(num);
  }
  for (const child of node.children) collectSpeakers(child, speakers);
}

const nodeTypes = { mindMapNode: CustomNode };

interface MindMapViewInnerProps {
  mindMap: MindMap | null;
  knowledgeGraph: KnowledgeGraph | null;
  isProcessing: boolean;
  speakerNames: Record<number, string>;
  activeNodeIds: Set<string>;
  autoFocusEnabled: boolean;
}

function MindMapViewInner({ mindMap, knowledgeGraph, isProcessing, speakerNames, activeNodeIds, autoFocusEnabled }: MindMapViewInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);
  const userPannedAtRef = useRef(0);

  // Determine if we're in graph mode
  const isGraphMode = knowledgeGraph && knowledgeGraph.entities.length > 0;

  // Compute layout based on mode
  const layoutResult = useMemo(() => {
    if (isGraphMode) {
      return computeForceLayout(knowledgeGraph.entities, knowledgeGraph.relationships, activeNodeIds);
    }
    if (mindMap) {
      return computeLayout(mindMap, speakerNames, activeNodeIds);
    }
    return { nodes: [], edges: [] };
  }, [isGraphMode, knowledgeGraph, mindMap, speakerNames, activeNodeIds]);

  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);

    const isNewNodes = layoutResult.nodes.length !== prevNodeCountRef.current;
    prevNodeCountRef.current = layoutResult.nodes.length;

    // Determine if we should auto-pan
    const timeSinceUserPan = Date.now() - userPannedAtRef.current;
    const userRecentlyPanned = timeSinceUserPan < 5000;

    if (autoFocusEnabled && activeNodeIds.size > 0 && !userRecentlyPanned) {
      // Focus on active (changed/new) nodes
      const activeNodes = layoutResult.nodes.filter((n) => activeNodeIds.has(n.id));
      if (activeNodes.length > 0) {
        setTimeout(() => {
          fitView({ nodes: activeNodes, padding: 0.5, duration: 600 });
        }, 100);
        return;
      }
    }

    // Fallback: fit all when new nodes appear
    if (isNewNodes) {
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 400 });
      }, 100);
    }
  }, [layoutResult, activeNodeIds, autoFocusEnabled, setNodes, setEdges, fitView]);

  const handleMoveStart = useCallback((_event: unknown, _viewport: unknown) => {
    // Mark that the user manually panned/zoomed
    userPannedAtRef.current = Date.now();
  }, []);

  const hasContent = mindMap || isGraphMode;

  return (
    <div id="mindflow-canvas" className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveStart={handleMoveStart}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="rgba(255,255,255,0.05)"
        />
        <Controls
          className="!bg-neutral-800/80 !border-neutral-700 !rounded-lg !shadow-lg [&>button]:!bg-neutral-800 [&>button]:!border-neutral-700 [&>button]:!text-neutral-400 [&>button:hover]:!bg-neutral-700"
          showInteractive={false}
        />
      </ReactFlow>

      {isProcessing && (
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-primary-600/20 border border-primary-600/30 rounded-full text-xs text-primary-300 font-mono">
          <span className="w-2 h-2 rounded-full bg-primary-400 recording-pulse" />
          Processing...
        </div>
      )}

      {/* Mode indicator */}
      {isGraphMode && (
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 rounded-full text-xs text-emerald-300 font-mono">
          Graph Mode — {knowledgeGraph.entities.length} entities, {knowledgeGraph.relationships.length} relationships
        </div>
      )}

      {!hasContent && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-md px-6">
            <div className="text-6xl mb-4 opacity-20">🧠</div>
            <h2 className="text-xl font-semibold text-neutral-400 mb-2">
              Ready to map your thoughts
            </h2>
            <p className="text-sm text-neutral-500">
              Press the record button and start talking. Your mind map will appear here as you speak.
            </p>
          </div>
        </div>
      )}

      {/* Speaker Legend (tree mode only) */}
      {mindMap && !isGraphMode && (() => {
        const speakers = new Set<number>();
        collectSpeakers(mindMap.root, speakers);
        if (speakers.size < 2) return null;
        return (
          <div className="absolute bottom-4 left-4 flex flex-col gap-1 px-3 py-2 bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-xl">
            {Array.from(speakers).sort().map((spk) => (
              <div key={spk} className="flex items-center gap-2 text-[10px]">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getSpeakerColor(spk) }}
                />
                <span className="text-neutral-400 font-mono">
                  {speakerNames[spk] || `Speaker ${spk}`}
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

interface MindMapViewProps {
  mindMap: MindMap | null;
  knowledgeGraph?: KnowledgeGraph | null;
  isProcessing: boolean;
  speakerNames: Record<number, string>;
  activeNodeIds: Set<string>;
  autoFocusEnabled: boolean;
}

export function MindMapView({ mindMap, knowledgeGraph, isProcessing, speakerNames, activeNodeIds, autoFocusEnabled }: MindMapViewProps) {
  return (
    <ReactFlowProvider>
      <MindMapViewInner
        mindMap={mindMap}
        knowledgeGraph={knowledgeGraph ?? null}
        isProcessing={isProcessing}
        speakerNames={speakerNames}
        activeNodeIds={activeNodeIds}
        autoFocusEnabled={autoFocusEnabled}
      />
    </ReactFlowProvider>
  );
}
