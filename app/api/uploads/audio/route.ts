import path from "node:path";
import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth";
import { getStorageProvider } from "@/lib/storage/provider";

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function normalizeMimeType(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Expected multipart field 'file'" }, { status: 400 });
  }

  if (file.size < 1) {
    return Response.json({ error: "Empty file" }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "File too large. Max size is 50MB." }, { status: 413 });
  }

  const normalizedType = normalizeMimeType(file.type || "");

  if (!ALLOWED_AUDIO_TYPES.has(normalizedType)) {
    return Response.json({ error: `Unsupported audio type: ${file.type || "unknown"}` }, { status: 415 });
  }

  const extension = path.extname(file.name || "") || ".bin";
  const safeName = sanitizeFileName(path.basename(file.name || `upload${extension}`));
  const objectKey = `${session.user.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;

  const data = Buffer.from(await file.arrayBuffer());
  const storage = getStorageProvider();
  const uploaded = await storage.put(objectKey, data);

  return Response.json({
    objectKey: uploaded.objectKey,
    publicUrl: uploaded.publicUrl,
    fileName: file.name,
    mimeType: normalizedType,
    sizeBytes: file.size,
  });
}
