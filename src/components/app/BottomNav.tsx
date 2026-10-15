import React from 'react';
import { Home, Search, Plus, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 'home' | 'search' | 'create' | 'messages' | 'profile';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenCreate: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreate,
}) => {
  const { profile, user } = useAuth();
  const avatarUrl = profile?.avatar_url;
  const initial = (profile?.display_name || profile?.username || user?.email || 'U')[0].toUpperCase();

  return (
    <nav className="bottom-nav-container" aria-label="Mobile Navigation">
      <button
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onSelectTab('home')}
        aria-label="Home Feed"
      >
        <Home size={22} className="nav-icon" />
        <span className="nav-label">Home</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
        onClick={() => onSelectTab('search')}
        aria-label="Discover"
      >
        <Search size={22} className="nav-icon" />
        <span className="nav-label">Discover</span>
      </button>

      {/* Center Standout Plus Button */}
      <button
        className="nav-item-create-button"
        onClick={onOpenCreate}
        aria-label="Create New Spark"
        title="Create New Spark"
      >
        <div className="create-button-halo">
          <div className="create-button-inner">
            <Plus size={22} strokeWidth={2.8} />
          </div>
        </div>
      </button>

      <button
        className={`nav-item ${activeTab === 'messages' ? 'active' : ''}`}
        onClick={() => onSelectTab('messages')}
        aria-label="Messages"
      >
        <MessageSquare size={22} className="nav-icon" />
        <span className="nav-label">Inbox</span>
      </button>

      <button
        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectTab('profile')}
        aria-label="Profile"
      >
        <div className={`nav-avatar-ring ${activeTab === 'profile' ? 'ring-active' : ''}`}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="nav-mini-avatar" />
          ) : (
            <span className="nav-mini-initial">{initial}</span>
          )}
        </div>
        <span className="nav-label">Profile</span>
      </button>
    </nav>
  );
};
