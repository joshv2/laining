"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatPasukRef } from "@/lib/formatters/pasuk";
import PasukSelect from "@/app/submit/pasuk-select";

type ChapterSummary = {
  id: string;
  number: number;
  _count: {
    pesukim: number;
  };
};

type BookSummary = {
  id: string;
  titleEn: string;
  titleHe: string;
  chapters: ChapterSummary[];
};

type WorkSummary = {
  id: string;
  titleEn: string;
  titleHe: string;
  books: BookSummary[];
};

type Pasuk = {
  id: string;
  number: number;
  ref: string;
  hebrewText: string;
  englishText: string | null;
  chapterId: string;
  chapterNumber: number;
};

type RecordingBoundary = {
  pasukId: string;
  startMs: number;
  endMs: number;
  pasuk: {
    ref: string;
    number: number;
    hebrewText: string | null;
    englishText: string | null;
  };
};

type AutoAlignmentWord = {
  text: string;
  start: number;
  end: number;
  confidence: number;
};

type AutoAlignmentResult = {
  text: string;
  confidence: number | null;
  audioDurationMs: number | null;
  words: AutoAlignmentWord[];
  model?: string;
  source?: string;
  languageCode?: string;
};

type RecordingItem = {
  id: string;
  title: string | null;
  nussach: string;
  nussachCustom: string | null;
  publicUrl: string;
  durationMs: number;
  createdAt: string;
  autoAlignmentStatus: string | null;
  autoAlignmentResult: AutoAlignmentResult | null;
  primaryPasukId: string;
  user: {
    id: string;
    name: string | null;
  };
  boundaries: RecordingBoundary[];
  matchType: "primary" | "boundary" | "none";
};

type RecordingAccessMode = "assigned-only" | "public-catalog";
type PlaybackEventType = "PLAY" | "PAUSE" | "ENDED" | "PASUK_REPLAY";

type StudentAssignment = {
  id: string;
  dueAt: string | null;
  instructions: string | null;
  createdAt: string;
  group: {
    id: string;
    name: string;
  };
  assignedByTeacher: {
    id: string;
    name: string | null;
    email: string | null;
  };
  recording: {
    id: string;
    title: string | null;
    nussach: string;
    nussachCustom: string | null;
    primaryPasuk: {
      id: string;
      ref: string;
      chapterId: string;
      chapterNumber: number;
      bookId: string;
      bookTitleEn: string;
      workId: string;
      workTitleEn: string;
    };
  };
};

