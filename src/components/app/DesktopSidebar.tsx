import { Home, Search, Plus, MessageSquare, User, LogOut, Sun, Moon, ShieldCheck } from 'lucide-react';
import { BrighterLogo } from '../common/BrighterLogo';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';
import type { NavTab } from './BottomNav';
import { useAuth } from '../../context/AuthContext';
import { useAdmin } from '../../context/AdminContext';
import { useTheme } from '../../context/ThemeContext';

interface DesktopSidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenCreate: () => void;
  onOpenConfig?: () => void;
  onOpenAdmin?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreate,
  onOpenAdmin,
}) => {
  const { profile, user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { theme, toggleTheme } = useTheme();

  const username = profile?.username || user?.user_metadata?.username || 'user';
  const displayName = profile?.display_name || user?.user_metadata?.display_name || username;
  const avatarUrl = profile?.avatar_url;
  const initial = displayName[0].toUpperCase();

  return (
    <aside className="desktop-sidebar glass-card" aria-label="Desktop Navigation">
      {/* Brand Header */}
      <div className="sidebar-brand-wrapper">
        <BrighterLogo size="md" showText={true} withGlow={true} />
      </div>

      {/* Main Nav Items */}
      <nav className="sidebar-nav-list">
        <button
          className={`sidebar-nav-link ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => onSelectTab('home')}
        >
          <Home size={20} />
          <span>Home</span>
        </button>

        <button
          className={`sidebar-nav-link ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => onSelectTab('search')}
        >
          <Search size={20} />
          <span>Discover</span>
        </button>

        <button
          className={`sidebar-nav-link ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => onSelectTab('messages')}
        >
          <MessageSquare size={20} />
          <span>Inbox</span>
        </button>

        <button
          className={`sidebar-nav-link ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => onSelectTab('profile')}
        >
          <User size={20} />
          <span>Profile</span>
        </button>

        {isAdmin && (
          <button
            className="sidebar-nav-link sidebar-admin-btn"
            onClick={onOpenAdmin}
            title="Open Admin Dashboard"
          >
            <ShieldCheck size={20} className="text-gold" />
            <div className="flex items-center justify-between flex-1">
              <span>Admin Panel</span>
              <span className="admin-staff-pill">ADMIN</span>
            </div>
          </button>
        )}
      </nav>

      {/* Create Button */}
      <div className="sidebar-create-container">
        <button className="btn btn-primary w-full sidebar-create-btn" onClick={onOpenCreate}>
          <Plus size={18} strokeWidth={2.5} />
          <span>Post Spark</span>
        </button>
      </div>

      {/* Footer / Account & Settings */}
      <div className="sidebar-footer">
        <div
          className="sidebar-user-card"
          onClick={() => onSelectTab('profile')}
          title="Go to profile"
        >
          <div className="sidebar-user-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="sidebar-user-info truncate">
            <div className="flex items-center gap-1">
              <span className="sidebar-user-name truncate">{displayName}</span>
              <VerifiedAdminBadge userId={user?.id} size="xs" showTooltip={true} />
            </div>
            <span className="sidebar-user-handle truncate">@{username}</span>
          </div>
        </div>

        <div className="sidebar-utility-row">
          <button
            className="sidebar-tool-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            className="sidebar-tool-btn text-danger"
            onClick={() => signOut()}
            title="Log Out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
};
