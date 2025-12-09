'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating a summary of key statistics for the dashboard.
 *
 * - generateDashboardSummary - A function that generates the dashboard summary.
 * - GenerateDashboardSummaryInput - The input type for the generateDashboardSummary function.
 * - GenerateDashboardSummaryOutput - The return type for the generateDashboardSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDashboardSummaryInputSchema = z.object({
  convertsCount: z.number().describe('The number of converts.'),
  futureMembersCount: z.number().describe('The number of future members.'),
  ministeringAssignmentsCount: z.number().describe('The number of ministering assignments.'),
  councilActionsCount: z.number().describe('The number of council actions.'),
  reportsSubmittedCount: z.number().describe('The number of reports submitted.'),
});
export type GenerateDashboardSummaryInput = z.infer<typeof GenerateDashboardSummaryInputSchema>;

const GenerateDashboardSummaryOutputSchema = z.object({
  summary: z.string().describe('A summary of the key statistics for the dashboard.'),
});
export type GenerateDashboardSummaryOutput = z.infer<typeof GenerateDashboardSummaryOutputSchema>;

export async function generateDashboardSummary(
  input: GenerateDashboardSummaryInput
): Promise<GenerateDashboardSummaryOutput> {
  return generateDashboardSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDashboardSummaryPrompt',
  input: {schema: GenerateDashboardSummaryInputSchema},
  output: {schema: GenerateDashboardSummaryOutputSchema},
  prompt: `You are a secretary of the Quorum of Elders of the Church of Jesus Christ of Latter-day Saints. Generate a summary of the key statistics for the dashboard.

Converts Count: {{{convertsCount}}}
Future Members Count: {{{futureMembersCount}}}
Ministering Assignments Count: {{{ministeringAssignmentsCount}}}
Council Actions Count: {{{councilActionsCount}}}
Reports Submitted Count: {{{reportsSubmittedCount}}}

Summary:`,
});

const generateDashboardSummaryFlow = ai.defineFlow(
  {
    name: 'generateDashboardSummaryFlow',
    inputSchema: GenerateDashboardSummaryInputSchema,
    outputSchema: GenerateDashboardSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
