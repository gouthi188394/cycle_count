import { useRef, useState } from 'react';
import { AxiosError } from 'axios';
import { Download, Upload } from 'lucide-react';
import Header from '../components/Header';
import { inventoryApi } from '../services/api';

const TEMPLATE_CONTENT = `BARCODE,BATCHNO,STOCKNO,CLOSINGQTY
11011,SECOND,SEC-1,106
11012,SECONDS,SEC-1,294
11013,SECOND,SEC-2,175`;

export default function InventoryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  const getErrorMessage = (error: unknown) => {
    const axiosError = error as AxiosError<{ error?: string }>;
    if (!axiosError.response) {
      return 'Cannot connect to the backend. Start the backend server on http://localhost:5000 and try again.';
    }

    return axiosError.response.data?.error || 'Failed to upload file';
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cycle-count-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      const response = await inventoryApi.uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });

      setSuccess(`Successfully imported ${response.data.recordsInserted} items`);
      setFileName(file.name);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Inventory Management</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Upload Excel file to manage inventory data for cycle counting.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900 dark:text-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg bg-green-100 p-4 text-green-700 dark:bg-green-900 dark:text-green-200">
            {success}
          </div>
        )}

        <div className="rounded-lg border-l-4 border-blue-500 bg-white p-8 shadow-md dark:bg-gray-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">Upload Excel File</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Required columns: BARCODE, BATCHNO, STOCKNO, CLOSINGQTY
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-6 py-2 font-semibold text-white transition hover:bg-green-600"
              >
                <Download size={18} />
                Download Template
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-2 font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? <Upload size={18} className="animate-spin" /> : <Upload size={18} />}
                {loading ? 'Uploading...' : 'Upload Inventory'}
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-lg border-2 border-dashed border-gray-300 p-10 text-center dark:border-gray-600">
            <Upload className="mx-auto mb-4 h-14 w-14 text-gray-400" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Click upload button to import inventory from Excel
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Required columns: BARCODE, BATCHNO, STOCKNO, CLOSINGQTY
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Supported formats: CSV, XLSX, XLS
            </p>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Uploading: {uploadProgress}%</p>
              </div>
            )}
            {fileName && (
              <p className="mt-4 text-sm font-medium text-green-600 dark:text-green-400">
                Last uploaded: {fileName}
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
      </main>
    </div>
  );
}
