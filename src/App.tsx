import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen, ScrollText, Map, Hourglass, Feather, Sparkles, Plus, Trash2,
  ChevronRight, ChevronDown, X, Check, Trophy
} from "lucide-react";

/* ============================== Utilities ============================== */

function cn(...parts: any[]) {
  return parts.filter(Boolean).join(" ");
}

const STORAGE_KEY = "inkwell-state-v1";
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

/* ============================== Types ============================== */

type PageId = "manuscript" | "codex" | "outline" | "scriptorium" | "marginalia";
type SceneStatus = "unwritten" | "drafting" | "revising" | "done";
type Scene = { id: string; title: string; synopsis: string; status: SceneStatus; wordTarget: number; content: string };
type Chapter = { id: string; title: string; scenes: Scene[]; expanded: boolean };
type Book = { id: string; title: string };
type CodexKind = "character" | "location" | "lore";
type CodexEntry = { id: string; bookId: string; kind: CodexKind; name: string; body: string };
type MarginNote = { id: string; text: string; at: string };
type SprintRecord = { id: string; minutes: number; words: number; at: string };

type Store = {
  chapters: Chapter[];
  activeSceneId: string | null;
  books: Book[];
  activeBookId: string;
  codex: CodexEntry[];
  margins: MarginNote[];
  dailyGoal: number;
  wordLog: Record<string, number>;
  sprintHistory: SprintRecord[];
  familiarName: string;
  affection: number;
};

const seed = (): Store => {
  const c1Scene: Scene = {
    id: uid(), title: "The Letter Arrives",
    synopsis: "Our protagonist receives a summons they cannot ignore.",
    status: "drafting", wordTarget: 1500, content: "",
  };
  const book1: Book = { id: uid(), title: "Ashfall" };
  return {
    chapters: [{ id: uid(), title: "Chapter One — Ashfall", expanded: true, scenes: [c1Scene] }],
    activeSceneId: c1Scene.id,
    books: [book1],
    activeBookId: book1.id,
    codex: [
      { id: uid(), bookId: book1.id, kind: "character", name: "Wren Calloway", body: "Reluctant heir to a dying order. Carries a debt she won't name." },
      { id: uid(), bookId: book1.id, kind: "location", name: "Ashfall Spire", body: "A tower built from the bones of a fallen god, now half-claimed by moss." },
      { id: uid(), bookId: book1.id, kind: "lore", name: "The Quiet Pact", body: "An old treaty between mortals and the things that live in the dark between stars." },
    ],
    margins: [],
    dailyGoal: 750,
    wordLog: {},
    sprintHistory: [],
    familiarName: "Inkfeather",
    affection: 0,
  };
};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!parsed.chapters || !parsed.codex) return seed();
    // migrate older saves without books/bookId
    if (!parsed.books || !parsed.books.length) {
      const fallbackBook: Book = { id: uid(), title: "My Book" };
      parsed.books = [fallbackBook];
      parsed.activeBookId = fallbackBook.id;
      parsed.codex = (parsed.codex || []).map((e: any) => ({ ...e, bookId: e.bookId || fallbackBook.id }));
    }
    if (!parsed.activeBookId) parsed.activeBookId = parsed.books[0].id;
    return parsed as Store;
  } catch {
    return seed();
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return { text: "The candle still burns.", sub: "The page is yours alone." };
  if (h < 10) return { text: "Good morning, scribe.", sub: "The page is fresh and awaiting your hand." };
  if (h < 13) return { text: "Good day.", sub: "Stay the course — great works take time." };
  if (h < 17) return { text: "Afternoon light.", sub: "The manuscript grows, line by line." };
  if (h < 21) return { text: "Good evening.", sub: "The lamp burns low over the desk." };
  return { text: "The hour grows late.", sub: "Rest beckons, but there's still ink in the well." };
}

/* ============================== Reusable arcane UI ============================== */

