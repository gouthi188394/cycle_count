import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import sqlite3 from 'sqlite3';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import XLSX from 'xlsx';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const VALID_ROLES = ['admin', 'supervisor', 'scanner'];
const REQUIRED_HEADERS = ['BATCHNO', 'STOCKNO', 'CLOSINGQTY'];
const HEADER_ALIASES = {
  BARCODE: 'BARCODE',
  BARCODENO: 'BARCODE',
  BARCODENUMBER: 'BARCODE',
  BATCHNO: 'BATCHNO',
  BATCHNUMBER: 'BATCHNO',
  STOCKNO: 'STOCKNO',
  STOCKNUMBER: 'STOCKNO',
  STACKNO: 'STOCKNO',
  STACKNUMBER: 'STOCKNO',
  CLOSING: 'CLOSINGQTY',
  CLOSINGQ: 'CLOSINGQTY',
  CLOSINGQTY: 'CLOSINGQTY',
  CLOSINGQTYVALUE: 'CLOSINGQTY',
  CLOSINGQUANTITY: 'CLOSINGQTY',
  EXPECTEDQUANTITY: 'CLOSINGQTY',
  QUANTITY: 'CLOSINGQTY',
  QTY: 'CLOSINGQTY',
};

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'cycle_count.db');
const UPLOAD_DIR = path.join(__dirname, '../uploads');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('SQLite error:', err);
  else console.log('Connected to SQLite database');
});

const runSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function callback(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const getSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });

const allSqlite = (sql, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows || []);
    });
  });



const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

const normalizeRole = (role) => {
  if (!role) return null;
  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'scanner_user') return 'scanner';
  return VALID_ROLES.includes(normalized) ? normalized : null;
};

const createTokenPayload = (user) => ({
  userId: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
});

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
};

const requireRole = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.userRole)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }

  next();
};

const mapInventoryRow = (row) => {
  const expectedQuantity = Number(row.expected_quantity);
  const scannedQuantity = Number(row.scanned_quantity);

  return {
    id: row.id,
    barcode: row.barcode,
    batchNo: row.batch_no,
    stackNo: row.stack_no,
    expectedQuantity,
    scannedQuantity,
    difference: expectedQuantity - scannedQuantity,
  };
};

const buildGeneratedBarcode = (batchNo, stackNo) => {
  const sanitizePart = (value) =>
    String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  return `AUTO-${sanitizePart(batchNo)}-${sanitizePart(stackNo)}`;
};

const loadWorkbookRows = (filePath) => {
  const workbook = XLSX.readFile(filePath, { raw: false });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('Uploaded file is empty');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
};

