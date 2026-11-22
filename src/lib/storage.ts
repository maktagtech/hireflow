import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { del as blobDel, get as blobGet, list as blobList, put as blobPut } from "@vercel/blob";

/**
 * Object storage for uploaded resumes and generated documents.
 * - Vercel Blob (private store) when BLOB_STORE_ID or BLOB_READ_WRITE_TOKEN is set —
 *   added by Vercel > Storage > Create > Blob.
 * - S3 when S3_BUCKET is set.
 * - Otherwise a local directory (development only; Vercel's disk is not persistent).
 * Keys are always scoped as `users/<userId>/...` so ownership is checkable.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** A URL the browser can download from, or null to stream via the app. */
  signedUrl(key: string, filename: string): Promise<string | null>;
  /** Permanently delete every object under a prefix (e.g. "users/<id>/"). */
  deletePrefix(prefix: string): Promise<void>;
  delete(key: string): Promise<void>;
}

function assertScopedPrefix(prefix: string) {
  // Guard against ever deleting the whole bucket/root by mistake.
  if (!/^users\/[0-9a-f-]{36}\/(jobs\/[0-9a-f-]{36}\/)?$/.test(prefix)) throw new Error(`Refusing to delete prefix "${prefix}"`);
}

class S3Storage implements Storage {
  private client = new S3Client({ region: process.env.AWS_REGION });
  constructor(private bucket: string) {}

  async put(key: string, body: Uint8Array, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: "AES256" }),
    );
  }
  async get(key: string) {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async signedUrl(key: string, filename: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
      }),
      { expiresIn: 300 },
    );
  }
  async delete(key: string) {
    await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: [{ Key: key }], Quiet: true } }));
  }
  async deletePrefix(prefix: string) {
    assertScopedPrefix(prefix);
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}

/**
 * Vercel Blob, private access: files are only reachable with the store token,
 * so downloads stream through the app after its ownership check.
 */
class VercelBlobStorage implements Storage {
  async put(key: string, body: Uint8Array, contentType: string) {
    await blobPut(key, Buffer.from(body), { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string) {
    const res = await blobGet(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new Error(`Stored file not found: ${key}`);
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }
  async signedUrl() {
    return null;
  }
  async delete(key: string) {
    await blobDel(key);
  }
  async deletePrefix(prefix: string) {
    assertScopedPrefix(prefix);
    let cursor: string | undefined;
    do {
      const page = await blobList({ prefix, cursor, limit: 1000 });
      if (page.blobs.length) await blobDel(page.blobs.map((b) => b.url));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }
}

class LocalStorage implements Storage {
  constructor(private root: string) {}
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, body: Uint8Array) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async signedUrl() {
    return null;
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  async deletePrefix(prefix: string) {
    assertScopedPrefix(prefix);
    await rm(this.resolve(prefix), { recursive: true, force: true });
  }
}

let instance: Storage | undefined;
export function getStorage(): Storage {
  instance ??= createStorage();
  return instance;
}

function createStorage(): Storage {
  if (process.env.S3_BUCKET) return new S3Storage(process.env.S3_BUCKET);
  // Newer Blob stores connect with BLOB_STORE_ID (the SDK signs in with Vercel's OIDC token);
  // older ones with BLOB_READ_WRITE_TOKEN. Either works.
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return new VercelBlobStorage();
  if (process.env.VERCEL) {
    throw new Error("No file storage configured. In Vercel, open Storage > Create > Blob, connect it to this project, then redeploy.");
  }
  return new LocalStorage(path.resolve(/*turbopackIgnore: true*/ process.env.LOCAL_STORAGE_DIR || ".storage"));
}
