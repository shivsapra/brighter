import React, { useState, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  FileText,
  Star,
  Loader2,
  Check,
  AlertCircle,
  Upload,
  Trash2,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { checkUsernameExists, uploadAvatar } from '../../lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, updateProfile, refreshProfile } = useAuth();
  const { success, error } = useToast();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewLocalUrl, setPreviewLocalUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/\s+/g, '').toLowerCase();
    setUsername(clean);

    if (clean === profile?.username.toLowerCase()) {
      setUsernameTaken(false);
      return;
    }

    if (!/^[a-z0-9_]{3,30}$/.test(clean)) {
      setUsernameTaken(true);
      return;
    }

    setIsCheckingUsername(true);
    const timeout = setTimeout(async () => {
      try {
        const taken = await checkUsernameExists(clean, user?.id);
        setUsernameTaken(taken);
      } catch {
        setUsernameTaken(false);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        error('Please select an image file (PNG, JPG, WebP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        error('Image size must be under 5MB.');
        return;
      }

      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewLocalUrl(objectUrl);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    if (previewLocalUrl) {
      URL.revokeObjectURL(previewLocalUrl);
      setPreviewLocalUrl(null);
    }
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      error('Authentication required.');
      return;
    }

    if (usernameTaken) {
      error(`@${username} is already taken.`);
      return;
    }

    setIsSaving(true);

    try {
      let finalAvatarUrl = avatarUrl;

      // If user selected a new image file, upload to Supabase Storage 'avatars' bucket
      if (selectedFile) {
        setIsUploadingPhoto(true);
        const { url: uploadedUrl, error: uploadErr } = await uploadAvatar(user.id, selectedFile);
        setIsUploadingPhoto(false);

        if (uploadErr) {
          console.warn('Storage upload note:', uploadErr);
          // If storage bucket is not configured yet or RLS blocked, report friendly message
          error(`Photo upload note: ${uploadErr.message || 'Could not upload to storage bucket'}`);
        } else if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl;
        }
      }

      const res = await updateProfile({
        display_name: displayName.trim() || username.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatar_url: finalAvatarUrl,
      });

      if (res.success) {
        await refreshProfile();
        success('Profile updated in Supabase database!');
        onClose();
      } else {
        error(res.error || 'Failed to update profile.');
      }
    } catch (err: any) {
      error(err?.message || 'An error occurred while saving profile.');
    } finally {
      setIsSaving(false);
      setIsUploadingPhoto(false);
    }
  };

  const currentDisplayAvatar = previewLocalUrl || avatarUrl;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <User size={20} className="text-gold" />
            </div>
            <div>
              <h3>Edit Profile</h3>
              <p className="modal-subtitle">Update your personal presence on Brighter</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Avatar Upload Section */}
          <div className="avatar-preview-row mb-4">
            <div
              className="avatar-preview-box avatar-interactive"
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload profile photo"
            >
              {currentDisplayAvatar ? (
                <img
                  src={currentDisplayAvatar}
                  alt="Profile Avatar Preview"
                  className="avatar-preview-img"
                  onError={() => setAvatarUrl(null)}
                />
              ) : (
                <div className="avatar-placeholder-large">
                  {(displayName || username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="avatar-upload-overlay">
                <Camera size={18} />
              </div>
            </div>

            <div className="avatar-preview-info">
              <span className="font-semibold text-primary">Profile Picture</span>
              <p className="text-muted text-xs">
                Upload image to Supabase Storage (PNG, JPG, WebP)
              </p>
              <div className="avatar-action-buttons mt-2">
                <button
                  type="button"
                  className="btn btn-xs btn-outline-gold"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={13} /> Upload Photo
                </button>
                {currentDisplayAvatar && (
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary text-danger"
                    onClick={handleRemovePhoto}
                    title="Remove profile picture"
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            {/* Display Name */}
            <div className="input-group">
              <label htmlFor="edit-display-name">Display Name</label>
              <div className="input-with-icon">
                <User size={18} className="field-icon" />
                <input
                  id="edit-display-name"
                  type="text"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="input-field pl-icon"
                />
              </div>
            </div>

            {/* Username */}
            <div className="input-group">
              <div className="label-with-badge">
                <label htmlFor="edit-username">Username</label>
                {isCheckingUsername && (
                  <span className="badge-status badge-checking">
                    <Loader2 size={12} className="spin" /> Checking...
                  </span>
                )}
                {!isCheckingUsername && usernameTaken && (
                  <span className="badge-status badge-danger">
                    <AlertCircle size={12} /> Unavailable
                  </span>
                )}
                {!isCheckingUsername && !usernameTaken && username !== profile?.username && (
                  <span className="badge-status badge-success">
                    <Check size={12} /> Available
                  </span>
                )}
              </div>
              <div className="input-with-icon">
                <AtSign size={18} className="field-icon" />
                <input
                  id="edit-username"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  required
                  maxLength={30}
                  className="input-field pl-icon"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="input-group">
              <div className="label-with-badge">
                <label htmlFor="edit-bio">Bio</label>
                <span className="text-muted text-xs">{bio.length}/150</span>
              </div>
              <div className="input-with-icon">
                <FileText size={18} className="field-icon textarea-icon" />
                <textarea
                  id="edit-bio"
                  rows={3}
                  maxLength={150}
                  placeholder="Tell the Brighter world about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="input-field pl-icon textarea-field"
                />
              </div>
            </div>

            <div className="modal-actions-row mt-4">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={isSaving || usernameTaken}
              >
                {isSaving || isUploadingPhoto ? (
                  <>
                    <Loader2 size={16} className="spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Star size={16} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
