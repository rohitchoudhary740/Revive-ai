import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from root .env or .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initDb } from './db';

// Render provides process.env.PORT dynamically (defaults to 10000 on Render)
const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

async function start() {
  try {
    // Initialize the SQLite tables
    await initDb();
    const { default: app } = await import('./app');

    // Root status check so visiting the base URL does not show "Cannot GET /"
    app.get('/', (_req, res) => {
      res.json({
        status: 'online',
        service: 'ReviveAI Backend API',
        timestamp: new Date().toISOString()
      });
    });

    // Start Express listener bound to 0.0.0.0
    app.listen(PORT, HOST, () => {
      console.log(`==================================================`);
      console.log(`ReviveAI Express Backend listening on http://${HOST}:${PORT}`);
      console.log(`Public Health check: http://${HOST}:${PORT}/`);
      console.log(`API Health endpoint: http://${HOST}:${PORT}/api/health`);
      console.log(`Webhook endpoint: http://${HOST}:${PORT}/api/webhooks/razorpay`);
      console.log(`==================================================`);
    });
  } catch (err: any) {
    console.error('Fatal: Failed to start backend server:', err.message);
    process.exit(1);
  }
}

start();
