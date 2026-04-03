type BarcodeScannerResult = {
  autoDetectSupported: boolean;
  fallbackDecodeSupported: boolean;
};

type BarcodeDetectedCallback = (barcode: string) => void;

type ScanRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type QuaggaDecoderConfig = {
  locate: boolean;
  patchSize: 'x-small' | 'small' | 'medium' | 'large' | 'x-large';
  halfSample: boolean;
  size: number;
};

type QuaggaModule = {
  decodeSingle: (
    config: Record<string, unknown>,
    callback: (result?: { codeResult?: { code?: string } } | null) => void
  ) => void;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): {
        detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
      };
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

let nativeScanIntervalId: number | null = null;
let quaggaScanIntervalId: number | null = null;
let lastDetectedBarcode = '';
let lastDetectedAt = 0;
let quaggaInstance: QuaggaModule | null = null;
let barcodeDetectorBusy = false;
let quaggaDecodeBusy = false;
let nativeFrameCanvas: HTMLCanvasElement | null = null;
let scanRegionCanvas: HTMLCanvasElement | null = null;
let quaggaFrameCanvas: HTMLCanvasElement | null = null;
let rotatedFrameCanvas: HTMLCanvasElement | null = null;
let processedFrameCanvas: HTMLCanvasElement | null = null;
let enlargedFrameCanvas: HTMLCanvasElement | null = null;
let enhancedFrameCanvas: HTMLCanvasElement | null = null;
let invertedFrameCanvas: HTMLCanvasElement | null = null;

const NATIVE_SCAN_INTERVAL_MS = 90;
const QUAGGA_SCAN_INTERVAL_MS = 140;
const DUPLICATE_SUPPRESSION_MS = 800;
const FAST_REGION_LIMIT = 4;

const BARCODE_FORMATS = [
  'aztec',
  'codabar',
  'code_128',
  'code_39',
  'code_93',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'pdf417',
  'qr_code',
  'upc_a',
  'upc_e',
];

const QUAGGA_READER_GROUPS = [
  ['code_128_reader'],
  ['code_39_reader', 'code_39_vin_reader'],
  ['code_93_reader'],
  ['codabar_reader'],
  ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
  ['i2of5_reader', '2of5_reader'],
];

const QUAGGA_DECODE_CONFIGS: QuaggaDecoderConfig[] = [
  { locate: true, patchSize: 'large', halfSample: false, size: 1920 },
  { locate: true, patchSize: 'medium', halfSample: false, size: 1600 },
];

const getNativeFrameCanvas = () => {
  if (!nativeFrameCanvas) {
    nativeFrameCanvas = document.createElement('canvas');
  }

  return nativeFrameCanvas;
};

const getScanRegionCanvas = () => {
  if (!scanRegionCanvas) {
    scanRegionCanvas = document.createElement('canvas');
  }

  return scanRegionCanvas;
};

const getQuaggaFrameCanvas = () => {
  if (!quaggaFrameCanvas) {
    quaggaFrameCanvas = document.createElement('canvas');
  }

  return quaggaFrameCanvas;
};

const getRotatedFrameCanvas = () => {
  if (!rotatedFrameCanvas) {
    rotatedFrameCanvas = document.createElement('canvas');
  }

  return rotatedFrameCanvas;
};

const getProcessedFrameCanvas = () => {
  if (!processedFrameCanvas) {
    processedFrameCanvas = document.createElement('canvas');
  }

  return processedFrameCanvas;
};

const getEnlargedFrameCanvas = () => {
  if (!enlargedFrameCanvas) {
    enlargedFrameCanvas = document.createElement('canvas');
  }

  return enlargedFrameCanvas;
};

const getEnhancedFrameCanvas = () => {
  if (!enhancedFrameCanvas) {
    enhancedFrameCanvas = document.createElement('canvas');
  }

  return enhancedFrameCanvas;
};

const getInvertedFrameCanvas = () => {
  if (!invertedFrameCanvas) {
    invertedFrameCanvas = document.createElement('canvas');
  }

  return invertedFrameCanvas;
};

const normalizeDetectedValue = (value?: string | null) => {
  const normalized = value?.replace(/\s+/g, '').trim();
  if (!normalized) {
    return null;
  }

  const now = Date.now();
  if (normalized === lastDetectedBarcode && now - lastDetectedAt < DUPLICATE_SUPPRESSION_MS) {
    return null;
  }

  lastDetectedBarcode = normalized;
  lastDetectedAt = now;
  return normalized;
};