const validateInventorySheet = (sheetRows) => {
  const errors = [];
  const headerRow = Array.isArray(sheetRows[0]) ? sheetRows[0].map((value) => String(value).trim()) : [];

  const normalizeHeader = (header) => String(header || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const canonicalizeHeader = (header) => HEADER_ALIASES[normalizeHeader(header)] || null;

  const headerIndexes = new Map();
  const duplicateHeaders = [];

  headerRow.forEach((header, index) => {
    const canonicalHeader = canonicalizeHeader(header);
    if (!canonicalHeader) {
      return;
    }

    if (headerIndexes.has(canonicalHeader)) {
      duplicateHeaders.push(header);
      return;
    }

    headerIndexes.set(canonicalHeader, index);
  });

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerIndexes.has(header));

  if (missingHeaders.length > 0 || duplicateHeaders.length > 0) {
    const details = [];
    if (missingHeaders.length > 0) {
      details.push(`Missing: ${missingHeaders.join(', ')}`);
    }
    if (duplicateHeaders.length > 0) {
      details.push(`Duplicate mapped headers: ${duplicateHeaders.join(', ')}`);
    }

    return {
      errors: [
        {
          rowNumber: 1,
            message: `Invalid columns. Expected headers matching: ${REQUIRED_HEADERS.join(', ')}. Got: ${headerRow.join(', ')}${details.length ? `. ${details.join('. ')}` : ''}`,
        },
      ],
      records: [],
      headers: headerRow,
    };
  }

  const seenBarcodes = new Map();
  const records = [];
  let autoGeneratedBarcodeCount = 0;

  for (let index = 1; index < sheetRows.length; index += 1) {
    const excelRowNumber = index + 1;
    const row = Array.isArray(sheetRows[index]) ? sheetRows[index] : [];
    const barcode = String(row[headerIndexes.get('BARCODE')] ?? '').trim();
    const batchNo = String(row[headerIndexes.get('BATCHNO')] ?? '').trim();
    const stackNo = String(row[headerIndexes.get('STOCKNO')] ?? '').trim();
    const expectedQuantityRaw = String(row[headerIndexes.get('CLOSINGQTY')] ?? '').trim();
    const expectedQuantity = Number(expectedQuantityRaw);
    // Skip non-data rows entirely when all identifying columns are empty.
    // Excel exports often include trailing formatted rows or formula-filled quantity cells.
    if (!barcode && !batchNo && !stackNo) {
      continue;
    }

    // Now validate non-empty rows
    if (!batchNo) {
      errors.push({ rowNumber: excelRowNumber, message: 'BATCHNO must not be empty' });
      continue;
    }
    if (!stackNo) {
      errors.push({ rowNumber: excelRowNumber, message: 'STOCKNO must not be empty' });
      continue;
    }
    if (!expectedQuantityRaw || !Number.isFinite(expectedQuantity)) {
      errors.push({ rowNumber: excelRowNumber, message: 'CLOSINGQTY must be a valid number' });
      continue;
    }
    const resolvedBarcode = barcode || buildGeneratedBarcode(batchNo, stackNo);
    if (!barcode) {
      autoGeneratedBarcodeCount += 1;
    }

    if (!resolvedBarcode) {
      errors.push({ rowNumber: excelRowNumber, message: 'BARCODE must not be empty' });
      continue;
    }

    // Check for duplicates
    const firstSeenAt = seenBarcodes.get(resolvedBarcode);
    if (firstSeenAt) {
      errors.push({
        rowNumber: excelRowNumber,
        message: `Duplicate barcode "${resolvedBarcode}" found. First seen at row ${firstSeenAt}`,
      });
      continue;
    }
    seenBarcodes.set(resolvedBarcode, excelRowNumber);

    // Add valid record
    records.push({
      barcode: resolvedBarcode,
      batchNo,
      stackNo,
      expectedQuantity,
    });
  }

  return {
    errors,
    records,
    headers: headerRow,
    autoGeneratedBarcodeCount,
  };
};

const getInventoryRows = async () => {
  const rows = await allSqlite(
    `SELECT
      id,
      barcode,
      batch_no,
      stack_no,
      expected_quantity,
      scanned_quantity
    FROM inventory
    ORDER BY barcode ASC`
  );

  return rows.map(mapInventoryRow);
};

