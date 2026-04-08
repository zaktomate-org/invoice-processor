import { handleUpload } from "./api/upload.ts";
import { addKey, listKeys, deleteKey } from "./api/keys.ts";

const PORT = parseInt(Bun.env.PORT || "3000", 10);

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