const buildScanRegions = (sourceWidth: number, sourceHeight: number): ScanRegion[] => {
  const regions: ScanRegion[] = [
    {
      left: Math.floor(sourceWidth * 0.06),
      top: Math.floor(sourceHeight * 0.42),
      width: Math.floor(sourceWidth * 0.88),
      height: Math.floor(sourceHeight * 0.12),
    },
    {
      left: Math.floor(sourceWidth * 0.1),
      top: Math.floor(sourceHeight * 0.4),
      width: Math.floor(sourceWidth * 0.8),
      height: Math.floor(sourceHeight * 0.16),
    },
    {
      left: Math.floor(sourceWidth * 0.08),
      top: Math.floor(sourceHeight * 0.34),
      width: Math.floor(sourceWidth * 0.84),
      height: Math.floor(sourceHeight * 0.24),
    },
    {
      left: Math.floor(sourceWidth * 0.11),
      top: Math.floor(sourceHeight * 0.28),
      width: Math.floor(sourceWidth * 0.78),
      height: Math.floor(sourceHeight * 0.34),
    },
    {
      left: Math.floor(sourceWidth * 0.08),
      top: Math.floor(sourceHeight * 0.24),
      width: Math.floor(sourceWidth * 0.84),
      height: Math.floor(sourceHeight * 0.5),
    },
    {
      left: Math.floor(sourceWidth * 0.2),
      top: Math.floor(sourceHeight * 0.18),
      width: Math.floor(sourceWidth * 0.6),
      height: Math.floor(sourceHeight * 0.64),
    },
    {
      left: Math.floor(sourceWidth * 0.14),
      top: Math.floor(sourceHeight * 0.12),
      width: Math.floor(sourceWidth * 0.72),
      height: Math.floor(sourceHeight * 0.76),
    },
    {
      left: 0,
      top: 0,
      width: sourceWidth,
      height: sourceHeight,
    },
  ];

  return regions.filter((region, index, allRegions) => {
    if (region.width <= 0 || region.height <= 0) {
      return false;
    }

    return (
      allRegions.findIndex(
        (candidate) =>
          candidate.left === region.left &&
          candidate.top === region.top &&
          candidate.width === region.width &&
          candidate.height === region.height
      ) === index
    );
  });
};

const drawRegionToCanvas = (
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  region: ScanRegion
) => {
  if (canvas.width !== region.width || canvas.height !== region.height) {
    canvas.width = region.width;
    canvas.height = region.height;
  }

  context.drawImage(
    videoElement,
    region.left,
    region.top,
    region.width,
    region.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
};

const drawFullFrameToCanvas = (
  videoElement: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
) => {
  const sourceWidth = videoElement.videoWidth;
  const sourceHeight = videoElement.videoHeight;

  if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
  }

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
};

const rotateCanvasToDataUrl = (sourceCanvas: HTMLCanvasElement, quarterTurns: number) => {
  const normalizedQuarterTurns = ((quarterTurns % 4) + 4) % 4;
  if (normalizedQuarterTurns === 0) {
    return sourceCanvas.toDataURL('image/png');
  }

  const targetCanvas = getRotatedFrameCanvas();
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const rotatedRightAngle = normalizedQuarterTurns % 2 === 1;

  targetCanvas.width = rotatedRightAngle ? sourceHeight : sourceWidth;
  targetCanvas.height = rotatedRightAngle ? sourceWidth : sourceHeight;

  const context = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceCanvas.toDataURL('image/png');
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  if (normalizedQuarterTurns === 1) {
    context.translate(targetCanvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (normalizedQuarterTurns === 2) {
    context.translate(targetCanvas.width, targetCanvas.height);
    context.rotate(Math.PI);
  } else {
    context.translate(0, targetCanvas.height);
    context.rotate(-Math.PI / 2);
  }

  context.drawImage(sourceCanvas, 0, 0);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return targetCanvas.toDataURL('image/png');
};

const createHighContrastCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const canvas = getProcessedFrameCanvas();
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceCanvas;
  }

  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const boosted =
      luminance > 150 ? 255 : luminance < 105 ? 0 : Math.min(255, Math.max(0, (luminance - 105) * 5.6));

    data[index] = boosted;
    data[index + 1] = boosted;
    data[index + 2] = boosted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
};

const createSoftContrastCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const canvas = getEnhancedFrameCanvas();
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceCanvas;
  }

  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    const contrasted = Math.max(0, Math.min(255, (luminance - 128) * 1.85 + 128));

    data[index] = contrasted;
    data[index + 1] = contrasted;
    data[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
};

const createInvertedCanvas = (sourceCanvas: HTMLCanvasElement) => {
  const canvas = getInvertedFrameCanvas();
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceCanvas;
  }

  context.drawImage(sourceCanvas, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255 - data[index];
    data[index + 1] = 255 - data[index + 1];
    data[index + 2] = 255 - data[index + 2];
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
};

const createEnlargedCanvas = (sourceCanvas: HTMLCanvasElement, scale: number) => {
  const canvas = getEnlargedFrameCanvas();
  canvas.width = Math.max(1, Math.floor(sourceCanvas.width * scale));
  canvas.height = Math.max(1, Math.floor(sourceCanvas.height * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return sourceCanvas;
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const detectWithNativeVariants = async (
  detector: InstanceType<NonNullable<typeof window.BarcodeDetector>>,
  sourceCanvas: HTMLCanvasElement
) => {
  const directResult = await detector.detect(sourceCanvas);
  if (directResult.length > 0) {
    return directResult;
  }

  const softContrastCanvas = createSoftContrastCanvas(sourceCanvas);
  const softContrastResult = await detector.detect(softContrastCanvas);
  if (softContrastResult.length > 0) {
    return softContrastResult;
  }

  const highContrastCanvas = createHighContrastCanvas(sourceCanvas);
  const highContrastResult = await detector.detect(highContrastCanvas);
  if (highContrastResult.length > 0) {
    return highContrastResult;
  }

  const enlargedCanvas = createEnlargedCanvas(sourceCanvas, 1.75);
  const enlargedResult = await detector.detect(enlargedCanvas);
  if (enlargedResult.length > 0) {
    return enlargedResult;
  }

  return detector.detect(createHighContrastCanvas(enlargedCanvas));
};

const getDecodeSources = (canvas: HTMLCanvasElement, includeExpandedVariants = false) => {
  const sources: string[] = [];
  const pushVariants = (sourceCanvas: HTMLCanvasElement) => {
    sources.push(rotateCanvasToDataUrl(sourceCanvas, 0));
    sources.push(rotateCanvasToDataUrl(sourceCanvas, 1));
    sources.push(rotateCanvasToDataUrl(sourceCanvas, 3));
  };

  pushVariants(canvas);
  pushVariants(createSoftContrastCanvas(canvas));
  pushVariants(createHighContrastCanvas(canvas));

  if (includeExpandedVariants) {
    const enlargedCanvas = createEnlargedCanvas(canvas, 2);
    pushVariants(enlargedCanvas);
    pushVariants(createHighContrastCanvas(enlargedCanvas));
  }

  return sources;
};

const getPrioritizedRegions = (regions: ScanRegion[]) => {
  if (regions.length === 0) {
    return regions;
  }

  const fullFrameRegion = regions[regions.length - 1];
  const focusedRegions = regions.slice(0, -1);

  return [...focusedRegions, fullFrameRegion];
};

const getFastRegions = (regions: ScanRegion[]) => regions.slice(0, Math.min(FAST_REGION_LIMIT, regions.length));

const stopDetectionLoop = () => {
  if (nativeScanIntervalId !== null) {
    window.clearInterval(nativeScanIntervalId);
    nativeScanIntervalId = null;
  }
  if (quaggaScanIntervalId !== null) {
    window.clearInterval(quaggaScanIntervalId);
    quaggaScanIntervalId = null;
  }
  barcodeDetectorBusy = false;
  quaggaDecodeBusy = false;
};

const stopQuaggaScanner = () => {
  quaggaInstance = null;
};

const getBarcodeDetector = async () => {
  if (!window.BarcodeDetector) {
    return null;
  }

  if (!window.BarcodeDetector.getSupportedFormats) {
    return new window.BarcodeDetector({ formats: BARCODE_FORMATS });
  }

  const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
  const formats = BARCODE_FORMATS.filter((format) => supportedFormats.includes(format));
  if (formats.length === 0) {
    return null;
  }

  return new window.BarcodeDetector({ formats });
};

const getCameraStream = async () => {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
  ];

  let lastError: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to access camera.');
};

const beginBarcodeDetectorLoop = async (
  videoElement: HTMLVideoElement,
  _canvasElement: HTMLCanvasElement,
  onDetected?: BarcodeDetectedCallback
) => {
  const detector = await getBarcodeDetector();
  if (!detector) {
    return false;
  }

  const nativeCanvas = getNativeFrameCanvas();
  const context = nativeCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return false;
  }
  context.imageSmoothingEnabled = false;

  nativeScanIntervalId = window.setInterval(async () => {
    if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return;
    }

    if (barcodeDetectorBusy) {
      return;
    }

    try {
      barcodeDetectorBusy = true;
      const sourceWidth = videoElement.videoWidth;
      const sourceHeight = videoElement.videoHeight;
      const regions = getFastRegions(getPrioritizedRegions(buildScanRegions(sourceWidth, sourceHeight)));
      drawFullFrameToCanvas(videoElement, nativeCanvas, context);
      const fullFrameBarcodes = await detectWithNativeVariants(detector, nativeCanvas);

      for (const barcode of fullFrameBarcodes) {
        const normalized = normalizeDetectedValue(barcode?.rawValue);
        if (normalized) {
          onDetected?.(normalized);
          return;
        }
      }

      for (const region of regions) {
        drawRegionToCanvas(videoElement, nativeCanvas, context, region);
        const barcodes = await detectWithNativeVariants(detector, nativeCanvas);

        for (const barcode of barcodes) {
          const normalized = normalizeDetectedValue(barcode?.rawValue);
          if (normalized) {
            onDetected?.(normalized);
            return;
          }
        }
      }
    } catch (error) {
      console.error('Barcode detection frame failed:', error);
    } finally {
      barcodeDetectorBusy = false;
    }
  }, NATIVE_SCAN_INTERVAL_MS);

  return true;
};

