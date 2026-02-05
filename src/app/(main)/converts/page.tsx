
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { newConvertFriendsCollection, membersCollection, ministeringCollection, convertsCollection } from '@/lib/collections';
import type { Convert, Member, NewConvertFriendship, Companionship } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Info, Pencil } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ConvertInfoSheet, type ConvertWithInfo } from './convert-info-sheet';
import { syncMinisteringAssignments } from '@/lib/ministering-sync';

// Convert info collection for additional data
const convertInfoCollection = (convertId: string) => doc(membersCollection.firestore, 'c_conversos_info', convertId);

async function getConvertsWithInfo(): Promise<ConvertWithInfo[]> {
  const twentyFourMonthsAgo = subMonths(new Date(), 24);

  // Obtener conversos de la colección c_conversos
  const convertsSnapshot = await getDocs(query(convertsCollection, orderBy('baptismDate', 'desc')));
  const convertsFromCollection = convertsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Convert))
    .filter(convert =>
        convert.baptismDate &&
        convert.baptismDate.toDate &&
        convert.baptismDate.toDate() > twentyFourMonthsAgo
    );

  // Obtener miembros bautizados hace 2 años
  const membersSnapshot = await getDocs(query(membersCollection, orderBy('baptismDate', 'desc')));
  const membersAsConverts = membersSnapshot.docs
    .map(doc => {
      const memberData = doc.data();
      if (memberData.baptismDate && memberData.baptismDate.toDate) {
        const baptismDate = memberData.baptismDate.toDate();
        if (baptismDate > twentyFourMonthsAgo) {
          return {
            id: `member_${doc.id}`,
            name: `${memberData.firstName} ${memberData.lastName}`,
            baptismDate: memberData.baptismDate,
            photoURL: memberData.photoURL,
            councilCompleted: memberData.councilCompleted || false,
            councilCompletedAt: memberData.councilCompletedAt || null,
            observation: 'Bautizado como miembro',
            missionaryReference: 'Registro de miembros',
            memberId: doc.id
          } as Convert;
        }
      }
      return null;
    })
    .filter(Boolean) as Convert[];

  // Combinar y ordenar por fecha de bautismo (más reciente primero)
  const allConverts = [...convertsFromCollection, ...membersAsConverts]
    .sort((a, b) => b.baptismDate.toDate().getTime() - a.baptismDate.toDate().getTime());

  // Eliminar duplicados basados en nombre y fecha de bautismo
  const uniqueConverts = allConverts.filter((convert, index, self) =>
    index === self.findIndex(c =>
      c.name === convert.name &&
      c.baptismDate.toDate().getTime() === convert.baptismDate.toDate().getTime()
    )
  );

  // Fetch additional data
  const [friendshipsSnapshot, companionshipsSnapshot, membersSnapshot2] = await Promise.all([
    getDocs(query(newConvertFriendsCollection)),
    getDocs(query(ministeringCollection)),
    getDocs(query(membersCollection))
  ]);

  const friendships = friendshipsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as NewConvertFriendship));
  const companionships = companionshipsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Companionship));
  const members = membersSnapshot2.docs.map(d => ({ id: d.id, ...d.data() } as Member));

  // Fetch additional convert info (callings, notes)
  const convertInfoPromises = uniqueConverts.map(async (convert) => {
    try {
      const infoDoc = await getDoc(convertInfoCollection(convert.id));
      if (infoDoc.exists()) {
        const data = infoDoc.data();
        return { convertId: convert.id, calling: data.calling as string || '', notes: data.notes as string || '' };
      }
      return null;
    } catch {
      return null;
    }
  });
  const convertInfos = (await Promise.all(convertInfoPromises)).filter(Boolean) as { convertId: string; calling: string; notes: string }[];

  // Enrich converts with info
  return uniqueConverts.map(convert => {
    // Find friendship
    const friendship = friendships.find(f => f.convertId === convert.id) || null;

    // Find member data (for converts linked to members or member converts)
    let memberId = convert.memberId;
    if (convert.id.startsWith('member_')) {
      memberId = convert.id.substring(7);
    }
    const memberData = memberId ? members.find(m => m.id === memberId) || null : null;

    // Find ministering teachers from companionships
    let ministeringTeachers: string[] = [];
    if (memberData) {
      // From member record
      ministeringTeachers = memberData.ministeringTeachers || [];
    }
    // Also check companionships by family name
    const familyName = convert.name?.split(' ').slice(1).join(' ');
    if (familyName) {
      const matchingComp = companionships.find(comp =>
        comp.families.some(f => f.name.toLowerCase().includes(familyName.toLowerCase()) ||
        f.name.toLowerCase().includes(convert.name?.toLowerCase() || ''))
      );
      if (matchingComp) {
        ministeringTeachers = [...new Set([...ministeringTeachers, ...matchingComp.companions])];
      }
    }

    // Get additional info
    const info = convertInfos.find(i => i?.convertId === convert.id);

    return {
      ...convert,
      friendship,
      memberData,
      ministeringTeachers,
      calling: info?.calling || '',
      notes: info?.notes || ''
    };
  });
}

