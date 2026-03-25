/**
 * Feature: fraudlens, Property 6: Paper Data Round-Trip
 *
 * Validates: Requirements 2.7, 9.2
 *
 * For any successfully uploaded and analyzed paper, storing the Fraud_Report
 * and summary in MongoDB and then retrieving them by the paper's UUID must
 * return data structurally equivalent to what was stored.
 */

// Configure mongodb-memory-server to use the system MongoDB binary
process.env.MONGOMS_SYSTEM_BINARY = 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe';

const fc = require('fast-check');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Paper = require('../Paper');
const { v4: uuidv4 } = require('uuid');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Paper.deleteMany({});
});

// Arbitraries

const issueTypeArb = fc.constantFrom(
  'plagiarism',
  'repeated_sentence',
  'overused_keyword',
  'citation_format'
);

const issueArb = fc.record({
  type: issueTypeArb,
  description: fc.string({ minLength: 1, maxLength: 200 }),
  excerpt: fc.string({ minLength: 1, maxLength: 200 }),
});

const fraudReportArb = fc.record({
  plagiarism_score: fc.float({ min: 0.0, max: 1.0, noNaN: true }),
  risk_level: fc.constantFrom('low', 'medium', 'high'),
  issues: fc.array(issueArb, { minLength: 0, maxLength: 5 }),
});

const summaryArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 200 }),
  main_contributions: fc.string({ minLength: 1, maxLength: 500 }),
  methodology: fc.string({ minLength: 1, maxLength: 500 }),
  conclusions: fc.string({ minLength: 1, maxLength: 500 }),
});

// Helper: create a minimal valid paper with given fraud_report and summary
async function storePaper(uuid, fraudReport, summary) {
  const now = new Date();
  const paper = new Paper({
    uuid,
    filename: 'test.pdf',
    file_path: '/tmp/test.pdf',
    status: 'completed',
    uploaded_at: now,
    expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    fraud_report: fraudReport,
    summary,
  });
  await paper.save();
  return paper;
}

// Helper: retrieve paper by UUID and return plain fraud_report + summary
async function retrievePaper(uuid) {
  const doc = await Paper.findOne({ uuid }).lean();
  if (!doc) return null;
  return { fraud_report: doc.fraud_report, summary: doc.summary };
}

// Structural equivalence helpers

function fraudReportsEquivalent(stored, retrieved) {
  if (stored.risk_level !== retrieved.risk_level) return false;
  if (Math.abs(stored.plagiarism_score - retrieved.plagiarism_score) > 1e-6) return false;
  if (stored.issues.length !== retrieved.issues.length) return false;
  for (let i = 0; i < stored.issues.length; i++) {
    const s = stored.issues[i];
    const r = retrieved.issues[i];
    if (s.type !== r.type) return false;
    if (s.description !== r.description) return false;
    if (s.excerpt !== r.excerpt) return false;
  }
  return true;
}

function summariesEquivalent(stored, retrieved) {
  return (
    stored.title === retrieved.title &&
    stored.main_contributions === retrieved.main_contributions &&
    stored.methodology === retrieved.methodology &&
    stored.conclusions === retrieved.conclusions
  );
}

// Property test

test(
  'paper data round-trip: stored fraud_report and summary are structurally equivalent to retrieved data',
  async () => {
    await fc.assert(
      fc.asyncProperty(fraudReportArb, summaryArb, async (fraudReport, summary) => {
        const uuid = uuidv4();

        await storePaper(uuid, fraudReport, summary);
        const retrieved = await retrievePaper(uuid);

        // Retrieved document must exist
        expect(retrieved).not.toBeNull();

        // fraud_report structural equivalence
        expect(retrieved.fraud_report).toBeDefined();
        expect(fraudReportsEquivalent(fraudReport, retrieved.fraud_report)).toBe(true);

        // summary structural equivalence
        expect(retrieved.summary).toBeDefined();
        expect(summariesEquivalent(summary, retrieved.summary)).toBe(true);

        // Clean up for next iteration
        await Paper.deleteOne({ uuid });
      }),
      { numRuns: 100 }
    );
  },
  60000
);
