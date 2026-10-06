import mongoose from 'mongoose';

export const connectDatabase = async (uri: string): Promise<void> => {
  await mongoose.connect(uri);
};
