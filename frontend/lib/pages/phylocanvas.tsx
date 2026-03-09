import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../api/use-api';
import type { NodeStyle } from '@phylocanvas/phylocanvas.gl';

const DEFAULT_TREE_ID = 'OG0000000';
const HIGHLIGHT_COLOUR = [220, 60, 60, 255];
const EDGE_COLOUR = [220, 60, 60, 200];

type TreeType = 'rc' | 'rd' | 'cr' | 'dg' | 'hr';

const TREE_TYPES: { value: TreeType; label: string }[] = [
  { value: 'rc', label: 'Rectangular' },
  { value: 'rd', label: 'Radial' },
  { value: 'cr', label: 'Circular' },
  { value: 'dg', label: 'Diagonal' },
  { value: 'hr', label: 'Hierarchical' },
];

function PhylocanvasPage() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id') ?? DEFAULT_TREE_ID;
  const [treeId, setTreeId] = useState(initialId);
  const [inputValue, setInputValue] = useState(initialId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeType, setTreeType] = useState<TreeType>('rc');
  const [highlightInput, setHighlightInput] = useState('');
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<import('@phylocanvas/phylocanvas.gl').PhylocanvasGL | null>(null);
  const { getGeneTree } = useApi();

  const applySubtreeHighlight = useCallback((searchId: string) => {
    const tree = treeRef.current;
    if (!tree) return;

    const trimmed = searchId.trim();
    if (!trimmed) {
      tree.setProps({ styles: {} });
      setHighlightError(null);
      return;
    }

    const node = tree.findNodeById(trimmed);
    if (!node) {
      setHighlightError(`Node not found: "${trimmed}"`);
      return;
    }

    setHighlightError(null);
    const graph = tree.getGraphAfterLayout();
    const styles: Record<string, NodeStyle> = {};

    for (let i = 0; i < node.totalNodes; i++) {
      const n = graph.preorderTraversal[node.preIndex + i];
      if (n) {
        styles[n.id] = {
          fillColour: HIGHLIGHT_COLOUR,
          strokeColour: n.isLeaf ? HIGHLIGHT_COLOUR : EDGE_COLOUR,
          fontColour: HIGHLIGHT_COLOUR,
        };
      }
    }

    tree.setProps({ styles });
  }, []);

  const clearHighlight = useCallback(() => {
    treeRef.current?.setProps({ styles: {} });
    setHighlightInput('');
    setHighlightError(null);
  }, []);

  const initTree = useCallback(async (newick: string, type: TreeType) => {
    if (!containerRef.current) return;

    // Destroy previous instance
    if (treeRef.current) {
      treeRef.current.destroy();
      treeRef.current = null;
    }

    const { PhylocanvasGL } = await import(
      /* webpackChunkName: "phylocanvas" */
      '@phylocanvas/phylocanvas.gl'
    );

    treeRef.current = new PhylocanvasGL(containerRef.current, {
      source: newick,
      type,
      interactive: true,
      showLabels: true,
      showLeafLabels: true,
      alignLabels: true,
      styleLeafLabels: true,
      styleNodeEdges: true,
      fontSize: 14,
      nodeSize: 6,
      strokeWidth: 2,
    });
  }, []);

  const loadTree = useCallback(async (id: string, type: TreeType) => {
    setLoading(true);
    setError(null);
    const result = await getGeneTree(id);
    if (result?.newick) {
      try {
        await initTree(result.newick, type);
      } catch (e) {
        setError('Failed to render tree. Make sure @phylocanvas/phylocanvas.gl is installed.');
        console.error(e);
      }
    } else {
      setError(`Failed to load tree: ${id}`);
    }
    setLoading(false);
  }, [initTree]);

  // Reload whenever treeId or treeType changes
  useEffect(() => {
    loadTree(treeId, treeType);
    return () => {
      if (treeRef.current) {
        treeRef.current.destroy();
        treeRef.current = null;
      }
    };
  }, [treeId, treeType, loadTree]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed && trimmed !== treeId) {
      setTreeId(trimmed);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <form
        onSubmit={handleSubmit}
        style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label htmlFor="pc-tree-id">Gene Tree ID:</label>
        <input
          id="pc-tree-id"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. OG0000000"
          style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '180px' }}
        />
        <select
          value={treeType}
          onChange={(e) => setTreeType(e.target.value as TreeType)}
          style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }}
        >
          {TREE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '4px 12px', cursor: 'pointer' }}>
          Load
        </button>
        {loading && <span style={{ color: '#888' }}>Loading...</span>}
        {error && <span style={{ color: 'red' }}>{error}</span>}
      </form>

      <form
        onSubmit={(e) => { e.preventDefault(); applySubtreeHighlight(highlightInput); }}
        style={{ padding: '4px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #eee' }}
      >
        <label htmlFor="pc-highlight-id">Highlight Node ID:</label>
        <input
          id="pc-highlight-id"
          type="text"
          value={highlightInput}
          onChange={(e) => setHighlightInput(e.target.value)}
          placeholder="e.g. node_id or leaf label"
          style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '220px' }}
        />
        <button type="submit" style={{ padding: '4px 12px', cursor: 'pointer' }}>
          Highlight
        </button>
        <button
          type="button"
          onClick={clearHighlight}
          style={{ padding: '4px 12px', cursor: 'pointer', background: '#f5f5f5' }}
        >
          Clear
        </button>
        {highlightError && <span style={{ color: 'red' }}>{highlightError}</span>}
      </form>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '70vh',
          position: 'relative',
        }}
      />
    </div>
  );
}

export default PhylocanvasPage;
