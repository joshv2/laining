export type BoundarySegment = {
  pasukId: string;
  startMs: number;
  endMs: number;
};

export function clampSeekToSegment(timeMs: number, segment: BoundarySegment): number {
  if (timeMs < segment.startMs) return segment.startMs;
  if (timeMs > segment.endMs) return segment.endMs;
  return timeMs;
}

export function buildPortionTimeline(segments: BoundarySegment[]): BoundarySegment[] {
  return [...segments].sort((a, b) => a.startMs - b.startMs);
}
