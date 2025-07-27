
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster, toast } from 'react-hot-toast';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { useEffect } from 'react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ReportForm from './pages/ReportForm';
import ReportDetail from './pages/ReportDetail';
import Stock from './pages/Stock';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import OrderForm from './pages/OrderForm';
import OrderDetail from './pages/OrderDetail';
import Quotes from './pages/Quotes';
import Invoices from './pages/Invoices';

// Components
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const AppContent = () => {
  const { isDarkMode } = useTheme();
  
  useEffect(() => {
    const handleNotification = (event: any) => {
      const { message, type } = event.detail;
      if (type === 'success') {
        toast.success(message);
      } else if (type === 'error') {
        toast.error(message);
      } else {
        toast(message);
      }
    };
    
    window.addEventListener('showNotification', handleNotification);
    return () => window.removeEventListener('showNotification', handleNotification);
  }, []);
  
  const theme = createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Navigate to="/dashboard" replace />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/reports" element={
              <ProtectedRoute>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/reports/new" element={
              <ProtectedRoute>
                <Layout>
                  <ReportForm />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/reports/:id" element={
              <ProtectedRoute>
                <Layout>
                  <ReportDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/stock" element={
              <ProtectedRoute>
                <Layout>
                  <Stock />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/clients" element={
              <ProtectedRoute>
                <Layout>
                  <Clients />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Layout>
                  <Orders />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/orders/new" element={
              <ProtectedRoute>
                <Layout>
                  <OrderForm />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/orders/:id" element={
              <ProtectedRoute>
                <Layout>
                  <OrderDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/quotes" element={
              <ProtectedRoute>
                <Layout>
                  <Quotes />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/invoices" element={
              <ProtectedRoute>
                <Layout>
                  <Invoices />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      <Toaster position="top-right" />
    </MuiThemeProvider>
  );
};

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
