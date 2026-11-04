/**
 * Recommendation chat — the RAG showcase.
 *
 * Multi-turn: each question streams back staged progress (retrieving →
 * generating) and the answer token-by-token, then shows the cards it drew on.
 * Backend runs vector retrieval (pgvector) + Muse Spark generation; mock mode
 * fakes the stream locally so the flow is demoable offline.
 *
 * Left sidebar shows real conversation threads fetched from the backend,
 * categorised into Pinned, Shared, and Your threads.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles, Send, Search, FileText, Plus, MessageSquare, MoreHorizontal,
  Trash2, PanelLeftClose, PanelLeft, Pin, PinOff, RefreshCw, Share2, Users, Link2,
  X, Mail, Copy, Check, UserPlus, CreditCard, Square, Wallet,
  Mic, MicOff, Volume2, VolumeX, Paperclip, Loader2,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import Markdown from '@/components/Markdown';
import { RecommendResult, PicksResult, EvaluateResult, MemoriesNote } from '@/components/chat';
import { useImageAttachment } from '@/hooks/useImageAttachment';
import { useSpeechToText, useTextToSpeech } from '@/hooks/useVoice';
import cardService, {
  type CardProduct,
  type Conversation,
  type FollowUpPrompt,
  type RecMessage,
  type CardRewardPick,
  type RecStage,
  type ShareInfo,
} from '@/services/cardService';
import profileService from '@/services/profileService';

/* ── Types ────────────────────────────────────────────────────────────── */

interface ChatTurn {
  id: string;
  query: string;
  stage: RecStage | null;
  answer: string;
  cards: CardProduct[];
  picks: CardRewardPick[];
  found: number;
  memories: string[];
  suggestions: string[];
  error?: boolean;
  interrupted?: boolean;
  intent?: string;
  prompts: FollowUpPrompt[];
  spendBaseline?: Record<string, number>;
  imagePreviewUrl?: string;
}

type ThreadCategory = 'pinned' | 'shared' | 'self';

interface SidebarThread {
  conversation: Conversation;
  category: ThreadCategory;
  pinned: boolean;
  shared: boolean;
}

const EXAMPLES_GET = [
  'Best travel card with no foreign transaction fees',
  'Cash back on groceries, no annual fee',
  'A card to help me build credit',
];

const EXAMPLES_USE = [
  'Which card for an Airbnb booking?',
  'Best card for groceries?',
  'Which card should I use for a United flight?',
];


/* ── Helpers ──────────────────────────────────────────────────────────── */

function msgsToTurns(msgs: RecMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (let i = 0; i < msgs.length; i++) {
    if (msgs[i].role !== 'user') continue;
    const next = msgs[i + 1];
    const isReply = next?.role === 'assistant';
    const answer = isReply ? next.content : '';
    const cards = isReply ? next.cards ?? [] : [];
    const picks = isReply ? next.picks ?? [] : [];
    const intent = isReply ? next.intent : undefined;
    const spendBaseline = isReply ? next.spend_baseline : undefined;
    turns.push({
      id: crypto.randomUUID(),
      query: msgs[i].content,
      stage: 'done',
      answer,
      cards,
      picks,
      found: cards.length,
      memories: [],
      suggestions: [],
      prompts: [],
      intent,
      spendBaseline,
    });
    if (isReply) i++;
  }
  return turns;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ── Pinned / shared state (localStorage until backend supports it) ── */

function getPinned(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('pinned_threads') ?? '[]')); }
  catch { return new Set(); }
}
function savePinned(s: Set<string>) {
  try { localStorage.setItem('pinned_threads', JSON.stringify([...s])); } catch { /* */ }
}
function getShared(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('shared_threads') ?? '[]')); }
  catch { return new Set(); }
}
function saveShared(s: Set<string>) {
  try { localStorage.setItem('shared_threads', JSON.stringify([...s])); } catch { /* */ }
}

/* ── Page component ───────────────────────────────────────────────────── */