const buildSummary = async () => {
  const rows = await allSqlite('SELECT * FROM inventory');
  const totalInventory = rows.length;
  const pendingCount = rows.filter((r) => r.scanned_quantity === 0).length;
  const completedCount = rows.filter(
    (r) => r.scanned_quantity > 0 && r.expected_quantity === r.scanned_quantity
  ).length;
  const mismatchCount = rows.filter(
    (r) => r.scanned_quantity > 0 && r.expected_quantity !== r.scanned_quantity
  ).length;
  const overScannedCount = rows.filter((r) => r.scanned_quantity > r.expected_quantity).length;
  const underScannedCount = rows.filter(
    (r) => r.scanned_quantity > 0 && r.scanned_quantity < r.expected_quantity
  ).length;
  const exactMatchCount = completedCount;
  const totalScans = rows.reduce((sum, r) => sum + r.scanned_quantity, 0);

  return {
    totalScans,
    uniqueBarcodes: totalInventory,
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

const initializeSqliteAuth = async () => {
  await runSqlite(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'scanner',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
};

const initializeSqliteInventory = async () => {
  await runSqlite(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT NOT NULL UNIQUE,
    batch_no TEXT NOT NULL,
    stack_no TEXT NOT NULL,
    expected_quantity INTEGER NOT NULL,
    scanned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (scanned_quantity >= 0)
  )`);
};

const migrateInventorySchema = async () => {
  const inventoryTable = await getSqlite(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'inventory'"
  );

  const tableSql = String(inventoryTable?.sql || '');
  if (!tableSql.includes('expected_quantity INTEGER NOT NULL CHECK (expected_quantity > 0)')) {
    return;
  }

  await runSqlite('ALTER TABLE inventory RENAME TO inventory_old');
  await initializeSqliteInventory();
  await runSqlite(
    `INSERT INTO inventory (id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity)
     SELECT id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity
     FROM inventory_old`
  );
  await runSqlite('DROP TABLE inventory_old');
};

Promise.all([initializeSqliteAuth(), initializeSqliteInventory()])
  .then(() => {
    return migrateInventorySchema();
  })
  .then(() => {
    console.log('Databases initialized');
  })
  .catch((err) => {
    console.error('Failed to initialize databases:', err);
  });

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const requestedRole = normalizeRole(role);
    const userCountRow = await getSqlite('SELECT COUNT(*) AS count FROM users');
    const isFirstUser = (userCountRow?.count || 0) === 0;
    const assignedRole = requestedRole || (isFirstUser ? 'admin' : 'scanner');
    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await runSqlite(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username.trim(), email.trim().toLowerCase(), hashedPassword, assignedRole]
    );

    return res.json({
      message: 'User created successfully',
      userId: result.lastID,
      role: assignedRole,
    });
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'User already exists' });
    }

    return res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getSqlite('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(createTokenPayload(user), JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return res.status(500).json({ error: 'Failed to sign in' });
  }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await getSqlite('SELECT id, username, email, role FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch {
    return res.status(500).json({ error: 'Failed to load user profile' });
  }
});

app.post('/api/inventory/upload', verifyToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Excel file is required' });
  }

  try {
    const sheetRows = loadWorkbookRows(req.file.path);
    const { headers, errors, records, autoGeneratedBarcodeCount } = validateInventorySheet(sheetRows);

    if (records.length === 0) {
      errors.push({ rowNumber: 2, message: 'No data rows found in uploaded file' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        fileName: req.file.originalname,
        savedFilePath: req.file.path,
        headers,
        errors,
      });
    }

    try {
      await runSqlite('DELETE FROM inventory');

      for (const record of records) {
        await runSqlite(
          `INSERT INTO inventory (barcode, batch_no, stack_no, expected_quantity, scanned_quantity)
           VALUES (?, ?, ?, ?, 0)`,
          [record.barcode, record.batchNo, record.stackNo, record.expectedQuantity]
        );
      }
    } catch (error) {
      throw error;
    }

    return res.json({
      message: 'Inventory uploaded successfully',
      fileName: req.file.originalname,
      savedFilePath: req.file.path,
      recordsInserted: records.length,
      autoGeneratedBarcodeCount,
    });
  } catch (err) {
    console.error('Inventory upload failed:', err);
    return res.status(500).json({ error: 'Failed to process uploaded file' });
  }
});

app.get('/api/inventory/all', verifyToken, async (_req, res) => {
  try {
    const rows = await getInventoryRows();
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'Failed to load inventory' });
  }
});

app.get('/api/inventory/:barcode', verifyToken, async (req, res) => {
  try {
    const row = await getSqlite(
      `SELECT id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity
       FROM inventory
       WHERE barcode = ?`,
      [String(req.params.barcode).trim()]
    );

    if (!row) {
      return res.status(404).json({ error: 'Invalid barcode' });
    }

    return res.json(mapInventoryRow(row));
  } catch {
    return res.status(500).json({ error: 'Failed to load inventory item' });
  }
});

app.post('/api/scans', verifyToken, async (req, res) => {
  try {
    const barcode = String(req.body.barcode || '').trim();

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const item = await getSqlite('SELECT * FROM inventory WHERE barcode = ?', [barcode]);
    if (!item) {
      return res.status(404).json({ error: 'Invalid barcode' });
    }

    await runSqlite('UPDATE inventory SET scanned_quantity = scanned_quantity + 1 WHERE barcode = ?', [barcode]);
    const updatedItem = await getSqlite('SELECT * FROM inventory WHERE barcode = ?', [barcode]);

    return res.json({
      message: 'Barcode scanned successfully',
      item: mapInventoryRow(updatedItem),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to record scan' });
  }
});

app.post('/api/scans/batch-submit', verifyToken, async (req, res) => {
  try {
    const batchNo = String(req.body.batchNo || '').trim();
    const stockNos = Array.isArray(req.body.stockNos)
      ? req.body.stockNos.map((value) => String(value || '').trim()).filter(Boolean)
      : [];

    if (stockNos.length === 0) {
      return res.status(400).json({ error: 'At least one stock number is required' });
    }

    const stockRows = batchNo
      ? await allSqlite(
          `SELECT id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity
           FROM inventory
           WHERE LOWER(batch_no) = LOWER(?)`,
          [batchNo]
        )
      : await allSqlite(
          `SELECT id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity
           FROM inventory`
        );

    if (stockRows.length === 0) {
      return res.status(404).json({ error: batchNo ? 'Invalid batch number' : 'No inventory records found' });
    }

    const rowsByStockNo = new Map(
      stockRows.map((row) => [String(row.stack_no || '').trim().toLowerCase(), row])
    );

    const invalidStockNos = stockNos.filter(
      (stockNo) => !rowsByStockNo.has(stockNo.toLowerCase())
    );

    if (invalidStockNos.length > 0) {
      return res.status(400).json({
        error: batchNo
          ? `Invalid stock number(s) for batch ${batchNo}: ${invalidStockNos.join(', ')}`
          : `Invalid stock number(s): ${invalidStockNos.join(', ')}`,
      });
    }

    const countsByRowId = new Map();

    stockNos.forEach((stockNo) => {
      const matchedRow = rowsByStockNo.get(stockNo.toLowerCase());
      const currentCount = countsByRowId.get(matchedRow.id)?.count || 0;
      countsByRowId.set(matchedRow.id, {
        id: matchedRow.id,
        stockNo: matchedRow.stack_no,
        count: currentCount + 1,
      });
    });

    for (const rowUpdate of countsByRowId.values()) {
      await runSqlite(
        'UPDATE inventory SET scanned_quantity = scanned_quantity + ? WHERE id = ?',
        [rowUpdate.count, rowUpdate.id]
      );
    }

    const updatedItemIds = Array.from(countsByRowId.keys());
    const placeholders = updatedItemIds.map(() => '?').join(', ');
    const updatedRows = await allSqlite(
      `SELECT id, barcode, batch_no, stack_no, expected_quantity, scanned_quantity
       FROM inventory
       WHERE id IN (${placeholders})
       ORDER BY stack_no ASC`,
      updatedItemIds
    );

    return res.json({
      message: 'Batch scan submitted successfully',
      batchNo,
      stockNos,
      scannedQuantity: stockNos.length,
      items: updatedRows.map(mapInventoryRow),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to submit batch scan' });
  }
});

app.get('/api/scans', verifyToken, async (_req, res) => {
  try {
    const rows = await getInventoryRows();
    return res.json(
      rows
        .filter((row) => row.scannedQuantity > 0)
        .map((row) => ({
          barcode: row.barcode,
          scanned_qty: row.scannedQuantity,
          difference: row.difference,
          batch_no: row.batchNo,
          stack_no: row.stackNo,
          expected_quantity: row.expectedQuantity,
        }))
    );
  } catch {
    return res.status(500).json({ error: 'Failed to load scans' });
  }
});

app.get('/api/scans/summary', verifyToken, async (_req, res) => {
  try {
    const summary = await buildSummary();
    return res.json(summary);
  } catch {
    return res.status(500).json({ error: 'Failed to load summary' });
  }
});

app.get('/api/reports', verifyToken, async (_req, res) => {
  try {
    const rows = await getInventoryRows();
    const summary = await buildSummary();
    return res.json({ rows, summary });
  } catch {
    return res.status(500).json({ error: 'Failed to load reports' });
  }
});

app.get('/api/inventory/export', verifyToken, async (_req, res) => {
  try {
    const rows = await getInventoryRows();
    const exportRows = rows.map((row) => ({
      barcode: row.barcode,
      batchNo: row.batchNo,
      stackNo: row.stackNo,
      expectedQuantity: row.expectedQuantity,
      scannedQuantity: row.scannedQuantity,
      difference: row.difference,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows, {
      header: ['barcode', 'batchNo', 'stackNo', 'expectedQuantity', 'scannedQuantity', 'difference'],
    });

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-cycle-count.xlsx');
    return res.send(buffer);
  } catch {
    return res.status(500).json({ error: 'Failed to export inventory' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
