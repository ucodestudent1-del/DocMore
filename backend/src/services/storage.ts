import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

let s3Client: S3Client | null = null;

function client(): S3Client {
  if (s3Client) return s3Client;
  if (!config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY || !config.S3_BUCKET) {
    throw new Error("S3 not configured. Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET env vars.");
  }
  s3Client = new S3Client({
    endpoint: config.S3_ENDPOINT || undefined,
    region: config.S3_REGION,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: config.S3_FORCE_PATH_STYLE === "true",
  });
  return s3Client;
}

export function isConfigured(): boolean {
  return Boolean(config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY && config.S3_BUCKET);
}

export async function uploadFile(key: string, data: Buffer, contentType: string): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: config.S3_BUCKET!,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function downloadFile(key: string): Promise<Buffer> {
  const res = await client().send(new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }));
  const chunks: Buffer[] = [];
  for await (const chunk of res.Body as any) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteFile(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }));
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await client().send(new HeadObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key });
  return getSignedUrl(client(), cmd, { expiresIn });
}

export { config };
