import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Camera, CheckCircle2, ScanLine } from 'lucide-react';
import Header from '../components/Header';
import { inventoryApi, scansApi, type InventoryItem } from '../services/api';
import { isValidBarcode, startBarcodeScanner, stopBarcodeScanner } from '../utils/barcodeScanner';

interface AlertMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface SubmittedCycle {
  batchNo: string;
  stockNos: string[];
  scannedQuantity: number;
  closingQuantity: string;
}

type ScanMatch =
  | { type: 'batch'; batchNo: string }
  | { type: 'stock'; item: InventoryItem; matchedBy: 'stockNo' | 'barcode' }
  | { type: 'unknown' };

const triggerFeedback = (success: boolean) => {
  if (navigator.vibrate) {
    navigator.vibrate(success ? [80] : [120, 80, 120]);
  }
};

const playBeep = (success: boolean) => {
  const AudioContextClass = window.AudioContext || (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = success ? 920 : 320;
  gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + (success ? 0.12 : 0.18));

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + (success ? 0.12 : 0.18));
  oscillator.onended = () => {
    void audioContext.close();
  };
};

const normalizeValue = (value: string) => value.trim().toLowerCase();

const findMatchingBatchNo = (inventory: InventoryItem[], value: string) => {
  const normalizedValue = normalizeValue(value);
  return inventory.find((item) => normalizeValue(item.batchNo) === normalizedValue)?.batchNo ?? null;
};

const findMatchingStockItem = (inventory: InventoryItem[], value: string) => {
  const normalizedValue = normalizeValue(value);

  return inventory.find((item) => normalizeValue(item.stackNo) === normalizedValue) ?? null;
};

const findMatchingBarcodeItem = (inventory: InventoryItem[], value: string) => {
  const normalizedValue = normalizeValue(value);
  return inventory.find((item) => normalizeValue(item.barcode) === normalizedValue) ?? null;
};

const findMatchingBatchFromBarcode = (inventory: InventoryItem[], value: string) => {
  const normalizedValue = normalizeValue(value);
  const matchingItems = inventory.filter((item) => normalizeValue(item.barcode) === normalizedValue);

  if (matchingItems.length === 0) {
    return null;
  }

  const uniqueBatchNos = Array.from(
    new Set(matchingItems.map((item) => item.batchNo.trim()).filter(Boolean))
  );

  return uniqueBatchNos.length === 1 ? uniqueBatchNos[0] : null;
};

