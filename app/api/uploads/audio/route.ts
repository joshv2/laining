import { get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { auth } from "@/lib/auth";

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

function toForwardedHeaders(source: Headers): Headers {
  const forwarded = new Headers();
  const names = [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "cache-control",
    "etag",
    "last-modified",
  ];

  for (const name of names) {
    const value = source.get(name);
    if (value) {
      forwarded.set(name, value);
    }
  }

  return forwarded;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!key) {
    return Response.json({ error: "Missing blob key." }, { status: 400 });
  }

  try {
    const blob = await get(key, { access: "private", headers: request.headers });
    if (!blob) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (blob.statusCode === 304) {
      return new Response(null, {
        status: 304,
        headers: toForwardedHeaders(blob.headers),
      });
    }

    return new Response(blob.stream, {
      status: 200,
      headers: toForwardedHeaders(blob.headers),
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to stream blob.",
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("recordings/")) {
          throw new Error("Invalid upload path.");
        }

        return {
          allowedContentTypes: Array.from(ALLOWED_AUDIO_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: new Date(Date.now() + 5 * 60 * 1000),
          allowOverwrite: false,
          addRandomSuffix: false,
        };
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to prepare upload.",
      },
      { status: 400 },
    );
  }
}
