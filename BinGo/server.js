import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const allowedFiles = new Set([
  "index.html",
  "app.js",
  "styles.css",
  "supabase-client.js",
  "supabase-config.js",
  "manifest.json",
  "icon.svg",
  "service-worker.js"
]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const fileName = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!allowedFiles.has(fileName)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const content = await readFile(resolve(root, fileName));
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(fileName)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": fileName === "index.html" || fileName === "service-worker.js"
        ? "no-cache"
        : "public, max-age=300"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

const port = Number.parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`BinGo static site listening on port ${port}`);
});
