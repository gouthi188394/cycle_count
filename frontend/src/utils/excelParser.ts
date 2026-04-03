import Papa, { type ParseResult } from 'papaparse';
import * as XLSX from 'xlsx';

export interface InventoryRow {
  barcode: string;
  batchNo: string;
  stackNo: string;
  expectedQuantity: number;
}

const HEADER_ALIASES: Record<string, keyof InventoryRow> = {
  BARCODE: 'barcode',
  BARCODE_NO: 'barcode',
  BATCHNO: 'batchNo',
  BATCH_NO: 'batchNo',
  BATCHNUMBER: 'batchNo',
  STOCKNO: 'stackNo',
  STOCK_NO: 'stackNo',
  STACKNO: 'stackNo',
  STACK_NO: 'stackNo',
  STACKNUMBER: 'stackNo',
  EXPECTEDQUANTITY: 'expectedQuantity',
  EXPECTED_QUANTITY: 'expectedQuantity',
  QTY: 'expectedQuantity',
  QUANTITY: 'expectedQuantity',
  CLOSINGQTY: 'expectedQuantity',
  CLOSING_QTY: 'expectedQuantity',
};

const normalizeHeader = (header: string) => header.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const mapRowKeys = (row: Record<string, unknown>) => {
  const mapped: Partial<Record<keyof InventoryRow, unknown>> = {};

  for (const [key, value] of Object.entries(row)) {
    const canonicalKey = HEADER_ALIASES[normalizeHeader(key)];
    if (canonicalKey) {
      mapped[canonicalKey] = value;
    }
  }

  return mapped;
};

const normalizeRows = (rows: Record<string, unknown>[]) =>
  rows
    .map((row) => mapRowKeys(row))
    .map((row) => ({
      barcode: String(row.barcode || '').trim(),
      batchNo: String(row.batchNo || '').trim(),
      stackNo: String(row.stackNo || '').trim(),
      expectedQuantity: parseInt(String(row.expectedQuantity || 0), 10) || 0,
    }))
    .filter((row) => row.barcode && row.expectedQuantity > 0);

export const validateInventoryData = (rows: InventoryRow[]): string[] => {
  const errors: string[] = [];
  const seenBarcodes = new Set<string>();

  rows.forEach((row, index) => {
    if (!row.barcode) errors.push(`Row ${index + 2}: barcode is required`);
    if (!row.batchNo) errors.push(`Row ${index + 2}: batchNo is required`);
    if (!row.stackNo) errors.push(`Row ${index + 2}: stackNo is required`);
    if (row.expectedQuantity <= 0) errors.push(`Row ${index + 2}: expectedQuantity must be > 0`);
    if (seenBarcodes.has(row.barcode)) errors.push(`Row ${index + 2}: duplicate barcode "${row.barcode}"`);
    seenBarcodes.add(row.barcode);
  });

  return errors;
};

export const parseExcelFile = (file: File): Promise<InventoryRow[]> => {
  return new Promise((resolve, reject) => {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: ParseResult<Record<string, unknown>>) => {
          try {
            resolve(normalizeRows(results.data as Record<string, unknown>[]));
          } catch (error) {
            reject(error);
          }
        },
        error: (error: Error) => reject(error),
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!(data instanceof ArrayBuffer)) {
          reject(new Error('Failed to read Excel file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Excel file is empty'));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
        });
        resolve(normalizeRows(rows));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read Excel file'));
    reader.readAsArrayBuffer(file);
  });
};
