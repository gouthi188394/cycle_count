# Cycle Count - Professional Inventory Management System

A modern, full-stack web application for inventory cycle counting with barcode scanning, real-time variance calculation, and professional UI with light/dark mode support.

## Features

- **Authentication System**
  - User registration with email and password
  - Secure sign-in and session management
  - Protected routes and authentication middleware

- **Barcode Scanning**
  - Camera integration for barcode scanning
  - Manual barcode entry
  - Real-time inventory lookup
  - Mobile-friendly interface

- **Inventory Management**
  - Excel/CSV file upload (BARCODE, BATCHNO, STOCKNO, CLOSINGQTY format)
  - Comprehensive inventory database
  - Search and filter capabilities

- **Variance Calculation**
  - Automatic variance calculation (Scanned Qty - Closing Qty)
  - Color-coded variance indicators
  - Detailed scan history with time stamps

- **Dashboard & Reports**
  - Real-time progress tracking
  - Scan statistics and summary
  - Variance analysis by barcode
  - Filter by positive/negative/zero variance

- **User Interface**
  - Light and dark mode support
  - Responsive design (mobile, tablet, desktop)
  - Professional gradient UI
  - Intuitive navigation

## Project Structure

```
cycle-count-app/
├── backend/
│   ├── src/
│   │   └── server.js          # Express API server
│   ├── package.json
│   └── .env                   # Backend configuration
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API services
│   │   ├── store/             # Zustand state management
│   │   ├── utils/             # Utility functions
│   │   ├── styles/            # CSS files
│   │   ├── App.tsx            # Main App component
│   │   └── main.tsx           # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── .env                   # Frontend configuration
└── package.json              # Root package.json
```

## Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - Lightweight database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads
- **CORS** - Cross-origin requests

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **React Router** - Client-side routing
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Axios** - HTTP client
- **Lucide Icons** - Icon library
- **Papa Parse** - CSV parsing

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Modern web browser

### Setup Steps

1. **Clone/Extract the project**
```bash
cd count\ cycle\ app
```

2. **Install dependencies for both backend and frontend**
```bash
# From root directory
npm install
npm install --prefix backend
npm install --prefix frontend
```

3. **Configure environment variables**

Backend (.../backend/.env):
```
PORT=5000
JWT_SECRET=your-super-secret-key-change-this-in-production
NODE_ENV=development
```

Frontend (.../frontend/.env):
```
VITE_API_URL=http://localhost:5000/api
```

## Running the Application

### Development Mode (Both Backend & Frontend)

From the root directory:
```bash
npm run dev
```

This will start:
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

### Individual Startup

**Backend only:**
```bash
cd backend
npm run dev
```

**Frontend only:**
```bash
cd frontend
npm run dev
```

## Usage Guide

### 1. Create Account
- Go to Sign Up page
- Enter username, email, and password
- Click "Sign Up"

### 2. Sign In
- Enter your email and password
- Click "Sign In"
- You'll be redirected to dashboard

### 3. Upload Inventory
- Go to "Inventory" section
- Upload Excel/CSV file with format:
  ```
  BARCODE, BATCHNO, STOCKNO, CLOSINGQTY
  11011, SECOND, SEC-1, 106
  11012, SECONDS, SEC-1, 294
  ...
  ```
- File will be processed and loaded

### 4. Scan Items
- Go to "Scanner" section
- Option 1: Click "Start Camera" for barcode scanning
- Option 2: Manually enter barcode
- Enter scanned quantity
- Add optional notes
- Click "Add Scan"

### 5. View Reports
- Go to "Reports" section
- View all scan records
- Filter by variance (positive/negative/zero)
- Search by barcode
- See detailed variance analysis

### 6. Monitor Progress
- Dashboard shows:
  - Total scans
  - Items scanned
  - Pending items
  - Completion percentage

## Variance Calculation

**Variance = Scanned Quantity - Closing Quantity**

- **Positive Variance (+)**: More items found than recorded
- **Negative Variance (-)**: Fewer items found than recorded
- **Zero Variance (0)**: Exact match with inventory

## Theme Toggle

Click the moon/sun icon in the header to switch between light and dark modes. Your preference is saved automatically.

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Sign in user

### Inventory
- `POST /api/inventory/upload` - Upload Excel file
- `GET /api/inventory/all` - Get all inventory items
- `GET /api/inventory/:barcode` - Get item by barcode

### Scans
- `POST /api/scans` - Record a scan
- `GET /api/scans` - Get user's scans
- `GET /api/scans/summary` - Get scan summary

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Inventory Master Table
```sql
CREATE TABLE inventory_master (
  id INTEGER PRIMARY KEY,
  barcode TEXT UNIQUE NOT NULL,
  batch_no TEXT NOT NULL,
  stock_no TEXT NOT NULL,
  closing_qty INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Scan Records Table
```sql
CREATE TABLE scan_records (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  barcode TEXT NOT NULL,
  scanned_qty INTEGER NOT NULL,
  variance INTEGER,
  scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

## Build for Production

### Frontend Build
```bash
cd frontend
npm run build
```

The built files will be in `frontend/dist/`

### Backend Production
- Change `NODE_ENV` to `production` in `.env`
- Update `JWT_SECRET` to a strong random string
- Run: `npm start`

## Troubleshooting

### Camera Access Issues
- Enable camera permissions in browser settings
- Try a different browser
- Some browsers require HTTPS for camera access

### Database Errors
- Delete the `backend/data/cycle_count.db` file to reset database
- Ensure write permissions on backend directory

### Port Already in Use
- Change PORT in backend/.env
- Update VITE_API_URL in frontend/.env accordingly

### Excel Upload Issues
- Ensure Excel file has exact column names: BARCODE, BATCHNO, STOCKNO, CLOSINGQTY
- Convert .xlsx to .csv if issues persist
- Check for empty rows or special characters in data

## Performance Optimization

- Dashboard refreshes every 5 seconds for real-time updates
- Inventory data is loaded on component mount
- Large scan lists are virtualized in production
- State management uses Zustand for minimal re-renders

## Security Considerations

- Passwords are hashed using bcryptjs (10 rounds)
- JWT tokens expire in 7 days
- All API routes require authentication
- CORS is enabled for development
- Change JWT_SECRET before production deployment

## Future Enhancements

- [ ] Real barcode detection with Quagga.js
- [ ] Barcode generation
- [ ] Advanced filtering and export
- [ ] Multi-user cycle count sessions
- [ ] Mobile app (React Native)
- [ ] Cloud sync
- [ ] Audit trail and version history
- [ ] Email notifications
- [ ] API rate limiting

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review error messages in browser console
3. Check backend logs in terminal

## License

MIT License - Feel free to use and modify for your needs

---

**Created with ❤️ for efficient inventory management**
# cycle_count
