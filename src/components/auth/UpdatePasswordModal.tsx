import React, { useState } from 'react';
import { Lock, Star, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const UpdatePasswordModal: React.FC = () => {
  const { recoveryMode, setRecoveryMode, updatePassword } = useAuth();
  const { success, error } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!recoveryMode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      error('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await updatePassword(password);
    setIsSubmitting(false);

    if (res.success) {
      success('Password updated successfully! Welcome back.');
      setRecoveryMode(false);
    } else {
      error(res.error || 'Failed to update password.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <Lock size={20} className="text-gold" />
            </div>
            <div>
              <h3>Choose New Password</h3>
              <p className="modal-subtitle">Secure your Brighter account</p>
            </div>
          </div>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="form-stack">
            <div className="input-group">
              <label htmlFor="new-password">New Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  id="new-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="At least 6 characters"
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

            <div className="input-group">
              <label htmlFor="confirm-new-password">Confirm New Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="field-icon" />
                <input
                  id="confirm-new-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="input-field pl-icon"
                />
              </div>
            </div>

            <div className="modal-actions-row mt-4">
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isSubmitting}
              >
                <Star size={16} />
                {isSubmitting ? 'Saving Password...' : 'Update & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
