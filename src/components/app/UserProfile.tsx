import React, { useState, useEffect, useCallback } from 'react';
import {
  Edit3,
  Share2,
  LogOut,
  Grid,
  Heart,
  Bookmark,
  Calendar,
  Sun,
  Moon,
  Star,
  UserPlus,
  UserCheck,
  ArrowLeft,
  Loader2,
  Film,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAdmin } from '../../context/AdminContext';
import { EditProfileModal } from './EditProfileModal';
import { SupabaseConfigModal } from '../common/SupabaseConfigModal';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import {
  fetchProfile,
  fetchFollowStats,
  checkIsFollowing,
  followUser,
  unfollowUser,
  fetchUserPosts,
  fetchUserSavedPosts,
  adminToggleUserSuspension,
} from '../../lib/supabase';
import { PostViewerModal } from './PostViewerModal';
import { MediaCache } from '../../lib/mediaCache';
import type { Profile, Post } from '../../types/database';

const ProfileGridItem: React.FC<{ post: Post; onClick: () => void }> = ({ post, onClick }) => {
  const mediaSrc = post.media_url || post.image_url;
  const [isLoaded, setIsLoaded] = useState<boolean>(() => {
    if (mediaSrc && post.media_type !== 'video') {
      return MediaCache.isLoaded(mediaSrc);
    }
    return false;
  });

  return (
    <div className="post-grid-card glass-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      {mediaSrc ? (
        <div className="post-grid-thumb-wrapper">
          {!isLoaded && (
            <div className="media-loading-placeholder grid-thumb-placeholder">
              <div className="shimmer-sweep" />
              <Star size={18} className="text-gold animate-pulse" />
            </div>
          )}
          {post.media_type === 'video' ? (
            <div className="post-video-thumb">
              <video
                src={`${mediaSrc}#t=0.001`}
                preload="metadata"
                onLoadedData={() => setIsLoaded(true)}
                className={`post-video-player media-fade-in ${isLoaded ? 'media-ready' : ''}`}
              />
              <div className="play-badge">
                <Film size={14} />
              </div>
            </div>
          ) : (
            <img
              src={mediaSrc}
              alt={post.caption || 'Post media'}
              loading="lazy"
              decoding="async"
              className={`post-img-thumb media-fade-in ${isLoaded ? 'media-ready' : ''}`}
              onLoad={() => {
                MediaCache.markLoaded(mediaSrc);
                setIsLoaded(true);
              }}
            />
          )}
        </div>
      ) : (
        <div className="post-text-only">
          <p className="post-caption-snippet">{post.caption}</p>
        </div>
      )}
      {post.caption && <p className="post-caption-bar truncate">{post.caption}</p>}
    </div>
  );
};

