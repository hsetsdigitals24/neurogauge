import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser } from "@/lib/auth";

// Issues short-lived client tokens so the browser can upload large CSVs
// DIRECTLY to Vercel Blob — bypassing the ~4.5 MB function request-body cap.
// The uploaded blob's URL is then sent to POST /api/datasets for ingestion.

// Uploads are processed rows JSON, which repeats every column key per row and
// typically runs 2–4× the raw CSV size. The real input cap (100 MB CSV / 1M
// rows) is enforced in uploadCsvAsDataset before upload; this just needs
// headroom for the JSON inflation.
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB rows JSON

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
          // application/json: edited rows of blob-backed datasets re-uploaded from the workbench
          allowedContentTypes: ["text/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream", "application/json"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: user.userId,
        };
      },
      // No onUploadCompleted: ingestion happens via POST /api/datasets with the
      // blob URL, and providing the callback makes the SDK require a publicly
      // reachable callbackUrl — which breaks client uploads in local dev.
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload token generation failed";
    return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 400 });
  }
}