const resolveScanMatch = (
  inventory: InventoryItem[],
  batchLookup: Map<string, string>,
  batchBarcodeLookup: Map<string, string>,
  stockLookup: Map<string, InventoryItem>,
  barcodeLookup: Map<string, InventoryItem>,
  value: string
): ScanMatch => {
  const normalizedScannedValue = normalizeValue(value);
  const matchedBatchNo =
    batchLookup.get(normalizedScannedValue) ||
    batchBarcodeLookup.get(normalizedScannedValue) ||
    findMatchingBatchNo(inventory, value) ||
    findMatchingBatchFromBarcode(inventory, value);

  if (matchedBatchNo) {
    return { type: 'batch', batchNo: matchedBatchNo };
  }

  const matchedStockItem = stockLookup.get(normalizedScannedValue) || findMatchingStockItem(inventory, value);
  if (matchedStockItem) {
    return { type: 'stock', item: matchedStockItem, matchedBy: 'stockNo' };
  }

  const matchedBarcodeItem = barcodeLookup.get(normalizedScannedValue) || findMatchingBarcodeItem(inventory, value);
  if (matchedBarcodeItem) {
    return { type: 'stock', item: matchedBarcodeItem, matchedBy: 'barcode' };
  }

  return { type: 'unknown' };
};

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scanLockRef = useRef(false);
  const pendingScansRef = useRef<string[]>([]);
  const drainingQueueRef = useRef(false);
  const lastDataNotFoundPopupAtRef = useRef(0);
  const scanningHintTimeoutRef = useRef<number | null>(null);

  const [scanValue, setScanValue] = useState('');
  const [manualBatchValue, setManualBatchValue] = useState('');
  const [manualStockValue, setManualStockValue] = useState('');
  const [lastDecodedValue, setLastDecodedValue] = useState('');
  const [batchNoInput, setBatchNoInput] = useState('');
  const [scannedStockNos, setScannedStockNos] = useState<string[]>([]);
  const [closingQuantityInput, setClosingQuantityInput] = useState('0');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [lastDetectedItem, setLastDetectedItem] = useState<InventoryItem | null>(null);
  const [lastSubmittedCycle, setLastSubmittedCycle] = useState<SubmittedCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraInfo, setCameraInfo] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [alert, setAlert] = useState<AlertMessage | null>(null);

  const stockNoInput = scannedStockNos.join(', ');
  const normalizedManualBatchValue = normalizeValue(manualBatchValue);
  const normalizedManualStockValue = normalizeValue(manualStockValue);
  const batchSuggestions = manualBatchValue.trim()
    ? Array.from(
        new Set(
          inventory
            .map((item) => item.batchNo.trim())
            .filter((batchNo) => batchNo && normalizeValue(batchNo).includes(normalizedManualBatchValue))
        )
      ).slice(0, 8)
    : [];
  const stockSuggestions = manualStockValue.trim()
    ? Array.from(
        new Set(
          inventory
            .map((item) => item.stackNo.trim())
            .filter((stockNo) => stockNo && normalizeValue(stockNo).includes(normalizedManualStockValue))
        )
      ).slice(0, 8)
    : [];
  const manualBatchItems = normalizedManualBatchValue
    ? inventory.filter((item) => normalizeValue(item.batchNo) === normalizedManualBatchValue)
    : [];
  const manualBatchStockNos = manualBatchItems.map((item) => item.stackNo);
  const manualBatchSummary = manualBatchItems.reduce(
    (summary, item) => {
      summary.expectedQuantity += item.expectedQuantity;
      summary.scannedQuantity += item.scannedQuantity;
      return summary;
    },
    { expectedQuantity: 0, scannedQuantity: 0 }
  );
  const batchLookup = new Map<string, string>();
  const batchBarcodeLookup = new Map<string, string>();
  const ambiguousBatchBarcodeKeys = new Set<string>();
  const stockLookup = new Map<string, InventoryItem>();
  const barcodeLookup = new Map<string, InventoryItem>();

  inventory.forEach((item) => {
    batchLookup.set(normalizeValue(item.batchNo), item.batchNo);
    stockLookup.set(normalizeValue(item.stackNo), item);
    barcodeLookup.set(normalizeValue(item.barcode), item);

    const normalizedBarcode = normalizeValue(item.barcode);
    if (!normalizedBarcode || ambiguousBatchBarcodeKeys.has(normalizedBarcode)) {
      return;
    }

    const existingBatchForBarcode = batchBarcodeLookup.get(normalizedBarcode);
    if (!existingBatchForBarcode) {
      batchBarcodeLookup.set(normalizedBarcode, item.batchNo);
    } else if (normalizeValue(existingBatchForBarcode) !== normalizeValue(item.batchNo)) {
      batchBarcodeLookup.delete(normalizedBarcode);
      ambiguousBatchBarcodeKeys.add(normalizedBarcode);
    }
  });

  const manualStockItem = normalizedManualStockValue
    ? stockLookup.get(normalizedManualStockValue) || findMatchingStockItem(inventory, manualStockValue)
    : null;

  const loadInventory = async () => {
    try {
      const response = await inventoryApi.getAll();
      setInventory(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory().catch(() => {
      setAlert({ type: 'error', message: 'Failed to load inventory records.' });
      setLoading(false);
    });

    return () => {
      if (scanningHintTimeoutRef.current !== null) {
        window.clearTimeout(scanningHintTimeoutRef.current);
      }
      if (videoRef.current) {
        stopBarcodeScanner(videoRef.current);
      }
    };
  }, []);

  const clearScanningTimeouts = () => {
    if (scanningHintTimeoutRef.current !== null) {
      window.clearTimeout(scanningHintTimeoutRef.current);
      scanningHintTimeoutRef.current = null;
    }
  };

  const scheduleScanningMessage = (delay = 0) => {
    if (scanningHintTimeoutRef.current !== null) {
      window.clearTimeout(scanningHintTimeoutRef.current);
    }

    scanningHintTimeoutRef.current = window.setTimeout(() => {
      setAlert({ type: 'info', message: 'Scanning... Please align barcode inside box' });
    }, delay);
  };

  const finishScanAttempt = () => {
    setScanValue('');
    inputRef.current?.focus();
    window.setTimeout(() => {
      scanLockRef.current = false;
      if (pendingScansRef.current.length > 0) {
        const nextScan = pendingScansRef.current.shift();
        if (nextScan) {
          drainingQueueRef.current = true;
          processScannedValue(nextScan);
          return;
        }
      }
      drainingQueueRef.current = false;
    }, 100);
  };

  const showDataNotFoundPopup = () => {
    const now = Date.now();
    if (now - lastDataNotFoundPopupAtRef.current < 1200) {
      return;
    }

    lastDataNotFoundPopupAtRef.current = now;
    window.alert('Data not found in file');
  };

  const appendScannedStock = (item: InventoryItem, matchedBy: 'stockNo' | 'barcode') => {
    setScannedStockNos((currentStockNos) => {
      const nextStockNos = [...currentStockNos, item.stackNo];
      setClosingQuantityInput(String(nextStockNos.length));
      return nextStockNos;
    });

    setLastDetectedItem(item);

    const nextCount =
      scannedStockNos.filter((stockNo) => normalizeValue(stockNo) === normalizeValue(item.stackNo)).length + 1;

    const stockReference = matchedBy === 'barcode' ? `Barcode ${item.barcode}` : `Stock No ${item.stackNo}`;
    setAlert({
      type: 'success',
      message:
        nextCount > 1
          ? `${stockReference} scanned ${nextCount} times.`
          : `${stockReference} stored successfully.`,
    });
    triggerFeedback(true);
    playBeep(true);
    scheduleScanningMessage(1500);
    finishScanAttempt();
  };

  const processScannedValue = (rawValue: string) => {
    const nextValue = rawValue.trim();
    if (!nextValue || loading || scanLockRef.current) {
      return;
    }

    scanLockRef.current = true;
    setLastDecodedValue(nextValue);
    setAlert(null);
    setCameraError('');

    if (!isValidBarcode(nextValue)) {
      setLastDetectedItem(null);
      setAlert({ type: 'error', message: 'Data not found in file' });
      showDataNotFoundPopup();
      triggerFeedback(false);
      playBeep(false);
      scheduleScanningMessage(1500);
      finishScanAttempt();
      return;
    }

    const scanMatch = resolveScanMatch(
      inventory,
      batchLookup,
      batchBarcodeLookup,
      stockLookup,
      barcodeLookup,
      nextValue
    );

    if (scanMatch.type === 'batch') {
      const { batchNo: matchedBatchNo } = scanMatch;
      const currentBatchNo = batchNoInput.trim();
      const hasCurrentStocks = scannedStockNos.length > 0;
      const isSameBatch = Boolean(currentBatchNo) && normalizeValue(currentBatchNo) === normalizeValue(matchedBatchNo);

      if (isSameBatch) {
        setLastDetectedItem(null);
        setAlert({ type: 'info', message: `Batch ${matchedBatchNo} is already selected.` });
        scheduleScanningMessage(1500);
        finishScanAttempt();
        return;
      }

      const isSwitchingBatch = Boolean(currentBatchNo) && normalizeValue(currentBatchNo) !== normalizeValue(matchedBatchNo);

      if (isSwitchingBatch && hasCurrentStocks) {
        setLastDetectedItem(null);
        setAlert({
          type: 'warning',
          message: `Batch ${currentBatchNo} already has scanned stock numbers. Submit it before scanning batch ${matchedBatchNo}.`,
        });
        triggerFeedback(false);
        playBeep(false);
        scheduleScanningMessage(1500);
        finishScanAttempt();
        return;
      }

      if (!currentBatchNo && hasCurrentStocks) {
        const scannedStockItems = scannedStockNos
          .map((stockNo) => stockLookup.get(normalizeValue(stockNo)) || findMatchingStockItem(inventory, stockNo))
          .filter((item): item is InventoryItem => Boolean(item));
        const hasOutOfBatchStocks = scannedStockItems.some(
          (item) => normalizeValue(item.batchNo) !== normalizeValue(matchedBatchNo)
        );

        if (hasOutOfBatchStocks) {
          setLastDetectedItem(null);
          setAlert({
            type: 'warning',
            message: `Scanned stock numbers do not belong to batch ${matchedBatchNo}. Clear them or scan the correct batch.`,
          });
          triggerFeedback(false);
          playBeep(false);
          scheduleScanningMessage(1500);
          finishScanAttempt();
          return;
        }
      }

      setBatchNoInput(matchedBatchNo);
      setLastDetectedItem(null);
      setAlert({
        type: 'success',
        message: `Batch ${matchedBatchNo} selected successfully.`,
      });
      triggerFeedback(true);
      playBeep(true);
      scheduleScanningMessage(1500);
      finishScanAttempt();
      return;
    }

    if (scanMatch.type === 'unknown') {
      setLastDetectedItem(null);
      setAlert({
        type: 'error',
        message: 'Data not found in file',
      });
      showDataNotFoundPopup();
      triggerFeedback(false);
      playBeep(false);
      scheduleScanningMessage(1500);
      finishScanAttempt();
      return;
    }

    const { item: resolvedStockItem, matchedBy } = scanMatch;

    if (!batchNoInput.trim()) {
      appendScannedStock(resolvedStockItem, matchedBy);
      return;
    }

    if (normalizeValue(resolvedStockItem.batchNo) !== normalizeValue(batchNoInput)) {
      setLastDetectedItem(null);
      setAlert({
        type: 'warning',
        message: `${resolvedStockItem.stackNo} does not belong to batch ${batchNoInput}.`,
      });
      triggerFeedback(false);
      playBeep(false);
      scheduleScanningMessage(1500);
      finishScanAttempt();
      return;
    }

    appendScannedStock(resolvedStockItem, matchedBy);
  };

  const handleDetectedBarcode = (detectedBarcode: string) => {
    const nextValue = detectedBarcode.trim();
    if (!nextValue) {
      return;
    }

    setLastDecodedValue(nextValue);
    setScanValue(nextValue);
    scheduleScanningMessage(1500);
    setCameraError('');
    setAlert({ type: 'success', message: `Barcode detected: ${nextValue}` });

    if (scanLockRef.current) {
      pendingScansRef.current.push(nextValue);
      return;
    }

    drainingQueueRef.current = true;
    processScannedValue(nextValue);
  };

  const startCamera = async () => {
    try {
      clearScanningTimeouts();
      setCameraError('');
      setCameraInfo('');
      if (videoRef.current && canvasRef.current) {
        const result = await startBarcodeScanner(videoRef.current, canvasRef.current, handleDetectedBarcode);
        setIsCameraActive(true);
        setCameraInfo(
          result.autoDetectSupported
            ? 'Camera is active. Native barcode detection is running.'
            : result.fallbackDecodeSupported
              ? 'Camera is active. Using fallback barcode decoder, so scans may be a little slower.'
              : ''
        );
        setAlert({ type: 'info', message: 'Scanning... Please align barcode inside box' });
      }
    } catch (err: any) {
      const message =
        err?.message === 'Camera permission is required'
          ? 'Camera permission is required'
          : err?.message || 'Unable to access camera. Please try again';
      setCameraError(message);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    clearScanningTimeouts();
    if (videoRef.current) {
      stopBarcodeScanner(videoRef.current);
    }
    setCameraInfo('');
    setCameraError('');
    setAlert(null);
    setIsCameraActive(false);
  };

  const submitScannedCycle = async () => {
    const nextBatchNo = batchNoInput.trim();
    if (scannedStockNos.length === 0) {
      setAlert({ type: 'error', message: 'Scan at least one stock number before submitting.' });
      triggerFeedback(false);
      inputRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setAlert(null);

      const response = await scansApi.submitBatchScan(nextBatchNo, scannedStockNos);
      const savedCycle = response.data;

      setLastSubmittedCycle({
        batchNo: savedCycle.batchNo,
        stockNos: savedCycle.stockNos,
        scannedQuantity: savedCycle.scannedQuantity,
        closingQuantity: closingQuantityInput,
      });
      setLastDetectedItem(null);
      setScannedStockNos([]);
      setBatchNoInput('');
      setScanValue('');
      setClosingQuantityInput('0');
      setAlert({
        type: 'success',
        message: `Saved batch ${savedCycle.batchNo} with ${savedCycle.scannedQuantity} scanned stock number(s).`,
      });
      triggerFeedback(true);
      playBeep(true);
      await loadInventory();
      inputRef.current?.focus();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Failed to submit scanned batch';
      setAlert({ type: 'error', message });
      triggerFeedback(false);
      playBeep(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <section className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-md dark:bg-gray-800">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Scanner</h1>

          {alert && (
            <div
              className={`mt-6 flex items-start gap-3 rounded-xl p-4 text-sm ${
                alert.type === 'success'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                  : alert.type === 'info'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100'
                  : alert.type === 'warning'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-100'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
              }`}
            >
              {alert.type === 'success' ? (
                <CheckCircle2 size={18} />
              ) : alert.type === 'info' ? (
                <ScanLine size={18} />
              ) : alert.type === 'warning' ? (
                <AlertTriangle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{alert.message}</span>
            </div>
          )}

          <div className="mt-6 rounded-xl bg-gray-950 p-3">
            <div
              className="relative mx-auto overflow-hidden rounded-lg"
              style={{ width: '100%', maxWidth: '420px', height: '260px' }}
            >
              <video
                ref={videoRef}
                className={`h-full w-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                autoPlay
                playsInline
                muted
              />
              {isCameraActive ? (
                <div className="absolute inset-y-4 left-1/2 w-64 max-w-[80%] -translate-x-1/2 rounded-lg border-2 border-dashed border-emerald-400" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-900">
                  <Camera className="text-gray-500" size={52} />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="mt-4 flex gap-3">
            {!isCameraActive ? (
              <button
                onClick={startCamera}
                className="flex-1 rounded-lg bg-blue-600 py-2 font-semibold text-white transition hover:bg-blue-700"
              >
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex-1 rounded-lg bg-red-600 py-2 font-semibold text-white transition hover:bg-red-700"
              >
                Stop Camera
              </button>
            )}
          </div>

          {cameraInfo && <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">{cameraInfo}</p>}
          {cameraError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{cameraError}</p>}

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            <p className="font-semibold">Camera scan support</p>
            <p className="mt-1">
              The camera's first job is to detect the barcode value. Once detected, the decoded barcode is shown below
              and then matched to batch or stock data.
            </p>
            {lastDecodedValue && <p className="mt-2 font-mono text-xs">Last decoded value: {lastDecodedValue}</p>}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label
                htmlFor="scanner-stockno-input"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Stock No
              </label>
              <input
                id="scanner-stockno-input"
                value={stockNoInput}
                placeholder="Camera-scanned stock numbers will appear here"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                readOnly
              />
            </div>

            <div>
              <label
                htmlFor="scanner-batchno-input"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Batch No
              </label>
              <input
                id="scanner-batchno-input"
                value={batchNoInput}
                placeholder="Scan batch number barcode"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                readOnly
              />
            </div>

            <div>
              <label
                htmlFor="scanner-closing-quantity-input"
                className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Quantity
              </label>
              <input
                id="scanner-closing-quantity-input"
                value={closingQuantityInput}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                readOnly
              />
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Manual Stock No Input
            </label>
            <div className="flex gap-3">
              <input
                list="scanner-stockno-suggestions"
                value={manualStockValue}
                onChange={(event) => setManualStockValue(event.target.value)}
                placeholder="Enter stock no to show full details"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={loading}
              />
              <datalist id="scanner-stockno-suggestions">
                {stockSuggestions.map((stockNo) => (
                  <option key={stockNo} value={stockNo} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => {
                  if (!manualStockItem) {
                    setLastDetectedItem(null);
                    setAlert({ type: 'error', message: 'No details found for this stock number.' });
                    return;
                  }

                  setLastDetectedItem(manualStockItem);
                  setBatchNoInput(manualStockItem.batchNo);
                  setAlert({
                    type: 'info',
                    message: `Manual stock ${manualStockItem.stackNo} loaded.`,
                  });
                }}
                disabled={loading || !manualStockValue.trim()}
                className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Load Stock
              </button>
            </div>

            {manualStockValue.trim() && !manualStockItem && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">No details found for this stock number.</p>
            )}

            {manualStockItem && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60">
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Stock Details</h2>
                <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-2 xl:grid-cols-3">
                  <p>
                    Stock No: <span className="font-semibold">{manualStockItem.stackNo}</span>
                  </p>
                  <p>
                    Batch No: <span className="font-semibold">{manualStockItem.batchNo}</span>
                  </p>
                  <p>
                    Barcode: <span className="font-semibold">{manualStockItem.barcode}</span>
                  </p>
                  <p>
                    Closing Qty: <span className="font-semibold">{manualStockItem.expectedQuantity}</span>
                  </p>
                  <p>
                    Scanned Qty: <span className="font-semibold">{manualStockItem.scannedQuantity}</span>
                  </p>
                  <p>
                    Difference: <span className="font-semibold">{manualStockItem.difference}</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Manual Batch Input
            </label>
            <div className="flex gap-3">
              <input
                list="scanner-batchno-suggestions"
                value={manualBatchValue}
                onChange={(event) => setManualBatchValue(event.target.value)}
                placeholder="Enter batch no to show full details"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                disabled={loading}
              />
              <datalist id="scanner-batchno-suggestions">
                {batchSuggestions.map((batchNo) => (
                  <option key={batchNo} value={batchNo} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={() => {
                  const nextBatchNo = manualBatchValue.trim();
                  setBatchNoInput(nextBatchNo);
                  setAlert(
                    nextBatchNo
                      ? { type: 'info', message: `Manual batch ${nextBatchNo} loaded.` }
                      : { type: 'info', message: 'Enter a batch number to load details.' }
                  );
                }}
                disabled={loading || !manualBatchValue.trim()}
                className="rounded-lg bg-slate-700 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Load Batch
              </button>
            </div>

            {manualBatchValue.trim() && manualBatchItems.length === 0 && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">No details found for this batch number.</p>
            )}

            {manualBatchItems.length > 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/60">
                <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 dark:text-slate-200 md:grid-cols-3">
                  <p>Batch No: <span className="font-semibold">{manualBatchItems[0].batchNo}</span></p>
                  <p>
                    Stock Nos: <span className="font-semibold">{manualBatchStockNos.join(', ')}</span>
                  </p>
                  <p>
                    Total Closing Qty: <span className="font-semibold">{manualBatchSummary.expectedQuantity}</span>
                  </p>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Total Scanned Qty: <span className="font-semibold">{manualBatchSummary.scannedQuantity}</span>
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <th className="px-3 py-2">Barcode</th>
                        <th className="px-3 py-2">Stock No</th>
                        <th className="px-3 py-2">Batch No</th>
                        <th className="px-3 py-2">Closing Qty</th>
                        <th className="px-3 py-2">Scanned Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {manualBatchItems.map((item) => (
                        <tr key={item.id} className="text-sm text-gray-700 dark:text-gray-300">
                          <td className="px-3 py-2">{item.barcode}</td>
                          <td className="px-3 py-2">{item.stackNo}</td>
                          <td className="px-3 py-2">{item.batchNo}</td>
                          <td className="px-3 py-2 font-semibold">{item.expectedQuantity}</td>
                          <td className="px-3 py-2">{item.scannedQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void submitScannedCycle()}
            disabled={submitting || loading}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>

          {lastDetectedItem && (
            <div className="mt-6 rounded-xl bg-sky-50 p-4 dark:bg-sky-950/40">
              <h2 className="text-lg font-bold text-sky-800 dark:text-sky-200">Scanned Data</h2>
              <div className="mt-3 space-y-1 text-sm text-sky-900 dark:text-sky-100">
                <p>Stock No: {lastDetectedItem.stackNo}</p>
                <p>Batch No: {lastDetectedItem.batchNo}</p>
                <p>Closing Q: {lastDetectedItem.expectedQuantity}</p>
                <p>Barcode: {lastDetectedItem.barcode}</p>
              </div>
            </div>
          )}

          {lastSubmittedCycle && (
            <div className="mt-8 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
              <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">Last Submitted Cycle</h2>
              <div className="mt-3 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
                <p>Stock No: {lastSubmittedCycle.stockNos.join(', ')}</p>
                <p>Batch No: {lastSubmittedCycle.batchNo}</p>
                <p>Closing Q: {lastSubmittedCycle.closingQuantity}</p>
                <p>Scanned Quantity: {lastSubmittedCycle.scannedQuantity}</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
