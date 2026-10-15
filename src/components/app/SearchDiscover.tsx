import React, { useState, useEffect } from 'react';
import { Search, X, Hash, TrendingUp, Star, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { getSupabase, isSupabaseReady } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import { VerifiedAdminBadge } from '../common/VerifiedAdminBadge';

interface SearchDiscoverProps {
  onSelectCreator?: (profile: Profile) => void;
}

export const SearchDiscover: React.FC<SearchDiscoverProps> = ({ onSelectCreator }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const trendingTags = [
    { tag: 'shivsapra', count: '232 views' },
    { tag: 'brighter', count: '232 views' },
  ];

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const handler = setTimeout(async () => {
      if (!isSupabaseReady()) {
        setSearchError('Supabase is not connected. Configure credentials to search real profiles.');
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearched(true);
      setSearchError(null);

      try {
        const client = getSupabase();
        const clean = query.trim().toLowerCase().replace('@', '');

        const { data, error } = await client
          .from('profiles')
          .select('*')
          .ilike('username', `%${clean}%`)
          .limit(25);

        if (error) {
          console.error('Search error:', error);
          setSearchError(error.message);
          setResults([]);
        } else {
          setResults((data as Profile[]) || []);
        }
      } catch (err: any) {
        console.error('Search query exception:', err);
        setSearchError(err?.message || 'Failed to search users.');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [query]);

  return (
    <div className="search-discover-container">
      {/* Top Search Bar */}
      <div className="search-header">
        <div className="search-input-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search creators by @username or display name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input-field"
            autoFocus={false}
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="search-content-area">
        {/* Loading Spinner */}
        {isSearching && (
          <div className="search-loading-state text-center py-6">
            <Loader2 size={24} className="spin text-gold" />
            <p className="text-secondary text-sm mt-2">Searching registered creators...</p>
          </div>
        )}

        {/* Error State */}
        {!isSearching && searchError && (
          <div className="state-card-empty glass-card text-center py-6 border-danger">
            <AlertCircle size={30} className="text-danger mb-2" />
            <h4 className="text-primary font-semibold">Search query failed</h4>
            <p className="text-secondary text-sm mt-1">{searchError}</p>
          </div>
        )}

        {/* Live Search Results */}
        {!isSearching && searched && !searchError && (
          <div className="search-results-section">
            <h3 className="section-title">
              Creators Found ({results.length})
            </h3>
            {results.length > 0 ? (
              <div className="creators-list">
                {results.map((creator) => (
                  <div
                    key={creator.id}
                    className="creator-card glass-card"
                    onClick={() => onSelectCreator?.(creator)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="creator-avatar">
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt={creator.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {(creator.display_name || creator.username || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="creator-info">
                      <div className="creator-names">
                        <span className="creator-display-name flex items-center gap-1">
                          <span>{creator.display_name || creator.username}</span>
                          <VerifiedAdminBadge userId={creator.id} size="xs" />
                        </span>
                        <span className="creator-username">@{creator.username}</span>
                      </div>
                      {creator.bio && (
                        <p className="creator-bio-snippet">{creator.bio}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-gold flex-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCreator?.(creator);
                      }}
                    >
                      <span>View</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="state-card-empty glass-card text-center py-6">
                <Star size={32} className="text-muted mb-2" />
                <h4 className="text-primary font-semibold">No creators found</h4>
                <p className="text-secondary text-sm mt-1">
                  We couldn't find anyone registered as "{query}". Try checking the spelling or searching another name.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Trending Tags Section (shown when no query is typed) */}
        {!searched && !isSearching && (
          <>
            <div className="trending-section">
              <h3 className="section-title flex-center gap-2">
                <TrendingUp size={18} className="text-gold" /> Trending on Brighter
              </h3>
              <div className="trending-tags-grid">
                {trendingTags.map((item) => (
                  <button
                    key={item.tag}
                    className="trending-card glass-card"
                    onClick={() => setQuery(item.tag)}
                  >
                    <div className="trending-icon-box">
                      <Hash size={18} className="text-gold" />
                    </div>
                    <div className="trending-info">
                      <span className="trending-name">#{item.tag}</span>
                      <span className="trending-count">({item.count})</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="discover-explore-card glass-card mt-5">
              <div className="starlight-mini-orb">
                <Star size={24} className="text-gold" />
              </div>
              <h4 className="text-primary font-bold">Discover Real Community</h4>
              <p className="text-secondary text-sm mt-1">
                Type any username above to find registered creators and connect with authentic profiles on Brighter.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
