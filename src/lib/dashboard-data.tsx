
import { getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import {
  convertsCollection,
  futureMembersCollection,
  ministeringCollection,
  activitiesCollection,
  servicesCollection,
  membersCollection,
  annotationsCollection
} from '@/lib/collections';
import type { Convert, Companionship, Activity, Service, Member } from '@/lib/types';
import { subMonths, addDays, format, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';

export async function getDashboardData() {
  // 1. Converts Count (last 18 months)
  const eighteenMonthsAgo = subMonths(new Date(), 18);
  const convertsSnapshot = await getDocs(
    query(convertsCollection, where('baptismDate', '>=', Timestamp.fromDate(eighteenMonthsAgo)))
  );
  const convertsCount = convertsSnapshot.size;

  // 2. Future Members Count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureMembersSnapshot = await getDocs(
    query(futureMembersCollection, where('baptismDate', '>=', Timestamp.fromDate(today)))
  );
  const futureMembersCount = futureMembersSnapshot.size;

  // 3. Ministering Reports Rate
  const ministeringSnapshot = await getDocs(ministeringCollection);
  const companionships = ministeringSnapshot.docs.map(doc => doc.data() as Companionship);
  const totalFamilies = companionships.reduce((acc, comp) => acc + comp.families.length, 0);
  const totalVisited = companionships.reduce((acc, comp) => acc + comp.families.filter(f => f.visitedThisMonth).length, 0);
  const ministeringReportRate = totalFamilies > 0 ? Math.round((totalVisited / totalFamilies) * 100) : 0;

  // 4. Council Actions Count - Based on active items in Council page

  // a. Unresolved annotations for council
  const councilAnnotationsSnapshot = await getDocs(
    query(annotationsCollection, where('isResolved', '==', false))
  );
  const councilAnnotationsCount = councilAnnotationsSnapshot.size;

  // b. Services not notified to council
  const servicesSnapshot = await getDocs(
    query(servicesCollection, where('date', '>=', Timestamp.fromDate(today)))
  );
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
  const servicesNotNotifiedCount = services.filter(service =>
    service.councilNotified === false || service.councilNotified === undefined
  ).length;

  // c. Converts needing council follow-up (within 18 months, not completed)
  const councilConvertsSnapshot = await getDocs(query(convertsCollection, where('councilCompleted', '==', false)));
  const pendingCouncilConverts = councilConvertsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Convert))
    .filter(c => c.baptismDate && c.baptismDate.toDate() > eighteenMonthsAgo).length;

  // d. Upcoming baptisms (next 7 days)
  const sevenDaysFromNow = addDays(today, 7);
  const upcomingBaptismsSnapshot = await getDocs(
    query(
      futureMembersCollection,
      where('baptismDate', '>=', Timestamp.fromDate(today)),
      where('baptismDate', '<=', Timestamp.fromDate(sevenDaysFromNow))
    )
  );
  const upcomingBaptismsCount = upcomingBaptismsSnapshot.size;

  // e. Upcoming activities (next 14 days)
  const fourteenDaysFromNow = addDays(today, 14);
  const activitiesSnapshot = await getDocs(query(activitiesCollection, orderBy('date', 'desc')));
  const upcomingActivitiesCount = activitiesSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
    .filter(activity => {
      const activityDate = activity.date.toDate();
      return isAfter(activityDate, today) && isBefore(activityDate, fourteenDaysFromNow);
    }).length;

  // f. Urgent needs from ministering
  const urgentNeedsCount = companionships.flatMap(c => c.families).filter(f => f.isUrgent).length;

  // g. Less active members needing council follow-up
  const lessActiveMembersSnapshot = await getDocs(
    query(membersCollection, where('status', '==', 'less_active'))
  );
  const lessActiveMembers = lessActiveMembersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  const lessActiveMembersNeedingCouncilCount = lessActiveMembers.filter(member =>
    !member.councilCompleted
  ).length;

  const councilActionsCount = councilAnnotationsCount + servicesNotNotifiedCount + pendingCouncilConverts +
    upcomingBaptismsCount + upcomingActivitiesCount + urgentNeedsCount +
    lessActiveMembersNeedingCouncilCount;

  return {
    convertsCount,
    futureMembersCount,
    ministeringReportRate,
    councilActionsCount,
  };
}

export async function getMembersByStatus() {
  const membersSnapshot = await getDocs(membersCollection);
  const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Record<string, any> } as Member));

  const activeMembers = members.filter(m => m.status === 'active');
  const lessActiveMembers = members.filter(m => m.status === 'less_active');
  const inactiveMembers = members.filter(m => m.status === 'inactive');

  return {
    active: activeMembers,
    lessActive: lessActiveMembers,
    inactive: inactiveMembers,
    total: members.length
  };
}


export async function getActivityChartData() {
  const activitiesSnapshot = await getDocs(query(activitiesCollection, orderBy('date', 'asc')));
  const activities = activitiesSnapshot.docs.map(doc => doc.data() as Activity);

  const monthlyTotals: { [key: string]: number } = {
    Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
    Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0,
  };

  const currentYear = new Date().getFullYear();

  activities.forEach(activity => {
    const activityDate = activity.date.toDate();
    if (activityDate.getFullYear() === currentYear) {
      const month = format(activityDate, 'MMM', { locale: es });
      // Capitalize first letter for consistency (e.g., 'Ene' -> 'Ene')
      const monthKey = month.charAt(0).toUpperCase() + month.slice(1).replace('.', '');
      if (monthlyTotals.hasOwnProperty(monthKey)) {
        monthlyTotals[monthKey] += 1;
      }
    }
  });

  // Map to the format expected by the chart
  const chartData = Object.entries(monthlyTotals).map(([name, total]) => ({
    name: name,
    total: total,
  }));

  // Re-order to standard month order since locale might change it
  const standardOrder = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const monthNameMapping: { [key: string]: string } = {
    Jan: "Ene", Aug: "Ago", Apr: "Abr", Dec: "Dic"
  };



  const sortedChartData = standardOrder.map(monthName => {
    // Find the English key that maps to the Spanish month name
    const englishKey = Object.keys(monthNameMapping).find(key => monthNameMapping[key] === monthName) || monthName;
    const dataEntry = chartData.find(d => d.name === englishKey || d.name === monthName);
    return {
      name: monthName,
      total: dataEntry ? dataEntry.total : 0,
    }
  });


  return sortedChartData;
}
