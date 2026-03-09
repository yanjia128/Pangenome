import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhyloxoniumGLComponent } from 'phyloxonium';
import { useApi } from '../api/use-api';

const DEFAULT_TREE_ID = 'OG0000000';

function App() {
  const [source, setSource] = useState('');
  const [treeId, setTreeId] = useState(DEFAULT_TREE_ID);
  const [inputValue, setInputValue] = useState(DEFAULT_TREE_ID);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [treeType, setTreeType] = useState('rc');
  const [devicePixelRatio, setDevicePixelRatio] = useState(1);
  const [size, setSize] = useState({ width: 1200, height: 700 });
  const containerRef = useRef<HTMLDivElement>(null);
  const { getGeneTree } = useApi();

  const loadTree = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const result = await getGeneTree(id);
    if (result?.newick) {
      setSource(result.newick);
    } else {
      setError(`Failed to load tree: ${id}`);
      setSource('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTree(treeId);
  }, [treeId, loadTree]);

  useEffect(() => {
    const updateSize = () => {
      const el = containerRef.current;
      if (!el) return;

      const nextWidth = Math.max(320, Math.floor(el.clientWidth));
      const nextHeight = Math.max(420, Math.floor(el.clientHeight));
      setSize({ width: nextWidth, height: nextHeight });
      setDevicePixelRatio(window.devicePixelRatio || 1);
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim().toUpperCase();
    if (trimmed && trimmed !== treeId) {
      setTreeId(trimmed);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <form onSubmit={handleSubmit} style={{ padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label htmlFor="tree-id-input">Gene Tree ID:</label>
        <input
          id="tree-id-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. OG0000000"
          style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px', width: '180px' }}
        />
        <button type="submit" style={{ padding: '4px 12px', cursor: 'pointer' }}>
          Load
        </button>
        {loading && <span style={{ color: '#888' }}>Loading...</span>}
        {error && <span style={{ color: 'red' }}>{error}</span>}
      </form>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          width: '100%',
          minHeight: '70vh',
        }}
      >
        {source && !loading && (
          <PhyloxoniumGLComponent
            size={size}
            source={source}
            type={treeType}
            useDevicePixels={Math.min(2, devicePixelRatio)}
            interactive={{ highlight: true, tooltip: true }}
            fontSize={16}
            fontFamily={'Arial'}
            haloWidth={6}
            haloRadius={16}
            treeToCanvasRatio={0.25}
            zoom={0}
            stepZoom={0}
            branchZoom={0}
            strokeWidth={2}
            showEdges={true}
            nodeSize={3}
            showShapes={false}
            plugins={[]}
            alignLabels={true}
            showLabels={true}
            showLeafLabels={true}
          />
        )}
      </div>
    </div>
  );
}

export default App;