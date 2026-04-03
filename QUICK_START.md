# Quick Start Guide - Cycle Count Application

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd c:\count cycle app
npm install
npm install --prefix backend
npm install --prefix frontend
```

### Step 2: Start the Application
```bash
# From root directory
npm run dev
```

This will automatically start:
- Backend on: http://localhost:5000
- Frontend on: http://localhost:3000

### Step 3: Create Your Account
1. Open http://localhost:3000 in your browser
2. Click "Sign Up"
3. Enter:
   - Username: `testuser`
   - Email: `test@example.com`
   - Password: `password123`
4. Click "Sign Up"

### Step 4: Sign In
1. On the Sign In page, enter your credentials
2. Click "Sign In"
3. You'll see the Dashboard

## Using the Application

### Upload Inventory Data

**Excel File Format Required:**
```
BARCODE    | BATCHNO      | STOCKNO | CLOSINGQTY
-----------|--------------|---------|----------
11011      | SECOND       | SEC-1   | 106
11012      | SECONDS      | SEC-1   | 294
11013      | SECOND       | SEC-2   | 175
11014      | SECONDS      | SEC-2   | 99
```

**Steps:**
1. Click "Inventory" in navigation
2. Click "Choose File"
3. Select your Excel/CSV file
4. Wait for upload confirmation
5. View loaded inventory

### Scan Items

**Option 1: Manual Entry**
1. Go to "Scanner" page
2. Enter barcode number
3. Enter scanned quantity
4. Add notes (optional)
5. Click "Add Scan"

**Option 2: Camera Scanning**
1. Go to "Scanner" page
2. Click "Start Camera"
3. Allow browser camera access
4. Point at barcode
5. Enter quantity manually
6. Click "Add Scan"

### Check Progress
- Dashboard shows real-time progress
- See total scans, pending items, and completion %
- Updates automatically every 5 seconds

### View Reports
1. Click "Reports" in navigation
2. See variance analysis
3. Filter by variance type:
   - **Positive (+)**: More items found
   - **Negative (-)**: Fewer items found
   - **Match (0)**: Exact match
4. Search by barcode

## Key Features

### Variance Calculation
```
Variance = Scanned Qty - Closing Qty

Example:
- Closing Qty: 100
- Scanned Qty: 105
- Variance: +5 (Extra items)

Example:
- Closing Qty: 100
- Scanned Qty: 95
- Variance: -5 (Missing items)
```

### Theme Toggle
Click the moon/sun icon at top-right to switch between light and dark modes.

### Responsive Design
- Desktop: Full layout with all features
- Tablet: Optimized for touch
- Mobile: Simplified interface for on-the-go scanning

## Troubleshooting

### Backend Won't Start
```bash
# Make sure you're in the backend directory
cd backend
npm install  # If dependencies not installed
npm run dev
```

### Frontend Won't Connect
- Check VITE_API_URL in frontend/.env
- Ensure backend is running on port 5000
- Try restarting browser

### Camera Not Working
- Click "Allow" when browser asks for camera
- Some browsers need HTTPS (use localhost for development)
- Try different browser if issues persist

### Excel Upload Fails
- Ensure columns are: BARCODE, BATCHNO, STOCKNO, CLOSINGQTY
- No special characters in data
- File format is .csv or .xlsx

## Example Workflow

```
1. START
    ↓
2. Create Account & Sign In
    ↓
3. Upload Excel with Inventory (Dashboard → Inventory)
    ↓
4. Start Scanning (Dashboard → Scanner)
    - Scan items one by one
    - Enter quantities
    - System calculates variance automatically
    ↓
5. Monitor Progress (Dashboard shows real-time stats)
    ↓
6. Review Variance (Reports → Filter & Analyze)
    - See which items have discrepancies
    - Export data if needed
    ↓
7. Complete Cycle Count
```

## Tips for Best Results

1. **Before Scanning:**
   - Organize items by location
   - Have your inventory list ready
   - Ensure good lighting for barcode scanning

2. **During Scanning:**
   - Scan items in order
   - Add notes for problem items
   - Count carefully, enter exact quantities

3. **After Scanning:**
   - Review variance report
   - Investigate discrepancies
   - Update inventory records

## User Interface Layout

```
┌─────────────────────────────────────────┐
│   CC | Cycle Count | Dashboard Scanner... │ [🌙] [User] [Logout]
├─────────────────────────────────────────┤
│                                         │
│  Dashboard / Scanner / Inventory / etc  │
│                                         │
│  [Content Area - Changes based on page] │
│                                         │
└─────────────────────────────────────────┘
```

## Keyboard Shortcuts

- **Enter** (in barcode field): Submit scan
- **Tab**: Navigate between fields
- **Esc**: Clear camera selection (when possible)

## Default Credentials (After Setup)
- Email: `test@example.com`
- Password: `password123`
- Username: `testuser`

## Need Help?

1. Check the main README.md for detailed documentation
2. Review error messages in browser console (F12)
3. Check backend console for server errors
4. Ensure all dependencies are installed

---

**Happy Cycle Counting! 📦**
