import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useThemeStore, useAuthStore } from './store/authStore';
import { authApi } from './services/api';
import SignupPage from './pages/SignupPage';
import SigninPage from './pages/SigninPage';
import DashboardPage from './pages/DashboardPage';
import ScannerPage from './pages/ScannerPage';
import InventoryPage from './pages/InventoryPage';
import ReportPage from './pages/ReportPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { theme } = useThemeStore();
  const { isAuthenticated, token, hydrate, setUser } = useAuthStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const syncProfile = async () => {
      if (!token) return;

      try {
        const response = await authApi.me();
        setUser(response.data);
      } catch {
        // Keep the signed-in user from /auth/signin even if /auth/me is unavailable
        // on an older backend build.
      }
    };

    syncProfile();
  }, [token, setUser]);

  return (
    <Router>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/signin" element={<SigninPage />} />
        
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/signin" />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/scanner"
          element={
            <ProtectedRoute>
              <ScannerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
