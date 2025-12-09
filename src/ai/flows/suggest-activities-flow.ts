
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting activities for an Elders Quorum.
 *
 * - suggestActivities - A function that generates activity suggestions.
 * - SuggestActivitiesInput - The input type for the suggestActivities function.
 * - SuggestedActivities - The return type for the suggestActivities function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestActivitiesInputSchema = z.object({
  existingActivities: z.array(z.string()).describe('A list of activities that have already been organized this year.'),
});
export type SuggestActivitiesInput = z.infer<typeof SuggestActivitiesInputSchema>;

const SuggestedActivitiesSchema = z.object({
  spiritual: z.array(z.string()).describe('A list of 3 spiritual activity suggestions.'),
  temporal: z.array(z.string()).describe('A list of 3 temporal (social, service, etc.) activity suggestions.'),
});
export type SuggestedActivities = z.infer<typeof SuggestedActivitiesSchema>;

export async function suggestActivities(
  input: SuggestActivitiesInput
): Promise<SuggestedActivities> {
  return suggestActivitiesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestActivitiesPrompt',
  input: { schema: SuggestActivitiesInputSchema },
  output: { schema: SuggestedActivitiesSchema },
  model: 'googleai/gemini-1.5-flash',
  config: {
    temperature: 0.7
  },
  prompt: `Eres un experto planificador de actividades para el Quórum de Élderes.

Proporciona 3 sugerencias espirituales y 3 temporales para el próximo mes.

Responde en formato JSON con esta estructura:
{
  "spiritual": ["actividad 1", "actividad 2", "actividad 3"],
  "temporal": ["actividad 1", "actividad 2", "actividad 3"]
}`,
});

const suggestActivitiesFlow = ai.defineFlow(
  {
    name: 'suggestActivitiesFlow',
    inputSchema: SuggestActivitiesInputSchema,
    outputSchema: SuggestedActivitiesSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("Failed to generate activity suggestions.");
    }
    return output;
  }
);

    
