import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Profile,
  Post,
  Comment,
  Conversation,
  Message,
  AdminReport,
  Announcement,
  AdminAuditLog,
  AdminOverviewStats,
} from '../types/database';

// Storage keys for runtime configuration fallback
const LS_SUPABASE_URL_KEY = 'brighter_supabase_url';
const LS_SUPABASE_ANON_KEY = 'brighter_supabase_anon_key';

export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const lsUrl = typeof window !== 'undefined' ? localStorage.getItem(LS_SUPABASE_URL_KEY) || '' : '';
  const lsAnonKey = typeof window !== 'undefined' ? localStorage.getItem(LS_SUPABASE_ANON_KEY) || '' : '';

  return {
    url: (envUrl || lsUrl).trim(),
    anonKey: (envAnonKey || lsAnonKey).trim(),
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(LS_SUPABASE_ANON_KEY, anonKey.trim());
    // Re-initialize client
    initSupabase(true);
  }
}

export function clearSupabaseCredentials() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LS_SUPABASE_URL_KEY);
    localStorage.removeItem(LS_SUPABASE_ANON_KEY);
    initSupabase(true);
  }
}

let supabaseInstance: SupabaseClient | null = null;
let activeUrl = '';
let activeKey = '';

export function initSupabase(force = false): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();

  if (!url || !anonKey || url === 'https://your-project-id.supabase.co' || anonKey === 'your-anon-public-key-here') {
    supabaseInstance = null;
    activeUrl = '';
    activeKey = '';
    return null;
  }

  if (supabaseInstance && !force && activeUrl === url && activeKey === anonKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    activeUrl = url;
    activeKey = anonKey;
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabaseInstance = null;
    return null;
  }
}

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    initSupabase();
  }
  if (!supabaseInstance) {
    throw new Error('Supabase is not configured. Please supply your Supabase URL and Anon Key.');
  }
  return supabaseInstance;
}

export function isSupabaseReady(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20 &&
    anonKey !== 'your-anon-public-key-here'
  );
}

// Database helper functions
export async function checkUsernameExists(username: string, excludeUserId?: string): Promise<boolean> {
  const client = getSupabase();
  const clean = username.trim().toLowerCase();

  let query = client
    .from('profiles')
    .select('id, username')
    .ilike('username', clean);

  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.warn('Error checking username:', error.message);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const client = getSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data as Profile | null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const client = getSupabase();
  const clean = username.trim().toLowerCase().replace('@', '');
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .ilike('username', clean)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile by username:', error);
    return null;
  }

  return data as Profile | null;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string; username: string }): Promise<{ data: Profile | null; error: any }> {
  const client = getSupabase();
  const cleanProfile: Record<string, any> = {
    id: profile.id,
    username: profile.username.trim().toLowerCase(),
  };

  if (profile.avatar_url !== undefined) {
    cleanProfile.avatar_url = profile.avatar_url;
  }
  if (profile.bio !== undefined) {
    cleanProfile.bio = profile.bio;
  }

  const { data, error } = await client
    .from('profiles')
    .upsert(cleanProfile)
    .select()
    .single();

  if (error) {
    console.error('[Brighter Diagnostic] upsertProfile error:', {
      code: error.code,
      message: error.message,
      hint: error.hint,
    });
  }

  return { data: data as Profile | null, error };
}

// Storage helpers
export async function uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error: any }> {
  const client = getSupabase();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await client.storage
    .from('avatars')
    .upload(filePath, file, {
      upsert: true,
      cacheControl: '3600',
    });

  if (!uploadError) {
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    return { url: data.publicUrl, error: null };
  }

  console.warn('[Brighter Diagnostic] "avatars" storage bucket note:', uploadError.message);

  // Fallback to Data URL if storage bucket is not created
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, error: null };
  } catch (e) {
    return { url: null, error: uploadError };
  }
}