function Card({ children, className, style, onClick }: any) {
  return (
    <div onClick={onClick} className={cn("rounded-xl border", className)} style={{ borderColor: "hsl(228 25% 16%)", ...style }}>
      {children}
    </div>
  );
}
function CardContent({ children, className }: any) {
  return <div className={className}>{children}</div>;
}
function Button({ children, className, style, onClick, disabled, variant, size, title }: any) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes: Record<string, string> = { sm: "h-7 px-2.5 text-xs", lg: "h-12 px-6 text-base", default: "h-9 px-4 text-sm" };
  const variants: Record<string, string> = {
    default: "bg-amber-500 text-slate-950 hover:bg-amber-400",
    outline: "border bg-transparent hover:bg-white/5",
    secondary: "bg-slate-700 text-slate-100 hover:bg-slate-600",
    destructive: "bg-red-600 text-white hover:bg-red-500",
    ghost: "bg-transparent hover:bg-white/5",
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn(base, sizes[size || "default"], variants[variant || "default"], className)} style={style}>
      {children}
    </button>
  );
}
function Input({ className, style, ...props }: any) {
  return (
    <input {...props}
      className={cn("w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-slate-500", className)}
      style={{ borderColor: "hsl(228 25% 20%)", color: "inherit", ...style }} />
  );
}
function ArcaneDivider({ children, className }: any) {
  return (
    <div className={cn("flex items-center gap-2 uppercase tracking-[0.15em] text-[11px] font-semibold text-slate-400", className)}>
      {children}
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, hsl(228 25% 20%), transparent)" }} />
    </div>
  );
}
function GlowHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-4xl font-serif font-bold" style={{ color: "hsl(38 88% 62%)", textShadow: "0 0 40px hsl(38 88% 52% / 0.25)" }}>
      {children}
    </h1>
  );
}

/* ============================== Particles ============================== */

function Particles() {
  const particles = useMemo(
    () => Array.from({ length: 22 }).map((_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 12, duration: 10 + Math.random() * 10, size: 1 + Math.random() * 2,
    })), []
  );
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {particles.map((p) => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, bottom: "-10px", width: p.size, height: p.size,
          background: "hsl(38 88% 62% / 0.45)",
          animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
          boxShadow: "0 0 6px 1px hsl(38 88% 52% / 0.4)",
        }} />
      ))}
      <style>{`
        @keyframes float-up {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
        .animate-in { animation: fade-in 0.4s ease both; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .font-serif { font-family: Georgia, 'Times New Roman', serif; }
      `}</style>
    </div>
  );
}

/* ============================== Familiar ============================== */

function Familiar({ name, mood, onPet }: { name: string; mood: "idle" | "writing" | "cheer" | "sleep"; onPet: () => void }) {
  const [bounce, setBounce] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-20 cursor-pointer select-none"
      onClick={() => { setBounce(true); onPet(); setTimeout(() => setBounce(false), 500); }} title={`Pet ${name}`}>
      <svg width="56" height="56" viewBox="0 0 64 64"
        className={bounce || mood === "cheer" ? "animate-bounce" : ""}
        style={{ filter: "drop-shadow(0 0 8px hsl(270 60% 60% / 0.5))" }}>
        {/* wings */}
        <path d="M14 36 Q4 40 8 54 Q16 48 20 38 Z" fill="hsl(263 35% 32%)" />
        <path d="M50 36 Q60 40 56 54 Q48 48 44 38 Z" fill="hsl(263 35% 32%)" />
        {/* body */}
        <ellipse cx="32" cy="40" rx="16" ry="17" fill="hsl(263 40% 38%)" />
        {/* chest marking */}
        <ellipse cx="32" cy="44" rx="9" ry="11" fill="hsl(38 35% 80%)" />
        {mood !== "sleep" && (
          <>
            <path d="M27 47 q5 4 10 0" stroke="hsl(263 30% 25%)" strokeWidth="1.2" fill="none" />
            <path d="M27 51 q5 4 10 0" stroke="hsl(263 30% 25%)" strokeWidth="1.2" fill="none" />
          </>
        )}
        {/* head */}
        <circle cx="32" cy="24" r="14" fill="hsl(263 42% 42%)" />
        {/* ear tufts */}
        <path d="M21 14 L17 4 L26 11 Z" fill="hsl(263 42% 42%)" />
        <path d="M43 14 L47 4 L38 11 Z" fill="hsl(263 42% 42%)" />
        {/* facial disc */}
        <circle cx="32" cy="25" r="11" fill="hsl(38 30% 85%)" />
        {mood === "sleep" ? (
          <>
            <path d="M24 25 q4 -3 8 0" stroke="hsl(263 40% 18%)" strokeWidth="2" fill="none" />
            <path d="M32 25 q4 -3 8 0" stroke="hsl(263 40% 18%)" strokeWidth="2" fill="none" />
            <text x="44" y="10" fontSize="8" fill="hsl(270 60% 80%)">z</text>
          </>
        ) : (
          <>
            <circle cx="27" cy="25" r="5.5" fill="hsl(38 88% 96%)" />
            <circle cx="37" cy="25" r="5.5" fill="hsl(38 88% 96%)" />
            <circle cx="27" cy="25" r="2.6" fill="hsl(38 88% 30%)" />
            <circle cx="37" cy="25" r="2.6" fill="hsl(38 88% 30%)" />
            <circle cx="27.8" cy="24.2" r="0.8" fill="white" />
            <circle cx="37.8" cy="24.2" r="0.8" fill="white" />
          </>
        )}
        {/* beak */}
        <path d="M30 30 L34 30 L32 34 Z" fill="hsl(38 70% 55%)" />
        {/* feet */}
        <path d="M27 56 l-2 4 M27 56 l0 4 M27 56 l2 4" stroke="hsl(38 70% 55%)" strokeWidth="1.2" fill="none" />
        <path d="M37 56 l-2 4 M37 56 l0 4 M37 56 l2 4" stroke="hsl(38 70% 55%)" strokeWidth="1.2" fill="none" />
        {mood === "writing" && <rect x="42" y="38" width="6" height="2" fill="hsl(38 88% 62%)" />}
        {mood === "cheer" && (
          <path d="M30 16 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 Z" fill="hsl(38 88% 62%)" />
        )}
      </svg>
    </div>
  );
}

