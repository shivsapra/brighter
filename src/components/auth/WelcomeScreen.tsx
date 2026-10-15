import React from 'react';
import {
  LogIn,
  UserPlus,
  Shield,
  Zap,
  Globe,
  Database,
  Sun,
  Moon,
} from 'lucide-react';
import { BrighterLogo } from '../common/BrighterLogo';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

interface WelcomeScreenProps {
  onGoToSignUp: () => void;
  onGoToLogIn: () => void;
  onOpenConfig: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onGoToSignUp,
  onGoToLogIn,
  onOpenConfig,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { isConfigured } = useAuth();

  return (
    <div className="welcome-container">
      {/* Top Floating Controls */}
      <header className="welcome-topbar">
        {import.meta.env.DEV && (
          <button
            className={`status-chip ${isConfigured ? 'status-chip-connected' : 'status-chip-warn'}`}
            onClick={onOpenConfig}
            title="Development Only: Supabase Database & Auth Debug Status"
          >
            <Database size={14} />
            <span>{isConfigured ? 'Supabase Connected (Dev)' : 'Connect Supabase (Dev)'}</span>
          </button>
        )}

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main Welcome Hero Content */}
      <main className="welcome-hero-content">
        <div className="welcome-logo-badge">
          <BrighterLogo size="xl" showText={false} withGlow={true} />
        </div>

        <h1 className="welcome-title">
          Brighter
        </h1>

        <p className="welcome-tagline">
          Where creativity meets starlight.
        </p>

        <p className="welcome-description">
          The next-generation social video platform designed for authentic moments,
          empowered creators, and radiant stories.
        </p>

        {/* Feature Highlights Pills */}
        <div className="welcome-features-row">
          <div className="feature-pill">
            <Zap size={14} className="text-gold" />
            <span>High-FPS Sparks</span>
          </div>
          <div className="feature-pill">
            <Shield size={14} className="text-gold" />
            <span>PostgreSQL & RLS</span>
          </div>
          <div className="feature-pill">
            <Globe size={14} className="text-gold" />
            <span>Global Creators</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="welcome-cta-group">
          <button
            className="btn btn-primary btn-lg w-full welcome-btn"
            onClick={onGoToSignUp}
          >
            <UserPlus size={18} />
            <span>Create Account</span>
          </button>

          <button
            className="btn btn-secondary btn-lg w-full welcome-btn"
            onClick={onGoToLogIn}
          >
            <LogIn size={18} />
            <span>Log In</span>
          </button>
        </div>

        {/* Legal Disclaimer */}
        <p className="welcome-legal">
          By continuing, you agree to Brighter's{' '}
          <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Service</a> and{' '}
          <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>.
        </p>
      </main>
    </div>
  );
};
