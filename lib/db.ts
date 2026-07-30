import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

// Create a SQL query function using the Neon Serverless driver over HTTP.
// This is optimal for serverless environments as it avoids keeping TCP connections open.
export const sql = neon(process.env.DATABASE_URL);
