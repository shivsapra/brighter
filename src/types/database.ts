export interface Profile {
  id: string; // references auth.users.id
  username: string; // unique lowercase
  display_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  suspended_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  media_url?: string | null;
  image_url?: string | null;
  media_type: 'video' | 'image';
  privacy?: 'public' | 'friends' | 'private';
  is_hidden?: boolean;
  moderated_at?: string | null;
  moderated_by?: string | null;
  created_at: string;
  updated_at?: string;
  // Joined profile fields for feed display
  profiles?: Profile;
}

export interface UserStats {
  followers_count: number;
  following_count: number;
  likes_count: number;
  posts_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: Profile;
}

export interface Like {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface SavedPost {
  id?: string;
  post_id: string;
  user_id: string;
  created_at: string;
  posts?: Post;
}

export interface Conversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  last_message?: string | null;
  last_message_at: string;
  created_at: string;
  updated_at?: string;
  // Computed / joined fields
  other_user?: Profile | null;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
}

export interface AdminReport {
  id: string;
  reporter_id: string | null;
  target_type: 'post' | 'comment' | 'user';
  target_id: string;
  reason: string;
  details?: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  action_taken?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  // Joined reporter profile
  reporter?: Profile | null;
}

export interface Announcement {
  id: string;
  author_id: string;
  title: string;
  body: string;
  message?: string;
  badge_tag?: string;
  link_url?: string;
  priority: 'low' | 'normal' | 'urgent' | 'pinned';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined author
  author?: Profile | null;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id?: string | null;
  details: Record<string, any>;
  created_at: string;
  admin?: Profile | null;
}

export interface AdminOverviewStats {
  usersCount: number;
  postsCount: number;
  photosCount: number;
  videosCount: number;
  reportsCount: number;
  pendingReportsCount: number;
  announcementsCount: number;
}
