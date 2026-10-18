import React, {
  useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback
} from "react";
import {
  Feather, Map as MapIcon, BookOpen, Hourglass, ScrollText, BarChart3, Settings, Plus, Trash2,
  X, Check, ChevronDown, ChevronUp, Download, Maximize2, Minimize2, AlignCenter,
  CloudRain, CloudLightning, Waves, Droplets, Flame, VolumeX, Coffee, List, LayoutGrid, Sparkles,
  GripVertical, Pencil, Target, Trophy, Play, Square, Palette, Volume2, Moon, Pause
} from "lucide-react";

/* ============================================================
   UTILITIES
============================================================ */
function cn(...parts: any[]) { return parts.filter(Boolean).join(" "); }
const STORAGE_KEY = "inkwell-state-v2";
const THEME_KEY = "inkwell-theme-v2";
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
function countWords(t: string) { const s = t.trim(); return s ? s.split(/\s+/).length : 0; }
/** colour with alpha, works with CSS variables */
const a = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
/** localStorage that never throws (private windows, blocked site data) */
const safeStorage = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};
/** Saves a text file. Inside a Claude artifact it asks the viewer to confirm; elsewhere it's a normal browser download. */
async function downloadFile(content: string, name: string) {
  const host = (window as any).claude;
  if (host && typeof host.use === "function") {
    let dl: any = null;
    try { dl = await host.use("downloads"); } catch { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data: content }); } catch { /* viewer declined, or saving is unavailable here */ }
      return;
    }
  }
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const fmt = (n: number) => n.toLocaleString("en-GB");

/* ============================================================
   TYPES
============================================================ */
type PageId = "manuscript" | "outline" | "codex" | "scriptorium" | "marginalia" | "stats";
type SceneStatus = "unwritten" | "drafting" | "revising" | "done";
type Scene = { id: string; title: string; synopsis: string; status: SceneStatus; wordTarget: number; content: string };
type Chapter = { id: string; title: string; scenes: Scene[]; expanded: boolean };
type Book = { id: string; title: string };
type CodexKind = "character" | "location" | "lore";
type CodexEntry = { id: string; bookId: string; kind: CodexKind; name: string; body: string };
type MarginNote = { id: string; text: string; at: string };
type SprintRecord = { id: string; minutes: number; words: number; at: string };
type ThemeId = "observatory" | "emerald" | "bloodmoon" | "frostbound" | "solar";
type Mood = "idle" | "writing" | "cheer" | "sleep";
type ConfirmReq = { title: string; body: string; action: string; onConfirm: () => void };

type Store = {
  chapters: Chapter[];
  activeSceneId: string | null;
  books: Book[];
  activeBookId: string;
  codex: CodexEntry[];
  margins: MarginNote[];
  dailyGoal: number;
  bookTarget: number;
  wordLog: Record<string, number>;
  sprintHistory: SprintRecord[];
  familiarName: string;
  affection: number;
};

/* ============================================================
   THEMES
============================================================ */
type ThemeBase = {
  bg: string; surface: string; star: string; starBright: string; nebula: string; ice: string;
  heading: string; text: string; muted: string; faint: string;
  owlBody: string; owlWing: string; owlHead: string; owlBelly: string;
};
type ThemeDef = { name: string; base: ThemeBase };

const THEMES: Record<ThemeId, ThemeDef> = {
  observatory: { name: "Midnight Observatory", base: {
    bg: "#070A14", surface: "#141630", star: "#F2D49B", starBright: "#FFE7B8", nebula: "#9B8CFF", ice: "#8FD3E8",
    heading: "#F7EAD0", text: "#D9DDEE", muted: "#9097B3", faint: "#646B8A",
    owlBody: "#3B3D8A", owlWing: "#2E2F6E", owlHead: "#4547A0", owlBelly: "#C9D3F2",
  }},
  emerald: { name: "Emerald Coven", base: {
    bg: "#050F0C", surface: "#0F2620", star: "#E3D58F", starBright: "#F4EBB8", nebula: "#3FC1A0", ice: "#9BE3C4",
    heading: "#EEF5E6", text: "#D3E3DA", muted: "#88A598", faint: "#5E7A6E",
    owlBody: "#1F5A4C", owlWing: "#174538", owlHead: "#256B5A", owlBelly: "#CFE8D8",
  }},
  bloodmoon: { name: "Blood Moon", base: {
    bg: "#110609", surface: "#2A1016", star: "#F2C29B", starBright: "#FFDFC2", nebula: "#E0566A", ice: "#F0A3B0",
    heading: "#F8E6DE", text: "#EAD6D6", muted: "#A98A8F", faint: "#7A5F64",
    owlBody: "#6A2434", owlWing: "#4E1A27", owlHead: "#7E2C3F", owlBelly: "#F0D3D3",
  }},
  frostbound: { name: "Frostbound", base: {
    bg: "#050D17", surface: "#10223A", star: "#CDEBF7", starBright: "#EAF8FD", nebula: "#7FA8FF", ice: "#F2D49B",
    heading: "#EEF7FB", text: "#D3E0EC", muted: "#87A2B8", faint: "#5F7A90",
    owlBody: "#2F4C78", owlWing: "#243B5E", owlHead: "#3A5C90", owlBelly: "#E0EEF8",
  }},
  solar: { name: "Solar Flare", base: {
    bg: "#110904", surface: "#2A170A", star: "#FFC86B", starBright: "#FFE0A3", nebula: "#FF7A4A", ice: "#FFE3A3",
    heading: "#FFF1DA", text: "#EEDFCD", muted: "#AD957E", faint: "#7E6A58",
    owlBody: "#7A3A1E", owlWing: "#5E2C16", owlHead: "#8E4524", owlBelly: "#F6E0C6",
  }},
};

function themeStyle(id: ThemeId): React.CSSProperties {
  const t = THEMES[id].base;
  return {
    ["--bg" as any]: t.bg, ["--surface" as any]: t.surface, ["--star" as any]: t.star,
    ["--star-bright" as any]: t.starBright, ["--nebula" as any]: t.nebula, ["--ice" as any]: t.ice,
    ["--heading" as any]: t.heading, ["--text" as any]: t.text, ["--muted" as any]: t.muted,
    ["--faint" as any]: t.faint, ["--owl-body" as any]: t.owlBody, ["--owl-wing" as any]: t.owlWing,
    ["--owl-head" as any]: t.owlHead, ["--owl-belly" as any]: t.owlBelly,
    background: "var(--bg)", color: "var(--text)",
  };
}

/* ============================================================
   SEED / STORE
============================================================ */
const seed = (): Store => {
  const c1Scene: Scene = {
    id: uid(), title: "The Letter Arrives", synopsis: "Our protagonist receives a summons she cannot ignore.",
    status: "drafting", wordTarget: 1500, content: "",
  };
  const book1: Book = { id: uid(), title: "Ashfall" };
  return {
    chapters: [{ id: uid(), title: "Ashfall", expanded: true, scenes: [c1Scene] }],
    activeSceneId: c1Scene.id,
    books: [book1], activeBookId: book1.id,
    codex: [
      { id: uid(), bookId: book1.id, kind: "character", name: "Wren Calloway", body: "Reluctant heir to a dying order. Carries a debt she won't name." },
      { id: uid(), bookId: book1.id, kind: "location", name: "Ashfall Spire", body: "A tower built from the bones of a fallen god, now half-claimed by moss." },
      { id: uid(), bookId: book1.id, kind: "lore", name: "The Quiet Pact", body: "An old treaty between mortals and the things that live in the dark between stars." },
    ],
    margins: [], dailyGoal: 750, bookTarget: 80000, wordLog: {}, sprintHistory: [], familiarName: "Inkfeather", affection: 0,
  };
};

function loadStore(): Store {
  try {
    const raw = safeStorage.get(STORAGE_KEY);
    if (!raw) return seed();
    const p = JSON.parse(raw);
    if (!p.chapters || !p.codex) return seed();
    if (!p.books?.length) {
      const b: Book = { id: uid(), title: "My Book" };
      p.books = [b]; p.activeBookId = b.id;
      p.codex = (p.codex || []).map((e: any) => ({ ...e, bookId: e.bookId || b.id }));
    }
    if (!p.activeBookId) p.activeBookId = p.books[0].id;
    if (!p.bookTarget) p.bookTarget = 80000;
    if (!p.dailyGoal) p.dailyGoal = 750;
    return p as Store;
  } catch { return seed(); }
}