const getQuagga = async () => {
  if (quaggaInstance) {
    return quaggaInstance;
  }

  const { default: Quagga } = (await import('quagga')) as { default: QuaggaModule };
  quaggaInstance = Quagga;
  return Quagga;
};

const beginQuaggaDecodeLoop = async (
  videoElement: HTMLVideoElement,
  _canvasElement: HTMLCanvasElement,
  onDetected?: BarcodeDetectedCallback
) => {
  const Quagga = await getQuagga();
  const quaggaCanvas = getQuaggaFrameCanvas();
  const context = quaggaCanvas.getContext('2d', { willReadFrequently: true });
  const regionCanvas = getScanRegionCanvas();
  const regionContext = regionCanvas.getContext('2d', { willReadFrequently: true });
  if (!context || !regionContext) {
    return false;
  }
  context.imageSmoothingEnabled = false;
  regionContext.imageSmoothingEnabled = false;

  const decodeWithQuagga = (src: string, readers: string[]) =>
    new Promise<string | null>((resolve) => {
      (async () => {
        for (const decodeConfig of QUAGGA_DECODE_CONFIGS) {
          const result = await new Promise<string | null>((configResolve) => {
            Quagga.decodeSingle(
              {
                src,
                numOfWorkers: 0,
                locate: decodeConfig.locate,
                locator: {
                  patchSize: decodeConfig.patchSize,
                  halfSample: decodeConfig.halfSample,
                },
                decoder: {
                  readers,
                },
                inputStream: {
                  size: decodeConfig.size,
                },
                multiple: false,
              },
              (decodeResult) => {
                configResolve(normalizeDetectedValue(decodeResult?.codeResult?.code) ?? null);
              }
            );
          });

          if (result) {
            resolve(result);
            return;
          }
        }

        resolve(null);
      })();
    });

  quaggaScanIntervalId = window.setInterval(() => {
    if (
      quaggaDecodeBusy ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      return;
    }

    const sourceWidth = videoElement.videoWidth;
    const sourceHeight = videoElement.videoHeight;
    const regions = getFastRegions(getPrioritizedRegions(buildScanRegions(sourceWidth, sourceHeight)));

    if (quaggaCanvas.width !== sourceWidth || quaggaCanvas.height !== sourceHeight) {
      quaggaCanvas.width = sourceWidth;
      quaggaCanvas.height = sourceHeight;
    }

    context.drawImage(videoElement, 0, 0, quaggaCanvas.width, quaggaCanvas.height);
    quaggaDecodeBusy = true;
    (async () => {
      try {
        let normalized: string | null = null;

        for (const region of regions) {
          drawRegionToCanvas(videoElement, regionCanvas, regionContext, region);
          const regionImages = getDecodeSources(regionCanvas, false);

          for (const regionImage of regionImages) {
            for (const readers of QUAGGA_READER_GROUPS) {
              normalized = await decodeWithQuagga(regionImage, readers);
              if (normalized) {
                break;
              }
            }

            if (normalized) {
              break;
            }
          }

          if (normalized) {
            break;
          }
        }

        if (!normalized) {
          const fullFrameImages = getDecodeSources(quaggaCanvas, true);

          for (const fullFrameImage of fullFrameImages) {
            for (const readers of QUAGGA_READER_GROUPS) {
              normalized = await decodeWithQuagga(fullFrameImage, readers);
              if (normalized) {
                break;
              }
            }

            if (normalized) {
              break;
            }
          }
        }

        if (normalized) {
          onDetected?.(normalized);
        }
      } finally {
        quaggaDecodeBusy = false;
      }
    })();
  }, QUAGGA_SCAN_INTERVAL_MS);

  return true;
};

