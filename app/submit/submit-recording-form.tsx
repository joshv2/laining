"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type BoundaryDraft = {
  pasukId: string;
  pasukNumber: number;
  ref: string;
  startMs: string;
  endMs: string;
};

async function detectAudioDurationMs(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const metadataDurationSeconds = await new Promise<number>((resolve, reject) => {
      const audio = document.createElement("audio");
      let settled = false;

      const finish = (value: number) => {
        if (settled) {
          return;
        }
        settled = true;
        audio.removeAttribute("src");
        audio.load();
        resolve(value);
      };

      const fail = () => {
        if (settled) {
          return;
        }
        settled = true;
        audio.removeAttribute("src");
        audio.load();
        reject(new Error("Failed to read audio metadata."));
      };

      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          finish(audio.duration);
          return;
        }

        try {
          // Some recorded blobs report Infinity until seeking once.
          audio.currentTime = Number.MAX_SAFE_INTEGER;
        } catch {
          finish(0);
        }
      };

      audio.ontimeupdate = () => {
        finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
      };

      audio.onerror = () => fail();
      audio.src = objectUrl;
    });

    if (metadataDurationSeconds > 0) {
      return Math.round(metadataDurationSeconds * 1000);
    }
  } catch {
    // Fall through to Web Audio decode fallback below.
  }

  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return 0;
    }

    const context = new AudioContextCtor();
    try {
      const bytes = await file.arrayBuffer();
      const decoded = await context.decodeAudioData(bytes.slice(0));
      if (Number.isFinite(decoded.duration) && decoded.duration > 0) {
        return Math.round(decoded.duration * 1000);
      }
    } finally {
      await context.close();
    }
  } catch {
    return 0;
  }

  return 0;
}

function buildBoundaryRows(params: {
  pesukim: Pasuk[];
  startPasukId: string;
  endPasukId: string;
  previous: BoundaryDraft[];
}): BoundaryDraft[] {
  const { pesukim, startPasukId, endPasukId, previous } = params;
  if (!startPasukId || !endPasukId || pesukim.length === 0) {
    return [];
  }

  const startIdx = pesukim.findIndex((item) => item.id === startPasukId);
  const endIdx = pesukim.findIndex((item) => item.id === endPasukId);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
    return [];
  }

  const selectedRange = pesukim.slice(startIdx, endIdx + 1);
  return selectedRange.map((item) => {
    const existing = previous.find((row) => row.pasukId === item.id);
    return {
      pasukId: item.id,
      pasukNumber: item.number,
      ref: item.ref,
      startMs: existing?.startMs ?? "",
      endMs: existing?.endMs ?? "",
    };
  });
}

const NUSSACH_OPTIONS = [
  "Ashkenazi",
  "Sephardi",
  "Mizrahi",
  "Yemenite",
  "Italian",
  "Other",
] as const;

