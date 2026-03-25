/**
 * Feature: fraudlens, Property 14: Malformed JSON Rejection
 * Validates: Requirements 6.2
 *
 * For any request body that is not valid JSON sent to any Backend endpoint,
 * the response must be HTTP status 400 with a descriptive error message.
 */

const request = require('supertest');
const fc = require('fast-check');

// Mock mongoose so no real DB connection is needed
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: { readyState: 1 },
  };
});

jest.mock('../../models/Paper', () => ({
  create: jest.fn().mockResolvedValue({ uuid: 'mocked', file_path: '/tmp/mocked.pdf' }),
  findOne: jest.fn().mockResolvedValue(null),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
}));

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: {} }),
}));

const app = require('../../index');

/**
 * Generates strings that are definitely NOT valid JSON.
 * We use a filter to exclude any string that happens to be parseable as JSON.
 */
const invalidJsonArbitrary = fc
  .string({ minLength: 1 })
  .filter((s) => {
    try {
      JSON.parse(s);
      return false; // valid JSON — skip
    } catch {
      return true; // invalid JSON — keep
    }
  });

const JSON_ENDPOINTS = ['/analyze', '/chat', '/recommend'];

describe('Malformed JSON rejection — Property 14', () => {
  test.each(JSON_ENDPOINTS)(
    'POST %s returns 400 for any malformed JSON body',
    async (endpoint) => {
      await fc.assert(
        fc.asyncProperty(invalidJsonArbitrary, async (body) => {
          const res = await request(app)
            .post(endpoint)
            .set('Content-Type', 'application/json')
            .send(body);

          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty('error');
          expect(typeof res.body.error).toBe('string');
          expect(res.body.error.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    },
    30000
  );
});
