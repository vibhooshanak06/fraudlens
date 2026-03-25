/**
 * Feature: fraudlens, Property 20: Non-PDF Upload Rejection
 * Validates: Requirements 1.3
 *
 * For any file whose MIME type is not `application/pdf`, the Backend must
 * return HTTP status 400 with a descriptive error message.
 */

const request = require('supertest');
const fc = require('fast-check');
const app = require('../../index');

// Minimal in-memory buffer to act as file content
const DUMMY_CONTENT = Buffer.from('dummy file content');

// Arbitrary non-PDF MIME type strings
const nonPdfMimeType = fc
  .string({ minLength: 1 })
  .filter((s) => s !== 'application/pdf');

describe('POST /upload — non-PDF rejection (Property 20)', () => {
  test('rejects any non-PDF MIME type with HTTP 400', async () => {
    await fc.assert(
      fc.asyncProperty(nonPdfMimeType, async (mimeType) => {
        const res = await request(app)
          .post('/upload')
          .attach('file', DUMMY_CONTENT, {
            filename: 'test.bin',
            contentType: mimeType,
          });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
