import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  // Parse multipart form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image provided." }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File too large. Please use an image under 10 MB." },
      { status: 413 }
    );
  }

  // Convert to base64 for Vision API
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Vision API key not configured." },
      { status: 500 }
    );
  }

  // Call Google Cloud Vision text detection
  let visionRes: Response;
  try {
    visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }),
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not reach the Vision API. Check your network." },
      { status: 502 }
    );
  }

  const payload = await visionRes.json();

  if (!visionRes.ok) {
    const message: string =
      payload?.error?.message ?? "Vision API returned an error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const annotations = payload.responses?.[0]?.textAnnotations as
    | { description: string }[]
    | undefined;

  if (!annotations || annotations.length === 0) {
    return NextResponse.json(
      { error: "No text detected in this image." },
      { status: 422 }
    );
  }

  // First annotation is the full concatenated text
  return NextResponse.json({ text: annotations[0].description });
}
