# ✅ Installation Checklist

Use this checklist to verify everything is set up correctly.

## Pre-Installation Requirements

- [ ] Node.js installed (v16+) - `node -v`
- [ ] npm installed - `npm -v`
- [ ] Git installed (optional but recommended) - `git -v`
- [ ] Sufficient disk space (500MB+)
- [ ] Administrator/sudo access if needed

## Installation Steps

### Step 1: Navigate to Project
- [ ] Open terminal/PowerShell
- [ ] `cd "c:\count cycle app"`
- [ ] Verify you're in the correct directory: `dir` should show `backend`, `frontend`, `README.md`

### Step 2: Install Backend Dependencies
- [ ] `npm install --prefix backend`
- [ ] Check for errors in console
- [ ] Verify `backend/node_modules` folder created
- [ ] Verify `backend/package-lock.json` created

### Step 3: Install Frontend Dependencies
- [ ] `npm install --prefix frontend`
- [ ] Check for errors in console
- [ ] Verify `frontend/node_modules` folder created
- [ ] Verify `frontend/package-lock.json` created

### Step 4: Install Root Dependencies
- [ ] `npm install` (from root directory)
- [ ] Verifies `node_modules` created with `concurrently`

### Step 5: Verify Configuration Files

Backend Configuration:
- [ ] `backend/.env` exists
- [ ] PORT=5000
- [ ] JWT_SECRET set
- [ ] NODE_ENV=development

Frontend Configuration:
- [ ] `frontend/.env` exists
- [ ] VITE_API_URL=http://localhost:5000/api

## Pre-Launch Checks

### File Structure
- [ ] `backend/src/server.js` exists
- [ ] `backend/package.json` exists
- [ ] `frontend/src/main.tsx` exists
- [ ] `frontend/src/App.tsx` exists
- [ ] `frontend/index.html` exists
- [ ] `frontend/vite.config.ts` exists

### Database Preparation
- [ ] `backend/data/` folder will be created on first run
- [ ] SQLite is included in dependencies
- [ ] CSV parser included in frontend dependencies

### Environment Setup
- [ ] No sensitive info in Git (`.gitignore` checked)
- [ ] All environment variables set
- [ ] Network ports are free (5000, 3000)

## Launch Verification

### Starting the Application

Option A: Start Everything
- [ ] From root: `npm run dev`
- [ ] Wait 30 seconds for both servers to start
- [ ] Check terminal for startup messages

Option B: Start Separately
- [ ] Terminal 1: `cd backend && npm run dev`
- [ ] Terminal 2: `cd frontend && npm run dev`
- [ ] Both should show "Server running" messages

### Backend Startup Verification
- [ ] See message: "Server running on http://localhost:5000"
- [ ] See message: "Connected to SQLite database"
- [ ] No error messages visible
- [ ] Port 5000 is available

### Frontend Startup Verification
- [ ] See message: "Local: http://localhost:3000"
- [ ] Vite build completes without errors
- [ ] No TypeScript compilation errors
- [ ] Port 3000 is available

### Browser Verification
- [ ] Open http://localhost:3000
- [ ] See Sign In page loads
- [ ] Gradient logo visible
- [ ] All text renders correctly
- [ ] Theme toggle (moon icon) visible

## Post-Launch Functionality Test

### Authentication
- [ ] Click "Sign Up" link
- [ ] Create account with test data
- [ ] See success message
- [ ] Redirect to Sign In page
- [ ] Sign in with created credentials
- [ ] Redirect to Dashboard

### Dashboard
- [ ] See statistics cards load
- [ ] 4 stat cards visible
- [ ] Progress bar visible
- [ ] Quick action buttons visible (Scanner, Inventory, Reports)

### Inventory Upload
- [ ] Navigate to Inventory page
- [ ] Try uploading `EXAMPLE_INVENTORY.csv`
- [ ] See success message
- [ ] Items appear in table
- [ ] Can search and filter

### Scanner
- [ ] Navigate to Scanner page
- [ ] Camera button visible
- [ ] Try entening test barcode manually
- [ ] Enter quantity
- [ ] Click "Add Scan"
- [ ] Item appears in list with variance

### Reports
- [ ] Navigate to Reports page
- [ ] See statistics
- [ ] Scan records visible
- [ ] Filter buttons work
- [ ] Search works

## Troubleshooting Verification

### If Backend Won't Start
- [ ] Check port 5000 is free: `netstat -ano | findstr :5000`
- [ ] Change PORT in backend/.env
- [ ] Verify Node.js installed: `node -v`
- [ ] Reinstall: `npm install --prefix backend`

### If Frontend Won't Start
- [ ] Check port 3000 is free: `netstat -ano | findstr :3000`
- [ ] Clear Vite cache: `rm -r frontend/dist`
- [ ] Reinstall: `npm install --prefix frontend`

### If Database Error
- [ ] Backend/data folder will be created automatically
- [ ] Check backend/data folder has write permissions
- [ ] Delete backend/data/cycle_count.db and restart

### If API Calls Fail
- [ ] Check VITE_API_URL in frontend/.env is correct
- [ ] Verify backend is running on correct port
- [ ] Check browser console for CORS errors
- [ ] Verify JWT token in localStorage

## Performance Baseline

Expected load times:
- [ ] Dashboard: < 2 seconds
- [ ] Scanner page: < 1 second
- [ ] Inventory list (30 items): < 1 second
- [ ] Reports (10 scans): < 1 second
- [ ] File upload (CSV, 30 items): < 3 seconds

## Security Checklist

Before Production:
- [ ] Change JWT_SECRET to strong random string
- [ ] Set NODE_ENV=production
- [ ] Add HTTPS/SSL certificate
- [ ] Configure CORS properly
- [ ] Set up database backup
- [ ] Enable rate limiting
- [ ] Add input validation on frontend

## Mobile Testing

- [ ] Test on mobile browser
- [ ] Camera works on mobile
- [ ] Responsive layout adapts
- [ ] Touch buttons are clickable
- [ ] Keyboard doesn't break layout

## Dark Mode Testing

- [ ] Click theme toggle
- [ ] All pages render in dark mode
- [ ] Colors are readable
- [ ] All components visible
- [ ] Toggle back to light mode
- [ ] Setting persists on reload

## Data Persistence Testing

- [ ] Create account
- [ ] Sign out
- [ ] Sign back in with same credentials
- [ ] Upload data
- [ ] Refresh page
- [ ] Data still visible
- [ ] Scans persist

## Final Verification

- [ ] All dependencies installed
- [ ] Both servers running
- [ ] Application loads in browser
- [ ] Can create account
- [ ] Can upload inventory
- [ ] Can scan items
- [ ] Can view reports
- [ ] Theme toggle works
- [ ] No console errors
- [ ] No terminal errors

## Ready for Use! 🎉

If all checkboxes are marked:
- [ ] Application fully functional
- [ ] Ready to start cycle counting
- [ ] Performance is good
- [ ] No critical errors

## Next Steps

1. Read QUICK_START.md for usage guide
2. Use EXAMPLE_INVENTORY.csv for testing
3. Try scanning a few items
4. Check variance reports
5. Toggle to dark mode
6. Invite others to create accounts

## Support Contacts

- Documentation: See README.md
- Architecture: See ARCHITECTURE.md
- Quick Help: See QUICK_START.md
- Technical: Check terminal output for errors

---

**Verification Date**: ________________
**Verified By**: ________________
**Notes**: ________________

Good luck with your cycle count! 📦✅