function ms(value: number): string {
  return `${Math.max(0, Math.round(value))} ms`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBoundaryIndexForPasuk(recording: RecordingItem | null | undefined, selectedPasukId: string): number {
  if (!recording || !selectedPasukId) {
    return 0;
  }

  const matchIndex = recording.boundaries.findIndex((item) => item.pasukId === selectedPasukId);
  return matchIndex >= 0 ? matchIndex : 0;
}

function splitHebrewWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function getSingAlongWordIndex(boundary: RecordingBoundary | null, currentMs: number, alignmentWords: AutoAlignmentWord[] | null | undefined): number {
  if (!boundary) {
    return -1;
  }

  const words = splitHebrewWords(boundary.pasuk.hebrewText ?? "");
  if (words.length === 0) {
    return -1;
  }

  if (alignmentWords && alignmentWords.length > 0) {
    const boundaryWords = alignmentWords.filter((item) => item.start >= boundary.startMs && item.end <= boundary.endMs + 30);
    if (boundaryWords.length > 0) {
      for (let index = 0; index < boundaryWords.length; index += 1) {
        const word = boundaryWords[index];
        if (currentMs <= word.end) {
          return clamp(index, 0, words.length - 1);
        }
      }

      return clamp(boundaryWords.length - 1, 0, words.length - 1);
    }
  }

  const durationMs = boundary.endMs - boundary.startMs;
  if (durationMs <= 0) {
    return 0;
  }

  const progress = clamp((currentMs - boundary.startMs) / durationMs, 0, 0.9999);
  return Math.min(words.length - 1, Math.floor(progress * words.length));
}

function getBoundaryAlignmentWords(boundary: RecordingBoundary | null, alignmentWords: AutoAlignmentWord[] | null | undefined): AutoAlignmentWord[] {
  if (!boundary || !alignmentWords || alignmentWords.length === 0) {
    return [];
  }

  return alignmentWords.filter((item) => item.start >= boundary.startMs && item.end <= boundary.endMs + 30);
}

export function LearnerWorkbench() {
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [bookPesukim, setBookPesukim] = useState<Pasuk[]>([]);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);

  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingPesukim, setLoadingPesukim] = useState(false);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [recordingAccessMode, setRecordingAccessMode] = useState<RecordingAccessMode>("public-catalog");
  const [recordingsReloadKey, setRecordingsReloadKey] = useState(0);
  const [preferredRecordingId, setPreferredRecordingId] = useState<string | null>(null);

  const [workId, setWorkId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [pasukId, setPasukId] = useState("");

  const [selectedRecordingId, setSelectedRecordingId] = useState("");
  const [currentMs, setCurrentMs] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [focusedBoundaryIndex, setFocusedBoundaryIndex] = useState(0);
  const [segmentStopMs, setSegmentStopMs] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const segmentStopRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      setLoadingLibrary(true);
      try {
        const response = await fetch("/api/text/library");
        const data = await response.json();
        if (!cancelled) {
          setWorks(data.works ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadingLibrary(false);
        }
      }
    }

    loadLibrary();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      setLoadingAssignments(true);
      try {
        const response = await fetch("/api/assignments/mine");
        const data = await response.json();
        if (!cancelled) {
          setAssignments((data.assignments ?? []) as StudentAssignment[]);
        }
      } finally {
        if (!cancelled) {
          setLoadingAssignments(false);
        }
      }
    }

    loadAssignments();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedWork = useMemo(() => works.find((item) => item.id === workId), [works, workId]);
  const selectedBook = useMemo(() => selectedWork?.books.find((item) => item.id === bookId), [selectedWork, bookId]);

  const chapterPesukim = useMemo(() => {
    if (!chapterId) return bookPesukim;
    return bookPesukim.filter((item) => item.chapterId === chapterId);
  }, [bookPesukim, chapterId]);
  const selectedPasuk = useMemo(() => chapterPesukim.find((item) => item.id === pasukId) ?? null, [chapterPesukim, pasukId]);

  const selectedRecording = useMemo(
    () => recordings.find((item) => item.id === selectedRecordingId) ?? null,
    [recordings, selectedRecordingId],
  );

  const activeBoundaries = useMemo(() => selectedRecording?.boundaries ?? [], [selectedRecording]);
  const selectedPasukBoundaryIndex = useMemo(
    () => getBoundaryIndexForPasuk(selectedRecording, pasukId),
    [selectedRecording, pasukId],
  );

  const playbackBoundaryIndex = useMemo(
    () => activeBoundaries.findIndex((item) => currentMs >= item.startMs && currentMs <= item.endMs),
    [activeBoundaries, currentMs],
  );

  const effectiveBoundaryIndex =
    isAudioPlaying && playbackBoundaryIndex >= 0
      ? playbackBoundaryIndex
      : pasukId
        ? selectedPasukBoundaryIndex
        : focusedBoundaryIndex;
  const focusedBoundary = activeBoundaries[effectiveBoundaryIndex] ?? null;
  const displayBoundary = useMemo<RecordingBoundary | null>(() => {
    if (focusedBoundary) {
      return focusedBoundary;
    }

    if (!selectedRecording || !selectedPasuk || recordingAccessMode !== "assigned-only") {
      return null;
    }

    return {
      pasukId: selectedPasuk.id,
      startMs: 0,
      endMs: Math.max(1, selectedRecording.durationMs),
      pasuk: {
        ref: selectedPasuk.ref,
        number: selectedPasuk.number,
        hebrewText: selectedPasuk.hebrewText,
        englishText: selectedPasuk.englishText,
      },
    };
  }, [focusedBoundary, recordingAccessMode, selectedPasuk, selectedRecording]);
  const alignmentWords = selectedRecording?.autoAlignmentResult?.words ?? null;

  useEffect(() => {
    if (!bookId) {
      return;
    }

    let cancelled = false;

    async function loadPesukim() {
      setLoadingPesukim(true);
      try {
        const response = await fetch(`/api/text/pesukim?bookId=${encodeURIComponent(bookId)}`);
        const data = await response.json();
        if (!cancelled) {
          setBookPesukim(data.pesukim ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadingPesukim(false);
        }
      }
    }

    loadPesukim();

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!pasukId) {
      return;
    }

    let cancelled = false;

    async function loadRecordings() {
      setLoadingRecordings(true);
      try {
        const response = await fetch(`/api/recordings?pasukId=${encodeURIComponent(pasukId)}`);
        const data = await response.json();
        if (!cancelled) {
          const nextRecordings = (data.recordings ?? []) as RecordingItem[];
          const nextAccessMode =
            data.accessMode === "assigned-only" ? ("assigned-only" as const) : ("public-catalog" as const);
          const preferredRecording = preferredRecordingId
            ? nextRecordings.find((item) => item.id === preferredRecordingId) ?? null
            : null;
          const nextSelectedRecording = preferredRecording ?? nextRecordings[0] ?? null;
          setRecordings(nextRecordings);
          setRecordingAccessMode(nextAccessMode);
          setSelectedRecordingId(nextSelectedRecording?.id ?? "");
          setFocusedBoundaryIndex(getBoundaryIndexForPasuk(nextSelectedRecording, pasukId));
          setCurrentMs(0);
          segmentStopRef.current = null;
          setSegmentStopMs(null);
          setPreferredRecordingId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRecordings(false);
        }
      }
    }

    loadRecordings();

    return () => {
      cancelled = true;
    };
  }, [pasukId, preferredRecordingId, recordingsReloadKey]);

  useEffect(() => {
    if (!selectedRecording) {
      return;
    }

    const recording = selectedRecording;

    let cancelled = false;

    async function ensureTextLoaded() {
      const pasuksToLoad = [
        { id: recording.primaryPasukId, ref: recording.boundaries[0]?.pasuk?.ref || "Unknown" },
        ...recording.boundaries.map((b) => ({ id: b.pasukId, ref: b.pasuk.ref })),
      ];

      const uniquePasukIds = Array.from(new Set(pasuksToLoad.map((p) => p.id)));
      const needsLoading = uniquePasukIds.filter((id) => {
        const boundary = recording.boundaries.find((b) => b.pasukId === id);
        return !boundary?.pasuk.hebrewText;
      });

      if (needsLoading.length === 0) {
        return;
      }

      for (const pasukId of needsLoading) {
        if (cancelled) break;
        try {
          const response = await fetch("/api/text/ensure-loaded", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ pasukId }),
          });
          if (!response.ok) {
            console.error(`Failed to load text for pasuk ${pasukId}: status ${response.status}`);
          }
        } catch (error) {
          console.error(`Failed to load text for pasuk ${pasukId}:`, error);
        }
      }

      // Reload the selected recording to get updated text
      if (!cancelled && selectedRecordingId) {
        try {
          const response = await fetch(`/api/recordings?pasukId=${encodeURIComponent(pasukId)}`);
          const data = await response.json();
          const updated = data.recordings?.find((r: RecordingItem) => r.id === selectedRecordingId);
          if (updated) {
            setRecordings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }
        } catch (error) {
          console.error("Failed to refresh recording:", error);
        }
      }
    }

    ensureTextLoaded();

    return () => {
      cancelled = true;
    };
  }, [selectedRecording, selectedRecordingId, pasukId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const trackPlaybackEvent = (eventType: PlaybackEventType, extra?: { pasukId?: string; positionMs?: number; durationMs?: number }) => {
      if (!selectedRecordingId) {
        return;
      }

      void fetch("/api/playback/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordingId: selectedRecordingId,
          eventType,
          pasukId: extra?.pasukId,
          positionMs: extra?.positionMs,
          durationMs: extra?.durationMs,
        }),
      }).catch(() => undefined);
    };

    const tick = () => {
      setCurrentMs(audio.currentTime * 1000);
      if (!audio.paused && !audio.ended) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };

    const onPlay = () => {
      setIsAudioPlaying(true);
      trackPlaybackEvent("PLAY", { positionMs: Math.round(audio.currentTime * 1000) });
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    };

    const onPause = () => {
      setIsAudioPlaying(false);
      trackPlaybackEvent("PAUSE", { positionMs: Math.round(audio.currentTime * 1000) });
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentMs(audio.currentTime * 1000);
    };

    const onEnded = () => {
      setIsAudioPlaying(false);
      trackPlaybackEvent("ENDED", {
        positionMs: Math.round(audio.duration * 1000),
        durationMs: selectedRecording?.durationMs,
      });
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentMs(audio.duration * 1000);
      segmentStopRef.current = null;
      setSegmentStopMs(null);
    };

    const onTimeUpdate = () => {
      const stopMs = segmentStopRef.current;
      if (stopMs == null) {
        return;
      }

      const current = audio.currentTime * 1000;
      if (current >= stopMs) {
        audio.pause();
        audio.currentTime = stopMs / 1000;
        setCurrentMs(stopMs);
        segmentStopRef.current = null;
        setSegmentStopMs(null);
      }
    };

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
        rafRef.current = null;
      }
    };
  }, [selectedRecording?.durationMs, selectedRecordingId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || segmentStopMs == null) {
      return;
    }

    const current = audio.currentTime * 1000;
    if (current >= segmentStopMs) {
      audio.pause();
      audio.currentTime = segmentStopMs / 1000;
      setCurrentMs(segmentStopMs);
      setSegmentStopMs(null);
    }
  }, [currentMs, segmentStopMs]);

  function handleWorkChange(nextWorkId: string) {
    setWorkId(nextWorkId);
    setBookId("");
    setChapterId("");
    setPasukId("");
    setBookPesukim([]);
    setRecordings([]);
    setRecordingAccessMode("public-catalog");
    setSelectedRecordingId("");
  }

  function handleBookChange(nextBookId: string) {
    setBookId(nextBookId);
    setChapterId("");
    setPasukId("");
    setBookPesukim([]);
    setRecordings([]);
    setRecordingAccessMode("public-catalog");
    setSelectedRecordingId("");
  }

  function handleChapterChange(nextChapterId: string) {
    setChapterId(nextChapterId);
    setPasukId("");
    setRecordings([]);
    setRecordingAccessMode("public-catalog");
    setSelectedRecordingId("");
  }

  function handlePasukChange(nextPasukId: string) {
    setPasukId(nextPasukId);
    setRecordings([]);
    setRecordingAccessMode("public-catalog");
    setSelectedRecordingId("");
    setPreferredRecordingId(null);
    setFocusedBoundaryIndex(0);
    setCurrentMs(0);
    setSegmentStopMs(null);
  }

  function jumpToBoundary(index: number, shouldPlay = false) {
    const boundary = activeBoundaries[index];
    const audio = audioRef.current;
    if (!boundary || !audio) return;

    audio.currentTime = boundary.startMs / 1000;
    setCurrentMs(boundary.startMs);
    setFocusedBoundaryIndex(index);
    segmentStopRef.current = null;
    setSegmentStopMs(null);

    if (shouldPlay) {
      audio.play().catch(() => undefined);
    }
  }

  function playCurrentPasuk() {
    const audio = audioRef.current;
    const boundary = activeBoundaries[selectedPasukBoundaryIndex] ?? displayBoundary;
    if (!audio || !boundary) return;

    audio.pause();
    audio.currentTime = boundary.startMs / 1000;
    setCurrentMs(boundary.startMs);
    setFocusedBoundaryIndex(selectedPasukBoundaryIndex);
    segmentStopRef.current = boundary.endMs;
    setSegmentStopMs(boundary.endMs);
    void fetch("/api/playback/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recordingId: selectedRecordingId,
        eventType: "PASUK_REPLAY",
        pasukId: boundary.pasukId,
        positionMs: boundary.startMs,
      }),
    }).catch(() => undefined);
    audio.play().catch(() => undefined);
  }

  function playWholeRecording() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentMs(0);
    segmentStopRef.current = null;
    setSegmentStopMs(null);
    audio.play().catch(() => undefined);
  }

  function seekWithinPasuk(nextMs: number) {
    const audio = audioRef.current;
    const boundary = displayBoundary;
    if (!audio || !boundary) return;

    const clamped = clamp(nextMs, boundary.startMs, boundary.endMs);
    audio.currentTime = clamped / 1000;
    setCurrentMs(clamped);
  }

  function seekToWord(boundary: RecordingBoundary | null, wordIndex: number) {
    if (!boundary) {
      return;
    }

    const boundaryWords = getBoundaryAlignmentWords(boundary, alignmentWords);
    if (boundaryWords.length > 0) {
      const targetWord = boundaryWords[Math.min(wordIndex, boundaryWords.length - 1)];
      // Nudge 1ms into the token so boundary-equal timestamps do not light the previous word.
      seekWithinPasuk(targetWord.start + 1);
      return;
    }

    const words = splitHebrewWords(boundary.pasuk.hebrewText ?? "");
    if (words.length === 0) {
      seekWithinPasuk(boundary.startMs);
      return;
    }

    const duration = Math.max(1, boundary.endMs - boundary.startMs);
    const fraction = clamp(wordIndex / words.length, 0, 1);
    const estimatedTime = Math.round(boundary.startMs + duration * fraction);
    seekWithinPasuk(estimatedTime);
  }

  function openAssignment(assignment: StudentAssignment) {
    setWorkId(assignment.recording.primaryPasuk.workId);
    setBookId(assignment.recording.primaryPasuk.bookId);
    setChapterId(assignment.recording.primaryPasuk.chapterId);
    setPasukId(assignment.recording.primaryPasuk.id);
    setRecordings([]);
    setSelectedRecordingId("");
    setPreferredRecordingId(assignment.recording.id);
    setRecordingsReloadKey((value) => value + 1);
    setCurrentMs(0);
    setFocusedBoundaryIndex(0);
    segmentStopRef.current = null;
    setSegmentStopMs(null);
  }

  function formatDate(value: string | null): string {
    if (!value) {
      return "No due date";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "No due date";
    }

    return date.toLocaleDateString("en-US", {
      timeZone: "UTC",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        {!loadingAssignments && assignments.length > 0 ? (
          <div className="mb-5 rounded-xl border border-orange-900/15 bg-orange-50/70 p-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-orange-900">My Assignments</h3>
            <ul className="mt-2 space-y-2">
              {assignments.slice(0, 8).map((assignment) => (
                <li key={assignment.id} className="rounded-lg border border-orange-900/10 bg-white p-2">
                  <p className="text-sm font-semibold text-orange-950">
                    {assignment.recording.title ? `${assignment.recording.title} - ` : ""}
                    {formatPasukRef(assignment.recording.primaryPasuk.ref)} - {assignment.recording.nussach}
                    {assignment.recording.nussachCustom ? ` (${assignment.recording.nussachCustom})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-orange-900/75">
                    Due: {formatDate(assignment.dueAt)} - Teacher: {assignment.assignedByTeacher.name ?? assignment.assignedByTeacher.email ?? "Teacher"}
                  </p>
                  {assignment.instructions ? <p className="mt-1 text-xs text-orange-900/75">{assignment.instructions}</p> : null}
                  <button
                    className="mt-2 rounded-full border border-orange-900/25 px-3 py-1 text-xs font-semibold hover:bg-orange-100"
                    onClick={() => openAssignment(assignment)}
                    type="button"
                  >
                    Open In Learner
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <h2 className="text-lg font-bold text-orange-950">Choose Text</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-semibold text-orange-950">
            Work
            <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={loadingLibrary} onChange={(event) => handleWorkChange(event.target.value)} value={workId}>
              <option value="">Select work</option>
              {works.map((work) => (
                <option key={work.id} value={work.id}>{work.titleEn} - {work.titleHe}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-orange-950">
            Book
            <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={!selectedWork} onChange={(event) => handleBookChange(event.target.value)} value={bookId}>
              <option value="">Select book</option>
              {selectedWork?.books.map((book) => (
                <option key={book.id} value={book.id}>{book.titleEn}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-orange-950">
            Chapter
            <select className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={!selectedBook} onChange={(event) => handleChapterChange(event.target.value)} value={chapterId}>
              <option value="">All chapters</option>
              {selectedBook?.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>Chapter {chapter.number}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-orange-950">
            Pasuk
            <PasukSelect rangePesukim={chapterPesukim}
                        endPasukId={pasukId}
                        handleEndPasukChange={handlePasukChange}
                        loadingPesukim={loadingPesukim}
                      />
          </label>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-orange-900">Approved Recordings</h3>
          {pasukId ? (
            <p className="mt-1 text-xs text-orange-900/70">
              {recordingAccessMode === "assigned-only"
                ? "Showing teacher-assigned recordings for this pasuk."
                : "Showing the public recording catalog for this pasuk."}
            </p>
          ) : null}
          {loadingRecordings ? (
            <p className="mt-2 text-sm text-orange-900/70">Loading recordings...</p>
          ) : recordings.length === 0 ? (
            <p className="mt-2 text-sm text-orange-900/70">
              No approved recordings found for this pasuk yet.{" "}
              <Link className="font-semibold text-orange-900 underline decoration-orange-700 underline-offset-2 hover:text-orange-700" href="/submit">
                Submit a recording
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recordings.map((recording) => (
                <li key={recording.id}>
                  <button
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedRecordingId === recording.id
                        ? "border-orange-700 bg-orange-100"
                        : "border-orange-900/20 bg-white hover:bg-orange-50"
                    }`}
                    onClick={() => {
                      setSelectedRecordingId(recording.id);
                      setFocusedBoundaryIndex(getBoundaryIndexForPasuk(recording, pasukId));
                      setCurrentMs(0);
                      segmentStopRef.current = null;
                      setSegmentStopMs(null);
                    }}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-orange-950">
                        {recording.title ? `${recording.title} - ` : ""}
                        {recording.nussach}
                        {recording.nussachCustom ? ` (${recording.nussachCustom})` : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-orange-900/70">
                      By {recording.user.name ?? "Anonymous"} • {recording.boundaries.length} markers • {ms(recording.durationMs)}
                    </p>
                    <p className="mt-1 text-xs text-orange-900/70">
                      Added {formatDateTime(recording.createdAt)} •
                      Range {formatPasukRef(recording.boundaries[0]?.pasuk.ref ?? "Unknown")} to {formatPasukRef(recording.boundaries[recording.boundaries.length - 1]?.pasuk.ref ?? "Unknown")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-orange-900/20 bg-[var(--surface)] p-5 shadow-[0_12px_28px_rgba(88,31,13,0.1)]">
        <h2 className="text-lg font-bold text-orange-950">Playback</h2>
        {!selectedRecording ? (
          <p className="mt-3 text-sm text-orange-900/70">Pick a pasuk and recording to begin listening.</p>
        ) : (
          <>
            {selectedRecording.title ? (
              <p className="mt-2 text-sm text-orange-900/80">
                Title: <span className="font-semibold">{selectedRecording.title}</span>
              </p>
            ) : null}
            <p className="text-sm text-orange-900/80">
              Nussach: <span className="font-semibold">{selectedRecording.nussach}</span>
              {selectedRecording.nussachCustom ? ` (${selectedRecording.nussachCustom})` : ""}
            </p>
            <p className="text-sm text-orange-900/80">Duration: {ms(selectedRecording.durationMs)}</p>
            <p className="text-sm text-orange-900/80">
              Covers Pesukim: {activeBoundaries.map((item) => formatPasukRef(item.pasuk.ref)).join(", ")}
            </p>

            <audio className="mt-3 w-full" controls preload="metadata" ref={audioRef} src={selectedRecording.publicUrl} />

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                className="rounded-full border border-orange-900/25 px-3 py-2 text-sm font-semibold hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={activeBoundaries.length === 0 || effectiveBoundaryIndex <= 0}
                onClick={() => jumpToBoundary(Math.max(0, effectiveBoundaryIndex - 1), true)}
                type="button"
              >
                Prev Pasuk
              </button>
              <button
                className="rounded-full border border-orange-900/25 px-3 py-2 text-sm font-semibold hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={activeBoundaries.length === 0 || effectiveBoundaryIndex >= activeBoundaries.length - 1}
                onClick={() => jumpToBoundary(Math.min(activeBoundaries.length - 1, effectiveBoundaryIndex + 1), true)}
                type="button"
              >
                Next Pasuk
              </button>
              <button className="rounded-full bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700" onClick={playCurrentPasuk} type="button">
                Play Current Pasuk
              </button>
              <button className="rounded-full bg-lime-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lime-700" onClick={playWholeRecording} type="button">
                Play Full Range
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-orange-900/15 bg-orange-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-900/80">Current Time</p>
              <p className="font-mono text-2xl font-bold text-orange-950">{ms(currentMs)}</p>

              {displayBoundary ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-orange-950">Focused Pasuk: {formatPasukRef(displayBoundary.pasuk.ref)}</p>
                  <input
                    className="mt-2 w-full"
                    max={displayBoundary.endMs}
                    min={displayBoundary.startMs}
                    onChange={(event) => seekWithinPasuk(Number(event.target.value))}
                    type="range"
                    value={clamp(currentMs, displayBoundary.startMs, displayBoundary.endMs)}
                  />
                  <p className="mt-1 text-xs text-orange-900/75">
                    Seek within pasuk from {ms(displayBoundary.startMs)} to {ms(displayBoundary.endMs)}
                  </p>
                </>
              ) : null}
            </div>

            {recordingAccessMode === "assigned-only" && displayBoundary ? (
              <section className="mt-4 rounded-2xl border border-orange-900/15 bg-white p-4 shadow-[0_8px_18px_rgba(88,31,13,0.08)]">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-900/75">Sing-along Mode</p>
                    <h3 className="mt-1 text-base font-bold text-orange-950">Follow the highlighted words with the recording</h3>
                  </div>
                  <p className="text-xs text-orange-900/70">
                    {selectedRecording.autoAlignmentStatus === "completed"
                      ? "AssemblyAI timings ready"
                      : selectedRecording.autoAlignmentStatus === "processing"
                        ? "AssemblyAI alignment running"
                        : "Teacher/student only for now"}
                  </p>
                </div>

                <div className="mt-3 rounded-2xl bg-orange-50/80 p-4" dir="rtl" lang="he">
                  <p className="text-right text-sm font-semibold text-orange-900/70">{formatPasukRef(displayBoundary.pasuk.ref)}</p>
                  <div className="text-hebrew mt-3 w-full text-right text-2xl leading-[2.1] text-orange-950 md:text-3xl">
                    {splitHebrewWords(displayBoundary.pasuk.hebrewText ?? "").length > 0 ? (
                      splitHebrewWords(displayBoundary.pasuk.hebrewText ?? "").map((word, index) => {
                        const isActive = index === getSingAlongWordIndex(displayBoundary, currentMs, alignmentWords);
                        return (
                          <span key={`${displayBoundary.pasukId}-${index}-${word}`} className="inline-block align-baseline">
                            <button
                              className={`mb-2 cursor-pointer rounded-lg px-2 py-1 text-right transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${
                                isActive
                                  ? "bg-orange-600 text-white shadow-[0_6px_14px_rgba(234,88,12,0.28)]"
                                  : "text-orange-950/70 hover:bg-orange-200/60"
                              }`}
                              onClick={() => seekToWord(displayBoundary, index)}
                              title="Click to seek to this word"
                              type="button"
                            >
                              {word}
                            </button>{" "}
                          </span>
                        );
                      })
                    ) : (
                      <p className="rounded-lg border border-dashed border-orange-900/20 bg-white/70 px-3 py-4 text-right text-sm text-orange-900/70">
                        Pasuk text is not loaded yet.
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-left text-xs font-semibold text-orange-900/70" dir="ltr">Tip: click any word to jump playback inside this pasuk.</p>
                </div>

                {displayBoundary.pasuk.englishText ? (
                  <p className="mt-3 text-sm text-orange-900/75">Translation: {displayBoundary.pasuk.englishText}</p>
                ) : null}
              </section>
            ) : null}

            <div className="mt-4 max-h-52 overflow-auto rounded-xl border border-orange-900/15 bg-white">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-orange-100 text-left uppercase tracking-wide text-orange-900">
                    <th className="px-3 py-2">Pasuk</th>
                    <th className="px-3 py-2">Start</th>
                    <th className="px-3 py-2">End</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBoundaries.map((boundary, index) => (
                    <tr
                      key={`${boundary.pasukId}-${boundary.startMs}`}
                      className={index === effectiveBoundaryIndex ? "bg-lime-50" : ""}
                      onClick={() => jumpToBoundary(index)}
                    >
                      <td className="cursor-pointer px-3 py-2 font-semibold text-orange-950">{formatPasukRef(boundary.pasuk.ref)}</td>
                      <td className="px-3 py-2 font-mono text-orange-900">{ms(boundary.startMs)}</td>
                      <td className="px-3 py-2 font-mono text-orange-900">{ms(boundary.endMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
