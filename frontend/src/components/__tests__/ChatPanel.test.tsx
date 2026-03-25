/**
 * Feature: fraudlens, Property 11: Chat History Ordering
 * Validates: Requirements 4.7
 */
import { describe, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fc from 'fast-check';
import ChatPanel from '../ChatPanel';

// Mock the api module
vi.mock('../../api', () => ({
    sendChat: vi.fn(),
}));

import { sendChat } from '../../api';

describe('ChatPanel — Property 11: Chat History Ordering', () => {
    test('rendered chat history preserves insertion order of Q&A pairs', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        question: fc.string({ minLength: 1, maxLength: 40, alphabet: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ') }),
                        answer: fc.string({ minLength: 1, maxLength: 40, alphabet: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ') }),
                    }),
                    { minLength: 1, maxLength: 4 }
                ),
                async (pairs) => {
                    const mockSendChat = sendChat as ReturnType<typeof vi.fn>;
                    mockSendChat.mockReset();

                    // Queue up answers in order
                    for (const pair of pairs) {
                        mockSendChat.mockResolvedValueOnce({ answer: pair.answer, sources: [] });
                    }

                    const { unmount } = render(<ChatPanel uuid="test-uuid" />);

                    for (let i = 0; i < pairs.length; i++) {
                        const input = screen.getByRole('textbox');
                        fireEvent.change(input, { target: { value: pairs[i].question } });
                        fireEvent.click(screen.getByRole('button', { name: /send/i }));
                        await waitFor(() => screen.getByText(new RegExp(pairs[i].answer.slice(0, 10), 'i')), { timeout: 3000 });
                    }

                    // Verify all questions and answers appear in DOM in order
                    const allText = document.body.innerText || document.body.textContent || '';
                    let lastIdx = -1;
                    for (const pair of pairs) {
                        const qIdx = allText.indexOf(pair.question.slice(0, 8));
                        const aIdx = allText.indexOf(pair.answer.slice(0, 8));
                        expect(qIdx).toBeGreaterThan(lastIdx);
                        expect(aIdx).toBeGreaterThan(qIdx);
                        lastIdx = aIdx;
                    }

                    unmount();
                }
            ),
            { numRuns: 20 }
        );
    });
});
