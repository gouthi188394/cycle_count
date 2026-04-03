import { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Download, Upload } from 'lucide-react';
import Header from '../components/Header';
import { inventoryApi, type InventoryItem, type UploadValidationError } from '../services/api';

const TEMPLATE_CONTENT = `Stock No,Batch No,Closing Qty
BC01963,BCT002,45
BC01964,BCT003,79
BC01965,BCT004,15
BC01962,BCT001,100
SEC-1,SECOND,106
SEC-1,SECONDS,294`;

export default function InventoryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableMessage, setTableMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [savedFilePath, setSavedFilePath] = useState('');
  const [validationErrors, setValidationErrors] = useState<UploadValidationError[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchNoInput, setBatchNoInput] = useState('');

  const loadInventory = async () => {
    try {
      setTableLoading(true);
      const response = await inventoryApi.getAll();
      setInventory(response.data);
      setTableMessage('');
    } catch {
      setInventory([]);
      setTableMessage('Inventory data is not available yet. You can still upload a file.');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const normalizedBatchNoInput = batchNoInput.trim().toLowerCase();
  const batchSuggestions = Array.from(new Set(inventory.map((item) => item.batchNo.trim()).filter(Boolean)))
    .filter((batchNo) => batchNo.toLowerCase().includes(normalizedBatchNoInput))
    .sort((left, right) => {
      const leftStartsWith = left.toLowerCase().startsWith(normalizedBatchNoInput);
      const rightStartsWith = right.toLowerCase().startsWith(normalizedBatchNoInput);

      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1;
      }

      return left.localeCompare(right);
    })
    .slice(0, 12);

  const filteredInventory = normalizedBatchNoInput
    ? inventory.filter((item) => item.batchNo.toLowerCase().includes(normalizedBatchNoInput))
    : inventory;

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventory-cycle-count-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setValidationErrors([]);

    try {
      const response = await inventoryApi.uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });
      setSuccess(`Imported ${response.data.recordsInserted} inventory rows successfully.`);
      setFileName(response.data.fileName || file.name);
      setSavedFilePath(response.data.savedFilePath || '');
      await loadInventory();
    } catch (err) {
      const axiosError = err as AxiosError<{
        error?: string;
        errors?: UploadValidationError[];
        fileName?: string;
        savedFilePath?: string;
      }>;

      if (!axiosError.response) {
        setError('Cannot connect to the backend. Start the backend server and try again.');
      } else {
        setError(axiosError.response.data?.error || 'Failed to upload file');
        setValidationErrors(axiosError.response.data?.errors || []);
        setFileName(axiosError.response.data?.fileName || file.name);
        setSavedFilePath(axiosError.response.data?.savedFilePath || '');
      }
    } finally {
      setLoading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Inventory Upload</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Upload inventory in the format <code>Stock No</code>, <code>Batch No</code>, <code>Closing Qty</code>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700"
            >
              <Download size={18} />
              Download Template
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload size={18} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Uploading...' : 'Upload Excel'}
            </button>
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-white p-6 shadow-md dark:bg-gray-800">
          <div className="rounded-xl border-2 border-dashed border-gray-300 p-10 text-center dark:border-gray-600">
            <Upload className="mx-auto mb-4 h-14 w-14 text-gray-400" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Upload `.xlsx`, `.xls`, or `.csv` inventory data
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Required columns: Stock No, Batch No, Closing Qty
            </p>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-6">
                <div className="h-2 w-full bg-gray-300 rounded-full overflow-hidden dark:bg-gray-600">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Uploading: {uploadProgress}%</p>
              </div>
            )}
            {fileName && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Last processed file: {fileName}
              </p>
            )}
            {savedFilePath && (
              <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">
                Saved file path: {savedFilePath}
              </p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            disabled={loading}
            className="hidden"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-100 p-4 text-red-800 dark:bg-red-900 dark:text-red-100">
            <p className="font-semibold">{error}</p>
            {validationErrors.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {validationErrors.map((item, index) => (
                  <li key={`${item.rowNumber}-${index}`}>
                    Row {item.rowNumber}: {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl bg-green-100 p-4 text-green-800 dark:bg-green-900 dark:text-green-100">
            {success}
          </div>
        )}

        {tableMessage && (
          <div className="mb-6 rounded-xl bg-blue-100 p-4 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            {tableMessage}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow-md dark:bg-gray-800">
          <div className="border-b border-gray-200 bg-gray-100 px-6 py-4 dark:border-gray-700 dark:bg-gray-700">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Inventory Records ({filteredInventory.length})
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Inventory view with Stock No, Batch No, and Closing Qty columns
                </p>
              </div>

              <div className="w-full max-w-md">
                <label
                  htmlFor="inventory-batchno-input"
                  className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Batch No
                </label>
                <input
                  id="inventory-batchno-input"
                  list="inventory-batchno-suggestions"
                  value={batchNoInput}
                  onChange={(event) => setBatchNoInput(event.target.value)}
                  placeholder="Type batch no like 2F-D-R4-115"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <datalist id="inventory-batchno-suggestions">
                  {batchSuggestions.map((batchNo) => (
                    <option key={batchNo} value={batchNo} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Stock No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Batch No</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Closing Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tableLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                      {normalizedBatchNoInput
                        ? 'No inventory records match that Batch No.'
                        : tableMessage || 'No inventory records uploaded yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.stackNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">{item.batchNo}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{item.expectedQuantity}</td>
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
