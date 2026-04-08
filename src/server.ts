import { handleUpload } from "./api/upload.ts";
import { addKey, listKeys, deleteKey } from "./api/keys.ts";
import { Client } from "@notionhq/client";

// Explicitly load .env file (Bun should do this automatically, but being explicit)
try {
  const envFile = Bun.file(".env");
  if (await envFile.exists()) {
    const envText = await envFile.text();
    for (const line of envText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").trim();
        if (key && value) {
          Bun.env[key.trim()] = value;
          process.env[key.trim()] = value;
        }
      }
    }
  }
} catch {
  // .env file doesn't exist, skip
}

const PORT = parseInt(Bun.env.PORT || "3000", 10);

// Startup health check
async function healthCheck() {
  const apiKey = Bun.env.NOTION_API_KEY?.trim();

  if (!apiKey) {
    console.log("⚠️  Notion: NOTION_API_KEY not set in .env");
    console.log("   Get one at: https://www.notion.so/my-integrations");
    return;
  }

  try {
    const notion = new Client({ auth: apiKey });
    const response = await notion.users.me({});

    // Extract bot name if available
    const botName = (response as any).name || "Unknown";
    const workspaceName = (response as any).workspace_name || "Unknown";

    console.log(`✅ Notion: Connected as "${botName}" to "${workspaceName}"`);
  } catch (error: any) {
    const msg = error?.message || "Unknown error";

    if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("invalid")) {
      console.log("❌ Notion: API token is invalid (401 Unauthorized)");
      console.log("");
      console.log("   HOW TO FIX:");
      console.log("   1. Go to https://www.notion.so/my-integrations");
      console.log("   2. Click your integration → 'Internal Integration' tab");
      console.log("   3. Copy the token (starts with 'ntn_')");
      console.log("   4. Paste in .env as NOTION_API_KEY");
      console.log("   5. ⚠️  DO NOT click 'Refresh' (invalidates current token)");
      console.log("   6. Restart the server");
      console.log("");
      console.log(`   Technical: ${msg}`);
    } else if (msg.includes("connection")) {
      console.log(`⚠️  Notion: Connection failed: ${msg}`);
    } else {
      console.log(`⚠️  Notion: Health check failed: ${msg}`);
    }
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // API Routes
      if (path === "/api/upload" && req.method === "POST") {
        return await handleUpload(req);
      }

      if (path === "/api/keys" && req.method === "POST") {
        return await addKey(req);
      }

      if (path === "/api/keys" && req.method === "GET") {
        return listKeys();
      }

      if (path.startsWith("/api/keys/") && req.method === "DELETE") {
        const keyId = path.replace("/api/keys/", "");
        return deleteKey(keyId);
      }

      // Static file serving
      if (path === "/" || path === "/index.html") {
        const file = Bun.file("public/index.html");
        if (await file.exists()) {
          return new Response(file, {
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("Frontend not found. Create public/index.html", {
          status: 404,
        });
      }

      // Serve other static files from public/
      const filePath = `public${path}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const ext = path.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          html: "text/html",
          js: "application/javascript",
          css: "text/css",
          json: "application/json",
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          webp: "image/webp",
          svg: "image/svg+xml",
          ico: "image/x-icon",
        };
        return new Response(file, {
          headers: {
            "Content-Type": mimeTypes[ext || ""] || "text/plain",
          },
        });
      }

      // 404
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Server error:", error);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
});

console.log(`🚀 Invoice Processor Server running at http://localhost:${server.port}`);
console.log(`📁 Static files served from public/`);
console.log(`🔌 API endpoints:`);
console.log(`   POST /api/upload - Upload invoice files`);
console.log(`   GET  /api/keys   - List API keys`);
console.log(`   POST /api/keys   - Add API key`);
console.log(`   DELETE /api/keys/:id - Delete API key`);
console.log("");

// Run health check on startup
healthCheck();