function sessionLabel() {
  const d = new Date();
  const h = d.getHours();
  const name = h < 5 ? "Midnight" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : h < 21 ? "Evening" : "Night";
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${name} session · ${time}`;
}

function lastNDays(n: number, wordLog: Record<string, number>) {
  const out: { date: string; label: string; short: string; words: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    out.push({
      date: k,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      short: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
      words: wordLog[k] || 0,
    });
  }
  return out;
}

function computeStreaks(wordLog: Record<string, number>, goal: number) {
  let current = 0;
  const cursor = new Date();
  // today counts if met; if not met yet, streak continues from yesterday
  if ((wordLog[todayKey()] || 0) < goal) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const k = cursor.toISOString().slice(0, 10);
    if ((wordLog[k] || 0) >= goal) { current++; cursor.setDate(cursor.getDate() - 1); } else break;
  }
  let longest = 0, run = 0; let prev: string | null = null;
  for (const k of Object.keys(wordLog).sort()) {
    if ((wordLog[k] || 0) >= goal) {
      if (prev) {
        const p = new Date(prev); p.setDate(p.getDate() + 1);
        run = p.toISOString().slice(0, 10) === k ? run + 1 : 1;
      } else run = 1;
      longest = Math.max(longest, run);
      prev = k;
    } else { run = 0; prev = null; }
  }
  return { current, longest: Math.max(longest, current) };
}

/* ============================================================
   HOOKS
============================================================ */
function useFonts() {
  useEffect(() => {
    if (document.getElementById("inkwell-fonts")) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect"; pre.href = "https://fonts.googleapis.com";
    const l = document.createElement("link");
    l.id = "inkwell-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Figtree:wght@400;500;600&family=Spectral:ital,wght@0,400;1,400&display=swap";
    document.head.appendChild(pre); document.head.appendChild(l);
  }, []);
}

function useOutsideClose(ref: React.RefObject<HTMLElement>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function esc(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [open, close, ref]);
}

/* ============================================================
   SOUNDSCAPE
   Real recordings (credits in SOUNDS.md and in Settings), loaded
   only when first switched on. Each loop's end is crossfaded into
   its start when it loads, so it repeats without a gap or click.
============================================================ */
type SoundId = "rain" | "storm" | "fire" | "night" | "stream" | "waves" | "cafe";
type Mix = Record<SoundId, number>;
type SoundStatus = "idle" | "loading" | "ready" | "error";
const SOUND_KEY = "inkwell-sound-v1";
const SOUND_IDS: SoundId[] = ["rain", "storm", "fire", "night", "stream", "waves", "cafe"];
const EMPTY_MIX: Mix = { rain: 0, storm: 0, fire: 0, night: 0, stream: 0, waves: 0, cafe: 0 };
/** Relative path, so it works on Netlify (public/sounds) and in the test build */
const SOUND_BASE = "sounds/";
/** Per-sound trim so each sits at a similar loudness at full volume */
const CHANNEL_TRIM: Mix = { rain: 1, storm: 0.95, fire: 1.15, night: 0.9, stream: 1, waves: 1, cafe: 0.9 };
/** Each sound is one or more looping layers. Layers of different lengths keep the pattern from repeating audibly. */
const LAYERS: Record<SoundId, { file: string; gain: number; rate?: number }[]> = {
  rain: [{ file: "rain.mp3", gain: 1 }],
  // the storm recording is short: a second, slower copy puts the thunder at different moments, over a bed of rain
  storm: [{ file: "storm.mp3", gain: 0.8 }, { file: "storm.mp3", gain: 0.45, rate: 0.88 }, { file: "rain.mp3", gain: 0.45 }],
  fire: [{ file: "fireplace.mp3", gain: 1 }],
  night: [{ file: "night-crickets.mp3", gain: 1 }, { file: "night-wind.mp3", gain: 0.7 }],
  stream: [{ file: "stream.mp3", gain: 1 }],
  waves: [{ file: "waves.mp3", gain: 1 }],
  // the café recording is short too: two copies at different speeds blur it into a steady murmur
  cafe: [{ file: "coffee-shop.mp3", gain: 0.75 }, { file: "coffee-shop.mp3", gain: 0.55, rate: 0.95 }],
};

/** Crossfade the last moments of a recording into its first, so it loops seamlessly (this also hides MP3 padding) */
function makeLoopable(ctx: BaseAudioContext, src: AudioBuffer, fadeSec = 1.5): AudioBuffer {
  const sr = src.sampleRate;
  const fade = Math.min(Math.floor(fadeSec * sr), Math.floor(src.length / 4));
  const len = src.length - fade;
  const out = ctx.createBuffer(src.numberOfChannels, len, sr);
  for (let c = 0; c < src.numberOfChannels; c++) {
    const s = src.getChannelData(c), d = out.getChannelData(c);
    d.set(s.subarray(0, len));
    for (let i = 0; i < fade; i++) { const t = i / fade; d[i] = s[i] * Math.sqrt(t) + s[len + i] * Math.sqrt(1 - t); }
  }
  return out;
}

function decode(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // the callback form keeps older Safari happy
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject) as unknown as Promise<AudioBuffer> | undefined;
    if (p && typeof p.then === "function") p.then(resolve, reject);
  });
}

class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels = new Map<SoundId, GainNode>();
  private running = new Map<SoundId, { src: AudioBufferSourceNode; gain: GainNode }[]>();
  private starting = new Set<SoundId>();
  private stopTimers = new Map<SoundId, number>();
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private mix: Mix = { ...EMPTY_MIX };
  private playing = false;
  private suspendTimer: number | null = null;
  private status = Object.fromEntries(SOUND_IDS.map((id) => [id, "idle"])) as Record<SoundId, SoundStatus>;
  private listeners = new Set<() => void>();

  onStatus(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  getStatus(id: SoundId) { return this.status[id]; }
  private setStatus(id: SoundId, st: SoundStatus) {
    if (this.status[id] === st) return;
    this.status[id] = st; this.listeners.forEach((f) => f());
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0.9;
    // a safety limiter so any combination of sounds stays clean
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12;
    limiter.attack.value = 0.003; limiter.release.value = 0.25;
    master.connect(limiter); limiter.connect(ctx.destination);
    this.ctx = ctx; this.master = master;
    return ctx;
  }
  /** Call from a click or tap: browsers only allow sound to start after one */
  unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => { /* will retry on next tap */ });
  }
  private channel(id: SoundId) {
    let g = this.channels.get(id);
    if (!g && this.ctx && this.master) { g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.master); this.channels.set(id, g); }
    return g!;
  }
  private load(file: string): Promise<AudioBuffer> {
    let p = this.buffers.get(file);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(SOUND_BASE + file)
        .then((r) => { if (!r.ok) throw new Error(`${file}: ${r.status}`); return r.arrayBuffer(); })
        .then((data) => decode(ctx, data))
        .then((buf) => makeLoopable(ctx, buf));
      p.catch(() => this.buffers.delete(file)); // let a later tap try again
      this.buffers.set(file, p);
    }
    return p;
  }
  private wants(id: SoundId) { return this.playing && this.mix[id] > 0; }
  private applyLevel(id: SoundId) {
    const ctx = this.ctx; if (!ctx) return;
    const level = this.wants(id) ? Math.pow(this.mix[id], 2) * CHANNEL_TRIM[id] : 0; // squared so the slider feels even
    const g = this.channel(id).gain, now = ctx.currentTime;
    if (typeof g.cancelAndHoldAtTime === "function") g.cancelAndHoldAtTime(now); else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    g.setTargetAtTime(level, now, 0.45); // about a two-second fade
  }
  private async start(id: SoundId) {
    if (this.running.has(id) || this.starting.has(id)) return;
    const ctx = this.ctx; if (!ctx) return;
    this.starting.add(id);
    this.setStatus(id, "loading");
    try {
      const bufs = await Promise.all(LAYERS[id].map((l) => this.load(l.file)));
      this.starting.delete(id);
      this.setStatus(id, "ready");
      if (!this.wants(id) || this.running.has(id)) return;
      const t = ctx.currentTime + 0.05;
      const layers = LAYERS[id].map((l, i) => {
        const src = ctx.createBufferSource();
        src.buffer = bufs[i]; src.loop = true; src.playbackRate.value = l.rate ?? 1;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t); gain.gain.setTargetAtTime(l.gain, t, 0.5); // fade in
        src.connect(gain); gain.connect(this.channel(id));
        src.start(t, Math.random() * bufs[i].duration); // start somewhere different each time
        return { src, gain };
      });
      this.running.set(id, layers);
    } catch {
      this.starting.delete(id);
      this.setStatus(id, "error");
    }
  }
  private stop(id: SoundId) {
    this.running.get(id)?.forEach(({ src, gain }) => {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); gain.disconnect(); } catch { /* fine */ }
    });
    this.running.delete(id);
  }
  update(mix: Mix, playing: boolean) {
    this.mix = mix; this.playing = playing;
    const anyOn = SOUND_IDS.some((id) => this.wants(id));
    if (!anyOn && !this.ctx) return;
    const ctx = this.ensure(); if (!ctx) return;
    if (anyOn) {
      if (this.suspendTimer) { clearTimeout(this.suspendTimer); this.suspendTimer = null; }
      if (ctx.state === "suspended") ctx.resume().catch(() => { /* needs a tap first */ });
    }
    for (const id of SOUND_IDS) {
      this.applyLevel(id);
      if (this.wants(id)) {
        const t = this.stopTimers.get(id); if (t) { clearTimeout(t); this.stopTimers.delete(id); }
        void this.start(id);
      } else if (this.running.has(id) && !this.stopTimers.has(id)) {
        this.stopTimers.set(id, window.setTimeout(() => { this.stopTimers.delete(id); if (!this.wants(id)) this.stop(id); }, 3200));
      }
    }
    if (!anyOn && !this.suspendTimer) {
      this.suspendTimer = window.setTimeout(() => { this.suspendTimer = null; ctx.suspend().catch(() => { /* fine */ }); }, 3600);
    }
  }
  /** Try loading a sound again after it failed */
  retry(id: SoundId) {
    this.setStatus(id, "idle");
    this.update(this.mix, this.playing);
  }
}

const soundscape = new Soundscape();

function useSoundscape(mix: Mix, playing: boolean) {
  const [, rerender] = useState(0);
  useEffect(() => soundscape.onStatus(() => rerender((n) => n + 1)), []);
  useEffect(() => { soundscape.update(mix, playing); }, [mix, playing]);
  useEffect(() => () => soundscape.update(EMPTY_MIX, false), []);
  return soundscape;
}

function loadMix(): Mix {
  try {
    const raw = safeStorage.get(SOUND_KEY);
    if (!raw) return { ...EMPTY_MIX };
    const p = JSON.parse(raw);
    const m = { ...EMPTY_MIX };
    SOUND_IDS.forEach((id) => { const v = Number(p?.[id]); m[id] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0; });
    return m;
  } catch { return { ...EMPTY_MIX }; }
}

function useBreakTimer(onBreak: () => void) {
  const lastRef = useRef(Date.now());
  const activeRef = useRef(0);
  const firedRef = useRef(false);
  const recordActivity = useCallback(() => { lastRef.current = Date.now(); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const since = Date.now() - lastRef.current;
      if (since < 30_000) {
        activeRef.current++;
        if (activeRef.current >= 3600 && !firedRef.current) { firedRef.current = true; onBreak(); }
      } else if (since > 300_000) { activeRef.current = 0; firedRef.current = false; }
    }, 1000);
    return () => clearInterval(t);
  }, [onBreak]);
  return recordActivity;
}

/* ============================================================
   GLOBAL STYLES
============================================================ */
const GLOBAL_CSS = `
.ink-root{
  --glass: color-mix(in srgb, var(--surface) 62%, transparent);
  --glass-strong: color-mix(in srgb, var(--surface) 94%, var(--bg));
  --glass-border: color-mix(in srgb, var(--nebula) 18%, transparent);
  --line: color-mix(in srgb, var(--nebula) 12%, transparent);
  --soft: color-mix(in srgb, var(--text) 5%, transparent);
  --soft-border: color-mix(in srgb, var(--text) 9%, transparent);
  font-family: 'Figtree', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.f-display{font-family:'Cormorant Garamond', Georgia, serif}
.f-body{font-family:'Spectral', Georgia, serif}
.ink-root button{font-family:inherit;cursor:pointer}
.ink-root button:focus-visible,.ink-root input:focus-visible,.ink-root textarea:focus-visible,.ink-root select:focus-visible{outline:2px solid var(--star);outline-offset:2px}
.ink-root textarea::placeholder,.ink-root input::placeholder{color:var(--faint)}
.ink-root select option{background:var(--surface);color:var(--text)}
.ink-root ::selection{background:color-mix(in srgb, var(--star) 28%, transparent)}
.ink-root ::-webkit-scrollbar{width:8px;height:8px}
.ink-root ::-webkit-scrollbar-track{background:transparent}
.ink-root ::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
.ink-range{-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;height:24px;margin:0}
.ink-range::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(90deg,var(--star) 0,var(--star) var(--fill,0%),var(--soft-border) var(--fill,0%))}
.ink-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7px;border-radius:50%;background:var(--star-bright);box-shadow:0 0 12px var(--star)}
.ink-range::-moz-range-track{height:4px;border-radius:4px;background:var(--soft-border)}
.ink-range::-moz-range-progress{height:4px;border-radius:4px;background:var(--star)}
.ink-range::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:var(--star-bright);box-shadow:0 0 12px var(--star)}
@media (max-width: 767px){.ink-root:has(.ink-sheet) .ink-owl{opacity:0;pointer-events:none}}
@keyframes ink-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.9}}
@keyframes drift{from{transform:translateY(0)}to{transform:translateY(-12px)}}
@keyframes owl-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes owl-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.08)}}
@keyframes owl-flap-l{0%,100%{transform:rotate(0)}50%{transform:rotate(16deg)}}
@keyframes owl-flap-r{0%,100%{transform:rotate(0)}50%{transform:rotate(-16deg)}}
@keyframes owl-tilt{0%,100%{transform:rotate(0)}30%{transform:rotate(-6deg)}60%{transform:rotate(5deg)}}
@keyframes owl-hop{0%,100%{transform:translateY(0)}35%{transform:translateY(-10px)}55%{transform:translateY(0)}70%{transform:translateY(-4px)}}
@keyframes zz{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:1}100%{opacity:0;transform:translate(6px,-18px) scale(1.1)}}
@keyframes spark{0%{opacity:0;transform:scale(.2) rotate(0)}40%{opacity:1}100%{opacity:0;transform:scale(1.2) rotate(90deg)}}
@keyframes pulse-ring{0%{opacity:.6;transform:scale(.9)}100%{opacity:0;transform:scale(1.6)}}
.ink-in{animation:ink-in .45s cubic-bezier(.2,.7,.2,1) both}
.twinkle{animation:twinkle var(--tw,4s) ease-in-out infinite}
.owl-breathe{animation:owl-breathe 3.6s ease-in-out infinite}
.owl-blink{animation:owl-blink 4.5s linear infinite;transform-box:fill-box;transform-origin:center}
.owl-flap-l{animation:owl-flap-l .32s ease-in-out infinite;transform-box:fill-box;transform-origin:100% 0}
.owl-flap-r{animation:owl-flap-r .32s ease-in-out infinite;transform-box:fill-box;transform-origin:0 0}
.owl-tilt{animation:owl-tilt 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 90%}
.owl-hop{animation:owl-hop .7s ease-out}
.zz1{animation:zz 2.4s ease-in-out infinite}
.zz2{animation:zz 2.4s ease-in-out 1.1s infinite}
.spark{animation:spark .9s ease-out infinite;transform-box:fill-box;transform-origin:center}
.pulse-ring{animation:pulse-ring 1.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
@media (prefers-reduced-motion: reduce){
  .twinkle,.owl-breathe,.owl-blink,.owl-flap-l,.owl-flap-r,.owl-tilt,.owl-hop,.zz1,.zz2,.spark,.pulse-ring,.ink-in{animation:none!important}
}
`;

/* ============================================================
   PRIMITIVES
============================================================ */
function Glass({ children, className, style, strong, onClick }: {
  children?: React.ReactNode; className?: string; style?: React.CSSProperties; strong?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={cn("rounded-[20px] border", className)}
      style={{
        background: strong ? "var(--glass-strong)" : "var(--glass)",
        borderColor: "var(--glass-border)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        ...style,
      }}>
      {children}
    </div>
  );
}

function Label({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={cn("block text-[11px] font-medium uppercase tracking-[0.2em]", className)} style={{ color: "var(--muted)", ...style }}>{children}</span>;
}

function Heading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="f-display m-0 text-[44px] md:text-[56px] leading-none font-medium tracking-[-0.01em]"
        style={{ color: "var(--heading)", textShadow: `0 0 48px ${a("var(--star)", 25)}` }}>{children}</h1>
      {sub && <p className="f-display m-0 italic text-lg md:text-xl" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

function Divider() {
  return <div aria-hidden className="h-px w-full" style={{ background: `linear-gradient(90deg, ${a("var(--star)", 50)}, ${a("var(--nebula)", 30)}, transparent)` }} />;
}

type BtnVariant = "star" | "ghost" | "soft" | "danger";
function Btn({ children, onClick, variant = "soft", className, title, ariaLabel, disabled, type, style }: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnVariant; className?: string; title?: string;
  ariaLabel?: string; disabled?: boolean; type?: "button" | "submit"; style?: React.CSSProperties;
}) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    star: {
      background: `linear-gradient(180deg, ${a("var(--star)", 22)}, ${a("var(--star)", 8)})`,
      border: `1px solid ${a("var(--star)", 45)}`, color: "var(--heading)",
      boxShadow: `0 8px 24px ${a("var(--star)", 14)}`,
    },
    soft: { background: "var(--soft)", border: "1px solid var(--soft-border)", color: "var(--text)" },
    ghost: { background: "transparent", border: "1px solid transparent", color: "var(--muted)" },
    danger: { background: a("#ff6b7a", 12), border: `1px solid ${a("#ff6b7a", 35)}`, color: "#ffb3bb" },
  };
  return (
    <button type={type || "button"} onClick={onClick} title={title} aria-label={ariaLabel} disabled={disabled}
      className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 min-h-[44px] text-sm font-medium transition hover:brightness-125 disabled:opacity-40 disabled:cursor-not-allowed", className)}
      style={{ ...styles[variant], ...style }}>
      {children}
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  const { className, style, ...rest } = props;
  return (
    <input {...rest}
      className={cn("w-full min-h-[44px] rounded-xl border px-4 text-sm outline-none transition focus:border-[var(--star)]", className)}
      style={{ background: "var(--soft)", borderColor: "var(--soft-border)", color: "var(--text)", ...style }} />
  );
}

/** Small anchored menu with outside-click and Escape to close */
function Popover({ trigger, children, align = "right", up, sheetOnMobile }: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right"; up?: boolean; sheetOnMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(ref, open, close);
  return (
    <div className="relative" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={cn("absolute z-50 min-w-[210px] rounded-2xl border p-2 ink-in", align === "right" ? "right-0" : "left-0", up ? "bottom-full mb-2" : "top-full mt-2",
          sheetOnMobile && "ink-sheet max-md:fixed max-md:inset-x-3 max-md:top-auto max-md:mb-0 max-md:mt-0 max-md:min-w-0 max-md:bottom-[calc(84px+env(safe-area-inset-bottom,0px))] max-md:max-h-[70vh] max-md:overflow-y-auto", sheetOnMobile && "md:max-h-[calc(100vh-110px)] md:overflow-y-auto")}
          style={{ background: "var(--glass-strong)", borderColor: "var(--glass-border)", boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}>
          {children(close)}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 min-h-[40px] text-left text-sm transition hover:bg-[var(--soft)]"
      style={{ color: active ? "var(--star)" : "var(--text)", background: active ? a("var(--star)", 10) : undefined }}>
      {children}
    </button>
  );
}

/* ============================================================
   BACKDROP
============================================================ */
function Starfield() {
  const stars = useMemo(() => Array.from({ length: 46 }).map((_, i) => ({
    id: i, left: Math.random() * 100, top: Math.random() * 100,
    size: Math.random() < 0.15 ? 2.5 : Math.random() < 0.5 ? 1.5 : 1,
    tw: 3 + Math.random() * 5, delay: Math.random() * 5,
    tint: Math.random() < 0.25 ? "var(--nebula)" : Math.random() < 0.4 ? "var(--star)" : "#ffffff",
  })), []);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: `radial-gradient(700px 520px at 74% 14%, ${a("var(--nebula)", 15)}, transparent 65%), radial-gradient(640px 460px at 8% 100%, ${a("var(--star)", 7)}, transparent 60%)`,
      }} />
      <svg className="absolute right-[4%] top-[70px] hidden lg:block" width="520" height="300" viewBox="0 0 520 300" style={{ opacity: 0.45 }}>
        <path d="M30 220 L120 150 L210 176 L290 92 L390 120 L470 40" fill="none" stroke="var(--nebula)" strokeOpacity="0.4" />
        <path d="M290 92 L320 210 L430 250" fill="none" stroke="var(--nebula)" strokeOpacity="0.28" strokeDasharray="3 5" />
        {[[30, 220, 2], [120, 150, 2.5], [210, 176, 1.8], [290, 92, 3], [390, 120, 2], [470, 40, 2.6], [320, 210, 1.6], [430, 250, 2]].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--star)" className="twinkle" style={{ ["--tw" as any]: `${3 + i}s` }} />
        ))}
      </svg>
      {stars.map((s) => (
        <span key={s.id} className="absolute rounded-full twinkle" style={{
          left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, background: s.tint,
          animationDelay: `${s.delay}s`, ["--tw" as any]: `${s.tw}s`,
          boxShadow: s.size > 2 ? `0 0 8px 1px ${s.tint}` : undefined,
        }} />
      ))}
    </div>
  );
}

/* ============================================================
   INKFEATHER
============================================================ */
function Inkfeather({ mood, onPet, className }: { mood: Mood; onPet: () => void; className?: string }) {
  const [hop, setHop] = useState(false);
  const sleeping = mood === "sleep";
  const writing = mood === "writing";
  const cheering = mood === "cheer";
  const label = sleeping ? "Inkfeather is dozing. Tap to wake." : writing ? "Inkfeather is watching you write" : cheering ? "Inkfeather is celebrating" : "Inkfeather, your familiar. Tap to pet.";
  return (
    <button aria-label={label} title={label}
      onClick={() => { setHop(true); onPet(); window.setTimeout(() => setHop(false), 720); }}
      className={cn("ink-owl fixed z-30 border-0 bg-transparent p-0 transition-opacity", className)}>
      <svg viewBox="0 0 84 96" aria-hidden
        className={cn("h-[60px] w-[52px] md:h-[88px] md:w-[76px]", hop || cheering ? "owl-hop" : "", !sleeping && !writing ? "owl-tilt" : "")}
        style={{ filter: `drop-shadow(0 0 20px ${a("var(--nebula)", 60)})`, overflow: "visible" }}>
        <path d="M8 88 Q42 78 76 88" stroke="var(--nebula)" strokeOpacity="0.55" strokeWidth="2" fill="none" />
        <g className={sleeping ? "" : "owl-breathe"}>
          <path d="M20 50 Q8 60 14 80 Q24 70 28 54 Z" fill="var(--owl-wing)" className={writing || cheering ? "owl-flap-l" : ""} />
          <path d="M64 50 Q76 60 70 80 Q60 70 56 54 Z" fill="var(--owl-wing)" className={writing || cheering ? "owl-flap-r" : ""} />
          <ellipse cx="42" cy="58" rx="22" ry="23" fill="var(--owl-body)" />
          <ellipse cx="42" cy="64" rx="13" ry="15" fill="var(--owl-belly)" opacity="0.55" />
          <circle cx="36" cy="62" r="1.2" fill="var(--star)" />
          <circle cx="46" cy="68" r="1" fill="var(--star)" />
          <circle cx="41" cy="73" r="0.9" fill="var(--star)" />
          <path d="M28 20 L22 4 L36 16 Z" fill="var(--owl-body)" />
          <path d="M56 20 L62 4 L48 16 Z" fill="var(--owl-body)" />
          <circle cx="42" cy="32" r="19" fill="var(--owl-head)" />
          {sleeping ? (
            <>
              <path d="M27 33 q6 4 12 0" stroke="#0D0F24" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M45 33 q6 4 12 0" stroke="#0D0F24" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <text x="60" y="14" fontSize="11" fill="var(--star)" className="zz1">z</text>
              <text x="68" y="6" fontSize="8" fill="var(--star)" className="zz2">z</text>
            </>
          ) : (
            <>
              <circle cx="33" cy="32" r="7.5" fill="#0D0F24" />
              <circle cx="51" cy="32" r="7.5" fill="#0D0F24" />
              <g className="owl-blink">
                <circle cx="33" cy="32" r="5.2" fill="var(--star)" />
                <circle cx="51" cy="32" r="5.2" fill="var(--star)" />
                <circle cx={writing ? 34.5 : 33} cy={writing ? 33.5 : 32} r="2.5" fill="#0D0F24" />
                <circle cx={writing ? 52.5 : 51} cy={writing ? 33.5 : 32} r="2.5" fill="#0D0F24" />
                <circle cx="34.4" cy="30.6" r="1.1" fill="#fff" />
                <circle cx="52.4" cy="30.6" r="1.1" fill="#fff" />
              </g>
            </>
          )}
          <path d="M39.5 39 L44.5 39 L42 44 Z" fill="var(--star)" />
          {writing && <path d="M60 70 L78 52" stroke="var(--star)" strokeWidth="2" strokeLinecap="round" />}
        </g>
        {cheering && (
          <>
            <path d="M10 18 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="var(--star)" className="spark" />
            <path d="M74 22 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="var(--star-bright)" className="spark" style={{ animationDelay: ".3s" }} />
            <circle cx="42" cy="48" r="30" fill="none" stroke="var(--star)" strokeOpacity=".5" className="pulse-ring" />
          </>
        )}
      </svg>
    </button>
  );
}

/* ============================================================
   NAV
============================================================ */
const NAV: { id: PageId; label: string; icon: any }[] = [
  { id: "manuscript", label: "Manuscript", icon: Feather },
  { id: "outline", label: "Chapter Map", icon: MapIcon },
  { id: "codex", label: "Codex", icon: BookOpen },
  { id: "scriptorium", label: "Scriptorium", icon: Hourglass },
  { id: "marginalia", label: "Marginalia", icon: ScrollText },
  { id: "stats", label: "The Ledger", icon: BarChart3 },
];

function Sigil() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border"
      style={{ background: `radial-gradient(circle at 30% 30%, ${a("var(--nebula)", 35)}, ${a("var(--surface)", 90)})`, borderColor: a("var(--nebula)", 40), boxShadow: `0 0 24px ${a("var(--nebula)", 30)}` }}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M19 3C12 5 7.5 10 6 19l2-.6C9 12 13 7.5 19 3z" fill="var(--star)" />
        <circle cx="18" cy="17" r="1.4" fill="var(--nebula)" />
        <circle cx="7" cy="5" r="1" fill="var(--nebula)" />
      </svg>
    </div>
  );
}

function NavRail({ page, setPage, onSettings }: { page: PageId; setPage: (p: PageId) => void; onSettings: () => void }) {
  return (
    <nav aria-label="Sections" className="sticky top-0 hidden h-screen w-[84px] shrink-0 flex-col items-center gap-2 border-r py-6 md:flex"
      style={{ borderColor: "var(--line)", background: a("var(--bg)", 70) }}>
      <div className="mb-5"><Sigil /></div>
      {NAV.map((n) => {
        const Icon = n.icon; const active = page === n.id;
        return (
          <div key={n.id} className="group relative">
            <button onClick={() => setPage(n.id)} aria-label={n.label} aria-current={active ? "page" : undefined}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border transition hover:brightness-150"
              style={active
                ? { borderColor: a("var(--star)", 40), background: a("var(--star)", 10), color: "var(--star)", boxShadow: `0 0 20px ${a("var(--star)", 18)}` }
                : { borderColor: "transparent", color: "var(--faint)" }}>
              <Icon size={20} strokeWidth={1.6} />
            </button>
            <span className="pointer-events-none absolute left-[64px] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs opacity-0 transition group-hover:opacity-100"
              style={{ background: "var(--glass-strong)", borderColor: "var(--glass-border)", color: "var(--text)" }}>{n.label}</span>
          </div>
        );
      })}
      <button onClick={onSettings} aria-label="Settings and themes" title="Settings and themes"
        className="mt-auto flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border transition hover:brightness-150"
        style={{ borderColor: "var(--soft-border)", color: "var(--faint)" }}>
        <Settings size={20} strokeWidth={1.6} />
      </button>
    </nav>
  );
}

function MobileNav({ page, setPage }: { page: PageId; setPage: (p: PageId) => void }) {
  return (
    <nav aria-label="Sections" className="fixed inset-x-3 z-40 flex justify-between rounded-[22px] border p-1.5 md:hidden"
      style={{ bottom: "calc(12px + env(safe-area-inset-bottom, 0px))", background: "var(--glass-strong)", borderColor: "var(--glass-border)", boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}>
      {NAV.map((n) => {
        const Icon = n.icon; const active = page === n.id;
        return (
          <button key={n.id} onClick={() => setPage(n.id)} aria-label={n.label} aria-current={active ? "page" : undefined}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl"
            style={active ? { background: a("var(--star)", 14), color: "var(--star)" } : { color: "var(--faint)" }}>
            <Icon size={21} strokeWidth={1.6} />
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================
   TOP BAR
============================================================ */
function TopBar({ books, activeBookId, onSelectBook, onAddBook, crumbs, tools, onSettings }: {
  books: Book[]; activeBookId: string; onSelectBook: (id: string) => void; onAddBook: () => void;
  crumbs: string[]; tools?: React.ReactNode; onSettings: () => void;
}) {
  const book = books.find((b) => b.id === activeBookId);
  return (
    <header className="relative z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-9 md:py-5" style={{ borderColor: "var(--line)" }}>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]" style={{ color: "var(--faint)" }}>
        <Popover align="left" trigger={(open, toggle) => (
          <button onClick={toggle} aria-expanded={open}
            className="flex min-h-[40px] items-center gap-2 rounded-full border px-3 text-[13px]"
            style={{ borderColor: a("var(--nebula)", 30), background: a("var(--nebula)", 8), color: "var(--heading)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--nebula)", boxShadow: "0 0 8px var(--nebula)" }} />
            <span className="max-w-[160px] truncate">{book?.title || "Untitled"}</span>
            <ChevronDown size={13} />
          </button>
        )}>
          {(close) => (
            <div className="flex flex-col gap-1">
              <Label className="px-3 pb-1 pt-2">Your tomes</Label>
              {books.map((b) => (
                <MenuItem key={b.id} active={b.id === activeBookId} onClick={() => { onSelectBook(b.id); close(); }}>
                  <BookOpen size={15} />{b.title}
                </MenuItem>
              ))}
              <div className="my-1 h-px" style={{ background: "var(--line)" }} />
              <MenuItem onClick={() => { onAddBook(); close(); }}><Plus size={15} />Begin a new book</MenuItem>
            </div>
          )}
        </Popover>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <span aria-hidden className="hidden sm:inline">/</span>
            <span className={cn("max-w-[220px] truncate", i < crumbs.length - 1 ? "hidden sm:inline" : "")}
              style={{ color: i === crumbs.length - 1 ? "var(--text)" : undefined }}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {tools}
        <button onClick={onSettings} aria-label="Settings and themes"
          className="flex h-11 w-11 items-center justify-center rounded-xl border md:hidden"
          style={{ borderColor: "var(--soft-border)", color: "var(--muted)" }}>
          <Settings size={18} strokeWidth={1.6} />
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   ORRERY + MINI CHARTS
============================================================ */
function Orrery({ rings, centre, caption, size = 190 }: {
  rings: { pct: number; color: string; label: string }[]; centre: string; caption: string; size?: number;
}) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={rings.map((r) => `${r.label} ${Math.round(r.pct * 100)} percent`).join(", ")}>
      {rings.map((r, i) => {
        const radius = c - 10 - i * 18;
        const circ = 2 * Math.PI * radius;
        const len = Math.max(0, Math.min(1, r.pct)) * circ;
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={radius} fill="none" stroke="var(--soft)" strokeWidth="6" />
            <circle cx={c} cy={c} r={radius} fill="none" stroke={r.color} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${len} ${circ}`} transform={`rotate(-90 ${c} ${c})`} opacity={len > 0.5 ? 1 : 0}
              style={{ transition: "stroke-dasharray .6s cubic-bezier(.2,.7,.2,1)", filter: i === 0 ? `drop-shadow(0 0 6px ${r.color})` : undefined }} />
          </g>
        );
      })}
      <text x={c} y={c - 2} textAnchor="middle" className="f-display" fontSize={size * 0.18} fontWeight="600" fill="var(--heading)">{centre}</text>
      <text x={c} y={c + size * 0.1} textAnchor="middle" fontSize="11" fill="var(--muted)">{caption}</text>
    </svg>
  );
}

