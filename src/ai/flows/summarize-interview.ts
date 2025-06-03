// src/ai/flows/summarize-interview.ts
'use server';

/**
 * @fileOverview A flow that summarizes an interview transcript into recruiter notes.
 *
 * - summarizeInterview - A function that takes an interview transcript and returns a structured summary.
 * - SummarizeInterviewInput - The input type for the summarizeInterview function.
 * - SummarizeInterviewOutput - The return type for the summarizeInterview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeInterviewInputSchema = z.object({
  transcript: z
    .string()
    .describe('The transcript of the interview to summarize.'),
});
export type SummarizeInterviewInput = z.infer<typeof SummarizeInterviewInputSchema>;

const SummarizeInterviewOutputSchema = z.object({
  summary: z.string().describe('A structured summary of the interview transcript.'),
});
export type SummarizeInterviewOutput = z.infer<typeof SummarizeInterviewOutputSchema>;

export async function summarizeInterview(input: SummarizeInterviewInput): Promise<SummarizeInterviewOutput> {
  return summarizeInterviewFlow(input);
}

const summarizeInterviewPrompt = ai.definePrompt({
  name: 'summarizeInterviewPrompt',
  input: {schema: SummarizeInterviewInputSchema},
  output: {schema: SummarizeInterviewOutputSchema},
  prompt: `You are an AI assistant designed to summarize interview transcripts into structured recruiter notes.
  Your goal is to provide a concise and informative summary, highlighting key skills, experiences, and potential concerns.
  The summary should be structured for easy review and decision-making.

  Here is the interview transcript:
  {{transcript}}

  Please provide a structured summary of the transcript, including:
  - Candidate's key skills and qualifications
  - Relevant experiences and accomplishments
  - Any potential concerns or red flags
  - Overall assessment of the candidate's suitability for the role.
  `,
});

const summarizeInterviewFlow = ai.defineFlow(
  {
    name: 'summarizeInterviewFlow',
    inputSchema: SummarizeInterviewInputSchema,
    outputSchema: SummarizeInterviewOutputSchema,
  },
  async input => {
    const {output} = await summarizeInterviewPrompt(input);
    return output!;
  }
);
