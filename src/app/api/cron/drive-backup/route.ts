import { NextResponse } from "next/server";
import { createCrmBackup } from "@/lib/crm-backup";
import { uploadBufferToDrive } from "@/lib/google-drive";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  return cronSecret && request.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backup = await createCrmBackup();
  const file = await uploadBufferToDrive({
    buffer: backup.buffer,
    filename: backup.filename,
    mimeType: "application/gzip",
  });

  return NextResponse.json({
    ok: true,
    uploadedAt: new Date().toISOString(),
    file,
    backup: {
      filename: backup.filename,
      byteLength: backup.buffer.length,
      manifest: backup.manifest,
    },
  });
}
