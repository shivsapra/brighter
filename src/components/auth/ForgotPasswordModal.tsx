import React, { useState } from 'react';
import { X, Mail, Star, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const { resetPassword } = useAuth();
  const { success, error } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    const res = await resetPassword(email);
    setIsSubmitting(false);

    if (res.success) {
      setSubmitted(true);
      success('Password reset link sent to your email.');
    } else {
      error(res.error || 'Failed to send reset link.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <KeyRound size={20} className="text-gold" />
            </div>
            <div>
              <h3>Reset Password</h3>
              <p className="modal-subtitle">Recover access to your Brighter account</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {submitted ? (
            <div className="state-card-empty text-center">
              <div className="star-ambient-pulse mb-3">
                <Mail size={36} className="text-gold" />
              </div>
              <h4>Check Your Inbox</h4>
              <p className="text-secondary mt-2">
                We sent a secure password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
              </p>
              <button
                className="btn btn-secondary mt-4 w-full"
                onClick={() => {
                  setSubmitted(false);
                  onClose();
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form-stack">
              <div className="input-group">
                <label htmlFor="reset-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="field-icon" />
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field pl-icon"
                  />
                </div>
              </div>

              <div className="modal-actions-row mt-4">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={isSubmitting}
                >
                  <Star size={16} />
                  {isSubmitting ? 'Sending Link...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
