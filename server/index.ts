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

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Initialize the SQLite tables
    await initDb();
    const { default: app } = await import('./app');

    // Start Express listener
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`ReviveAI Express Backend listening on port ${PORT}`);
      console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
      console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhooks/razorpay`);
      console.log(`==================================================`);
    });
  } catch (err: any) {
    console.error('Fatal: Failed to start backend server:', err.message);
    process.exit(1);
  }
}

start();
