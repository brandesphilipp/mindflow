import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NODE_COLORS, getSpeakerColor, NODE_TYPE_ICONS } from '../utils/colors';
import type { NodeType } from '../types/mindmap';

interface CustomNodeData {
  label: string;
  nodeType: NodeType;
  speaker: string | null;
  speakerDisplay: string | null;
  timestamp: number | null;
  depth: number;
  weight: number;
  isActive: boolean;
  confidence: 'high' | 'low';
  // Graph mode extras
  entitySummary?: string;
  graphColors?: { bg: string; border: string; text: string };
  isGraphMode?: boolean;
  degree?: number;
  [key: string]: unknown;
}

function getWeightStyle(depth: number, weight: number, isGraphMode?: boolean, degree?: number) {
  // Graph mode: size based on degree (number of connections)
  if (isGraphMode && degree !== undefined) {
    if (degree >= 8) {
      return {
        fontSize: 'text-base font-semibold',
        padding: 'px-5 py-3',
        glowSize: 28,
        glowDouble: true,
        borderWidth: 2.5,
      };
    }
    if (degree >= 4) {
      return {
        fontSize: 'text-sm font-semibold',
        padding: 'px-4 py-3',
        glowSize: 20,
        glowDouble: false,
        borderWidth: 2,
      };
    }
    if (degree >= 2) {
      return {
        fontSize: 'text-sm font-medium',
        padding: 'px-4 py-2.5',
        glowSize: 14,
        glowDouble: false,
        borderWidth: 1.5,
      };
    }
    return {
      fontSize: 'text-xs font-medium',
      padding: 'px-3.5 py-2',
      glowSize: 10,
      glowDouble: false,
      borderWidth: 1.5,
    };
  }

  // Tree mode: existing weight-based sizing
  if (depth === 0) {
    return {
      fontSize: 'text-base font-semibold',
      padding: 'px-5 py-3',
      glowSize: 30,
      glowDouble: true,
      borderWidth: 2.5,
    };
  }
  if (weight >= 10) {
    return {
      fontSize: 'text-sm font-semibold',
      padding: 'px-4 py-3',
      glowSize: 24,
      glowDouble: false,
      borderWidth: 2.5,
    };
  }
  if (weight >= 5) {
    return {
      fontSize: 'text-sm font-medium',
      padding: 'px-4 py-2.5',
      glowSize: 18,
      glowDouble: false,
      borderWidth: 2,
    };
  }
  if (weight >= 2) {
    return {
      fontSize: 'text-xs font-medium',
      padding: 'px-3.5 py-2',
      glowSize: 12,
      glowDouble: false,
      borderWidth: 1.5,
    };
  }
  return {
    fontSize: 'text-xs',
    padding: 'px-3 py-2',
    glowSize: 8,
    glowDouble: false,
    borderWidth: 1.5,
  };
}

function CustomNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;
  const [showSummary, setShowSummary] = useState(false);

  // Use graph colors if in graph mode, otherwise use tree-mode type colors
  const colors = nodeData.graphColors || NODE_COLORS[nodeData.nodeType] || NODE_COLORS.point;
  const icon = NODE_TYPE_ICONS[nodeData.nodeType] || '·';
  const speakerNum = nodeData.speaker ? parseInt(nodeData.speaker.replace('Speaker ', '')) : null;
  const speakerColor = speakerNum !== null ? getSpeakerColor(speakerNum) : undefined;

  const style = getWeightStyle(nodeData.depth, nodeData.weight, nodeData.isGraphMode, nodeData.degree);

  const boxShadow = style.glowDouble
    ? `0 0 ${style.glowSize}px ${colors.bg}, 0 0 ${style.glowSize * 2}px ${colors.bg}`
    : `0 0 ${style.glowSize}px ${colors.bg}`;

  const isLowConfidence = nodeData.confidence === 'low';

  // Speaker background tint (tree mode only)
  const background = !nodeData.isGraphMode && speakerColor
    ? `linear-gradient(135deg, ${speakerColor}15 0%, transparent 60%), ${colors.bg}`
    : colors.bg;

  // Border color: speaker color in tree mode, type color in graph mode
  const borderColor = !nodeData.isGraphMode && speakerColor ? speakerColor : colors.border;

  return (
    <div
      className={`node-enter rounded-xl max-w-[320px] backdrop-blur-sm ${style.padding} ${style.fontSize}${nodeData.isActive ? ' node-active-pulse' : ''}`}
      style={{
        background,
        border: `${style.borderWidth}px ${isLowConfidence ? 'dashed' : 'solid'} ${borderColor}`,
        boxShadow: nodeData.isActive
          ? `${boxShadow}, 0 0 20px rgba(92, 124, 250, 0.5), 0 0 40px rgba(92, 124, 250, 0.25)`
          : boxShadow,
        cursor: nodeData.entitySummary ? 'pointer' : 'default',
      }}
      onClick={() => {
        if (nodeData.entitySummary) setShowSummary((p) => !p);
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
        {isLowConfidence && (
          <span
            className="shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' }}
            title="Low confidence transcription"
          >
            ?
          </span>
        )}
      </div>

      {/* Entity summary tooltip (graph mode) */}
      {showSummary && nodeData.entitySummary && (
        <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-neutral-400 leading-relaxed">
          {nodeData.entitySummary}
        </div>
      )}

      {/* Graph mode: degree indicator */}
      {nodeData.isGraphMode && nodeData.degree !== undefined && nodeData.degree > 0 && (
        <div className="flex items-center gap-2 mt-1 text-[10px] opacity-50">
          <span style={{ color: colors.text }}>
            {nodeData.degree} connection{nodeData.degree !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Tree mode: speaker and timestamp */}
      {!nodeData.isGraphMode && (nodeData.speaker || nodeData.timestamp !== null) && (
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
              {nodeData.speakerDisplay || nodeData.speaker}
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
