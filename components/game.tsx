"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getFluentEmojiCDN } from "@lobehub/fluent-emoji";

function Emoji({
                 emoji,
                 size = 32,
                 type = "3d",
               }: {
  emoji: string;
  size?: number;
  type?: "3d" | "flat" | "anim" | "modern" | "mono";
}) {
  const url = getFluentEmojiCDN(emoji, { type, cdn: "aliyun" });

  if (!url) {
    return (
        <span style={{ fontSize: size, lineHeight: 1 }} role="img">
        {emoji}
      </span>
    );
  }

  return (
      <img
          src={url}
          alt={emoji}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          className="inline-block select-none object-contain"
          draggable={false}
      />
  );
}

const POOL = ["😀","😎","🤖","👻","🦊","🐼","🐸","🦄","🐙","🐯","🦁","🐵","🐶","🐱","🐰","🐨","🐧","🦉","🐢","🦋","🍕","🍔","🍩","🍉","🍓","🍒","🌈","⭐","🔥","⚡","🚀","🎮","🎲","🎯","👑","💎","🌸","🌻","🍀","🎈"];
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const KEY = "ttt-v1";
const TONE = ["text-rose-500", "text-sky-500"];

type P = 0 | 1;
type Save = { names: [string, string]; emojis: [string, string]; scores: [number, number]; draws: number };
const DEFAULTS: Save = { names: ["Player 1", "Player 2"], emojis: ["🦊", "🐼"], scores: [0, 0], draws: 0 };
const startFor = (s: Save) => ((s.scores[0] + s.scores[1] + s.draws) % 2) as P;

/* Emoji -> CSS cursor (canvas data URL, so the cursor is free of per-frame cost) */
function cursorFor(e: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 40;
  const g = c.getContext("2d")!;
  g.font = "30px serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(e, 20, 22);
  return `url(${c.toDataURL()}) 20 20, pointer`;
}

/* Floating emoji: only transforms are animated (GPU friendly) */
function Floaters({ emojis }: { emojis: string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<{ x: number; s: number; d: number; dl: number; r: number }[]>([]);
  useEffect(() => {
    setItems(Array.from({ length: 16 }, () => ({
      x: Math.random() * 96, s: 30 + Math.random() * 38, d: 9 + Math.random() * 8,
      dl: Math.random() * 6, r: (Math.random() - 0.5) * 80,
    })));
  }, []);
  useEffect(() => {
    if (!items.length) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".fl").forEach((el, i) => {
        const it = items[i];
        gsap.fromTo(el, { y: window.innerHeight + 120, rotation: 0 },
            { y: -(it.s + 120), rotation: it.r, duration: it.d, delay: it.dl, ease: "none", repeat: -1 });
      });
    }, root);
    return () => ctx.revert();
  }, [items]);
  return (
      <div ref={root} className="pointer-events-none absolute inset-0 overflow-hidden">
        {items.map((it, i) => (
            <div key={i} className="fl absolute top-0 opacity-60 will-change-transform" style={{ left: `${it.x}%` }}>
              <Emoji emoji={emojis[i % emojis.length]} size={it.s} type="3d" />
            </div>
        ))}
      </div>
  );
}

function Cell({ mark, emojis, wi, onClick }: { mark: P | null; emojis: [string, string]; wi: number; onClick: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (mark === null || !ref.current) return;
    gsap.fromTo(ref.current, { scale: 0, rotate: -25 }, { scale: 1, rotate: 0, duration: 0.4, ease: "back.out(2.5)" });
  }, [mark]);
  return (
      <button
          onClick={onClick}
          className="grid aspect-square place-items-center rounded-2xl bg-white shadow-[0_5px_0_0_rgba(30,27,75,0.07),0_12px_20px_-10px_rgba(30,27,75,0.25)] transition-all duration-150 hover:-translate-y-0.5 hover:scale-[1.04] hover:shadow-[0_7px_0_0_rgba(30,27,75,0.07),0_16px_24px_-10px_rgba(30,27,75,0.3)] active:translate-y-0.5 active:scale-95 active:shadow-[0_2px_0_0_rgba(30,27,75,0.07)]"
      >
        {mark !== null && (
            <span ref={ref} className="flex items-center justify-center">
              <Emoji emoji={emojis[mark]} size={48} type="3d" />
            </span>
        )}
      </button>
  );
}

