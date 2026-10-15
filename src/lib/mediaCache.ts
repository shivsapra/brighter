/**
 * In-memory High-Performance Media Cache for Brighter
 * Accelerates image & video rendering, eliminates flickering, and provides instant previews.
 */

class MediaCacheManager {
  private loadedUrls = new Set<string>();
  private preloadedImages = new Map<string, HTMLImageElement>();
  private posterCache = new Map<string, string>();

  /**
   * Check if an image/video has already loaded in this session
   */
  isLoaded(url: string | null | undefined): boolean {
    if (!url) return false;
    return this.loadedUrls.has(url);
  }

  /**
   * Mark a media URL as loaded
   */
  markLoaded(url: string | null | undefined): void {
    if (!url) return;
    this.loadedUrls.add(url);
    // Keep bounded to 500 items to prevent memory bloat
    if (this.loadedUrls.size > 500) {
      const first = this.loadedUrls.values().next().value;
      if (first) this.loadedUrls.delete(first);
    }
  }

  /**
   * Preload an image silently in the background and retain decoded bitmap
   */
  preloadImage(url: string | null | undefined): void {
    if (!url || typeof window === 'undefined' || this.loadedUrls.has(url)) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.onload = () => {
      this.markLoaded(url);
      this.preloadedImages.set(url, img);
      if (this.preloadedImages.size > 60) {
        const first = this.preloadedImages.keys().next().value;
        if (first) this.preloadedImages.delete(first);
      }
    };
  }

  /**
   * Get cached video poster thumbnail
   */
  getPoster(videoUrl: string | null | undefined): string | null {
    if (!videoUrl) return null;
    return this.posterCache.get(videoUrl) || null;
  }

  /**
   * Save a cached video poster thumbnail
   */
  setPoster(videoUrl: string, posterDataUrl: string): void {
    if (!videoUrl || !posterDataUrl) return;
    this.posterCache.set(videoUrl, posterDataUrl);
    if (this.posterCache.size > 150) {
      const first = this.posterCache.keys().next().value;
      if (first) this.posterCache.delete(first);
    }
  }
}

export const MediaCache = new MediaCacheManager();

// Module-level in-memory feed cache for instant tab transitions
export let feedCache = {
  foryou: [] as any[],
  following: [] as any[],
  lastFetched: 0,
};

export function setCachedFeed(tab: 'foryou' | 'following', posts: any[]) {
  feedCache[tab] = posts;
  feedCache.lastFetched = Date.now();
}

export function getCachedFeed(tab: 'foryou' | 'following') {
  return feedCache[tab];
}
