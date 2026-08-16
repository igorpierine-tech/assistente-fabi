import session from "express-session";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type Entry = { expiresAt: number | null; encrypted: string };
type Database = Record<string, Entry>;

export class EncryptedSessionStore extends session.Store {
  private readonly key: Buffer;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filename: string, secretHex: string) {
    super();
    if (!/^[a-fA-F0-9]{64}$/.test(secretHex)) {
      throw new Error("SESSION_SECRET deve ter exatamente 64 caracteres hexadecimais.");
    }
    this.key = Buffer.from(secretHex, "hex");
  }

  private async readDatabase(): Promise<Database> {
    try {
      return JSON.parse(await readFile(this.filename, "utf8")) as Database;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  private async writeDatabase(database: Database): Promise<void> {
    await mkdir(dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(database), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filename);
  }

  private encrypt(value: session.SessionData): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  private decrypt(value: string): session.SessionData {
    const [iv, tag, ciphertext] = value.split(".");
    if (!iv || !tag || !ciphertext) throw new Error("Sessão criptografada inválida.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8")) as session.SessionData;
  }

  get(sid: string, callback: (error?: unknown, value?: session.SessionData | null) => void): void {
    void this.readDatabase().then((database) => {
      const entry = database[sid];
      if (!entry || (entry.expiresAt !== null && entry.expiresAt <= Date.now())) {
        callback(undefined, null);
        return;
      }
      callback(undefined, this.decrypt(entry.encrypted));
    }).catch(callback);
  }

  set(sid: string, value: session.SessionData, callback?: (error?: unknown) => void): void {
    this.queue = this.queue.then(async () => {
      const database = await this.readDatabase();
      database[sid] = {
        expiresAt: value.cookie.expires?.getTime() ?? null,
        encrypted: this.encrypt(value),
      };
      await this.writeDatabase(database);
    });
    void this.queue.then(() => callback?.()).catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (error?: unknown) => void): void {
    this.queue = this.queue.then(async () => {
      const database = await this.readDatabase();
      delete database[sid];
      await this.writeDatabase(database);
    });
    void this.queue.then(() => callback?.()).catch((error) => callback?.(error));
  }
}
