import { useEffect, useMemo, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { ThemeProvider, createTheme, CssBaseline, Snackbar, Alert } from "@mui/material"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { logout } from "./features/auth/authSlice"
import Landing from "./pages/Landing"
import LoginSignUp from "./pages/LoginSignUp"
import Dashboard from "./pages/Dashboard"
import MonthlyUpdates from "./pages/MonthlyUpdates"
import AddEmployee from "./pages/AddEmployee"
import ResetPassword from "./pages/ResetPassword"
import Settings from "./pages/Settings"
import Reports from "./pages/Reports"
import EmployeePortal from "./pages/EmployeePortal"
import NotFound from "./pages/NotFound"
import ProtectedRoute from "./components/ProtectedRoute"
import ScrollToTop from "./components/common/ScrollToTop"
import CommandPalette from "./components/common/CommandPalette"
import OfflineSyncIndicator from './components/OfflineSyncIndicator';
import SystemHealth from "./pages/SystemHealth"
import Flashcards from "./pages/Flashcards"
import PyqDashboard from "./pages/PyqDashboard"
import QuizBattle from "./pages/QuizBattle"

function App() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.ui.themeMode);
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // Listen to global toast events (e.g. from axios interceptor background saves)
  useEffect(() => {
    const handleToastShow = (e) => {
      setToast({
        open: true,
        message: e.detail?.message || "Notification received",
        severity: e.detail?.severity || "info",
      });
    };
    window.addEventListener("toast:show", handleToastShow);
    return () => window.removeEventListener("toast:show", handleToastShow);
  }, []);

  // Synchronize Redux auth state when API interceptor detects expired/invalid auth
  useEffect(() => {
    const handleAuthLogout = () => {
      dispatch(logout());
    };
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [dispatch]);

  // Sync dark class on html document element for Tailwind v4 custom dark variant
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Create MUI theme based on the active theme mode
  const muiTheme = useMemo(() => {
    return createTheme({
      palette: {
        mode: themeMode,
        primary: {
          main: '#3b82f6',
        },
        background: {
          default: themeMode === 'dark' ? '#090d16' : '#f3f4f6',
          paper: themeMode === 'dark' ? '#111827' : '#ffffff',
        },
      },
    });
  }, [themeMode]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<LoginSignUp />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee-portal"
            element={
              <ProtectedRoute>
                <EmployeePortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monthly-updates"
            element={
              <ProtectedRoute>
                <MonthlyUpdates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-employee"
            element={
              <ProtectedRoute>
                <AddEmployee />
              </ProtectedRoute>
            }
          />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/settings/system-health" element={<ProtectedRoute><SystemHealth /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/flashcards" element={<ProtectedRoute><Flashcards /></ProtectedRoute>} />
          <Route path="/pyqs" element={<ProtectedRoute><PyqDashboard /></ProtectedRoute>} />
          <Route path="/quiz-battle" element={<ProtectedRoute><QuizBattle /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ScrollToTop />
        <CommandPalette />
        {/* Global Offline Sync Indicator (Issue #815) */}
        <OfflineSyncIndicator />
      </BrowserRouter>
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
