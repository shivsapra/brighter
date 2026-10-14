import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  ArrowLeft,
  UserPlus,
  Loader2,
  Star,
  Check,
  CheckCheck,
  X,
  Bell,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  searchUsersToChat,
  getOrCreateConversation,
  fetchUserConversations,
  fetchConversationMessages,
  sendPrivateMessage,
  markConversationAsRead,
  subscribeToMessages,
  fetchProfile,
} from '../../lib/supabase';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import type { Conversation, Message, Profile } from '../../types/database';

interface MessagesInboxProps {
  initialTargetUserId?: string | null;
  onClearInitialTarget?: () => void;
}

export const MessagesInbox: React.FC<MessagesInboxProps> = ({
  initialTargetUserId,
  onClearInitialTarget,
}) => {
  const { user } = useAuth();
  const { error: toastError } = useToast();

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<'chats' | 'activity'>('chats');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Conversation List State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [convSearchQuery, setConvSearchQuery] = useState('');

  // Active Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New Chat Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [hasSearchedUsers, setHasSearchedUsers] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. Load Conversations for Authenticated User
  // ---------------------------------------------------------------------------
  const loadConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setIsLoadingConversations(false);
      return;
    }

    setIsLoadingConversations(true);
    try {
      const data = await fetchUserConversations(user.id);
      setConversations(data);
    } catch (err: any) {
      console.warn('[Brighter Messaging] Could not load conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---------------------------------------------------------------------------
  // 2. Handle Initial Target User from Profile "Message" click
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!initialTargetUserId || !user || initialTargetUserId === user.id) return;

    let isMounted = true;
    (async () => {
      try {
        const { data: conv, error } = await getOrCreateConversation(user.id, initialTargetUserId);
        if (error) {
          toastError(error.message || 'Could not open conversation');
          return;
        }

        if (conv && isMounted) {
          // Fetch target profile if missing
          const otherProfile = await fetchProfile(initialTargetUserId);
          const fullConv: Conversation = {
            ...conv,
            other_user: otherProfile || null,
          };
          setActiveConversation(fullConv);
          onClearInitialTarget?.();
        }
      } catch (err) {
        console.error('[Brighter Messaging] Error opening initial conversation:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [initialTargetUserId, user, onClearInitialTarget, toastError]);

  // ---------------------------------------------------------------------------
  // 3. User Search in "Start a New Chat" Modal
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([]);
      setIsSearchingUsers(false);
      setHasSearchedUsers(false);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearchingUsers(true);
      setHasSearchedUsers(true);
      try {
        const results = await searchUsersToChat(searchQuery, user.id);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, user]);

  // ---------------------------------------------------------------------------
  // 4. Start Chat with Selected User
  // ---------------------------------------------------------------------------
  const handleSelectUserToChat = async (targetUser: Profile) => {
    if (!user) return;
    if (user.id === targetUser.id) {
      toastError('You cannot start a conversation with yourself.');
      return;
    }

    setIsStartingChat(true);
    try {
      const { data: conv, error } = await getOrCreateConversation(user.id, targetUser.id);
      if (error) {
        toastError(error.message || 'Could not create conversation. Please verify database tables.');
        return;
      }

      if (conv) {
        const fullConv: Conversation = {
          ...conv,
          other_user: targetUser,
        };
        setActiveConversation(fullConv);
        setIsNewChatOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        loadConversations();
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to start chat.');
    } finally {
      setIsStartingChat(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. Load Messages & Subscribe to Realtime for Active Conversation
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activeConversation || !user) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingMessages(true);

    // Fetch conversation message history
    fetchConversationMessages(activeConversation.id)
      .then((data) => {
        if (isMounted) {
          setMessages(data);
          setIsLoadingMessages(false);
          // Mark conversation as read
          markConversationAsRead(activeConversation.id, user.id);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[Brighter Messaging] Error fetching messages:', err);
          setIsLoadingMessages(false);
        }
      });

    // Realtime incoming message listener
    const unsubscribe = subscribeToMessages(activeConversation.id, (newMsg) => {
      if (!isMounted) return;
      setMessages((prev) => {
        // Prevent duplicate appending
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Mark incoming message as read if active
      if (newMsg.sender_id !== user.id) {
        markConversationAsRead(activeConversation.id, user.id);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeConversation, user]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ---------------------------------------------------------------------------
  // 6. Send Message Action
  // ---------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!activeConversation || !user || !messageInput.trim() || isSending) return;

    const textToSend = messageInput.trim();
    setMessageInput('');
    setIsSending(true);

    try {
      const { data: newMsg, error } = await sendPrivateMessage(
        activeConversation.id,
        user.id,
        textToSend
      );

      if (error) {
        toastError(error.message || 'Could not send message. Please ensure messaging tables exist.');
        // Restore input so user doesn't lose their text
        setMessageInput(textToSend);
      } else if (newMsg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        // Refresh conversations list in background to update preview & order
        loadConversations();
      }
    } catch (err: any) {
      toastError(err?.message || 'Failed to send message.');
      setMessageInput(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  // Helper formatting for timestamps
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Filter conversations list by search query
  const filteredConversations = conversations.filter((c) => {
    if (!convSearchQuery.trim()) return true;
    const clean = convSearchQuery.toLowerCase();
    const username = c.other_user?.username?.toLowerCase() || '';
    const displayName = c.other_user?.display_name?.toLowerCase() || '';
    return username.includes(clean) || displayName.includes(clean);
  });

  // ---------------------------------------------------------------------------
  // RENDER: Active Chat View (When a conversation is open)
  // ---------------------------------------------------------------------------
  if (activeConversation) {
    const counterpart = activeConversation.other_user;
    const username = counterpart?.username || 'user';
    const displayName = counterpart?.display_name || username;
    const avatarUrl = counterpart?.avatar_url;

    return (
      <div className="active-chat-viewport">
        {/* Chat Top Header */}
        <header className="chat-header-bar glass-panel">
          <button
            className="chat-back-btn icon-button"
            onClick={() => {
              setActiveConversation(null);
              loadConversations();
            }}
            aria-label="Back to conversations"
            title="Back to Inbox"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="chat-counterpart-info">
            <div className="chat-avatar-box">
              {avatarUrl ? (
                <img src={avatarUrl} alt={username} className="avatar-img-sm" />
              ) : (
                <div className="avatar-letter-sm">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="chat-titles">
              <div className="chat-title-badge-row flex items-center gap-1.5">
                <h3 className="chat-display-name">{displayName}</h3>
                <VerifiedAdminBadge userId={counterpart?.id} size="sm" showTooltip={true} />
              </div>
              <span className="chat-username">@{username}</span>
            </div>
          </div>
        </header>

        {/* Message Stream */}
        <div className="chat-messages-stream">
          {isLoadingMessages ? (
            <div className="chat-loading-state">
              <Loader2 size={26} className="spin text-gold mb-2" />
              <p className="text-secondary text-sm">Loading secure conversation...</p>
            </div>
          ) : messages.length > 0 ? (
            <div className="chat-messages-list">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`message-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                  >
                    <div className={`message-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                      <p className="message-text">{msg.body}</p>
                      <div className="message-meta-row">
                        <span className="message-timestamp">{formatTime(msg.created_at)}</span>
                        {isMine && (
                          <span className="message-check-icon">
                            {msg.is_read ? (
                              <CheckCheck size={13} className="text-gold" />
                            ) : (
                              <Check size={13} className="text-muted" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="chat-empty-convo">
              <div className="chat-sparkle-halo">
                <Star size={32} className="text-gold" />
              </div>
              <h4>Start the conversation</h4>
              <p className="text-secondary text-sm">
                Say hello to @{username}! Your private messages are stored securely in Brighter.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Message Input Bar */}
        <form className="chat-input-bar glass-panel" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input-field"
            placeholder={`Message @${username}... ✨`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={!user || isSending}
            maxLength={1000}
            autoFocus
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!messageInput.trim() || isSending}
            aria-label="Send message"
            title="Send"
          >
            {isSending ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: Conversations Inbox & Activity View
  // ---------------------------------------------------------------------------
  return (
    <div className="messages-inbox-container">
      {/* Top Header */}
      <header className="messages-header">
        <h2 className="messages-title">Direct Messages</h2>
        <div className="messages-subtabs">
          <button
            className={`subtab-btn ${activeTab === 'chats' ? 'active' : ''}`}
            onClick={() => setActiveTab('chats')}
          >
            <MessageSquare size={16} /> Chats
          </button>
          <button
            className={`subtab-btn ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <Bell size={16} /> Activity
          </button>
        </div>
      </header>

      {/* Primary Action Button: Start New Chat */}
      <div className="messages-action-bar">
        <button
          className="btn btn-primary btn-sm w-full flex-center gap-2"
          onClick={() => setIsNewChatOpen(true)}
          title="Search users and start a new conversation"
        >
          <UserPlus size={16} />
          <span>Start a New Chat</span>
        </button>
      </div>

      {/* Filter Search Bar for Existing Chats */}
      {activeTab === 'chats' && conversations.length > 0 && (
        <div className="messages-search-bar">
          <div className="search-input-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Filter conversations..."
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              className="search-input-field"
            />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="messages-content-area">
        {activeTab === 'chats' ? (
          isLoadingConversations ? (
            <div className="state-card-empty glass-card text-center py-8">
              <Loader2 size={28} className="spin text-gold mb-2" />
              <p className="text-secondary text-sm">Loading your chats...</p>
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="conversations-list">
              {filteredConversations.map((conv) => {
                const counterpart = conv.other_user;
                const username = counterpart?.username || 'user';
                const displayName = counterpart?.display_name || username;
                const avatarUrl = counterpart?.avatar_url;
                const lastMsg = conv.last_message || 'Started a new conversation';
                const timeString = formatTime(conv.last_message_at || conv.created_at);
                const unread = conv.unread_count || 0;

                return (
                  <div
                    key={conv.id}
                    className="conversation-item-card glass-card"
                    onClick={() => setActiveConversation(conv)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="conversation-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="avatar-img-sm" />
                      ) : (
                        <div className="avatar-letter-sm">
                          {username.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="conversation-details">
                      <div className="conversation-top-row">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="conversation-user-name font-semibold truncate">{displayName}</span>
                          <VerifiedAdminBadge userId={counterpart?.id} size="xs" showTooltip={false} />
                        </div>
                        <span className="conversation-timestamp">{timeString}</span>
                      </div>
                      <div className="conversation-bottom-row">
                        <p className="conversation-snippet truncate">{lastMsg}</p>
                        {unread > 0 && (
                          <span className="unread-count-pill">{unread}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="state-card-empty glass-card text-center py-8">
              <div className="star-ambient-pulse mb-3">
                <MessageSquare size={38} className="text-gold" />
              </div>
              <h3 className="text-primary font-bold">Your inbox is clear</h3>
              <p className="text-secondary text-sm mt-1 max-w-sm mx-auto">
                Connect with any creator on Brighter. Direct messages are private, real-time, and ad-free.
              </p>
              <button
                className="btn btn-secondary btn-sm mt-4"
                onClick={() => setIsNewChatOpen(true)}
              >
                <UserPlus size={15} /> Start a New Chat
              </button>
            </div>
          )
        ) : (
          /* Activity Feed Tab */
          <div className="state-card-empty glass-card text-center py-8">
            <div className="star-ambient-pulse mb-3">
              <Bell size={38} className="text-gold" />
            </div>
            <h3 className="text-primary font-bold">All caught up</h3>
            <p className="text-secondary text-sm mt-1 max-w-sm mx-auto">
              Likes, mentions, comments, and new followers on your sparks will be shown here.
            </p>
          </div>
        )}
      </div>

      {/* ======================================================================
          MODAL: Find Users and Start a New Chat
      ====================================================================== */}
      {isNewChatOpen && (
        <div className="modal-overlay" onClick={() => setIsNewChatOpen(false)}>
          <div
            className="modal-content glass-card new-chat-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <div className="icon-badge">
                  <UserPlus size={20} className="text-gold" />
                </div>
                <div>
                  <h3>Start a New Chat</h3>
                  <p className="modal-subtitle">Search registered creators on Brighter</p>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => setIsNewChatOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Search Input */}
            <div className="search-input-box mb-4">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Search by @username or display name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Results Area */}
            <div className="new-chat-results-list">
              {isSearchingUsers ? (
                <div className="text-center py-6">
                  <Loader2 size={24} className="spin text-gold mb-2" />
                  <p className="text-secondary text-sm">Searching registered users...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="user-matches-column">
                  {searchResults.map((targetUser) => (
                    <div
                      key={targetUser.id}
                      className="user-match-card glass-panel"
                      onClick={() => handleSelectUserToChat(targetUser)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="user-match-avatar">
                        {targetUser.avatar_url ? (
                          <img
                            src={targetUser.avatar_url}
                            alt={targetUser.username}
                            className="avatar-img-sm"
                          />
                        ) : (
                          <div className="avatar-letter-sm">
                            {(targetUser.display_name || targetUser.username || 'U')[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="user-match-info">
                        <div className="flex items-center gap-1.5">
                          <span className="user-match-display font-semibold">
                            {targetUser.display_name || targetUser.username}
                          </span>
                          <VerifiedAdminBadge userId={targetUser.id} size="xs" showTooltip={true} />
                        </div>
                        <span className="user-match-handle text-muted text-xs">
                          @{targetUser.username}
                        </span>
                      </div>

                      <button
                        className="btn btn-outline-gold btn-xs"
                        disabled={isStartingChat}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectUserToChat(targetUser);
                        }}
                      >
                        {isStartingChat ? <Loader2 size={12} className="spin" /> : 'Chat'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : hasSearchedUsers && searchQuery.trim() ? (
                <div className="text-center py-6">
                  <AlertCircle size={28} className="text-muted mb-2 mx-auto" />
                  <h4 className="font-semibold text-primary">No user found</h4>
                  <p className="text-secondary text-xs mt-1">
                    No registered account matches "{searchQuery}". Check the username spelling.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-muted text-sm">
                  <Star size={24} className="text-gold mb-2 mx-auto" />
                  <p>Type any username above to find someone to chat with.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
