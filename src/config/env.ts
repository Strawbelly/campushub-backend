export interface IAppConfig {
  port: number;
  mongodbUri: string;
}

const DEFAULT_PORT: number = 3000;

// Reads and validates environment variables once at startup.
export const loadConfig = (): IAppConfig => {
  const mongodbUri: string | undefined = process.env.MONGODB_URI;
  if (mongodbUri === undefined || mongodbUri.trim() === '') {
    throw new Error('MONGODB_URI environment variable is required.');
  }

  const rawPort: string | undefined = process.env.PORT;
  const port: number = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { port, mongodbUri };
};
