
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
  input: {schema: SuggestActivitiesInputSchema},
  output: {schema: SuggestedActivitiesSchema},
  model: 'googleai/gemini-2.5-flash',
  prompt: `Eres un experto planificador de actividades para el Quórum de Élderes de La Iglesia de Jesucristo de los Santos de los Últimos Días.
Tu tarea es sugerir actividades creativas, atractivas y apropiadas para el próximo mes.
Las sugerencias deben dividirse en dos categorías: espirituales y temporales.
Las actividades espirituales se centran en el aprendizaje del evangelio, el testimonio y los deberes del sacerdocio.
Las actividades temporales se centran en el servicio, el compañerismo, la autosuficiencia y la diversión.

Por favor, proporciona 3 sugerencias distintas para cada categoría.

Para asegurar la variedad, evita sugerir actividades que sean demasiado similares a las ya realizadas este año. Aquí hay una lista de actividades ya organizadas:
{{#if existingActivities}}
{{#each existingActivities}}
- {{{this}}}
{{/each}}
{{else}}
- Aún no se han organizado actividades este año.
{{/if}}

Proporciona tu respuesta en español y en el formato estructurado solicitado.
`,
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

    
