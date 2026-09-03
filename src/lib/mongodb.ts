import "server-only";

import { MongoClient, type Collection, type Db, type Document } from "mongodb";

/**
 * Dev HMR and Vercel's lambda reuse both re-evaluate this module, and a fresh
 * MongoClient each time will exhaust the 500-connection cap on an Atlas M0 cluster.
 * The promise is parked on globalThis so every evaluation shares one pool.
 */
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

export class MissingEnvError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new MissingEnvError(
      `${name} is not set. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function clientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(requireEnv("MONGODB_URI"), {
      maxPoolSize: 10,
    }).connect();
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(process.env.MONGODB_DB || "jobtracker");
}

/** Mongo's stored shape: same as `Application` but with an ObjectId `_id`. */
export type ApplicationDoc = Document;

let indexesReady: Promise<void> | null = null;

/**
 * `createIndex` is idempotent, so this runs once per process and is a no-op on every
 * cold start after the first.
 */
export async function applications(): Promise<Collection<ApplicationDoc>> {
  const db = await getDb();
  const col = db.collection<ApplicationDoc>("applications");
  indexesReady ??= Promise.all([
    col.createIndex({ status: 1 }),
    col.createIndex({ nextActionOn: 1 }),
    col.createIndex({ updatedAt: -1 }),
    col.createIndex({ company: "text", role: "text", notes: "text" }),
  ]).then(() => undefined);
  await indexesReady;
  return col;
}
