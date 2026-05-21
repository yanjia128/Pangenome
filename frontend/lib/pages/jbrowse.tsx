import React, { useState } from 'react';
import { Alert, Spinner, Button } from 'flowbite-react';
import { HiMagnifyingGlassPlus, HiMagnifyingGlassMinus } from 'react-icons/hi2';
import { getSecrets } from '../config';

function JBrowsePage() {
  const jbrowseServerUrl = getSecrets().jbrowseServerUrl.trim();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 10, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert color="failure">
          <div className="flex flex-col">
            <span className="font-medium">無法載入 Synteny Browser</span>
            <span className="text-sm mt-2">{error}</span>
            <span className="text-sm mt-2">
              請確認 Django 已掛載 JBrowse，並可從以下路徑存取：{' '}
              <code className="bg-red-100 px-1 rounded">{jbrowseServerUrl}</code>
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
          <h1 className="text-2xl font-bold text-gray-800">Synteny Viewer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Embedded viewer page for the Django-mounted JBrowse instance
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
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-50/90">
            <Spinner size="xl" />
            <p className="mt-4 text-gray-600">正在載入 SyntneyViewer...</p>
          </div>
        )}
        <div className="inline-block">
          <iframe
            src={jbrowseServerUrl}
            className="border-0"
            style={{
              width: `calc(100vw * ${zoom} / 100)`,
              height: `calc((100vh - 73px) * ${zoom} / 100)`,
            }}
            title="SyntneyViewer"
            allow="fullscreen"
            onLoad={() => {
              setLoading(false);
              setError(null);
            }}
            onError={() => {
              setLoading(false);
              setError(
                `無法連接到 Django 掛載的 JBrowse 頁面 (${jbrowseServerUrl})。` +
                ` 請確認 Django 已提供此路徑，或在 frontend/.env 設定 JBROWSE_SERVER_URL。`
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

export { JBrowsePage as default };
