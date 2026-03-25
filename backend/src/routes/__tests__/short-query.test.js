/**
 * Feature: fraudlens, Property 13: Short Query Rejection
 * Validates: Requirements 5.3
 *
 * For any query string with fewer than 3 characters (including the empty string),
 * the Backend must return HTTP status 400.
 */

const request = require('supertest');
const fc = require('fast-check');

// Mock mongoose to avoid real DB connections
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect: jest.fn().mockResolvedValue(undefined),
    connection: { readyState: 1 },
  };
});

// Mock axios to avoid real AI engine calls
jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: {}, status: 200 }),
}));

const app = require('../../index');

describe('POST /recommend — short query rejection (Property 13)', () => {
  test('strings with length 0–2 always return HTTP 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 2 }),
        async (shortQuery) => {
          const res = await request(app)
            .post('/recommend')
            .send({ query: shortQuery })
            .set('Content-Type', 'application/json');

          expect(res.status).toBe(400);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
