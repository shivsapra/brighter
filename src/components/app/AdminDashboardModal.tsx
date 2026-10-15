import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  X,
  Users,
  FileText,
  AlertTriangle,
  Megaphone,
  MessageSquare,
  Activity,
  Settings,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  XCircle,
  UserCheck,
  UserX,
  Clock,
  Star,
  Loader2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchAdminStats,
  fetchAdminUsers,
  adminToggleUserSuspension,
  fetchAdminPosts,
  adminTogglePostVisibility,
  adminDeletePost,
  fetchAdminReports,
  adminResolveReport,
  fetchAnnouncements,
  adminCreateAnnouncement,
  adminToggleAnnouncement,
  adminDeleteAnnouncement,
  fetchAdminComments,
  adminDeleteComment,
  fetchAdminAuditLogs,
} from '../../lib/supabase';
import type {
  AdminOverviewStats,
  Profile,
  Post,
  AdminReport,
  Announcement,
  Comment,
  AdminAuditLog,
} from '../../types/database';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';

type AdminTab = 'overview' | 'users' | 'posts' | 'reports' | 'announcements' | 'comments' | 'audit' | 'settings';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({ isOpen, onClose }) => {
  const { user, profile } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isLoading, setIsLoading] = useState(false);

  // Overview Stats
  const [stats, setStats] = useState<AdminOverviewStats>({
    usersCount: 0,
    postsCount: 0,
    photosCount: 0,
    videosCount: 0,
    reportsCount: 0,
    pendingReportsCount: 0,
    announcementsCount: 0,
  });

  // Users State
  const [usersList, setUsersList] = useState<Profile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isProcessingUser, setIsProcessingUser] = useState<string | null>(null);

  // Posts State
  const [postsList, setPostsList] = useState<Post[]>([]);
  const [postFilter, setPostFilter] = useState<'all' | 'hidden' | 'visible'>('all');
  const [isProcessingPost, setIsProcessingPost] = useState<string | null>(null);

  // Reports State
  const [reportsList, setReportsList] = useState<AdminReport[]>([]);
  const [isProcessingReport, setIsProcessingReport] = useState<string | null>(null);

  // Announcements State
  const [announcementsList, setAnnouncementsList] = useState<Announcement[]>([]);
  const [newAnnounceTitle, setNewAnnounceTitle] = useState('');
  const [newAnnounceBody, setNewAnnounceBody] = useState('');
  const [newAnnouncePriority, setNewAnnouncePriority] = useState<'low' | 'normal' | 'urgent' | 'pinned'>('normal');
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);

  // Comments State
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [isProcessingComment, setIsProcessingComment] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Settings State
  const [moderationLevel, setModerationLevel] = useState<'standard' | 'strict'>('standard');
  const [autoFlagSpam, setAutoFlagSpam] = useState(true);

  // ---------------------------------------------------------------------------
  // Load Tab Data
  // ---------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'overview') {
        const s = await fetchAdminStats();
        setStats(s);
        const logs = await fetchAdminAuditLogs();
        setAuditLogs(logs.slice(0, 5));
      } else if (activeTab === 'users') {
        const users = await fetchAdminUsers(userSearchQuery);
        setUsersList(users);
      } else if (activeTab === 'posts') {
        const posts = await fetchAdminPosts(postFilter);
        setPostsList(posts);
      } else if (activeTab === 'reports') {
        const reports = await fetchAdminReports();
        setReportsList(reports);
      } else if (activeTab === 'announcements') {
        const ann = await fetchAnnouncements(false);
        setAnnouncementsList(ann);
      } else if (activeTab === 'comments') {
        const comm = await fetchAdminComments();
        setCommentsList(comm);
      } else if (activeTab === 'audit') {
        const logs = await fetchAdminAuditLogs();
        setAuditLogs(logs);
      }
    } catch (err: any) {
      console.warn('[Admin Dashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, userSearchQuery, postFilter]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  const handleToggleUserSuspension = async (targetUser: Profile) => {
    if (!user) return;
    const isCurrentlySuspended = Boolean(targetUser.is_suspended);
    const actionName = isCurrentlySuspended ? 'restore' : 'suspend';

    if (!window.confirm(`Are you sure you want to ${actionName} @${targetUser.username}?`)) {
      return;
    }

    setIsProcessingUser(targetUser.id);
    const { success, error } = await adminToggleUserSuspension(
      user.id,
      targetUser.id,
      !isCurrentlySuspended,
      isCurrentlySuspended ? undefined : 'Violations of community guidelines'
    );

    setIsProcessingUser(null);
    if (success) {
      toastSuccess(`@${targetUser.username} successfully ${isCurrentlySuspended ? 'restored' : 'suspended'}.`);
      loadData();
    } else {
      toastError(error || 'Failed to update user status.');
    }
  };

  const handleTogglePostVisibility = async (p: Post) => {
    if (!user) return;
    const willHide = !p.is_hidden;
    setIsProcessingPost(p.id);

    const { success, error } = await adminTogglePostVisibility(user.id, p.id, willHide);
    setIsProcessingPost(null);

    if (success) {
      toastSuccess(`Post ${willHide ? 'hidden from feed' : 'restored to feed'}.`);
      loadData();
    } else {
      toastError(error || 'Failed to update post.');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    if (!window.confirm('Delete this post permanently? This action cannot be undone.')) {
      return;
    }

    setIsProcessingPost(postId);
    const { success, error } = await adminDeletePost(user.id, postId);
    setIsProcessingPost(null);

    if (success) {
      toastSuccess('Post permanently deleted by admin.');
      loadData();
    } else {
      toastError(error || 'Failed to delete post.');
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    if (!user) return;
    setIsProcessingReport(reportId);

    const { success, error } = await adminResolveReport(
      user.id,
      reportId,
      status,
      status === 'resolved' ? 'Reviewed and actioned by admin' : 'Dismissed as invalid'
    );
    setIsProcessingReport(null);

    if (success) {
      toastSuccess(`Report marked as ${status}.`);
      loadData();
    } else {
      toastError(error || 'Failed to update report.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAnnounceTitle.trim() || !newAnnounceBody.trim() || isSubmittingAnnouncement) return;

    setIsSubmittingAnnouncement(true);
    const { data, error } = await adminCreateAnnouncement(
      user.id,
      newAnnounceTitle.trim(),
      newAnnounceBody.trim(),
      newAnnouncePriority
    );
    setIsSubmittingAnnouncement(false);

    if (data) {
      toastSuccess('Official announcement published to users!');
      setNewAnnounceTitle('');
      setNewAnnounceBody('');
      loadData();
    } else {
      toastError(error || 'Failed to publish announcement.');
    }
  };

  const handleToggleAnnouncement = async (ann: Announcement) => {
    if (!user) return;
    const { success, error } = await adminToggleAnnouncement(user.id, ann.id, !ann.is_active);
    if (success) {
      toastSuccess(`Announcement ${!ann.is_active ? 'activated' : 'deactivated'}.`);
      loadData();
    } else {
      toastError(error || 'Failed to update announcement.');
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    if (!user) return;
    if (!window.confirm('Remove this announcement?')) return;
    const { success, error } = await adminDeleteAnnouncement(user.id, annId);
    if (success) {
      toastSuccess('Announcement removed.');
      loadData();
    } else {
      toastError(error || 'Failed to remove announcement.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    if (!window.confirm('Delete this comment permanently?')) return;

    setIsProcessingComment(commentId);
    const { success, error } = await adminDeleteComment(user.id, commentId);
    setIsProcessingComment(null);

    if (success) {
      toastSuccess('Comment deleted by admin.');
      loadData();
    } else {
      toastError(error || 'Failed to delete comment.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-card admin-dashboard-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Brighter Administrator Panel"
      >
        {/* Top Header */}
        <header className="admin-header-bar">
          <div className="admin-title-row">
            <div className="admin-icon-halo">
              <ShieldCheck size={22} className="text-gold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="admin-brand-title">Brighter Control Center</h2>
                <VerifiedAdminBadge userId={user?.id} size="sm" showLabel={true} />
              </div>
              <p className="admin-subtitle">Secure Platform Governance & Live Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="icon-button"
              onClick={() => loadData()}
              disabled={isLoading}
              title="Refresh Live Data"
              aria-label="Refresh Live Data"
            >
              <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
            </button>
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close Admin Dashboard"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Navigation Tabs */}
        <nav className="admin-nav-tabs" aria-label="Admin Navigation Tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Activity size={15} /> Overview
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={15} /> Users
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <FileText size={15} /> Posts
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <AlertTriangle size={15} /> Reports
            {stats.pendingReportsCount > 0 && (
              <span className="admin-tab-badge">{stats.pendingReportsCount}</span>
            )}
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'announcements' ? 'active' : ''}`}
            onClick={() => setActiveTab('announcements')}
          >
            <Megaphone size={15} /> Announcements
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <MessageSquare size={15} /> Comments
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <Clock size={15} /> Audit Log
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={15} /> Settings
          </button>
        </nav>

        {/* Dashboard Content Viewport */}
        <div className="admin-body-viewport">
          {isLoading ? (
            <div className="admin-loading-state">
              <Loader2 size={32} className="spin text-gold mb-2" />
              <p className="text-secondary text-sm">Querying Supabase records...</p>
            </div>
          ) : (
            <>
              {/* -------------------------------------------------------------
                  1. OVERVIEW TAB
              ------------------------------------------------------------- */}
              {activeTab === 'overview' && (
                <div className="admin-tab-content">
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card glass-panel">
                      <div className="stat-card-icon text-gold">
                        <Users size={22} />
                      </div>
                      <div className="stat-card-numbers">
                        <span className="stat-value">{stats.usersCount}</span>
                        <span className="stat-label">Registered Creators</span>
                      </div>
                    </div>

                    <div className="admin-stat-card glass-panel">
                      <div className="stat-card-icon text-gold">
                        <FileText size={22} />
                      </div>
                      <div className="stat-card-numbers">
                        <span className="stat-value">{stats.postsCount}</span>
                        <span className="stat-label">Total Sparks ({stats.photosCount} photos · {stats.videosCount} videos)</span>
                      </div>
                    </div>

                    <div className="admin-stat-card glass-panel">
                      <div className="stat-card-icon text-gold">
                        <AlertTriangle size={22} />
                      </div>
                      <div className="stat-card-numbers">
                        <span className="stat-value">{stats.pendingReportsCount}</span>
                        <span className="stat-label">Pending Reports ({stats.reportsCount} total)</span>
                      </div>
                    </div>

                    <div className="admin-stat-card glass-panel">
                      <div className="stat-card-icon text-gold">
                        <Megaphone size={22} />
                      </div>
                      <div className="stat-card-numbers">
                        <span className="stat-value">{stats.announcementsCount}</span>
                        <span className="stat-label">Official Announcements</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity / Audit Overview */}
                  <div className="admin-section-box mt-4">
                    <h3 className="admin-section-title">
                      <Activity size={16} className="text-gold" /> Recent Administrative Activity
                    </h3>
                    {auditLogs.length > 0 ? (
                      <div className="admin-audit-mini-list">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="admin-audit-item glass-panel">
                            <span className="audit-action-tag">{log.action}</span>
                            <span className="audit-target-text">
                              Target: {log.target_type} ({log.target_id?.substring(0, 8)}...)
                            </span>
                            <span className="audit-time-text">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted text-xs py-3">No administrative actions logged yet today.</p>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  2. USER MANAGEMENT TAB
              ------------------------------------------------------------- */}
              {activeTab === 'users' && (
                <div className="admin-tab-content">
                  <div className="admin-filter-bar">
                    <div className="search-input-box w-full">
                      <Search size={16} className="search-icon" />
                      <input
                        type="text"
                        placeholder="Search creators by username..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="search-input-field"
                      />
                    </div>
                  </div>

                  <div className="admin-table-container glass-panel mt-3">
                    {usersList.length > 0 ? (
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Creator</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th className="text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList.map((u) => {
                            const isSuspended = Boolean(u.is_suspended);
                            return (
                              <tr key={u.id}>
                                <td>
                                  <div className="flex items-center gap-2">
                                    <div className="admin-user-avatar">
                                      {u.avatar_url ? (
                                        <img src={u.avatar_url} alt={u.username} />
                                      ) : (
                                        <span>{(u.display_name || u.username)[0].toUpperCase()}</span>
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1 font-semibold text-primary">
                                        <span>{u.display_name || u.username}</span>
                                        <VerifiedAdminBadge userId={u.id} size="xs" />
                                      </div>
                                      <span className="text-xs text-muted">@{u.username}</span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {isSuspended ? (
                                    <span className="badge-suspended">Suspended</span>
                                  ) : (
                                    <span className="badge-active">Active</span>
                                  )}
                                </td>
                                <td className="text-xs text-muted">
                                  {new Date(u.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="text-right">
                                  <button
                                    className={`btn btn-xs ${isSuspended ? 'btn-outline-gold' : 'btn-danger'}`}
                                    onClick={() => handleToggleUserSuspension(u)}
                                    disabled={isProcessingUser === u.id || u.username === 'brighter'}
                                    title={u.username === 'brighter' ? 'Root admin cannot be suspended' : undefined}
                                  >
                                    {isProcessingUser === u.id ? (
                                      <Loader2 size={12} className="spin" />
                                    ) : isSuspended ? (
                                      <>
                                        <UserCheck size={12} /> Restore
                                      </>
                                    ) : (
                                      <>
                                        <UserX size={12} /> Suspend
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-center py-6 text-muted text-sm">No creators found matching criteria.</p>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  3. POSTS MODERATION TAB
              ------------------------------------------------------------- */}
              {activeTab === 'posts' && (
                <div className="admin-tab-content">
                  <div className="admin-subfilters">
                    <button
                      className={`subfilter-pill ${postFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setPostFilter('all')}
                    >
                      All Sparks
                    </button>
                    <button
                      className={`subfilter-pill ${postFilter === 'visible' ? 'active' : ''}`}
                      onClick={() => setPostFilter('visible')}
                    >
                      Visible
                    </button>
                    <button
                      className={`subfilter-pill ${postFilter === 'hidden' ? 'active' : ''}`}
                      onClick={() => setPostFilter('hidden')}
                    >
                      Hidden / Flagged
                    </button>
                  </div>

                  <div className="admin-items-grid mt-3">
                    {postsList.length > 0 ? (
                      postsList.map((p) => (
                        <div key={p.id} className="admin-post-card glass-panel">
                          <div className="admin-post-media-box">
                            {p.media_url ? (
                              p.media_type === 'video' ? (
                                <video src={`${p.media_url}#t=0.001`} preload="none" className="admin-media-thumb" />
                              ) : (
                                <img src={p.media_url} alt={p.caption || 'Post'} loading="lazy" decoding="async" className="admin-media-thumb" />
                              )
                            ) : (
                              <div className="admin-media-placeholder">Text Only</div>
                            )}
                            {p.is_hidden && <span className="badge-hidden-overlay">Hidden</span>}
                          </div>

                          <div className="admin-post-info">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-primary">
                                @{p.profiles?.username || 'user'}
                              </span>
                              <span className="text-muted text-xs">
                                {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="admin-post-caption truncate mt-1">
                              {p.caption || 'No caption'}
                            </p>

                            <div className="admin-post-actions mt-2">
                              <button
                                className="btn btn-secondary btn-xs flex-1"
                                onClick={() => handleTogglePostVisibility(p)}
                                disabled={isProcessingPost === p.id}
                              >
                                {p.is_hidden ? (
                                  <>
                                    <Eye size={12} /> Restore
                                  </>
                                ) : (
                                  <>
                                    <EyeOff size={12} /> Hide
                                  </>
                                )}
                              </button>
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={() => handleDeletePost(p.id)}
                                disabled={isProcessingPost === p.id}
                                title="Delete permanently"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-6 text-muted text-sm col-span-full">No posts found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  4. REPORTS TAB
              ------------------------------------------------------------- */}
              {activeTab === 'reports' && (
                <div className="admin-tab-content">
                  <div className="admin-reports-column">
                    {reportsList.length > 0 ? (
                      reportsList.map((r) => (
                        <div key={r.id} className="admin-report-card glass-panel">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`report-status-badge ${r.status}`}>
                                {r.status.toUpperCase()}
                              </span>
                              <span className="report-type-badge">
                                Target: {r.target_type}
                              </span>
                            </div>
                            <span className="text-xs text-muted">
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="report-details-body mt-2">
                            <p className="report-reason font-semibold text-primary text-sm">
                              Reason: {r.reason}
                            </p>
                            {r.details && (
                              <p className="report-extra text-secondary text-xs mt-1">
                                "{r.details}"
                              </p>
                            )}
                            <p className="report-meta-text text-muted text-xs mt-1">
                              Reported by @{r.reporter?.username || 'anonymous'} · Target ID: {r.target_id}
                            </p>
                          </div>

                          {r.status === 'pending' ? (
                            <div className="admin-report-actions mt-3">
                              <button
                                className="btn btn-primary btn-xs flex-1"
                                onClick={() => handleResolveReport(r.id, 'resolved')}
                                disabled={isProcessingReport === r.id}
                              >
                                <CheckCircle size={13} /> Take Action & Resolve
                              </button>
                              <button
                                className="btn btn-secondary btn-xs flex-1"
                                onClick={() => handleResolveReport(r.id, 'dismissed')}
                                disabled={isProcessingReport === r.id}
                              >
                                <XCircle size={13} /> Dismiss Report
                              </button>
                            </div>
                          ) : (
                            <div className="report-resolution-box mt-2 text-xs text-muted">
                              Decision: {r.action_taken || 'Processed'}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted text-sm glass-panel">
                        <CheckCircle size={28} className="text-gold mb-2 mx-auto" />
                        <p className="font-semibold text-primary">All Reports Cleared</p>
                        <p className="text-xs text-secondary mt-1">No pending content or creator flags.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  5. OFFICIAL ANNOUNCEMENTS TAB
              ------------------------------------------------------------- */}
              {activeTab === 'announcements' && (
                <div className="admin-tab-content">
                  {/* Create Announcement Form */}
                  <form className="admin-create-announcement-form glass-panel mb-4" onSubmit={handleCreateAnnouncement}>
                    <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                      <Star size={16} className="text-gold" /> Broadcast Official Announcement
                    </h3>

                    <input
                      type="text"
                      className="chat-input-field w-full mb-2"
                      placeholder="Announcement Title (e.g., Welcome to Brighter 2.0 ✨)"
                      value={newAnnounceTitle}
                      onChange={(e) => setNewAnnounceTitle(e.target.value)}
                      required
                    />

                    <textarea
                      className="chat-input-field w-full mb-2"
                      placeholder="Official announcement message body displayed in feeds..."
                      rows={3}
                      value={newAnnounceBody}
                      onChange={(e) => setNewAnnounceBody(e.target.value)}
                      required
                    />

                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-secondary">Priority:</label>
                        <select
                          className="admin-select-input"
                          value={newAnnouncePriority}
                          onChange={(e: any) => setNewAnnouncePriority(e.target.value)}
                        >
                          <option value="normal">Normal</option>
                          <option value="pinned">Pinned (Feed Top)</option>
                          <option value="urgent">Urgent</option>
                          <option value="low">Low</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isSubmittingAnnouncement || !newAnnounceTitle.trim()}
                      >
                        {isSubmittingAnnouncement ? <Loader2 size={14} className="spin" /> : 'Publish Announcement'}
                      </button>
                    </div>
                  </form>

                  {/* Announcement List */}
                  <div className="announcements-admin-list">
                    {announcementsList.map((ann) => (
                      <div key={ann.id} className="announcement-item-card glass-panel">
                        <div className="flex items-center justify-between">
                          <span className="announcement-badge-tag">{ann.badge_tag}</span>
                          <span className="text-xs text-muted">
                            {new Date(ann.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <h4 className="font-bold text-primary mt-1">{ann.title}</h4>
                        <p className="text-secondary text-sm mt-1">{ann.body}</p>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-glass">
                          <span className={`text-xs ${ann.is_active ? 'text-success' : 'text-muted'}`}>
                            {ann.is_active ? '● Broadcast Active' : '○ Inactive'}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              className="btn btn-secondary btn-xs"
                              onClick={() => handleToggleAnnouncement(ann)}
                            >
                              {ann.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  6. COMMENTS MODERATION TAB
              ------------------------------------------------------------- */}
              {activeTab === 'comments' && (
                <div className="admin-tab-content">
                  <div className="admin-comments-list">
                    {commentsList.length > 0 ? (
                      commentsList.map((c) => (
                        <div key={c.id} className="admin-comment-card glass-panel">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                              <span>@{c.profiles?.username || 'user'}</span>
                              <VerifiedAdminBadge userId={c.user_id} size="xs" />
                            </div>
                            <span className="text-xs text-muted">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <p className="admin-comment-text text-sm text-secondary mt-1">"{c.body}"</p>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-glass">
                            <span className="text-xs text-muted">Post ID: {c.post_id.substring(0, 8)}...</span>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => handleDeleteComment(c.id)}
                              disabled={isProcessingComment === c.id}
                            >
                              <Trash2 size={12} /> Remove Comment
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-6 text-muted text-sm">No comments to display.</p>
                    )}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  7. AUDIT LOG TAB
              ------------------------------------------------------------- */}
              {activeTab === 'audit' && (
                <div className="admin-tab-content">
                  <div className="admin-audit-table-wrap glass-panel">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Admin</th>
                          <th>Action</th>
                          <th>Target</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length > 0 ? (
                          auditLogs.map((log) => (
                            <tr key={log.id}>
                              <td className="font-semibold text-xs text-primary">
                                @{log.admin?.username || 'admin'}
                              </td>
                              <td>
                                <span className="audit-action-pill">{log.action}</span>
                              </td>
                              <td className="text-xs text-muted">
                                {log.target_type} ({log.target_id?.substring(0, 8) || '-'})
                              </td>
                              <td className="text-xs text-muted">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="text-center py-6 text-muted text-sm">
                              No security audit events recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  8. SETTINGS TAB
              ------------------------------------------------------------- */}
              {activeTab === 'settings' && (
                <div className="admin-tab-content">
                  <div className="admin-settings-card glass-panel mb-3">
                    <h4 className="font-bold text-sm text-primary mb-1 flex items-center gap-1.5">
                      <Lock size={15} className="text-gold" /> Platform Governance Standards
                    </h4>
                    <p className="text-xs text-secondary mb-3">
                      Configure safety automation thresholds. Administrative actions are sealed in the immutable audit log.
                    </p>

                    <div className="setting-toggle-row">
                      <div>
                        <span className="font-semibold text-xs text-primary block">Automatic Spam & Keyword Filtering</span>
                        <span className="text-xs text-muted">Auto-route flagged comments to pending moderation list</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoFlagSpam}
                        onChange={(e) => setAutoFlagSpam(e.target.checked)}
                      />
                    </div>

                    <div className="setting-toggle-row mt-3">
                      <div>
                        <span className="font-semibold text-xs text-primary block">Moderation Strictness</span>
                        <span className="text-xs text-muted">Filter sensitivity for user-generated media</span>
                      </div>
                      <select
                        className="admin-select-input"
                        value={moderationLevel}
                        onChange={(e: any) => setModerationLevel(e.target.value)}
                      >
                        <option value="standard">Standard (Safe Community)</option>
                        <option value="strict">Strict (Pre-moderation)</option>
                      </select>
                    </div>
                  </div>

                  <div className="admin-settings-card glass-panel">
                    <h4 className="font-bold text-sm text-primary mb-1 flex items-center gap-1.5">
                      <ShieldCheck size={15} className="text-gold" /> Verified Role Credentials
                    </h4>
                    <p className="text-xs text-secondary">
                      Active Superadmin Account: <strong className="text-gold">@{profile?.username}</strong>
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Authenticated UUID: <code className="text-xs">{user?.id}</code>
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
