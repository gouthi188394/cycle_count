import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle, Clock3, Package, TrendingDown, TrendingUp } from 'lucide-react';
import Header from '../components/Header';
import { inventoryApi, scansApi, type InventoryItem } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface Summary {
  totalScans: number;
  uniqueBarcodes: number;
  pendingCount: number;
  completedCount: number;
  mismatchCount: number;
  totalInventory: number;
  completionPercent: number;
  accuracyPercent: number;
  overScannedCount: number;
  underScannedCount: number;
  exactMatchCount: number;
}

interface ScanRecord {
  barcode: string;
  scanned_qty: number;
  difference: number;
  batch_no: string;
  stack_no: string;
  expected_quantity: number;
}

const EMPTY_SUMMARY: Summary = {
  totalScans: 0,
  uniqueBarcodes: 0,
  pendingCount: 0,
  completedCount: 0,
  mismatchCount: 0,
  totalInventory: 0,
  completionPercent: 0,
  accuracyPercent: 0,
  overScannedCount: 0,
  underScannedCount: 0,
  exactMatchCount: 0,
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [lastScannedRecord, setLastScannedRecord] = useState<ScanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const buildFallbackSummary = async (): Promise<Summary> => {
      const response = await inventoryApi.getAll();
      const rows: InventoryItem[] = response.data;

      const totalInventory = rows.length;
      const pendingCount = rows.filter((row) => row.scannedQuantity === 0).length;
      const completedCount = rows.filter(
        (row) => row.scannedQuantity > 0 && row.difference === 0
      ).length;
      const mismatchCount = rows.filter(
        (row) => row.scannedQuantity > 0 && row.difference !== 0
      ).length;
      const overScannedCount = rows.filter((row) => row.scannedQuantity > row.expectedQuantity).length;
      const underScannedCount = rows.filter(
        (row) => row.scannedQuantity > 0 && row.scannedQuantity < row.expectedQuantity
      ).length;
      const exactMatchCount = completedCount;
      const totalScans = rows.reduce((sum, row) => sum + row.scannedQuantity, 0);
      const uniqueBarcodes = rows.filter((row) => row.scannedQuantity > 0).length;

      return {
        totalScans,
        uniqueBarcodes,
        pendingCount,
        completedCount,
        mismatchCount,
        totalInventory,
        completionPercent:
          totalInventory === 0 ? 0 : Math.round(((totalInventory - pendingCount) / totalInventory) * 100),
        accuracyPercent:
          totalInventory === 0 ? 0 : Math.round((exactMatchCount / totalInventory) * 100),
        overScannedCount,
        underScannedCount,
        exactMatchCount,
      };
    };

    const fetchSummary = async () => {
      try {
        try {
          const [summaryResponse, scansResponse] = await Promise.all([
            scansApi.getSummary(),
            scansApi.getUserScans(),
          ]);
          setSummary(summaryResponse.data);
          const scans = (scansResponse.data || []) as ScanRecord[];
          setLastScannedRecord(scans.length > 0 ? scans[scans.length - 1] : null);
          setStatusMessage('');
        } catch {
          const fallbackSummary = await buildFallbackSummary();
          setSummary(fallbackSummary);
          try {
            const scansResponse = await scansApi.getUserScans();
            const scans = (scansResponse.data || []) as ScanRecord[];
            setLastScannedRecord(scans.length > 0 ? scans[scans.length - 1] : null);
          } catch {
            setLastScannedRecord(null);
          }
          setStatusMessage('Showing dashboard data from inventory records.');
        }
      } catch {
        setSummary(EMPTY_SUMMARY);
        setLastScannedRecord(null);
        setStatusMessage('No dashboard data available yet. Upload inventory or start scanning to see live numbers.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
    const interval = window.setInterval(fetchSummary, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome back, {user?.username || 'User'}. Here is the live inventory cycle count status.
            </p>
          </div>

        </div>

        {statusMessage && (
          <div className="mb-6 rounded-xl bg-blue-100 p-4 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {statusMessage}
          </div>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-md dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Accuracy</p>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{summary.accuracyPercent}%</p>
                  </div>
                  <BarChart3 className="text-blue-500" size={40} />
                </div>
              </div>

              <div className="rounded-lg border-l-4 border-green-500 bg-white p-6 shadow-md dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Exact Match Count</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">{summary.exactMatchCount}</p>
                  </div>
                  <CheckCircle className="text-green-500" size={40} />
                </div>
              </div>

              <div className="rounded-lg border-l-4 border-red-500 bg-white p-6 shadow-md dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Under Scanned</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{summary.underScannedCount}</p>
                  </div>
                  <TrendingDown className="text-red-500" size={40} />
                </div>
              </div>

              <div className="rounded-lg border-l-4 border-indigo-500 bg-white p-6 shadow-md dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Over Scanned</p>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{summary.overScannedCount}</p>
                  </div>
                  <TrendingUp className="text-indigo-500" size={40} />
                </div>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Inventory</p>
                <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{summary.totalInventory}</p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Items</p>
                <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">{summary.pendingCount}</p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed Items</p>
                <p className="mt-2 text-3xl font-bold text-green-600 dark:text-green-400">{summary.completedCount}</p>
              </div>
              <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">Mismatch Items</p>
                <p className="mt-2 text-3xl font-bold text-red-600 dark:text-red-400">{summary.mismatchCount}</p>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cycle Count Progress</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Completion is based on items with a `scannedQuantity` greater than zero.
                  </p>
                </div>
                <span className="text-2xl font-bold text-blue-500">{summary.completionPercent}%</span>
              </div>

              <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                  style={{ width: `${summary.completionPercent}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-gray-600 dark:text-gray-400 md:grid-cols-4">
                <div className="flex items-center gap-2">
                  <Clock3 size={16} />
                  Pending: {summary.pendingCount}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  Completed: {summary.completedCount}
                </div>
                <div className="flex items-center gap-2">
                  <Package size={16} />
                  Total Scans: {summary.totalScans}
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  Unique Barcodes: {summary.uniqueBarcodes}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Last Scanned Data</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Detailed view of the most recent scanned record.
                </p>
              </div>

              {lastScannedRecord ? (
                <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Barcode</p>
                    <p className="mt-1 font-mono text-base font-semibold text-blue-600 dark:text-blue-400">
                      {lastScannedRecord.barcode}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Batch No</p>
                    <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white">
                      {lastScannedRecord.batch_no}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Stack No</p>
                    <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white">
                      {lastScannedRecord.stack_no}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Expected Quantity</p>
                    <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white">
                      {lastScannedRecord.expected_quantity}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Scanned Quantity</p>
                    <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white">
                      {lastScannedRecord.scanned_qty}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700">
                    <p className="text-gray-500 dark:text-gray-300">Difference</p>
                    <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white">
                      {lastScannedRecord.difference}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  No scan data available yet.
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