export default function ConvertsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [converts, setConverts] = useState<ConvertWithInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConvert, setSelectedConvert] = useState<ConvertWithInfo | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, membersSnapshot] = await Promise.all([
        getConvertsWithInfo(),
        getDocs(query(membersCollection, orderBy('firstName', 'asc')))
      ]);
      setConverts(data);
      setAvailableMembers(membersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Member)));
    } catch (error) {
      console.error("Failed to fetch converts:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading || !user) return;
    queueMicrotask(() => {
      void loadData();
    });
  }, [authLoading, user]);

  const handleSaveConvertInfo = async (convertId: string, calling: string, notes: string) => {
    setSaving(true);
    try {
      const infoRef = convertInfoCollection(convertId);
      await setDoc(infoRef, {
        calling,
        notes,
        updatedAt: Timestamp.now()
      }, { merge: true });

      // Update local state
      setConverts(prev => prev.map(c =>
        c.id === convertId ? { ...c, calling, notes } : c
      ));
    } catch (error) {
      console.error("Failed to save convert info:", error);
    }
    setSaving(false);
  };

  const handleSaveFriends = async (convertId: string, convertName: string, friends: string[], friendshipId?: string) => {
    setSaving(true);
    try {
      if (friendshipId) {
        // Update existing friendship
        if (friends.length === 0) {
          await deleteDoc(doc(newConvertFriendsCollection, friendshipId));
        } else {
          await updateDoc(doc(newConvertFriendsCollection, friendshipId), {
            friends,
            updatedAt: Timestamp.now()
          });
        }
      } else if (friends.length > 0) {
        // Create new friendship
        await addDoc(newConvertFriendsCollection, {
          convertId,
          convertName,
          friends,
          assignedAt: serverTimestamp()
        });
      }

      // Reload data to reflect changes
      await loadData();
    } catch (error) {
      console.error("Failed to save friends:", error);
    }
    setSaving(false);
  };

  const handleSaveTeachers = async (memberId: string, teachers: string[], previousTeachers: string[]) => {
    setSaving(true);
    try {
      // Update member document
      await updateDoc(doc(membersCollection, memberId), {
        ministeringTeachers: teachers,
        updatedAt: Timestamp.now()
      });

      // Sync with ministering collection
      const member = availableMembers.find(m => m.id === memberId);
      if (member) {
        await syncMinisteringAssignments(
          { ...member, ministeringTeachers: teachers },
          previousTeachers
        );
      }

      // Reload data to reflect changes
      await loadData();
    } catch (error) {
      console.error("Failed to save teachers:", error);
    }
    setSaving(false);
  };

  const openConvertInfo = (convert: ConvertWithInfo) => {
    setSelectedConvert(convert);
    setIsSheetOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('converts.title')}</CardTitle>
            <CardDescription>
              {t('converts.description')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('converts.name')}</TableHead>
              <TableHead>{t('converts.baptismDate')}</TableHead>
              <TableHead className="text-right">{t('converts.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-20 inline-block" /></TableCell>
                </TableRow>
              ))
            ) : converts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  {t('converts.noData')}
                </TableCell>
              </TableRow>
            ) : (
              converts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={item.photoURL} data-ai-hint="profile picture" />
                            <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(item.baptismDate.toDate(), 'd LLLL yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openConvertInfo(item)}>
                        <Info className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={item.id.startsWith('member_') ? `/members?edit=${item.id.substring(7)}` : item.memberId ? `/members?edit=${item.memberId}` : `/members?search=${encodeURIComponent(item.name)}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <ConvertInfoSheet
          convert={selectedConvert}
          isOpen={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onSave={handleSaveConvertInfo}
          onSaveFriends={handleSaveFriends}
          onSaveTeachers={handleSaveTeachers}
          saving={saving}
          availableMembers={availableMembers}
        />
      </CardContent>
    </Card>
  );
}
