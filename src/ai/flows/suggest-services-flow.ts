'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestServicesInputSchema = z.object({
  existingServices: z.array(z.string()).describe('Servicios ya planificados este año.'),
  existingActivities: z.array(z.string()).describe('Actividades actuales del año para evitar duplicidad entre actividad y servicio.'),
});

export type SuggestServicesInput = z.infer<typeof SuggestServicesInputSchema>;

const SuggestedServicesSchema = z.object({
  quorumCare: z.array(z.string()).describe('3 sugerencias de servicio de cuidado y apoyo a hermanos/familias del quórum.'),
  communityImpact: z.array(z.string()).describe('3 sugerencias de servicio comunitario con impacto medible.'),
});

export type SuggestedServices = z.infer<typeof SuggestedServicesSchema>;

export async function suggestServices(input: SuggestServicesInput): Promise<SuggestedServices> {
  return suggestServicesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestServicesPrompt',
  input: { schema: SuggestServicesInputSchema },
  output: { schema: SuggestedServicesSchema },
  model: 'googleai/gemini-1.5-flash',
  config: {
    temperature: 0.6,
  },
  prompt: `Eres un coordinador experto de servicio del Quórum de Élderes.

Genera ideas de servicio para el próximo mes tomando en cuenta:
1) Servicios existentes para no repetirlos.
2) Actividades actuales para complementar, no duplicar.

Devuelve exactamente 3 sugerencias por categoría en formato JSON:
{
  "quorumCare": ["...", "...", "..."],
  "communityImpact": ["...", "...", "..."]
}

Cada sugerencia debe ser concreta, aplicable en barrio/rama y orientada a hermanos y familias.`,
});

const suggestServicesFlow = ai.defineFlow(
  {
    name: 'suggestServicesFlow',
    inputSchema: SuggestServicesInputSchema,
    outputSchema: SuggestedServicesSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate service suggestions.');
    }
    return output;
  }
);
