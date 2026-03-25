/**
 * Feature: fraudlens, Property 18: UUID Uniqueness
 * Validates: Requirements 9.1
 *
 * For any set of N successful paper uploads, all N returned UUIDs must be distinct.
 */

const request = require('supertest');
const fc = require('fast-check');

// Mock mongoose and Paper model before requiring the app
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: { readyState: 1 },
  };
});

jest.mock('../../models/Paper', () => {
  return {
    create: jest.fn().mockResolvedValue({ uuid: 'mocked', file_path: '/tmp/mocked.pdf' }),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
  };
});

// Mock axios so the AI engine call never fires
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: { status: 'completed' } }),
}));

const app = require('../../index');

// Minimal valid PDF buffer (PDF magic bytes + minimal structure)
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 1 0 R >>\nstartxref\n9\n%%EOF'
);

describe('POST /upload — UUID uniqueness (Property 18)', () => {
  test('all UUIDs returned from N uploads are distinct', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (n) => {
          const uuids = [];

          for (let i = 0; i < n; i++) {
            const res = await request(app)
              .post('/upload')
              .attach('file', VALID_PDF_BUFFER, {
                filename: `paper-${i}.pdf`,
                contentType: 'application/pdf',
              });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('uuid');
            expect(typeof res.body.uuid).toBe('string');
            uuids.push(res.body.uuid);
          }

          // All UUIDs must be distinct
          const uniqueSet = new Set(uuids);
          expect(uniqueSet.size).toBe(uuids.length);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
