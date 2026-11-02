/**
 * News service for fetching Instagram posts and managing news feeds.
 */
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Auth header for authenticated endpoints. */
function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface InstagramPost {
  id: string;
  card_id: string;
  instagram_post_id: string;
  url: string;
  caption?: string;
  image_url?: string;
  likes: number;
  engagement_score: number;
  hashtags: string[];
  posted_at?: string;
  created_at: string;
}

export interface NewsRefreshResult {
  card_id: string;
  keywords_generated: number;
  posts_fetched: number;
  keywords: string[];
}

class NewsService {
  /** Get the global Instagram news feed (all posts across all cards). */
  async getNewsFeed(limit: number = 100): Promise<InstagramPost[]> {
    const res = await fetch(`${API_URL}/news/feed?limit=${limit}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts ?? []) as InstagramPost[];
  }

  /** Get Instagram posts for a specific card. */
  async getCardNewsFeed(cardId: string, limit: number = 20): Promise<InstagramPost[]> {
    const res = await fetch(`${API_URL}/news/cards/${cardId}/feed?limit=${limit}`, {
      headers: { ...authHeaders() },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.posts ?? []) as InstagramPost[];
  }

  /** Refresh news for a card - generates keywords and fetches posts. */
  async refreshCardNews(cardId: string): Promise<NewsRefreshResult> {
    const res = await fetch(`${API_URL}/news/cards/${cardId}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to refresh news');
    return res.json();
  }

  /** Clean up old Instagram posts (older than specified days). */
  async cleanupOldPosts(cardId: string, daysOld: number = 30): Promise<{ deleted_count: number }> {
    const res = await fetch(`${API_URL}/news/cards/${cardId}/old-posts?days_old=${daysOld}`, {
      method: 'DELETE',
      headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error('Failed to cleanup old posts');
    return res.json();
  }
}

export default new NewsService();