/* ============================== Shell ============================== */

const NAV: { id: PageId; label: string; icon: any }[] = [
  { id: "manuscript", label: "Manuscript", icon: Feather },
  { id: "outline", label: "Chapter Map", icon: Map },
  { id: "codex", label: "Codex", icon: BookOpen },
  { id: "scriptorium", label: "Scriptorium", icon: Hourglass },
  { id: "marginalia", label: "Marginalia", icon: ScrollText },
];

export default function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [page, setPage] = useState<PageId>("manuscript");
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintSecondsLeft, setSprintSecondsLeft] = useState(25 * 60);
  const [sprintMinutes, setSprintMinutes] = useState(25);
  const [sprintStartWords, setSprintStartWords] = useState(0);
  const [mood, setMood] = useState<"idle" | "writing" | "cheer" | "sleep">("idle");
  const idleTimer = useRef<number | null>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }, [store]);

  useEffect(() => {
    if (!sprintActive) return;
    const t = setInterval(() => {
      setSprintSecondsLeft((s) => {
        if (s <= 1) { clearInterval(t); finishSprint(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprintActive]);

  const totalWordsNow = useMemo(() => {
    let total = 0;
    store.chapters.forEach((c) => c.scenes.forEach((s) => (total += countWords(s.content))));
    return total;
  }, [store.chapters]);

  const todayWords = store.wordLog[todayKey()] || 0;
  const goalPct = Math.min(100, Math.round((todayWords / Math.max(1, store.dailyGoal)) * 100));
  const { text: greeting, sub: greetingSub } = getGreeting();

  function bumpIdleMood(writing: boolean) {
    if (writing) setMood("writing");
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setMood("idle"), 4000) as unknown as number;
  }

  function recordWordsDelta(before: number, after: number) {
    const delta = after - before;
    if (delta === 0) return;
    setStore((s) => {
      const k = todayKey();
      const current = s.wordLog[k] || 0;
      return { ...s, wordLog: { ...s.wordLog, [k]: Math.max(0, current + delta) } };
    });
  }

  function finishSprint() {
    setSprintActive(false);
    const endWords = totalWordsNow;
    const gained = Math.max(0, endWords - sprintStartWords);
    setStore((s) => ({
      ...s,
      sprintHistory: [{ id: uid(), minutes: sprintMinutes, words: gained, at: new Date().toISOString() }, ...s.sprintHistory].slice(0, 20),
      affection: s.affection + (gained > 0 ? 2 : 0),
    }));
    if (gained > 0) { setMood("cheer"); setTimeout(() => setMood("idle"), 2500); }
  }
  function startSprint() {
    setSprintStartWords(totalWordsNow);
    setSprintSecondsLeft(sprintMinutes * 60);
    setSprintActive(true);
  }

  const activeScene = useMemo(() => {
    for (const c of store.chapters) {
      const found = c.scenes.find((s) => s.id === store.activeSceneId);
      if (found) return found;
    }
    return null;
  }, [store.chapters, store.activeSceneId]);

  function updateActiveScene(content: string) {
    if (!activeScene) return;
    const before = countWords(activeScene.content);
    const after = countWords(content);
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => ({
        ...c, scenes: c.scenes.map((sc) => (sc.id === activeScene.id ? { ...sc, content } : sc)),
      })),
    }));
    recordWordsDelta(before, after);
    bumpIdleMood(true);
  }

  function addChapter() {
    setStore((s) => ({ ...s, chapters: [...s.chapters, { id: uid(), title: `Chapter ${s.chapters.length + 1}`, scenes: [], expanded: true }] }));
  }
  function addScene(chapterId: string) {
    const newScene: Scene = { id: uid(), title: "New Scene", synopsis: "", status: "unwritten", wordTarget: 1000, content: "" };
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, scenes: [...c.scenes, newScene] } : c)),
      activeSceneId: newScene.id,
    }));
  }
  function deleteScene(chapterId: string, sceneId: string) {
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, scenes: c.scenes.filter((sc) => sc.id !== sceneId) } : c)),
      activeSceneId: s.activeSceneId === sceneId ? null : s.activeSceneId,
    }));
  }
  function toggleChapter(chapterId: string) {
    setStore((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, expanded: !c.expanded } : c)) }));
  }
  function setSceneStatus(chapterId: string, sceneId: string, status: SceneStatus) {
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => c.id === chapterId
        ? { ...c, scenes: c.scenes.map((sc) => (sc.id === sceneId ? { ...sc, status } : sc)) } : c),
    }));
  }
  function addCodexEntry(kind: CodexKind) {
    setStore((s) => ({ ...s, codex: [...s.codex, { id: uid(), bookId: s.activeBookId, kind, name: "Untitled", body: "" }] }));
  }
  function updateCodex(id: string, patch: Partial<CodexEntry>) {
    setStore((s) => ({ ...s, codex: s.codex.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function deleteCodex(id: string) {
    setStore((s) => ({ ...s, codex: s.codex.filter((e) => e.id !== id) }));
  }
  function addBook() {
    setStore((s) => {
      const nb: Book = { id: uid(), title: `Untitled Book ${s.books.length + 1}` };
      return { ...s, books: [...s.books, nb], activeBookId: nb.id };
    });
  }
  function renameBook(id: string, title: string) {
    setStore((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, title } : b)) }));
  }
  function deleteBook(id: string) {
    setStore((s) => {
      if (s.books.length <= 1) return s; // always keep at least one book
      const remaining = s.books.filter((b) => b.id !== id);
      return {
        ...s,
        books: remaining,
        activeBookId: s.activeBookId === id ? remaining[0].id : s.activeBookId,
        codex: s.codex.filter((e) => e.bookId !== id),
      };
    });
  }
  function addMargin(text: string) {
    if (!text.trim()) return;
    setStore((s) => ({ ...s, margins: [{ id: uid(), text, at: new Date().toISOString() }, ...s.margins] }));
  }
  function deleteMargin(id: string) {
    setStore((s) => ({ ...s, margins: s.margins.filter((m) => m.id !== id) }));
  }

  return (
    <div className="min-h-screen" style={{ background: "hsl(228 38% 7%)", color: "hsl(228 15% 88%)" }}>
      <Particles />
      <div className="relative z-10 flex min-h-screen">
        <aside className="w-56 shrink-0 border-r p-5 hidden md:flex md:flex-col" style={{ borderColor: "hsl(228 25% 16%)" }}>
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="font-serif text-lg tracking-wide" style={{ color: "hsl(38 88% 62%)" }}>Inkwell</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = page === n.id;
              return (
                <button key={n.id} onClick={() => setPage(n.id)}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border",
                    active ? "text-amber-300 bg-amber-500/10 border-amber-500/20" : "text-slate-400 border-transparent hover:text-slate-100 hover:bg-white/5")}>
                  <Icon className="w-4 h-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t" style={{ borderColor: "hsl(228 25% 16%)" }}>
            <ArcaneDivider>Today</ArcaneDivider>
            <div className="text-2xl font-serif mt-2" style={{ color: "hsl(38 88% 62%)" }}>{todayWords} words</div>
            <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "hsl(228 25% 14%)" }}>
              <div className="h-full" style={{
                width: `${goalPct}%`, transition: "width .4s",
                background: "linear-gradient(90deg, hsl(38 88% 52%), hsl(270 60% 60%))",
              }} />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{goalPct}% of {store.dailyGoal}-word goal</div>
          </div>
        </aside>

        <div className="md:hidden fixed top-0 left-0 right-0 z-30 border-b flex overflow-x-auto px-2 py-2 gap-1"
          style={{ background: "hsl(228 38% 7% / 0.95)", borderColor: "hsl(228 25% 16%)" }}>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs shrink-0", active ? "text-amber-300 bg-amber-500/10" : "text-slate-400")}>
                <Icon className="w-3.5 h-3.5" />
                {n.label}
              </button>
            );
          })}
        </div>

        <main className="flex-1 p-6 md:p-10 pt-16 md:pt-10 max-w-5xl mx-auto w-full">
          {page === "manuscript" && (
            <ManuscriptPage chapters={store.chapters} activeScene={activeScene}
              onSelectScene={(id) => setStore((s) => ({ ...s, activeSceneId: id }))}
              onChange={updateActiveScene} goal={activeScene?.wordTarget || 0}
              greeting={greeting} greetingSub={greetingSub} />
          )}
          {page === "outline" && (
            <OutlinePage chapters={store.chapters} onAddChapter={addChapter} onAddScene={addScene}
              onDeleteScene={deleteScene} onToggle={toggleChapter}
              onSelectScene={(id) => { setStore((s) => ({ ...s, activeSceneId: id })); setPage("manuscript"); }}
              onSetStatus={setSceneStatus}
              onRenameChapter={(id, title) => setStore((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === id ? { ...c, title } : c)) }))} />
          )}
          {page === "codex" && (
            <CodexPage
              entries={store.codex}
              books={store.books}
              activeBookId={store.activeBookId}
              onSelectBook={(id) => setStore((s) => ({ ...s, activeBookId: id }))}
              onAddBook={addBook}
              onRenameBook={renameBook}
              onDeleteBook={deleteBook}
              onAdd={addCodexEntry}
              onUpdate={updateCodex}
              onDelete={deleteCodex}
            />
          )}
          {page === "scriptorium" && (
            <ScriptoriumPage active={sprintActive} secondsLeft={sprintSecondsLeft} minutes={sprintMinutes}
              setMinutes={setSprintMinutes} onStart={startSprint} onStop={() => finishSprint()} history={store.sprintHistory} />
          )}
          {page === "marginalia" && <MarginaliaPage notes={store.margins} onAdd={addMargin} onDelete={deleteMargin} />}
        </main>
      </div>
      <Familiar name={store.familiarName} mood={sprintActive ? "writing" : mood}
        onPet={() => setStore((s) => ({ ...s, affection: s.affection + 1 }))} />
    </div>
  );
}

