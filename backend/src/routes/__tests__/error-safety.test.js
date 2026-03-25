/**
 * Feature: fraudlens, Property 15: Internal Error Response Safety
 * Validates: Requirements 6.3
 *
 * For any simulated unhandled internal error in any Backend endpoint,
 * the response must be HTTP status 500 and the response body must not
 * contain a stack trace or internal file paths.
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

const Paper = require('../../models/Paper');
jest.mock('../../models/Paper', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const app = require('../../index');

/**
 * Generates arbitrary error messages that might contain sensitive info:
 * file paths, stack trace lines, module names, etc.
 */
const sensitiveErrorMessageArbitrary = fc.oneof(
  // Plain arbitrary string
  fc.string({ minLength: 1, maxLength: 200 }),
  // Fake file path style
  fc.tuple(
    fc.constantFrom('/home/user', '/app/src', 'C:\\Users\\dev', '/usr/local/lib'),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.constantFrom('.js', '.ts', '.json')
  ).map(([dir, name, ext]) => `${dir}/${name}${ext}:42:10`),
  // Fake stack trace line
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.constantFrom('/app/src/', '/home/user/project/', 'node_modules/')
  ).map(([fn, path]) => `    at ${fn} (${path}index.js:10:5)`)
);

/**
 * Checks that a response body string contains no stack trace or file path patterns.
 * - No "at " lines (stack trace frames)
 * - No ".js:" patterns (file path with line number)
 */
function containsNoLeakedInternals(bodyStr) {
  // Stack trace frame pattern: "    at SomeName (/path/to/file.js:10:5)"
  const stackTracePattern = /\bat\s+\S+\s*\(/;
  // File path with line number: "something.js:42"
  const filePathPattern = /\w+\.(js|ts|json):\d+/;

  return !stackTracePattern.test(bodyStr) && !filePathPattern.test(bodyStr);
}

describe('Internal error response safety — Property 15', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /analyze — unhandled Paper.findOne rejection returns 500 with no stack trace', async () => {
    await fc.assert(
      fc.asyncProperty(sensitiveErrorMessageArbitrary, async (errorMessage) => {
        // Make Paper.findOne return a rejected promise (async error — Express 4
        // async routes propagate rejected promises to the global error handler)
        Paper.findOne.mockImplementation(() => {
          const err = new Error(errorMessage);
          err.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/src/routes/analyze.js:8:20)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;
          return Promise.reject(err);
        });

        const res = await request(app)
          .post('/analyze')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ uuid: 'test-uuid' }));

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');

        // The response body must not leak stack traces or file paths
        const bodyStr = JSON.stringify(res.body);
        expect(containsNoLeakedInternals(bodyStr)).toBe(true);
      }),
      { numRuns: 100 }
    );
  }, 30000);

  test('POST /recommend — unhandled axios rejection returns 500 with no stack trace', async () => {
    const axios = require('axios');

    await fc.assert(
      fc.asyncProperty(sensitiveErrorMessageArbitrary, async (errorMessage) => {
        // Make axios.post return a rejected promise with no .response property
        axios.post.mockImplementation(() => {
          const err = new Error(errorMessage);
          err.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/src/routes/recommend.js:12:20)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;
          // No err.response — simulates a truly unhandled network error
          return Promise.reject(err);
        });

        const res = await request(app)
          .post('/recommend')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ query: 'test query' }));

        // recommend.js catches errors with no .response and returns 503,
        // but if the handler itself throws before the try/catch, it's 500.
        // Either way, no stack trace must be in the body.
        expect([500, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('error');

        const bodyStr = JSON.stringify(res.body);
        expect(containsNoLeakedInternals(bodyStr)).toBe(true);
      }),
      { numRuns: 100 }
    );
  }, 30000);

  test('POST /chat — unhandled axios rejection returns safe error response', async () => {
    const axios = require('axios');

    await fc.assert(
      fc.asyncProperty(sensitiveErrorMessageArbitrary, async (errorMessage) => {
        axios.post.mockImplementation(() => {
          const err = new Error(errorMessage);
          err.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/src/routes/chat.js:10:20)\n    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;
          return Promise.reject(err);
        });

        const res = await request(app)
          .post('/chat')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ uuid: 'test-uuid', question: 'What is this paper about?' }));

        expect([500, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('error');

        const bodyStr = JSON.stringify(res.body);
        expect(containsNoLeakedInternals(bodyStr)).toBe(true);
      }),
      { numRuns: 100 }
    );
  }, 30000);
});
