import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import { HiSearch } from "react-icons/hi";
import { useApi } from "../api/use-api";

type SpeciesTableData = {
  headers: string[];
  rows: string[][];
};

type SpeciesOption = {
  file: string;
  label: string;
};

const PAGE_SIZE = 25;

const SPECIES_OPTIONS: SpeciesOption[] = [
  { file: "DChaoPraya", label: "DChaoPraya" },
  { file: "Daphylium", label: "Daphylium" },
  { file: "Dbullenianum", label: "Dbullenianum" },
  { file: "Dcariniferum", label: "Dcariniferum" },
  { file: "Dcatenatum", label: "Dcatenatum" },
  { file: "Dchrysotoxum", label: "Dchrysotoxum" },
  { file: "Dcrumenatum", label: "Dcrumenatum" },
  { file: "Dcrocatum", label: "Dcrocatum" },
  { file: "Ddevonianum", label: "Ddevonianum" },
  { file: "Ddiscolor", label: "Ddiscolor" },
  { file: "Dellipsophyllum", label: "Dellipsophyllum" },
  { file: "Dexile", label: "Dexile" },
  { file: "Dformosum", label: "Dformosum" },
  { file: "Dhercoglossum", label: "Dhercoglossum" },
  { file: "Dhuoshanense", label: "Dhuoshanense" },
  { file: "Djenkinsii", label: "Djenkinsii" },
  { file: "Dleonis", label: "Dleonis" },
  { file: "Dlindleyi", label: "Dlindleyi" },
  { file: "Dnobile", label: "Dnobile" },
  { file: "Dparcum", label: "Dparcum" },
  { file: "Dporphyrochilum", label: "Dporphyrochilum" },
  { file: "Dsecundum", label: "Dsecundum" },
  { file: "Dsmilliae", label: "Dsmilliae" },
  { file: "Dspatella", label: "Dspatella" },
  { file: "Dtetragonum", label: "Dtetragonum" },
  { file: "Dthyrsiflorum", label: "Dthyrsiflorum" },
];