export async function uploadPostMedia(userId: string, file: File): Promise<{ url: string | null; error: any }> {
  const client = getSupabase();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

  // 1. Try 'posts' bucket
  const { error: uploadError } = await client.storage
    .from('posts')
    .upload(filePath, file, {
      upsert: false,
      cacheControl: '3600',
    });

  if (!uploadError) {
    const { data } = client.storage.from('posts').getPublicUrl(filePath);
    console.info('[Brighter Diagnostic] Post media uploaded to "posts" bucket successfully.');
    return { url: data.publicUrl, error: null };
  }

  // 2. Try 'avatars' bucket fallback
  console.warn('[Brighter Diagnostic] "posts" bucket upload note:', uploadError.message, '- trying "avatars" bucket');
  const { error: avatarUploadError } = await client.storage
    .from('avatars')
    .upload(filePath, file, {
      upsert: false,
      cacheControl: '3600',
    });

  if (!avatarUploadError) {
    const { data } = client.storage.from('avatars').getPublicUrl(filePath);
    console.info('[Brighter Diagnostic] Post media uploaded to "avatars" bucket successfully.');
    return { url: data.publicUrl, error: null };
  }

  // 3. Fallback to Data URL if buckets are not created yet in Supabase Storage
  console.warn('[Brighter Diagnostic] Falling back to Data URL encoding for media');
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, error: null };
  } catch {
    return { url: null, error: uploadError };
  }
}

// Follow system helpers
export async function checkIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false;
  const client = getSupabase();
  const { data, error } = await client
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) {
    console.warn('Error checking follow status:', error.message);
    return false;
  }
  return Boolean(data);
}

export async function followUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
  if (followerId === followingId) {
    return { success: false, error: 'You cannot follow yourself.' };
  }
  const client = getSupabase();
  const { error } = await client
    .from('follows')
    .insert({
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date().toISOString(),
    });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function unfollowUser(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function fetchFollowStats(userId: string): Promise<{ followers: number; following: number; posts: number }> {
  const client = getSupabase();

  try {
    const [followersRes, followingRes, postsRes] = await Promise.all([
      client.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      client.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    ]);

    return {
      followers: followersRes.count || 0,
      following: followingRes.count || 0,
      posts: postsRes.count || 0,
    };
  } catch (err) {
    console.warn('Could not fetch stats:', err);
    return { followers: 0, following: 0, posts: 0 };
  }
}

// Post helpers
export async function fetchUserPosts(userId: string): Promise<any[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user posts:', error);
    return [];
  }
  return (data || []).map((p: any) => ({
    ...p,
    media_url: p.media_url || p.image_url || null,
  }));
}

export async function createPost(post: {
  user_id: string;
  caption?: string | null;
  media_url?: string | null;
  image_url?: string | null;
  media_type?: 'video' | 'image';
  privacy?: 'public' | 'friends' | 'private';
}): Promise<{ data: any; error: any }> {
  const client = getSupabase();
  const creds = getSupabaseCredentials();

  const mediaUrlValue = post.image_url || post.media_url || null;

  // Build exact column payload matching database schema (id, user_id, caption, image_url, media_type, created_at)
  const payload: Record<string, any> = {
    user_id: post.user_id,
    caption: post.caption ?? null,
    image_url: mediaUrlValue,
    media_type: post.media_type || 'image',
  };

  // Safe diagnostic logging
  try {
    const hostname = creds.url ? new URL(creds.url).hostname : 'unknown';
    console.info('[Brighter Diagnostic] Target Project Hostname:', hostname);
    console.info('[Brighter Diagnostic] Target Table: public.posts');
    console.info('[Brighter Diagnostic] Payload Column Keys:', Object.keys(payload));
  } catch {}

  const { data, error } = await client
    .from('posts')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Brighter Diagnostic] Database Error Details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  } else {
    console.info('[Brighter Diagnostic] Post created successfully. Row ID:', data?.id);
  }

  // Normalize returned object to have media_url as well
  const normalizedData = data ? { ...data, media_url: data.media_url || data.image_url } : null;

  return { data: normalizedData, error };
}

/**
 * Delete a post by its owner.
 * Strictly enforces that the authenticated user owns the post.
 * Supabase RLS also guarantees `auth.uid() = user_id`.
 */
export async function deletePost(postId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (!postId || !userId) {
    return { success: false, error: 'Missing post ID or user ID.' };
  }
  const client = getSupabase();
  const { error } = await client
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Brighter] Error deleting post:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// -----------------------------------------------------------------------------
// Single Post Fetching (for Share Links)
// -----------------------------------------------------------------------------
export async function fetchPostById(postId: string): Promise<Post | null> {
  if (!postId) return null;
  const client = getSupabase();
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
    .eq('id', postId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[Brighter Diagnostic] Error fetching post by id:', error.message);
    return null;
  }

  return {
    ...data,
    media_url: data.media_url || data.image_url || null,
  } as Post;
}

