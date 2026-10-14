import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Trash2, Loader2, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useToast } from '../../context/ToastContext';
import { fetchComments, createComment, deleteComment } from '../../lib/supabase';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import type { Comment } from '../../types/database';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  onCommentAdded?: () => void;
  onCommentDeleted?: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  isOpen,
  onClose,
  postId,
  onCommentAdded,
  onCommentDeleted,
}) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { success, error: toastError } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !postId) return;

    let isMounted = true;
    setIsLoading(true);

    fetchComments(postId)
      .then((data) => {
        if (isMounted) {
          setComments(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching comments:', err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, postId]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) {
      toastError('You must be logged in to comment.');
      return;
    }
    const text = newComment.trim();
    if (!text) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await createComment(postId, user.id, text);
      if (error || !data) {
        toastError(error?.message || 'Failed to post comment.');
      } else {
        setComments((prev) => [...prev, data]);
        setNewComment('');
        success('Comment added! ✨');
        onCommentAdded?.();
        setTimeout(scrollToBottom, 100);
      }
    } catch (err: any) {
      toastError(err?.message || 'Could not post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!user) return;
    setDeletingId(commentId);
    try {
      const { error } = await deleteComment(commentId, user.id);
      if (error) {
        toastError(error.message || 'Failed to delete comment.');
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        success('Comment deleted.');
        onCommentDeleted?.();
      }
    } catch (err: any) {
      toastError(err?.message || 'Could not delete comment.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24) return `${diffHour}h ago`;
      const diffDays = Math.floor(diffHour / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-card comments-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <div className="icon-badge">
              <Star size={18} className="text-gold" />
            </div>
            <div>
              <h3 id="comments-title">
                Comments <span className="comment-count-pill">{comments.length}</span>
              </h3>
              <p className="modal-subtitle">Join the Brighter conversation</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close comments">
            <X size={20} />
          </button>
        </div>

        {/* Comments Body */}
        <div className="comments-stream-container">
          {isLoading ? (
            <div className="comments-loading-state">
              <Loader2 size={28} className="spin text-gold mb-2" />
              <p className="text-secondary text-sm">Loading Sparks & discussions...</p>
            </div>
          ) : comments.length > 0 ? (
            <div className="comments-list">
              {comments.map((comment) => {
                const creator = comment.profiles;
                const username = creator?.username || 'user';
                const avatarUrl = creator?.avatar_url;
                const isOwnComment = user?.id === comment.user_id;

                return (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="avatar-img-sm" />
                      ) : (
                        <div className="avatar-letter-sm">
                          {username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="comment-bubble">
                      <div className="comment-topline">
                        <div className="comment-user-badge-wrap flex items-center gap-1.5">
                          <span className="comment-username font-semibold">@{username}</span>
                          <VerifiedAdminBadge userId={comment.user_id} size="xs" showTooltip={true} />
                        </div>
                        <span className="comment-timestamp">
                          {formatTimestamp(comment.created_at)}
                        </span>
                      </div>
                      <p className="comment-body-text">{comment.body}</p>
                    </div>

                    {(isOwnComment || isAdmin) && (
                      <button
                        className={`comment-delete-button ${isAdmin && !isOwnComment ? 'admin-mod-btn' : ''}`}
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        title={isAdmin && !isOwnComment ? 'Admin: Remove abusive comment' : 'Delete your comment'}
                        aria-label="Delete comment"
                      >
                        {deletingId === comment.id ? (
                          <Loader2 size={14} className="spin text-muted" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={commentsEndRef} />
            </div>
          ) : (
            <div className="comments-empty-state">
              <div className="empty-spark-icon">
                <Star size={32} className="text-gold" />
              </div>
              <h4>No comments yet</h4>
              <p className="text-secondary text-sm">
                Be the first to share your thoughts on this Spark!
              </p>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form className="comments-input-bar" onSubmit={handleSubmit}>
          <input
            type="text"
            className="comment-input-field"
            placeholder={user ? "Add a kind comment... ✨" : "Log in to join the conversation"}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={!user || isSubmitting}
            maxLength={500}
          />
          <button
            type="submit"
            className="comment-send-button"
            disabled={!user || !newComment.trim() || isSubmitting}
            aria-label="Send comment"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="spin text-gold" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
