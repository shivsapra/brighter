import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import {
  initSupabase,
  getSupabase,
  isSupabaseReady,
  fetchProfile,
  upsertProfile,
  checkUsernameExists,
} from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isConfigured: boolean;
  recoveryMode: boolean;
  setRecoveryMode: (val: boolean) => void;
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  recheckConfig: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseReady());
  const [recoveryMode, setRecoveryMode] = useState<boolean>(false);

  const recheckConfig = useCallback(() => {
    const ready = isSupabaseReady();
    setIsConfigured(ready);
    if (ready) {
      initSupabase();
    }
  }, []);

  const loadUserProfile = useCallback(async (userId: string, currentUsername?: string, currentDisplay?: string) => {
    try {
      let p = await fetchProfile(userId);
      // Fallback: If trigger didn't run or table was created afterwards, create profile row safely
      if (!p && isSupabaseReady()) {
        const client = getSupabase();
        const fallbackUsername = currentUsername || `user_${userId.slice(0, 8)}`;
        const fallbackDisplay = currentDisplay || fallbackUsername;

        const { data } = await client
          .from('profiles')
          .insert({
            id: userId,
            username: fallbackUsername.toLowerCase(),
            display_name: fallbackDisplay,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (data) {
          p = data as Profile;
        }
      }
      setProfile(p);
    } catch (err) {
      console.warn('Could not load profile:', err);
    }
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    let client: any = null;
    try {
      client = getSupabase();
    } catch (e) {
      setIsLoading(false);
      return;
    }

    // Check current active session
    client.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(
          session.user.id,
          session.user.user_metadata?.username,
          session.user.user_metadata?.display_name
        ).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true);
        }

        if (session?.user) {
          await loadUserProfile(
            session.user.id,
            session.user.user_metadata?.username,
            session.user.user_metadata?.display_name
          );
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [isConfigured, loadUserProfile]);

  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string; needsVerification?: boolean }> => {
    if (!isConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    const cleanUsername = username.trim().toLowerCase();

    // 1. Validate username rules
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      return { success: false, error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores.' };
    }

    // 2. Prevent duplicate usernames
    try {
      const exists = await checkUsernameExists(cleanUsername);
      if (exists) {
        return { success: false, error: `The username @${cleanUsername} is already taken. Please choose another.` };
      }
    } catch (e) {
      console.warn('Username check skipped or failed:', e);
    }

    // 3. Register user with Supabase Auth
    try {
      const client = getSupabase();
      const finalDisplayName = displayName?.trim() || cleanUsername;

      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: finalDisplayName,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Registration failed. No user returned.' };
      }

      // If user session is returned immediately (email confirmation disabled in Supabase)
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        // Ensure profile row exists
        await loadUserProfile(data.user.id, cleanUsername, finalDisplayName);
        return { success: true, needsVerification: false };
      }

      // Email confirmation is required
      return { success: true, needsVerification: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'An unexpected error occurred during signup.' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const client = getSupabase();
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await loadUserProfile(
          data.user.id,
          data.user.user_metadata?.username,
          data.user.user_metadata?.display_name
        );
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Login failed.' };
    }
  };

  const signOut = async () => {
    if (!isConfigured) return;
    try {
      const client = getSupabase();
      await client.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
    }
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isConfigured) {
      return { success: false, error: 'Supabase credentials are not configured.' };
    }

    try {
      const client = getSupabase();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send password reset email.' };
    }
  };

  const updatePassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isConfigured) {
      return { success: false, error: 'Supabase is not configured.' };
    }

    try {
      const client = getSupabase();
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        return { success: false, error: error.message };
      }
      setRecoveryMode(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not update password.' };
    }
  };

  const updateProfile = async (data: Partial<Profile>): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated.' };
    }

    // Check username if it changed
    if (data.username && profile && data.username.toLowerCase() !== profile.username.toLowerCase()) {
      const cleanNew = data.username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanNew)) {
        return { success: false, error: 'Username must be 3-30 alphanumeric or underscore characters.' };
      }
      const exists = await checkUsernameExists(cleanNew, user.id);
      if (exists) {
        return { success: false, error: `@${cleanNew} is already taken.` };
      }
    }

    const { data: updated, error } = await upsertProfile({
      id: user.id,
      username: data.username || profile?.username || `user_${user.id.slice(0, 8)}`,
      ...data,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    setProfile(updated);
    return { success: true };
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isConfigured,
        recoveryMode,
        setRecoveryMode,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile,
        recheckConfig,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
