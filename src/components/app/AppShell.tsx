import React, { useState } from 'react';
import { HomeFeed } from './HomeFeed';
import { SearchDiscover } from './SearchDiscover';
import { MessagesInbox } from './MessagesInbox';
import { UserProfile } from './UserProfile';
import { BottomNav, type NavTab } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { CreatePostModal } from './CreatePostModal';
import { SupabaseConfigModal } from '../common/SupabaseConfigModal';
import { AdminDashboardModal } from './AdminDashboardModal';
import { StarfieldBackground } from '../common/StarfieldBackground';
import { PostViewerModal } from './PostViewerModal';

export const AppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [targetChatUserId, setTargetChatUserId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [sharedPostId, setSharedPostId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('post');
    }
    return null;
  });

  const handleSelectTab = (tab: NavTab) => {
    if (tab === 'profile') {
      // Clear target profile to view own profile
      setViewingProfileId(null);
    }
    setActiveTab(tab);
  };

  return (
    <div className="app-shell-container">
      <StarfieldBackground density={25} speed={0.2} />

      {/* Desktop Sidebar (hidden on mobile) */}
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenAdmin={() => setIsAdminOpen(true)}
      />

      {/* Main Viewport Container */}
      <div className="app-main-content">
        <div className="app-viewport-inner">
          {activeTab === 'home' && (
            <HomeFeed
              onOpenCreate={() => setIsCreateOpen(true)}
              onGoToSearch={() => setActiveTab('search')}
              onSelectCreator={(creatorId) => {
                setViewingProfileId(creatorId);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'search' && (
            <SearchDiscover
              onSelectCreator={(creator) => {
                setViewingProfileId(creator.id);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesInbox
              initialTargetUserId={targetChatUserId}
              onClearInitialTarget={() => setTargetChatUserId(null)}
            />
          )}

          {activeTab === 'profile' && (
            <UserProfile
              targetUserId={viewingProfileId || undefined}
              onBack={() => {
                setViewingProfileId(null);
                setActiveTab('search');
              }}
              onOpenCreate={() => setIsCreateOpen(true)}
              onMessageUser={(creatorId) => {
                setTargetChatUserId(creatorId);
                setActiveTab('messages');
              }}
              onOpenAdmin={() => setIsAdminOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation (fixed at bottom, hidden on desktop) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {/* Modals */}
      <CreatePostModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <SupabaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <AdminDashboardModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* Shared Post Viewer */}
      {sharedPostId && (
        <PostViewerModal
          postId={sharedPostId}
          onClose={() => {
            setSharedPostId(null);
            if (typeof window !== 'undefined' && window.history?.replaceState) {
              const url = new URL(window.location.href);
              url.searchParams.delete('post');
              window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
            }
          }}
          onSelectCreator={(creatorId) => {
            setSharedPostId(null);
            setViewingProfileId(creatorId);
            setActiveTab('profile');
          }}
        />
      )}
    </div>
  );
};
