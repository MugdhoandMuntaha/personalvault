import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

export const s3 = new S3Client({
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "placeholder",
    secretAccessKey: secretAccessKey || "placeholder",
  },
  region: "auto",
});

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || "placeholder";
