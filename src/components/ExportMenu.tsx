import { useState } from 'react';
import type { MindMap, KnowledgeGraph } from '../types/mindmap';
import {
  exportToJSON,
  exportToMarkdown,
  exportToOPML,
  exportToPNG,
  downloadFile,
} from '../services/export';

interface ExportMenuProps {
  isOpen: boolean;
  onClose: () => void;
  mindMap: MindMap | null;
  knowledgeGraph?: KnowledgeGraph | null;
}

export function ExportMenu({ isOpen, onClose, mindMap, knowledgeGraph }: ExportMenuProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  if (!isOpen) return null;

  const isGraphMode = knowledgeGraph && knowledgeGraph.entities.length > 0;
  const baseName = isGraphMode
    ? 'mindflow-knowledge-graph'
    : (mindMap?.root.label.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase() || 'mindflow');

  const handleExport = async (format: string) => {
    setExporting(format);

    try {
      switch (format) {
        case 'json':
          downloadFile(exportToJSON(mindMap, knowledgeGraph), `${baseName}.json`, 'application/json');
          break;
        case 'markdown':
          downloadFile(exportToMarkdown(mindMap, knowledgeGraph), `${baseName}.md`, 'text/markdown');
          break;
        case 'opml':
          if (mindMap) {
            downloadFile(exportToOPML(mindMap), `${baseName}.opml`, 'text/xml');
          }
          break;
        case 'png': {
          const blob = await exportToPNG('mindflow-canvas');
          downloadFile(blob, `${baseName}.png`);
          break;
        }
      }
    } catch (err) {
      console.error(`Export failed:`, err);
    } finally {
      setExporting(null);
      onClose();
    }
  };

  const formats = [
    { id: 'markdown', label: 'Markdown', desc: isGraphMode ? 'Entities and relationships as text' : 'Readable text with headers and bullets', icon: '📝' },
    { id: 'json', label: 'JSON', desc: isGraphMode ? 'Knowledge graph data' : 'Raw data for re-import or processing', icon: '{ }' },
    { id: 'png', label: 'PNG Image', desc: 'Screenshot of the current map', icon: '🖼' },
    ...(!isGraphMode && mindMap ? [{ id: 'opml', label: 'OPML', desc: 'For XMind, FreeMind, MindManager', icon: '🗂' }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 w-72 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2">
          <h3 className="px-2 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider">Export as</h3>
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt.id)}
              disabled={exporting !== null}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              <span className="text-base w-6 text-center">{fmt.icon}</span>
              <div>
                <div className="text-sm text-neutral-200">{fmt.label}</div>
                <div className="text-xs text-neutral-500">{fmt.desc}</div>
              </div>
              {exporting === fmt.id && (
                <span className="ml-auto text-primary-400 animate-pulse text-xs">...</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