// -----------------------------------------------------------------------------
// Real Comments System
// -----------------------------------------------------------------------------
export async function fetchComments(postId: string): Promise<Comment[]> {
  if (!postId) return [];
  const client = getSupabase();
  const { data, error } = await client
    .from('comments')
    .select(`
      id,
      post_id,
      user_id,
      body,
      created_at,
      profiles:user_id (
        id,
        username,
        avatar_url
      )
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Brighter Diagnostic] Error fetching comments:', error.message);
    return [];
  }

  return (data as unknown as Comment[]) || [];
}

export async function fetchCommentCount(postId: string): Promise<number> {
  if (!postId) return 0;
  const client = getSupabase();
  const { count, error } = await client
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) return 0;
  return count || 0;
}

export async function createComment(
  postId: string,
  userId: string,
  body: string
): Promise<{ data: Comment | null; error: any }> {
  if (!postId || !userId || !body.trim()) {
    return { data: null, error: { message: 'Missing required comment fields' } };
  }
  const client = getSupabase();
  const payload = {
    post_id: postId,
    user_id: userId,
    body: body.trim(),
  };

  const { data, error } = await client
    .from('comments')
    .insert(payload)
    .select(`
      id,
      post_id,
      user_id,
      body,
      created_at,
      profiles:user_id (
        id,
        username,
        avatar_url
      )
    `)
    .single();

  if (error) {
    console.error('[Brighter Diagnostic] Error creating comment:', error.message);
  }

  return { data: (data as unknown as Comment) || null, error };
}

export async function deleteComment(commentId: string, userId: string): Promise<{ error: any }> {
  if (!commentId || !userId) return { error: { message: 'Missing parameters' } };
  const client = getSupabase();
  const { error } = await client
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Brighter Diagnostic] Error deleting comment:', error.message);
  }

  return { error };
}

// -----------------------------------------------------------------------------
// Real Likes System
// -----------------------------------------------------------------------------
export async function fetchPostLikesCount(postId: string): Promise<number> {
  if (!postId) return 0;
  const client = getSupabase();
  const { count, error } = await client
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) return 0;
  return count || 0;
}

export async function checkIsPostLiked(postId: string, userId: string): Promise<boolean> {
  if (!postId || !userId) return false;
  const client = getSupabase();
  const { data, error } = await client
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function togglePostLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<{ isLiked: boolean; error?: string }> {
  if (!postId || !userId) return { isLiked: currentlyLiked, error: 'User must be authenticated' };
  const client = getSupabase();

  if (currentlyLiked) {
    const { error } = await client
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Brighter Diagnostic] Unlike error:', error.message);
      return { isLiked: true, error: error.message };
    }
    return { isLiked: false };
  } else {
    const { error } = await client
      .from('likes')
      .insert({
        post_id: postId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[Brighter Diagnostic] Like error:', error.message);
      return { isLiked: false, error: error.message };
    }
    return { isLiked: true };
  }
}

// -----------------------------------------------------------------------------
// Saved Posts System (Bookmarks)
// -----------------------------------------------------------------------------
export async function checkIsPostSaved(postId: string, userId: string): Promise<boolean> {
  if (!postId || !userId) return false;
  const client = getSupabase();

  // Try Supabase saved_posts table
  try {
    const { data, error } = await client
      .from('saved_posts')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      return true;
    }
  } catch {}

  // Resilient localStorage fallback
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(`brighter_saved_${userId}`) || '[]';
    try {
      const arr: string[] = JSON.parse(raw);
      return arr.includes(postId);
    } catch {}
  }

  return false;
}

export async function savePost(postId: string, userId: string): Promise<{ error?: string }> {
  if (!postId || !userId) return { error: 'Invalid parameters' };
  const client = getSupabase();

  // 1. Try Supabase saved_posts table
  const { error } = await client
    .from('saved_posts')
    .insert({
      user_id: userId,
      post_id: postId,
      created_at: new Date().toISOString(),
    });

  // 2. Always sync to localStorage fallback for persistence
  if (typeof window !== 'undefined') {
    const key = `brighter_saved_${userId}`;
    const raw = localStorage.getItem(key) || '[]';
    try {
      const arr: string[] = JSON.parse(raw);
      if (!arr.includes(postId)) {
        arr.unshift(postId);
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch {}
  }

  if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) {
    console.warn('[Brighter Diagnostic] savePost DB note:', error.message);
    return { error: error.message };
  }

  return {};
}

export async function unsavePost(postId: string, userId: string): Promise<{ error?: string }> {
  if (!postId || !userId) return { error: 'Invalid parameters' };
  const client = getSupabase();

  // 1. Try Supabase saved_posts table
  const { error } = await client
    .from('saved_posts')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

  // 2. Always sync to localStorage fallback
  if (typeof window !== 'undefined') {
    const key = `brighter_saved_${userId}`;
    const raw = localStorage.getItem(key) || '[]';
    try {
      let arr: string[] = JSON.parse(raw);
      arr = arr.filter((id) => id !== postId);
      localStorage.setItem(key, JSON.stringify(arr));
    } catch {}
  }

  if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) {
    console.warn('[Brighter Diagnostic] unsavePost DB note:', error.message);
    return { error: error.message };
  }

  return {};
}

export async function fetchUserSavedPosts(userId: string): Promise<Post[]> {
  if (!userId) return [];
  const client = getSupabase();

  // 1. Try Supabase join query on saved_posts
  const { data, error } = await client
    .from('saved_posts')
    .select(`
      post_id,
      created_at,
      posts:post_id (
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!error && Array.isArray(data) && data.length > 0) {
    return data
      .map((item: any) => item.posts)
      .filter(Boolean)
      .map((p: any) => ({
        ...p,
        media_url: p.media_url || p.image_url || null,
      }));
  }

  // 2. Resilient fallback: read post IDs from localStorage and fetch from posts table
  if (typeof window !== 'undefined') {
    const key = `brighter_saved_${userId}`;
    const raw = localStorage.getItem(key) || '[]';
    try {
      const arr: string[] = JSON.parse(raw);
      if (arr.length > 0) {
        const { data: fallbackPosts } = await client
          .from('posts')
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              avatar_url
            )
          `)
          .in('id', arr);

        if (fallbackPosts) {
          return fallbackPosts.map((p: any) => ({
            ...p,
            media_url: p.media_url || p.image_url || null,
          }));
        }
      }
    } catch {}
  }

  return [];
}

// =============================================================================
// Real User-to-User Private Messaging System
// =============================================================================

/**
 * Search registered users for starting a chat.
 * Strictly prevents self-matching and supports exact and partial matching.
 */
export async function searchUsersToChat(query: string, currentUserId: string): Promise<Profile[]> {
  if (!query || !query.trim() || !currentUserId) return [];
  const client = getSupabase();
  const clean = query.trim().toLowerCase().replace('@', '');

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .ilike('username', `%${clean}%`)
      .neq('id', currentUserId)
      .limit(20);

    if (error) {
      console.warn('[Brighter Messaging] Error searching users to chat:', error.message);
      return [];
    }

    return (data as Profile[]) || [];
  } catch (err) {
    console.warn('[Brighter Messaging] Exception searching users:', err);
    return [];
  }
}

/**
 * Get an existing conversation between two participants or create a new one.
 * Uses sorted participant IDs (p1 < p2) to guarantee a unique 1-on-1 direct conversation.
 */
export async function getOrCreateConversation(
  currentUserId: string,
  targetUserId: string
): Promise<{ data: Conversation | null; error: any }> {
  if (!currentUserId || !targetUserId) {
    return { data: null, error: { message: 'Missing participant IDs' } };
  }

  if (currentUserId === targetUserId) {
    return { data: null, error: { message: 'Cannot start a conversation with yourself' } };
  }

  const client = getSupabase();
  const [p1, p2] = currentUserId < targetUserId ? [currentUserId, targetUserId] : [targetUserId, currentUserId];

  try {
    // 1. Check for existing conversation
    const { data: existing, error: findErr } = await client
      .from('conversations')
      .select('*')
      .eq('participant1_id', p1)
      .eq('participant2_id', p2)
      .maybeSingle();

    if (findErr) {
      console.warn('[Brighter Messaging] Check conversation error:', findErr.message);
      return { data: null, error: findErr };
    }

    if (existing) {
      return { data: existing as Conversation, error: null };
    }

    // 2. Insert new conversation with sorted participant IDs
    const now = new Date().toISOString();
    const { data: created, error: insertErr } = await client
      .from('conversations')
      .insert({
        participant1_id: p1,
        participant2_id: p2,
        last_message: null,
        last_message_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertErr) {
      // Handle race condition if conversation was created simultaneously
      if (insertErr.code === '23505') {
        const { data: retryData } = await client
          .from('conversations')
          .select('*')
          .eq('participant1_id', p1)
          .eq('participant2_id', p2)
          .single();
        return { data: retryData as Conversation, error: null };
      }
      console.error('[Brighter Messaging] Create conversation error:', insertErr);
      return { data: null, error: insertErr };
    }

    return { data: created as Conversation, error: null };
  } catch (err: any) {
    console.error('[Brighter Messaging] getOrCreateConversation exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch all conversations for the authenticated user, attaching counterpart profile and unread counts.
 */
export async function fetchUserConversations(userId: string): Promise<Conversation[]> {
  if (!userId) return [];
  const client = getSupabase();

  try {
    const { data: rawConversations, error: convErr } = await client
      .from('conversations')
      .select('*')
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (convErr) {
      console.warn('[Brighter Messaging] Fetch conversations warning:', convErr.message);
      return [];
    }

    if (!rawConversations || rawConversations.length === 0) {
      return [];
    }

    // Determine the counterpart ID for each conversation
    const otherUserIds = Array.from(
      new Set(
        rawConversations.map((c: any) =>
          c.participant1_id === userId ? c.participant2_id : c.participant1_id
        )
      )
    );

    // Fetch counterpart profiles in batch
    let profilesMap: Record<string, Profile> = {};
    if (otherUserIds.length > 0) {
      const { data: profilesData } = await client
        .from('profiles')
        .select('*')
        .in('id', otherUserIds);

      if (profilesData) {
        profilesMap = profilesData.reduce((acc, p) => {
          acc[p.id] = p as Profile;
          return acc;
        }, {} as Record<string, Profile>);
      }
    }

    // Fetch unread message counts for all active conversations
    const convIds = rawConversations.map((c: any) => c.id);
    let unreadMap: Record<string, number> = {};
    if (convIds.length > 0) {
      const { data: unreadMessages } = await client
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (unreadMessages) {
        unreadMap = unreadMessages.reduce((acc, m: any) => {
          acc[m.conversation_id] = (acc[m.conversation_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Map into rich Conversation objects
    return rawConversations.map((c: any) => {
      const otherId = c.participant1_id === userId ? c.participant2_id : c.participant1_id;
      return {
        ...c,
        other_user: profilesMap[otherId] || null,
        unread_count: unreadMap[c.id] || 0,
      } as Conversation;
    });
  } catch (err) {
    console.error('[Brighter Messaging] fetchUserConversations exception:', err);
    return [];
  }
}

/**
 * Fetch messages for a specific conversation, ordered chronologically.
 */
export async function fetchConversationMessages(conversationId: string): Promise<Message[]> {
  if (!conversationId) return [];
  const client = getSupabase();

  try {
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Brighter Messaging] Fetch messages error:', error.message);
      return [];
    }

    return (data as Message[]) || [];
  } catch (err) {
    console.error('[Brighter Messaging] fetchConversationMessages exception:', err);
    return [];
  }
}

/**
 * Send a new private message in a conversation.
 * Persists to public.messages and updates public.conversations timestamp.
 */
export async function sendPrivateMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ data: Message | null; error: any }> {
  if (!conversationId || !senderId || !body || !body.trim()) {
    return { data: null, error: { message: 'Missing required message parameters' } };
  }

  const client = getSupabase();
  const trimmed = body.trim();
  const now = new Date().toISOString();

  try {
    // 1. Insert message into messages table
    const { data, error: insertErr } = await client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        body: trimmed,
        is_read: false,
        created_at: now,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[Brighter Messaging] Send message error:', insertErr);
      return { data: null, error: insertErr };
    }

    // 2. Proactively update conversation preview & timestamp
    await client
      .from('conversations')
      .update({
        last_message: trimmed,
        last_message_at: now,
        updated_at: now,
      })
      .eq('id', conversationId);

    return { data: data as Message, error: null };
  } catch (err: any) {
    console.error('[Brighter Messaging] sendPrivateMessage exception:', err);
    return { data: null, error: err };
  }
}

/**
 * Mark messages in a conversation as read for the current user.
 */
export async function markConversationAsRead(conversationId: string, currentUserId: string): Promise<void> {
  if (!conversationId || !currentUserId) return;
  const client = getSupabase();

  try {
    await client
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId)
      .eq('is_read', false);
  } catch (err) {
    console.warn('[Brighter Messaging] markConversationAsRead error:', err);
  }
}

/**
 * Subscribe to realtime incoming messages for a conversation.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessageReceived: (message: Message) => void
): () => void {
  const client = getSupabase();
  const channelName = `chat_${conversationId}_${Date.now()}`;

  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (payload.new) {
          onMessageReceived(payload.new as Message);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

// =============================================================================
// ADMINISTRATOR SYSTEM HELPERS & BACKEND OPERATIONS
// =============================================================================

// In-memory cache for admin user IDs to minimize redundant DB calls
let cachedAdminIds: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Fetch all registered administrator user IDs from the backend user_roles table.
 * Caches results in memory for 30s to preserve high performance across feed/chat.
 */
export async function fetchAdminUserIds(forceRefresh = false): Promise<string[]> {
  const now = Date.now();
  if (!forceRefresh && cachedAdminIds && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedAdminIds;
  }

  const client = getSupabase();
  try {
    const { data, error } = await client
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin');

    if (error) {
      console.warn('[Brighter Admin] user_roles table query:', error.message);
      // Backend verification check: verify the authenticated 'brighter' account from Supabase database
      const { data: profileCheck } = await client
        .from('profiles')
        .select('id, username')
        .eq('id', '38e641d1-d1c9-4b0f-815c-db006d9751d1')
        .eq('username', 'brighter')
        .maybeSingle();

      if (profileCheck?.id === '38e641d1-d1c9-4b0f-815c-db006d9751d1') {
        cachedAdminIds = ['38e641d1-d1c9-4b0f-815c-db006d9751d1'];
        cacheTimestamp = now;
        return cachedAdminIds;
      }
      return cachedAdminIds || [];
    }

    cachedAdminIds = (data || []).map((r: any) => r.user_id);
    cacheTimestamp = now;
    return cachedAdminIds;
  } catch (err) {
    console.warn('[Brighter Admin] Error fetching admin user IDs:', err);
    return cachedAdminIds || [];
  }
}

/**
 * Check if a specific user is verified administrator.
 */
export async function checkIsAdmin(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const adminIds = await fetchAdminUserIds();
  return adminIds.includes(userId);
}

/**
 * Invalidate admin user cache (e.g. after assigning roles).
 */
export function invalidateAdminCache(): void {
  cachedAdminIds = null;
  cacheTimestamp = 0;
}

/**
 * Fetch real aggregate platform statistics for Admin Dashboard Overview.
 */
export async function fetchAdminStats(): Promise<AdminOverviewStats> {
  const client = getSupabase();

  try {
    const [
      usersRes,
      postsRes,
      photosRes,
      videosRes,
      reportsRes,
      pendingReportsRes,
      announcementsRes,
    ] = await Promise.all([
      client.from('profiles').select('*', { count: 'exact', head: true }),
      client.from('posts').select('*', { count: 'exact', head: true }),
      client.from('posts').select('*', { count: 'exact', head: true }).eq('media_type', 'image'),
      client.from('posts').select('*', { count: 'exact', head: true }).eq('media_type', 'video'),
      client.from('reports').select('*', { count: 'exact', head: true }),
      client.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      client.from('announcements').select('*', { count: 'exact', head: true }),
    ]);

    return {
      usersCount: usersRes.count || 0,
      postsCount: postsRes.count || 0,
      photosCount: photosRes.count || 0,
      videosCount: videosRes.count || 0,
      reportsCount: reportsRes.count || 0,
      pendingReportsCount: pendingReportsRes.count || 0,
      announcementsCount: announcementsRes.count || 0,
    };
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching admin stats:', err);
    return {
      usersCount: 0,
      postsCount: 0,
      photosCount: 0,
      videosCount: 0,
      reportsCount: 0,
      pendingReportsCount: 0,
      announcementsCount: 0,
    };
  }
}

/**
 * Fetch all registered users for user management in Admin Dashboard.
 */
export async function fetchAdminUsers(searchQuery?: string): Promise<Profile[]> {
  const client = getSupabase();
  try {
    let query = client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (searchQuery && searchQuery.trim()) {
      const clean = searchQuery.trim().toLowerCase().replace('@', '');
      query = query.ilike('username', `%${clean}%`);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      console.error('[Brighter Admin] Error fetching users:', error);
      return [];
    }
    return (data as Profile[]) || [];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching users:', err);
    return [];
  }
}

/**
 * Suspend or restore a user account with recorded audit log.
 */
export async function adminToggleUserSuspension(
  adminId: string,
  targetUserId: string,
  shouldSuspend: boolean,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  try {
    // 1. Try secure RPC function first
    const { error: rpcErr } = await client.rpc('admin_toggle_user_suspension', {
      target_user_id: targetUserId,
      should_suspend: shouldSuspend,
      reason: reason || null,
    });

    if (!rpcErr) {
      return { success: true };
    }

    // 2. Fallback: Direct table update if permitted
    console.warn('[Brighter Admin] RPC suspension fallback to direct update:', rpcErr.message);
    const { error: directErr } = await client
      .from('profiles')
      .update({
        is_suspended: shouldSuspend,
        suspension_reason: shouldSuspend ? reason || 'Administrative action' : null,
        suspended_at: shouldSuspend ? new Date().toISOString() : null,
      })
      .eq('id', targetUserId);

    if (directErr) {
      return { success: false, error: directErr.message };
    }

    // Write audit log
    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: shouldSuspend ? 'SUSPEND_USER' : 'RESTORE_USER',
      target_type: 'user',
      target_id: targetUserId,
      details: { reason },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle suspension' };
  }
}

/**
 * Fetch posts for moderation with optional filter.
 */
export async function fetchAdminPosts(filter: 'all' | 'hidden' | 'visible' = 'all'): Promise<Post[]> {
  const client = getSupabase();
  try {
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
      .order('created_at', { ascending: false });

    if (filter === 'hidden') {
      query = query.eq('is_hidden', true);
    } else if (filter === 'visible') {
      query = query.eq('is_hidden', false);
    }

    const { data, error } = await query.limit(50);
    if (error) {
      console.error('[Brighter Admin] Error fetching posts:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      ...p,
      media_url: p.media_url || p.image_url || null,
    })) as Post[];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching admin posts:', err);
    return [];
  }
}

/**
 * Hide or restore a post (soft moderation).
 */
export async function adminTogglePostVisibility(
  adminId: string,
  targetPostId: string,
  shouldHide: boolean
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  try {
    const { error: rpcErr } = await client.rpc('admin_toggle_post_visibility', {
      target_post_id: targetPostId,
      should_hide: shouldHide,
    });

    if (!rpcErr) {
      return { success: true };
    }

    // Direct fallback
    const { error: directErr } = await client
      .from('posts')
      .update({
        is_hidden: shouldHide,
        moderated_at: new Date().toISOString(),
        moderated_by: adminId,
      })
      .eq('id', targetPostId);

    if (directErr) {
      return { success: false, error: directErr.message };
    }

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: shouldHide ? 'HIDE_POST' : 'RESTORE_POST',
      target_type: 'post',
      target_id: targetPostId,
      details: { is_hidden: shouldHide },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle post visibility' };
  }
}

/**
 * Permanently delete a post by administrator.
 */
export async function adminDeletePost(adminId: string, targetPostId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();

  try {
    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', targetPostId);

    if (error) {
      return { success: false, error: error.message };
    }

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: 'DELETE_POST',
      target_type: 'post',
      target_id: targetPostId,
      details: { deleted_at: new Date().toISOString() },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete post' };
  }
}

/**
 * Fetch all reports submitted by users.
 */
export async function fetchAdminReports(): Promise<AdminReport[]> {
  const client = getSupabase();
  try {
    const { data, error } = await client
      .from('reports')
      .select(`
        *,
        reporter:reporter_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) {
      console.warn('[Brighter Admin] Error fetching reports:', error.message);
      return [];
    }

    return (data as AdminReport[]) || [];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching reports:', err);
    return [];
  }
}

/**
 * Submit a content or user report (accessible to any authenticated user).
 */
export async function createReport(
  reporterId: string,
  targetType: 'post' | 'comment' | 'user',
  targetId: string,
  reason: string,
  details?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  try {
    const { error } = await client.from('reports').insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
      status: 'pending',
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit report' };
  }
}

/**
 * Resolve or dismiss a report by administrator.
 */
export async function adminResolveReport(
  adminId: string,
  reportId: string,
  status: 'resolved' | 'dismissed',
  actionTaken?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  try {
    const { error } = await client
      .from('reports')
      .update({
        status,
        action_taken: actionTaken || (status === 'resolved' ? 'Reviewed and actioned' : 'Dismissed by admin'),
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (error) return { success: false, error: error.message };

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: status === 'resolved' ? 'RESOLVE_REPORT' : 'DISMISS_REPORT',
      target_type: 'report',
      target_id: reportId,
      details: { status, actionTaken },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update report' };
  }
}

/**
 * Fetch official announcements to display in users' feeds and admin dashboard.
 */
export async function fetchAnnouncements(onlyActive = true): Promise<Announcement[]> {
  const client = getSupabase();
  try {
    let query = client
      .from('announcements')
      .select(`
        *,
        author:author_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (onlyActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query.limit(20);
    if (error) {
      console.warn('[Brighter Admin] Error fetching announcements:', error.message);
      return [];
    }

    return (data as Announcement[]) || [];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching announcements:', err);
    return [];
  }
}

/**
 * Create a new official announcement.
 */
export async function adminCreateAnnouncement(
  authorId: string,
  title: string,
  body: string,
  priority: 'low' | 'normal' | 'urgent' | 'pinned' = 'normal',
  badgeTag = 'OFFICIAL BRIGHTER ANNOUNCEMENT'
): Promise<{ data: Announcement | null; error?: string }> {
  const client = getSupabase();
  const now = new Date().toISOString();

  try {
    const { data, error } = await client
      .from('announcements')
      .insert({
        author_id: authorId,
        title: title.trim(),
        body: body.trim(),
        priority,
        badge_tag: badgeTag,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select(`
        *,
        author:author_id (
          id,
          username,
          avatar_url
        )
      `)
      .single();

    if (error) return { data: null, error: error.message };

    await client.from('admin_audit_logs').insert({
      admin_id: authorId,
      action: 'CREATE_ANNOUNCEMENT',
      target_type: 'announcement',
      target_id: data.id,
      details: { title },
    });

    return { data: data as Announcement };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to create announcement' };
  }
}

/**
 * Toggle active status of an announcement.
 */
export async function adminToggleAnnouncement(
  adminId: string,
  announcementId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  try {
    const { error } = await client
      .from('announcements')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', announcementId);

    if (error) return { success: false, error: error.message };

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: isActive ? 'ACTIVATE_ANNOUNCEMENT' : 'DEACTIVATE_ANNOUNCEMENT',
      target_type: 'announcement',
      target_id: announcementId,
      details: { is_active: isActive },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update announcement' };
  }
}

/**
 * Delete an announcement.
 */
export async function adminDeleteAnnouncement(
  adminId: string,
  announcementId: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  try {
    const { error } = await client
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) return { success: false, error: error.message };

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: 'DELETE_ANNOUNCEMENT',
      target_type: 'announcement',
      target_id: announcementId,
      details: { deleted_at: new Date().toISOString() },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete announcement' };
  }
}

/**
 * Fetch recent comments for admin moderation review.
 */
export async function fetchAdminComments(limit = 40): Promise<Comment[]> {
  const client = getSupabase();
  try {
    const { data, error } = await client
      .from('comments')
      .select(`
        id,
        post_id,
        user_id,
        body,
        created_at,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Brighter Admin] Error fetching comments for moderation:', error);
      return [];
    }
    return (data as unknown as Comment[]) || [];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching comments for moderation:', err);
    return [];
  }
}

/**
 * Delete a comment by administrator.
 */
export async function adminDeleteComment(
  adminId: string,
  commentId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabase();
  try {
    const { error } = await client
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) return { success: false, error: error.message };

    await client.from('admin_audit_logs').insert({
      admin_id: adminId,
      action: 'DELETE_COMMENT',
      target_type: 'comment',
      target_id: commentId,
      details: { reason: reason || 'Violation of community guidelines' },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete comment' };
  }
}

/**
 * Fetch immutable security audit logs for the admin dashboard.
 */
export async function fetchAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const client = getSupabase();
  try {
    const { data, error } = await client
      .from('admin_audit_logs')
      .select(`
        *,
        admin:admin_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('[Brighter Admin] Error fetching audit logs:', error.message);
      return [];
    }

    return (data as AdminAuditLog[]) || [];
  } catch (err) {
    console.error('[Brighter Admin] Exception fetching audit logs:', err);
    return [];
  }
}

// Initialize on load
initSupabase();

