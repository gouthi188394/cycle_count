import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import Header from '../components/Header';
import { inventoryApi, reportsApi, type InventoryItem } from '../services/api';

interface ReportSummary {
  accuracyPercent: number;
  completedCount: number;
  pendingCount: number;
  mismatchCount: number;
  totalInventory: number;
  overScannedCount: number;
  underScannedCount: number;
  exactMatchCount: number;
}

export default function ReportPage() {
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'matched' | 'mismatch'>('all');

  useEffect(() => {
    const loadReport = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await reportsApi.getReport();
        setRows(response.data.rows);
        setSummary(response.data.summary);
      } catch {
        setError('Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, []);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch =
          row.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          row.stackNo.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;
        if (filter === 'all') return true;
        if (filter === 'pending') return row.scannedQuantity === 0;
        if (filter === 'matched') return row.difference === 0 && row.scannedQuantity > 0;
        return row.difference !== 0 && row.scannedQuantity > 0;
      }),
    [filter, rows, searchTerm]
  );

  const handleExport = async () => {
    try {
      const response = await inventoryApi.exportAll();
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'inventory-cycle-count.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export Excel report');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Cycle Count Report</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Review expected vs scanned quantities and export the latest values to Excel.
            </p>
          </div>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-100">
            {error}
          </div>
        )}

        {summary && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Inventory</p>
              <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{summary.totalInventory}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Items</p>
              <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">{summary.pendingCount}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Matched Items</p>
              <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{summary.completedCount}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-md dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Mismatch Items</p>
              <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">{summary.mismatchCount}</p>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-md dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search barcode, batch no, or stack no"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'matched', 'mismatch'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-lg px-4 py-2 font-medium transition ${
                    filter === option
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-md dark:bg-gray-800">
          <div className="border-b border-gray-200 bg-gray-100 px-6 py-4 dark:border-gray-700 dark:bg-gray-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
              Report Records ({filteredRows.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Barcode</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Batch No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Stack No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Expected</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Scanned</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                      No report rows found.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-mono text-blue-600 dark:text-blue-400">{row.barcode}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.batchNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.stackNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.expectedQuantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{row.scannedQuantity}</td>
                      <td
                        className={`px-6 py-4 text-sm font-semibold ${
                          row.difference === 0
                            ? 'text-green-600 dark:text-green-400'
                            : row.difference > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {row.difference}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
