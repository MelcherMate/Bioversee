import mongoose from "mongoose";

let cached = global.__bioverseeMongoose;

if (!cached) {
  cached = global.__bioverseeMongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.Promise = global.Promise;
    mongoose.set("strictQuery", true);
    cached.promise = mongoose.connect(uri).then((mongooseInstance) => {
      console.log("**------------- CONNECTED TO THE DATABASE -------------**");
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
