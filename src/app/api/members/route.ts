import { NextResponse } from 'next/server';
import { getDocs, query, orderBy, where, collection } from 'firebase/firestore';
import { unstable_cache, revalidateTag } from 'next/cache';
import { Member, MemberStatus } from '@/lib/types';
import { createMember } from '@/lib/members-data';

// Initialize Firebase directly in the API route
async function initializeFirebaseForServer() {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getFirestore } = await import('firebase/firestore');
  const { firebaseConfig } = await import('@/firebaseConfig');

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

const getMembersCached = unstable_cache(
  async (status?: MemberStatus) => {
    const db = await initializeFirebaseForServer();
    const membersCollection = collection(db, 'c_miembros');

    const constraints = status ? [where('status', '==', status), orderBy('lastName')] : [orderBy('lastName')];
    const q = query(membersCollection, ...constraints);
    const querySnapshot = await getDocs(q);

    const members: Member[] = [];
    querySnapshot.forEach((doc: any) => {
      const memberData = doc.data();
      const processedMemberData = {
        ...memberData,
        status: memberData.status || 'active'
      };
      members.push({
        id: doc.id,
        ...processedMemberData
      } as Member);
    });

    return members;
  },
  ['members'],
  {
    revalidate: 3600, // 1 hour
    tags: ['members']
  }
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as MemberStatus | null;

  try {
    // In development, always fetch fresh data without cache
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 Development mode: Fetching fresh data from Firestore');

      console.log('📋 Initializing Firebase for server...');
      const db = await initializeFirebaseForServer();
      console.log('✅ Firebase initialized');

      console.log('📁 Creating collection reference...');
      const membersCollection = collection(db, 'c_miembros');
      console.log('✅ Collection reference created');

      const constraints = status ? [where('status', '==', status), orderBy('lastName')] : [orderBy('lastName')];
      console.log('📋 Building query with constraints:', constraints.length);

      const q = query(membersCollection, ...constraints);
      console.log('🔍 Query created, executing...');

      const querySnapshot = await getDocs(q);
      console.log('✅ Query executed successfully, docs:', querySnapshot.size);

      if (querySnapshot.empty) {
        console.log('⚠️ No documents found in c_miembros collection');
        console.log('💡 This could mean:');
        console.log('   1. The collection is empty');
        console.log('   2. The collection name is incorrect');
        console.log('   3. The documents don\'t match the query');
      }

      const members: Member[] = [];
      querySnapshot.forEach((doc) => {
        console.log(`📄 Processing document: ${doc.id}`);
        const memberData = doc.data();
        console.log(`📋 Document data keys: ${Object.keys(memberData).join(', ')}`);

        const processedMemberData = {
          ...memberData,
          status: memberData.status || 'active'
        };
        members.push({
          id: doc.id,
          ...processedMemberData
        } as Member);
      });

      console.log(`📊 Processed ${members.length} members from Firestore`);

      if (members.length === 0) {
        console.log('⚠️ No members were processed. Check if:');
        console.log('   1. Documents exist in the c_miembros collection');
        console.log('   2. Documents have the expected structure');
        console.log('   3. Firebase rules allow reading the collection');
      }

      // Always set no-cache headers in development
      const response = NextResponse.json(members);
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');

      return response;
    }

    // Use cached version only in production
    console.log('📦 Production mode: Using cached data');
    const members = await getMembersCached(status || undefined);
    return NextResponse.json(members);
  } catch (error) {
    console.error('❌ Detailed error in /api/members:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      code: (error as any)?.code,
      details: (error as any)?.details
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch members',
        details: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code || 'UNKNOWN'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('📥 POST /api/members received data:', {
      data,
      dataKeys: Object.keys(data),
      birthDate: data.birthDate,
      baptismDate: data.baptismDate
    });

    // Convert date strings to Date objects
    const memberData: any = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system', // Or get from auth
    };

    if (data.birthDate) {
      memberData.birthDate = new Date(data.birthDate);
      console.log('📅 Converted birthDate:', {
        original: data.birthDate,
        converted: memberData.birthDate
      });
    }
    if (data.baptismDate) {
      memberData.baptismDate = new Date(data.baptismDate);
      console.log('🎂 Converted baptismDate:', {
        original: data.baptismDate,
        converted: memberData.baptismDate
      });
    }

    // Set activity dates based on status
    if (data.status === 'active') {
      memberData.lastActiveDate = new Date();
      memberData.inactiveSince = null;
    } else {
      memberData.inactiveSince = new Date();
    }

    console.log('🔄 Calling createMember with:', {
      memberData,
      memberDataKeys: Object.keys(memberData)
    });

    const memberId = await createMember(memberData);

    // Always invalidate cache when creating/updating members
    revalidateTag('members');

    // Return response with cache-busting headers
    const response = NextResponse.json({ id: memberId }, { status: 201 });
    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}
