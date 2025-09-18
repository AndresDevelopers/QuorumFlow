import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { Timestamp } from 'firebase/firestore';
import { updateMember, deleteMember } from '@/lib/members-data';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    // Convert date strings to Timestamps
    const memberData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    if (data.birthDate) {
      memberData.birthDate = Timestamp.fromDate(new Date(data.birthDate));
    }
    if (data.baptismDate) {
      memberData.baptismDate = Timestamp.fromDate(new Date(data.baptismDate));
    }

    await updateMember(params.id, memberData);

    // Always invalidate cache when updating members
    revalidateTag('members');

    // Return response with cache-busting headers
    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteMember(params.id);

    // Always invalidate cache when deleting members
    revalidateTag('members');

    // Return response with cache-busting headers
    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}