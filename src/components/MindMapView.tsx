import { useEffect, useRef } from 'react';
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
import { computeLayout } from '../utils/layout';
import type { MindMap } from '../types/mindmap';

const nodeTypes = { mindMapNode: CustomNode };

interface MindMapViewInnerProps {
  mindMap: MindMap | null;
  isProcessing: boolean;
}

function MindMapViewInner({ mindMap, isProcessing }: MindMapViewInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(0);

  useEffect(() => {
    if (!mindMap) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: layoutNodes, edges: layoutEdges } = computeLayout(mindMap);
    setNodes(layoutNodes);
    setEdges(layoutEdges);

    // Only auto-fit when new nodes appear
    if (layoutNodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = layoutNodes.length;
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
      }, 100);
    }
  }, [mindMap, setNodes, setEdges, fitView]);

  return (
    <div id="mindflow-canvas" className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.03)"
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

      {!mindMap && (
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
    </div>
  );
}

interface MindMapViewProps {
  mindMap: MindMap | null;
  isProcessing: boolean;
}

export function MindMapView({ mindMap, isProcessing }: MindMapViewProps) {
  return (
    <ReactFlowProvider>
      <MindMapViewInner mindMap={mindMap} isProcessing={isProcessing} />
    </ReactFlowProvider>
  );
}