export default function Game() {
  const [s, setS] = useState<Save>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(true);
  const [board, setBoard] = useState<(P | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<P>(0);
  const [win, setWin] = useState<number[] | null>(null);
  const [over, setOver] = useState<null | "win" | "draw">(null);
  const [modal, setModal] = useState(false);
  const [picker, setPicker] = useState<P | null>(null);
  const [editing, setEditing] = useState<P | null>(null);
  const [cursor, setCursor] = useState("");
  const confetti = useRef<ConfettiRef>(null);
  const [bg, setBg] = useState<string[]>(() => POOL.slice(0, 10));
  useEffect(() => {
    setBg([...POOL].sort(() => Math.random() - 0.5).slice(0, 10));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = { ...DEFAULTS, ...JSON.parse(raw) } as Save;
        setS(d);
        setTurn(startFor(d));
      }
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s, ready]);
  useEffect(() => setCursor(cursorFor(s.emojis[turn])), [s.emojis, turn]);

  const fire = useCallback(() => {
    const o = { spread: 80, startVelocity: 45, ticks: 220, particleCount: 90 };
    confetti.current?.fire({ ...o, angle: 60, origin: { x: 0.1, y: 0.75 } });
    confetti.current?.fire({ ...o, angle: 120, origin: { x: 0.9, y: 0.75 } });
  }, []);

  const play = (i: number) => {
    if (setup || over || board[i] !== null) return;
    const b = [...board];
    b[i] = turn;
    setBoard(b);
    const line = LINES.find((l) => l.every((k) => b[k] === turn));
    if (line) {
      setWin(line);
      setOver("win");
      setS((p) => ({ ...p, scores: turn === 0 ? [p.scores[0] + 1, p.scores[1]] : [p.scores[0], p.scores[1] + 1] }));
      fire();
      setTimeout(() => setModal(true), 1700);
    } else if (b.every((x) => x !== null)) {
      setOver("draw");
      setS((p) => ({ ...p, draws: p.draws + 1 }));
      setTimeout(() => setModal(true), 700);
    } else setTurn(turn === 0 ? 1 : 0);
  };

  const newRound = (next: P) => {
    setBoard(Array(9).fill(null));
    setWin(null);
    setOver(null);
    setModal(false);
    setTurn(next);
  };
  const resetAll = () => {
    try { localStorage.removeItem(KEY); } catch {}
    setS(DEFAULTS);
    newRound(0);
    setSetup(true);
  };
  const setName = (p: P, v: string) => {
    const n = v.trim().slice(0, 12) || DEFAULTS.names[p];
    setS((x) => ({ ...x, names: p === 0 ? [n, x.names[1]] : [x.names[0], n] }));
    setEditing(null);
  };
  const setEmoji = (p: P, e: string) => {
    setS((x) => ({ ...x, emojis: p === 0 ? [e, x.emojis[1]] : [x.emojis[0], e] }));
    setPicker(null);
  };

  return (
      <main
          style={{ cursor: !setup && !modal && cursor ? cursor : undefined }}
          className="relative flex h-dvh w-screen flex-col items-center justify-center gap-[3dvh] overflow-hidden bg-gradient-to-br from-fuchsia-100 via-sky-100 to-amber-100"
      >
        <Floaters emojis={setup ? bg : [s.emojis[turn]]} />
        <Confetti ref={confetti} manualstart className="pointer-events-none fixed inset-0 z-[100] size-full" />

        {/* Scoreboard */}
        <div className="relative z-10 flex items-center gap-3">
          {([0, 1] as P[]).map((p) => (
              <div
                  key={p}
                  className={`flex items-center gap-2 rounded-2xl bg-white px-4 py-2 shadow-[0_6px_16px_-8px_rgba(30,27,75,0.3)] ring-2 transition-all duration-300 ${
                      turn === p && !over ? "scale-105 ring-violet-400" : "ring-transparent"
                  }`}
              >
                <Emoji emoji={s.emojis[p]} size={30} type="3d" />
                <span className={`text-sm font-bold ${TONE[p]}`}>{s.names[p]}</span>
                <span className="ml-1 rounded-lg bg-slate-100 px-2 text-lg font-black text-slate-700">{s.scores[p]}</span>
              </div>
          ))}
        </div>

        {/* Board */}
        <div
            className="relative z-10 grid grid-cols-3 gap-[min(2.5vw,1.8dvh)] rounded-[2rem] bg-white/80 p-[min(3vw,2.2dvh)] shadow-[0_24px_50px_-20px_rgba(99,102,241,0.45)] ring-1 ring-white"
            style={{ width: "min(90vw, 58dvh)" }}
        >
          {board.map((m, i) => {
            const wi = win ? win.indexOf(i) : -1;
            return <Cell key={i} mark={m} emojis={s.emojis} wi={wi} onClick={() => play(i)} />;
          })}
        </div>

        {/* Setup modal */}
        <Dialog open={setup} onOpenChange={() => {}}>
          <DialogContent showCloseButton={false} className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-center text-3xl font-black">Tic Tac Toe</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              {([0, 1] as P[]).map((p) => (
                  <div key={p} className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgba(30,27,75,0.06)]">
                    <button
                        onClick={() => setPicker(p)}
                        className="rounded-2xl bg-white p-3 shadow-[0_6px_14px_-6px_rgba(30,27,75,0.3)] transition-transform hover:scale-110 active:scale-95"
                    >
                      <Emoji emoji={s.emojis[p]} size={56} type="3d" />
                    </button>
                    {editing === p ? (
                        <input
                            autoFocus
                            maxLength={12}
                            defaultValue={s.names[p]}
                            onFocus={(e) => e.target.select()}
                            onBlur={(e) => setName(p, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                            className="w-full rounded-lg border border-violet-300 bg-white px-2 py-1 text-center font-bold outline-none"
                        />
                    ) : (
                        <button onClick={() => setEditing(p)} className={`rounded-lg px-2 py-1 font-bold hover:bg-white ${TONE[p]}`}>
                          {s.names[p]}
                        </button>
                    )}
                  </div>
              ))}
            </div>
            <DialogFooter>
              <Button size="lg" className="w-full rounded-2xl text-lg font-black" onClick={() => setSetup(false)}>
                Play
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Emoji picker */}
        <Dialog open={picker !== null} onOpenChange={(o) => !o && setPicker(null)}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle>Pick an emoji</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-8 gap-1">
              {POOL.map((e) => (
                  <button
                      key={e}
                      disabled={picker !== null && s.emojis[picker === 0 ? 1 : 0] === e}
                      onClick={() => picker !== null && setEmoji(picker, e)}
                      className="grid place-items-center rounded-xl p-1 transition-transform hover:scale-125 hover:bg-slate-100 active:scale-95 disabled:opacity-25"
                  >
                    <Emoji emoji={e} size={30} type="3d" />
                  </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Result modal */}
        <Dialog open={modal} onOpenChange={() => {}}>
          <DialogContent showCloseButton={false} className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-black">
                {over === "win" ? `Congratulations ${s.names[turn]}!` : "It's a draw!"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center gap-5 rounded-2xl bg-slate-50 py-4">
              {([0, 1] as P[]).map((p) => (
                  <div key={p} className={`flex flex-col items-center gap-1 ${p === 1 ? "order-3" : ""}`}>
                    <Emoji emoji={s.emojis[p]} size={40} type="3d" />
                    <span className="text-xs font-bold text-slate-500">{s.names[p]}</span>
                    <span className={`text-4xl font-black ${TONE[p]}`}>{s.scores[p]}</span>
                  </div>
              ))}
              <div className="order-2 flex flex-col items-center rounded-xl bg-white px-4 py-2 shadow-[0_4px_10px_-4px_rgba(30,27,75,0.25)]">
                <span className="text-xs font-bold text-slate-500">Draws</span>
                <span className="text-2xl font-black text-amber-500">{s.draws}</span>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={resetAll}>Reset All</Button>
              <Button className="flex-1 rounded-2xl font-bold" onClick={() => newRound(startFor(s))}>New Game</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
  );
}