function WeekBars({ wordLog, goal }: { wordLog: Record<string, number>; goal: number }) {
  const days = lastNDays(7, wordLog);
  const max = Math.max(goal, ...days.map((d) => d.words), 1);
  return (
    <div className="flex h-20 items-end gap-2">
      {days.map((d, i) => {
        const today = i === days.length - 1;
        const hit = d.words >= goal;
        return (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${fmt(d.words)} words`}>
            <div className="w-full rounded-[4px]" style={{
              height: `${Math.max(d.words > 0 ? 6 : 3, (d.words / max) * 100)}%`,
              background: today ? "var(--nebula)" : hit ? `linear-gradient(180deg, var(--star), ${a("var(--star)", 30)})` : "var(--soft-border)",
              boxShadow: today ? `0 0 12px ${a("var(--nebula)", 60)}` : undefined,
            }} />
            <span className="text-[10px]" style={{ color: today ? "var(--text)" : "var(--faint)" }}>{d.short}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   EDITOR
============================================================ */
function caretTop(el: HTMLTextAreaElement): number {
  const div = document.createElement("div");
  const cs = window.getComputedStyle(el);
  const props = ["boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth",
    "borderBottomWidth", "borderLeftWidth", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight",
    "textTransform", "wordSpacing", "textIndent"];
  props.forEach((p) => { (div.style as any)[p] = (cs as any)[p]; });
  div.style.position = "absolute"; div.style.visibility = "hidden"; div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word"; div.style.top = "0"; div.style.left = "-9999px";
  div.textContent = el.value.substring(0, el.selectionStart);
  const span = document.createElement("span"); span.textContent = "​"; div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop;
  document.body.removeChild(div);
  return top;
}

function SceneEditor({ value, onChange, typewriter, large, autoFocus }: {
  value: string; onChange: (v: string) => void; typewriter: boolean; large?: boolean; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const lineH = large ? 38 : 34;

  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    if (typewriter) { el.style.height = ""; return; }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, typewriter]);

  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const centre = () => {
    const el = ref.current; if (!typewriter || !el) return;
    el.scrollTop = Math.max(0, caretTop(el) - el.clientHeight / 2 + lineH / 2);
  };
  useEffect(() => { if (typewriter) requestAnimationFrame(centre); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [typewriter]);

  const fade = "linear-gradient(180deg, transparent 0%, rgba(0,0,0,.35) 22%, #000 42%, #000 58%, rgba(0,0,0,.35) 78%, transparent 100%)";
  return (
    <div className="relative">
      {typewriter && (
        <div aria-hidden className="pointer-events-none absolute -inset-x-4 top-1/2 -translate-y-1/2 rounded-xl"
          style={{ height: lineH + 14, background: a("var(--nebula)", 8), boxShadow: `inset 0 0 0 1px ${a("var(--nebula)", 18)}` }} />
      )}
      <textarea ref={ref} value={value} spellCheck
        aria-label="Scene text"
        placeholder="Begin where the ink takes you…"
        onChange={(e) => { onChange(e.target.value); requestAnimationFrame(centre); }}
        onKeyUp={centre} onClick={centre}
        className={cn("f-body relative block w-full resize-none border-0 bg-transparent outline-none", typewriter ? "h-[64vh] overflow-y-auto" : "min-h-[46vh] overflow-hidden")}
        style={{
          fontSize: large ? 21 : 19, lineHeight: `${lineH}px`, color: "var(--text)",
          paddingTop: typewriter ? "36vh" : 0, paddingBottom: typewriter ? "36vh" : 0,
          caretColor: "var(--star)",
          maskImage: typewriter ? fade : undefined, WebkitMaskImage: typewriter ? fade : undefined,
        }} />
    </div>
  );
}

/* ============================================================
   APP
============================================================ */
export default function App() {
  useFonts();
  const [store, setStore] = useState<Store>(loadStore);
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const t = safeStorage.get(THEME_KEY) as ThemeId | null;
    return t && THEMES[t] ? t : "observatory";
  });
  const [page, setPage] = useState<PageId>("manuscript");
  const [focusMode, setFocusMode] = useState(false);
  const [typewriter, setTypewriter] = useState(false);
  const [mix, setMix] = useState<Mix>(loadMix);
  const [soundOn, setSoundOn] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintSecsLeft, setSprintSecsLeft] = useState(25 * 60);
  const [sprintMins, setSprintMins] = useState(25);
  const [sprintStartWords, setSprintStartWords] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const idleTimer = useRef<number | null>(null);
  const sleepTimer = useRef<number | null>(null);

  useEffect(() => { safeStorage.set(STORAGE_KEY, JSON.stringify(store)); }, [store]);
  useEffect(() => { safeStorage.set(THEME_KEY, themeId); }, [themeId]);
  useEffect(() => { document.body.style.background = THEMES[themeId].base.bg; document.body.style.margin = "0"; }, [themeId]);

  const sound = useSoundscape(mix, soundOn);
  useEffect(() => { safeStorage.set(SOUND_KEY, JSON.stringify(mix)); }, [mix]);
  const soundLive = soundOn && SOUND_IDS.some((id) => mix[id] > 0);
  const mixer = {
    mix, playing: soundOn,
    status: Object.fromEntries(SOUND_IDS.map((id) => [id, sound.getStatus(id)])) as Record<SoundId, SoundStatus>,
    onLevel: (id: SoundId, v: number) => { sound.unlock(); setMix((m) => ({ ...m, [id]: v })); if (v > 0) setSoundOn(true); },
    onToggle: (id: SoundId) => {
      sound.unlock();
      if (mix[id] > 0 && sound.getStatus(id) === "error") { setSoundOn(true); sound.retry(id); return; }
      const next = mix[id] > 0 ? 0 : 0.6; setMix((m) => ({ ...m, [id]: next })); if (next > 0) setSoundOn(true); },
    onPlaying: (p: boolean) => { sound.unlock(); setSoundOn(p); },
  };
  const recordActivity = useBreakTimer(useCallback(() => setShowBreak(true), []));

  const totalWords = useMemo(() => {
    let n = 0; store.chapters.forEach((c) => c.scenes.forEach((s) => { n += countWords(s.content); })); return n;
  }, [store.chapters]);
  const totalRef = useRef(totalWords);
  totalRef.current = totalWords;

  // Familiar dozes after two quiet minutes
  const armSleep = useCallback(() => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = window.setTimeout(() => setMood((m) => (m === "idle" ? "sleep" : m)), 120_000);
  }, []);
  useEffect(() => { armSleep(); }, [armSleep]);

  function markWriting() {
    setMood("writing"); recordActivity();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setMood("idle"), 3500);
    armSleep();
  }
  function cheer() { setMood("cheer"); window.setTimeout(() => setMood("idle"), 2600); armSleep(); }

  const finishSprint = useCallback(() => {
    setSprintActive(false);
    const gained = Math.max(0, totalRef.current - sprintStartRef.current);
    setStore((s) => ({
      ...s,
      sprintHistory: [{ id: uid(), minutes: sprintMinsRef.current, words: gained, at: new Date().toISOString() }, ...s.sprintHistory].slice(0, 30),
      affection: s.affection + (gained > 0 ? 2 : 0),
    }));
    if (gained > 0) cheer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sprintStartRef = useRef(0); sprintStartRef.current = sprintStartWords;
  const sprintMinsRef = useRef(25); sprintMinsRef.current = sprintMins;

  useEffect(() => {
    if (!sprintActive) return;
    const t = setInterval(() => setSprintSecsLeft((s) => {
      if (s <= 1) { clearInterval(t); finishSprint(); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [sprintActive, finishSprint]);

  function startSprint() { setSprintStartWords(totalWords); setSprintSecsLeft(sprintMins * 60); setSprintActive(true); }

  // Esc leaves focus mode
  useEffect(() => {
    if (!focusMode) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFocusMode(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [focusMode]);

  const { activeScene, activeChapter } = useMemo(() => {
    for (const c of store.chapters) {
      const f = c.scenes.find((s) => s.id === store.activeSceneId);
      if (f) return { activeScene: f, activeChapter: c };
    }
    return { activeScene: null as Scene | null, activeChapter: null as Chapter | null };
  }, [store.chapters, store.activeSceneId]);

  /* ---------- mutations ---------- */
  function updateScene(id: string, patch: Partial<Scene>) {
    setStore((s) => ({ ...s, chapters: s.chapters.map((c) => ({ ...c, scenes: c.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)) })) }));
  }
  function updateContent(content: string) {
    if (!activeScene) return;
    const delta = countWords(content) - countWords(activeScene.content);
    setStore((s) => {
      const k = todayKey();
      return {
        ...s,
        chapters: s.chapters.map((c) => ({ ...c, scenes: c.scenes.map((sc) => (sc.id === activeScene.id ? { ...sc, content } : sc)) })),
        wordLog: delta ? { ...s.wordLog, [k]: Math.max(0, (s.wordLog[k] || 0) + delta) } : s.wordLog,
      };
    });
    markWriting();
  }
  function selectScene(id: string) { setStore((s) => ({ ...s, activeSceneId: id })); }
  function addChapter() {
    setStore((s) => ({ ...s, chapters: [...s.chapters, { id: uid(), title: `Chapter ${s.chapters.length + 1}`, scenes: [], expanded: true }] }));
  }
  function renameChapter(id: string, title: string) { setStore((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === id ? { ...c, title } : c)) })); }
  function deleteChapter(id: string) {
    setStore((s) => {
      const ch = s.chapters.find((c) => c.id === id);
      const lostActive = ch?.scenes.some((sc) => sc.id === s.activeSceneId);
      return { ...s, chapters: s.chapters.filter((c) => c.id !== id), activeSceneId: lostActive ? null : s.activeSceneId };
    });
  }
  function addScene(chapterId: string) {
    const ns: Scene = { id: uid(), title: "Untitled scene", synopsis: "", status: "unwritten", wordTarget: 1000, content: "" };
    setStore((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, expanded: true, scenes: [...c.scenes, ns] } : c)), activeSceneId: ns.id }));
  }
  function deleteScene(chapterId: string, sceneId: string) {
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => (c.id === chapterId ? { ...c, scenes: c.scenes.filter((sc) => sc.id !== sceneId) } : c)),
      activeSceneId: s.activeSceneId === sceneId ? null : s.activeSceneId,
    }));
  }
  function reorderScene(chapterId: string, from: number, to: number) {
    setStore((s) => ({
      ...s,
      chapters: s.chapters.map((c) => {
        if (c.id !== chapterId || to < 0 || to >= c.scenes.length) return c;
        const sc = [...c.scenes]; const [m] = sc.splice(from, 1); sc.splice(to, 0, m);
        return { ...c, scenes: sc };
      }),
    }));
  }
  function addBook() {
    setStore((s) => { const b: Book = { id: uid(), title: `Untitled Book ${s.books.length + 1}` }; return { ...s, books: [...s.books, b], activeBookId: b.id }; });
  }
  function renameBook(id: string, title: string) { setStore((s) => ({ ...s, books: s.books.map((b) => (b.id === id ? { ...b, title } : b)) })); }
  function deleteBook(id: string) {
    setStore((s) => {
      if (s.books.length <= 1) return s;
      const rest = s.books.filter((b) => b.id !== id);
      return { ...s, books: rest, activeBookId: s.activeBookId === id ? rest[0].id : s.activeBookId, codex: s.codex.filter((e) => e.bookId !== id) };
    });
  }
  function addCodex(kind: CodexKind) { setStore((s) => ({ ...s, codex: [...s.codex, { id: uid(), bookId: s.activeBookId, kind, name: "", body: "" }] })); }
  function updateCodex(id: string, patch: Partial<CodexEntry>) { setStore((s) => ({ ...s, codex: s.codex.map((e) => (e.id === id ? { ...e, ...patch } : e)) })); }
  function deleteCodex(id: string) { setStore((s) => ({ ...s, codex: s.codex.filter((e) => e.id !== id) })); }
  function addMargin(text: string) {
    if (!text.trim()) return;
    setStore((s) => ({ ...s, margins: [{ id: uid(), text: text.trim(), at: new Date().toISOString() }, ...s.margins] }));
  }
  function deleteMargin(id: string) { setStore((s) => ({ ...s, margins: s.margins.filter((m) => m.id !== id) })); }

  /* ---------- export ---------- */
  function exportScene(kind: "txt" | "md") {
    if (!activeScene) return;
    const body = kind === "md" ? `## ${activeScene.title}\n\n${activeScene.content}` : `${activeScene.title}\n\n${activeScene.content}`;
    downloadFile(body, `${activeScene.title.replace(/[^\w-]+/g, "-")}.${kind}`);
  }
  function exportChapter(kind: "txt" | "md") {
    if (!activeChapter) return;
    const body = kind === "md"
      ? `# ${activeChapter.title}\n\n` + activeChapter.scenes.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n---\n\n")
      : `${activeChapter.title}\n\n` + activeChapter.scenes.map((s) => `${s.title}\n\n${s.content}`).join("\n\n* * *\n\n");
    downloadFile(body, `${activeChapter.title.replace(/[^\w-]+/g, "-")}.${kind}`);
  }
  function exportBook(kind: "txt" | "md") {
    const book = store.books.find((b) => b.id === store.activeBookId);
    const title = book?.title || "Manuscript";
    const body = kind === "md"
      ? `# ${title}\n\n` + store.chapters.map((c) => `## ${c.title}\n\n` + c.scenes.map((s) => `### ${s.title}\n\n${s.content}`).join("\n\n")).join("\n\n---\n\n")
      : `${title}\n\n` + store.chapters.map((c) => `${c.title.toUpperCase()}\n\n` + c.scenes.map((s) => s.content).join("\n\n* * *\n\n")).join("\n\n\n");
    downloadFile(body, `${title.replace(/[^\w-]+/g, "-")}.${kind}`);
  }

  const todayWords = store.wordLog[todayKey()] || 0;
  const activeBook = store.books.find((b) => b.id === store.activeBookId);
  const sprintWords = sprintActive ? Math.max(0, totalWords - sprintStartWords) : 0;


  const manuscriptTools = (
    <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: "var(--soft)", borderColor: "var(--soft-border)" }}>
      <button onClick={() => setTypewriter((t) => !t)} aria-pressed={typewriter} title="Typewriter mode keeps your line centred"
        className="flex min-h-[38px] items-center gap-2 rounded-[9px] px-3 text-[13px]"
        style={typewriter ? { background: a("var(--star)", 14), color: "var(--star)" } : { color: "var(--muted)" }}>
        <AlignCenter size={15} /><span className="hidden lg:inline">Typewriter</span>
      </button>
      <button onClick={() => activeScene && setFocusMode(true)} disabled={!activeScene} title="Focus mode"
        className="flex min-h-[38px] items-center gap-2 rounded-[9px] px-3 text-[13px] disabled:opacity-40" style={{ color: "var(--muted)" }}>
        <Maximize2 size={15} /><span className="hidden lg:inline">Focus</span>
      </button>
      <Popover sheetOnMobile trigger={(open, toggle) => (
        <button onClick={toggle} aria-expanded={open} title="Export"
          className="flex min-h-[38px] items-center gap-2 rounded-[9px] px-3 text-[13px]"
          style={open ? { background: "var(--soft)", color: "var(--text)" } : { color: "var(--muted)" }}>
          <Download size={15} /><span className="hidden lg:inline">Export</span>
        </button>
      )}>
        {(close) => (
          <div className="flex flex-col">
            {([["Scene", exportScene, !!activeScene], ["Chapter", exportChapter, !!activeChapter], ["Whole book", exportBook, true]] as const).map(([label, fn, ok]) => (
              <div key={label} className="py-1">
                <Label className="px-3 pb-1">{label}</Label>
                <div className="flex gap-1 px-1">
                  {(["md", "txt"] as const).map((k) => (
                    <button key={k} disabled={!ok} onClick={() => { fn(k); close(); }}
                      className="min-h-[38px] flex-1 rounded-lg text-[13px] transition hover:bg-[var(--soft)] disabled:opacity-30" style={{ color: "var(--text)" }}>
                      .{k}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Popover>
      <Popover sheetOnMobile trigger={(open, toggle) => (
        <button onClick={toggle} aria-expanded={open} aria-label={soundLive ? "Soundscape, playing" : "Soundscape"} title="Soundscape"
          className="flex min-h-[38px] min-w-[40px] items-center justify-center rounded-[9px] px-2"
          style={soundLive ? { color: "var(--star)", background: a("var(--star)", 10) } : { color: "var(--muted)" }}>
          {soundLive ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      )}>
        {() => <div className="w-full p-1 md:w-[300px]"><SoundMixer {...mixer} /></div>}
      </Popover>
    </div>
  );

  const crumbs: Record<PageId, string[]> = {
    manuscript: activeScene ? [activeChapter?.title || "", activeScene.title] : ["Manuscript"],
    outline: ["Chapter Map"], codex: ["Codex"], scriptorium: ["Scriptorium"], marginalia: ["Marginalia"], stats: ["The Ledger"],
  };

  /* ---------- focus mode ---------- */
  if (focusMode && activeScene) {
    return (
      <div className="ink-root fixed inset-0 z-50 flex flex-col" style={themeStyle(themeId)}>
        <style>{GLOBAL_CSS}</style>
        <Starfield />
        <div className="relative z-10 flex items-center justify-between gap-3 px-5 pb-4 md:px-10" style={{ paddingTop: "calc(16px + env(safe-area-inset-top, 0px))" }}>
          <span className="f-display truncate text-xl" style={{ color: "var(--heading)" }}>{activeScene.title}</span>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs sm:inline" style={{ color: "var(--muted)" }}>{fmt(countWords(activeScene.content))} words · {fmt(todayWords)} today</span>
            <Btn variant="ghost" onClick={() => setTypewriter((t) => !t)} ariaLabel="Toggle typewriter mode"
              style={typewriter ? { color: "var(--star)" } : undefined}><AlignCenter size={16} /></Btn>
            <Btn variant="soft" onClick={() => setFocusMode(false)}><Minimize2 size={16} />Leave focus</Btn>
          </div>
        </div>
        <div className="relative z-10 flex-1 overflow-y-auto px-5 pb-16">
          <div className="mx-auto max-w-[760px] pt-6">
            <SceneEditor value={activeScene.content} onChange={updateContent} typewriter={typewriter} large autoFocus />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ink-root relative min-h-screen" style={themeStyle(themeId)}>
      <style>{GLOBAL_CSS}</style>
      <Starfield />
      {showBreak && <BreakModal onDismiss={() => setShowBreak(false)} />}
      {confirmReq && <ConfirmModal req={confirmReq} onClose={() => setConfirmReq(null)} />}
      {showSettings && (
        <SettingsModal themeId={themeId} setThemeId={setThemeId} mixer={mixer}
          dailyGoal={store.dailyGoal} bookTarget={store.bookTarget}
          onGoals={(g, b) => setStore((s) => ({ ...s, dailyGoal: g, bookTarget: b }))}
          onClose={() => setShowSettings(false)} />
      )}
      <div className="relative z-10 flex min-h-screen">
        <NavRail page={page} setPage={setPage} onSettings={() => setShowSettings(true)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar books={store.books} activeBookId={store.activeBookId}
            onSelectBook={(id) => setStore((s) => ({ ...s, activeBookId: id }))} onAddBook={addBook}
            crumbs={crumbs[page]} tools={page === "manuscript" ? manuscriptTools : undefined}
            onSettings={() => setShowSettings(true)} />
          <main key={page} className="ink-in flex-1 px-4 pb-32 pt-7 md:px-9 md:pb-16 md:pt-10">
            {page === "manuscript" && (
              <ManuscriptPage scene={activeScene} chapter={activeChapter} typewriter={typewriter}
                onContent={updateContent} onPatch={(p) => activeScene && updateScene(activeScene.id, p)}
                todayWords={todayWords} dailyGoal={store.dailyGoal} totalWords={totalWords} bookTarget={store.bookTarget}
                wordLog={store.wordLog} codex={store.codex.filter((e) => e.bookId === store.activeBookId)}
                sprint={{ active: sprintActive, secsLeft: sprintSecsLeft, minutes: sprintMins, words: sprintWords }}
                onStartSprint={startSprint} onStopSprint={finishSprint}
                onOpenMap={() => setPage("outline")} onOpenCodex={() => setPage("codex")} />
            )}
            {page === "outline" && (
              <OutlinePage chapters={store.chapters} activeSceneId={store.activeSceneId}
                onOpen={(id) => { selectScene(id); setPage("manuscript"); }}
                onAddChapter={addChapter} onRenameChapter={renameChapter} onDeleteChapter={deleteChapter}
                onAddScene={addScene} onDeleteScene={deleteScene} onReorder={reorderScene}
                onStatus={(id, status) => updateScene(id, { status })} askConfirm={setConfirmReq}
                onToggle={(id) => setStore((s) => ({ ...s, chapters: s.chapters.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)) }))} />
            )}
            {page === "codex" && (
              <CodexPage entries={store.codex} books={store.books} activeBookId={store.activeBookId}
                onSelectBook={(id) => setStore((s) => ({ ...s, activeBookId: id }))} onAddBook={addBook}
                onRenameBook={renameBook} onDeleteBook={deleteBook}
                onAdd={addCodex} onUpdate={updateCodex} onDelete={deleteCodex} askConfirm={setConfirmReq} />
            )}
            {page === "scriptorium" && (
              <ScriptoriumPage active={sprintActive} secsLeft={sprintSecsLeft} minutes={sprintMins} setMinutes={setSprintMins}
                sprintWords={sprintWords} onStart={startSprint} onStop={finishSprint} history={store.sprintHistory}
                onWrite={() => setPage("manuscript")} />
            )}
            {page === "marginalia" && <MarginaliaPage notes={store.margins} onAdd={addMargin} onDelete={deleteMargin} />}
            {page === "stats" && (
              <LedgerPage wordLog={store.wordLog} dailyGoal={store.dailyGoal} bookTarget={store.bookTarget}
                chapters={store.chapters} sprintHistory={store.sprintHistory} bookTitle={activeBook?.title || "your book"}
                onGoals={(g, b) => setStore((s) => ({ ...s, dailyGoal: g, bookTarget: b }))} />
            )}
          </main>
        </div>
      </div>
      <MobileNav page={page} setPage={setPage} />
      <Inkfeather mood={sprintActive && mood === "idle" ? "writing" : mood}
        onPet={() => { setStore((s) => ({ ...s, affection: s.affection + 1 })); setMood((m) => (m === "sleep" ? "idle" : m)); armSleep(); }}
        className="bottom-[calc(78px+env(safe-area-inset-bottom,0px))] right-2 md:bottom-6 md:right-7" />
    </div>
  );
}

/* ============================================================
   MANUSCRIPT
============================================================ */
function ManuscriptPage({ scene, chapter, typewriter, onContent, onPatch, todayWords, dailyGoal, totalWords, bookTarget, wordLog, codex, sprint, onStartSprint, onStopSprint, onOpenMap, onOpenCodex }: {
  scene: Scene | null; chapter: Chapter | null; typewriter: boolean;
  onContent: (v: string) => void; onPatch: (p: Partial<Scene>) => void;
  todayWords: number; dailyGoal: number; totalWords: number; bookTarget: number; wordLog: Record<string, number>;
  codex: CodexEntry[];
  sprint: { active: boolean; secsLeft: number; minutes: number; words: number };
  onStartSprint: () => void; onStopSprint: () => void; onOpenMap: () => void; onOpenCodex: () => void;
}) {
  if (!scene) {
    return (
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 pt-6">
        <Label style={{ color: "var(--nebula)" }}>{sessionLabel()}</Label>
        <Heading sub="Choose a scene from the Chapter Map, or begin a new one.">No scene open</Heading>
        <div><Btn variant="star" onClick={onOpenMap}><MapIcon size={16} />Open the Chapter Map</Btn></div>
      </div>
    );
  }
  const words = countWords(scene.content);
  const mentioned = codex.filter((e) => e.name.trim() && scene.content.toLowerCase().includes(e.name.trim().split(/\s+/)[0].toLowerCase()));
  const mm = String(Math.floor(sprint.secsLeft / 60)).padStart(2, "0");
  const ss = String(sprint.secsLeft % 60).padStart(2, "0");
  const sceneIndex = chapter ? chapter.scenes.findIndex((s) => s.id === scene.id) + 1 : 0;

  return (
    <div className="flex flex-wrap items-start gap-8">
      <article className="mx-auto flex min-w-0 max-w-[720px] flex-[999_1_520px] flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Label style={{ color: "var(--nebula)" }}>{sessionLabel()}{sceneIndex ? ` · Scene ${sceneIndex}` : ""}</Label>
          <label className="sr-only" htmlFor="scene-title">Scene title</label>
          <input id="scene-title" value={scene.title} onChange={(e) => onPatch({ title: e.target.value })}
            className="f-display w-full border-0 bg-transparent p-0 text-[44px] font-medium leading-[1.05] tracking-[-0.01em] outline-none md:text-[64px]"
            style={{ color: "var(--heading)", textShadow: `0 0 48px ${a("var(--star)", 25)}` }} />
          <label className="sr-only" htmlFor="scene-synopsis">Synopsis</label>
          <input id="scene-synopsis" value={scene.synopsis} onChange={(e) => onPatch({ synopsis: e.target.value })}
            placeholder="A line on what happens here…"
            className="f-display w-full border-0 bg-transparent p-0 text-lg italic outline-none md:text-xl" style={{ color: "var(--muted)" }} />
        </div>
        <Divider />
        <SceneEditor value={scene.content} onChange={onContent} typewriter={typewriter} />
        <div className="flex flex-wrap justify-between gap-2 text-xs" style={{ color: "var(--faint)" }}>
          <span>{typewriter ? "Typewriter on · your line stays centred" : "Saved to this device as you write"}</span>
          <span>{fmt(words)} words in this scene</span>
        </div>
      </article>

      <aside className="flex w-full flex-col gap-4 lg:w-auto lg:min-w-[280px] lg:max-w-[320px] lg:flex-[1_1_280px]">
        <Glass className="flex flex-col items-center gap-4 p-5">
          <Label className="self-start">Orrery</Label>
          <Orrery centre={fmt(todayWords)} caption="words today" rings={[
            { pct: todayWords / Math.max(1, dailyGoal), color: "var(--star)", label: "Today" },
            { pct: words / Math.max(1, scene.wordTarget), color: "var(--ice)", label: "Scene" },
            { pct: totalWords / Math.max(1, bookTarget), color: "var(--nebula)", label: "Book" },
          ]} />
          <div className="flex w-full flex-col gap-2 text-[13px]">
            {[
              { c: "var(--star)", l: "Today", v: `${fmt(todayWords)} / ${fmt(dailyGoal)}` },
              { c: "var(--ice)", l: "Scene", v: null },
              { c: "var(--nebula)", l: "Book", v: `${fmt(totalWords)} / ${fmt(bookTarget)}` },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2" style={{ color: "var(--muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: r.c }} />{r.l}
                </span>
                {r.v ? <span style={{ color: "var(--text)" }}>{r.v}</span> : (
                  <span className="flex items-center gap-1" style={{ color: "var(--text)" }}>
                    {fmt(words)} /
                    <input inputMode="numeric" aria-label="Scene word target" title="Edit this scene's word target"
                      value={fmt(scene.wordTarget)}
                      onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, ""), 10); onPatch({ wordTarget: v > 0 ? v : 1 }); }}
                      size={Math.max(3, fmt(scene.wordTarget).length)}
                      className="rounded-md border-0 bg-transparent p-0 text-right underline decoration-dotted underline-offset-4 outline-none"
                      style={{ color: "var(--text)", textDecorationColor: "var(--faint)" }} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </Glass>

        <Glass className="flex flex-col gap-3 p-5">
          <Label>Last 7 nights</Label>
          <WeekBars wordLog={wordLog} goal={dailyGoal} />
        </Glass>

        {sprint.active ? (
          <Glass className="flex items-center justify-between gap-3 p-5" style={{ borderColor: a("var(--star)", 40) }}>
            <div className="flex flex-col">
              <Label>Sprint running</Label>
              <span className="f-display text-[34px] font-semibold tabular-nums leading-none" style={{ color: "var(--heading)" }}>{mm}:{ss}</span>
              <span className="mt-1 text-xs" style={{ color: "var(--muted)" }}>+{fmt(sprint.words)} words so far</span>
            </div>
            <Btn variant="soft" onClick={onStopSprint}><Square size={14} />End</Btn>
          </Glass>
        ) : (
          <Btn variant="star" onClick={onStartSprint} className="min-h-[52px] rounded-2xl">
            <Hourglass size={16} />Begin a {sprint.minutes}-minute sprint
          </Btn>
        )}

        <Glass className="flex flex-col gap-2 p-5">
          <div className="flex items-center justify-between">
            <Label>In this scene</Label>
            <button onClick={onOpenCodex} className="text-xs underline-offset-4 hover:underline" style={{ color: "var(--star)" }}>Codex</button>
          </div>
          {mentioned.length === 0 ? (
            <p className="m-0 text-[13px] leading-relaxed" style={{ color: "var(--faint)" }}>Characters, places and lore from your Codex appear here when you name them in the text.</p>
          ) : mentioned.slice(0, 5).map((e) => <CodexChip key={e.id} entry={e} />)}
        </Glass>
      </aside>
    </div>
  );
}

const KIND_META: Record<CodexKind, { label: string; single: string; color: string }> = {
  character: { label: "Characters", single: "Character", color: "var(--nebula)" },
  location: { label: "Locations", single: "Location", color: "var(--star)" },
  lore: { label: "Lore", single: "Lore", color: "var(--ice)" },
};

function CodexChip({ entry }: { entry: CodexEntry }) {
  const m = KIND_META[entry.kind];
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="f-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-base"
        style={{ background: a(m.color, 14), borderColor: a(m.color, 40), color: m.color }}>{(entry.name.trim()[0] || "?").toUpperCase()}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm" style={{ color: "var(--text)" }}>{entry.name}</span>
        <span className="text-xs" style={{ color: "var(--faint)" }}>{m.single}</span>
      </span>
    </div>
  );
}

/* ============================================================
   CHAPTER MAP
============================================================ */
const STATUS: Record<SceneStatus, { label: string; color: string }> = {
  unwritten: { label: "Unwritten", color: "var(--faint)" },
  drafting: { label: "Drafting", color: "var(--star)" },
  revising: { label: "Revising", color: "var(--nebula)" },
  done: { label: "Done", color: "var(--ice)" },
};

function StarMark({ status, bright }: { status: SceneStatus; bright?: boolean }) {
  if (bright) return <span aria-hidden className="block h-[18px] w-[18px] shrink-0 rounded-full" style={{ background: `radial-gradient(circle, var(--star-bright) 0%, var(--star) 40%, transparent 72%)` }} />;
  if (status === "unwritten") return <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"><span className="h-[9px] w-[9px] rounded-full border" style={{ borderColor: "var(--faint)" }} /></span>;
  const c = STATUS[status].color;
  return <span aria-hidden className="flex h-[18px] w-[18px] shrink-0 items-center justify-center"><span className="h-[9px] w-[9px] rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} /></span>;
}

function StatusSelect({ value, onChange }: { value: SceneStatus; onChange: (s: SceneStatus) => void }) {
  const c = STATUS[value].color;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as SceneStatus)} aria-label="Scene status"
      className="min-h-[32px] shrink-0 cursor-pointer rounded-full border bg-transparent px-2.5 text-xs outline-none"
      style={{ color: c, borderColor: a(c, 40), background: a(c, 8) }}>
      {(Object.keys(STATUS) as SceneStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
    </select>
  );
}

function OutlinePage({ chapters, activeSceneId, onOpen, onAddChapter, onRenameChapter, onDeleteChapter, onAddScene, onDeleteScene, onReorder, onStatus, onToggle, askConfirm }: {
  chapters: Chapter[]; activeSceneId: string | null; onOpen: (id: string) => void;
  onAddChapter: () => void; onRenameChapter: (id: string, t: string) => void; onDeleteChapter: (id: string) => void;
  onAddScene: (chId: string) => void; onDeleteScene: (chId: string, scId: string) => void;
  onReorder: (chId: string, from: number, to: number) => void; onStatus: (scId: string, s: SceneStatus) => void;
  onToggle: (chId: string) => void; askConfirm: (r: ConfirmReq) => void;
}) {
  const [view, setView] = useState<"constellation" | "list" | "corkboard">("constellation");
  const [drag, setDrag] = useState<{ ch: string; idx: number } | null>(null);
  const [over, setOver] = useState<{ ch: string; idx: number } | null>(null);
  const totalScenes = chapters.reduce((n, c) => n + c.scenes.length, 0);

  const views = [
    { id: "constellation" as const, label: "Constellation", icon: Sparkles },
    { id: "list" as const, label: "List", icon: List },
    { id: "corkboard" as const, label: "Corkboard", icon: LayoutGrid },
  ];

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading sub={`${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"} · ${totalScenes} ${totalScenes === 1 ? "scene" : "scenes"}`}>Chapter Map</Heading>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="View" className="flex gap-1 rounded-xl border p-1" style={{ background: "var(--soft)", borderColor: "var(--soft-border)" }}>
            {views.map((v) => {
              const I = v.icon; const on = view === v.id;
              return (
                <button key={v.id} role="tab" aria-selected={on} onClick={() => setView(v.id)}
                  className="flex min-h-[38px] items-center gap-2 rounded-[9px] px-3 text-[13px]"
                  style={on ? { background: a("var(--star)", 14), color: "var(--star)" } : { color: "var(--muted)" }}>
                  <I size={15} /><span className="hidden sm:inline">{v.label}</span>
                </button>
              );
            })}
          </div>
          <Btn variant="star" onClick={onAddChapter}><Plus size={16} />Chapter</Btn>
        </div>
      </div>

      {chapters.length === 0 && (
        <Glass className="p-8 text-center"><p className="m-0" style={{ color: "var(--muted)" }}>No chapters yet. Add your first to begin mapping the book.</p></Glass>
      )}

      {view === "constellation" && (
        <div className="relative flex flex-col gap-8">
          {chapters.map((c, ci) => (
            <section key={c.id} className="relative">
              <div className="mb-3 flex items-baseline gap-3">
                <Label style={{ color: "var(--nebula)" }}>Chapter {toRoman(ci + 1)}</Label>
                <input value={c.title} onChange={(e) => onRenameChapter(c.id, e.target.value)} aria-label={`Chapter ${ci + 1} title`}
                  className="f-display min-w-0 flex-1 border-0 bg-transparent p-0 text-2xl outline-none" style={{ color: "var(--heading)" }} />
              </div>
              <div className="relative flex flex-col gap-1.5 pl-1">
                <div aria-hidden className="absolute bottom-3 left-[18px] top-3 w-px" style={{ background: `linear-gradient(180deg, ${a("var(--star)", 60)}, ${a("var(--nebula)", 30)}, transparent)` }} />
                {c.scenes.map((s) => {
                  const active = s.id === activeSceneId;
                  return (
                    <div key={s.id} className="relative flex items-center gap-4 rounded-2xl border py-2.5 pl-2 pr-3"
                      style={{ borderColor: active ? a("var(--star)", 30) : "transparent", background: active ? a("var(--star)", 6) : undefined }}>
                      <StarMark status={s.status} bright={active} />
                      <button onClick={() => onOpen(s.id)} className="flex min-w-0 flex-1 flex-col gap-0.5 border-0 bg-transparent p-0 text-left">
                        <span className="truncate text-[15px]" style={{ color: s.status === "unwritten" && !active ? "var(--muted)" : "var(--heading)" }}>{s.title}</span>
                        <span className="truncate text-xs" style={{ color: "var(--faint)" }}>
                          {STATUS[s.status].label} · {fmt(countWords(s.content))}{s.status !== "done" ? ` of ${fmt(s.wordTarget)}` : ""} words{s.synopsis ? ` · ${s.synopsis}` : ""}
                        </span>
                      </button>
                      <StatusSelect value={s.status} onChange={(st) => onStatus(s.id, st)} />
                    </div>
                  );
                })}
                <button onClick={() => onAddScene(c.id)} className="flex min-h-[44px] items-center gap-4 rounded-2xl border-0 bg-transparent py-2 pl-2 text-left text-sm" style={{ color: "var(--faint)" }}>
                  <span className="flex h-[18px] w-[18px] items-center justify-center"><Plus size={14} /></span>Add a scene
                </button>
              </div>
            </section>
          ))}
        </div>
      )}

      {view === "list" && (
        <div className="flex flex-col gap-3">
          {chapters.map((c, ci) => {
            const wc = c.scenes.reduce((n, s) => n + countWords(s.content), 0);
            return (
              <Glass key={c.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <button onClick={() => onToggle(c.id)} aria-label={c.expanded ? "Collapse chapter" : "Expand chapter"} aria-expanded={c.expanded}
                    className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--muted)" }}>
                    <ChevronDown size={16} style={{ transform: c.expanded ? undefined : "rotate(-90deg)", transition: "transform .2s" }} />
                  </button>
                  <Label style={{ color: "var(--nebula)" }}>{toRoman(ci + 1)}</Label>
                  <input value={c.title} onChange={(e) => onRenameChapter(c.id, e.target.value)} aria-label="Chapter title"
                    className="f-display min-w-0 flex-1 border-0 bg-transparent p-0 text-xl outline-none" style={{ color: "var(--heading)" }} />
                  <span className="shrink-0 whitespace-nowrap text-xs" style={{ color: "var(--faint)" }}>{fmt(wc)} words</span>
                  <button onClick={() => onAddScene(c.id)} aria-label="Add scene" className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--muted)" }}><Plus size={16} /></button>
                  <button onClick={() => askConfirm({ title: "Delete this chapter?", body: `"${c.title}" and its ${c.scenes.length} ${c.scenes.length === 1 ? "scene" : "scenes"} will be removed for good.`, action: "Delete chapter", onConfirm: () => onDeleteChapter(c.id) })} aria-label="Delete chapter"
                    className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--faint)" }}><Trash2 size={15} /></button>
                </div>
                {c.expanded && (
                  <div className="flex flex-col gap-1 px-3 pb-3">
                    {c.scenes.length === 0 && <p className="m-0 px-3 py-2 text-xs italic" style={{ color: "var(--faint)" }}>No scenes yet.</p>}
                    {c.scenes.map((s, idx) => {
                      const isOver = over?.ch === c.id && over.idx === idx && drag?.idx !== idx;
                      return (
                        <div key={s.id} draggable
                          onDragStart={() => setDrag({ ch: c.id, idx })}
                          onDragOver={(e) => { e.preventDefault(); setOver({ ch: c.id, idx }); }}
                          onDragEnd={() => { if (drag && over && drag.ch === over.ch) onReorder(c.id, drag.idx, over.idx); setDrag(null); setOver(null); }}
                          className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 transition"
                          style={{ background: isOver ? a("var(--star)", 10) : "var(--soft)", boxShadow: isOver ? `inset 0 0 0 1px ${a("var(--star)", 40)}` : undefined }}>
                          <span aria-hidden className="hidden cursor-grab md:block" style={{ color: "var(--faint)" }}><GripVertical size={16} /></span>
                          <div className="flex flex-col md:hidden">
                            <button aria-label="Move scene up" onClick={() => onReorder(c.id, idx, idx - 1)} disabled={idx === 0}
                              className="flex h-[22px] w-8 items-center justify-center disabled:opacity-20" style={{ color: "var(--muted)" }}><ChevronUp size={14} /></button>
                            <button aria-label="Move scene down" onClick={() => onReorder(c.id, idx, idx + 1)} disabled={idx === c.scenes.length - 1}
                              className="flex h-[22px] w-8 items-center justify-center disabled:opacity-20" style={{ color: "var(--muted)" }}><ChevronDown size={14} /></button>
                          </div>
                          <button onClick={() => onOpen(s.id)} className="min-h-[40px] min-w-[120px] flex-1 truncate border-0 bg-transparent p-0 text-left text-sm" style={{ color: "var(--text)" }}>
                            {s.title}<span className="ml-2 text-xs" style={{ color: "var(--faint)" }}>{fmt(countWords(s.content))}w</span>
                          </button>
                          <StatusSelect value={s.status} onChange={(st) => onStatus(s.id, st)} />
                          <button onClick={() => (s.content.trim() ? askConfirm({ title: "Delete this scene?", body: `"${s.title}" holds ${fmt(countWords(s.content))} words. They will be removed for good.`, action: "Delete scene", onConfirm: () => onDeleteScene(c.id, s.id) }) : onDeleteScene(c.id, s.id))} aria-label={`Delete ${s.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--faint)" }}><Trash2 size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Glass>
            );
          })}
        </div>
      )}

      {view === "corkboard" && (
        <div className="flex flex-col gap-8">
          {chapters.map((c, ci) => (
            <section key={c.id} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <Label style={{ color: "var(--nebula)" }}>Chapter {toRoman(ci + 1)}</Label>
                <span className="f-display text-2xl" style={{ color: "var(--heading)" }}>{c.title}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {c.scenes.map((s) => {
                  const col = STATUS[s.status].color;
                  return (
                    <button key={s.id} onClick={() => onOpen(s.id)}
                      className="flex min-h-[150px] flex-col gap-2 rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5"
                      style={{ background: "var(--glass)", borderColor: s.id === activeSceneId ? a("var(--star)", 40) : "var(--glass-border)", boxShadow: "0 16px 40px rgba(0,0,0,0.3)" }}>
                      <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: col }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />{STATUS[s.status].label}
                      </span>
                      <span className="f-display text-xl leading-tight" style={{ color: "var(--heading)" }}>{s.title}</span>
                      <span className="line-clamp-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>{s.synopsis || "No synopsis yet."}</span>
                      <span className="mt-auto text-xs" style={{ color: "var(--faint)" }}>{fmt(countWords(s.content))} words</span>
                    </button>
                  );
                })}
                <button onClick={() => onAddScene(c.id)}
                  className="flex min-h-[150px] items-center justify-center gap-2 rounded-[20px] border border-dashed text-sm" style={{ borderColor: "var(--soft-border)", color: "var(--faint)" }}>
                  <Plus size={16} />Add a scene
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function toRoman(n: number) {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = ""; let x = n;
  for (const [v, s] of map) while (x >= v) { r += s; x -= v; }
  return r;
}

/* ============================================================
   CODEX
============================================================ */
function CodexPage({ entries, books, activeBookId, onSelectBook, onAddBook, onRenameBook, onDeleteBook, onAdd, onUpdate, onDelete, askConfirm }: {
  entries: CodexEntry[]; books: Book[]; activeBookId: string; onSelectBook: (id: string) => void; onAddBook: () => void;
  onRenameBook: (id: string, t: string) => void; onDeleteBook: (id: string) => void;
  onAdd: (k: CodexKind) => void; onUpdate: (id: string, p: Partial<CodexEntry>) => void; onDelete: (id: string) => void;
  askConfirm: (r: ConfirmReq) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const book = books.find((b) => b.id === activeBookId);
  const scoped = entries.filter((e) => e.bookId === activeBookId);
  const q = query.trim().toLowerCase();
  const shown = q ? scoped.filter((e) => (e.name + " " + e.body).toLowerCase().includes(q)) : scoped;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-7">
      <Heading sub="Everyone, everywhere and everything in your world.">The Codex</Heading>

      <div className="flex flex-wrap items-center gap-2">
        {books.map((b) => {
          const on = b.id === activeBookId;
          return (
            <button key={b.id} onClick={() => onSelectBook(b.id)} aria-pressed={on}
              className="flex min-h-[40px] items-center gap-2 rounded-full border px-4 text-sm"
              style={on ? { borderColor: a("var(--nebula)", 40), background: a("var(--nebula)", 12), color: "var(--heading)" } : { borderColor: "var(--soft-border)", color: "var(--muted)" }}>
              {on && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--nebula)", boxShadow: "0 0 8px var(--nebula)" }} />}{b.title}
            </button>
          );
        })}
        <Btn variant="ghost" onClick={onAddBook}><Plus size={15} />Book</Btn>
      </div>

      {book && (
        <Glass className="flex flex-wrap items-center gap-3 px-5 py-4">
          <label className="sr-only" htmlFor="book-title">Book title</label>
          <input id="book-title" value={book.title} onChange={(e) => onRenameBook(book.id, e.target.value)}
            className="f-display min-w-[160px] flex-1 border-0 bg-transparent p-0 text-2xl outline-none" style={{ color: "var(--heading)" }} />
          <span className="text-xs" style={{ color: "var(--faint)" }}>{scoped.length} {scoped.length === 1 ? "entry" : "entries"}</span>
          <div className="w-full sm:w-[220px]">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this codex" aria-label="Search codex" />
          </div>
          {books.length > 1 && (
            <button onClick={() => askConfirm({ title: "Delete this book?", body: `"${book.title}" and its ${scoped.length} Codex ${scoped.length === 1 ? "entry" : "entries"} will be removed for good.`, action: "Delete book", onConfirm: () => onDeleteBook(book.id) })} aria-label="Delete this book"
              className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color: "var(--faint)" }}><Trash2 size={16} /></button>
          )}
        </Glass>
      )}

      {(Object.keys(KIND_META) as CodexKind[]).map((kind) => {
        const m = KIND_META[kind];
        const list = shown.filter((e) => e.kind === kind);
        return (
          <section key={kind} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ background: m.color, boxShadow: `0 0 10px ${m.color}` }} />
                <Label>{m.label}</Label>
              </div>
              <Btn variant="ghost" onClick={() => { onAdd(kind); }}><Plus size={15} />{m.single}</Btn>
            </div>
            {list.length === 0 ? (
              <p className="m-0 text-sm italic" style={{ color: "var(--faint)" }}>{q ? "Nothing matches." : `No ${m.label.toLowerCase()} yet.`}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((e) => {
                  const open = openId === e.id || !e.name;
                  return (
                    <Glass key={e.id} className="flex flex-col gap-2 p-4" style={open ? { borderColor: a(m.color, 40) } : undefined}>
                      <div className="flex items-center gap-3">
                        <span className="f-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg"
                          style={{ background: a(m.color, 14), borderColor: a(m.color, 40), color: m.color }}>{(e.name.trim()[0] || "·").toUpperCase()}</span>
                        <input value={e.name} onChange={(ev) => onUpdate(e.id, { name: ev.target.value })} placeholder={`Name this ${m.single.toLowerCase()}`}
                          aria-label={`${m.single} name`} autoFocus={!e.name}
                          className="f-display min-w-0 flex-1 border-0 bg-transparent p-0 text-xl outline-none" style={{ color: "var(--heading)" }} />
                        <button onClick={() => setOpenId(open ? null : e.id)} aria-label={open ? "Collapse" : "Expand"} aria-expanded={open}
                          className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--muted)" }}>
                          {open ? <ChevronUp size={16} /> : <Pencil size={14} />}
                        </button>
                      </div>
                      {open ? (
                        <>
                          <textarea value={e.body} onChange={(ev) => onUpdate(e.id, { body: ev.target.value })} placeholder="Notes, history, secrets…"
                            aria-label={`${m.single} notes`} rows={5}
                            className="f-body w-full resize-y rounded-xl border p-3 text-[15px] leading-relaxed outline-none"
                            style={{ background: "var(--soft)", borderColor: "var(--soft-border)", color: "var(--text)" }} />
                          <div className="flex justify-end">
                            <Btn variant="ghost" className="text-xs"
                              onClick={() => (e.body.trim() ? askConfirm({ title: `Remove ${e.name || "this entry"}?`, body: "Its notes will be removed from the Codex for good.", action: "Remove", onConfirm: () => onDelete(e.id) }) : onDelete(e.id))}>
                              <Trash2 size={14} />Remove</Btn>
                          </div>
                        </>
                      ) : (
                        <button onClick={() => setOpenId(e.id)} className="line-clamp-3 border-0 bg-transparent p-0 text-left text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                          {e.body || "No notes yet."}
                        </button>
                      )}
                    </Glass>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ============================================================
   SCRIPTORIUM
============================================================ */
function ScriptoriumPage({ active, secsLeft, minutes, setMinutes, sprintWords, onStart, onStop, history, onWrite }: {
  active: boolean; secsLeft: number; minutes: number; setMinutes: (n: number) => void; sprintWords: number;
  onStart: () => void; onStop: () => void; history: SprintRecord[]; onWrite: () => void;
}) {
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const ss = String(secsLeft % 60).padStart(2, "0");
  const total = minutes * 60;
  const pct = active ? 1 - secsLeft / total : 0;
  const r = 118; const circ = 2 * Math.PI * r;
  const best = history.reduce((m, h) => Math.max(m, h.words), 0);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-7">
      <Heading sub="Turn the hourglass. Write until the sand runs out.">The Scriptorium</Heading>
      <div className="flex flex-wrap gap-6">
        <Glass className="flex flex-[999_1_420px] flex-col items-center gap-6 px-6 py-10">
          <div className="relative">
            <svg width="270" height="270" viewBox="0 0 270 270" role="img" aria-label={`${mm} minutes ${ss} seconds remaining`}>
              <circle cx="135" cy="135" r={r} fill="none" stroke="var(--soft)" strokeWidth="8" />
              <circle cx="135" cy="135" r={r} fill="none" stroke="var(--star)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${pct * circ} ${circ}`} transform="rotate(-90 135 135)" opacity={pct > 0 ? 1 : 0}
                style={{ transition: "stroke-dasharray 1s linear", filter: `drop-shadow(0 0 8px ${a("var(--star)", 70)})` }} />
              <circle cx="135" cy="135" r={r - 18} fill="none" stroke="var(--line)" strokeDasharray="2 6" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className="f-display text-[64px] font-semibold tabular-nums leading-none" style={{ color: "var(--heading)", textShadow: `0 0 30px ${a("var(--star)", 30)}` }}>{mm}:{ss}</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{active ? `+${fmt(sprintWords)} words` : "ready"}</span>
            </div>
          </div>
          {!active ? (
            <>
              <div className="flex flex-wrap justify-center gap-1 rounded-xl border p-1" style={{ background: "var(--soft)", borderColor: "var(--soft-border)" }}>
                {[15, 25, 45, 60].map((m) => (
                  <button key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m}
                    className="min-h-[40px] min-w-[64px] rounded-[9px] px-3 text-sm"
                    style={minutes === m ? { background: a("var(--star)", 14), color: "var(--star)" } : { color: "var(--muted)" }}>{m} min</button>
                ))}
              </div>
              <Btn variant="star" onClick={onStart} className="min-h-[52px] rounded-2xl px-8"><Play size={16} />Begin sprint</Btn>
            </>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Btn variant="star" onClick={onWrite}><Feather size={16} />Go to manuscript</Btn>
              <Btn variant="soft" onClick={onStop}><Square size={14} />End early</Btn>
            </div>
          )}
        </Glass>

        <div className="flex flex-[1_1_280px] flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Sprints" value={fmt(history.length)} color="var(--nebula)" icon={Hourglass} />
            <StatTile label="Best sprint" value={`${fmt(best)}w`} color="var(--star)" icon={Trophy} />
          </div>
          <Glass className="flex flex-1 flex-col gap-2 p-5">
            <Label>Past sprints</Label>
            {history.length === 0 && <p className="m-0 text-sm italic" style={{ color: "var(--faint)" }}>No sprints yet.</p>}
            <div className="flex max-h-[360px] flex-col overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 border-b py-2.5 text-sm" style={{ borderColor: "var(--line)" }}>
                  <span style={{ color: "var(--muted)" }}>{new Date(h.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {new Date(h.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ color: "var(--text)" }}>{h.minutes}m · <span style={{ color: "var(--star)" }}>{fmt(h.words)}w</span></span>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: any }) {
  return (
    <Glass className="flex flex-col gap-2 p-4">
      <Icon size={17} style={{ color }} />
      <span className="f-display text-[30px] font-semibold leading-none" style={{ color: "var(--heading)" }}>{value}</span>
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
    </Glass>
  );
}

/* ============================================================
   MARGINALIA
============================================================ */
function MarginaliaPage({ notes, onAdd, onDelete }: { notes: MarginNote[]; onAdd: (t: string) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState("");
  const submit = () => { onAdd(draft); setDraft(""); };
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-7">
      <Heading sub="Catch the stray thought before it escapes.">Marginalia</Heading>
      <Glass className="flex flex-col gap-3 p-4">
        <label className="sr-only" htmlFor="margin-draft">New note</label>
        <textarea id="margin-draft" value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Who sent the boy? He should reappear in chapter three…"
          className="f-display w-full resize-none border-0 bg-transparent p-1 text-xl italic outline-none" style={{ color: "var(--heading)" }} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs" style={{ color: "var(--faint)" }}>Enter to keep · Shift + Enter for a new line</span>
          <Btn variant="star" onClick={submit} disabled={!draft.trim()}><Check size={16} />Keep note</Btn>
        </div>
      </Glass>
      {notes.length === 0 ? (
        <p className="m-0 text-sm italic" style={{ color: "var(--faint)" }}>Nothing in the margins yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <Glass key={n.id} className="flex flex-col gap-3 p-5">
              <p className="f-display m-0 whitespace-pre-wrap text-lg italic leading-snug" style={{ color: "var(--heading)" }}>{n.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--faint)" }}>{new Date(n.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <button onClick={() => onDelete(n.id)} aria-label="Delete note" className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--faint)" }}><Trash2 size={14} /></button>
              </div>
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LEDGER
============================================================ */
function LedgerPage({ wordLog, dailyGoal, bookTarget, chapters, sprintHistory, bookTitle, onGoals }: {
  wordLog: Record<string, number>; dailyGoal: number; bookTarget: number; chapters: Chapter[];
  sprintHistory: SprintRecord[]; bookTitle: string; onGoals: (g: number, b: number) => void;
}) {
  const days = useMemo(() => lastNDays(30, wordLog), [wordLog]);
  const { current, longest } = useMemo(() => computeStreaks(wordLog, dailyGoal), [wordLog, dailyGoal]);
  const total = useMemo(() => chapters.reduce((n, c) => n + c.scenes.reduce((m, s) => m + countWords(s.content), 0), 0), [chapters]);
  const max = Math.max(dailyGoal, ...days.map((d) => d.words), 1);
  const month = days.reduce((n, d) => n + d.words, 0);
  const goalLine = (dailyGoal / max) * 100;
  const [g, setG] = useState(String(dailyGoal));
  const [b, setB] = useState(String(bookTarget));
  useEffect(() => { setG(String(dailyGoal)); setB(String(bookTarget)); }, [dailyGoal, bookTarget]);
  const save = () => onGoals(Math.max(1, parseInt(g, 10) || dailyGoal), Math.max(1, parseInt(b, 10) || bookTarget));
  const dirty = g !== String(dailyGoal) || b !== String(bookTarget);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-7">
      <Heading sub={`The long count of ${bookTitle}.`}>The Ledger</Heading>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Words in the manuscript" value={fmt(total)} color="var(--star)" icon={Feather} />
        <StatTile label="Night streak" value={`${current}`} color="var(--nebula)" icon={Flame} />
        <StatTile label="Longest streak" value={`${longest}`} color="var(--ice)" icon={Trophy} />
        <StatTile label="Words this month" value={fmt(month)} color="var(--star)" icon={BarChart3} />
      </div>

      <Glass className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label>Last 30 days</Label>
          <span className="text-xs" style={{ color: "var(--faint)" }}>Gold bars met the {fmt(dailyGoal)}-word goal</span>
        </div>
        <div className="relative h-40">
          <div aria-hidden className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${goalLine}%`, borderColor: a("var(--star)", 35) }} />
          <div className="relative flex h-full items-end gap-[3px]">
            {days.map((d, i) => {
              const today = i === days.length - 1; const hit = d.words >= dailyGoal;
              return (
                <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${d.label}: ${fmt(d.words)} words`}>
                  <div className="w-full rounded-t-[3px]" style={{
                    height: `${Math.max(d.words > 0 ? 3 : 1.5, (d.words / max) * 100)}%`,
                    background: today ? "var(--nebula)" : hit ? `linear-gradient(180deg, var(--star), ${a("var(--star)", 35)})` : "var(--soft-border)",
                    boxShadow: hit || today ? `0 0 8px ${a(today ? "var(--nebula)" : "var(--star)", 50)}` : undefined,
                  }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] opacity-0 transition group-hover:opacity-100"
                    style={{ background: "var(--glass-strong)", borderColor: "var(--glass-border)", color: "var(--text)" }}>{d.label} · {fmt(d.words)}w</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between text-[11px]" style={{ color: "var(--faint)" }}><span>{days[0].label}</span><span>Today</span></div>
      </Glass>

      <div className="flex flex-wrap gap-4">
        <Glass className="flex flex-[1_1_320px] flex-col gap-4 p-5">
          <Label>Goals</Label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted)" }}>Words per day
              <TextInput type="number" min={1} value={g} onChange={(e) => setG(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted)" }}>Book target
              <TextInput type="number" min={1} value={b} onChange={(e) => setB(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: "var(--faint)" }}>{sprintHistory.length} sprints · {fmt(sprintHistory.reduce((n, s) => n + s.words, 0))} sprint words</span>
            <Btn variant="star" onClick={save} disabled={!dirty}><Target size={15} />Save goals</Btn>
          </div>
        </Glass>
        <Glass className="flex flex-[999_1_420px] flex-col gap-3 p-5">
          <Label>Chapters</Label>
          {chapters.length === 0 && <p className="m-0 text-sm italic" style={{ color: "var(--faint)" }}>No chapters yet.</p>}
          {chapters.map((c, ci) => {
            const wc = c.scenes.reduce((n, s) => n + countWords(s.content), 0);
            const done = c.scenes.filter((s) => s.status === "done").length;
            return (
              <div key={c.id} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="f-display text-lg" style={{ color: "var(--heading)" }}><span className="mr-2 text-xs" style={{ color: "var(--nebula)" }}>{toRoman(ci + 1)}</span>{c.title}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{fmt(wc)} words · {done}/{c.scenes.length} done</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--soft)" }}>
                  <div className="h-full rounded-full" style={{ width: `${c.scenes.length ? (done / c.scenes.length) * 100 : 0}%`, background: "linear-gradient(90deg, var(--nebula), var(--ice))" }} />
                </div>
              </div>
            );
          })}
        </Glass>
      </div>
    </div>
  );
}

/* ============================================================
   MODALS
============================================================ */
function Modal({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-6"
      style={{ background: "rgba(3,4,10,0.72)", backdropFilter: "blur(6px)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ink-in max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[24px] border p-6"
        style={{ background: "var(--glass-strong)", borderColor: "var(--glass-border)", boxShadow: "0 30px 90px rgba(0,0,0,0.7)" }}>
        {children}
      </div>
    </div>
  );
}

function SettingsModal({ themeId, setThemeId, mixer, dailyGoal, bookTarget, onGoals, onClose }: {
  themeId: ThemeId; setThemeId: (t: ThemeId) => void; mixer: React.ComponentProps<typeof SoundMixer>;
  dailyGoal: number; bookTarget: number; onGoals: (g: number, b: number) => void; onClose: () => void;
}) {
  const [g, setG] = useState(String(dailyGoal));
  const [b, setB] = useState(String(bookTarget));
  const close = useCallback(() => {
    onGoals(Math.max(1, parseInt(g, 10) || dailyGoal), Math.max(1, parseInt(b, 10) || bookTarget));
    onClose();
  }, [g, b, dailyGoal, bookTarget, onGoals, onClose]);
  return (
    <Modal onClose={close} label="Settings">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="f-display m-0 text-3xl font-medium" style={{ color: "var(--heading)" }}>Settings</h2>
          <button onClick={close} aria-label="Close settings" className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ color: "var(--muted)" }}><X size={18} /></button>
        </div>
        <section className="flex flex-col gap-3">
          <Label className="flex items-center gap-2"><Palette size={13} />Sky</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const t = THEMES[id].base; const on = id === themeId;
              return (
                <button key={id} onClick={() => setThemeId(id)} aria-pressed={on}
                  className="flex min-h-[52px] items-center gap-3 rounded-2xl border px-3 text-left text-sm"
                  style={{ borderColor: on ? a("var(--star)", 50) : "var(--soft-border)", background: on ? a("var(--star)", 8) : "var(--soft)", color: "var(--text)" }}>
                  <span className="relative h-8 w-8 shrink-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 35%, ${t.nebula}, ${t.bg} 75%)`, boxShadow: `inset 0 0 0 1px ${t.star}55` }}>
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: t.star, boxShadow: `0 0 6px ${t.star}` }} />
                  </span>
                  {THEMES[id].name}
                  {on && <Check size={15} className="ml-auto" style={{ color: "var(--star)" }} />}
                </button>
              );
            })}
          </div>
        </section>
        <section className="-mx-2 flex flex-col gap-2">
          <SoundMixer {...mixer} />
          <p className="m-0 px-2 text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>
            Recordings:{" "}
            {SOUND_CREDITS.map((c, i) => (
              <React.Fragment key={c.title}>
                <a href={c.url} target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>{c.title}</a> by {c.author} ({c.licence}){i < SOUND_CREDITS.length - 1 ? " · " : "."}
              </React.Fragment>
            ))}{" "}
            Most were prepared for looping by the <a href="https://github.com/rafaelmardojai/blanket" target="_blank" rel="noreferrer" style={{ color: "var(--muted)" }}>Blanket</a> project; all were trimmed and level-matched for Inkwell.
          </p>
        </section>
        <section className="flex flex-col gap-3">
          <Label className="flex items-center gap-2"><Target size={13} />Goals</Label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted)" }}>Words per day<TextInput type="number" min={1} value={g} onChange={(e) => setG(e.target.value)} /></label>
            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--muted)" }}>Book target<TextInput type="number" min={1} value={b} onChange={(e) => setB(e.target.value)} /></label>
          </div>
        </section>
        <Btn variant="star" onClick={close} className="w-full">Done</Btn>
      </div>
    </Modal>
  );
}

const SOUND_CREDITS: { title: string; author: string; licence: string; url: string }[] = [
  { title: "Rain ambience", author: "alex36917", licence: "CC BY 4.0", url: "https://freesound.org/people/alex36917/sounds/524605/" },
  { title: "Infinite Storm", author: "digifishmusic", licence: "CC BY 4.0", url: "https://freesound.org/people/digifishmusic/sounds/41739/" },
  { title: "Fireplace Loop Original Noise", author: "King_of_The_Christmas", licence: "Pixabay Content License", url: "https://pixabay.com/sound-effects/fireplace-loop-original-noise-178209/" },
  { title: "Crickets Chirping At Night", author: "Lisa Redfern", licence: "public domain", url: "https://soundbible.com/2083-Crickets-Chirping-At-Night.html" },
  { title: "Wind blowing in a field in Texas", author: "felix.blume", licence: "CC0", url: "https://freesound.org/people/felix.blume/sounds/217506/" },
  { title: "stream2", author: "gluckose", licence: "CC0", url: "https://freesound.org/people/gluckose/sounds/333987/" },
  { title: "Ocean waves crushing", author: "Luftrum", licence: "CC BY 4.0", url: "https://freesound.org/people/Luftrum/sounds/48412/" },
  { title: "Restaurant Ambiance", author: "stephan", licence: "public domain", url: "https://soundbible.com/1664-Restaurant-Ambiance.html" },
];

const SOUNDS: { id: SoundId; label: string; hint: string; icon: any }[] = [
  { id: "rain", label: "Rain", hint: "Soft, steady rainfall", icon: CloudRain },
  { id: "storm", label: "Thunderstorm", hint: "Heavy rain and rolling thunder", icon: CloudLightning },
  { id: "fire", label: "Fireplace", hint: "A log fire, crackling", icon: Flame },
  { id: "night", label: "Night sky", hint: "Crickets and a field wind", icon: Moon },
  { id: "stream", label: "Stream", hint: "Water running over stones", icon: Droplets },
  { id: "waves", label: "Ocean waves", hint: "Surf rolling onto the shore", icon: Waves },
  { id: "cafe", label: "Coffee shop", hint: "Murmur, cups and cutlery", icon: Coffee },
];

function SoundMixer({ mix, playing, status, onLevel, onToggle, onPlaying }: {
  mix: Mix; playing: boolean; status: Record<SoundId, SoundStatus>;
  onLevel: (id: SoundId, v: number) => void; onToggle: (id: SoundId) => void; onPlaying: (p: boolean) => void;
}) {
  const anyOn = SOUND_IDS.some((id) => mix[id] > 0);
  const live = playing && anyOn;
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between gap-3 px-2 pb-1">
        <Label>Soundscape</Label>
        <button onClick={() => onPlaying(!live)} disabled={!anyOn}
          className="flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs disabled:opacity-40"
          style={live ? { borderColor: a("var(--star)", 40), background: a("var(--star)", 10), color: "var(--star)" } : { borderColor: "var(--soft-border)", color: "var(--muted)" }}>
          {live ? <Pause size={13} /> : <Play size={13} />}{live ? "Pause" : "Play"}
        </button>
      </div>
      {SOUNDS.map((s) => {
        const v = mix[s.id]; const on = v > 0; const I = s.icon; const pct = Math.round(v * 100);
        const loading = on && status[s.id] === "loading"; const failed = on && status[s.id] === "error";
        return (
          <div key={s.id} className="flex flex-col rounded-xl px-2 py-1.5" style={on ? { background: a("var(--star)", 6) } : undefined}>
            <button onClick={() => onToggle(s.id)} aria-pressed={on} className="flex min-h-[40px] items-center gap-3 border-0 bg-transparent p-0 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                style={on ? { borderColor: a("var(--star)", 45), background: a("var(--star)", 12), color: "var(--star)", boxShadow: live ? `0 0 14px ${a("var(--star)", 30)}` : undefined } : { borderColor: "var(--soft-border)", color: "var(--muted)" }}>
                <I size={16} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm" style={{ color: on ? "var(--heading)" : "var(--text)" }}>{s.label}</span>
                <span className="truncate text-[11px]" style={{ color: failed ? "#ffb3bb" : "var(--faint)" }}>
                  {failed ? "Couldn't load. Tap to try again." : loading ? "Loading the recording…" : s.hint}
                </span>
              </span>
              <span className={cn("min-w-[36px] shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums", loading && "animate-pulse")}
                style={{ color: failed ? "#ffb3bb" : on ? "var(--muted)" : "var(--faint)" }}>
                {failed ? "Retry" : loading ? "Loading" : on ? pct : "Off"}
              </span>
            </button>
            <input type="range" min={0} max={100} step={1} value={pct} aria-label={`${s.label} volume`}
              onChange={(e) => onLevel(s.id, Number(e.target.value) / 100)}
              className="ink-range w-full transition-opacity" style={{ ["--fill" as any]: `${pct}%`, opacity: on ? 1 : 0.5 }} />
          </div>
        );
      })}
      <p className="m-0 px-2 pt-1 text-[11px] leading-relaxed" style={{ color: "var(--faint)" }}>Mix as many as you like. Your mix is remembered for next time.</p>
    </div>
  );
}

function ConfirmModal({ req, onClose }: { req: ConfirmReq; onClose: () => void }) {
  return (
    <Modal onClose={onClose} label={req.title}>
      <div className="flex flex-col gap-4">
        <h2 className="f-display m-0 text-3xl font-medium" style={{ color: "var(--heading)" }}>{req.title}</h2>
        <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{req.body}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="soft" onClick={onClose}>Keep it</Btn>
          <Btn variant="danger" onClick={() => { req.onConfirm(); onClose(); }}><Trash2 size={15} />{req.action}</Btn>
        </div>
      </div>
    </Modal>
  );
}

function BreakModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Modal onClose={onDismiss} label="Time for a break">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border" style={{ borderColor: a("var(--star)", 40), background: a("var(--star)", 10), boxShadow: `0 0 30px ${a("var(--star)", 25)}` }}>
          <Coffee size={26} style={{ color: "var(--star)" }} />
        </div>
        <h2 className="f-display m-0 text-3xl font-medium" style={{ color: "var(--heading)" }}>Rest your eyes</h2>
        <p className="m-0 max-w-[360px] text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          You have been writing for an hour without pause. Step away for a few minutes, stretch, look at something far off. The stars will wait.
        </p>
        <Btn variant="star" onClick={onDismiss} className="w-full">I'll take a break</Btn>
      </div>
    </Modal>
  );
}