/* ============================== Manuscript ============================== */

function ManuscriptPage({ chapters, activeScene, onSelectScene, onChange, goal, greeting, greetingSub }: {
  chapters: Chapter[]; activeScene: Scene | null; onSelectScene: (id: string) => void;
  onChange: (content: string) => void; goal: number; greeting: string; greetingSub: string;
}) {
  const words = activeScene ? countWords(activeScene.content) : 0;
  return (
    <div className="space-y-6 animate-in">
      <header className="space-y-1">
        <GlowHeading>{greeting}</GlowHeading>
        <p className="text-slate-400 italic">{greetingSub}</p>
      </header>

      <Card className="relative overflow-hidden border-amber-500/20"
        style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 11%), hsl(228 38% 9%))" }}>
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, hsl(38 88% 52% / 0.35), hsl(270 60% 60% / 0.2), transparent)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 0% 0%, hsl(38 88% 52% / 0.10) 0%, transparent 55%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 100% 100%, hsl(270 60% 60% / 0.08) 0%, transparent 50%)" }} />
        <CardContent className="pt-5 pb-5 px-6 relative flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center border border-amber-500/30"
              style={{ background: "hsl(38 88% 52% / 0.12)", boxShadow: "0 0 24px hsl(38 88% 52% / 0.25)" }}>
              <Feather className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm text-slate-400">Choose your scene</div>
              <div className="text-xs text-slate-500">Words flow into the day's count automatically.</div>
            </div>
          </div>
          <select value={activeScene?.id || ""} onChange={(e) => onSelectScene(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "hsl(228 25% 20%)", color: "hsl(228 15% 88%)" }}>
            <option value="" disabled style={{ background: "hsl(228 38% 9%)" }}>Choose a scene…</option>
            {chapters.map((c) => (
              <optgroup key={c.id} label={c.title}>
                {c.scenes.map((s) => <option key={s.id} value={s.id} style={{ background: "hsl(228 38% 9%)" }}>{s.title}</option>)}
              </optgroup>
            ))}
          </select>
        </CardContent>
      </Card>

      {!activeScene ? (
        <Card className="p-10 text-center text-slate-400 text-sm" style={{ borderStyle: "dashed" }}>
          No scene selected. Choose one above, or add a scene from the Chapter Map.
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{words} words{goal ? ` · target ${goal}` : ""}</span>
            {goal > 0 && <span>{Math.min(100, Math.round((words / goal) * 100))}% of target</span>}
          </div>
          <textarea value={activeScene.content} onChange={(e) => onChange(e.target.value)}
            placeholder="Begin where the ink takes you…" spellCheck={false}
            className="w-full min-h-[58vh] rounded-xl p-6 leading-relaxed text-[17px] resize-y outline-none border focus:border-amber-500/50"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              borderColor: "hsl(38 50% 25% / 0.4)",
              background: "repeating-linear-gradient(hsl(263 28% 16%), hsl(263 28% 16%) 31px, hsl(38 88% 62% / 0.06) 32px), linear-gradient(180deg, hsl(263 30% 13%), hsl(228 32% 10%))",
              color: "hsl(42 55% 88%)",
              boxShadow: "inset 0 0 40px rgba(0,0,0,0.4)",
            }} />
        </>
      )}
    </div>
  );
}

