import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";

export class TranscriptionService {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = this.getExtension(mimeType);
    const tempPath = path.join(os.tmpdir(), `fabi-audio-${Date.now()}.${ext}`);

    try {
      fs.writeFileSync(tempPath, audioBuffer);

      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-1",
        language: "pt",
        response_format: "text",
      });

      return transcription as unknown as string;
    } finally {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
      "audio/x-m4a": "m4a",
    };
    return map[mimeType] || "webm";
  }
}
