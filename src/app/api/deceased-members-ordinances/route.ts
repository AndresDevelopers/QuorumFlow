import { NextResponse } from 'next/server';
import { getDocs, query, where, collection, DocumentData } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { sendDeceasedMembersOrdinanceNotifications, hasAllTempleOrdinances } from '@/lib/notification-helpers';

/**
 * API Endpoint for weekly deceased members ordinances notifications
 * 
 * This endpoint should be called by a Firebase Scheduler cron job every Monday at 9:00 AM
 * Schedule: 0 9 * * 1 (every Monday at 9:00 AM)
 * 
 * The endpoint checks if there are deceased members with incomplete temple ordinances
 * and sends push notifications to all users with push notifications enabled.
 */

interface DeceasedMember {
  id: string;
  firstName: string;
  lastName: string;
  templeOrdinances: string[];
  templeWorkCompletedAt: unknown | null;
}

export async function GET() {
  try {
    // Check if today is Monday (for validation)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // In production, this should be triggered by a cron job
    // For development, we can still test it manually
    
    // Get all deceased members
    const membersRef = collection(firestore, 'c_miembros');
    const deceasedQuery = query(
      membersRef,
      where('status', '==', 'deceased')
    );
    
    const deceasedSnapshot = await getDocs(deceasedQuery);
    
    const deceasedMembers: DeceasedMember[] = deceasedSnapshot.docs.map(doc => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        templeOrdinances: data.templeOrdinances || [],
        templeWorkCompletedAt: data.templeWorkCompletedAt || null
      };
    });
    
    // Filter members who still need ordinances
    const membersNeedingOrdinances = deceasedMembers.filter(member => {
      // If all ordinances are completed, skip
      if (hasAllTempleOrdinances(member)) {
        return false;
      }
      return true;
    });
    
    // If no members need ordinances, return early
    if (membersNeedingOrdinances.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No deceased members need temple ordinances at this time',
        membersNeedingOrdinances: 0,
        sent: 0,
        skipped: 0
      });
    }
    
    // Send push notifications to all users
    const result = await sendDeceasedMembersOrdinanceNotifications(membersNeedingOrdinances);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${membersNeedingOrdinances.length} deceased members needing ordinances`,
      membersNeedingOrdinances: membersNeedingOrdinances.length,
      members: membersNeedingOrdinances.map(m => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`,
        missingOrdinances: m.templeOrdinances 
          ? ['baptism', 'confirmation', 'initiatory', 'endowment', 'sealed_to_father', 'sealed_to_mother', 'sealed_to_spouse'].filter(o => !m.templeOrdinances.includes(o))
          : ['baptism', 'confirmation', 'initiatory', 'endowment', 'sealed_to_father', 'sealed_to_mother', 'sealed_to_spouse']
      })),
      sent: result.sent,
      skipped: result.skipped,
      dayOfWeek
    });
    
  } catch (error) {
    console.error('Error in deceased members ordinances notification:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process deceased members notifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST() {
  return GET();
}
