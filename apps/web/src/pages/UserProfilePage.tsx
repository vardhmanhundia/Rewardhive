/**
 * User profiling chat page.
 *
 * A chatbot where the user talks to the AI assistant. Each turn renders:
 *   - the user's message,
 *   - the AI's personalized reply,
 *   - a system note for any new long-term memories the assistant learned.
 *
 * This is the landing page after login (route: /user_profile).
 */
import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '@/context/AuthContext';
import profilingService, {
  ProfilingTurnMessage,
} from '@/services/profilingService';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {LogOut, Send} from 'lucide-react';

type ChatRole = 'user' | 'ai' | 'system';

interface ChatMessage {
  id: number;
  role: ChatRole;
  content: string;
}

let nextId = 1;
const makeMessage = (role: ChatRole, content: string): ChatMessage => ({
  id: nextId++,
  role,
  content,
});

export const UserProfilePage = () => {
  const navigate = useNavigate();
  const {user, logout} = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage(
      'system',
      "Hi! I'm your assistant. Tell me about yourself and I'll remember it for next time.",
    ),
  ]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({top: scrollRef.current.scrollHeight, behavior: 'smooth'});
  }, [messages, isSending]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) {
      return;
    }

    // Build the history the backend expects from the conversation so far,
    // before adding the new user message to the view.
    const history: ProfilingTurnMessage[] = messages
      .filter((m): m is ChatMessage & {role: 'user' | 'ai'} => m.role === 'user' || m.role === 'ai')
      .map((m) => ({role: m.role === 'ai' ? 'assistant' : 'user', content: m.content}));

    // Add the user's message and an empty assistant bubble to stream into.
    const assistant = makeMessage('ai', '');
    setMessages((prev) => [...prev, makeMessage('user', trimmed), assistant]);
    setInput('');
    setSuggestions([]);
    setIsSending(true);

    const appendToAssistant = (text: string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistant.id ? {...m, content: m.content + text} : m)),
      );

    try {
      await profilingService.chatStream(trimmed, history, {
        onToken: appendToAssistant,
        onMemories: (items) => {
          if (items.length > 0) {
            setMessages((prev) => [
              ...prev,
              makeMessage('system', `Noted: ${items.join('; ')}`),
            ]);
          }
        },
        onSuggestions: setSuggestions,
        onError: (detail) =>
          setMessages((prev) => [...prev, makeMessage('system', `Error: ${detail}`)]),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Something went wrong';
      setMessages((prev) => [...prev, makeMessage('system', `Error: ${detail}`)]);
    } finally {
      setIsSending(false);
      // Drop the placeholder if nothing ever streamed into it (e.g. an error).
      setMessages((prev) => prev.filter((m) => !(m.id === assistant.id && m.content === '')));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="min-h-screen flex flex-col bg-glow">
      {/* Header */}
      <header className="glass">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">
              Hi<span className="text-gradient">{user ? `, ${user.first_name}` : ''}</span>
            </h1>
            <p className="text-xs text-muted-foreground">Chat with your assistant</p>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Suggestions + input */}
      <div className="glass">
        <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-3">
          {suggestions.length > 0 && !isSending && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => sendMessage(suggestion)}
                  className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-secondary-foreground hover:bg-secondary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={isSending}
              autoFocus
            />
            <Button type="submit" disabled={isSending || !input.trim()} className="gap-2">
              <Send className="w-4 h-4" />
              Send
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({message}: {message: ChatMessage}) => {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-secondary/60 border border-border px-3 py-1 text-xs text-muted-foreground max-w-[90%] text-center">
          {message.content}
        </div>
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'glass rounded-bl-sm text-foreground'
        }`}
      >
        {message.content === '' ? <TypingDots /> : message.content}
      </div>
    </div>
  );
};

const TypingDots = () => (
  <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing">
    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
  </span>
);
