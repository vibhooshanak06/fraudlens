/**
 * Feature: fraudlens, Property 16: Payload Pass-Through Invariant
 * Validates: Requirements 6.4
 *
 * For any AI Engine response relayed by the Backend, the JSON structure received
 * by the Frontend must be structurally identical to the JSON structure returned
 * by the AI Engine (no fields added, removed, or renamed).
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

// Mock Paper model to avoid real DB operations
jest.mock('../../models/Paper', () => ({
  create: jest.fn().mockResolvedValue({ uuid: 'mocked', file_path: '/tmp/mocked.pdf' }),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
  findOne: jest.fn().mockResolvedValue(null),
}));

// Mock axios — we'll configure per-test return values
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: mockAxiosPost,
}));

const app = require('../../index');

// Arbitrary JSON-serializable object strategy (no undefined, no functions, no cycles)
const jsonValueArb = fc.letrec((tie) => ({
  value: fc.oneof(
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie('value'), { maxLength: 4 }),
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), tie('value'), { maxKeys: 5 })
  ),
})).value;

// Restrict to object (dict) at the top level so the response is a JSON object
const jsonObjectArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 15 }),
  jsonValueArb,
  { minKeys: 1, maxKeys: 8 }
);

describe('POST /chat — payload pass-through invariant (Property 16)', () => {
  test('backend relays AI Engine response structurally unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(jsonObjectArb, async (aiPayload) => {
        mockAxiosPost.mockResolvedValueOnce({ status: 200, data: aiPayload });

        const res = await request(app)
          .post('/chat')
          .send({ uuid: 'test-uuid', question: 'What is this paper about?' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(aiPayload);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});

describe('POST /recommend — payload pass-through invariant (Property 16)', () => {
  test('backend relays AI Engine response structurally unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(jsonObjectArb, async (aiPayload) => {
        mockAxiosPost.mockResolvedValueOnce({ status: 200, data: aiPayload });

        const res = await request(app)
          .post('/recommend')
          .send({ query: 'machine learning fraud detection' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(aiPayload);
      }),
      { numRuns: 100 }
    );
  }, 60000);
});
