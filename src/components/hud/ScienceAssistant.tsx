"use client";
import { useState } from "react";
import { AssistantContext, findEntry, KNOWLEDGE } from "@/lib/data/knowledge";

interface Turn { q: string; id: string | null }

export function ScienceAssistant({ ctx, onClose }: { ctx: AssistantContext; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const ask = (q: string) => {
    const e = findEntry(q);
    setTurns((t) => [{ q, id: e?.id ?? null }, ...t].slice(0, 6));
    setText("");
  };
  return (
    <div className="panel flex max-h-[62vh] w-[min(560px,calc(100vw-640px))] flex-col text-[12px]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <span className="font-semibold">Science assistant</span>
          <span className="ml-2 text-faint">onboard curated knowledge base · works offline · not a language model</span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-ink">close</button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
        {KNOWLEDGE.map((k) => (
          <button key={k.id} onClick={() => ask(k.question)} className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">{k.question}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask(text.trim()); }} className="flex gap-1.5 border-b border-line px-3 py-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about the target, terrain, O₂, radio, radiation, weather…" className="flex-1 rounded border border-line bg-space/70 px-2 py-1 outline-none focus:border-muted" />
        <button className="rounded border border-ink/60 px-2 py-1 hover:bg-white/5">Ask</button>
      </form>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-2">
        {turns.length === 0 && <p className="text-muted">Pick a question or type one. Every answer separates what NASA measured, what this tool computed, and what is interpretation.</p>}
        {turns.map((t, i) => {
          const e = t.id ? KNOWLEDGE.find((k) => k.id === t.id)! : null;
          const a = e?.answer(ctx);
          return (
            <div key={i} className="space-y-1.5">
              <div className="font-medium">› {t.q}</div>
              {!a ? (
                <p className="text-caution">No verified answer in the onboard knowledge base. Log the question for Mission Control.</p>
              ) : (
                <>
                  <div className="border-l-2 border-nominal/70 pl-2">
                    <div className="text-[10px] font-semibold tracking-wide text-nominal">[1] NASA MEASURED DATA</div>
                    {a.measured.map((m) => <div key={m.text} className="leading-[1.45]">{m.text} <span className="text-faint">— {m.source}</span></div>)}
                  </div>
                  <div className="border-l-2 border-hud/70 pl-2">
                    <div className="text-[10px] font-semibold tracking-wide text-hud">[2] DERIVED PRODUCTS & MODELS</div>
                    {a.derived.map((d) => <div key={d} className="leading-[1.45]">{d}</div>)}
                  </div>
                  <div className="border-l-2 border-caution/70 pl-2">
                    <div className="text-[10px] font-semibold tracking-wide text-caution">[3] INTERPRETATION & LIMITATIONS</div>
                    {a.interpretation.map((d) => <div key={d} className="leading-[1.45]">{d}</div>)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
