import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';

async function start() {
  if (!config.mongoUri) {
    console.error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
  if (!config.jwtSecret) {
    console.error('JWT_SECRET is not set. Add a long random string to server/.env.');
    process.exit(1);
  }

  try {
    // Fail within 10 s (instead of the default 30 s) if Atlas is unreachable.
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log('MongoDB connected');
  } catch (err) {
    // Log the message only; the connection string contains the password.
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`API listening on port ${config.port}`);
  });
}

start();
