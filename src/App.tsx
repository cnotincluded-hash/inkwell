import React, {
  useState, useEffect, useRef, useMemo, useCallback, createContext, useContext
} from "react";
import {
  BookOpen, ScrollText, Map, Hourglass, Feather, Sparkles, Plus, Trash2,
  ChevronRight, ChevronDown, X, Check, Trophy, BarChart2, Flame, Target,
  Edit2, Download, Maximize2, Minimize2, AlignCenter, Palette, Coffee,
  Volume2, VolumeX, Wind, Layers, List
} from "lucide-react";

/* ============================================================
   UTILITIES
============================================================ */
function cn(...parts: any[]) { return parts.filter(Boolean).join(" "); }
const STORAGE_KEY = "inkwell-state-v2";
const THEME_KEY   = "inkwell-theme-v1";
const todayKey = () => new Date().toISOString().slice(0, 10);
const uid      = () => Math.random().toString(36).slice(2, 10);
function countWords(t: string) { const s = t.trim(); return s ? s.split(/\s+/).length : 0; }
function downloadFile(content: string, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  a.download = name; a.click();
}

/* ============================================================
   TYPES
============================================================ */
type PageId      = "manuscript"|"codex"|"outline"|"scriptorium"|"marginalia"|"stats";
type SceneStatus = "unwritten"|"drafting"|"revising"|"done";
type Scene       = { id:string; title:string; synopsis:string; status:SceneStatus; wordTarget:number; content:string };
type Chapter     = { id:string; title:string; scenes:Scene[]; expanded:boolean };
type Book        = { id:string; title:string };
type CodexKind   = "character"|"location"|"lore";
type CodexEntry  = { id:string; bookId:string; kind:CodexKind; name:string; body:string };
type MarginNote  = { id:string; text:string; at:string };
type SprintRecord= { id:string; minutes:number; words:number; at:string };
type ThemeId     = "amethyst"|"emerald"|"bloodmoon"|"frostbound"|"solar";
type AmbientId   = "off"|"rain"|"fire"|"quill";

type Store = {
  chapters: Chapter[];
  activeSceneId: string|null;
  books: Book[];
  activeBookId: string;
  codex: CodexEntry[];
  margins: MarginNote[];
  dailyGoal: number;
  wordLog: Record<string,number>;
  sprintHistory: SprintRecord[];
  familiarName: string;
  affection: number;
};

/* ============================================================
   THEMES
============================================================ */
type ThemeDef = { name:string; vars: Record<string,string> };
const THEMES: Record<ThemeId, ThemeDef> = {
  amethyst: { name:"Amethyst", vars:{
    "--bg":"hsl(228 38% 7%)", "--surface":"hsl(228 32% 10%)", "--surface2":"hsl(263 28% 14%)",
    "--border":"hsl(228 25% 16%)", "--accent":"hsl(38 88% 62%)", "--glow":"hsl(38 88% 52%)",
    "--magic":"hsl(263 70% 58%)", "--magic2":"hsl(270 60% 60%)",
    "--text":"hsl(228 15% 88%)", "--dim":"hsl(228 10% 42%)",
    "--parchment":"hsl(42 55% 88%)", "--page":"hsl(263 30% 13%)",
    "--particle":"hsl(38 88% 62% / 0.45)",
  }},
  emerald: { name:"Emerald Coven", vars:{
    "--bg":"hsl(150 38% 6%)", "--surface":"hsl(150 30% 9%)", "--surface2":"hsl(160 28% 12%)",
    "--border":"hsl(150 25% 14%)", "--accent":"hsl(145 65% 55%)", "--glow":"hsl(145 65% 45%)",
    "--magic":"hsl(168 55% 42%)", "--magic2":"hsl(175 55% 48%)",
    "--text":"hsl(150 20% 88%)", "--dim":"hsl(150 10% 42%)",
    "--parchment":"hsl(90 25% 88%)", "--page":"hsl(155 30% 10%)",
    "--particle":"hsl(145 65% 55% / 0.45)",
  }},
  bloodmoon: { name:"Blood Moon", vars:{
    "--bg":"hsl(0 38% 6%)", "--surface":"hsl(0 30% 9%)", "--surface2":"hsl(340 28% 12%)",
    "--border":"hsl(0 25% 14%)", "--accent":"hsl(0 85% 65%)", "--glow":"hsl(0 85% 55%)",
    "--magic":"hsl(330 60% 50%)", "--magic2":"hsl(320 55% 55%)",
    "--text":"hsl(0 20% 88%)", "--dim":"hsl(0 10% 42%)",
    "--parchment":"hsl(15 25% 88%)", "--page":"hsl(5 30% 10%)",
    "--particle":"hsl(0 85% 65% / 0.45)",
  }},
  frostbound: { name:"Frostbound", vars:{
    "--bg":"hsl(210 45% 7%)", "--surface":"hsl(210 38% 10%)", "--surface2":"hsl(220 35% 13%)",
    "--border":"hsl(210 30% 16%)", "--accent":"hsl(195 85% 68%)", "--glow":"hsl(195 85% 58%)",
    "--magic":"hsl(215 70% 62%)", "--magic2":"hsl(210 65% 68%)",
    "--text":"hsl(210 25% 90%)", "--dim":"hsl(210 15% 45%)",
    "--parchment":"hsl(195 25% 92%)", "--page":"hsl(215 35% 10%)",
    "--particle":"hsl(195 85% 68% / 0.45)",
  }},
  solar: { name:"Solar Flare", vars:{
    "--bg":"hsl(25 40% 6%)", "--surface":"hsl(25 32% 9%)", "--surface2":"hsl(30 30% 12%)",
    "--border":"hsl(25 28% 15%)", "--accent":"hsl(42 95% 60%)", "--glow":"hsl(42 95% 50%)",
    "--magic":"hsl(18 75% 55%)", "--magic2":"hsl(25 70% 60%)",
    "--text":"hsl(35 25% 90%)", "--dim":"hsl(30 15% 45%)",
    "--parchment":"hsl(48 35% 90%)", "--page":"hsl(28 32% 10%)",
    "--particle":"hsl(42 95% 60% / 0.45)",
  }},
};

/* ============================================================
   SEED / STORE
============================================================ */
const seed = (): Store => {
  const c1Scene: Scene = { id:uid(), title:"The Letter Arrives", synopsis:"Our protagonist receives a summons they cannot ignore.", status:"drafting", wordTarget:1500, content:"" };
  const book1: Book = { id:uid(), title:"Ashfall" };
  return {
    chapters:[{ id:uid(), title:"Chapter One — Ashfall", expanded:true, scenes:[c1Scene] }],
    activeSceneId: c1Scene.id,
    books:[book1], activeBookId:book1.id,
    codex:[
      { id:uid(), bookId:book1.id, kind:"character", name:"Wren Calloway", body:"Reluctant heir to a dying order. Carries a debt she won't name." },
      { id:uid(), bookId:book1.id, kind:"location",  name:"Ashfall Spire",  body:"A tower built from the bones of a fallen god, now half-claimed by moss." },
      { id:uid(), bookId:book1.id, kind:"lore",      name:"The Quiet Pact", body:"An old treaty between mortals and the things that live in the dark between stars." },
    ],
    margins:[], dailyGoal:750, wordLog:{}, sprintHistory:[], familiarName:"Inkfeather", affection:0,
  };
};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const p = JSON.parse(raw);
    if (!p.chapters || !p.codex) return seed();
    if (!p.books?.length) {
      const b: Book = { id:uid(), title:"My Book" };
      p.books = [b]; p.activeBookId = b.id;
      p.codex = (p.codex||[]).map((e:any)=>({ ...e, bookId:e.bookId||b.id }));
    }
    if (!p.activeBookId) p.activeBookId = p.books[0].id;
    return p as Store;
  } catch { return seed(); }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text:"The candle still burns.",   sub:"The page is yours alone." };
  if (h < 10) return { text:"Good morning, scribe.",      sub:"The page is fresh and awaiting your hand." };
  if (h < 13) return { text:"Good day.",                  sub:"Stay the course — great works take time." };
  if (h < 17) return { text:"Afternoon light.",           sub:"The manuscript grows, line by line." };
  if (h < 21) return { text:"Good evening.",              sub:"The lamp burns low over the desk." };
  return       { text:"The hour grows late.",             sub:"Rest beckons, but there's still ink in the well." };
}

