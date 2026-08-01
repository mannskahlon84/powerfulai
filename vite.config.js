import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Custom Vite middleware plugin to emulate Vercel serverless /api endpoints in local development
function vercelApiDevPlugin() {
  return {
    name: 'vercel-api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          try {
            // Remove query parameters
            const urlPath = req.url.split('?')[0];
            const filePath = path.join(process.cwd(), `${urlPath}.js`);
            if (fs.existsSync(filePath)) {
              // Parse body for POST/PUT requests
              let body = {};
              if (req.method === 'POST' || req.method === 'PUT') {
                const chunks = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const rawBody = Buffer.concat(chunks).toString('utf-8');
                try { body = JSON.parse(rawBody); } catch (e) { body = rawBody; }
              }
              req.body = body;

              // Attach mock Express / Vercel response helper methods
              res.status = (code) => { res.statusCode = code; return res; };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              };
              res.send = (data) => {
                res.end(data);
              };

              // Load and execute the handler via ssrLoadModule
              const handlerModule = await server.ssrLoadModule(filePath);
              const handler = handlerModule.default;
              await handler(req, res);
              return;
            }
          } catch (err) {
            console.error("Vercel Dev API Plugin Error handling", req.url, err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDevPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  }
});