interface UserProfileProps {
  targetUserId?: string;
  onBack?: () => void;
  onOpenCreate?: () => void;
  onMessageUser?: (userId: string) => void;
  onOpenAdmin?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  targetUserId,
  onBack,
  onOpenCreate,
  onMessageUser,
  onOpenAdmin,
}) => {
  const { user, profile: authProfile, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme, toggleTheme } = useTheme();
  const { success, error } = useToast();
  const toastError = error;

  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  const [viewedProfile, setViewedProfile] = useState<Profile | null>(isOwnProfile ? authProfile : null);
  const [stats, setStats] = useState<{ followers: number; following: number; posts: number }>({
    followers: 0,
    following: 0,
    posts: 0,
  });
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(!isOwnProfile);
  const [isFollowActionLoading, setIsFollowActionLoading] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'liked' | 'saved'>('posts');
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [showSuspendModal, setShowSuspendModal] = useState<boolean>(false);
  const [suspensionReason, setSuspensionReason] = useState<string>('');
  const [isProcessingSuspension, setIsProcessingSuspension] = useState<boolean>(false);

  const handleToggleSuspension = async () => {
    if (!user || !viewedProfile || !isAdmin) return;
    setIsProcessingSuspension(true);
    const shouldSuspend = !viewedProfile.is_suspended;
    const res = await adminToggleUserSuspension(
      user.id,
      viewedProfile.id,
      shouldSuspend,
      suspensionReason
    );
    setIsProcessingSuspension(false);
    if (res.success) {
      success(shouldSuspend ? `@${viewedProfile.username} has been suspended.` : `@${viewedProfile.username} account restored.`);
      setViewedProfile((prev) => prev ? { ...prev, is_suspended: shouldSuspend, suspension_reason: shouldSuspend ? suspensionReason : undefined } : null);
      setShowSuspendModal(false);
      setSuspensionReason('');
    } else {
      toastError(res.error || 'Failed to update user suspension.');
    }
  };

  const loadData = useCallback(async () => {
    const activeId = isOwnProfile ? user?.id : targetUserId;
    if (!activeId) return;

    setIsLoadingProfile(true);

    try {
      // 1. Fetch profile
      let p: Profile | null = null;
      if (isOwnProfile) {
        p = authProfile;
        if (!p && user?.id) {
          p = await fetchProfile(user.id);
        }
      } else {
        p = await fetchProfile(activeId);
      }
      setViewedProfile(p);

      // 2. Fetch follow & post stats from real database
      const [followStats, posts, saved] = await Promise.all([
        fetchFollowStats(activeId),
        fetchUserPosts(activeId),
        isOwnProfile ? fetchUserSavedPosts(activeId) : Promise.resolve([]),
      ]);

      setStats({
        followers: followStats.followers,
        following: followStats.following,
        posts: posts.length || followStats.posts,
      });
      setUserPosts(posts);
      setSavedPosts(saved);

      // 3. If viewing someone else, check if current user follows them
      if (!isOwnProfile && user?.id) {
        const following = await checkIsFollowing(user.id, activeId);
        setIsFollowing(following);
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  }, [isOwnProfile, targetUserId, user?.id, authProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep view in sync when authProfile updates
  useEffect(() => {
    if (isOwnProfile && authProfile) {
      setViewedProfile(authProfile);
    }
  }, [isOwnProfile, authProfile]);

  const handleFollowToggle = async () => {
    if (!user) {
      error('Please log in to follow creators.');
      return;
    }
    if (!targetUserId || targetUserId === user.id) return;

    setIsFollowActionLoading(true);

    if (isFollowing) {
      const res = await unfollowUser(user.id, targetUserId);
      if (res.success) {
        setIsFollowing(false);
        setStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
        success(`Unfollowed @${viewedProfile?.username || 'user'}`);
      } else {
        error(res.error || 'Failed to unfollow.');
      }
    } else {
      const res = await followUser(user.id, targetUserId);
      if (res.success) {
        setIsFollowing(true);
        setStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
        success(`Now following @${viewedProfile?.username || 'user'}!`);
      } else {
        error(res.error || 'Failed to follow.');
      }
    }

    setIsFollowActionLoading(false);
  };

  const handleShare = async () => {
    const handle = viewedProfile?.username || 'user';
    const url = `${window.location.origin}/@${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      success(`Profile link copied: @${handle}`);
    } catch {
      success(`Profile handle: @${handle}`);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to log out of Brighter?')) {
      setIsSigningOut(true);
      await signOut();
      setIsSigningOut(false);
    }
  };

  const username = viewedProfile?.username || (isOwnProfile ? user?.user_metadata?.username : '') || 'creator';
  const displayName = viewedProfile?.display_name || (isOwnProfile ? user?.user_metadata?.display_name : '') || username;
  const avatarUrl = viewedProfile?.avatar_url;
  const bio = viewedProfile?.bio;
  const createdAt = viewedProfile?.created_at
    ? new Date(viewedProfile.created_at).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  if (isLoadingProfile) {
    return (
      <div className="user-profile-container flex-center justify-center py-12">
        <div className="text-center">
          <Loader2 size={32} className="spin text-gold mb-3" />
          <p className="text-secondary text-sm">Loading creator profile...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="user-profile-container">
        {/* Profile Top Controls */}
        <header className="profile-topbar">
          <div className="flex-center gap-2">
            {!isOwnProfile && onBack && (
              <button
                className="back-nav-btn mr-1"
                onClick={onBack}
                aria-label="Back to search"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <span className="profile-handle font-bold text-lg">@{username}</span>
              <VerifiedAdminBadge userId={viewedProfile?.id} size="sm" showTooltip={true} />
            </div>
          </div>

          <div className="profile-top-actions">
            <button
              className="theme-toggle-btn-small"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {isOwnProfile && (
              <button
                className="icon-button-small text-danger"
                onClick={handleSignOut}
                disabled={isSigningOut}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>

        {/* Profile Header & Bio */}
        <div className="profile-header-card glass-card">
          <div className="profile-avatar-wrapper">
            <div className="avatar-frame">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="profile-avatar-img" />
              ) : (
                <div className="avatar-placeholder-large">
                  {(displayName || username || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="avatar-star-badge" title="Verified Creator Profile">
              <Star size={14} className="text-gold" />
            </div>
          </div>

          <div className="profile-name-badge-row flex items-center justify-center gap-2">
            <h2 className="profile-name">{displayName}</h2>
            <VerifiedAdminBadge userId={viewedProfile?.id} size="md" showTooltip={true} />
          </div>
          <span className="profile-subhandle">@{username}</span>

          {/* Real Supabase Profile Stats */}
          <div className="profile-stats-bar">
            <div className="stat-item">
              <span className="stat-number">{stats.posts}</span>
              <span className="stat-label">Sparks</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">{stats.followers}</span>
              <span className="stat-label">Followers</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">{stats.following}</span>
              <span className="stat-label">Following</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-number">0</span>
              <span className="stat-label">Likes</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="profile-cta-wrapper w-full">
            {isOwnProfile ? (
              <div className="profile-cta-column flex flex-col gap-2 w-full">
                <div className="profile-cta-row">
                  <button
                    className="btn btn-primary btn-sm flex-1"
                    onClick={() => setIsEditOpen(true)}
                  >
                    <Edit3 size={15} /> Edit Profile
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleShare}
                    title="Share profile link"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {isAdmin && (
                  <button
                    className="btn btn-gold btn-sm w-full admin-profile-action-btn flex items-center justify-center gap-2"
                    onClick={onOpenAdmin}
                  >
                    <ShieldCheck size={16} />
                    <span>Admin Control Dashboard</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="profile-cta-row">
                  <button
                    className={`btn btn-sm flex-1 ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleFollowToggle}
                    disabled={isFollowActionLoading}
                  >
                    {isFollowActionLoading ? (
                      <Loader2 size={15} className="spin" />
                    ) : isFollowing ? (
                      <>
                        <UserCheck size={15} /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={15} /> Follow
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm flex-1"
                    onClick={() => {
                      const recipientId = targetUserId || viewedProfile?.id;
                      if (recipientId) onMessageUser?.(recipientId);
                    }}
                    title="Send Direct Message"
                  >
                    <MessageSquare size={15} /> Message
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleShare}
                    title="Share profile link"
                  >
                    <Share2 size={15} />
                  </button>
                </div>

                {isAdmin && (
                  <div className="admin-moderation-badge-box glass-panel p-2.5 rounded-xl border border-gold/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-gold flex items-center gap-1.5">
                        <ShieldCheck size={13} /> Admin Moderation
                      </span>
                      {viewedProfile?.is_suspended ? (
                        <span className="badge badge-danger text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                          Account Suspended
                        </span>
                      ) : (
                        <span className="badge badge-success text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          Active Account
                        </span>
                      )}
                    </div>
                    {viewedProfile?.is_suspended && viewedProfile.suspension_reason && (
                      <p className="text-xs text-secondary mb-2 italic">
                        Reason: {viewedProfile.suspension_reason}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`btn btn-xs flex-1 ${viewedProfile?.is_suspended ? 'btn-outline-gold' : 'btn-danger'}`}
                        onClick={() => setShowSuspendModal(true)}
                      >
                        {viewedProfile?.is_suspended ? 'Restore Account Access' : 'Suspend Account'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-secondary"
                        onClick={onOpenAdmin}
                        title="Open Moderation Dashboard"
                      >
                        Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bio Box */}
          <div className="profile-bio-box">
            {bio ? (
              <p className="profile-bio-text">{bio}</p>
            ) : isOwnProfile ? (
              <p className="profile-bio-empty" onClick={() => setIsEditOpen(true)}>
                + Add a bio to tell your story
              </p>
            ) : (
              <p className="profile-bio-text text-muted">No bio yet.</p>
            )}
            <div className="profile-meta-row">
              <span className="meta-pill">
                <Calendar size={12} /> Joined {createdAt}
              </span>
            </div>
          </div>
        </div>

        {/* Content Tabs (Sparks, Liked, Saved) */}
        <div className="profile-tabs-nav">
          <button
            className={`profile-tab-item ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <Grid size={18} />
            <span>Sparks ({stats.posts})</span>
          </button>
          <button
            className={`profile-tab-item ${activeTab === 'liked' ? 'active' : ''}`}
            onClick={() => setActiveTab('liked')}
          >
            <Heart size={18} />
            <span>Liked</span>
          </button>
          {isOwnProfile && (
            <button
              className={`profile-tab-item ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <Bookmark size={18} />
              <span>Saved</span>
            </button>
          )}
        </div>

        {/* Tab Content Canvas */}
        <div className="profile-tab-content">
          {activeTab === 'posts' && (
            <>
              {userPosts.length > 0 ? (
                <div className="user-posts-grid">
                  {userPosts.map((post) => (
                    <ProfileGridItem
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPostId(post.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="state-card-empty glass-card text-center py-7">
                  <div className="star-ambient-pulse mb-2">
                    <Grid size={32} className="text-muted" />
                  </div>
                  <h4 className="text-primary font-bold">No sparks published</h4>
                  <p className="text-secondary text-sm mt-1 max-w-xs mx-auto">
                    {isOwnProfile
                      ? 'Sparks you create and post will be displayed here in your personal grid.'
                      : `@${username} has not posted any sparks yet.`}
                  </p>
                  {isOwnProfile && onOpenCreate && (
                    <button className="btn btn-outline-gold btn-sm mt-3" onClick={onOpenCreate}>
                      Create a Spark
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'liked' && (
            <div className="state-card-empty glass-card text-center py-7">
              <div className="star-ambient-pulse mb-2">
                <Heart size={32} className="text-muted" />
              </div>
              <h4 className="text-primary font-bold">No liked sparks</h4>
              <p className="text-secondary text-sm mt-1 max-w-xs mx-auto">
                Videos you like while browsing your feed will be privately bookmarked here.
              </p>
            </div>
          )}

          {activeTab === 'saved' && (
            <>
              {savedPosts.length > 0 ? (
                <div className="user-posts-grid">
                  {savedPosts.map((post) => (
                    <ProfileGridItem
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPostId(post.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="state-card-empty glass-card text-center py-7">
                  <div className="star-ambient-pulse mb-2">
                    <Bookmark size={32} className="text-muted" />
                  </div>
                  <h4 className="text-primary font-bold">No saved Sparks</h4>
                  <p className="text-secondary text-sm mt-1 max-w-xs mx-auto">
                    Bookmark sparks while exploring your feed to easily revisit them here.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {isOwnProfile && (
        <EditProfileModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            loadData();
          }}
        />
      )}

      <SupabaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      {/* Post Viewer Modal */}
      <PostViewerModal
        postId={selectedPostId}
        onClose={() => {
          setSelectedPostId(null);
          loadData();
        }}
        onPostDeleted={(deletedId) => {
          setUserPosts((prev) => prev.filter((p) => p.id !== deletedId));
          setSavedPosts((prev) => prev.filter((p) => p.id !== deletedId));
          setStats((prev) => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
        }}
      />

      {/* Admin Suspend/Restore Modal */}
      {showSuspendModal && viewedProfile && (
        <div
          className="feed-confirm-overlay"
          onClick={() => !isProcessingSuspension && setShowSuspendModal(false)}
        >
          <div
            className="feed-confirm-dialog glass-card animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`confirm-icon-box ${viewedProfile.is_suspended ? 'success' : 'danger'}`}>
              <ShieldCheck size={26} />
            </div>
            <h3 className="confirm-title">
              {viewedProfile.is_suspended
                ? `Restore @${viewedProfile.username}?`
                : `Suspend @${viewedProfile.username}?`}
            </h3>
            <p className="confirm-message">
              {viewedProfile.is_suspended
                ? `Restoring will re-enable public visibility and platform activity for @${viewedProfile.username}.`
                : `Suspending will immediately restrict @${viewedProfile.username} from posting or interacting. Database records remain safely preserved without deleting foreign keys.`}
            </p>

            {!viewedProfile.is_suspended && (
              <div className="w-full mt-2 mb-3">
                <label className="text-xs text-muted block mb-1">
                  Reason for Suspension (recorded in audit log):
                </label>
                <input
                  type="text"
                  className="chat-input-field w-full text-xs"
                  placeholder="e.g., Inappropriate content, terms violation, spam"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  disabled={isProcessingSuspension}
                />
              </div>
            )}

            <div className="confirm-actions-row">
              <button
                type="button"
                className="btn btn-secondary btn-sm flex-1"
                onClick={() => setShowSuspendModal(false)}
                disabled={isProcessingSuspension}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm flex-1 ${viewedProfile.is_suspended ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleToggleSuspension}
                disabled={isProcessingSuspension}
              >
                {isProcessingSuspension ? (
                  <>
                    <Loader2 size={15} className="spin" /> Updating...
                  </>
                ) : viewedProfile.is_suspended ? (
                  'Confirm Restore'
                ) : (
                  'Confirm Suspension'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