/* ============================================================
   AMBIENT SOUND HOOK
============================================================ */
function useAmbientSound(sound: AmbientId) {
  const ctxRef   = useRef<AudioContext|null>(null);
  const nodesRef = useRef<(AudioNode|AudioBufferSourceNode)[]>([]);
  const timerRef = useRef<number|null>(null);

  function getCtx() {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }
  function stopAll() {
    nodesRef.current.forEach(n => { try { (n as AudioBufferSourceNode).stop?.(); n.disconnect(); } catch {} });
    nodesRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }
  function makeNoise(ctx: AudioContext, brown = false) {
    const bufSize = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random()*2-1;
      d[i] = brown ? (last = (last + 0.02*w)/1.02)*3 : w;
    }
    return buf;
  }
  function playRain(ctx: AudioContext) {
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=600; bp.Q.value=0.4;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass";  lp.frequency.value=1200;
    const g  = ctx.createGain(); g.gain.value = 0.25;
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start();
    nodesRef.current.push(src, bp, lp, g);
  }
  function playFire(ctx: AudioContext) {
    const src = ctx.createBufferSource();
    src.buffer = makeNoise(ctx, true);
    src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=180;
    const g  = ctx.createGain(); g.gain.value = 0.7;
    src.connect(lp); lp.connect(g); g.connect(ctx.destination);
    src.start();
    nodesRef.current.push(src, lp, g);
  }
  function playQuill(ctx: AudioContext) {
    function click() {
      if (!ctxRef.current) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const bp  = ctx.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value=2800+Math.random()*1400; bp.Q.value=3;
      const g   = ctx.createGain();
      osc.type = "sawtooth"; osc.frequency.value=180+Math.random()*200;
      g.gain.setValueAtTime(0.07, now);
      g.gain.exponentialRampToValueAtTime(0.001, now+0.04+Math.random()*0.04);
      osc.connect(bp); bp.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now+0.08);
    }
    timerRef.current = window.setInterval(click, 350+Math.random()*500);
  }

  useEffect(() => {
    stopAll();
    if (sound === "off") return;
    const ctx = getCtx();
    if (sound==="rain")  playRain(ctx);
    if (sound==="fire")  playFire(ctx);
    if (sound==="quill") playQuill(ctx);
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound]);
}

/* ============================================================
   BREAK TIMER HOOK
============================================================ */
function useBreakTimer(onBreak: ()=>void) {
  const lastRef   = useRef(Date.now());
  const activeRef = useRef(0);
  const firedRef  = useRef(false);
  const recordActivity = useCallback(() => { lastRef.current = Date.now(); }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const since = Date.now() - lastRef.current;
      if (since < 30_000) {
        activeRef.current++;
        if (activeRef.current >= 3600 && !firedRef.current) { firedRef.current=true; onBreak(); }
      } else if (since > 300_000) { activeRef.current=0; firedRef.current=false; }
    }, 1000);
    return () => clearInterval(t);
  }, [onBreak]);
  return recordActivity;
}

/* ============================================================
   SHARED UI PRIMITIVES
============================================================ */
function Card({ children, className, style, onClick }: any) {
  return <div onClick={onClick} className={cn("rounded-xl border", className)} style={{ borderColor:"var(--border)", ...style }}>{children}</div>;
}
function Button({ children, className, style, onClick, disabled, variant, size, title }: any) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50";
  const s: any = { sm:"h-7 px-2.5 text-xs", lg:"h-12 px-6 text-base", default:"h-9 px-4 text-sm" };
  const v: any = {
    default:     "text-slate-950 hover:opacity-90",
    outline:     "border bg-transparent hover:bg-white/5",
    secondary:   "bg-white/10 hover:bg-white/15",
    ghost:       "bg-transparent hover:bg-white/5",
    destructive: "bg-red-600 text-white hover:bg-red-500",
  };
  const vv = variant||"default";
  const extraStyle = vv==="default" ? { background:"var(--accent)", color:"hsl(228 38% 7%)" } : vv==="outline" ? { borderColor:"var(--border)" } : {};
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn(base, s[size||"default"], v[vv], className)} style={{ ...extraStyle, ...style }}>
      {children}
    </button>
  );
}
function Input({ className, style, ...props }: any) {
  return <input {...props} className={cn("w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:opacity-40", className)} style={{ borderColor:"var(--border)", color:"inherit", ...style }} />;
}
function ArcaneDivider({ children, className }: any) {
  return (
    <div className={cn("flex items-center gap-2 uppercase tracking-[.15em] text-[11px] font-semibold opacity-50", className)}>
      {children}
      <div className="flex-1 h-px" style={{ background:"linear-gradient(90deg, var(--border), transparent)" }} />
    </div>
  );
}
function GlowHeading({ children }: any) {
  return <h1 className="text-4xl font-serif font-bold" style={{ color:"var(--accent)", textShadow:"0 0 40px var(--glow)" }}>{children}</h1>;
}

/* ============================================================
   GLOBAL STYLES + PARTICLES
============================================================ */
const GLOBAL_CSS = `
  @keyframes float-up { 0%{transform:translateY(0) translateX(0);opacity:0} 10%{opacity:1} 90%{opacity:.6} 100%{transform:translateY(-100vh) translateX(20px);opacity:0} }
  @keyframes ink-fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
  @keyframes owl-breathe { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
  @keyframes owl-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.05)} }
  @keyframes owl-wing-l { 0%,100%{transform:rotate(0deg) translateX(0)} 50%{transform:rotate(-18deg) translateX(-3px)} }
  @keyframes owl-wing-r { 0%,100%{transform:rotate(0deg) translateX(0)} 50%{transform:rotate(18deg) translateX(3px)} }
  @keyframes zz-rise { 0%{opacity:0;transform:translateY(0) scale(.6)} 30%{opacity:1} 100%{opacity:0;transform:translateY(-18px) scale(1)} }
  @keyframes cheer-star { 0%,100%{opacity:0;transform:scale(0)} 50%{opacity:1;transform:scale(1)} }
  .animate-in { animation: ink-fade-in .4s ease both; }
  .font-serif { font-family: Georgia,'Times New Roman',serif; }
  .owl-breathe { animation: owl-breathe 3.5s ease-in-out infinite; }
  .owl-blink   { animation: owl-blink   4s linear infinite; transform-origin: center 25px; }
  .owl-wing-l  { animation: owl-wing-l  .35s ease-in-out infinite; transform-origin: 20px 38px; }
  .owl-wing-r  { animation: owl-wing-r  .35s ease-in-out infinite; transform-origin: 44px 38px; }
  .zz1 { animation: zz-rise 2s ease-in-out infinite; }
  .zz2 { animation: zz-rise 2s ease-in-out .7s infinite; }
  .cheer-star { animation: cheer-star .5s ease-in-out; }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:var(--bg); }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
  ::selection { background:color-mix(in srgb, var(--accent) 25%, transparent); }
`;

