/**
 * NewsPage displays Instagram posts and news related to credit cards.
 * Can show posts for a specific card or the global feed.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { NewsCard } from '@/components/NewsCard';
import newsService, { type InstagramPost } from '@/services/newsService';
import cardService from '@/services/cardService';

type ViewMode = 'global' | 'card';

export const NewsPage = () => {
  const { cardId } = useParams<{ cardId?: string }>();
  const viewMode: ViewMode = cardId ? 'card' : 'global';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch card details if we're viewing a specific card
  const { data: card } = useQuery({
    queryKey: ['card', cardId],
    queryFn: () => (cardId ? cardService.getCard(cardId) : Promise.resolve(null)),
    enabled: !!cardId,
  });

  // Fetch news feed
  const { data: posts = [], isLoading, isError, error } = useQuery({
    queryKey: ['news', viewMode, cardId],
    queryFn: () => {
      if (viewMode === 'card' && cardId) {
        return newsService.getCardNewsFeed(cardId, 20);
      }
      return newsService.getNewsFeed(100);
    },
  });

  // Mutation for refreshing news
  const refreshMutation = useMutation({
    mutationFn: (id: string) => newsService.refreshCardNews(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news'] });
    },
  });

  const handleRefresh = async () => {
    if (!cardId) return;
    setIsRefreshing(true);
    try {
      await refreshMutation.mutateAsync(cardId);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-glow text-foreground">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">
                {viewMode === 'card' && card ? `${card.name} News` : 'News Feed'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {viewMode === 'card'
                  ? `Instagram posts and news related to ${card?.name || 'this card'}`
                  : 'Latest Instagram posts from all cards'}
              </p>
            </div>

            {viewMode === 'card' && cardId && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || refreshMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh News'}
              </button>
            )}
          </div>

          {/* Card info (if viewing a specific card) */}
          {viewMode === 'card' && card && (
            <div className="glass rounded-xl p-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h2 className="font-semibold">{card.name}</h2>
                  <p className="text-sm text-muted-foreground">{card.issuer}</p>
                </div>
                {card.annual_fee === 0 && (
                  <span className="inline-block text-xs bg-green-500/20 text-green-600 px-2 py-1 rounded-full">
                    No annual fee
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && <NewsPageSkeleton />}

        {/* Error state */}
        {isError && (
          <div className="glass rounded-2xl p-8 text-center text-destructive flex items-center justify-center gap-3">
            <AlertCircle className="h-5 w-5" />
            {error instanceof Error ? error.message : 'Failed to load news'}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && posts.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-6">
              {viewMode === 'card'
                ? 'Refresh to fetch the latest Instagram posts for this card'
                : 'No posts available yet. Check back soon!'}
            </p>
            {viewMode === 'card' && (
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Fetch Posts Now
              </button>
            )}
          </div>
        )}

        {/* Posts grid */}
        {!isLoading && !isError && posts.length > 0 && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Showing {posts.length} post{posts.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <NewsCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

/** Skeleton loader for news page. */
const NewsPageSkeleton = () => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="glass h-96 animate-pulse rounded-2xl" />
    ))}
  </div>
);
