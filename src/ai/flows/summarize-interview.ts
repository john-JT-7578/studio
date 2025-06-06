
// src/ai/flows/summarize-interview.ts
'use server';

/**
 * @fileOverview A flow that summarizes an interview transcript into recruiter notes,
 * focusing only on the interviewee's contributions.
 *
 * - summarizeInterview - A function that takes an interview transcript and returns a structured summary of the interviewee's statements.
 * - SummarizeInterviewInput - The input type for the summarizeInterview function.
 * - SummarizeInterviewOutput - The return type for the summarizeInterview function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeInterviewInputSchema = z.object({
  transcript: z
    .string()
    .describe('The interview transcript to summarize. This may be a partial or complete transcript, and should include speaker labels (e.g., Interviewer:, Interviewee:, Speaker 1:).'),
});
export type SummarizeInterviewInput = z.infer<typeof SummarizeInterviewInputSchema>;

const SummarizeInterviewOutputSchema = z.object({
  summary: z.string().describe('Structured recruiter notes based *only on the Interviewee/Candidate\'s contributions* from the interview transcript, in English, and following specific formatting rules. If the transcript is too short, uninformative, or contains no clear interviewee statements, this will be a specific placeholder message.'),
});
export type SummarizeInterviewOutput = z.infer<typeof SummarizeInterviewOutputSchema>;

export async function summarizeInterview(input: SummarizeInterviewInput): Promise<SummarizeInterviewOutput> {
  // Basic check to prevent API calls with totally empty or whitespace-only transcripts.
  if (!input.transcript || input.transcript.trim() === '') {
    return { summary: "Waiting for more meaningful content to summarize." };
  }
  // Minimum character length for a transcript to be considered for summarization.
  // This helps prevent calls to the AI with very short or empty strings that might cause errors
  // or yield unhelpful "Waiting for..." messages from the AI itself.
  const MIN_TRANSCRIPT_LENGTH_FOR_MEANINGFUL_SUMMARY = 30; 

  if (input.transcript.trim().length < MIN_TRANSCRIPT_LENGTH_FOR_MEANINGFUL_SUMMARY) {
    return { summary: "Waiting for more meaningful content to summarize." };
  }
  return summarizeInterviewFlow(input);
}

const summarizeInterviewPrompt = ai.definePrompt({
  name: 'summarizeInterviewPrompt',
  input: {schema: SummarizeInterviewInputSchema},
  output: {schema: SummarizeInterviewOutputSchema},
  prompt: `You are an AI interview assistant.
Your job is to help recruiters by summarizing an interview transcript. The transcript will contain dialogue from multiple speakers, typically an 'Interviewer' and an 'Interviewee' (or labeled as 'Speaker 1', 'Speaker 2', etc.).

**Your primary task is to identify the 'Interviewee' or 'Candidate' based on the dialogue content and speaker labels, and then summarize *only the information provided by that specific individual (the Interviewee/Candidate)***. Do not include information spoken by the Interviewer unless it's a direct quote attributed by the Interviewee (which is rare and generally not needed for these notes).

You will receive transcripts in chunks as the interview progresses.

IMPORTANT PRELIMINARY RULE:
Before attempting to apply the detailed formatting rules below, first assess the provided transcript.
- If the transcript is very short (e.g., less than about 10 words from the Interviewee), or if it contains no information from the Interviewee relevant to any of the defined recruiter note sections, then you MUST output ONLY the following exact text: "Waiting for more meaningful content to summarize."
- If the transcript contains substantial information from the Interviewee relevant to the recruiter note sections, then proceed with the detailed formatting rules below.

For each update, your task is to maintain and update a clean summary based *only on the Interviewee/Candidate's statements*, using the following rules:

1. Group information **from the Interviewee/Candidate** into appropriate sections with clear section headers:
   - Marketing Experience
   - Leadership & Team Collaboration
   - Industry Knowledge & Interests
   - Cultural Background & Language
   - Work Authorization & Location
   - Availability & Work Preferences
   - Salary Expectations

2. Under each section, write clean bullet points beginning with ● and using full sentences, based **only on what the Interviewee/Candidate said**.

3. Only include information **that was explicitly stated by the Interviewee/Candidate** in the transcript. Never assume or invent details about the Interviewee/Candidate.

4. Rephrase the **Interviewee/Candidate's spoken language** into clean, professional English. The notes MUST be in English.

5. Do not output JSON or code. Only write a clean summary formatted like a recruiter’s notes based on the Interviewee/Candidate's input.

6. If a section has no relevant content **from the Interviewee/Candidate**, you MUST omit the section entirely from your output. Do not include empty sections or headers with no bullet points.

7. Treat future transcript chunks as cumulative updates — expand or revise the summary **of the Interviewee/Candidate's contributions** as needed based on the ENTIRE transcript provided so far.

---
IMPORTANT: The following section is an EXAMPLE to illustrate the desired output format and content style, assuming the content is from an Interviewee. Do NOT include any information from this example in your summary of the actual interview transcript provided below. This example is for output formatting guidance only and should not be part of the generated summary.
---

✍️ Example Input (FOR ILLUSTRATION ONLY - Assume this is all spoken by the Interviewee):
Transcript:
"""
Interviewee: 19 years of total professional experience with 10 years in Marketing across CPG, Entertainment, and Consumer Electronics.
Interviewee: Currently leading Influencer Marketing campaigns at Razor focused on storytelling. Previously worked at CJ America leading brand activations at KCON and go-to-market planning at CGV Cinemas.
Interviewee: Familiar with fandom culture but no direct experience. Reports to VP of Marketing at Razor; previously led a small team at CJ America.
Interviewee: Comfortable working long hours and building from scratch.
Interviewee: Native Korean and English speaker. US Citizen. Past experience at CJ America and Samsung C&T.
Interviewee: Interested in returning to the entertainment industry, especially in K-pop and brand engagement.
Interviewee: Currently at Razor USA as Marketing Manager. Open to new opportunities aligned with career growth. Not actively interviewing.
Interviewee: Prefers 3-week notice period. Lives in Los Angeles (Hancock Park/Koreatown), open to commuting to Santa Monica.
Interviewee: Looking for base salary $150K+ with bonus.
"""

✅ Example Output (FOR ILLUSTRATION ONLY - AI should produce similar format for the ACTUAL transcript, focusing only on the Interviewee):
---

**Marketing Experience:**
● 19 years of professional experience, with 10 years in Marketing across CPG, Entertainment, and Consumer Electronics industries.
● Currently leads storytelling-driven Influencer Marketing campaigns at Razor.
● Prior marketing experience at CJ America included brand activations at KCON and GTM strategy for CGV Cinemas.

**Leadership & Team Collaboration:**
● Reports directly to the VP of Marketing at Razor.
● Previously led a small team at CJ America.
● Comfortable with overtime and building processes from the ground up.
● Experienced in cross-functional, collaborative environments.

**Industry Knowledge & Interests:**
● While not experienced with fandoms directly, is highly familiar and a quick learner.
● Strong interest in K-pop and eager to return to the entertainment industry.
● Familiar with HYBE and has previous direct involvement in KCON.

**Cultural Background & Language:**
● Native in Korean and English; born and raised in Korea, moved to the U.S. for college.

**Work Authorization & Location:**
● U.S. Citizen; no sponsorship required.
● Resides in Los Angeles (Hancock Park/Koreatown) with access to a vehicle.
● Willing to relocate to Santa Monica and commute for the right opportunity.

**Availability & Work Preferences:**
● Prefers to give 3 weeks' notice.
● Currently working remotely, goes onsite 1–2 times/month.
● Open to hybrid or onsite roles if aligned with interests.

**Salary Expectations:**
● Seeking base salary of $150K+ with bonus potential.

---
END OF EXAMPLE SECTION.
---

IMPORTANT: If the ACTUAL INTERVIEW TRANSCRIPT below is very short (e.g., less than about 10 words from the identified Interviewee/Candidate) or contains no actionable information from the Interviewee/Candidate as per the PRELIMINARY RULE stated above, you MUST follow that rule and output "Waiting for more meaningful content to summarize.". Otherwise, proceed to summarize according to the detailed rules, based ONLY on the Interviewee/Candidate's contributions from the ACTUAL INTERVIEW TRANSCRIPT.
ACTUAL INTERVIEW TRANSCRIPT TO SUMMARIZE STARTS BELOW (this may be a partial segment or the complete transcript up to this point, and should contain speaker labels):
---
{{{transcript}}}
`,
});

const summarizeInterviewFlow = ai.defineFlow(
  {
    name: 'summarizeInterviewFlow',
    inputSchema: SummarizeInterviewInputSchema,
    outputSchema: SummarizeInterviewOutputSchema,
  },
  async input => {
    // Minimum character length for a transcript to be considered for summarization.
    // This helps prevent calls to the AI with very short or empty strings that might cause errors
    // or yield unhelpful "Waiting for..." messages from the AI itself.
    const MIN_TRANSCRIPT_LENGTH_FOR_MEANINGFUL_SUMMARY = 30; 

    if (!input.transcript || input.transcript.trim().length < MIN_TRANSCRIPT_LENGTH_FOR_MEANINGFUL_SUMMARY) {
      return { summary: "Waiting for more meaningful content to summarize." };
    }
    const {output} = await summarizeInterviewPrompt(input);
    return output!;
  }
);
