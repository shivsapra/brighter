import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  Star,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { checkUsernameExists } from '../../lib/supabase';

interface SignUpFormProps {
  onSwitchToLogin: () => void;
  onBackToWelcome: () => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({
  onSwitchToLogin,
  onBackToWelcome,
}) => {
  const { signUp, isConfigured } = useAuth();
  const { success, error } = useToast();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Live username checking
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'available' | 'taken' | 'invalid'>('idle');

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Handle username typing with debounced uniqueness check
  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/\s+/g, '').toLowerCase();
    setUsername(clean);

    if (!clean) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameStatus('invalid');
      return;
    }

    if (!isConfigured) {
      setUsernameStatus('idle');
      return;
    }

    setIsCheckingUsername(true);
    // Debounce check
    const timeout = setTimeout(async () => {
      try {
        const taken = await checkUsernameExists(clean);
        setUsernameStatus(taken ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      } finally {
        setIsCheckingUsername(false);
      }
    }, 450);

    return () => clearTimeout(timeout);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      error('Please choose a username.');
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      error('Username must be 3-30 characters (letters, numbers, underscores).');
      return;
    }

    if (usernameStatus === 'taken') {
      error(`@${username} is already taken.`);
      return;
    }

    if (password.length < 6) {
      error('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await signUp(email, password, username, displayName || username);
    setIsSubmitting(false);

    if (res.success) {
      if (res.needsVerification) {
        setRegisteredEmail(email);
        setNeedsVerification(true);
        success('Account created! Please check your email to verify.');
      } else {
        success('Welcome to Brighter! Your profile has been initialized.');
      }
    } else {
      error(res.error || 'Failed to create account.');
    }
  };

  if (needsVerification) {
    return (
      <div className="auth-card glass-card">
        <div className="state-card-empty text-center py-4">
          <div className="star-ambient-pulse mb-3">
            <Mail size={42} className="text-gold" />
          </div>
          <h2 className="brand-heading mb-2">Verify Your Email</h2>
          <p className="text-secondary mb-4">
            We sent a verification link to <strong className="text-primary">{registeredEmail}</strong>.
            Click the link in your inbox to activate your account and start sharing on Brighter.
          </p>
          <div className="verification-note p-3 mb-4">
            <p className="text-muted text-sm">
              Didn't receive an email? Check your spam folder or ensure "Confirm email" settings in your Supabase Dashboard.
            </p>
          </div>
          <button
            className="btn btn-primary w-full"
            onClick={onSwitchToLogin}
          >
            Proceed to Log In
          </button>
        </div>
      </div>
    );
  }

  return (
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
          <h2 className="brand-heading">Create Account</h2>
          <p className="brand-subheading">Step into the starlight of Brighter</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        {/* Username */}
        <div className="input-group">
          <div className="label-with-badge">
            <label htmlFor="reg-username">Username</label>
            {isCheckingUsername && (
              <span className="badge-status badge-checking">
                <Loader2 size={12} className="spin" /> Checking...
              </span>
            )}
            {!isCheckingUsername && usernameStatus === 'available' && (
              <span className="badge-status badge-success">
                <Check size={12} /> Available
              </span>
            )}
            {!isCheckingUsername && usernameStatus === 'taken' && (
              <span className="badge-status badge-danger">
                <AlertCircle size={12} /> Taken
              </span>
            )}
            {!isCheckingUsername && usernameStatus === 'invalid' && (
              <span className="badge-status badge-danger">
                3-30 chars, a-z, 0-9, _
              </span>
            )}
          </div>
          <div className="input-with-icon">
            <AtSign size={18} className="field-icon" />
            <input
              id="reg-username"
              type="text"
              placeholder="unique_username"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              className={`input-field pl-icon ${
                usernameStatus === 'available' ? 'border-success' : usernameStatus === 'taken' ? 'border-danger' : ''
              }`}
            />
          </div>
        </div>

        {/* Display Name */}
        <div className="input-group">
          <label htmlFor="reg-display-name">Display Name (Optional)</label>
          <div className="input-with-icon">
            <User size={18} className="field-icon" />
            <input
              id="reg-display-name"
              type="text"
              placeholder="e.g. Maya Starling"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field pl-icon"
            />
          </div>
        </div>

        {/* Email */}
        <div className="input-group">
          <label htmlFor="reg-email">Email Address</label>
          <div className="input-with-icon">
            <Mail size={18} className="field-icon" />
            <input
              id="reg-email"
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
          <label htmlFor="reg-password">Password</label>
          <div className="input-with-icon">
            <Lock size={18} className="field-icon" />
            <input
              id="reg-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Min. 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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

        {/* Confirm Password */}
        <div className="input-group">
          <div className="label-with-badge">
            <label htmlFor="reg-confirm-password">Confirm Password</label>
            {confirmPassword && password === confirmPassword && (
              <span className="badge-status badge-success">
                <Check size={12} /> Matches
              </span>
            )}
            {confirmPassword && password !== confirmPassword && (
              <span className="badge-status badge-danger">
                Does not match
              </span>
            )}
          </div>
          <div className="input-with-icon">
            <Lock size={18} className="field-icon" />
            <input
              id="reg-confirm-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input-field pl-icon"
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full mt-3"
          disabled={isSubmitting || usernameStatus === 'taken'}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="spin" /> Creating Profile...
            </>
          ) : (
            <>
              <Star size={18} /> Join Brighter
            </>
          )}
        </button>

        <div className="auth-card-footer mt-4 text-center">
          <span className="text-secondary">Already have an account? </span>
          <button
            type="button"
            className="link-btn text-gold font-semibold"
            onClick={onSwitchToLogin}
          >
            Log In
          </button>
        </div>
      </form>
    </div>
  );
};