export const RecommendPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlConversationId = searchParams.get('c');
  const handoffQuery = useRef<string | null>(
    (location.state as { initialQuery?: string } | null)?.initialQuery ?? null,
  );

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(!!urlConversationId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(getPinned);
  const [sharedIds, setSharedIds] = useState<Set<string>>(getShared);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const convId = useRef<string | null>(urlConversationId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeTurnId = useRef<string | null>(null);

  // Multimodal: image attachment
  const img = useImageAttachment();

  // Voice input
  const stt = useSpeechToText((text) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  });

  // Voice output (read the latest answer aloud)
  useTextToSpeech();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // Escape key stops a running stream.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && busy) stop();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [busy]);

  // Load the conversation list from the backend.
  const refreshConversations = useCallback(async () => {
    try {
      const list = await cardService.listConversations();
      setConversations(list);
    } catch { /* best effort */ }
  }, []);

  useEffect(() => { refreshConversations(); }, [refreshConversations]);

  // Load a conversation's history (or the legacy default).
  const loadConversation = useCallback(async (id: string | null) => {
    setHistoryLoading(true);
    try {
      const msgs = id
        ? await cardService.getConversationHistory(id)
        : await cardService.getHistory();
      if (activeTurnId.current) return;
      setTurns(msgsToTurns(msgs));
    } catch {
      if (activeTurnId.current) return;
      setTurns([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // On mount: load from URL param or legacy history (unless we have a handoff query
  // or a stream is already running — the latter guards against React StrictMode's
  // double-mount wiping a turn that the handoff effect just added).
  useEffect(() => {
    if (handoffQuery.current || activeTurnId.current) return;
    convId.current = urlConversationId;
    loadConversation(urlConversationId);
  }, []);

  // When viewing a conversation, fetch share info for the "Add to my chats" banner.
  useEffect(() => {
    if (!urlConversationId) { setShareInfo(null); return; }
    cardService.getShareInfo(urlConversationId).then(setShareInfo).catch(() => setShareInfo(null));
  }, [urlConversationId]);

  const handleAddToMine = async () => {
    if (!urlConversationId) return;
    const ok = await cardService.addConversationToMine(urlConversationId);
    if (ok) {
      setShareInfo((prev) => prev ? { ...prev, already_added: true } : prev);
      refreshConversations();
    }
  };

  // Fire handoff query once. The cleanup resets the guard so the effect works
  // correctly under React StrictMode's mount-unmount-remount cycle.
  useEffect(() => {
    if (!handoffQuery.current || didInit.current) return;
    didInit.current = true;
    const query = handoffQuery.current;
    handoffQuery.current = null;
    navigate(location.pathname, { replace: true, state: null });
    ask(query);
    return () => { didInit.current = false; };
  }, []);

  const patch = (id: string, update: Partial<ChatTurn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)));

  const stop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (activeTurnId.current) {
      patch(activeTurnId.current, { stage: 'done', interrupted: true });
      activeTurnId.current = null;
    }
    setBusy(false);
  };

  const ask = async (raw: string, retryTurnId?: string) => {
    const query = raw.trim();
    if (!query) return;

    // If a stream is running, interrupt it first.
    if (busy) stop();

    // Capture image attachment before clearing.
    const currentImage = img.attachment;
    const imageB64 = currentImage?.b64;
    const imageMime = currentImage?.mime;
    const imagePreview = currentImage?.previewUrl;
    img.clear();

    // Build history from completed, non-interrupted turns only.
    // Cap at the most recent 20 turns to keep request payloads manageable;
    // the backend further trims and summarizes older context via Redis.
    const MAX_HISTORY_TURNS = 20;
    const completedTurns = turns
      .filter((t) => !t.error && !t.interrupted && t.answer)
      .slice(-MAX_HISTORY_TURNS);
    const history = completedTurns
      .flatMap((t) => [
        { role: 'user' as const, content: t.query },
        { role: 'assistant' as const, content: t.answer },
      ])
      .filter((m) => m.content.trim());

    const id = retryTurnId ?? crypto.randomUUID();
    if (retryTurnId) {
      patch(id, { stage: null, answer: '', cards: [], picks: [], found: 0, memories: [], suggestions: [], prompts: [], error: false, interrupted: false, intent: undefined, spendBaseline: undefined });
    } else {
      console.log('[ASK] adding turn', id);
      setTurns((prev) => [
        ...prev,
        { id, query, stage: null, answer: '', cards: [], picks: [], found: 0, memories: [], suggestions: [], prompts: [], imagePreviewUrl: imagePreview },
      ]);
    }
    setInput('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    activeTurnId.current = id;

    try {
      await cardService.recommendStream(
        query,
        {
          onConversation: (cid) => {
            convId.current = cid;
            if (cid !== urlConversationId) setSearchParams({ c: cid }, { replace: true });
            refreshConversations();
          },
          onStage: (stage, meta) =>
            patch(id, meta?.count != null ? { stage, found: meta.count } : { stage }),
          onCards: (cards) => patch(id, { cards }),
          onToken: (chunk) =>
            setTurns((prev) => {
              const match = prev.find((t) => t.id === id);
              if (!match) console.warn('[TOKEN] turn NOT found!', id, 'turns:', prev.length, prev.map(t => t.id));
              return prev.map((t) => (t.id === id ? { ...t, answer: t.answer + chunk } : t));
            }),
          onMemories: (items) => patch(id, { memories: items }),
          onSuggestions: (items) => patch(id, { suggestions: items }),
          onRoute: (intent) => patch(id, { intent }),
          onPrompt: (prompt) =>
            setTurns((prev) =>
              prev.map((t) => (t.id === id ? { ...t, prompts: [...t.prompts, prompt] } : t)),
            ),
          onPlan: (plan) => {
            if (plan.spend) patch(id, { spendBaseline: plan.spend as Record<string, number> });
          },
          onResult: (result) => {
            if (result.picks) patch(id, { picks: result.picks as CardRewardPick[] });
          },
          signal: controller.signal,
        },
        history,
        convId.current ?? undefined,
        imageB64,
        imageMime,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Interrupted by the user — the turn is already marked.
        return;
      }
      patch(id, { stage: 'done', answer: 'Something went wrong — please try again.', error: true });
    } finally {
      if (activeTurnId.current === id) {
        activeTurnId.current = null;
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const handleRetry = (turn: ChatTurn) => {
    ask(turn.query, turn.id);
  };

  const handleEvaluate = (cardId: string) => {
    navigate(`/evaluate?card=${encodeURIComponent(cardId)}`);
  };

  // "Did you buy it?" flow state.
  const [addCardConfirm, setAddCardConfirm] = useState<{ cardId: string; cardName: string } | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);
  const [addedCardIds, setAddedCardIds] = useState<Set<string>>(new Set());

  const handleAddCard = (cardId: string, cardName: string) => {
    setAddCardConfirm({ cardId, cardName });
  };

  const confirmAddCard = async () => {
    if (!addCardConfirm) return;
    setAddingCard(true);
    try {
      await profileService.addCard({ card_id: addCardConfirm.cardId, category: 'everyday' });
      const { cardId, cardName } = addCardConfirm;
      setAddedCardIds((prev) => new Set(prev).add(cardId));
      setAddCardConfirm(null);
      setAddedToast(cardName);
      setTimeout(() => setAddedToast(null), 3000);
    } catch {
      // best effort — the modal stays so the user can retry
    } finally {
      setAddingCard(false);
    }
  };

  const handleNewChat = () => {
    convId.current = null;
    setSearchParams({}, { replace: true });
    setTurns([]);
  };

  const handleSelectThread = async (id: string) => {
    convId.current = id;
    setSearchParams({ c: id }, { replace: true });
    await loadConversation(id);
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      savePinned(next);
      return next;
    });
  };

  const toggleShare = (id: string) => {
    setSharedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveShared(next);
      return next;
    });
  };

  const handleDeleteThread = async (id: string) => {
    const ok = await cardService.deleteConversation(id);
    if (!ok) return;
    if (convId.current === id) {
      convId.current = null;
      setSearchParams({}, { replace: true });
      setTurns([]);
    }
    refreshConversations();
  };

  const copyShareLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}?c=${id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    // Mark as shared
    if (!sharedIds.has(id)) toggleShare(id);
  };

  // Build categorised sidebar threads.
  const sidebarThreads = useMemo((): { pinned: SidebarThread[]; shared: SidebarThread[]; self: SidebarThread[] } => {
    const pinned: SidebarThread[] = [];
    const shared: SidebarThread[] = [];
    const self: SidebarThread[] = [];
    for (const c of conversations) {
      const isPinned = pinnedIds.has(c.id);
      const isShared = c.is_shared || sharedIds.has(c.id);
      const thread: SidebarThread = { conversation: c, category: 'self', pinned: isPinned, shared: isShared };
      if (isPinned) { pinned.push({ ...thread, category: 'pinned' }); }
      else if (isShared) { shared.push({ ...thread, category: 'shared' }); }
      else { self.push(thread); }
    }
    return { pinned, shared, self };
  }, [conversations, pinnedIds, sharedIds]);

  const empty = turns.length === 0;
  const activeConvId = convId.current;

  return (
    <div className="flex min-h-screen flex-col bg-glow text-foreground">
      <Navbar />

      <div className="relative flex flex-1">
        {/* Sidebar */}
        <aside
          className={`sticky top-14 h-[calc(100vh-3.5rem)] flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300 shrink-0 ${
            sidebarOpen ? 'w-[280px]' : 'w-0 overflow-hidden'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
            <h2 className="font-display font-semibold text-sm truncate">Conversations</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                title="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {/* New chat row */}
            <button
              onClick={handleNewChat}
              className={`group flex w-full items-center gap-2 rounded-lg mx-1.5 px-2.5 py-2 text-left transition-colors ${
                !activeConvId ? 'bg-primary/10 border border-primary/20' : 'border border-transparent hover:bg-white/5'
              }`}
              style={{ width: 'calc(100% - 12px)' }}
            >
              <Plus className={`h-3.5 w-3.5 shrink-0 ${!activeConvId ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-[13px] font-medium ${!activeConvId ? 'text-foreground' : 'text-muted-foreground'}`}>New conversation</span>
            </button>

            {/* Pinned */}
            {sidebarThreads.pinned.length > 0 && (
              <SidebarSection label="Pinned" icon={Pin}>
                {sidebarThreads.pinned.map((t) => (
                  <ThreadItem
                    key={t.conversation.id}
                    thread={t}
                    active={activeConvId === t.conversation.id}
                    onSelect={() => handleSelectThread(t.conversation.id)}
                    onTogglePin={() => togglePin(t.conversation.id)}
                    onCopyLink={() => copyShareLink(t.conversation.id)}
                    onDelete={() => handleDeleteThread(t.conversation.id)}
                  />
                ))}
              </SidebarSection>
            )}

            {/* Shared */}
            {sidebarThreads.shared.length > 0 && (
              <SidebarSection label="Shared" icon={Users} color="text-blue-400/70">
                {sidebarThreads.shared.map((t) => (
                  <ThreadItem
                    key={t.conversation.id}
                    thread={t}
                    active={activeConvId === t.conversation.id}
                    onSelect={() => handleSelectThread(t.conversation.id)}
                    onTogglePin={() => togglePin(t.conversation.id)}
                    onCopyLink={() => copyShareLink(t.conversation.id)}
                    onDelete={() => handleDeleteThread(t.conversation.id)}
                  />
                ))}
              </SidebarSection>
            )}

            {/* Your threads */}
            <SidebarSection label="Your threads" icon={MessageSquare} color="text-emerald-400/70">
              {sidebarThreads.self.length > 0 ? (
                sidebarThreads.self.map((t) => (
                  <ThreadItem
                    key={t.conversation.id}
                    thread={t}
                    active={activeConvId === t.conversation.id}
                    onSelect={() => handleSelectThread(t.conversation.id)}
                    onTogglePin={() => togglePin(t.conversation.id)}
                    onCopyLink={() => copyShareLink(t.conversation.id)}
                    onDelete={() => handleDeleteThread(t.conversation.id)}
                  />
                ))
              ) : (
                <p className="px-3 py-2 text-[11px] text-muted-foreground/60">No conversations yet</p>
              )}
            </SidebarSection>
          </div>
        </aside>

        {/* Main chat area */}
        <main className="flex flex-1 flex-col min-w-0">
          {!sidebarOpen && (
            <div className="sticky top-14 z-10 px-3 pt-2">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                title="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Share button pinned to top-right, outside the chat column */}
          {activeConvId && !empty && (
            <div className="sticky top-14 z-10 flex justify-end px-32 pt-3 pb-0 pointer-events-none">
              <button
                onClick={() => setShareDialogOpen(true)}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 hover:border-primary/50 transition-colors shadow-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          )}

          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4">
            {/* "Add to my chats" banner for shared conversations */}
            {shareInfo && !shareInfo.is_mine && !shareInfo.already_added && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
                <UserPlus className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {shareInfo.owner_name} shared this conversation with you
                  </p>
                  <p className="text-xs text-muted-foreground">Add it to your chats to keep it in your sidebar</p>
                </div>
                <button
                  onClick={handleAddToMine}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add to my chats
                </button>
              </div>
            )}
            {shareInfo && !shareInfo.is_mine && shareInfo.already_added && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card/50 px-4 py-2.5">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Shared by {shareInfo.owner_name}
                </p>
              </div>
            )}

            {/* Share button is rendered outside this container (see below) */}

            {historyLoading ? (
              <div className="flex-1 space-y-6 py-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-4">
                    <div className="flex justify-end"><div className="h-10 w-48 animate-pulse rounded-xl bg-white/10" /></div>
                    <div className="h-24 animate-pulse rounded-xl bg-white/5" />
                  </div>
                ))}
              </div>
            ) : empty ? (
              <EmptyState onPick={ask} />
            ) : (
              <div className="flex-1 space-y-8 py-8">
                {turns.map((turn) => (
                  <Turn
                    key={turn.id}
                    turn={turn}
                    onPick={ask}
                    onRetry={() => handleRetry(turn)}
                    onEvaluate={handleEvaluate}
                    onAddCard={handleAddCard}
                    addedCardIds={addedCardIds}
                    busy={busy}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              onDrop={img.onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="glass sticky bottom-4 mt-auto mb-4 sm:mb-4 mb-[4.5rem] rounded-xl p-3"
            >
              {/* Image preview */}
              {img.attachment && (
                <div className="relative mb-2 inline-block">
                  <img
                    src={img.attachment.previewUrl}
                    alt="Attached"
                    className="h-20 rounded-lg border border-white/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={img.clear}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {img.error && (
                <p className="mb-1 text-xs text-destructive">{img.error}</p>
              )}

              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                onPaste={img.onPaste}
                rows={1}
                placeholder={
                  busy
                    ? 'Type to interrupt and ask something else…'
                    : empty
                      ? 'Ask anything — attach a screenshot, use your voice, or type a question…'
                      : 'Ask a follow-up…'
                }
                className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
                style={{ overflow: 'hidden' }}
              />
              {/* Hidden file input */}
              <input
                ref={img.inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={img.onChange}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  {/* Attach image */}
                  <button
                    type="button"
                    onClick={img.open}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    title="Attach image (screenshot, receipt)"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  {/* Voice input */}
                  {stt.supported && (
                    <button
                      type="button"
                      onClick={stt.toggle}
                      className={`rounded-lg p-1.5 transition-colors ${
                        stt.listening
                          ? 'bg-red-500/20 text-red-400 animate-pulse'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      }`}
                      title={stt.listening ? 'Stop listening' : 'Voice input'}
                    >
                      {stt.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground hidden sm:inline ml-1">
                    {stt.listening
                      ? 'Listening…'
                      : busy
                        ? 'Esc to stop'
                        : 'Enter to send'}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {busy ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() && !img.attachment}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Ask
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>

      {/* Share dialog */}
      {shareDialogOpen && activeConvId && (
        <ShareDialog
          conversationId={activeConvId}
          conversationTitle={conversations.find((c) => c.id === activeConvId)?.title}
          firstMessage={turns[0]?.query}
          onClose={() => setShareDialogOpen(false)}
          onShared={() => {
            refreshConversations();
            if (activeConvId && !sharedIds.has(activeConvId)) toggleShare(activeConvId);
          }}
        />
      )}

      {/* "Card added" toast */}
      {addedToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[toast-up_0.3s_ease-out]">
          <div className="flex items-center gap-2.5 rounded-xl border border-green-500/30 bg-card px-4 py-3 shadow-2xl">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15">
              <Check className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium">{addedToast} added to your wallet</p>
              <p className="text-xs text-muted-foreground">Future recommendations will factor it in</p>
            </div>
          </div>
        </div>
      )}

      {/* "Did you buy it?" confirmation dialog */}
      {addCardConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setAddCardConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <CreditCard className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Add to your wallet?</h3>
                <p className="text-xs text-muted-foreground">Did you get the {addCardConfirm.cardName}?</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              This will add <strong className="text-foreground">{addCardConfirm.cardName}</strong> to
              your saved cards so the assistant factors it into future recommendations.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setAddCardConfirm(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
              >
                Not yet
              </button>
              <button
                onClick={confirmAddCard}
                disabled={addingCard}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {addingCard ? 'Adding...' : 'Yes, I got it!'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Sidebar section ──────────────────────────────────────────────────── */

const SidebarSection = ({
  label,
  icon: Icon,
  children,
  color,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  color?: string;
}) => (
  <div className="mt-2">
    <div className="flex items-center gap-1.5 px-4 py-1.5">
      <Icon className={`h-3 w-3 ${color ?? 'text-muted-foreground/60'}`} />
      <span className={`text-[10px] font-bold tracking-widest uppercase ${color ?? 'text-muted-foreground/60'}`}>{label}</span>
    </div>
    {children}
  </div>
);

/* ── Sidebar thread item ──────────────────────────────────────────────── */

const ThreadItem = ({
  thread,
  active,
  onSelect,
  onTogglePin,
  onCopyLink,
  onDelete,
}: {
  thread: SidebarThread;
  active: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const c = thread.conversation;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={`group relative flex w-full flex-col gap-0.5 rounded-lg mx-1.5 px-2.5 py-2 text-left transition-colors cursor-pointer ${
        active
          ? 'bg-primary/10 border border-primary/20'
          : 'border border-transparent hover:bg-white/5'
      }`}
      style={{ width: 'calc(100% - 12px)' }}
    >
      <div className="flex items-center gap-2">
        {thread.shared && !thread.pinned ? (
          <Users className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        ) : (
          <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
        )}
        <span className={`truncate text-[13px] font-medium ${active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
          {c.title || 'Untitled'}
        </span>
        {thread.pinned && <Pin className="h-2.5 w-2.5 text-primary shrink-0" />}
        {thread.shared && <Share2 className="h-2.5 w-2.5 text-accent shrink-0" />}
      </div>
      <div className="flex items-center gap-2 pl-[22px]">
        <span className="text-[10px] text-muted-foreground/60">{relativeTime(c.updated_at)}</span>
      </div>

      {/* Thread context menu */}
      <div
        className={`absolute right-1.5 top-1.5 ${menuOpen ? 'flex' : 'hidden group-hover:flex'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-border bg-card p-1 shadow-xl min-w-[150px]">
            <button
              onClick={() => { onTogglePin(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              {thread.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
              {thread.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => { onCopyLink(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Link2 className="h-3 w-3" />
              Copy share link
            </button>
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Empty state ──────────────────────────────────────────────────────── */

const EmptyState = ({ onPick }: { onPick: (q: string) => void }) => (
  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 border border-primary/30">
      <Sparkles className="h-7 w-7 text-primary" />
    </div>
    <h1 className="font-display text-4xl font-bold tracking-tight">
      Your card <span className="text-gradient">assistant</span>
    </h1>
    <p className="mt-3 max-w-lg text-muted-foreground">
      Ask anything about credit cards — which to get, which to use for a purchase,
      whether a card is worth it. Attach a screenshot, upload a receipt, or use your voice.
    </p>
    <p className="mt-2 max-w-lg text-xs text-muted-foreground/70">
      No bank login — you choose what to upload. Images you attach are analyzed by our AI to read the purchase.
    </p>

    <div className="mt-8 w-full max-w-lg space-y-4">
      <div className="text-left">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
          <CreditCard className="h-3 w-3" />
          Which card should I get?
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES_GET.map((ex) => (
            <button
              key={ex}
              onClick={() => onPick(ex)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="text-left">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
          <Wallet className="h-3 w-3" />
          Which card should I use?
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES_USE.map((ex) => (
            <button
              key={ex}
              onClick={() => onPick(ex)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/* ── Chat turn (with retry) ───────────────────────────────────────────── */

const Turn = ({
  turn,
  onPick,
  onRetry,
  onEvaluate,
  onAddCard,
  addedCardIds,
  busy,
}: {
  turn: ChatTurn;
  onPick: (q: string) => void;
  onRetry: () => void;
  onEvaluate: (cardId: string) => void;
  onAddCard: (cardId: string, cardName: string) => void;
  addedCardIds: Set<string>;
  busy: boolean;
}) => {
  const isDone = turn.stage === 'done' || (turn.stage === null && !!turn.answer);

  return (
    <div className="space-y-4">
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2 rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {turn.imagePreviewUrl && (
            <img
              src={turn.imagePreviewUrl}
              alt="Attached"
              className="max-h-40 rounded-lg border border-white/20 object-cover"
            />
          )}
          {turn.query}
        </div>
      </div>

      {/* Assistant response */}
      <div className="space-y-4">
        <StageLine turn={turn} />

        {turn.answer && (
          <div>
            <div className={`glass rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed ${turn.error ? 'border border-destructive/30' : ''} ${turn.interrupted ? 'opacity-60' : ''}`}>
              <Markdown>{turn.answer}</Markdown>
              {turn.stage === 'generating' && !turn.interrupted && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary align-middle" />
              )}
              {turn.interrupted && (
                <span className="mt-2 block text-xs text-muted-foreground italic">— stopped</span>
              )}
            </div>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 pl-1">
              <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1" fill="none" /><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Muse Spark
            </span>
          </div>
        )}

        {/* Text-to-speech for completed answers */}
        {isDone && turn.answer && !turn.error && (
          <TtsButton text={turn.answer} />
        )}

        {/* Retry button on error or interrupted */}
        {turn.error && turn.stage === 'done' && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
        {turn.interrupted && !turn.error && (
          <button
            onClick={onRetry}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}

        {/* Intent-specific result rendering */}
        {turn.intent === 'evaluate' && turn.picks.length > 0 && (
          <EvaluateResult picks={turn.picks} spendBaseline={turn.spendBaseline} />
        )}

        {(turn.intent === 'rewards' || turn.intent === 'compare') && turn.picks.length > 0 && (
          <PicksResult picks={turn.picks} />
        )}

        {(turn.intent === 'new_card' || !turn.intent) && turn.cards.length > 0 && (
          <RecommendResult
            cards={turn.cards}
            done={isDone && !turn.error}
            busy={busy}
            addedCardIds={addedCardIds}
            onEvaluate={onEvaluate}
            onAddCard={onAddCard}
          />
        )}

        {/* Fallback: picks without a known intent */}
        {!turn.intent && turn.picks.length > 0 && (
          <PicksResult picks={turn.picks} />
        )}

        <MemoriesNote memories={turn.memories} />

        {turn.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {turn.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onPick(s)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Share dialog ────────────────────────────────────────────────────── */

const ShareDialog = ({
  conversationId,
  conversationTitle,
  firstMessage,
  onClose,
  onShared,
}: {
  conversationId: string;
  conversationTitle?: string | null;
  firstMessage?: string;
  onClose: () => void;
  onShared: () => void;
}) => {
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ shared: string[]; invited: string[]; notFound: string[] } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const shareLink = `${window.location.origin}${window.location.pathname}?c=${conversationId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShareByEmail = async () => {
    const list = emails
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) return;
    setSending(true);
    try {
      const res = await cardService.shareConversation(conversationId, list);
      setResult({ shared: res.shared_with, invited: res.invited_new ?? [], notFound: res.not_found });
      if (res.shared_with.length > 0 || (res.invited_new ?? []).length > 0) onShared();
    } catch {
      setResult({ shared: [], invited: [], notFound: list });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Share conversation</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation preview */}
        {(conversationTitle || firstMessage) && (
          <div className="mb-5 rounded-xl border border-border bg-secondary/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{conversationTitle || 'Untitled'}</span>
            </div>
            {firstMessage && (
              <p className="text-xs text-muted-foreground line-clamp-2 pl-[22px]">
                &ldquo;{firstMessage}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Share by email */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-muted-foreground">Invite by email</label>
          <p className="text-xs text-muted-foreground">
            People with an account get a notification; anyone new gets an email invite with a sign-up link.
          </p>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 flex-1 rounded-xl border border-border bg-secondary px-3 py-2 focus-within:border-primary/40">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleShareByEmail(); }}
                placeholder="email@example.com, another@..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleShareByEmail}
              disabled={sending || !emails.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Sharing…' : 'Share'}
            </button>
          </div>

          {/* Result feedback */}
          {result && (
            <div className="space-y-1.5 text-xs">
              {result.shared.length > 0 && (
                <div className="flex items-center gap-1.5 text-green-400">
                  <Check className="h-3 w-3" />
                  Shared with {result.shared.join(', ')} — we emailed them a notification
                </div>
              )}
              {result.invited.length > 0 && (
                <div className="flex items-center gap-1.5 text-primary">
                  <UserPlus className="h-3 w-3" />
                  New user invited: {result.invited.join(', ')} — we emailed an invite with a sign-up link
                </div>
              )}
              {result.notFound.length > 0 && (
                <div className="text-destructive">
                  Couldn’t send to {result.notFound.join(', ')} — please try again
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Share by link */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-muted-foreground">Share link</label>
          <p className="text-xs text-muted-foreground">Anyone with this link can view the conversation and add it to their chats.</p>
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-xs text-muted-foreground truncate select-all">
              {shareLink}
            </div>
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors shrink-0"
            >
              {linkCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── TTS button ─────────────────────────────────────────────────────── */

const TtsButton = ({ text }: { text: string }) => {
  const { speaking, loading, supported, toggle } = useTextToSpeech();
  if (!supported) return null;
  const active = speaking || loading;
  return (
    <button
      onClick={() => toggle(text)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors ${
        active
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      }`}
      title={loading ? 'Preparing speech…' : speaking ? 'Stop reading' : 'Read aloud'}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : speaking ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {loading ? 'Preparing…' : speaking ? 'Stop' : 'Listen'}
    </button>
  );
};

/* ── Stage line (RAG progress) ────────────────────────────────────────── */

const StageLine = ({ turn }: { turn: ChatTurn }) => {
  const label = useMemo(() => {
    switch (turn.stage) {
      case 'retrieving':
        return { icon: Search, text: 'Searching the catalog…', spin: true };
      case 'retrieved':
        return {
          icon: Search,
          text: `Found ${turn.found} matching ${turn.found === 1 ? 'card' : 'cards'}`,
          spin: false,
        };
      case 'generating':
        return { icon: FileText, text: 'Drafting a recommendation…', spin: true };
      case null:
        if (!turn.answer && !turn.error && !turn.interrupted)
          return { icon: Sparkles, text: 'Thinking…', spin: true };
        return null;
      default:
        return null;
    }
  }, [turn.stage, turn.found, turn.answer, turn.error, turn.interrupted]);

  if (!label || (turn.stage === 'generating' && turn.answer)) return null;

  const Icon = label.icon;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className={`h-4 w-4 text-primary ${label.spin ? 'animate-pulse' : ''}`} />
      {label.text}
    </div>
  );
};
