const tokenUrl = "https://oauth2.googleapis.com/token";
const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";

function getGoogleDriveConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;

  if (!clientId || !clientSecret || !refreshToken || !folderId) {
    throw new Error(
      "Missing Google Drive backup env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_BACKUP_FOLDER_ID",
    );
  }

  return { clientId, clientSecret, refreshToken, folderId };
}

async function getAccessToken() {
  const { clientId, clientSecret, refreshToken } = getGoogleDriveConfig();
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google token response did not include access_token");
  }

  return data.access_token;
}

export async function uploadBufferToDrive({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}) {
  const { folderId } = getGoogleDriveConfig();
  const accessToken = await getAccessToken();
  const boundary = `backup-${crypto.randomUUID()}`;
  const metadata = {
    name: filename,
    parents: [folderId],
  };

  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      "utf8",
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`, "utf8"),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google Drive upload failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as { id: string; name: string; webViewLink?: string };
}
