import axios from "axios";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export async function downloadAudioToTempFile({
  mediaUrl,
  accountSid,
  authToken
}: {
  mediaUrl: string;
  accountSid: string;
  authToken: string;
}): Promise<string> {
  const res = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: "arraybuffer",
    auth: {
      username: accountSid,
      password: authToken
    },
    // Twilio sometimes sends no content-length; still fine for buffering in demo.
    timeout: 30000
  });

  const contentType = res.headers["content-type"]?.toString() ?? "";
  const ext = contentType.includes("ogg")
    ? "ogg"
    : contentType.includes("mpeg")
      ? "mp3"
      : contentType.includes("wav")
        ? "wav"
        : contentType.includes("webm")
          ? "webm"
          : "audio";

  const tmpPath = path.join(os.tmpdir(), `twilio-audio-${crypto.randomUUID()}.${ext}`);
  await fs.writeFile(tmpPath, Buffer.from(res.data));
  return tmpPath;
}

