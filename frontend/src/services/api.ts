import axios from 'axios';

const LOCAL_API_BASE_URL = 'http://localhost:5000/api';

const isLocalHostname = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const getApiBaseUrl = () => {
  const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window === 'undefined') {
    return LOCAL_API_BASE_URL;
  }

  if (isLocalHostname(window.location.hostname)) {
    return LOCAL_API_BASE_URL;
  }

  return '/api';
};

export const getBackendConnectionMessage = () => {
  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return 'Cannot connect to the backend. Start the backend server on http://localhost:5000 and try again.';
  }

  return 'Cannot connect to the backend. Check that the backend is deployed and the API URL is configured correctly, then try again.';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface InventoryItem {
  id: number;
  barcode: string;
  batchNo: string;
  stackNo: string;
  expectedQuantity: number;
  scannedQuantity: number;
  difference: number;
}

export interface UploadValidationError {
  rowNumber: number;
  message: string;
}

export interface BatchScanSubmitResponse {
  message: string;
  batchNo: string;
  stockNos: string[];
  scannedQuantity: number;
  items: InventoryItem[];
}

export const authApi = {
  signup: (username: string, email: string, password: string) =>
    api.post('/auth/signup', { username, email, password }),
  signin: (email: string, password: string) => api.post('/auth/signin', { email, password }),
  forgotPassword: (email: string, password: string) =>
    api.post('/auth/forgot-password', { email, password }),
  me: () => api.get('/auth/me'),
};

export const inventoryApi = {
  uploadFile: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/inventory/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress?.(progress);
        }
      },
    });
  },
  getAll: () => api.get<InventoryItem[]>('/inventory/all'),
  getByBarcode: (barcode: string) => api.get<InventoryItem>(`/inventory/${barcode}`),
  exportAll: () =>
    api.get('/inventory/export', {
      responseType: 'blob',
    }),
};

export const scansApi = {
  recordScan: (barcode: string) => api.post('/scans', { barcode }),
  submitBatchScan: (batchNo: string, stockNos: string[]) =>
    api.post<BatchScanSubmitResponse>('/scans/batch-submit', { batchNo, stockNos }),
  getUserScans: () => api.get('/scans'),
  getSummary: () => api.get('/scans/summary'),
};

export const reportsApi = {
  getReport: () => api.get('/reports'),
};

export default api;
