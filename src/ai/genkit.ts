import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  model: `googleai/${process.env.NEXT_PUBLIC_GENKIT_MODEL}`,
});
