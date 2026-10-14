import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  MoreVertical,
  Trash2,
  EyeOff,
  Play,
  X,
  Loader2,
  Star,
} from 'lucide-react';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import { deletePost, adminDeletePost, adminTogglePostVisibility } from '../../lib/supabase';
import { MediaCache } from '../../lib/mediaCache';
import { useToast } from '../../context/ToastContext';
import type { Post } from '../../types/database';

interface FeedPostCardProps {
  post: Post;
  isMuted: boolean;
  isLiked: boolean;
  likesCount: number;
  isSaved: boolean;
  commentsCount: number;
  currentUserId?: string;
  isAdmin?: boolean;
  nextMediaUrl?: string | null;
  priority?: boolean;
  onToggleLike: (postId: string) => void;
  onToggleSave: (postId: string) => void;
  onOpenComments: (postId: string) => void;
  onShare: (post: Post) => void;
  onSelectCreator?: (creatorId: string) => void;
  onPostDeleted: (postId: string) => void;
  onPostVisibilityToggled?: (postId: string, shouldHide: boolean) => void;
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  isMuted,
  isLiked,
  likesCount,
  isSaved,
  commentsCount,
  currentUserId,
  isAdmin = false,
  nextMediaUrl,
  priority = false,
  onToggleLike,
  onToggleSave,
  onOpenComments,
  onShare,
  onSelectCreator,
  onPostDeleted,
  onPostVisibilityToggled,
}) => {
  const { success, error: toastError } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Proximity-based lazy video loading & image cache tracking
  const [isNearViewport, setIsNearViewport] = useState<boolean>(priority);
  const [isMediaLoaded, setIsMediaLoaded] = useState<boolean>(() => {
    if (post.media_url && post.media_type !== 'video') {
      return MediaCache.isLoaded(post.media_url);
    }
    return false;
  });

  const isOwner = Boolean(currentUserId && post.user_id === currentUserId);
  const creator = post.profiles;
  const creatorName = creator?.display_name || creator?.username || 'Creator';
  const creatorHandle = creator?.username || 'user';

  // Proximity observer: mount video and preload next post media when within 450px of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (priority) {
      setIsNearViewport(true);
      if (nextMediaUrl) {
        MediaCache.preloadImage(nextMediaUrl);
      }
      return;
    }

    const proximityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsNearViewport(true);
            if (nextMediaUrl) {
              MediaCache.preloadImage(nextMediaUrl);
            }
          }
        });
      },
      { rootMargin: '450px 0px', threshold: 0 }
    );

    proximityObserver.observe(container);
    return () => proximityObserver.disconnect();
  }, [priority, nextMediaUrl]);

  // Synchronize dynamic sound toggling immediately
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Smooth video playback control via IntersectionObserver
  // Pauses video when scrolled off-screen; only plays when visible in viewport
  useEffect(() => {
    if (post.media_type !== 'video' || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = videoRef.current;
          if (!video) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            video
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                // Autoplay blocked by browser policy until user gesture
                setIsPlaying(false);
              });
            if (nextMediaUrl) {
              MediaCache.preloadImage(nextMediaUrl);
            }
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: [0, 0.5, 0.8],
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [post.media_type, nextMediaUrl]);

  // Handle tap on video to play/pause
  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Handle post deletion (owner or admin)
  const handleConfirmDelete = async () => {
    if (!currentUserId) {
      toastError('You must be logged in to delete posts.');
      return;
    }

    setIsDeleting(true);

    try {
      if (isOwner) {
        // Owner deletion via secure RLS
        const res = await deletePost(post.id, currentUserId);
        if (res.success) {
          success('Your Spark was deleted successfully.');
          setShowDeleteConfirm(false);
          onPostDeleted(post.id);
        } else {
          toastError(res.error || 'Failed to delete post.');
        }
      } else if (isAdmin) {
        // Admin moderation deletion with audit log
        const res = await adminDeletePost(currentUserId, post.id);
        if (res.success) {
          success('Post deleted by Administrator.');
          setShowDeleteConfirm(false);
          onPostDeleted(post.id);
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

  // Handle admin hide/restore
  const handleToggleHide = async () => {
    if (!currentUserId || !isAdmin) return;
    const shouldHide = !post.is_hidden;
    const res = await adminTogglePostVisibility(currentUserId, post.id, shouldHide);
    if (res.success) {
      success(shouldHide ? 'Post hidden from public feed.' : 'Post restored to public feed.');
      setShowMenu(false);
      onPostVisibilityToggled?.(post.id, shouldHide);
    } else {
      toastError(res.error || 'Failed to update post visibility.');
    }
  };

  return (
    <article
      ref={containerRef}
      className={`feed-post-card glass-card ${post.is_hidden ? 'feed-post-hidden' : ''}`}
    >
      {/* Media Viewport */}
      <div className="feed-post-media-box">
        {post.media_url ? (
          post.media_type === 'video' ? (
            <div className="feed-video-wrapper" onClick={handleTogglePlay}>
              {/* Lightweight Preview Shimmer while video metadata is buffering */}
              {!isMediaLoaded && (
                <div className="media-loading-placeholder">
                  <div className="shimmer-sweep" />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Star size={32} className="text-gold animate-pulse" />
                    <span className="text-xs text-muted font-medium">Loading Spark video...</span>
                  </div>
                </div>
              )}

              {/* Only attach video stream when within proximity to prevent mobile decoder stalls */}
              {isNearViewport ? (
                <video
                  ref={videoRef}
                  src={post.media_url}
                  muted={isMuted}
                  loop
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setIsMediaLoaded(true)}
                  onCanPlay={() => setIsMediaLoaded(true)}
                  className={`feed-media-player media-fade-in ${isMediaLoaded ? 'media-ready' : ''}`}
                />
              ) : (
                <div className="feed-media-player-placeholder" />
              )}

              {/* Tap to Play / Paused Indicator Overlay */}
              {!isPlaying && isMediaLoaded && (
                <div className="video-paused-indicator">
                  <Play size={28} className="text-white fill-white" />
                </div>
              )}
            </div>
          ) : (
            <div className="feed-image-wrapper">
              {/* Lightweight Preview Shimmer while photo is loading */}
              {!isMediaLoaded && (
                <div className="media-loading-placeholder">
                  <div className="shimmer-sweep" />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Star size={32} className="text-gold animate-pulse" />
                    <span className="text-xs text-muted font-medium">Loading Spark photo...</span>
                  </div>
                </div>
              )}

              <img
                src={post.media_url}
                alt={post.caption || 'Spark'}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
                onLoad={() => {
                  MediaCache.markLoaded(post.media_url);
                  setIsMediaLoaded(true);
                }}
                className={`feed-media-img media-fade-in ${isMediaLoaded ? 'media-ready' : ''}`}
              />
            </div>
          )
        ) : (
          <div className="feed-text-spark-canvas">
            <Star size={36} className="text-gold mb-3" />
            <p className="feed-text-spark-caption">{post.caption}</p>
          </div>
        )}

        {/* Top-Right More Actions (Delete & Moderation) */}
        {(isOwner || isAdmin) && (
          <div className="feed-card-top-bar">
            <div className="relative">
              <button
                type="button"
                className="feed-three-dot-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                aria-label="Post options"
                title="Post options"
              >
                <MoreVertical size={18} />
              </button>

              {/* Three-Dot Dropdown Menu */}
              {showMenu && (
                <div
                  className="feed-post-dropdown glass-card animate-scale-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOwner && (
                    <button
                      type="button"
                      className="dropdown-menu-item danger"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 size={15} />
                      <span>Delete post</span>
                    </button>
                  )}

                  {isAdmin && !isOwner && (
                    <>
                      <button
                        type="button"
                        className="dropdown-menu-item"
                        onClick={handleToggleHide}
                      >
                        <EyeOff size={15} />
                        <span>{post.is_hidden ? 'Restore post' : 'Hide from Feed'}</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-menu-item danger"
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete post (Admin)</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => setShowMenu(false)}
                  >
                    <X size={15} />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Side Actions (Like, Comment, Save, Share) */}
        <div className="feed-side-actions">
          <div
            className="side-action-avatar"
            onClick={() => creator && onSelectCreator?.(creator.id)}
            title={`View @${creatorHandle}`}
          >
            {creator?.avatar_url ? (
              <img src={creator.avatar_url} alt={creatorHandle} loading="lazy" />
            ) : (
              <div className="avatar-placeholder-sm">
                {creatorName[0].toUpperCase()}
              </div>
            )}
            <VerifiedAdminBadge
              userId={creator?.id}
              size="xs"
              showTooltip={false}
              className="avatar-admin-badge-overlay"
            />
          </div>

          <button
            className={`side-action-btn ${isLiked ? 'liked' : ''}`}
            onClick={() => onToggleLike(post.id)}
            aria-label="Like Spark"
            title={isLiked ? 'Unlike Spark' : 'Like Spark'}
          >
            <Heart
              size={24}
              fill={isLiked ? '#F59E0B' : 'none'}
              color={isLiked ? '#F59E0B' : 'currentColor'}
            />
            <span className="side-action-label">{likesCount}</span>
          </button>

          <button
            className="side-action-btn"
            onClick={() => onOpenComments(post.id)}
            aria-label="Comments"
            title="View & Add Comments"
          >
            <MessageCircle size={24} />
            <span className="side-action-label">{commentsCount}</span>
          </button>

          <button
            className={`side-action-btn ${isSaved ? 'saved' : ''}`}
            onClick={() => onToggleSave(post.id)}
            aria-label="Save Spark"
            title={isSaved ? 'Remove from Saved' : 'Save Spark'}
          >
            <Bookmark
              size={24}
              fill={isSaved ? '#F59E0B' : 'none'}
              color={isSaved ? '#F59E0B' : 'currentColor'}
            />
            <span className="side-action-label">{isSaved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            className="side-action-btn"
            onClick={() => onShare(post)}
            aria-label="Share"
            title="Share Spark"
          >
            <Share2 size={24} />
            <span className="side-action-label">Share</span>
          </button>
        </div>

        {/* Bottom Creator & Caption Info Overlay */}
        <div className="feed-bottom-info">
          <div
            className="feed-creator-badge"
            onClick={() => creator && onSelectCreator?.(creator.id)}
          >
            <div className="creator-badge-row">
              <span className="creator-display font-bold">@{creatorHandle}</span>
              <VerifiedAdminBadge userId={creator?.id} size="sm" showTooltip={true} />
              {creator?.display_name && (
                <span className="creator-sub font-semibold text-xs text-muted">
                  · {creator.display_name}
                </span>
              )}
              {post.is_hidden && isAdmin && (
                <span className="admin-hidden-badge" title="Hidden from public feed">
                  <EyeOff size={11} /> Moderated
                </span>
              )}
            </div>
          </div>
          {post.caption && (
            <p className="feed-post-caption">{post.caption}</p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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
                : 'As an administrator, permanently remove this post for violating community standards. This action is recorded in the audit log.'}
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
    </article>
  );
};
