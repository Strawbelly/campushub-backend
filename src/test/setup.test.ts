/// <reference types="jest" />
import mongoose from 'mongoose';

// Smoke test for the Jest environment only: confirms setup.ts connected
// mongoose to the in-memory MongoDB instance.
describe('test environment', (): void => {
  it('connects to the in-memory MongoDB instance', (): void => {
    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.connected);
    expect(mongoose.connection.host).toBe('127.0.0.1');
  });
});