// Mirrors SPECIES_TABLE_MAP in api/views/annotation.py - used only to show
// the correct gene_annotation_{suffix} table name in the UI.
function annotationTableSuffix(species: string) {
  if (species === "DChaoPraya") {
    return "dchaoprayasmile";
  }
  return species.toLowerCase();
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function countPopulatedCells(rows: string[][]) {
  return rows.reduce(
    (total, row) => total + row.filter((cell) => normalize(cell || "") !== "").length,
    0
  );
}

export default function AnnotationPage() {
  const { getGeneAnnotation } = useApi();
  const [selectedSpecies, setSelectedSpecies] = useState<string>(SPECIES_OPTIONS[0].file);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<SpeciesTableData | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setTableData(null);
    setPage(1);

    getGeneAnnotation(selectedSpecies)
      .then((data) => {
        if (cancelled) {
          return;
        }
        if (!data.headers.length) {
          setError(
            `無法載入 ${selectedSpecies} 的註解資料。請確認資料庫中已有 gene_annotation_${annotationTableSuffix(
              selectedSpecies
            )} 資料表。`
          );
          return;
        }
        setTableData(data);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(
            `無法載入 ${selectedSpecies} 的註解資料。請確認資料庫中已有 gene_annotation_${annotationTableSuffix(
              selectedSpecies
            )} 資料表。`
          );
          console.error(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpecies]);

  const filteredRows = useMemo(() => {
    if (!tableData) {
      return [];
    }

    const keyword = normalize(searchTerm);
    if (!keyword) {
      return tableData.rows;
    }

    return tableData.rows.filter((row) =>
      row.some((cell) => normalize(cell || "").includes(keyword))
    );
  }, [tableData, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
    setPage(1);
  };

  const headers = tableData?.headers ?? [];
  const populatedCells = tableData ? countPopulatedCells(tableData.rows) : 0;
  const selectedLabel =
    SPECIES_OPTIONS.find((option) => option.file === selectedSpecies)?.label || selectedSpecies;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-rose-100 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(253,224,71,0.18),_transparent_24%),linear-gradient(135deg,_#fffdf8_0%,_#fff7fb_45%,_#f7fff8_100%)] p-6 shadow-[0_20px_60px_-30px_rgba(190,24,93,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center rounded-full border border-rose-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-700 backdrop-blur">
              Orchid Annotation Atlas
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Functional Annotation
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-gray-700">
                Explore gene-level annotation tables for each orchid species in a more
                expressive, specimen-catalog style view. The table below reads directly from
                the{" "}
                <code className="mx-1 rounded bg-white/80 px-1.5 py-0.5 text-xs text-rose-700">
                  gene_annotation_{"{species}"}
                </code>
                tables in the dendrobium database, and is tuned for quick browsing of COG, GO,
                KEGG, Pfam, and EC metadata.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/80 bg-white/70 p-3 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-gray-500">Species</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{selectedLabel}</div>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/70 p-3 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-gray-500">Rows</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {tableData?.rows.length ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-[24px] border border-rose-100 bg-white/95 p-5 shadow-[0_12px_40px_-24px_rgba(225,29,72,0.45)]">
          <label
            htmlFor="species-select"
            className="mb-2 block text-sm font-semibold text-gray-700"
          >
            Species
          </label>
          <Select
            id="species-select"
            value={selectedSpecies}
            onChange={(event) => setSelectedSpecies(event.target.value)}
            className="[&_select]:rounded-xl [&_select]:border-rose-200 [&_select]:bg-rose-50/40 [&_select]:text-gray-800"
          >
            {SPECIES_OPTIONS.map((option) => (
              <option key={option.file} value={option.file}>
                {option.label}
              </option>
            ))}
          </Select>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,_#f7fff7_0%,_#fffdfa_100%)] p-4 text-sm text-gray-700">
            <div className="font-semibold text-gray-900">Current specimen table</div>
            <div className="mt-1 font-mono text-xs text-emerald-700">
              gene_annotation_{annotationTableSuffix(selectedSpecies)}
            </div>
            {tableData && (
              <div className="mt-4 grid gap-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span className="text-gray-500">Total genes</span>
                  <span className="font-semibold text-gray-900">{tableData.rows.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                  <span className="text-gray-500">Search matches</span>
                  <span className="font-semibold text-gray-900">{filteredRows.length}</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 text-xs leading-6 text-amber-900">
            <div className="font-semibold">Orchid reading tips</div>
            <p className="mt-2">
              Use short keywords such as a gene ID, Pfam domain, KEGG KO, or a biological term
              from the description column to quickly filter the current species table.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[24px] border border-fuchsia-100 bg-white/95 p-4 shadow-[0_12px_40px_-24px_rgba(168,85,247,0.35)] sm:flex-row">
            <TextInput
              icon={HiSearch}
              placeholder="Search gene ID, description, KO, Pfam..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearch();
                }
              }}
              className="flex-1 [&_input]:rounded-xl [&_input]:border-fuchsia-200 [&_input]:bg-fuchsia-50/30"
            />
            <Button
              onClick={handleSearch}
              className="rounded-xl border-0 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:via-fuchsia-600 hover:to-amber-500"
            >
              Search
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-rose-100 bg-white/95 shadow-[0_12px_40px_-24px_rgba(225,29,72,0.3)]">
              <div className="flex flex-col items-center gap-3">
                <Spinner size="xl" />
                <div className="text-sm text-gray-500">Preparing orchid annotation petals…</div>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <div className="space-y-4 rounded-[24px] border border-emerald-100 bg-white/95 p-4 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.28)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{selectedLabel}</div>
                  <div className="text-sm text-gray-500">
                    {searchTerm
                      ? `Filtered by "${searchTerm}"`
                      : "Showing the full annotation catalogue for this species"}
                  </div>
                </div>
                <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Gene annotation matrix
                </div>
              </div>

              <div className="overflow-hidden rounded-[20px] border border-gray-100">
                <div className="max-h-[72vh] overflow-auto">
                  <Table hoverable>
                    <TableHead className="sticky top-0 z-10 bg-gradient-to-r from-rose-50 via-white to-emerald-50">
                    {headers.map((header) => (
                      <TableHeadCell
                        key={header}
                        className="border-b border-rose-100 bg-transparent text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600"
                      >
                        {header}
                      </TableHeadCell>
                    ))}
                    </TableHead>
                    <TableBody className="divide-y">
                    {pagedRows.length === 0 && (
                      <TableRow className="bg-white">
                        <TableCell
                          colSpan={Math.max(headers.length, 1)}
                          className="py-14 text-center text-sm text-gray-500"
                        >
                          No annotation rows matched the current search.
                        </TableCell>
                      </TableRow>
                    )}
                    {pagedRows.map((row, rowIndex) => (
                      <TableRow
                        key={`${selectedSpecies}-${page}-${rowIndex}`}
                        className={rowIndex % 2 === 0 ? "bg-white" : "bg-rose-50/20"}
                      >
                        {row.map((cell, cellIndex) => (
                          <TableCell
                            key={`${selectedSpecies}-${rowIndex}-${cellIndex}`}
                            className={`max-w-[360px] align-top text-xs leading-6 text-gray-700 ${
                              cellIndex === 0 ? "font-semibold text-rose-700" : ""
                            }`}
                          >
                            <div className="break-words whitespace-pre-wrap rounded-lg px-1 py-0.5">
                              {cell || "-"}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-rose-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {filteredRows.length === 0
                    ? "Showing 0 of 0 rows"
                    : `Showing ${(page - 1) * PAGE_SIZE + 1} - ${Math.min(
                        page * PAGE_SIZE,
                        filteredRows.length
                      )} of ${filteredRows.length} rows`}
                </div>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  showIcons
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
