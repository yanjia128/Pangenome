import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../api/use-api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Button,
  Spinner,
  Modal,
  ModalHeader,
  ModalBody,
} from "flowbite-react";
import { HiSearch, HiDownload } from "react-icons/hi";

const PAGE_SIZE = 20;

// 解析欄位值，以逗號或空格分隔
function parseItems(val: unknown): string[] {
  const str = String(val ?? '').trim();
  if (!str) return [];
  // 支援逗號分隔或多個空格分隔
  return str.split(/[,\s]+/).filter(item => item.length > 0);
}

// 顯示欄位內容的元件
function CellContent({
  value,
  colName,
  onShowMore,
}: {
  value: unknown;
  colName: string;
  onShowMore: (items: string[], colName: string) => void;
}) {
  const items = parseItems(value);



  return (
    <button
      onClick={() => onShowMore(items, colName)}
      className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
    >
      {items.length} results
    </button>
  );
}

function OrthogroupsTable() {
  const { getOrthogroups } = useApi();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [count, setCount] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal 狀態
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItems, setModalItems] = useState<string[]>([]);
  const [modalTitle, setModalTitle] = useState('');

  useEffect(() => {
    setLoading(true);
    getOrthogroups({ page, page_size: PAGE_SIZE, search })
      .then((resData) => {
        setData(resData.results);
        setCount(resData.count);
        setNumPages(resData.num_pages);
      })
      .catch((err) => console.error("Fetch error:", err))
      .finally(() => setLoading(false));
  }, [page, search]);

  const handleSearch = () => {
    setSearch(inputValue);
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleShowMore = (items: string[], colName: string) => {
    setModalItems(items);
    setModalTitle(colName);
    setModalOpen(true);
  };

  const handleDownload = async (orthogroupId: string) => {
    // 構建檔案路徑 - 使用絕對路徑
    const filePath = `/rst/Results_Nov26/Orthogroup_Sequences/${orthogroupId}.fa`;
    
    try {
      // 使用 fetch API 下載檔案
      const response = await fetch(filePath);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // 獲取檔案內容
      const blob = await response.blob();
      
      // 創建下載連結
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${orthogroupId}.fa`;
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下載失敗:', error);
      alert(`無法下載檔案 ${orthogroupId}.fa\n\n可能原因：\n1. 伺服器尚未重啟（新的 URL 配置未生效）\n2. 檔案不存在\n\n請聯繫管理員或重啟 Django 服務器。`);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Orthogroups Group Table
      </h2>

      <div className="flex items-center gap-2 max-w-lg">
        <TextInput
          icon={HiSearch}
          placeholder="Search..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Button color="blue" onClick={handleSearch}>
          Search
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="xl" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          {(() => {
            const columns = data[0] ? Object.keys(data[0]) : [];
            return (
              <Table hoverable striped>
                <TableHead>
                  
                    {columns.map((col) => (
                      <TableHeadCell key={col}>{col}</TableHeadCell>
                    ))}
                  
                </TableHead>
                <TableBody className="divide-y">
                  {data.map((row, idx) => (
                    <TableRow key={idx} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      {columns.map((key, i) => (
                        <TableCell key={i}>
                          {i === 0 ? (
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/phylocanvas?id=${encodeURIComponent(String(row[key] ?? ''))}`}
                                className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 font-mono"
                              >
                                {String(row[key] ?? '')}
                              </Link>
                              <button
                                onClick={() => handleDownload(String(row[key] ?? ''))}
                                className="p-1 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                                title="下載 FASTA 檔案"
                              >
                                <HiDownload className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <CellContent
                              value={row[key]}
                              colName={key}
                              onShowMore={handleShowMore}
                            />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </div>
      )}

      {/* Modal 顯示多筆資料 */}
      <Modal show={modalOpen} onClose={() => setModalOpen(false)} size="lg">
        <ModalHeader>{modalTitle} ({modalItems.length} 筆)</ModalHeader>
        <ModalBody>
          <div className="max-h-96 overflow-y-auto">
            <ul className="space-y-1">
              {modalItems.map((item, idx) => (
                <li
                  key={idx}
                  className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded text-sm font-mono"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </ModalBody>
      </Modal>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700 dark:text-gray-400">
          total <span className="font-semibold">{count}</span>  results
        </span>
        <div className="flex items-center gap-2">
          <Button
            color="gray"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            Last page
          </Button>
          <span className="text-sm text-gray-700 dark:text-gray-400">
            Page number <span className="font-semibold">{page}</span> /total <span className="font-semibold">{numPages}</span> pages
          </span>
          <Button
            color="gray"
            onClick={() => setPage(page + 1)}
            disabled={page >= numPages}
          >
            Next page
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OrthogroupsTable;
