import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { Timestamp } from 'firebase/firestore';
import { updateMember, deleteMember } from '@/lib/members-data';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  let data: any = null;
  try {
    // Parse request body with error handling
    try {
      data = await request.json();
    } catch (parseError) {
      console.error('❌ Error parsing request JSON:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    // Validate member ID
    if (!params.id || params.id.trim() === '') {
      console.error('❌ Invalid member ID:', params.id);
      return NextResponse.json(
        { error: 'Invalid member ID', details: 'Member ID is required' },
        { status: 400 }
      );
    }

    console.log('📥 PUT /api/members/[id] received data:', {
      memberId: params.id,
      data,
      dataKeys: Object.keys(data),
      birthDate: data.birthDate,
      baptismDate: data.baptismDate
    });

    // Test Firebase connectivity
    try {
      const { initializeApp, getApps } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      const { firebaseConfig } = await import('@/firebaseConfig');

      console.log('🔥 Testing Firebase initialization...');
      const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const db = getFirestore(app);
      console.log('✅ Firebase initialized successfully');
    } catch (firebaseError) {
      console.error('❌ Firebase initialization error:', firebaseError);
      return NextResponse.json(
        { error: 'Firebase initialization failed', details: 'Cannot connect to Firebase' },
        { status: 500 }
      );
    }
    // Convert date strings to Timestamps
    const memberData: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    if (data.birthDate) {
      try {
        const birthDate = new Date(data.birthDate);
        if (!isNaN(birthDate.getTime())) {
          memberData.birthDate = Timestamp.fromDate(birthDate);
          console.log('📅 Converted birthDate:', {
            original: data.birthDate,
            converted: memberData.birthDate
          });
        } else {
          console.warn('⚠️ Invalid birthDate, skipping conversion:', data.birthDate);
        }
      } catch (dateError) {
        console.error('❌ Error converting birthDate:', dateError);
      }
    }
    if (data.baptismDate) {
      try {
        const baptismDate = new Date(data.baptismDate);
        if (!isNaN(baptismDate.getTime())) {
          memberData.baptismDate = Timestamp.fromDate(baptismDate);
          console.log('🎂 Converted baptismDate:', {
            original: data.baptismDate,
            converted: memberData.baptismDate
          });
        } else {
          console.warn('⚠️ Invalid baptismDate, skipping conversion:', data.baptismDate);
        }
      } catch (dateError) {
        console.error('❌ Error converting baptismDate:', dateError);
      }
    }

    console.log('🔄 Calling updateMember with:', {
      memberId: params.id,
      memberData,
      memberDataKeys: Object.keys(memberData)
    });

    await updateMember(params.id, memberData);

    // Always invalidate cache when updating members
    revalidateTag('members');

    // Return response with cache-busting headers
    const response = NextResponse.json({ success: true });
    response.headers.set('Cache-Control', 'no-store');
    
    return response;
  } catch (error) {
    console.error('❌ Error updating member:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      memberId: params.id,
      dataKeys: data ? Object.keys(data) : 'data not parsed yet'
    });

    // Return more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse = {
      error: 'Failed to update member',
      details: errorMessage,
      memberId: params.id,
      timestamp: new Date().toISOString()
    };

    console.error('🚨 Sending error response:', errorResponse);

    try {
      return NextResponse.json(errorResponse, { status: 500 });
    } catch (responseError) {
      console.error('❌ Error creating response:', responseError);
      // Fallback response
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
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