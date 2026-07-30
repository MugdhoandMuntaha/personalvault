// R2 integration test script
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

async function main() {
  console.log("Checking R2 environment variables...");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error("Missing one or more R2 environment variables in .env.local.");
    process.exit(1);
  }

  console.log(`Connecting to Cloudflare R2 account: ${accountId}`);
  const s3 = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    region: "auto",
  });

  const testKey = "test-connection-file.txt";
  console.log(`Uploading test file to bucket: ${bucketName}...`);
  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: testKey,
    Body: "Hello from Personal Cloud Vault R2 integration test!",
    ContentType: "text/plain",
  }));
  console.log("Test file successfully uploaded!");

  console.log("Deleting test file from bucket...");
  await s3.send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: testKey,
  }));
  console.log("Test file successfully deleted!");

  console.log("Cloudflare R2 connection and credential check successful!");
}

main().catch(err => {
  console.error("Cloudflare R2 operation failed:", err);
  process.exit(1);
});
