// 'use server';
/**
 * @fileOverview A real-time interview transcription AI agent.
 *
 * - transcribeInterview - A function that handles the interview transcription process.
 * - TranscribeInterviewInput - The input type for the transcribeInterview function.
 * - TranscribeInterviewOutput - The return type for the transcribeInterview function.
 */

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TranscribeInterviewInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "The interview audio data, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeInterviewInput = z.infer<typeof TranscribeInterviewInputSchema>;

const TranscribeInterviewOutputSchema = z.object({
  transcription: z.string().describe('The transcription of the interview audio.'),
});
export type TranscribeInterviewOutput = z.infer<typeof TranscribeInterviewOutputSchema>;

export async function transcribeInterview(input: TranscribeInterviewInput): Promise<TranscribeInterviewOutput> {
  return transcribeInterviewFlow(input);
}

const transcribeInterviewPrompt = ai.definePrompt({
  name: 'transcribeInterviewPrompt',
  input: {schema: TranscribeInterviewInputSchema},
  output: {schema: TranscribeInterviewOutputSchema},
  prompt: `Transcribe this audio to text: {{media url=audioDataUri}}`,
});

const transcribeInterviewFlow = ai.defineFlow(
  {
    name: 'transcribeInterviewFlow',
    inputSchema: TranscribeInterviewInputSchema,
    outputSchema: TranscribeInterviewOutputSchema,
  },
  async input => {
    const {output} = await transcribeInterviewPrompt(input);
    return output!;
  }
);
