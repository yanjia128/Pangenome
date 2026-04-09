import React, { useState, useEffect } from 'react';
import { Alert, Spinner, Button } from 'flowbite-react';
import { HiMagnifyingGlassPlus, HiMagnifyingGlassMinus } from 'react-icons/hi2';

const JBROWSE_SERVER_URL = 'http://localhost:9000';

function JBrowsePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(JBROWSE_SERVER_URL, { method: 'HEAD' });
        if (response.ok || response.type === 'opaque') {
          setLoading(false);
          setError(null);
        } else {
          throw new Error('Server not responding');
        }
      } catch (err) {
        setError(
          `無法連接到 Genome Browser 伺服器 (${JBROWSE_SERVER_URL}). ` +
          `請確保 JBrowse 伺服器正在運行於端口 9000。`
        );
        setLoading(false);
      }
    };

    checkServer();
  }, []);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Spinner size="xl" />
        <p className="mt-4 text-gray-600">正在載入 Genome Browser...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert color="failure">
          <div className="flex flex-col">
            <span className="font-medium">無法載入 Genome Browser</span>
            <span className="text-sm mt-2">{error}</span>
            <span className="text-sm mt-2">
              請確保 JBrowse 伺服器運行於{' '}
              <code className="bg-red-100 px-1 rounded">{JBROWSE_SERVER_URL}</code>
            </span>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Genome Browser</h1>
          <p className="text-sm text-gray-600 mt-1">
            Interactive genome visualization powered by JBrowse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="gray"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
          >
            <HiMagnifyingGlassMinus className="h-5 w-5" />
          </Button>
          <button
            onClick={handleResetZoom}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 min-w-[4rem]"
          >
            {zoom}%
          </button>
          <Button
            color="gray"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
          >
            <HiMagnifyingGlassPlus className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 relative overflow-auto flex items-center justify-center bg-gray-50">
        <div className="inline-block">
          <iframe
            src={JBROWSE_SERVER_URL}
            className="border-0"
            style={{
              width: `calc(100vw * ${zoom} / 100)`,
              height: `calc((100vh - 73px) * ${zoom} / 100)`,
            }}
            title="Genome Browser"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
}

export { JBrowsePage as default };
