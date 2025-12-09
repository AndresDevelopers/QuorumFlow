import { NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import { suggestActivities, type SuggestedActivities } from '@/ai/flows/suggest-activities-flow';
import { getDocs, query, orderBy } from 'firebase/firestore';
import { activitiesCollection } from '@/lib/collections';
import { getYear } from 'date-fns';
import type { Activity } from '@/lib/types';

const getSuggestionsCached = unstable_cache(
  async (): Promise<SuggestedActivities> => {
    // Get current year activities
    const activitiesQuery = query(activitiesCollection, orderBy('date', 'desc'));
    const snapshot = await getDocs(activitiesQuery);
    const activities: Activity[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

    const currentYearActivities = activities
      .filter(a => getYear(a.date.toDate()) === getYear(new Date()))
      .map(a => a.title);

    return await suggestActivities({ existingActivities: currentYearActivities });
  },
  ['suggestions'],
  {
    revalidate: 3600, // 1 hour
    tags: ['suggestions']
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  // If refresh is requested, revalidate and get fresh data
  if (refresh) {
    if (process.env.NODE_ENV === 'production') {
      revalidateTag('suggestions');
    }
    // Always get fresh data when refresh is requested
    try {
      const activitiesQuery = query(activitiesCollection, orderBy('date', 'desc'));
      const snapshot = await getDocs(activitiesQuery);
      const activities: Activity[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

      const currentYearActivities = activities
        .filter(a => getYear(a.date.toDate()) === getYear(new Date()))
        .map(a => a.title);

      const suggestions = await suggestActivities({ existingActivities: currentYearActivities });
      return NextResponse.json(suggestions);
    } catch (error) {
      console.error('Error generating fresh suggestions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Temporary workaround: return mock suggestions when AI fails
      console.log('Returning mock suggestions due to AI error');
      const mockSuggestions = {
        spiritual: [
          'Estudio de las Escrituras en grupo',
          'Noche de hogar con enfoque espiritual',
          'Actividad de ayuno y oración'
        ],
        temporal: [
          'Servicio comunitario en un asilo',
          'Actividad deportiva familiar',
          'Taller de autosuficiencia'
        ]
      };

      return NextResponse.json(mockSuggestions);
    }
  }

  // Only use cache in production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const activitiesQuery = query(activitiesCollection, orderBy('date', 'desc'));
      const snapshot = await getDocs(activitiesQuery);
      const activities: Activity[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));

      const currentYearActivities = activities
        .filter(a => getYear(a.date.toDate()) === getYear(new Date()))
        .map(a => a.title);

      const suggestions = await suggestActivities({ existingActivities: currentYearActivities });
      return NextResponse.json(suggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);

      // Temporary workaround: return mock suggestions when AI fails
      console.log('Returning mock suggestions due to AI error');
      const mockSuggestions = {
        spiritual: [
          'Estudio de las Escrituras en grupo',
          'Noche de hogar con enfoque espiritual',
          'Actividad de ayuno y oración'
        ],
        temporal: [
          'Servicio comunitario en un asilo',
          'Actividad deportiva familiar',
          'Taller de autosuficiencia'
        ]
      };

      return NextResponse.json(mockSuggestions);
    }
  }

  try {
    const suggestions = await getSuggestionsCached();
    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching cached suggestions:', error);

    // Temporary workaround: return mock suggestions when AI fails
    console.log('Returning mock suggestions due to AI error');
    const mockSuggestions = {
      spiritual: [
        'Estudio de las Escrituras en grupo',
        'Noche de hogar con enfoque espiritual',
        'Actividad de ayuno y oración'
      ],
      temporal: [
        'Servicio comunitario en un asilo',
        'Actividad deportiva familiar',
        'Taller de autosuficiencia'
      ]
    };

    return NextResponse.json(mockSuggestions);
  }
}