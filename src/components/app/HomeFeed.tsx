import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Compass,
  Volume2,
  VolumeX,
  Loader2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { BrighterLogo } from '../common/BrighterLogo';
import {
  getSupabase,
  isSupabaseReady,
  fetchPostLikesCount,
  togglePostLike,
  fetchCommentCount,
  savePost,
  unsavePost,
  fetchAnnouncements,
} from '../../lib/supabase';
import { FeedPostCard } from './FeedPostCard';
import { CommentsModal } from './CommentsModal';
import { getCachedFeed, setCachedFeed, MediaCache } from '../../lib/mediaCache';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useToast } from '../../context/ToastContext';
import type { Post, Announcement } from '../../types/database';

interface HomeFeedProps {
  onOpenCreate: () => void;
  onGoToSearch: () => void;
  onSelectCreator?: (creatorId: string) => void;
}

const PAGE_SIZE = 10;

export const HomeFeed: React.FC<HomeFeedProps> = ({
  onOpenCreate,
  onGoToSearch,
  onSelectCreator,
}) => {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { success, error: toastError } = useToast();
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');
  const [isMuted, setIsMuted] = useState(true);

  // Fast initial feed render from memory cache
  const [posts, setPosts] = useState<Post[]>(() => getCachedFeed('foryou') || []);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = getCachedFeed('foryou');
    return !cached || cached.length === 0;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Live interaction state
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likesCounts, setLikesCounts] = useState<Record<string, number>>({});
  const [commentsCounts, setCommentsCounts] = useState<Record<string, number>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);

  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Fast batch reaction loader to prevent network floods
  const loadPostInteractions = useCallback(
    async (items: Post[]) => {
      if (!items.length) return;
      const client = getSupabase();
      const postIds = items.map((p) => p.id);

      const lCounts: Record<string, number> = {};
      const cCounts: Record<string, number> = {};
      const lMap: Record<string, boolean> = {};
      const sMap: Record<string, boolean> = {};

      // 1. Batch user-specific likes & bookmarks in 2 targeted queries
      if (user) {
        try {
          const [{ data: userLikes }, { data: userSaves }] = await Promise.all([
            client.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
            client.from('saved_posts').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          ]);

          userLikes?.forEach((l: any) => {
            lMap[l.post_id] = true;
          });
          userSaves?.forEach((s: any) => {
            sMap[s.post_id] = true;
          });
        } catch (err) {
          console.warn('Error fetching batch user reactions:', err);
        }
      }

      // 2. Fetch counts in parallel without blocking user gestures
      await Promise.all(
        items.map(async (p) => {
          try {
            const [lCount, cCount] = await Promise.all([
              fetchPostLikesCount(p.id),
              fetchCommentCount(p.id),
            ]);
            lCounts[p.id] = lCount;
            cCounts[p.id] = cCount;
          } catch {}
        })
      );

      setLikesCounts((prev) => ({ ...prev, ...lCounts }));
      setCommentsCounts((prev) => ({ ...prev, ...cCounts }));
      setLikedPosts((prev) => ({ ...prev, ...lMap }));
      setSavedPosts((prev) => ({ ...prev, ...sMap }));
    },
    [user]
  );

  // Initial feed loader with stale-while-revalidate and instant cached display
  const loadFeedPosts = useCallback(
    async (isRefresh = false) => {
      if (!isSupabaseReady()) return;
      const cached = getCachedFeed(activeTab);
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (!cached || cached.length === 0) {
        setIsLoading(true);
      }

      try {
        const client = getSupabase();
        setPage(0);

        if (activeTab === 'following' && user) {
          // Fetch posts only from users the current user follows
          const { data: followings } = await client
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);

          const followingIds = followings?.map((f) => f.following_id) || [];

          if (followingIds.length === 0) {
            setPosts([]);
            setCachedFeed('following', []);
            setHasMore(false);
            return;
          }

          const { data, error } = await client
            .from('posts')
            .select(`
              *,
              profiles:user_id (
                id,
                username,
                avatar_url
              )
            `)
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);

          if (!error && data) {
            const normalized = (data as any[]).map((p) => ({
              ...p,
              media_url: p.media_url || p.image_url || null,
            })) as Post[];
            setPosts(normalized);
            setCachedFeed('following', normalized);
            setHasMore(data.length === PAGE_SIZE);
            loadPostInteractions(normalized);
            if (normalized.length > 0 && normalized[0].media_url && normalized[0].media_type !== 'video') {
              MediaCache.preloadImage(normalized[0].media_url);
            }
          } else {
            setPosts([]);
            setHasMore(false);
          }
        } else {
          // 'For You' feed: All public posts (newest first)
          const { data, error } = await client
            .from('posts')
            .select(`
              *,
              profiles:user_id (
                id,
                username,
                avatar_url
              )
            `)
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);

          if (!error && data) {
            const normalized = (data as any[]).map((p) => ({
              ...p,
              media_url: p.media_url || p.image_url || null,
            })) as Post[];
            setPosts(normalized);
            setCachedFeed('foryou', normalized);
            setHasMore(data.length === PAGE_SIZE);
            loadPostInteractions(normalized);
            if (normalized.length > 0 && normalized[0].media_url && normalized[0].media_type !== 'video') {
              MediaCache.preloadImage(normalized[0].media_url);
            }
          } else {
            setPosts([]);
            setHasMore(false);
          }
        }
      } catch (err) {
        console.warn('Could not load feed posts:', err);
        setPosts([]);
        setHasMore(false);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, user, loadPostInteractions]
  );

  // Load more posts (Pagination)
  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !isSupabaseReady()) return;
    setIsLoadingMore(true);

    try {
      const client = getSupabase();
      const nextPage = page + 1;
      const start = nextPage * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      let query = client
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (activeTab === 'following' && user) {
        const { data: followings } = await client
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        const followingIds = followings?.map((f) => f.following_id) || [];
        if (followingIds.length === 0) {
          setHasMore(false);
          setIsLoadingMore(false);
          return;
        }
        query = query.in('user_id', followingIds);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const normalized = (data as any[]).map((p) => ({
          ...p,
          media_url: p.media_url || p.image_url || null,
        })) as Post[];

        setPosts((prev) => {
          // Prevent duplicates
          const existingIds = new Set(prev.map((p) => p.id));
          const fresh = normalized.filter((p) => !existingIds.has(p.id));
          return [...prev, ...fresh];
        });

        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
        loadPostInteractions(normalized);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Error loading more feed posts:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadAnnouncements = useCallback(async () => {
    try {
      const list = await fetchAnnouncements(true);
      setAnnouncements(list);
    } catch {
      setAnnouncements([]);
    }
  }, []);

  useEffect(() => {
    loadFeedPosts();
    loadAnnouncements();
  }, [loadFeedPosts, loadAnnouncements]);

  // Infinite scroll trigger via Sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, page]);

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      toastError('Please log in to like Sparks.');
      return;
    }
    const prevLiked = Boolean(likedPosts[postId]);
    const prevCount = likesCounts[postId] || 0;

    // Optimistic update
    setLikedPosts((prev) => ({ ...prev, [postId]: !prevLiked }));
    setLikesCounts((prev) => ({
      ...prev,
      [postId]: prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1,
    }));

    const { isLiked, error } = await togglePostLike(postId, user.id, prevLiked);
    if (error) {
      // Revert on error
      setLikedPosts((prev) => ({ ...prev, [postId]: prevLiked }));
      setLikesCounts((prev) => ({ ...prev, [postId]: prevCount }));
      toastError(error);
    } else {
      setLikedPosts((prev) => ({ ...prev, [postId]: isLiked }));
      if (isLiked) success('Spark liked! ✨');
    }
  };

  const handleToggleSave = async (postId: string) => {
    if (!user) {
      toastError('Please log in to bookmark Sparks.');
      return;
    }
    const isCurrentlySaved = Boolean(savedPosts[postId]);
    const nextSaved = !isCurrentlySaved;

    setSavedPosts((prev) => ({ ...prev, [postId]: nextSaved }));

    if (nextSaved) {
      const { error } = await savePost(postId, user.id);
      if (error) {
        setSavedPosts((prev) => ({ ...prev, [postId]: false }));
        toastError(error);
      } else {
        success('Saved to your profile! 🔖');
      }
    } else {
      const { error } = await unsavePost(postId, user.id);
      if (error) {
        setSavedPosts((prev) => ({ ...prev, [postId]: true }));
        toastError(error);
      } else {
        success('Removed from saved.');
      }
    }
  };

  const handleSharePost = async (post: Post) => {
    const creator = post.profiles?.username || 'spark';
    const url = `${window.location.origin}/?post=${post.id}`;
    const shareData = {
      title: `Spark on Brighter by @${creator}`,
      text: post.caption || 'Check out this Spark on Brighter ✨',
      url,
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
      await navigator.clipboard.writeText(url);
      success(`Copied Spark link by @${creator}! ✨`);
    } catch {
      toastError('Could not copy link to clipboard.');
    }
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handlePostVisibilityToggled = (postId: string, shouldHide: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_hidden: shouldHide } : p))
    );
  };

  const visiblePosts = posts.filter((p) => !p.is_hidden || isAdmin);

  return (
    <div className="home-feed-container">
      {/* Feed Top Header */}
      <header className="feed-header">
        <div className="feed-header-left">
          <BrighterLogo size="sm" showText={false} withGlow={true} />
        </div>

        <nav className="feed-tab-switcher" aria-label="Feed selection">
          <button
            className={`feed-tab-btn ${activeTab === 'following' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'following') {
                const cached = getCachedFeed('following');
                if (cached && cached.length > 0) {
                  setPosts(cached);
                }
                setActiveTab('following');
              }
            }}
          >
            Following
          </button>
          <span className="feed-tab-divider">|</span>
          <button
            className={`feed-tab-btn ${activeTab === 'foryou' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'foryou') {
                const cached = getCachedFeed('foryou');
                if (cached && cached.length > 0) {
                  setPosts(cached);
                }
                setActiveTab('foryou');
              }
            }}
          >
            For You
          </button>
        </nav>

        <div className="feed-header-right flex items-center gap-2">
          <button
            className={`feed-audio-toggle ${isRefreshing ? 'spin' : ''}`}
            onClick={() => loadFeedPosts(true)}
            aria-label="Refresh Feed"
            title="Refresh Sparks"
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="feed-audio-toggle"
            onClick={() => setIsMuted(!isMuted)}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Sound muted' : 'Sound active'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </header>

      {/* Main Feed Canvas */}
      <main className="feed-main-viewport">
        {/* Official Admin Announcements Banner/Cards */}
        {announcements.length > 0 && (
          <div className="feed-announcements-container">
            {announcements.map((ann) => (
              <div key={ann.id} className="feed-official-announcement-card glass-card">
                <div className="announcement-header">
                  <div className="announcement-badge-row">
                    <span className="announcement-official-tag">
                      <ShieldCheck size={14} className="text-gold" />
                      <span>Official Brighter Announcement</span>
                    </span>
                    <span className="announcement-date">
                      {new Date(ann.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="announcement-title">{ann.title}</h3>
                </div>
                <p className="announcement-message">{ann.body || ann.message}</p>
                {ann.link_url && (
                  <a
                    href={ann.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="announcement-link"
                  >
                    <span>Learn more</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 size={36} className="spin text-gold mb-3 mx-auto" />
            <p className="text-secondary text-sm">Illuminating Sparks...</p>
          </div>
        ) : visiblePosts.length > 0 ? (
          <div className="feed-posts-stream">
            {visiblePosts.map((post, idx) => (
              <FeedPostCard
                key={post.id}
                post={post}
                priority={idx === 0}
                nextMediaUrl={
                  idx < visiblePosts.length - 1
                    ? visiblePosts[idx + 1].media_url || visiblePosts[idx + 1].image_url
                    : null
                }
                isMuted={isMuted}
                isLiked={Boolean(likedPosts[post.id])}
                likesCount={likesCounts[post.id] || 0}
                isSaved={Boolean(savedPosts[post.id])}
                commentsCount={commentsCounts[post.id] || 0}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onToggleLike={handleToggleLike}
                onToggleSave={handleToggleSave}
                onOpenComments={(id) => setActiveCommentsPostId(id)}
                onShare={handleSharePost}
                onSelectCreator={onSelectCreator}
                onPostDeleted={handlePostDeleted}
                onPostVisibilityToggled={handlePostVisibilityToggled}
              />
            ))}

            {/* Bottom Sentinel for Smooth Incremental Loading */}
            <div ref={bottomSentinelRef} className="feed-load-more-indicator">
              {isLoadingMore ? (
                <div className="flex items-center justify-center gap-2 py-4 text-muted text-sm">
                  <Loader2 size={16} className="spin text-gold" />
                  <span>Loading more Sparks...</span>
                </div>
              ) : hasMore ? (
                <div className="py-2" />
              ) : (
                <div className="text-center py-6 text-muted text-xs">
                  <span>✦ You've reached the end of the stream ✦</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Stylish Empty Feed State when no posts exist */
          <div className="empty-feed-card glass-card">
            <div className="empty-feed-starlight-halo">
              <div className="starlight-orbit-ring" />
              <div className="empty-logo-orb">
                <BrighterLogo size="lg" showText={false} withGlow={true} />
              </div>
            </div>

            <h2 className="empty-feed-title">
              Your brighter world starts here
            </h2>

            <p className="empty-feed-subtitle">
              {activeTab === 'foryou'
                ? 'This is your authentic, ad-free canvas. Be the first creator to share a spark with the world, or explore inspiring creators.'
                : 'You are not following any creators yet. Discover rising stars and fill your stream with radiant moments.'}
            </p>

            <div className="empty-feed-actions">
              <button className="btn btn-primary btn-lg" onClick={onOpenCreate}>
                <Plus size={18} />
                <span>Spark Your First Video</span>
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onGoToSearch}>
                <Compass size={18} />
                <span>Discover Creators</span>
              </button>
            </div>

            <div className="empty-feed-tags">
              <span className="tag-pill">✨ 0% Fake Algorithms</span>
              <span className="tag-pill">🔒 Supabase Verified</span>
              <span className="tag-pill">⭐ TikTok-Style Sparks</span>
            </div>
          </div>
        )}
      </main>

      {/* Real Comments Drawer Modal */}
      {activeCommentsPostId && (
        <CommentsModal
          isOpen={Boolean(activeCommentsPostId)}
          onClose={() => setActiveCommentsPostId(null)}
          postId={activeCommentsPostId}
          onCommentAdded={() => {
            if (activeCommentsPostId) {
              setCommentsCounts((prev) => ({
                ...prev,
                [activeCommentsPostId]: (prev[activeCommentsPostId] || 0) + 1,
              }));
            }
          }}
          onCommentDeleted={() => {
            if (activeCommentsPostId) {
              setCommentsCounts((prev) => ({
                ...prev,
                [activeCommentsPostId]: Math.max(0, (prev[activeCommentsPostId] || 0) - 1),
              }));
            }
          }}
        />
      )}
    </div>
  );
};