export function SubmitRecordingForm() {
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(true);
  const [bookPesukim, setBookPesukim] = useState<Pasuk[]>([]);
  const [loadingPesukim, setLoadingPesukim] = useState(false);

  const [workId, setWorkId] = useState("");
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [startPasukId, setStartPasukId] = useState("");
  const [endPasukId, setEndPasukId] = useState("");
  const [crossChapterEnabled, setCrossChapterEnabled] = useState(true);

  const [nussach, setNussach] = useState<(typeof NUSSACH_OPTIONS)[number]>("Ashkenazi");
  const [nussachCustom, setNussachCustom] = useState("");

  const [audioInputMode, setAudioInputMode] = useState<"upload" | "record">("upload");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);

  const [boundaries, setBoundaries] = useState<BoundaryDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordedUrlRef = useRef<string | null>(null);
  const ignoreNextStopRef = useRef(false);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (recordedUrlRef.current) {
        URL.revokeObjectURL(recordedUrlRef.current);
        recordedUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      setLoadingWorks(true);
      try {
        const response = await fetch("/api/text/library");
        const data = await response.json();
        if (!cancelled) {
          setWorks(data.works ?? []);
        }
      } catch {
        if (!cancelled) {
          setWorks([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingWorks(false);
        }
      }
    }

    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedWork = useMemo(() => works.find((item) => item.id === workId), [works, workId]);
  const selectedBook = useMemo(() => selectedWork?.books.find((item) => item.id === bookId), [selectedWork, bookId]);
  const primaryPasukId = useMemo(() => boundaries[0]?.pasukId ?? "", [boundaries]);
  const selectablePesukim = useMemo(() => {
    if (crossChapterEnabled || !chapterId) {
      return bookPesukim;
    }

    return bookPesukim.filter((item) => item.chapterId === chapterId);
  }, [bookPesukim, chapterId, crossChapterEnabled]);
  const isSinglePasukRange = Boolean(startPasukId && endPasukId && startPasukId === endPasukId);

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
      } catch {
        if (!cancelled) {
          setBookPesukim([]);
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

  function handleWorkChange(nextWorkId: string) {
    setWorkId(nextWorkId);
    setBookId("");
    setBookPesukim([]);
    setChapterId("");
    setStartPasukId("");
    setEndPasukId("");
    setBoundaries([]);
  }

  function handleBookChange(nextBookId: string) {
    setBookId(nextBookId);
    setChapterId("");
    setBookPesukim([]);
    setStartPasukId("");
    setEndPasukId("");
    setBoundaries([]);
  }

  function handleChapterChange(nextChapterId: string) {
    setChapterId(nextChapterId);

    const chapterScopedPesukim = nextChapterId
      ? bookPesukim.filter((item) => item.chapterId === nextChapterId)
      : bookPesukim;
    const existingRows = buildBoundaryRows({
      pesukim: chapterScopedPesukim,
      startPasukId,
      endPasukId,
      previous: boundaries,
    });

    if (crossChapterEnabled) {
      return;
    }

    setBoundaries(existingRows);
  }

  function handleStartPasukChange(nextStartPasukId: string) {
    const nextRows = buildBoundaryRows({
      pesukim: bookPesukim,
      startPasukId: nextStartPasukId,
      endPasukId,
      previous: boundaries,
    });

    setStartPasukId(nextStartPasukId);
    setBoundaries(nextRows);
  }

  function handleEndPasukChange(nextEndPasukId: string) {
    const nextRows = buildBoundaryRows({
      pesukim: bookPesukim,
      startPasukId,
      endPasukId: nextEndPasukId,
      previous: boundaries,
    });

    setEndPasukId(nextEndPasukId);
    setBoundaries(nextRows);
  }

  function clearRecordedPreview() {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
    setRecordedPreviewUrl(null);
  }

  function stopRecordingSession() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      ignoreNextStopRef.current = true;
      recorder.stop();
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    recordingChunksRef.current = [];
    setIsRecording(false);
  }

  function handleAudioModeChange(nextMode: "upload" | "record") {
    if (nextMode === audioInputMode) {
      return;
    }

    stopRecordingSession();
    clearRecordedPreview();
    setAudioInputMode(nextMode);
    setAudioFile(null);
    setDurationMs(0);
  }

  async function handleAudioSelected(file: File | null) {
    setAudioFile(file);
    setDurationMs(0);
    if (!file) {
      return;
    }

    const milliseconds = await detectAudioDurationMs(file);
    setDurationMs(milliseconds);
  }

  async function startBrowserRecording() {
    setError(null);
    setSuccessMessage(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Browser recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const supportedMimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
      };

      recorder.onstop = async () => {
        if (ignoreNextStopRef.current) {
          ignoreNextStopRef.current = false;
          recordingChunksRef.current = [];
          mediaRecorderRef.current = null;
          setIsRecording(false);
          return;
        }

        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        const extension = blobType.includes("ogg") ? "ogg" : blobType.includes("mp4") ? "m4a" : "webm";
        const recordedFile = new File([blob], `browser-recording-${Date.now()}.${extension}`, {
          type: blob.type || blobType,
        });

        if (recordedUrlRef.current) {
          URL.revokeObjectURL(recordedUrlRef.current);
        }

        const previewUrl = URL.createObjectURL(blob);
        recordedUrlRef.current = previewUrl;
        setRecordedPreviewUrl(previewUrl);

        await handleAudioSelected(recordedFile);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setError("Unable to access microphone. Check browser permissions and try again.");
      setIsRecording(false);
    }
  }

  function stopBrowserRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }

  function updateBoundary(index: number, field: "startMs" | "endMs", value: string) {
    setBoundaries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!audioFile) {
      setError(audioInputMode === "record" ? "Please record audio in the browser." : "Please choose an audio file.");
      return;
    }

    if (!startPasukId || !endPasukId || !primaryPasukId) {
      setError("Please choose a valid pasuk range.");
      return;
    }

    if (!durationMs) {
      setError("Audio duration could not be detected. Please choose another file.");
      return;
    }

    const parsedBoundaries = isSinglePasukRange
      ? [{ pasukId: primaryPasukId, startMs: 0, endMs: durationMs }]
      : boundaries.map((item) => ({
          pasukId: item.pasukId,
          startMs: Number(item.startMs),
          endMs: Number(item.endMs),
        }));

    if (!isSinglePasukRange && parsedBoundaries.some((item) => !Number.isFinite(item.startMs) || !Number.isFinite(item.endMs))) {
      setError("Every boundary must include numeric start and end times in milliseconds.");
      return;
    }

    if (!isSinglePasukRange && parsedBoundaries.some((item) => item.startMs < 0 || item.endMs <= item.startMs)) {
      setError("Every boundary must have start >= 0 and end > start.");
      return;
    }

    const exceedsDuration = parsedBoundaries.some((item) => item.endMs > durationMs);
    if (exceedsDuration) {
      setError("One or more boundary end times exceed the audio duration.");
      return;
    }

    setSubmitting(true);

    try {
      const uploadForm = new FormData();
      uploadForm.set("file", audioFile);

      const uploadResponse = await fetch("/api/uploads/audio", {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json();
        throw new Error(uploadError.error ?? "Upload failed");
      }

      const upload = await uploadResponse.json();

      const nussachPayload = nussach === "Other" ? "Custom" : nussach;
      const createResponse = await fetch("/api/recordings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryPasukId,
          rangeStartPasukId: startPasukId,
          rangeEndPasukId: endPasukId,
          source: audioInputMode === "record" ? "BROWSER_RECORDING" : "UPLOAD",
          nussach: nussachPayload,
          nussachCustom: nussach === "Other" ? nussachCustom : undefined,
          storageKey: upload.objectKey,
          publicUrl: `${window.location.origin}${upload.publicUrl}`,
          durationMs,
        }),
      });

      if (!createResponse.ok) {
        const createError = await createResponse.json();
        throw new Error(createError.error ?? "Failed to create recording");
      }

      const created = await createResponse.json();

      const boundariesResponse = await fetch(`/api/recordings/${created.recording.id}/boundaries`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ boundaries: parsedBoundaries }),
      });

      if (!boundariesResponse.ok) {
        const boundaryError = await boundariesResponse.json();
        throw new Error(boundaryError.error ?? "Failed to save boundaries");
      }

      setSuccessMessage("Recording submitted successfully. It is now pending moderator approval.");
      setAudioFile(null);
      setDurationMs(0);
      clearRecordedPreview();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCrossChapterChange(enabled: boolean) {
    setCrossChapterEnabled(enabled);

    const sourcePesukim = enabled || !chapterId ? bookPesukim : selectablePesukim;
    const nextRows = buildBoundaryRows({
      pesukim: sourcePesukim,
      startPasukId,
      endPasukId,
      previous: boundaries,
    });

    setBoundaries(nextRows);
  }

  const canSubmit = !submitting && boundaries.length > 0 && bookPesukim.length > 0 && !!audioFile && durationMs > 0;

  return (
    <form className="space-y-8 rounded-3xl border border-orange-900/20 bg-[var(--surface)] p-6 shadow-[0_18px_45px_rgba(88,31,13,0.14)]" onSubmit={handleSubmit}>
      <section className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-orange-950">
          Work
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={loadingWorks} onChange={(event) => handleWorkChange(event.target.value)} value={workId}>
            <option value="">Select a work</option>
            {works.map((work) => (
              <option key={work.id} value={work.id}>{work.titleEn} - {work.titleHe}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-orange-950">
          Book
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={!selectedWork} onChange={(event) => handleBookChange(event.target.value)} value={bookId}>
            <option value="">Select a book</option>
            {selectedWork?.books.map((book) => (
              <option key={book.id} value={book.id}>{book.titleEn} - {book.titleHe}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-orange-950">
          Chapter
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={!selectedBook} onChange={(event) => handleChapterChange(event.target.value)} value={chapterId}>
            <option value="">All chapters in selected book</option>
            {selectedBook?.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>Chapter {chapter.number} ({chapter._count.pesukim} pesukim)</option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-2xl border border-orange-900/15 bg-orange-50/70 p-4">
        <label className="inline-flex items-center gap-3 text-sm font-semibold text-orange-950">
          <input checked={crossChapterEnabled} onChange={(event) => handleCrossChapterChange(event.target.checked)} type="checkbox" />
          Allow range to span multiple chapters
        </label>
        <p className="mt-2 text-xs text-orange-900/75">
          Keep enabled to select start and end pesukim anywhere in the selected book.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-orange-950">
          Start Pasuk
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={loadingPesukim || selectablePesukim.length === 0} onChange={(event) => handleStartPasukChange(event.target.value)} value={startPasukId}>
            <option value="">Select start</option>
            {selectablePesukim.map((pasuk) => (
              <option key={pasuk.id} value={pasuk.id}>{pasuk.ref} (Ch. {pasuk.chapterNumber})</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-orange-950">
          End Pasuk
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={loadingPesukim || selectablePesukim.length === 0} onChange={(event) => handleEndPasukChange(event.target.value)} value={endPasukId}>
            <option value="">Select end</option>
            {selectablePesukim.map((pasuk) => (
              <option key={pasuk.id} value={pasuk.id}>{pasuk.ref} (Ch. {pasuk.chapterNumber})</option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-semibold text-orange-950">
          Nussach
          <select className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" onChange={(event) => setNussach(event.target.value as (typeof NUSSACH_OPTIONS)[number])} value={nussach}>
            {NUSSACH_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-orange-950 md:col-span-2">
          Custom Nussach Label (optional)
          <input className="mt-2 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2" disabled={nussach !== "Other"} onChange={(event) => setNussachCustom(event.target.value)} placeholder="For custom traditions" value={nussachCustom} />
        </label>
      </section>

      <section className="rounded-2xl border border-orange-900/15 bg-orange-50/70 p-4">
        <fieldset>
          <legend className="text-sm font-semibold text-orange-950">Audio Input Mode</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 rounded-full border border-orange-900/20 bg-white px-3 py-2 text-sm font-semibold text-orange-950">
              <input
                checked={audioInputMode === "upload"}
                name="audio-input-mode"
                onChange={() => handleAudioModeChange("upload")}
                type="radio"
                value="upload"
              />
              Upload file
            </label>
            <label className="inline-flex items-center gap-2 rounded-full border border-orange-900/20 bg-white px-3 py-2 text-sm font-semibold text-orange-950">
              <input
                checked={audioInputMode === "record"}
                name="audio-input-mode"
                onChange={() => handleAudioModeChange("record")}
                type="radio"
                value="record"
              />
              Record in browser
            </label>
          </div>
        </fieldset>

        {audioInputMode === "upload" ? (
          <label className="mt-4 block text-sm font-semibold text-orange-950">
            Audio File
            <input className="mt-2 block w-full cursor-pointer rounded-xl border border-orange-900/20 bg-white px-3 py-2 file:mr-3 file:rounded-full file:border-0 file:bg-orange-200 file:px-3 file:py-1 file:text-sm file:font-semibold" onChange={(event) => handleAudioSelected(event.target.files?.[0] ?? null)} type="file" accept="audio/*" />
          </label>
        ) : (
          <div className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-full border border-orange-900/25 bg-white px-4 py-2 text-sm font-semibold text-orange-950 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isRecording || submitting}
                onClick={startBrowserRecording}
                type="button"
              >
                Start Browser Recording
              </button>
              <button
                className="rounded-full bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isRecording}
                onClick={stopBrowserRecording}
                type="button"
              >
                Stop Recording
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-900/75">
                {isRecording ? "Recording..." : "Ready to record"}
              </span>
            </div>
            {recordedPreviewUrl ? (
              <div className="mt-3 rounded-xl border border-orange-900/15 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-900/75">Recorded Preview</p>
                <audio className="mt-2 w-full" controls preload="metadata" src={recordedPreviewUrl} />
              </div>
            ) : null}
          </div>
        )}
        <p className="mt-2 text-xs text-orange-900/75">Detected duration: {durationMs ? `${durationMs} ms` : "Not available yet"}</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-orange-950">Pasuk Boundaries</h2>
        <p className="mt-1 text-sm text-orange-900/80">
          {isSinglePasukRange
            ? "Single pasuk selected. Boundaries are automatic from 0 ms to full audio duration."
            : "Mark where each pasuk begins and ends in milliseconds. End times must be greater than start times."}
        </p>

        {isSinglePasukRange ? (
          <div className="mt-4 rounded-2xl border border-orange-900/20 bg-white/80 p-4 text-sm text-orange-900/80">
            Auto boundary: 0 ms → {durationMs ? `${durationMs} ms` : "(waiting for duration)"}
          </div>
        ) : boundaries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-orange-900/30 bg-white/80 p-4 text-sm text-orange-900/75">
            Select a pasuk range to generate editable boundary rows.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-orange-900/15">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-orange-100 text-left text-xs uppercase tracking-wide text-orange-900">
                  <th className="px-4 py-3">Pasuk</th>
                  <th className="px-4 py-3">Start (ms)</th>
                  <th className="px-4 py-3">End (ms)</th>
                </tr>
              </thead>
              <tbody>
                {boundaries.map((row, index) => (
                  <tr key={row.pasukId} className="border-t border-orange-100 text-sm">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-orange-950">{row.ref}</div>
                      <div className="text-xs text-orange-900/70">Pasuk {row.pasukNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-full rounded-lg border border-orange-900/20 px-3 py-2" onChange={(event) => updateBoundary(index, "startMs", event.target.value)} placeholder="0" value={row.startMs} />
                    </td>
                    <td className="px-4 py-3">
                      <input className="w-full rounded-lg border border-orange-900/20 px-3 py-2" onChange={(event) => updateBoundary(index, "endMs", event.target.value)} placeholder="1200" value={row.endMs} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}
      {successMessage ? <p className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-3 text-sm font-semibold text-lime-800">{successMessage}</p> : null}

      <button className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60" disabled={!canSubmit} type="submit">
        {submitting ? "Submitting..." : "Submit Recording"}
      </button>

      {!loadingWorks && works.length === 0 ? (
        <p className="rounded-xl border border-orange-900/20 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          No text library data found yet. Seed Work, Book, Chapter, and Pasuk data first, then return here to submit recordings.
        </p>
      ) : null}
    </form>
  );
}
