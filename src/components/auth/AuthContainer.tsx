import React, { useState } from 'react';
import { StarfieldBackground } from '../common/StarfieldBackground';
import { WelcomeScreen } from './WelcomeScreen';
import { SignUpForm } from './SignUpForm';
import { LoginForm } from './LoginForm';
import { SupabaseConfigModal } from '../common/SupabaseConfigModal';
import { UpdatePasswordModal } from './UpdatePasswordModal';
import { useAuth } from '../../context/AuthContext';

export const AuthContainer: React.FC = () => {
  const [authView, setAuthView] = useState<'welcome' | 'signup' | 'login'>('welcome');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { isConfigured } = useAuth();

  return (
    <div className="auth-viewport-wrapper">
      <StarfieldBackground />

      <div className="auth-centered-canvas">
        {/* Supabase Prompt Alert if not configured yet (Development Only) */}
        {import.meta.env.DEV && !isConfigured && (
          <div className="config-banner-alert">
            <span className="dot-pulse" />
            <span className="banner-text">
              Supabase backend is awaiting connection credentials (Dev Mode).
            </span>
            <button
              className="btn btn-xs btn-outline-gold"
              onClick={() => setIsConfigOpen(true)}
            >
              Configure
            </button>
          </div>
        )}

        {authView === 'welcome' && (
          <WelcomeScreen
            onGoToSignUp={() => setAuthView('signup')}
            onGoToLogIn={() => setAuthView('login')}
            onOpenConfig={() => setIsConfigOpen(true)}
          />
        )}

        {authView === 'signup' && (
          <SignUpForm
            onSwitchToLogin={() => setAuthView('login')}
            onBackToWelcome={() => setAuthView('welcome')}
          />
        )}

        {authView === 'login' && (
          <LoginForm
            onSwitchToSignUp={() => setAuthView('signup')}
            onBackToWelcome={() => setAuthView('welcome')}
          />
        )}
      </div>

      <SupabaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <UpdatePasswordModal />
    </div>
  );
};
