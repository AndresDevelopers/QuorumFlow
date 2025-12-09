'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing images and generating descriptions.
 *
 * - analyzeImage - A function that analyzes an image and generates a description.
 * - AnalyzeImageInput - The input type for the analyzeImage function.
 * - AnalyzeImageOutput - The return type for the analyzeImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeImageInputSchema = z.object({
  imageData: z.string().describe('The base64 encoded image data (data:image/jpeg;base64,...).'),
});
export type AnalyzeImageInput = z.infer<typeof AnalyzeImageInputSchema>;

const AnalyzeImageOutputSchema = z.object({
  description: z.string().describe('A detailed description of the image content.'),
});
export type AnalyzeImageOutput = z.infer<typeof AnalyzeImageOutputSchema>;

export async function analyzeImage(
  input: AnalyzeImageInput
): Promise<AnalyzeImageOutput> {
  return analyzeImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeImagePrompt',
  input: {schema: AnalyzeImageInputSchema},
  output: {schema: AnalyzeImageOutputSchema},
  model: `googleai/${process.env.NEXT_PUBLIC_GENKIT_MODEL}`,
  prompt: `Analiza la siguiente imagen y proporciona una descripción detallada en español de su contenido. Describe lo que ves, incluyendo personas, objetos, entorno, actividades, etc. Si es relevante para el contexto de la Iglesia de Jesucristo de los Santos de los Últimos Días, menciona aspectos espirituales o misionales si los hay.

Imagen: {{{media url=imageData}}}

Descripción:`,
});

const analyzeImageFlow = ai.defineFlow(
  {
    name: 'analyzeImageFlow',
    inputSchema: AnalyzeImageInputSchema,
    outputSchema: AnalyzeImageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("Failed to analyze image.");
    }
    return output;
  }
);