function Particles() {
  const ps = useMemo(()=>Array.from({length:20}).map((_,i)=>({
    id:i, left:Math.random()*100, delay:Math.random()*12, dur:10+Math.random()*10, size:1+Math.random()*2
  })),[]);
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {ps.map(p=>(
        <div key={p.id} className="absolute rounded-full" style={{
          left:`${p.left}%`, bottom:-10, width:p.size, height:p.size,
          background:"var(--particle)", boxShadow:"0 0 6px 1px var(--glow)",
          animation:`float-up ${p.dur}s linear ${p.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

/* ============================================================
   INKFEATHER THE OWL FAMILIAR
============================================================ */
function Familiar({ name, mood, onPet }: { name:string; mood:"idle"|"writing"|"cheer"|"sleep"; onPet:()=>void }) {
  const [bounce, setBounce] = useState(false);
  const writing = mood==="writing";
  const sleeping = mood==="sleep";
  const cheering = mood==="cheer" || bounce;
  return (
    <div className="fixed bottom-5 right-5 z-20 cursor-pointer select-none"
      onClick={()=>{ setBounce(true); onPet(); setTimeout(()=>setBounce(false),600); }} title={`Pet ${name}`}>
      <svg width="60" height="66" viewBox="0 0 64 70" className={cheering?"animate-bounce":""}
        style={{ filter:"drop-shadow(0 0 10px var(--magic))", overflow:"visible" }}>
        {/* wings */}
        <path d="M14 37 Q4 42 8 56 Q16 49 20 39 Z" fill="var(--magic)"
          className={writing ? "owl-wing-l" : ""} />
        <path d="M50 37 Q60 42 56 56 Q48 49 44 39 Z" fill="var(--magic)"
          className={writing ? "owl-wing-r" : ""} />
        {/* body */}
        <g className={sleeping ? "" : "owl-breathe"}>
          <ellipse cx="32" cy="42" rx="16" ry="17" fill="var(--magic)" />
          {/* chest */}
          <ellipse cx="32" cy="46" rx="9" ry="11" fill="var(--parchment)" opacity=".7"/>
          {!sleeping && (<>
            <path d="M27 49 q5 4 10 0" stroke="var(--page)" strokeWidth="1.2" fill="none" />
            <path d="M27 53 q5 4 10 0" stroke="var(--page)" strokeWidth="1.2" fill="none" />
          </>)}
          {/* head */}
          <circle cx="32" cy="24" r="14" fill="var(--magic)" />
          {/* ear tufts */}
          <path d="M21 14 L17 3 L27 12 Z" fill="var(--magic)" />
          <path d="M43 14 L47 3 L37 12 Z" fill="var(--magic)" />
          {/* facial disc */}
          <circle cx="32" cy="25" r="11" fill="var(--parchment)" opacity=".55"/>
          {sleeping ? (<>
            <line x1="24" y1="24" x2="30" y2="24" stroke="var(--page)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="34" y1="24" x2="40" y2="24" stroke="var(--page)" strokeWidth="2" strokeLinecap="round"/>
          </>) : (<>
            {/* eyes */}
            <g className="owl-blink">
              <circle cx="27" cy="24" r="5.5" fill="white" />
              <circle cx="37" cy="24" r="5.5" fill="white" />
            </g>
            <circle cx="27" cy="24" r="2.8" fill="hsl(30 40% 15%)" />
            <circle cx="37" cy="24" r="2.8" fill="hsl(30 40% 15%)" />
            <circle cx="27.8" cy="23.2" r=".9" fill="white" />
            <circle cx="37.8" cy="23.2" r=".9" fill="white" />
          </>)}
          {/* beak */}
          <path d="M30 30 L34 30 L32 34 Z" fill="var(--accent)" />
          {/* feet */}
          <path d="M26 58 l-2 5 M26 58 l0 5 M26 58 l2 5" stroke="var(--accent)" strokeWidth="1.3" fill="none"/>
          <path d="M38 58 l-2 5 M38 58 l0 5 M38 58 l2 5" stroke="var(--accent)" strokeWidth="1.3" fill="none"/>
          {/* writing quill */}
          {writing && <rect x="42" y="40" width="7" height="2" rx="1" fill="var(--accent)" opacity=".9"/>}
          {/* sleep z's */}
          {sleeping && (<>
            <text x="46" y="14" fontSize="9" fill="var(--accent)" className="zz1">z</text>
            <text x="52" y="7"  fontSize="7" fill="var(--accent)" className="zz2">z</text>
          </>)}
          {/* cheer sparkle */}
          {cheering && <path d="M30 12 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="var(--accent)" className="cheer-star"/>}
        </g>
      </svg>
    </div>
  );
}

/* ============================================================
   THEME SWITCHER
============================================================ */
function ThemeSwitcher({ current, onChange }: { current:ThemeId; onChange:(t:ThemeId)=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} title="Change theme"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs hover:bg-white/5 transition-colors"
        style={{ color:"var(--dim)" }}>
        <Palette className="w-3.5 h-3.5" />
        {THEMES[current].name}
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 rounded-xl border p-2 z-50 min-w-[160px] animate-in"
          style={{ background:"var(--surface)", borderColor:"var(--border)" }}>
          {(Object.keys(THEMES) as ThemeId[]).map(t=>(
            <button key={t} onClick={()=>{ onChange(t); setOpen(false); }}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                t===current ? "opacity-100" : "opacity-60 hover:opacity-100 hover:bg-white/5")}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:THEMES[t].vars["--accent"] }}/>
              {THEMES[t].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AMBIENT SOUND PICKER
============================================================ */
function AmbientPicker({ current, onChange }: { current:AmbientId; onChange:(a:AmbientId)=>void }) {
  const [open, setOpen] = useState(false);
  const opts: { id:AmbientId; label:string }[] = [
    { id:"off", label:"Silence" }, { id:"rain", label:"Rain" },
    { id:"fire", label:"Fireplace" }, { id:"quill", label:"Quill" },
  ];
  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} title="Ambient sound"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs hover:bg-white/5 transition-colors"
        style={{ color:"var(--dim)" }}>
        {current==="off" ? <VolumeX className="w-3.5 h-3.5"/> : <Volume2 className="w-3.5 h-3.5"/>}
        {opts.find(o=>o.id===current)?.label}
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 rounded-xl border p-2 z-50 min-w-[130px] animate-in"
          style={{ background:"var(--surface)", borderColor:"var(--border)" }}>
          {opts.map(o=>(
            <button key={o.id} onClick={()=>{ onChange(o.id); setOpen(false); }}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                o.id===current ? "opacity-100" : "opacity-60 hover:opacity-100 hover:bg-white/5")}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   BREAK ALERT MODAL
============================================================ */
function BreakAlert({ onDismiss }: { onDismiss:()=>void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background:"rgba(0,0,0,.7)" }}>
      <div className="rounded-2xl border p-8 max-w-sm w-full text-center animate-in"
        style={{ background:"var(--surface)", borderColor:"var(--border)" }}>
        <Coffee className="w-10 h-10 mx-auto mb-4" style={{ color:"var(--accent)" }}/>
        <h2 className="font-serif text-2xl mb-2" style={{ color:"var(--accent)" }}>Time for a break</h2>
        <p className="text-sm mb-6" style={{ color:"var(--dim)" }}>
          You've been writing for an hour without pause. Step away, rest your eyes, and return refreshed — the words will still be here.
        </p>
        <Button onClick={onDismiss} className="w-full">I'll take a break</Button>
      </div>
    </div>
  );
}

/* ============================================================
   NAV
============================================================ */
const NAV: { id:PageId; label:string; icon:any }[] = [
  { id:"manuscript",   label:"Manuscript",   icon:Feather    },
  { id:"outline",      label:"Chapter Map",  icon:Map        },
  { id:"codex",        label:"Codex",        icon:BookOpen   },
  { id:"scriptorium",  label:"Scriptorium",  icon:Hourglass  },
  { id:"marginalia",   label:"Marginalia",   icon:ScrollText },
  { id:"stats",        label:"The Ledger",   icon:BarChart2  },
];

const STATUS_STYLE: Record<SceneStatus,string> = {
  unwritten:"text-slate-400 bg-white/5 border-slate-600/40",
  drafting: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  revising: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  done:     "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
};
const KIND_LABEL: Record<CodexKind,string> = { character:"Characters", location:"Locations", lore:"Lore" };

/* ============================================================
   APP
============================================================ */
export default function App() {
  const [store, setStore]         = useState<Store>(loadStore);
  const [themeId, setThemeId]     = useState<ThemeId>(()=>(localStorage.getItem(THEME_KEY)||"amethyst") as ThemeId);
  const [page, setPage]           = useState<PageId>("manuscript");
  const [focusMode, setFocusMode] = useState(false);
  const [typewriter, setTypewriter] = useState(false);
  const [ambient, setAmbient]     = useState<AmbientId>("off");
  const [showBreak, setShowBreak] = useState(false);
  const [sprintActive, setSprintActive] = useState(false);
  const [sprintSecsLeft, setSprintSecsLeft] = useState(25*60);
  const [sprintMins, setSprintMins] = useState(25);
  const [sprintStartWords, setSprintStartWords] = useState(0);
  const [mood, setMood] = useState<"idle"|"writing"|"cheer"|"sleep">("idle");
  const idleTimer = useRef<number|null>(null);

  const theme = THEMES[themeId];

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }, [store]);
  useEffect(()=>{ localStorage.setItem(THEME_KEY, themeId); }, [themeId]);

  useAmbientSound(ambient);
  const recordActivity = useBreakTimer(useCallback(()=>setShowBreak(true),[]));

  // sprint countdown
  useEffect(()=>{
    if (!sprintActive) return;
    const t = setInterval(()=>setSprintSecsLeft(s=>{ if(s<=1){ clearInterval(t); finishSprint(); return 0; } return s-1; }), 1000);
    return ()=>clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[sprintActive]);

  const totalWordsNow = useMemo(()=>{
    let n=0; store.chapters.forEach(c=>c.scenes.forEach(s=>(n+=countWords(s.content)))); return n;
  },[store.chapters]);

  const todayWords = store.wordLog[todayKey()]||0;
  const goalPct    = Math.min(100, Math.round((todayWords/Math.max(1,store.dailyGoal))*100));
  const { text:greeting, sub:greetingSub } = getGreeting();

  function bumpIdleMood() {
    setMood("writing"); recordActivity();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(()=>setMood("idle"),4000);
  }
  function recordDelta(before:number, after:number) {
    const d = after-before; if(!d) return;
    setStore(s=>{ const k=todayKey(); return {...s, wordLog:{...s.wordLog, [k]:Math.max(0,(s.wordLog[k]||0)+d)}}; });
  }
  function finishSprint() {
    setSprintActive(false);
    const gained = Math.max(0, totalWordsNow - sprintStartWords);
    setStore(s=>({ ...s, sprintHistory:[{id:uid(),minutes:sprintMins,words:gained,at:new Date().toISOString()},...s.sprintHistory].slice(0,20), affection:s.affection+(gained>0?2:0) }));
    if(gained>0){ setMood("cheer"); setTimeout(()=>setMood("idle"),2500); }
  }
  function startSprint() { setSprintStartWords(totalWordsNow); setSprintSecsLeft(sprintMins*60); setSprintActive(true); }

  const activeScene = useMemo(()=>{
    for(const c of store.chapters){ const f=c.scenes.find(s=>s.id===store.activeSceneId); if(f) return f; } return null;
  },[store.chapters,store.activeSceneId]);

  function updateActiveScene(content:string) {
    if(!activeScene) return;
    const before=countWords(activeScene.content), after=countWords(content);
    setStore(s=>({ ...s, chapters:s.chapters.map(c=>({...c,scenes:c.scenes.map(sc=>sc.id===activeScene.id?{...sc,content}:sc)})) }));
    recordDelta(before,after); bumpIdleMood();
  }
  function addChapter() { setStore(s=>({ ...s, chapters:[...s.chapters,{id:uid(),title:`Chapter ${s.chapters.length+1}`,scenes:[],expanded:true}] })); }
  function addScene(chapterId:string) {
    const ns:Scene={id:uid(),title:"New Scene",synopsis:"",status:"unwritten",wordTarget:1000,content:""};
    setStore(s=>({ ...s, chapters:s.chapters.map(c=>c.id===chapterId?{...c,scenes:[...c.scenes,ns]}:c), activeSceneId:ns.id }));
  }
  function deleteScene(chId:string,scId:string) {
    setStore(s=>({ ...s, chapters:s.chapters.map(c=>c.id===chId?{...c,scenes:c.scenes.filter(sc=>sc.id!==scId)}:c), activeSceneId:s.activeSceneId===scId?null:s.activeSceneId }));
  }
  function toggleChapter(id:string) { setStore(s=>({ ...s, chapters:s.chapters.map(c=>c.id===id?{...c,expanded:!c.expanded}:c) })); }
  function setSceneStatus(chId:string,scId:string,status:SceneStatus) {
    setStore(s=>({ ...s, chapters:s.chapters.map(c=>c.id===chId?{...c,scenes:c.scenes.map(sc=>sc.id===scId?{...sc,status}:sc)}:c) }));
  }
  function reorderScenes(chId:string, from:number, to:number) {
    setStore(s=>({ ...s, chapters:s.chapters.map(c=>{ if(c.id!==chId) return c; const sc=[...c.scenes]; sc.splice(to,0,sc.splice(from,1)[0]); return {...c,scenes:sc}; }) }));
  }
  function addCodexEntry(kind:CodexKind) { setStore(s=>({ ...s, codex:[...s.codex,{id:uid(),bookId:s.activeBookId,kind,name:"Untitled",body:""}] })); }
  function updateCodex(id:string,patch:Partial<CodexEntry>) { setStore(s=>({ ...s, codex:s.codex.map(e=>e.id===id?{...e,...patch}:e) })); }
  function deleteCodex(id:string) { setStore(s=>({ ...s, codex:s.codex.filter(e=>e.id!==id) })); }
  function addBook() { setStore(s=>{ const b:Book={id:uid(),title:`Untitled Book ${s.books.length+1}`}; return {...s,books:[...s.books,b],activeBookId:b.id}; }); }
  function renameBook(id:string,title:string) { setStore(s=>({ ...s, books:s.books.map(b=>b.id===id?{...b,title}:b) })); }
  function deleteBook(id:string) {
    setStore(s=>{ if(s.books.length<=1) return s; const r=s.books.filter(b=>b.id!==id); return {...s,books:r,activeBookId:s.activeBookId===id?r[0].id:s.activeBookId,codex:s.codex.filter(e=>e.bookId!==id)}; });
  }
  function addMargin(text:string) { if(!text.trim()) return; setStore(s=>({ ...s, margins:[{id:uid(),text,at:new Date().toISOString()},...s.margins] })); }
  function deleteMargin(id:string) { setStore(s=>({ ...s, margins:s.margins.filter(m=>m.id!==id) })); }

  // Focus mode — full-screen manuscript
  if (focusMode && activeScene) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ ...theme.vars as any, background:"var(--bg)" }}>
        <style>{GLOBAL_CSS}</style>
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ borderColor:"var(--border)" }}>
          <span className="font-serif text-sm" style={{ color:"var(--accent)" }}>{activeScene.title}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color:"var(--dim)" }}>{countWords(activeScene.content)} words</span>
            <button onClick={()=>setTypewriter(t=>!t)} title="Typewriter mode"
              className={cn("p-1.5 rounded-md transition-colors", typewriter?"opacity-100":"opacity-40 hover:opacity-70")}
              style={{ color:"var(--accent)" }}><AlignCenter className="w-4 h-4"/></button>
            <button onClick={()=>setFocusMode(false)} style={{ color:"var(--dim)" }} className="hover:opacity-100 opacity-60"><Minimize2 className="w-4 h-4"/></button>
          </div>
        </div>
        <FocusEditor scene={activeScene} onChange={updateActiveScene} typewriter={typewriter}/>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ ...theme.vars as any, background:"var(--bg)", color:"var(--text)" }}>
      <style>{GLOBAL_CSS}</style>
      <Particles />
      {showBreak && <BreakAlert onDismiss={()=>{ setShowBreak(false); }}/>}
      <div className="relative z-10 flex min-h-screen">
        {/* sidebar */}
        <aside className="w-56 shrink-0 border-r p-5 hidden md:flex md:flex-col" style={{ borderColor:"var(--border)" }}>
          <div className="flex items-center gap-2 mb-8">
            <Sparkles className="w-5 h-5" style={{ color:"var(--accent)" }}/>
            <span className="font-serif text-lg tracking-wide" style={{ color:"var(--accent)" }}>Inkwell</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(n=>{
              const Icon=n.icon; const active=page===n.id;
              return (
                <button key={n.id} onClick={()=>setPage(n.id)}
                  className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border",
                    active ? "border-[var(--accent)]/20" : "border-transparent hover:bg-white/5")}
                  style={ active ? { color:"var(--accent)", background:"color-mix(in srgb,var(--accent) 10%,transparent)" } : { color:"var(--dim)" }}>
                  <Icon className="w-4 h-4"/>{n.label}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto pt-6 border-t space-y-3" style={{ borderColor:"var(--border)" }}>
            <ThemeSwitcher current={themeId} onChange={setThemeId}/>
            <AmbientPicker current={ambient} onChange={setAmbient}/>
            <ArcaneDivider>Today</ArcaneDivider>
            <div className="font-serif text-2xl" style={{ color:"var(--accent)" }}>{todayWords} words</div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background:"var(--surface)" }}>
              <div className="h-full transition-all duration-500" style={{ width:`${goalPct}%`, background:"linear-gradient(90deg,var(--accent),var(--magic))" }}/>
            </div>
            <div className="text-[11px]" style={{ color:"var(--dim)" }}>{goalPct}% of {store.dailyGoal}-word goal</div>
          </div>
        </aside>
        {/* mobile nav */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 border-b flex overflow-x-auto px-2 py-2 gap-1"
          style={{ background:"color-mix(in srgb,var(--bg) 95%,transparent)", borderColor:"var(--border)" }}>
          {NAV.map(n=>{ const Icon=n.icon; const active=page===n.id; return (
            <button key={n.id} onClick={()=>setPage(n.id)}
              className={cn("flex items-center gap-1 px-3 py-1.5 rounded-md text-xs shrink-0", active?"":"opacity-50")}
              style={{ color:active?"var(--accent)":"var(--text)", background:active?"color-mix(in srgb,var(--accent) 10%,transparent)":"" }}>
              <Icon className="w-3.5 h-3.5"/>{n.label}
            </button>
          ); })}
        </div>
        <main className="flex-1 p-6 md:p-10 pt-16 md:pt-10 max-w-5xl mx-auto w-full">
          {page==="manuscript" && <ManuscriptPage chapters={store.chapters} activeScene={activeScene}
            onSelectScene={id=>setStore(s=>({...s,activeSceneId:id}))} onChange={updateActiveScene}
            goal={activeScene?.wordTarget||0} greeting={greeting} greetingSub={greetingSub}
            onFocus={()=>setFocusMode(true)} typewriter={typewriter} onTypewriter={()=>setTypewriter(t=>!t)}/>}
          {page==="outline" && <OutlinePage chapters={store.chapters} onAddChapter={addChapter} onAddScene={addScene}
            onDeleteScene={deleteScene} onToggle={toggleChapter}
            onSelectScene={id=>{ setStore(s=>({...s,activeSceneId:id})); setPage("manuscript"); }}
            onSetStatus={setSceneStatus} onReorder={reorderScenes}
            onRenameChapter={(id,title)=>setStore(s=>({...s,chapters:s.chapters.map(c=>c.id===id?{...c,title}:c)}))}/>}
          {page==="codex" && <CodexPage entries={store.codex} books={store.books} activeBookId={store.activeBookId}
            onSelectBook={id=>setStore(s=>({...s,activeBookId:id}))} onAddBook={addBook}
            onRenameBook={renameBook} onDeleteBook={deleteBook}
            onAdd={addCodexEntry} onUpdate={updateCodex} onDelete={deleteCodex}/>}
          {page==="scriptorium" && <ScriptoriumPage active={sprintActive} secondsLeft={sprintSecsLeft}
            minutes={sprintMins} setMinutes={setSprintMins} onStart={startSprint} onStop={finishSprint} history={store.sprintHistory}/>}
          {page==="marginalia" && <MarginaliaPage notes={store.margins} onAdd={addMargin} onDelete={deleteMargin}/>}
          {page==="stats" && <StatsPage wordLog={store.wordLog} dailyGoal={store.dailyGoal} chapters={store.chapters}
            sprintHistory={store.sprintHistory} onSetGoal={g=>setStore(s=>({...s,dailyGoal:g}))}/>}
        </main>
      </div>
      <Familiar name={store.familiarName} mood={sprintActive?"writing":mood} onPet={()=>setStore(s=>({...s,affection:s.affection+1}))}/>
    </div>
  );
}

/* ============================================================
   FOCUS MODE EDITOR
============================================================ */
function FocusEditor({ scene, onChange, typewriter }: { scene:Scene; onChange:(c:string)=>void; typewriter:boolean }) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{ taRef.current?.focus(); },[]);
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    if(typewriter && taRef.current) {
      const el = taRef.current;
      const lines = el.value.substring(0, el.selectionStart).split("\n").length;
      const lineH = parseFloat(getComputedStyle(el).lineHeight)||28;
      el.scrollTop = Math.max(0, lines*lineH - el.clientHeight/2);
    }
  }
  return (
    <textarea ref={taRef} value={scene.content} onChange={handleInput}
      className="flex-1 w-full p-12 leading-relaxed text-[18px] resize-none outline-none"
      style={{ fontFamily:"Georgia,'Times New Roman',serif", background:"var(--page)", color:"var(--parchment)",
        backgroundImage:"repeating-linear-gradient(var(--page),var(--page) 31px,color-mix(in srgb,var(--accent) 6%,transparent) 32px)" }}/>
  );
}

/* ============================================================
   MANUSCRIPT PAGE
============================================================ */
function ManuscriptPage({ chapters, activeScene, onSelectScene, onChange, goal, greeting, greetingSub, onFocus, typewriter, onTypewriter }:
  { chapters:Chapter[]; activeScene:Scene|null; onSelectScene:(id:string)=>void; onChange:(c:string)=>void;
    goal:number; greeting:string; greetingSub:string; onFocus:()=>void; typewriter:boolean; onTypewriter:()=>void }) {
  const words = activeScene ? countWords(activeScene.content) : 0;

  function exportScene(fmt:"txt"|"md") {
    if(!activeScene) return;
    const content = fmt==="md" ? `## ${activeScene.title}\n\n${activeScene.content}` : activeScene.content;
    downloadFile(content, `${activeScene.title.replace(/\s+/g,"-")}.${fmt}`);
  }
  function exportChapter(fmt:"txt"|"md") {
    if(!activeScene) return;
    for(const c of chapters){
      const found = c.scenes.find(s=>s.id===activeScene.id);
      if(found){
        const content = fmt==="md"
          ? `# ${c.title}\n\n`+c.scenes.map(s=>`## ${s.title}\n\n${s.content}`).join("\n\n---\n\n")
          : c.scenes.map(s=>`${s.title}\n\n${s.content}`).join("\n\n---\n\n");
        downloadFile(content, `${c.title.replace(/\s+/g,"-")}.${fmt}`);
        break;
      }
    }
  }

  return (
    <div className="space-y-6 animate-in">
      <header className="space-y-1">
        <GlowHeading>{greeting}</GlowHeading>
        <p className="text-sm italic" style={{ color:"var(--dim)" }}>{greetingSub}</p>
      </header>
      <Card className="relative overflow-hidden" style={{ background:`linear-gradient(135deg,var(--bg),var(--surface2),var(--bg))`, borderColor:"color-mix(in srgb,var(--accent) 20%,transparent)" }}>
        <div className="absolute top-0 inset-x-0 h-px" style={{ background:"linear-gradient(90deg,transparent,var(--glow),transparent)" }}/>
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <select value={activeScene?.id||""} onChange={e=>onSelectScene(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor:"var(--border)", color:"var(--text)", background:"var(--surface)" }}>
            <option value="" disabled>Choose a scene…</option>
            {chapters.map(c=>(
              <optgroup key={c.id} label={c.title}>
                {c.scenes.map(s=><option key={s.id} value={s.id} style={{ background:"var(--surface)" }}>{s.title}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onTypewriter} title="Typewriter mode"
              className={cn("flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border transition-colors", typewriter?"":"opacity-50 hover:opacity-80")}
              style={{ color:"var(--accent)", borderColor:"color-mix(in srgb,var(--accent) 30%,transparent)", background:typewriter?"color-mix(in srgb,var(--accent) 10%,transparent)":"transparent" }}>
              <AlignCenter className="w-3.5 h-3.5"/> Typewriter
            </button>
            <button onClick={onFocus} title="Focus mode"
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border opacity-60 hover:opacity-100 transition-colors"
              style={{ color:"var(--text)", borderColor:"var(--border)" }}>
              <Maximize2 className="w-3.5 h-3.5"/> Focus
            </button>
            {activeScene && (
              <div className="relative group">
                <button className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border opacity-60 hover:opacity-100 transition-colors"
                  style={{ color:"var(--text)", borderColor:"var(--border)" }}>
                  <Download className="w-3.5 h-3.5"/> Export
                </button>
                <div className="absolute right-0 top-full mt-1 rounded-xl border p-2 z-20 hidden group-hover:block min-w-[170px]"
                  style={{ background:"var(--surface)", borderColor:"var(--border)" }}>
                  {(["txt","md"] as ("txt"|"md")[]).flatMap(fmt=>[
                    <button key={`s-${fmt}`} onClick={()=>exportScene(fmt)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-white/5">Scene as .{fmt}</button>,
                    <button key={`c-${fmt}`} onClick={()=>exportChapter(fmt)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs hover:bg-white/5">Chapter as .{fmt}</button>,
                  ])}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      {!activeScene ? (
        <Card className="p-10 text-center text-sm" style={{ borderStyle:"dashed", color:"var(--dim)" }}>
          No scene selected. Choose one above or add a scene from the Chapter Map.
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs" style={{ color:"var(--dim)" }}>
            <span>{words} words{goal ? ` · target ${goal}` : ""}</span>
            {goal>0 && <span>{Math.min(100,Math.round((words/goal)*100))}% of target</span>}
          </div>
          <textarea value={activeScene.content} onChange={e=>onChange(e.target.value)}
            placeholder="Begin where the ink takes you…" spellCheck={false}
            className="w-full min-h-[58vh] rounded-xl p-6 leading-relaxed text-[17px] resize-y outline-none border"
            style={{ fontFamily:"Georgia,'Times New Roman',serif", borderColor:"color-mix(in srgb,var(--accent) 15%,transparent)",
              background:`repeating-linear-gradient(var(--page),var(--page) 31px,color-mix(in srgb,var(--accent) 6%,transparent) 32px)`,
              color:"var(--parchment)", boxShadow:"inset 0 0 40px rgba(0,0,0,.4)" }}/>
        </>
      )}
    </div>
  );
}

/* ============================================================
   OUTLINE PAGE (drag-to-reorder + corkboard)
============================================================ */
function OutlinePage({ chapters, onAddChapter, onAddScene, onDeleteScene, onToggle, onSelectScene, onSetStatus, onReorder, onRenameChapter }:
  { chapters:Chapter[]; onAddChapter:()=>void; onAddScene:(chId:string)=>void; onDeleteScene:(chId:string,scId:string)=>void;
    onToggle:(chId:string)=>void; onSelectScene:(id:string)=>void; onSetStatus:(chId:string,scId:string,status:SceneStatus)=>void;
    onReorder:(chId:string,from:number,to:number)=>void; onRenameChapter:(id:string,title:string)=>void }) {
  const [view, setView]       = useState<"list"|"corkboard">("list");
  const [dragging, setDragging] = useState<{chId:string;idx:number}|null>(null);
  const [dragOver, setDragOver] = useState<{chId:string;idx:number}|null>(null);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <GlowHeading>Chapter Map</GlowHeading>
        <div className="flex items-center gap-2">
          <button onClick={()=>setView("list")} title="List view"
            className={cn("p-2 rounded-md border transition-colors", view==="list"?"":"opacity-40 hover:opacity-70")}
            style={{ borderColor:"var(--border)", color:"var(--accent)" }}><List className="w-4 h-4"/></button>
          <button onClick={()=>setView("corkboard")} title="Corkboard view"
            className={cn("p-2 rounded-md border transition-colors", view==="corkboard"?"":"opacity-40 hover:opacity-70")}
            style={{ borderColor:"var(--border)", color:"var(--accent)" }}><Layers className="w-4 h-4"/></button>
          <Button onClick={onAddChapter} variant="outline"><Plus className="w-4 h-4"/> Chapter</Button>
        </div>
      </div>

      {view==="corkboard" ? (
        <div className="space-y-6">
          {chapters.map(c=>(
            <div key={c.id}>
              <div className="font-serif text-lg mb-3" style={{ color:"var(--accent)" }}>{c.title}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {c.scenes.map(s=>(
                  <button key={s.id} onClick={()=>onSelectScene(s.id)}
                    className="rounded-xl border p-4 text-left hover:scale-[1.02] transition-transform"
                    style={{ background:"var(--surface2)", borderColor:"color-mix(in srgb,var(--accent) 15%,transparent)",
                      boxShadow:"0 4px 20px rgba(0,0,0,.3)" }}>
                    <div className={cn("inline-block text-[10px] rounded-full px-2 py-0.5 border mb-2", STATUS_STYLE[s.status])}>{s.status}</div>
                    <div className="font-serif text-sm mb-1" style={{ color:"var(--parchment)" }}>{s.title}</div>
                    <p className="text-[11px] line-clamp-3" style={{ color:"var(--dim)" }}>{s.synopsis||"No synopsis yet."}</p>
                    <div className="text-[10px] mt-2" style={{ color:"var(--dim)" }}>{countWords(s.content)} words</div>
                  </button>
                ))}
                <button onClick={()=>onAddScene(c.id)}
                  className="rounded-xl border-dashed border p-4 flex items-center justify-center opacity-40 hover:opacity-70 transition-opacity"
                  style={{ borderColor:"var(--border)" }}>
                  <Plus className="w-5 h-5" style={{ color:"var(--dim)" }}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {chapters.map(c=>{
            const wc = c.scenes.reduce((a,s)=>a+countWords(s.content),0);
            return (
              <div key={c.id} className="rounded-xl border overflow-hidden" style={{ borderColor:"var(--border)", background:"var(--surface)" }}>
                <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
                  <button onClick={()=>onToggle(c.id)} style={{ color:"var(--dim)" }}>
                    {c.expanded?<ChevronDown className="w-4 h-4"/>:<ChevronRight className="w-4 h-4"/>}
                  </button>
                  <input value={c.title} onChange={e=>onRenameChapter(c.id,e.target.value)}
                    className="bg-transparent font-serif text-lg outline-none flex-1 min-w-0" style={{ color:"var(--parchment)" }}/>
                  <span className="text-xs shrink-0" style={{ color:"var(--dim)" }}>{wc} words</span>
                  <button onClick={()=>onAddScene(c.id)} style={{ color:"var(--dim)" }} className="hover:opacity-100 shrink-0"><Plus className="w-4 h-4"/></button>
                </div>
                {c.expanded && (
                  <div className="px-4 pb-3 space-y-1">
                    {c.scenes.length===0 && <div className="text-xs italic pl-6" style={{ color:"var(--dim)" }}>No scenes yet.</div>}
                    {c.scenes.map((s,idx)=>{
                      const isOver = dragOver?.chId===c.id && dragOver?.idx===idx;
                      return (
                        <div key={s.id}
                          draggable
                          onDragStart={()=>setDragging({chId:c.id,idx})}
                          onDragOver={e=>{ e.preventDefault(); setDragOver({chId:c.id,idx}); }}
                          onDragEnd={()=>{ if(dragging&&dragOver&&dragging.chId===c.id&&dragOver.chId===c.id) onReorder(c.id,dragging.idx,dragOver.idx); setDragging(null); setDragOver(null); }}
                          className={cn("flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md group cursor-grab active:cursor-grabbing flex-wrap",
                            isOver?"ring-1":"hover:bg-white/5")}
                          style={{ ringColor:"var(--accent)" }}>
                          <button onClick={()=>onSelectScene(s.id)} className="flex-1 min-w-[80px] text-left text-sm truncate" style={{ color:"var(--text)" }}>
                            {s.title}<span className="text-xs ml-2" style={{ color:"var(--dim)" }}>{countWords(s.content)}w</span>
                          </button>
                          <select value={s.status} onChange={e=>onSetStatus(c.id,s.id,e.target.value as SceneStatus)}
                            className={`text-[11px] rounded-full px-2 py-0.5 border bg-transparent shrink-0 ${STATUS_STYLE[s.status]}`}>
                            <option value="unwritten">Unwritten</option><option value="drafting">Drafting</option>
                            <option value="revising">Revising</option><option value="done">Done</option>
                          </select>
                          <button onClick={()=>onDeleteScene(c.id,s.id)} className="opacity-60 md:opacity-0 md:group-hover:opacity-100 shrink-0" style={{ color:"var(--dim)" }}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CODEX PAGE
============================================================ */
function CodexPage({ entries, books, activeBookId, onSelectBook, onAddBook, onRenameBook, onDeleteBook, onAdd, onUpdate, onDelete }:
  { entries:CodexEntry[]; books:Book[]; activeBookId:string; onSelectBook:(id:string)=>void; onAddBook:()=>void;
    onRenameBook:(id:string,title:string)=>void; onDeleteBook:(id:string)=>void;
    onAdd:(kind:CodexKind)=>void; onUpdate:(id:string,patch:Partial<CodexEntry>)=>void; onDelete:(id:string)=>void }) {
  const [openId, setOpenId]       = useState<string|null>(null);
  const [editingBook, setEditingBook] = useState(false);
  const scoped = entries.filter(e=>e.bookId===activeBookId);
  const activeBook = books.find(b=>b.id===activeBookId);
  return (
    <div className="space-y-7 animate-in">
      <GlowHeading>The Codex</GlowHeading>
      <div className="flex items-center gap-2 flex-wrap">
        {books.map(b=>{ const active=b.id===activeBookId; return (
          <button key={b.id} onClick={()=>onSelectBook(b.id)}
            className="px-3 py-1.5 rounded-md text-sm border transition-colors"
            style={{ color:active?"var(--accent)":"var(--dim)", borderColor:active?"color-mix(in srgb,var(--accent) 30%,transparent)":"transparent",
              background:active?"color-mix(in srgb,var(--accent) 10%,transparent)":"transparent" }}>
            {b.title}
          </button>
        ); })}
        <Button size="sm" variant="outline" onClick={onAddBook}><Plus className="w-3.5 h-3.5"/> Book</Button>
      </div>
      {activeBook && (
        <Card className="flex items-center justify-between gap-3 px-4 py-3" style={{ background:"var(--surface)" }}>
          {editingBook ? (
            <Input autoFocus value={activeBook.title} onChange={(e:any)=>onRenameBook(activeBook.id,e.target.value)}
              onBlur={()=>setEditingBook(false)} onKeyDown={(e:any)=>{ if(e.key==="Enter") setEditingBook(false); }}
              className="font-serif text-lg max-w-xs"/>
          ) : (
            <button onClick={()=>setEditingBook(true)} className="font-serif text-lg text-left" style={{ color:"var(--parchment)" }}>{activeBook.title}</button>
          )}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs" style={{ color:"var(--dim)" }}>{scoped.length} {scoped.length===1?"entry":"entries"}</span>
            {books.length>1 && <button onClick={()=>onDeleteBook(activeBook.id)} className="opacity-40 hover:opacity-100 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>}
          </div>
        </Card>
      )}
      {(["character","location","lore"] as CodexKind[]).map(kind=>(
        <div key={kind}>
          <div className="flex items-center justify-between mb-2">
            <ArcaneDivider>{KIND_LABEL[kind]}</ArcaneDivider>
          </div>
          <div className="flex justify-end mb-2">
            <Button size="sm" variant="outline" onClick={()=>onAdd(kind)}><Plus className="w-3.5 h-3.5"/> Entry</Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {scoped.filter(e=>e.kind===kind).length===0 && <div className="text-xs italic sm:col-span-2" style={{ color:"var(--dim)" }}>No {KIND_LABEL[kind].toLowerCase()} yet.</div>}
            {scoped.filter(e=>e.kind===kind).map(e=>{ const open=openId===e.id; return (
              <Card key={e.id} className="p-4 cursor-pointer" style={{ background:"var(--surface2)", borderColor:"color-mix(in srgb,var(--accent) 10%,transparent)" }}
                onClick={()=>setOpenId(open?null:e.id)}>
                <div className="flex items-center justify-between">
                  <input value={e.name} onClick={ev=>ev.stopPropagation()} onChange={ev=>onUpdate(e.id,{name:ev.target.value})}
                    className="bg-transparent font-serif outline-none flex-1" style={{ color:"var(--parchment)" }}/>
                  <button onClick={ev=>{ ev.stopPropagation(); onDelete(e.id); }} className="opacity-40 hover:opacity-100 hover:text-red-400"><X className="w-3.5 h-3.5"/></button>
                </div>
                {open ? (
                  <textarea value={e.body} onClick={ev=>ev.stopPropagation()} onChange={ev=>onUpdate(e.id,{body:ev.target.value})}
                    className="w-full mt-2 bg-transparent text-sm outline-none resize-none min-h-[100px]" style={{ color:"var(--text)" }} placeholder="Notes…"/>
                ) : (
                  <p className="mt-1 text-sm line-clamp-2" style={{ color:"var(--dim)" }}>{e.body||"—"}</p>
                )}
              </Card>
            ); })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   SCRIPTORIUM PAGE
============================================================ */
function ScriptoriumPage({ active, secondsLeft, minutes, setMinutes, onStart, onStop, history }:
  { active:boolean; secondsLeft:number; minutes:number; setMinutes:(n:number)=>void; onStart:()=>void; onStop:()=>void; history:SprintRecord[] }) {
  const mm=String(Math.floor(secondsLeft/60)).padStart(2,"0");
  const ss=String(secondsLeft%60).padStart(2,"0");
  return (
    <div className="space-y-6 animate-in">
      <GlowHeading>The Scriptorium</GlowHeading>
      <Card className="relative overflow-hidden flex flex-col items-center py-12"
        style={{ background:`linear-gradient(135deg,var(--bg),var(--surface2),var(--bg))`, borderColor:"color-mix(in srgb,var(--accent) 20%,transparent)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--accent) 10%,transparent),transparent 55%)" }}/>
        <div className="font-serif text-6xl tabular-nums relative" style={{ color:"var(--accent)", textShadow:"0 0 20px var(--glow)" }}>{mm}:{ss}</div>
        {!active ? (<>
          <div className="flex items-center gap-2 mt-5 relative flex-wrap justify-center">
            {[15,25,45,60].map(m=>(
              <button key={m} onClick={()=>setMinutes(m)}
                className="px-3 py-1.5 rounded-md text-sm border transition-colors"
                style={{ borderColor:m===minutes?"color-mix(in srgb,var(--accent) 50%,transparent)":"var(--border)",
                  color:m===minutes?"var(--accent)":"var(--dim)", background:m===minutes?"color-mix(in srgb,var(--accent) 10%,transparent)":"transparent" }}>
                {m}m
              </button>
            ))}
          </div>
          <Button onClick={onStart} className="mt-6 relative" style={{ boxShadow:"0 0 20px color-mix(in srgb,var(--accent) 25%,transparent)" }}>Begin Sprint</Button>
        </>) : (
          <Button onClick={onStop} variant="secondary" className="mt-6 relative">End Sprint Early</Button>
        )}
      </Card>
      <ArcaneDivider>Past Sprints</ArcaneDivider>
      <div className="space-y-1.5">
        {history.length===0 && <div className="text-sm italic" style={{ color:"var(--dim)" }}>No sprints yet.</div>}
        {history.map(h=>(
          <div key={h.id} className="flex justify-between text-sm py-1.5 border-b" style={{ borderColor:"var(--border)", color:"var(--text)" }}>
            <span style={{ color:"var(--dim)" }}>{new Date(h.at).toLocaleString()}</span>
            <span>{h.minutes}m · {h.words} words</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   MARGINALIA PAGE
============================================================ */
function MarginaliaPage({ notes, onAdd, onDelete }: { notes:MarginNote[]; onAdd:(t:string)=>void; onDelete:(id:string)=>void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-5 animate-in">
      <GlowHeading>Marginalia</GlowHeading>
      <div className="flex gap-2">
        <Input value={draft} onChange={(e:any)=>setDraft(e.target.value)}
          onKeyDown={(e:any)=>{ if(e.key==="Enter"){ onAdd(draft); setDraft(""); } }}
          placeholder="Jot a stray thought before it escapes…"/>
        <Button onClick={()=>{ onAdd(draft); setDraft(""); }}><Check className="w-4 h-4"/></Button>
      </div>
      <div className="space-y-2">
        {notes.length===0 && <div className="text-sm italic" style={{ color:"var(--dim)" }}>Nothing in the margins yet.</div>}
        {notes.map(n=>(
          <Card key={n.id} className="flex items-start justify-between gap-3 p-3" style={{ background:"var(--surface)" }}>
            <div>
              <p className="text-sm" style={{ color:"var(--text)" }}>{n.text}</p>
              <p className="text-[11px] mt-1" style={{ color:"var(--dim)" }}>{new Date(n.at).toLocaleString()}</p>
            </div>
            <button onClick={()=>onDelete(n.id)} className="opacity-40 hover:opacity-100 hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5"/></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   STATS PAGE
============================================================ */
function StatsPage({ wordLog, dailyGoal, chapters, sprintHistory, onSetGoal }:
  { wordLog:Record<string,number>; dailyGoal:number; chapters:Chapter[]; sprintHistory:SprintRecord[]; onSetGoal:(g:number)=>void }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft]     = useState(String(dailyGoal));

  const days = useMemo(()=>{
    const r=[];
    for(let i=29;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10);
      r.push({ date:k, label:d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}), words:wordLog[k]||0 }); }
    return r;
  },[wordLog]);

  const maxBar = Math.max(...days.map(d=>d.words), dailyGoal, 1);
  const { current:currentStreak, longest:longestStreak } = useMemo(()=>{
    let current=0; let longest=0; let temp=0;
    let checking=todayKey();
    const keys=Object.keys(wordLog).sort().reverse();
    for(const k of keys){ if(k===checking&&(wordLog[k]||0)>=dailyGoal){ current++; const p=new Date(checking); p.setDate(p.getDate()-1); checking=p.toISOString().slice(0,10); } else break; }
    const aKeys=Object.keys(wordLog).sort();
    for(let i=0;i<aKeys.length;i++){
      if((wordLog[aKeys[i]]||0)>=dailyGoal){
        temp++;
        if(i>0){ const p=new Date(aKeys[i-1]); p.setDate(p.getDate()+1); if(p.toISOString().slice(0,10)!==aKeys[i]) temp=1; }
        longest=Math.max(longest,temp);
      } else temp=0;
    }
    return { current, longest };
  },[wordLog,dailyGoal]);

  const totalWords = useMemo(()=>chapters.reduce((a,c)=>a+c.scenes.reduce((b,s)=>b+countWords(s.content),0),0),[chapters]);
  const todayWords = wordLog[todayKey()]||0;
  const goalPct    = Math.min(100,Math.round((todayWords/Math.max(1,dailyGoal))*100));

  function saveGoal(){ const n=parseInt(goalDraft,10); if(!isNaN(n)&&n>0) onSetGoal(n); setEditingGoal(false); }

  return (
    <div className="space-y-8 animate-in">
      <GlowHeading>The Ledger</GlowHeading>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"Total Words",    value:totalWords.toLocaleString(),         icon:Feather,   color:"var(--accent)" },
          { label:"Current Streak", value:`${currentStreak}d`,                icon:Flame,     color:"hsl(14 90% 60%)" },
          { label:"Longest Streak", value:`${longestStreak}d`,                icon:Trophy,    color:"var(--magic)" },
          { label:"Sprint Words",   value:sprintHistory.reduce((a,s)=>a+s.words,0).toLocaleString(), icon:Hourglass, color:"hsl(193 70% 55%)" },
        ].map(({ label,value,icon:Icon,color })=>(
          <Card key={label} className="p-4" style={{ background:"var(--surface)" }}>
            <Icon className="w-4 h-4 mb-2" style={{ color }}/>
            <div className="text-xl font-serif font-bold" style={{ color }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color:"var(--dim)" }}>{label}</div>
          </Card>
        ))}
      </div>
      <Card className="p-5" style={{ background:"var(--surface)" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2"><Target className="w-4 h-4" style={{ color:"var(--accent)" }}/><span className="text-sm">Daily Goal</span></div>
          {editingGoal ? (
            <div className="flex items-center gap-2">
              <Input value={goalDraft} onChange={(e:any)=>setGoalDraft(e.target.value)} onKeyDown={(e:any)=>{ if(e.key==="Enter") saveGoal(); }} className="w-24 text-center" type="number" min={1}/>
              <Button size="sm" onClick={saveGoal}><Check className="w-3.5 h-3.5"/></Button>
            </div>
          ) : (
            <button onClick={()=>{ setGoalDraft(String(dailyGoal)); setEditingGoal(true); }} className="flex items-center gap-1 text-sm hover:opacity-100 opacity-60" style={{ color:"var(--text)" }}>
              <Edit2 className="w-3.5 h-3.5"/> {dailyGoal} words/day
            </button>
          )}
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="font-serif text-3xl" style={{ color:"var(--accent)" }}>{todayWords}</span>
          <span className="text-sm mb-1" style={{ color:"var(--dim)" }}>/ {dailyGoal} today</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background:"color-mix(in srgb,var(--border) 80%,transparent)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width:`${goalPct}%`, background:"linear-gradient(90deg,var(--accent),var(--magic))" }}/>
        </div>
        <div className="text-xs mt-1" style={{ color:"var(--dim)" }}>{goalPct}% of today's goal</div>
      </Card>
      <div>
        <ArcaneDivider className="mb-4">Last 30 Days</ArcaneDivider>
        <Card className="p-5" style={{ background:"var(--surface)" }}>
          <div className="flex items-end gap-[3px] h-28 w-full">
            {days.map(d=>{
              const pct=Math.min(100,(d.words/maxBar)*100);
              const hit=d.words>=dailyGoal&&d.words>0;
              const isToday=d.date===todayKey();
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full relative group">
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="rounded px-2 py-1 text-[10px] whitespace-nowrap" style={{ background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--text)" }}>
                      {d.label}: {d.words}w
                    </div>
                  </div>
                  <div className="w-full rounded-t transition-all duration-300"
                    style={{ height:`${pct}%`, minHeight:d.words>0?3:0,
                      background:hit?"linear-gradient(180deg,var(--accent),var(--glow))":isToday?"var(--magic)":"var(--border)",
                      boxShadow:hit?"0 0 6px var(--glow)":"none" }}/>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] mt-2" style={{ color:"var(--dim)" }}>
            <span>{days[0].label}</span>
            <span>Amber = goal hit</span>
            <span>Today</span>
          </div>
        </Card>
      </div>
      <div>
        <ArcaneDivider className="mb-4">Chapters</ArcaneDivider>
        <div className="space-y-2">
          {chapters.length===0 && <div className="text-sm italic" style={{ color:"var(--dim)" }}>No chapters yet.</div>}
          {chapters.map(c=>{
            const wc=c.scenes.reduce((a,s)=>a+countWords(s.content),0);
            const done=c.scenes.filter(s=>s.status==="done").length;
            return (
              <Card key={c.id} className="px-4 py-3" style={{ background:"var(--surface)" }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-serif text-sm" style={{ color:"var(--parchment)" }}>{c.title}</span>
                  <div className="flex items-center gap-3 text-xs shrink-0" style={{ color:"var(--dim)" }}>
                    <span>{wc.toLocaleString()} words</span>
                    <span>{done}/{c.scenes.length} scenes done</span>
                  </div>
                </div>
                {wc>0 && <div className="mt-2 w-full h-1 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width:`${Math.min(100,(wc/Math.max(totalWords,1))*100)}%`, background:"var(--magic)" }}/>
                </div>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
