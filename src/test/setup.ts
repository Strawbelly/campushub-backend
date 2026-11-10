/// <reference types="jest" />
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase } from '../config/database';

let mongoServer: MongoMemoryServer | undefined;

// Start an isolated in-memory MongoDB and connect through the app's own helper.
beforeAll(async (): Promise<void> => {
  mongoServer = await MongoMemoryServer.create();
  await connectDatabase(mongoServer.getUri());
}, 60000);

// Keep tests independent: wipe every collection between tests.
afterEach(async (): Promise<void> => {
  const collections: mongoose.Collection[] = Object.values(mongoose.connection.collections);
  await Promise.all(
    collections.map(async (collection: mongoose.Collection): Promise<void> => {
      await collection.deleteMany({});
    }),
  );
});

afterAll(async (): Promise<void> => {
  await mongoose.disconnect();
  if (mongoServer !== undefined) {
    await mongoServer.stop();
  }
});
