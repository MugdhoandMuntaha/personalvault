import { neon, neonConfig } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing.");
}

// In Node server-side execution, use native https module with IPv4 family to prevent IPv6 timeouts
if (typeof window === "undefined") {
  const https = require("https");
  neonConfig.fetchFunction = (url: string, options: any = {}) => {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const req = https.request(
        u,
        {
          method: options.method || "POST",
          headers: options.headers,
          family: 4,
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: any) => (data += chunk));
          res.on("end", () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              text: async () => data,
              json: async () => JSON.parse(data),
              headers: new Map(Object.entries(res.headers)),
            });
          });
        }
      );
      req.on("error", reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  };
}

// Create a SQL query function using the Neon Serverless driver over HTTP.
// This is optimal for serverless environments as it avoids keeping TCP connections open.
export const sql = neon(process.env.DATABASE_URL);

