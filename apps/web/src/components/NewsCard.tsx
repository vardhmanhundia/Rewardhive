/**
 * NewsCard component displays a single Instagram post or news item.
 */
import { Heart, MessageCircle, Share2, Zap } from 'lucide-react';
import type { InstagramPost } from '@/services/newsService';

interface NewsCardProps {
  post: InstagramPost;
}

export const NewsCard = ({ post }: NewsCardProps) => {
  const formattedLikes = post.likes.toLocaleString();
  const formattedScore = post.engagement_score.toFixed(1);

  return (
    <article className="glass overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/20">
      {/* Image placeholder */}
      {post.image_url ? (
        <div className="relative h-48 overflow-hidden bg-muted">
          <img
            src={post.image_url}
            alt="Instagram post"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Instagram Post</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Hashtags */}
        {post.hashtags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {post.hashtags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-block text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                #{tag}
              </span>
            ))}
            {post.hashtags.length > 3 && (
              <span className="inline-block text-xs text-muted-foreground">
                +{post.hashtags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-sm leading-relaxed text-foreground line-clamp-3 mb-3">
            {post.caption}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>{formattedLikes} likes</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-4 w-4 text-accent" />
            <span>{formattedScore} engagement</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex gap-2">
          <button className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary py-2 text-sm font-medium transition-colors">
            <Heart className="h-4 w-4" />
            Like
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground py-2 text-sm font-medium transition-colors">
            <MessageCircle className="h-4 w-4" />
            Comment
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground py-2 text-sm font-medium transition-colors">
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        {/* Link to post */}
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-xs text-primary hover:underline truncate"
        >
          View on Instagram →
        </a>
      </div>
    </article>
  );
};
