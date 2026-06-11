import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser } from "@/lib/auth";

// Issues short-lived client tokens so the browser can upload large CSVs
// DIRECTLY to Vercel Blob — bypassing the ~4.5 MB function request-body cap.
// The uploaded blob's URL is then sent to POST /api/datasets for ingestion.

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB raw CSV

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Large uploads not configured (missing BLOB_READ_WRITE_TOKEN). Files under 3 MB still work." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => {
        const user = await getSessionUser();
        if (!user) throw new Error("Unauthorized");
        return {
          allowedContentTypes: ["text/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: user.userId,
        };
      },
      // Ingestion happens via POST /api/datasets with the blob URL; nothing to do here.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload token generation failed";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 400 });
  }
}
