/**
 * Integration test: full backend request chain with mocked AI Engine
 * Validates: Requirements 1.2, 2.8, 4.4, 5.2
 */

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return { ...actual, connect: jest.fn().mockResolvedValue(undefined), connection: { readyState: 1 } };
});

const mockPaper = {
  uuid: 'integration-test-uuid',
  filename: 'test.pdf',
  file_path: '/tmp/test.pdf',
  status: 'completed',
  fraud_report: { plagiarism_score: 0.2, risk_level: 'low', issues: [] },
  summary: { title: 'Test Paper', main_contributions: 'Testing', methodology: 'Unit tests', conclusions: 'It works' },
  keywords: ['machine', 'learning'],
};

jest.mock('../../models/Paper', () => ({
  create: jest.fn().mockResolvedValue(mockPaper),
  findOne: jest.fn().mockResolvedValue(mockPaper),
  findOneAndUpdate: jest.fn().mockResolvedValue(mockPaper),
}));

const mockAxios = { post: jest.fn() };
jest.mock('axios', () => mockAxios);

const request = require('supertest');
const app = require('../../index');

const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 1 0 R >>\nstartxref\n9\n%%EOF');

describe('Integration: full backend request chain', () => {
  beforeEach(() => {
    mockAxios.post.mockResolvedValue({ status: 200, data: { status: 'completed', fraud_report: mockPaper.fraud_report, summary: mockPaper.summary } });
  });

  test('POST /upload → returns uuid and processing status', async () => {
    const res = await request(app).post('/upload').attach('file', VALID_PDF, { filename: 'paper.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uuid');
    expect(res.body.status).toBe('processing');
  });

  test('POST /analyze → returns fraud_report and summary for completed paper', async () => {
    const res = await request(app).post('/analyze').send({ uuid: 'integration-test-uuid' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fraud_report');
    expect(res.body).toHaveProperty('summary');
    expect(res.body.fraud_report.risk_level).toBe('low');
  });

  test('POST /chat → proxies to AI engine and returns answer + sources', async () => {
    mockAxios.post.mockResolvedValueOnce({ status: 200, data: { answer: 'This paper is about ML.', sources: [{ chunk_id: 0, excerpt: 'ML methods...' }] } });
    const res = await request(app).post('/chat').send({ uuid: 'integration-test-uuid', question: 'What is this paper about?' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('sources');
  });

  test('POST /recommend → proxies to AI engine and returns results', async () => {
    mockAxios.post.mockResolvedValueOnce({ status: 200, data: { results: [{ title: 'Paper A', authors: ['Smith'], abstract_snippet: 'About ML', similarity_score: 0.9 }] } });
    const res = await request(app).post('/recommend').send({ query: 'machine learning' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  test('GET /paper/:uuid → returns paper metadata', async () => {
    const res = await request(app).get('/paper/integration-test-uuid');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uuid');
  });
});
