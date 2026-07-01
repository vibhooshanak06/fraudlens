/**
 * Feature: fraudlens, Property 22: Issue Rendering Completeness
 * Validates: Requirements 3.3
 */
import { describe, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import FraudReportPanel from '../FraudReportPanel';
import type { FraudReport } from '../../api';

const issueTypeArb = fc.constantFrom(
    'plagiarism', 'repeated_sentence', 'overused_keyword', 'citation_format'
);

const issueArb = fc.record({
    type: issueTypeArb,
    description: fc.string({ minLength: 1, maxLength: 100 }),
    excerpt: fc.string({ minLength: 1, maxLength: 100 }),
});

const fraudReportArb = fc.record({
    plagiarism_score: fc.float({ min: 0, max: 1, noNaN: true }),
    risk_level: fc.constantFrom('low' as const, 'medium' as const, 'high' as const),
    issues: fc.array(issueArb, { minLength: 1, maxLength: 5 }),
});

describe('FraudReportPanel — Property 22: Issue Rendering Completeness', () => {
    test('every issue type, description, and excerpt appears in the DOM', () => {
        fc.assert(
            fc.property(fraudReportArb, (report: FraudReport) => {
                const { unmount } = render(<FraudReportPanel report={report} />);
                for (const issue of report.issues) {
                    // type (rendered with underscores replaced by spaces)
                    const typeText = issue.type.replace(/_/g, ' ');
                    expect(screen.getByText(new RegExp(typeText, 'i'))).toBeTruthy();
                    // description
                    expect(screen.getByText(new RegExp(issue.description.slice(0, 30), 'i'))).toBeTruthy();
                    // excerpt
                    expect(screen.getByText(new RegExp(issue.excerpt.slice(0, 30), 'i'))).toBeTruthy();
                }
                unmount();
            }),
            { numRuns: 100 }
        );
    });
});
