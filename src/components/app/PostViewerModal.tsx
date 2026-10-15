import React, { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Bookmark, Share2, Star, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchPostById,
  checkIsPostLiked,
  fetchPostLikesCount,
  togglePostLike,
  checkIsPostSaved,
  savePost,
  unsavePost,
  fetchCommentCount,
  deletePost,
  adminDeletePost,
} from '../../lib/supabase';
import { CommentsModal } from './CommentsModal';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import { MediaCache } from '../../lib/mediaCache';
import type { Post } from '../../types/database';

interface PostViewerModalProps {
  postId: string | null;
  onClose: () => void;
  onSelectCreator?: (creatorId: string) => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostViewerModal: React.FC<PostViewerModalProps> = ({
  postId,
  onClose,
  onSelectCreator,
  onPostDeleted,
}) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { success, error: toastError } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMediaLoaded, setIsMediaLoaded] = useState<boolean>(false);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [commentsCount, setCommentsCount] = useState<number>(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const isOwner = Boolean(user && post && post.user_id === user.id);

  // Sync media cache for immediate display if previously cached
  useEffect(() => {
    if (post) {
      const url = post.media_url || post.image_url;
      if (url && post.media_type !== 'video' && MediaCache.isLoaded(url)) {
        setIsMediaLoaded(true);
      } else {
        setIsMediaLoaded(false);
      }
    }
  }, [post]);

  useEffect(() => {
    if (!postId) {
      setPost(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    fetchPostById(postId)
      .then(async (fetched) => {
        if (!isMounted) return;
        setPost(fetched);
        setIsLoading(false);

        if (fetched) {
          const [lCount, cCount, userLiked, userSaved] = await Promise.all([
            fetchPostLikesCount(fetched.id),
            fetchCommentCount(fetched.id),
            user ? checkIsPostLiked(fetched.id, user.id) : Promise.resolve(false),
            user ? checkIsPostSaved(fetched.id, user.id) : Promise.resolve(false),
          ]);
          if (isMounted) {
            setLikesCount(lCount);
            setCommentsCount(cCount);
            setIsLiked(userLiked);
            setIsSaved(userSaved);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching post:', err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [postId, user]);

  const handleToggleLike = async () => {
    if (!user) {
      toastError('Please log in to like Sparks.');
      return;
    }
    if (!post) return;

    const previousLiked = isLiked;
    const previousCount = likesCount;

    // Optimistic update
    setIsLiked(!previousLiked);
    setLikesCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    const { isLiked: finalLiked, error } = await togglePostLike(post.id, user.id, previousLiked);
    if (error) {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      toastError(error);
    } else {
      setIsLiked(finalLiked);
      if (finalLiked) success('Spark liked! ✨');
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      toastError('Please log in to save Sparks.');
      return;
    }
    if (!post) return;

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);

    if (nextSaved) {
      const { error } = await savePost(post.id, user.id);
      if (error) {
        setIsSaved(false);
        toastError(error);
      } else {
        success('Saved to your profile! 🔖');
      }
    } else {
      const { error } = await unsavePost(post.id, user.id);
      if (error) {
        setIsSaved(true);
        toastError(error);
      } else {
        success('Removed from saved.');
      }
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const creatorHandle = post.profiles?.username || 'creator';
    const shareUrl = `${window.location.origin}/?post=${post.id}`;
    const shareData = {
      title: `Spark by @${creatorHandle} on Brighter`,
      text: post.caption || 'Check out this Spark on Brighter ✨',
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        success('Shared successfully!');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      success('Spark link copied to clipboard! ✨');
    } catch {
      toastError('Failed to copy link.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !post) return;
    setIsDeleting(true);
    try {
      if (isOwner) {
        const res = await deletePost(post.id, user.id);
        if (res.success) {
          success('Your Spark was deleted successfully.');
          setShowDeleteConfirm(false);
          onPostDeleted?.(post.id);
          onClose();
        } else {
          toastError(res.error || 'Failed to delete post.');
        }
      } else if (isAdmin) {
        const res = await adminDeletePost(user.id, post.id);
        if (res.success) {
          success('Post deleted by Administrator.');
          setShowDeleteConfirm(false);
          onPostDeleted?.(post.id);
          onClose();
        } else {
          toastError(res.error || 'Failed to delete post.');
        }
      }
    } catch (err: any) {
      toastError(err?.message || 'Error deleting post.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!postId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-card post-viewer-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="post-viewer-close-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        {isLoading ? (
          <div className="post-viewer-loading">
            <Loader2 size={36} className="spin text-gold mb-3" />
            <p className="text-secondary text-sm">Illuminating Spark...</p>
          </div>
        ) : post ? (
          <div className="post-viewer-layout">
            {/* Media Canvas */}
            <div className="post-viewer-media-box">
              {post.media_url || post.image_url ? (
                <>
                  {!isMediaLoaded && (
                    <div className="media-loading-placeholder">
                      <div className="shimmer-sweep" />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Star size={36} className="text-gold animate-pulse" />
                        <span className="text-xs text-muted font-medium">Loading original quality Spark...</span>
                      </div>
                    </div>
                  )}

                  {post.media_type === 'video' ? (
                    <video
                      src={post.media_url || post.image_url || ''}
                      controls
                      autoPlay
                      loop
                      playsInline
                      preload="auto"
                      onLoadedData={() => setIsMediaLoaded(true)}
                      onCanPlay={() => setIsMediaLoaded(true)}
                      className={`post-viewer-video media-fade-in ${isMediaLoaded ? 'media-ready' : ''}`}
                    />
                  ) : (
                    <img
                      src={post.media_url || post.image_url || ''}
                      alt={post.caption || 'Spark'}
                      decoding="async"
                      onLoad={() => {
                        MediaCache.markLoaded(post.media_url || post.image_url);
                        setIsMediaLoaded(true);
                      }}
                      className={`post-viewer-img media-fade-in ${isMediaLoaded ? 'media-ready' : ''}`}
                    />
                  )}
                </>
              ) : (
                <div className="post-viewer-text-spark">
                  <Star size={48} className="text-gold mb-3" />
                  <p className="post-viewer-spark-text">{post.caption}</p>
                </div>
              )}
            </div>

            {/* Sidebar Details */}
            <div className="post-viewer-sidebar">
              {/* Creator info */}
              <div
                className="post-viewer-creator-bar"
                onClick={() => {
                  if (post.profiles?.id) {
                    onSelectCreator?.(post.profiles.id);
                    onClose();
                  }
                }}
              >
                <div className="post-viewer-avatar">
                  {post.profiles?.avatar_url ? (
                    <img src={post.profiles.avatar_url} alt="" className="avatar-img-sm" />
                  ) : (
                    <div className="avatar-letter-sm">
                      {(post.profiles?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="post-viewer-creator-handle flex items-center gap-1.5">
                    <span>@{post.profiles?.username || 'creator'}</span>
                    <VerifiedAdminBadge userId={post.profiles?.id} size="sm" showTooltip={true} />
                  </h4>
                  <span className="text-xs text-muted">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <div className="post-viewer-caption">
                  <p>{post.caption}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="post-viewer-actions">
                <button
                  className={`action-pill ${isLiked ? 'active' : ''}`}
                  onClick={handleToggleLike}
                  title="Like this spark"
                >
                  <Heart size={18} fill={isLiked ? '#F59E0B' : 'none'} color={isLiked ? '#F59E0B' : 'currentColor'} />
                  <span>{likesCount}</span>
                </button>

                <button
                  className="action-pill"
                  onClick={() => setIsCommentsOpen(true)}
                  title="View comments"
                >
                  <MessageCircle size={18} />
                  <span>{commentsCount}</span>
                </button>

                <button
                  className={`action-pill ${isSaved ? 'active' : ''}`}
                  onClick={handleToggleSave}
                  title="Bookmark this spark"
                >
                  <Bookmark size={18} fill={isSaved ? '#F59E0B' : 'none'} color={isSaved ? '#F59E0B' : 'currentColor'} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button className="action-pill" onClick={handleShare} title="Share link">
                  <Share2 size={18} />
                  <span>Share</span>
                </button>

                {(isOwner || isAdmin) && (
                  <button
                    className="action-pill action-pill-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                    title={isOwner ? 'Delete your spark' : 'Delete spark (Admin)'}
                  >
                    <Trash2 size={18} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="post-viewer-empty">
            <Star size={36} className="text-gold mb-3" />
            <h3>Spark not found</h3>
            <p className="text-secondary text-sm">This post may have been removed.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div
          className="feed-confirm-overlay"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
        >
          <div
            className="feed-confirm-dialog glass-card animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-box danger">
              <Trash2 size={26} />
            </div>
            <h3 className="confirm-title">
              {isOwner ? 'Delete your Spark?' : 'Delete Spark (Admin)?'}
            </h3>
            <p className="confirm-message">
              {isOwner
                ? 'Are you sure you want to permanently delete this post? All likes, bookmarks, and comments on it will be removed. This action cannot be undone.'
                : 'As an administrator, permanently remove this post. This action is recorded in the audit log.'}
            </p>
            <div className="confirm-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-1"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm flex-1"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="spin" /> Deleting...
                  </>
                ) : (
                  'Delete Post'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {post && (
        <CommentsModal
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
          postId={post.id}
          onCommentAdded={() => setCommentsCount((c) => c + 1)}
          onCommentDeleted={() => setCommentsCount((c) => Math.max(0, c - 1))}
        />
      )}
    </div>
  );
};