/* ============================== Outline ============================== */

const STATUS_STYLE: Record<SceneStatus, string> = {
  unwritten: "text-slate-400 bg-white/5 border-slate-600/40",
  drafting: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  revising: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  done: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
};

function OutlinePage({ chapters, onAddChapter, onAddScene, onDeleteScene, onToggle, onSelectScene, onSetStatus, onRenameChapter }: {
  chapters: Chapter[]; onAddChapter: () => void; onAddScene: (chapterId: string) => void;
  onDeleteScene: (chapterId: string, sceneId: string) => void; onToggle: (chapterId: string) => void;
  onSelectScene: (id: string) => void; onSetStatus: (chapterId: string, sceneId: string, status: SceneStatus) => void;
  onRenameChapter: (id: string, title: string) => void;
}) {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <GlowHeading>Chapter Map</GlowHeading>
        <Button onClick={onAddChapter} variant="outline" style={{ borderColor: "hsl(228 25% 20%)" }}>
          <Plus className="w-4 h-4" /> Chapter
        </Button>
      </div>

      <div className="space-y-3">
        {chapters.map((c) => {
          const wc = c.scenes.reduce((acc, s) => acc + countWords(s.content), 0);
          return (
            <Card key={c.id} className="overflow-hidden" style={{ background: "hsl(228 32% 10%)" }}>
              <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
                <button onClick={() => onToggle(c.id)} className="text-slate-400 shrink-0">
                  {c.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <input value={c.title} onChange={(e) => onRenameChapter(c.id, e.target.value)}
                  className="bg-transparent font-serif text-lg outline-none flex-1 min-w-0" style={{ color: "hsl(40 60% 85%)" }} />
                <span className="text-xs text-slate-500 shrink-0 whitespace-nowrap">{wc} words</span>
                <button onClick={() => onAddScene(c.id)} className="text-slate-400 hover:text-amber-300 shrink-0" title="Add scene">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {c.expanded && (
                <div className="px-4 pb-3 space-y-1.5">
                  {c.scenes.length === 0 && <div className="text-xs text-slate-500 italic pl-6">No scenes yet.</div>}
                  {c.scenes.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md hover:bg-white/5 group flex-wrap">
                      <button onClick={() => onSelectScene(s.id)} className="flex-1 min-w-[80px] text-left text-sm text-slate-200 truncate">
                        {s.title}<span className="text-slate-500 ml-2 text-xs">{countWords(s.content)}w</span>
                      </button>
                      <select value={s.status} onChange={(e) => onSetStatus(c.id, s.id, e.target.value as SceneStatus)}
                        className={`text-[11px] rounded-full px-2 py-0.5 border bg-transparent shrink-0 ${STATUS_STYLE[s.status]}`}>
                        <option value="unwritten">Unwritten</option>
                        <option value="drafting">Drafting</option>
                        <option value="revising">Revising</option>
                        <option value="done">Done</option>
                      </select>
                      <button onClick={() => onDeleteScene(c.id, s.id)} className="opacity-60 md:opacity-0 md:group-hover:opacity-100 text-slate-500 hover:text-red-400 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== Codex ============================== */

const KIND_LABEL: Record<CodexKind, string> = { character: "Characters", location: "Locations", lore: "Lore" };

function CodexPage({ entries, books, activeBookId, onSelectBook, onAddBook, onRenameBook, onDeleteBook, onAdd, onUpdate, onDelete }: {
  entries: CodexEntry[]; books: Book[]; activeBookId: string;
  onSelectBook: (id: string) => void; onAddBook: () => void; onRenameBook: (id: string, title: string) => void; onDeleteBook: (id: string) => void;
  onAdd: (kind: CodexKind) => void; onUpdate: (id: string, patch: Partial<CodexEntry>) => void; onDelete: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingBook, setEditingBook] = useState(false);
  const scoped = entries.filter((e) => e.bookId === activeBookId);
  const activeBook = books.find((b) => b.id === activeBookId);

  return (
    <div className="space-y-7 animate-in">
      <GlowHeading>The Codex</GlowHeading>

      {/* Book shelf — tabs to switch which book's codex is showing */}
      <div className="flex items-center gap-2 flex-wrap">
        {books.map((b) => {
          const active = b.id === activeBookId;
          return (
            <button key={b.id} onClick={() => onSelectBook(b.id)}
              className={cn("px-3 py-1.5 rounded-md text-sm border transition-colors",
                active ? "text-amber-300 bg-amber-500/10 border-amber-500/30" : "text-slate-400 border-transparent hover:bg-white/5")}
              style={{ borderColor: active ? undefined : "hsl(228 25% 16%)" }}>
              {b.title}
            </button>
          );
        })}
        <Button size="sm" variant="outline" onClick={onAddBook} style={{ borderColor: "hsl(228 25% 20%)" }}>
          <Plus className="w-3.5 h-3.5" /> Book
        </Button>
      </div>

      {/* Active book header — rename / delete */}
      {activeBook && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3" style={{ background: "hsl(228 32% 10%)" }}>
          {editingBook ? (
            <Input autoFocus value={activeBook.title} onChange={(e: any) => onRenameBook(activeBook.id, e.target.value)}
              onBlur={() => setEditingBook(false)}
              onKeyDown={(e: any) => { if (e.key === "Enter") setEditingBook(false); }}
              className="font-serif text-lg max-w-xs" style={{ color: "hsl(40 60% 85%)" }} />
          ) : (
            <button onClick={() => setEditingBook(true)} className="font-serif text-lg text-left" style={{ color: "hsl(40 60% 85%)" }}>
              {activeBook.title}
            </button>
          )}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-500">{scoped.length} {scoped.length === 1 ? "entry" : "entries"}</span>
            {books.length > 1 && (
              <button onClick={() => onDeleteBook(activeBook.id)} className="text-slate-500 hover:text-red-400" title="Delete this book">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </Card>
      )}

      {(["character", "location", "lore"] as CodexKind[]).map((kind) => (
        <div key={kind}>
          <div className="flex items-center justify-between mb-2">
            <ArcaneDivider>{KIND_LABEL[kind]}</ArcaneDivider>
          </div>
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="outline" onClick={() => onAdd(kind)} style={{ borderColor: "hsl(228 25% 20%)" }}>
              <Plus className="w-3.5 h-3.5" /> Entry
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {scoped.length === 0 && (
              <div className="text-xs text-slate-500 italic sm:col-span-2">No entries yet for {activeBook?.title}.</div>
            )}
            {scoped.filter((e) => e.kind === kind).map((e) => {
              const open = openId === e.id;
              return (
                <Card key={e.id} className="p-4 cursor-pointer border-amber-900/20"
                  style={{ background: "linear-gradient(180deg, hsl(263 28% 14%), hsl(263 28% 10%))" }}
                  onClick={() => setOpenId(open ? null : e.id)}>
                  <div className="flex items-center justify-between">
                    <input value={e.name} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => onUpdate(e.id, { name: ev.target.value })}
                      className="bg-transparent font-serif outline-none flex-1" style={{ color: "hsl(40 60% 85%)" }} />
                    <button onClick={(ev) => { ev.stopPropagation(); onDelete(e.id); }} className="text-slate-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {open ? (
                    <textarea value={e.body} onClick={(ev) => ev.stopPropagation()} onChange={(ev) => onUpdate(e.id, { body: ev.target.value })}
                      className="w-full mt-2 bg-transparent text-sm text-slate-300 outline-none resize-none min-h-[100px]" placeholder="Notes…" />
                  ) : (
                    <p className="mt-1 text-sm text-slate-400 line-clamp-2">{e.body || "—"}</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================== Scriptorium ============================== */

function ScriptoriumPage({ active, secondsLeft, minutes, setMinutes, onStart, onStop, history }: {
  active: boolean; secondsLeft: number; minutes: number; setMinutes: (n: number) => void;
  onStart: () => void; onStop: () => void; history: SprintRecord[];
}) {
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  return (
    <div className="space-y-6 animate-in">
      <GlowHeading>The Scriptorium</GlowHeading>
      <Card className="relative overflow-hidden border-amber-500/20 flex flex-col items-center justify-center py-12"
        style={{ background: "linear-gradient(135deg, hsl(228 38% 9%), hsl(270 30% 11%), hsl(228 38% 9%))" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(38 88% 52% / 0.10) 0%, transparent 55%)" }} />
        <div className="font-serif text-6xl tabular-nums relative" style={{ color: "hsl(38 88% 62%)", textShadow: "0 0 20px hsl(38 88% 52% / 0.3)" }}>
          {mm}:{ss}
        </div>
        {!active ? (
          <>
            <div className="flex items-center gap-2 mt-5 relative">
              {[15, 25, 45, 60].map((m) => (
                <button key={m} onClick={() => setMinutes(m)}
                  className={cn("px-3 py-1.5 rounded-md text-sm border", minutes === m ? "border-amber-500/50 text-amber-300 bg-amber-500/10" : "text-slate-400")}
                  style={{ borderColor: minutes === m ? undefined : "hsl(228 25% 20%)" }}>
                  {m}m
                </button>
              ))}
            </div>
            <Button onClick={onStart} className="mt-6 relative" style={{ boxShadow: "0 0 20px hsl(38 88% 52% / 0.25)" }}>Begin Sprint</Button>
          </>
        ) : (
          <Button onClick={onStop} variant="secondary" className="mt-6 relative">End Sprint Early</Button>
        )}
      </Card>

      <ArcaneDivider>Past Sprints</ArcaneDivider>
      <div className="space-y-1.5">
        {history.length === 0 && <div className="text-sm text-slate-500 italic">No sprints yet.</div>}
        {history.map((h) => (
          <div key={h.id} className="flex justify-between text-sm py-1.5 border-b text-slate-300" style={{ borderColor: "hsl(228 25% 14%)" }}>
            <span>{new Date(h.at).toLocaleString()}</span>
            <span>{h.minutes}m · {h.words} words</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== Marginalia ============================== */

function MarginaliaPage({ notes, onAdd, onDelete }: { notes: MarginNote[]; onAdd: (text: string) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-5 animate-in">
      <GlowHeading>Marginalia</GlowHeading>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e: any) => setDraft(e.target.value)}
          onKeyDown={(e: any) => { if (e.key === "Enter") { onAdd(draft); setDraft(""); } }}
          placeholder="Jot a stray thought before it escapes…" />
        <Button onClick={() => { onAdd(draft); setDraft(""); }}><Check className="w-4 h-4" /></Button>
      </div>
      <div className="space-y-2">
        {notes.length === 0 && <div className="text-sm text-slate-500 italic">Nothing in the margins yet.</div>}
        {notes.map((n) => (
          <Card key={n.id} className="flex items-start justify-between gap-3 p-3" style={{ background: "hsl(228 30% 11%)" }}>
            <div>
              <p className="text-sm text-slate-200">{n.text}</p>
              <p className="text-[11px] text-slate-500 mt-1">{new Date(n.at).toLocaleString()}</p>
            </div>
            <button onClick={() => onDelete(n.id)} className="text-slate-500 hover:text-red-400 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
