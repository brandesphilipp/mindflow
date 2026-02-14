import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_COLORS, getSpeakerColor, NODE_TYPE_ICONS } from '../utils/colors';
import type { NodeType } from '../types/mindmap';

interface CustomNodeData {
  label: string;
  nodeType: NodeType;
  speaker: string | null;
  timestamp: number | null;
  depth: number;
  childCount: number;
  [key: string]: unknown;
}

function CustomNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;
  const colors = NODE_COLORS[nodeData.nodeType] || NODE_COLORS.point;
  const icon = NODE_TYPE_ICONS[nodeData.nodeType] || '·';
  const speakerNum = nodeData.speaker ? parseInt(nodeData.speaker.replace('Speaker ', '')) : null;
  const speakerColor = speakerNum !== null ? getSpeakerColor(speakerNum) : undefined;

  const isRoot = nodeData.depth === 0;
  const fontSize = isRoot ? 'text-sm font-semibold' : nodeData.depth === 1 ? 'text-xs font-medium' : 'text-xs';

  return (
    <div
      className={`node-enter rounded-lg px-3 py-2 max-w-[280px] backdrop-blur-sm ${fontSize}`}
      style={{
        backgroundColor: colors.bg,
        border: `1.5px solid ${speakerColor || colors.border}`,
        boxShadow: `0 0 ${isRoot ? '20px' : '10px'} ${colors.bg}`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />

      <div className="flex items-start gap-1.5">
        <span
          className="shrink-0 mt-0.5 font-mono text-xs"
          style={{ color: colors.text }}
        >
          {icon}
        </span>
        <span style={{ color: colors.text }} className="leading-snug">
          {nodeData.label}
        </span>
      </div>

      {(nodeData.speaker || nodeData.timestamp !== null) && (
        <div className="flex items-center gap-2 mt-1 text-[10px] opacity-50">
          {nodeData.speaker && (
            <span
              className="flex items-center gap-1"
              style={{ color: speakerColor }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: speakerColor }}
              />
              {nodeData.speaker}
            </span>
          )}
          {nodeData.timestamp !== null && (
            <span className="text-neutral-500">
              {Math.floor(nodeData.timestamp / 60)}:{String(Math.floor(nodeData.timestamp % 60)).padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-transparent !border-0 !w-0 !h-0"
      />
    </div>
  );
}

export const CustomNode = memo(CustomNodeComponent);
