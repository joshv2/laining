export async function GET() {
  return Response.json(
    { error: "Recording paywalls are disabled. Monetization applies to teacher feature access only." },
    { status: 410 },
  );
}

export async function POST() {
  return Response.json(
    { error: "Recording paywalls are disabled. Monetization applies to teacher feature access only." },
    { status: 410 },
  );
}
