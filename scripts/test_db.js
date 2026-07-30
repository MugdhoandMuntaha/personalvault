const { neon } = require('@neondatabase/serverless');

const databaseUrl = "postgresql://neondb_owner:npg_sAhI9BM7kunT@ep-summer-breeze-ax4u6fvb.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("Connecting to Neon database...");
  const sql = neon(databaseUrl);
  
  console.log("Re-creating vault_items table to support folders, path hierarchy, and document preview...");
  
  // Drop table if it exists
  await sql`DROP TABLE IF EXISTS vault_items;`;

  await sql`
    CREATE TABLE vault_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL, -- 'password', 'note', 'card', 'credential', 'document', 'folder'
      username VARCHAR(255),
      secret TEXT, -- Encrypted text (for login/notes)
      url VARCHAR(500),
      notes TEXT,
      
      -- Document/File Columns (Nullable for folders & text credentials)
      file_name VARCHAR(255),
      file_type VARCHAR(100),
      file_size INTEGER,
      storage_key VARCHAR(500),
      
      -- Folder Hierarchy
      parent_id UUID REFERENCES vault_items(id) ON DELETE CASCADE,
      
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  console.log("Verifying schema...");
  const result = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `;
  console.log("Tables in database:", result);
  
  console.log("Database schema successfully updated for folder hierarchy!");
}

main().catch(err => {
  console.error("Database initialization failed:", err);
  process.exit(1);
});
