"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BoundaryMarker = {
  pasukId: string;
  pasukRef: string;
  startMs: number;
  endMs: number;
};

type ModerationAudioReviewerProps = {
  publicUrl: string;
  durationMs: number;
  boundaries: BoundaryMarker[];
};

function clampPercent(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function formatMs(value: number): string {
  return `${Math.max(0, Math.round(value))} ms`;
}

export function ModerationAudioReviewer({ publicUrl, durationMs, boundaries }: ModerationAudioReviewerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  const resolvedDuration = durationMs > 0 ? durationMs : 1;

  const activeBoundaryIndex = useMemo(
    () => boundaries.findIndex((item) => currentMs >= item.startMs && currentMs <= item.endMs),
    [boundaries, currentMs],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      setCurrentMs(audio.currentTime * 1000);
      if (!audio.paused && !audio.ended) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    const onPause = () => {
      setIsPlaying(false);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentMs(audio.currentTime * 1000);
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentMs(audio.duration * 1000);
    };

    const onTimeUpdate = () => setCurrentMs(audio.currentTime * 1000);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <section className="mt-4 rounded-2xl border border-orange-900/15 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-xl bg-orange-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-orange-950">
          {isPlaying ? "Playing" : "Paused"}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-900/70">Live Time</p>
          <p className="font-mono text-xl font-bold text-orange-950">{formatMs(currentMs)}</p>
        </div>
      </div>

      <audio className="mt-3 w-full" controls preload="metadata" ref={audioRef} src={publicUrl} />

      <div className="mt-4 rounded-xl border border-orange-900/15 bg-orange-50/70 p-3">
        <div className="relative h-8 rounded-lg bg-white">
          <div
            className="absolute bottom-0 left-0 top-0 rounded-l-lg bg-orange-200/70"
            style={{ width: `${clampPercent((currentMs / resolvedDuration) * 100)}%` }}
          />

          {boundaries.map((item, index) => {
            const startPct = clampPercent((item.startMs / resolvedDuration) * 100);
            const endPct = clampPercent((item.endMs / resolvedDuration) * 100);
            const width = Math.max(0.6, endPct - startPct);
            const isActive = index === activeBoundaryIndex;

            return (
              <div
                key={`${item.pasukId}-${item.startMs}`}
                className={`absolute top-1/2 h-4 -translate-y-1/2 rounded-sm border ${
                  isActive ? "border-lime-700 bg-lime-400/70" : "border-orange-900/25 bg-orange-300/60"
                }`}
                style={{ left: `${startPct}%`, width: `${width}%` }}
                title={`${item.pasukRef}: ${formatMs(item.startMs)} to ${formatMs(item.endMs)}`}
              />
            );
          })}

          <div
            className="absolute bottom-0 top-0 w-0.5 bg-orange-950"
            style={{ left: `${clampPercent((currentMs / resolvedDuration) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-orange-900/15 bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-orange-100 text-left text-orange-900">
              <th className="px-3 py-2">Pasuk</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
            </tr>
          </thead>
          <tbody>
            {boundaries.map((item, index) => {
              const isActive = index === activeBoundaryIndex;
              return (
                <tr key={`${item.pasukId}-${item.startMs}-row`} className={isActive ? "bg-lime-50" : ""}>
                  <td className="px-3 py-2 font-semibold text-orange-950">{item.pasukRef}</td>
                  <td className="px-3 py-2 font-mono text-orange-900">{formatMs(item.startMs)}</td>
                  <td className="px-3 py-2 font-mono text-orange-900">{formatMs(item.endMs)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
