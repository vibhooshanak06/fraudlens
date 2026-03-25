/**
 * Feature: fraudlens, Property 19: Missing UUID Returns 404
 * Validates: Requirements 9.3
 *
 * For any UUID that has not been assigned to an uploaded paper,
 * a GET /paper/:uuid request must return HTTP status 404.
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

// Mock Paper.findOne to always return null (UUID not in DB)
jest.mock('../../models/Paper', () => ({
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue(null),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
}));

const app = require('../../index');

// UUID v4 arbitrary: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
const uuidV4Arb = fc
  .tuple(
    fc.hexaString({ minLength: 8, maxLength: 8 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 4, maxLength: 4 }),
    fc.hexaString({ minLength: 12, maxLength: 12 })
  )
  .map(([a, b, c, d, e]) => `${a}-${b}-4${c.slice(1)}-${d}-${e}`);

describe('GET /paper/:uuid — missing UUID returns 404 (Property 19)', () => {
  test('any UUID not in DB returns 404', async () => {
    await fc.assert(
      fc.asyncProperty(uuidV4Arb, async (uuid) => {
        const res = await request(app).get(`/paper/${uuid}`);
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('error');
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
