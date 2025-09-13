import { NextResponse } from 'next/server';
import { getDocs, query, orderBy } from 'firebase/firestore';
import { membersCollection } from '@/lib/collections';
import { Member } from '@/lib/types';

export async function GET() {
  try {
    const q = query(membersCollection, orderBy('lastName'));
    const querySnapshot = await getDocs(q);
    
    const members: Member[] = [];
    querySnapshot.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() } as Member);
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}
