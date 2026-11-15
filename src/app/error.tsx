"use client";

/** Recovery screen: instead of a blank crash, let the user clear saved state and reload. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const resetState = () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("mars-pathfinder")).forEach((k) => localStorage.removeItem(k));
    } catch { /* storage may be blocked */ }
    window.location.reload();
  };
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-[15px] font-semibold">Mars Pathfinder hit an unexpected error</div>
      <p className="max-w-md text-muted">Saved settings from an earlier visit may not match this version of the app. Resetting them usually fixes it.</p>
      <div className="flex gap-2">
        <button onClick={resetState} className="rounded border border-ink/60 px-3 py-1.5 hover:bg-white/5">Reset saved state and reload</button>
        <button onClick={reset} className="rounded border border-line px-3 py-1.5 text-muted hover:text-ink">Try again</button>
      </div>
      <p className="num max-w-lg text-[11px] text-faint">{error.message}</p>
    </div>
  );
}
