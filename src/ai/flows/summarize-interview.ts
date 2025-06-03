
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
  summary: z.string().describe('Structured recruiter notes based on the interview transcript, in the same language as the transcript.'),
});
export type SummarizeInterviewOutput = z.infer<typeof SummarizeInterviewOutputSchema>;

export async function summarizeInterview(input: SummarizeInterviewInput): Promise<SummarizeInterviewOutput> {
  return summarizeInterviewFlow(input);
}

const summarizeInterviewPrompt = ai.definePrompt({
  name: 'summarizeInterviewPrompt',
  input: {schema: SummarizeInterviewInputSchema},
  output: {schema: SummarizeInterviewOutputSchema},
  prompt: `You are an AI assistant skilled in creating structured and detailed recruiter notes from interview transcripts.
Your goal is to extract key information, meaningful statements, questions, and decisions as concise notes.
The notes MUST be in the same language as the input transcript. For example, if the transcript is in Korean, the notes must also be in Korean. If the transcript is in English, the notes must be in English.

Interview Transcript:
{{{transcript}}}

Based on the transcript, provide detailed recruiter notes covering the following, as applicable. Structure the output as a list of notes:
- Candidate's key skills and qualifications mentioned.
- Important experiences and accomplishments highlighted by the candidate.
- Significant questions asked by the candidate.
- Significant questions asked by the interviewer and the candidate's responses.
- Any potential concerns, red flags, or areas needing further clarification.
- Candidate's motivations or career goals if mentioned.
- Any specific tools, technologies, or methodologies discussed.
- Salary expectations or other logistical points if they arose.
- Overall impression or noteworthy soft skills demonstrated (e.g., communication, problem-solving).
- Any decisions made or action items identified during the interview.
- Other meaningful statements or insights from the conversation.

Present these notes in a clear, well-organized, bulleted, or numbered list format. Ensure each note is concise and directly reflects information from the transcript.
Example of a note:
- Candidate mentioned 5 years of experience with React and TypeScript.
- Asked about the company's approach to work-life balance.
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

