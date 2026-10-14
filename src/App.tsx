import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminProvider } from './context/AdminContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthContainer } from './components/auth/AuthContainer';
import { AppShell } from './components/app/AppShell';
import { LoadingScreen } from './components/common/LoadingScreen';
import './App.css';

const MainRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Illuminating your world..." />;
  }

  if (user) {
    return <AppShell />;
  }

  return <AuthContainer />;
};

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AdminProvider>
            <MainRouter />
          </AdminProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
