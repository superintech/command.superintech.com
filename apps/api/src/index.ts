import 'dotenv/config';
import { createServer } from 'http';
import app from './app.js';
import prisma from './lib/prisma.js';
import { initializeSocket } from './lib/socket.js';

const PORT = process.env.PORT || 4000;

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected');

    // Create HTTP server and initialize Socket.io
    const httpServer = createServer(app);
    initializeSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`🚀 API server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💬 Socket.io ready for connections`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