export const startBarcodeScanner = async (
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
  onDetected?: BarcodeDetectedCallback
): Promise<BarcodeScannerResult> => {
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    throw new Error('Camera access requires HTTPS or localhost.');
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera access.');
  }

  try {
    stopDetectionLoop();
    stopQuaggaScanner();
    lastDetectedBarcode = '';
    lastDetectedAt = 0;

    const stream = await getCameraStream();

    const [videoTrack] = stream.getVideoTracks();
    if (videoTrack) {
      const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
        focusMode?: string[];
        exposureMode?: string[];
        whiteBalanceMode?: string[];
        torch?: boolean;
      };

      const advancedConstraints: Record<string, unknown> = {};
      if (capabilities?.focusMode?.includes('continuous')) {
        advancedConstraints.focusMode = 'continuous';
      }
      if (capabilities?.exposureMode?.includes('continuous')) {
        advancedConstraints.exposureMode = 'continuous';
      }
      if (capabilities?.whiteBalanceMode?.includes('continuous')) {
        advancedConstraints.whiteBalanceMode = 'continuous';
      }

      if (Object.keys(advancedConstraints).length > 0) {
        try {
          await videoTrack.applyConstraints({
            advanced: [advancedConstraints],
          });
        } catch (error) {
          console.warn('Could not apply advanced camera constraints:', error);
        }
      }
    }

    videoElement.srcObject = stream;
    await new Promise<void>((resolve, reject) => {
      videoElement.onloadedmetadata = async () => {
        try {
          await videoElement.play();
          window.setTimeout(resolve, 450);
        } catch (error) {
          reject(error);
        }
      };
    });

    const autoDetectSupported = await beginBarcodeDetectorLoop(videoElement, canvasElement, onDetected);
    const fallbackDecodeSupported = await beginQuaggaDecodeLoop(videoElement, canvasElement, onDetected);

    if (!autoDetectSupported && !fallbackDecodeSupported) {
      throw new Error('This browser does not support barcode scanning.');
    }

    return { autoDetectSupported, fallbackDecodeSupported };
  } catch (error) {
    console.error('Error accessing camera:', error);

    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        throw new Error('Camera permission is required');
      }
      if (error.name === 'NotFoundError') {
        throw new Error('No camera was found on this device.');
      }
      if (error.name === 'NotReadableError') {
        throw new Error('The camera is already being used by another application.');
      }
    }

    throw new Error('Unable to access camera.');
  }
};

export const stopBarcodeScanner = (videoElement: HTMLVideoElement): void => {
  stopDetectionLoop();
  stopQuaggaScanner();

  if (videoElement.srcObject) {
    const tracks = (videoElement.srcObject as MediaStream).getTracks();
    tracks.forEach((track) => track.stop());
    videoElement.srcObject = null;
  }
};

export const isValidBarcode = (barcode: string): boolean => {
  return barcode.trim().length > 0;
};
