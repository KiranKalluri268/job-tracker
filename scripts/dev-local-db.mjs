/**
 * Runs the app against a throwaway in-memory MongoDB instead of Atlas, so you can
 * poke at the UI before any cloud setup exists. Nothing is persisted — the database
 * dies with the process.
 *
 *   node scripts/dev-local-db.mjs [--seed] [--build]
 *
 * --seed   insert a handful of sample applications first
 * --build  run `next start` off the production build instead of `next dev`
 */
import { spawn } from "node:child_process";

import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const seed = process.argv.includes("--seed");
const useBuild = process.argv.includes("--build");

const DB = "jobtracker";
const DAY = 86_400_000;
const iso = (daysAgo) => new Date(Date.now() - daysAgo * DAY).toISOString();
const day = (daysFromNow) => new Date(Date.now() + daysFromNow * DAY).toISOString().slice(0, 10);

function sample() {
  const base = {
    location: null,
    workMode: null,
    salary: null,
    postingUrl: null,
    resumeVersion: null,
    coverLetter: false,
    contactName: null,
    contactEmail: null,
    notes: null,
    nextActionOn: null,
    nextActionNote: null,
    appliedOn: null,
    source: null,
  };

  return [
    {
      ...base,
      company: "Vercel",
      role: "Frontend Engineer",
      status: "Interview",
      location: "Remote",
      workMode: "Remote",
      source: "Referral",
      appliedOn: iso(21).slice(0, 10),
      nextActionOn: day(0),
      nextActionNote: "Send thank-you note to the panel",
      resumeVersion: "frontend-v3",
      coverLetter: true,
      contactName: "Recruiting",
      events: [
        { at: iso(24), from: null, to: "Saved", note: "Created" },
        { at: iso(21), from: "Saved", to: "Applied", note: null },
        { at: iso(14), from: "Applied", to: "OA", note: "Take-home, 4 hours" },
        { at: iso(4), from: "OA", to: "Interview", note: "Two rounds booked" },
      ],
      createdAt: iso(24),
      updatedAt: iso(4),
    },
    {
      ...base,
      company: "Stripe",
      role: "Product Engineer",
      status: "Applied",
      location: "Bengaluru",
      workMode: "Hybrid",
      source: "LinkedIn",
      appliedOn: iso(30).slice(0, 10),
      events: [
        { at: iso(31), from: null, to: "Saved", note: "Created" },
        { at: iso(30), from: "Saved", to: "Applied", note: null },
      ],
      createdAt: iso(31),
      updatedAt: iso(30), // 30 days quiet — should show the stale badge
    },
    {
      ...base,
      company: "Linear",
      role: "Design Engineer",
      status: "Saved",
      source: "Careers page",
      nextActionOn: day(-2),
      nextActionNote: "Actually apply",
      events: [{ at: iso(3), from: null, to: "Saved", note: "Created" }],
      createdAt: iso(3),
      updatedAt: iso(3),
    },
    {
      ...base,
      company: "Figma",
      role: "Software Engineer, Web",
      status: "Rejected",
      location: "Remote",
      workMode: "Remote",
      source: "LinkedIn",
      appliedOn: iso(45).slice(0, 10),
      events: [
        { at: iso(46), from: null, to: "Saved", note: "Created" },
        { at: iso(45), from: "Saved", to: "Applied", note: null },
        { at: iso(38), from: "Applied", to: "Rejected", note: "No reason given" },
      ],
      createdAt: iso(46),
      updatedAt: iso(38),
    },
  ];
}

const server = await MongoMemoryServer.create({ instance: { dbName: DB } });
const uri = server.getUri();
console.log(`[dev-local-db] in-memory MongoDB at ${uri}`);

if (seed) {
  const client = await new MongoClient(uri).connect();
  await client.db(DB).collection("applications").insertMany(sample());
  await client.close();
  console.log("[dev-local-db] seeded 4 sample applications");
}

const env = {
  ...process.env,
  MONGODB_URI: uri,
  MONGODB_DB: DB,
  AUTH_SECRET: process.env.AUTH_SECRET ?? "local-dev-secret-not-for-production",
};

const child = spawn("npx", ["next", useBuild ? "start" : "dev"], {
  env,
  stdio: "inherit",
  shell: true,
});

const shutdown = async () => {
  child.kill();
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", shutdown);
