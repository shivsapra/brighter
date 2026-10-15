import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Star,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginFormProps {
  onSwitchToSignUp: () => void;
  onBackToWelcome: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToSignUp,
  onBackToWelcome,
}) => {
  const { signIn } = useAuth();
  const { success, error } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      error('Please fill in both email and password.');
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(email, password);
    setIsSubmitting(false);

    if (res.success) {
      success('Welcome back to Brighter!');
    } else {
      error(res.error || 'Invalid email or password.');
    }
  };

  return (
    <>
      <div className="auth-card glass-card">
        <div className="auth-card-header">
          <button
            type="button"
            className="back-nav-btn"
            onClick={onBackToWelcome}
            aria-label="Back to welcome"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="brand-heading">Welcome Back</h2>
            <p className="brand-subheading">Illuminate your feed and connect</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          {/* Email */}
          <div className="input-group">
            <label htmlFor="login-email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="field-icon" />
              <input
                id="login-email"
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field pl-icon"
              />
            </div>
          </div>

          {/* Password */}
          <div className="input-group">
            <div className="label-with-badge">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="link-btn text-muted text-xs hover-gold"
                onClick={() => setIsForgotOpen(true)}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-with-icon">
              <Lock size={18} className="field-icon" />
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field pl-icon pr-icon"
              />
              <button
                type="button"
                className="field-action-btn"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full mt-3"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" /> Signing In...
              </>
            ) : (
              <>
                <Star size={18} /> Log In
              </>
            )}
          </button>

          <div className="auth-card-footer mt-4 text-center">
            <span className="text-secondary">New to Brighter? </span>
            <button
              type="button"
              className="link-btn text-gold font-semibold"
              onClick={onSwitchToSignUp}
            >
              Create Account
            </button>
          </div>
        </form>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
      />
    </>
  );
};
