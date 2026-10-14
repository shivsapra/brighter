import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Film,
  Music,
  Hash,
  AtSign,
  Globe,
  Lock,
  Users,
  Star,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { createPost, uploadPostMedia } from '../../lib/supabase';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { user, profile } = useAuth();
  const { success, error } = useToast();

  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'friends' | 'private'>('public');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [soundName, setSoundName] = useState('Original Audio — ' + (profile?.username || 'You'));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        error('File is too large. Please select a file under 50MB.');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddHashtag = () => {
    setCaption((prev) => (prev ? `${prev} #Brighter` : '#Brighter '));
  };

  const handleAddMention = () => {
    setCaption((prev) => (prev ? `${prev} @` : '@'));
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      error('You must be logged in to post.');
      return;
    }

    if (!selectedFile && !caption.trim()) {
      error('Please add a photo/video or write a caption for your Spark.');
      return;
    }

    setIsPosting(true);

    try {
      let mediaUrl: string | null = null;

      // Upload file to Supabase Storage if present
      if (selectedFile) {
        const { url, error: uploadErr } = await uploadPostMedia(user.id, selectedFile);
        if (uploadErr) {
          console.warn('Storage upload note:', uploadErr);
        } else {
          mediaUrl = url;
        }
      }

      // Save to Supabase 'posts' table
      const { error: postErr } = await createPost({
        user_id: user.id,
        caption: caption.trim() || null,
        media_url: mediaUrl,
        media_type: selectedFile?.type.startsWith('video') ? 'video' : 'image',
        privacy: privacy,
      });

      if (postErr) {
        error(`Failed to post: ${postErr.message}`);
      } else {
        success('✨ Spark posted successfully to your profile!');
        clearSelectedFile();
        setCaption('');
        onPostCreated?.();
        onClose();
      }
    } catch (err: any) {
      error(err?.message || 'Failed to publish post.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card create-post-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <Film size={20} className="text-gold" />
            </div>
            <div>
              <h3>Create Spark</h3>
              <p className="modal-subtitle">Share your perspective with Brighter</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body create-post-grid">
          {/* Left / Upload Area */}
          <div className="create-upload-area">
            {previewUrl ? (
              <div className="media-preview-container">
                {selectedFile?.type.startsWith('video') ? (
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    loop
                    className="media-preview-player"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="media-preview-img"
                  />
                )}
                <button
                  type="button"
                  className="remove-media-btn"
                  onClick={clearSelectedFile}
                  title="Remove media"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div
                className="dropzone-box"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="dropzone-icon-orb">
                  <UploadCloud size={32} className="text-gold" />
                </div>
                <h4>Select video or photo</h4>
                <p className="dropzone-hint">
                  Or drag and drop a media file
                </p>
                <div className="dropzone-specs">
                  <span>MP4, MOV, WebM, PNG, JPG</span>
                  <span>Less than 50MB</span>
                  <span>Direct to Supabase Storage</span>
                </div>
                <button type="button" className="btn btn-primary btn-sm mt-3">
                  Select File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="video/*,image/*"
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>

          {/* Right / Post Details */}
          <form onSubmit={handlePost} className="create-details-form form-stack">
            {/* Caption */}
            <div className="input-group">
              <div className="label-with-badge">
                <label htmlFor="spark-caption">Caption</label>
                <span className="text-muted text-xs">{caption.length}/2200</span>
              </div>
              <textarea
                id="spark-caption"
                rows={4}
                maxLength={2200}
                placeholder="Write an illuminating caption... add hashtags # or mention @creators"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="input-field textarea-field"
              />
              <div className="quick-tags-row mt-2">
                <button
                  type="button"
                  className="quick-tag-chip"
                  onClick={handleAddHashtag}
                >
                  <Hash size={13} /> Hashtag
                </button>
                <button
                  type="button"
                  className="quick-tag-chip"
                  onClick={handleAddMention}
                >
                  <AtSign size={13} /> Mention
                </button>
              </div>
            </div>

            {/* Audio Picker */}
            <div className="input-group">
              <label>
                <Music size={14} className="text-gold" /> Background Audio
              </label>
              <div className="sound-picker-bar">
                <span className="sound-name truncate">{soundName}</span>
                <button
                  type="button"
                  className="link-btn text-xs text-gold"
                  onClick={() => setSoundName('Starlight Pulse (Trending Sound)')}
                >
                  Change
                </button>
              </div>
            </div>

            {/* Privacy Controls */}
            <div className="input-group">
              <label>Who can view this Spark</label>
              <div className="privacy-select-row">
                <button
                  type="button"
                  className={`privacy-chip ${privacy === 'public' ? 'active' : ''}`}
                  onClick={() => setPrivacy('public')}
                >
                  <Globe size={14} /> Public
                </button>
                <button
                  type="button"
                  className={`privacy-chip ${privacy === 'friends' ? 'active' : ''}`}
                  onClick={() => setPrivacy('friends')}
                >
                  <Users size={14} /> Friends
                </button>
                <button
                  type="button"
                  className={`privacy-chip ${privacy === 'private' ? 'active' : ''}`}
                  onClick={() => setPrivacy('private')}
                >
                  <Lock size={14} /> Only Me
                </button>
              </div>
            </div>

            {/* Post Button */}
            <div className="modal-actions-row mt-auto pt-3">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={onClose}
              >
                Discard
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={isPosting}
              >
                {isPosting ? (
                  <>
                    <Loader2 size={16} className="spin" /> Publishing...
                  </>
                ) : (
                  <>
                    <Star size={16} /> Post Spark
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
