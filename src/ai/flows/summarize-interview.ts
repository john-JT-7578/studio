// src/ai/flows/summarize-interview.ts
'use server';

/**
 * @fileOverview A flow that summarizes an interview transcript into recruiter notes,
 * potentially processing incrementally updated transcripts.
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
    .describe('The interview transcript to summarize. This may be a partial or complete transcript.'),
});
export type SummarizeInterviewInput = z.infer<typeof SummarizeInterviewInputSchema>;

const SummarizeInterviewOutputSchema = z.object({
  summary: z.string().describe('Structured recruiter notes based on the interview transcript, in the same language as the transcript and following specific formatting rules.'),
});
export type SummarizeInterviewOutput = z.infer<typeof SummarizeInterviewOutputSchema>;

export async function summarizeInterview(input: SummarizeInterviewInput): Promise<SummarizeInterviewOutput> {
  return summarizeInterviewFlow(input);
}

const summarizeInterviewPrompt = ai.definePrompt({
  name: 'summarizeInterviewPrompt',
  input: {schema: SummarizeInterviewInputSchema},
  output: {schema: SummarizeInterviewOutputSchema},
  prompt: `You are an AI interview assistant.

Your job is to help recruiters by listening to live interview transcripts and summarizing what the candidate says. Your summaries should be structured like recruiter notes — professional, human-readable, and concise.

You will receive transcripts in chunks as the interview progresses.

For each update, your task is to maintain and update a clean summary using the following rules:

1. Group information into appropriate sections with clear section headers:
   - Marketing Experience
   - Leadership & Team Collaboration
   - Industry Knowledge & Interests
   - Cultural Background & Language
   - Work Authorization & Location
   - Availability & Work Preferences
   - Salary Expectations

2. Under each section, write clean bullet points beginning with ● and using full sentences.

3. Only include information that was explicitly stated in the transcript. Never assume or invent details.

4. Rephrase spoken language into clean, professional English. The notes MUST be in the same language as the input transcript. If the transcript is in Korean, the notes must also be in Korean. If the transcript is in English, the notes must be in English.

5. Do not output JSON or code. Only write a clean summary formatted like a recruiter’s notes.

6. If a section has no relevant content, omit it.

7. Treat future transcript chunks as cumulative updates — expand or revise the summary as needed based on the ENTIRE transcript provided so far.

---
IMPORTANT: The following section is an EXAMPLE to illustrate the desired output format and content style. Do NOT include any information from this example in your summary of the actual interview transcript provided below.
---

✍️ Example Input (FOR ILLUSTRATION ONLY):
Transcript:
"""
19 years of total professional experience with 10 years in Marketing across CPG, Entertainment, and Consumer Electronics.
Currently leading Influencer Marketing campaigns at Razor focused on storytelling. Previously worked at CJ America leading brand activations at KCON and go-to-market planning at CGV Cinemas.
Familiar with fandom culture but no direct experience. Reports to VP of Marketing at Razor; previously led a small team at CJ America.
Comfortable working long hours and building from scratch.
Native Korean and English speaker. US Citizen. Past experience at CJ America and Samsung C&T.
Interested in returning to the entertainment industry, especially in K-pop and brand engagement. 
Currently at Razor USA as Marketing Manager. Open to new opportunities aligned with career growth. Not actively interviewing.
Prefers 3-week notice period. Lives in Los Angeles (Hancock Park/Koreatown), open to commuting to Santa Monica.
Looking for base salary $150K+ with bonus.
"""

✅ Example Output (FOR ILLUSTRATION ONLY - GPT should produce similar format for the ACTUAL transcript):
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

---
ACTUAL INTERVIEW TRANSCRIPT TO SUMMARIZE STARTS BELOW (this may be a partial segment or the complete transcript up to this point):
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
    const {output} = await summarizeInterviewPrompt(input);
    return output!;
  }
);
