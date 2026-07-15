import { Role } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

type AssemblyAIWord = {
  text: string;
  start: number;
  end: number;
  confidence: number;
};

type AssemblyAITranscript = {
  id?: string;
  status?: "queued" | "processing" | "completed" | "error";
  text?: string;
  confidence?: number;
  words?: AssemblyAIWord[];
  audio_duration_ms?: number;
  upload_url?: string;
  error?: string;
  error_code?: string;
  detail?: string;
  title?: string;
};

const SUPPORTED_SYNC_AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/vnd.wave",
]);

const SYNC_DURATION_LIMIT_MS = 120000;
const ASYNC_POLL_ATTEMPTS = 40;
const ASYNC_POLL_INTERVAL_MS = 3000;

function normalizeMimeType(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}

function parseJsonSafe<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractAssemblyError(payload: AssemblyAITranscript | null, rawBody: string): string {
  const rawMessage = rawBody.trim().length > 0 ? rawBody : null;
  return (
    payload?.error ??
    payload?.detail ??
    payload?.title ??
    payload?.error_code ??
    rawMessage ??
    "AssemblyAI alignment failed"
  );
}

async function setAlignmentError(recordingId: string, message: string, source: "assemblyai-sync" | "assemblyai-async") {
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      autoAlignmentStatus: "error",
      autoAlignmentResult: {
        source,
        languageCode: "he",
        error: message,
      },
    },
  });
}

async function setAlignmentSuccess(recordingId: string, payload: AssemblyAITranscript, source: "assemblyai-sync" | "assemblyai-async") {
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      autoAlignmentStatus: "completed",
      autoAlignmentResult: {
        text: payload.text ?? "",
        confidence: payload.confidence ?? null,
        audioDurationMs: payload.audio_duration_ms ?? null,
        words: payload.words ?? [],
        model: "universal-3-5-pro",
        source,
        languageCode: "he",
      },
      autoAlignmentCompletedAt: new Date(),
    },
  });
}

function getApiKey(): string {
  const apiKey = process.env.ASSEMBLY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AssemblyAI API key is not configured.");
  }

  return apiKey;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const recording = await prisma.recording.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      durationMs: true,
    },
  });

  if (!recording) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = recording.userId === session.user.id;
  const isModerator = session.user.role === Role.MODERATOR || session.user.role === Role.SUPERUSER;
  if (!isOwner && !isModerator) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Expected multipart field 'file'" }, { status: 400 });
  }

  const normalizedType = normalizeMimeType(file.type || "");

  await prisma.recording.update({
    where: { id: recording.id },
    data: { autoAlignmentStatus: "processing" },
  });

  const apiKey = getApiKey();

  const shouldUseSync = SUPPORTED_SYNC_AUDIO_TYPES.has(normalizedType) && recording.durationMs <= SYNC_DURATION_LIMIT_MS;
  if (shouldUseSync) {
    const transcriptionForm = new FormData();
    transcriptionForm.set("audio", file, file.name || "alignment.wav");
    transcriptionForm.set(
      "config",
      JSON.stringify({
        language_code: "he",
        prompt: "Hebrew Torah chanting.",
      }),
    );

    const response = await fetch("https://sync.assemblyai.com/transcribe", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "X-AAI-Model": "universal-3-5-pro",
      },
      body: transcriptionForm,
    });

    const rawBody = await response.text();
    const payload = parseJsonSafe<AssemblyAITranscript>(rawBody);
    if (!response.ok || !payload) {
      const message = extractAssemblyError(payload, rawBody);
      await setAlignmentError(recording.id, message, "assemblyai-sync");
      return Response.json({ error: message }, { status: 502 });
    }

    await setAlignmentSuccess(recording.id, payload, "assemblyai-sync");
    return Response.json({
      ok: true,
      status: "completed",
      source: "sync",
      confidence: payload.confidence ?? null,
      wordCount: payload.words?.length ?? 0,
    });
  }

  const fileBytes = await file.arrayBuffer();
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: fileBytes,
  });

  const uploadRaw = await uploadResponse.text();
  const uploadPayload = parseJsonSafe<AssemblyAITranscript>(uploadRaw);
  if (!uploadResponse.ok || !uploadPayload?.upload_url) {
    const message = extractAssemblyError(uploadPayload, uploadRaw);
    await setAlignmentError(recording.id, message, "assemblyai-async");
    return Response.json({ error: message }, { status: 502 });
  }

  const submitResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: uploadPayload.upload_url,
      speech_models: ["universal-3-5-pro", "universal-2"],
      language_code: "he",
      prompt: "Hebrew Torah chanting.",
      punctuate: true,
      format_text: true,
    }),
  });

  const submitRaw = await submitResponse.text();
  const submitPayload = parseJsonSafe<AssemblyAITranscript>(submitRaw);
  if (!submitResponse.ok || !submitPayload?.id) {
    const message = extractAssemblyError(submitPayload, submitRaw);
    await setAlignmentError(recording.id, message, "assemblyai-async");
    return Response.json({ error: message }, { status: 502 });
  }

  for (let attempt = 0; attempt < ASYNC_POLL_ATTEMPTS; attempt += 1) {
    const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${submitPayload.id}`, {
      method: "GET",
      headers: {
        Authorization: apiKey,
      },
    });

    const pollRaw = await pollResponse.text();
    const pollPayload = parseJsonSafe<AssemblyAITranscript>(pollRaw);

    if (!pollResponse.ok || !pollPayload) {
      const message = extractAssemblyError(pollPayload, pollRaw);
      await setAlignmentError(recording.id, message, "assemblyai-async");
      return Response.json({ error: message }, { status: 502 });
    }

    if (pollPayload.status === "completed") {
      await setAlignmentSuccess(recording.id, pollPayload, "assemblyai-async");
      return Response.json({
        ok: true,
        status: "completed",
        source: "async",
        confidence: pollPayload.confidence ?? null,
        wordCount: pollPayload.words?.length ?? 0,
      });
    }

    if (pollPayload.status === "error") {
      const message = extractAssemblyError(pollPayload, pollRaw);
      await setAlignmentError(recording.id, message, "assemblyai-async");
      return Response.json({ error: message }, { status: 502 });
    }

    await new Promise((resolve) => setTimeout(resolve, ASYNC_POLL_INTERVAL_MS));
  }

  await prisma.recording.update({
    where: { id: recording.id },
    data: {
      autoAlignmentStatus: "processing",
      autoAlignmentResult: {
        source: "assemblyai-async",
        languageCode: "he",
        transcriptId: submitPayload.id,
      },
    },
  });

  return Response.json({
    ok: true,
    status: "processing",
    source: "async",
    reason: "Alignment is still processing. Please refresh shortly.",
  });
}