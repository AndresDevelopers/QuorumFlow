
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { getDocs, query, orderBy, doc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import { ministeringCollection, ministeringDistrictsCollection } from '@/lib/collections';
import type { Companionship, Member, MinisteringDistrict } from '@/lib/types';
import { getMembersByStatus } from '@/lib/members-data';
import { useToast } from '@/hooks/use-toast';
import logger from '@/lib/logger';

import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Settings, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { useI18n } from '@/contexts/i18n-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

async function getCompanionships(): Promise<Companionship[]> {
  const q = query(ministeringCollection, orderBy('companions'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Companionship)
  );
}

async function getDistricts(): Promise<MinisteringDistrict[]> {
  const q = query(ministeringDistrictsCollection, orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as MinisteringDistrict)
  );
}

const PAGE_SIZE = 10;


export default function MinisteringPage() {
  const [companionships, setCompanionships] = useState<Companionship[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();

  const [members, setMembers] = useState<Member[]>([]);
  const [memberMap, setMemberMap] = useState<Map<string, string>>(new Map());
  const [districts, setDistricts] = useState<MinisteringDistrict[]>([]);
  const companionshipDistrictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    districts.forEach(district => {
      district.companionshipIds.forEach(id => {
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(district.name);
      });
    });
    return map;
  }, [districts]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const visibleCompanionships = useMemo(
    () => companionships.slice(0, visibleCount),
    [companionships, visibleCount],
  );

  const totalCompanionships = companionships.length;

  function StatusBadge({ companionship }: { companionship: Companionship }) {
      const isAnyFamilyUrgent = companionship.families.some(f => f.isUrgent);

      if (isAnyFamilyUrgent) {
        return <Badge variant="destructive">{t('ministering.urgent')}</Badge>;
      }

      return <Badge variant="secondary">{t('ministering.upToDate')}</Badge>;
  }

  const getMemberLink = (name: string) => {
    let searchName = name;
    if (name.startsWith('Familia ')) {
      const lastName = name.replace('Familia ', '');
      // Find member with matching last name
      const member = members.find(m => m.lastName === lastName);
      if (member) {
        return `/members/${member.id}`;
      }
      searchName = lastName;
    } else {
      const memberId = memberMap.get(name);
      if (memberId) return `/members/${memberId}`;
    }
    return `/members?search=${encodeURIComponent(searchName)}`;
  };
  const updateDistrict = async (districtId: string, updates: Partial<MinisteringDistrict>) => {
    try {
      await setDoc(doc(ministeringDistrictsCollection, districtId), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setDistricts(prev => prev.map(d => d.id === districtId ? { ...d, ...updates } : d));
      toast({ title: 'Éxito', description: 'Distrito actualizado correctamente' });
    } catch (error) {
      logger.error({ error, message: "Failed to update district" });
      toast({ title: 'Error', description: 'Error al actualizar el distrito', variant: "destructive" });
    }
  };

  const assignCompanionshipToDistrict = async (districtId: string, companionshipId: string) => {
    const district = districts.find(d => d.id === districtId);
    if (!district) return;

    const newCompanionshipIds = [...district.companionshipIds];
    if (newCompanionshipIds.includes(companionshipId)) {
      newCompanionshipIds.splice(newCompanionshipIds.indexOf(companionshipId), 1);
    } else {
      newCompanionshipIds.push(companionshipId);
    }

    await updateDistrict(districtId, { companionshipIds: newCompanionshipIds });
  };

  const assignLeaderToDistrict = async (districtId: string, leaderId: string | null) => {
    const leaderName = leaderId ? members.find(m => m.id === leaderId)?.firstName + ' ' + members.find(m => m.id === leaderId)?.lastName : null;
    await updateDistrict(districtId, { leaderId, leaderName });
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        let comps = await getCompanionships();
        const membersList = await getMembersByStatus();
        setMembers(membersList);
        const map = new Map<string, string>();
        membersList.forEach(member => {
          const fullName = `${member.firstName} ${member.lastName}`;
          map.set(fullName, member.id);
        });
        setMemberMap(map);
        // Load districts
        let districtsList = await getDistricts();
        if (districtsList.length === 0) {
          // Create default 3 districts
          const defaultDistricts = [
            { name: 'Distrito 1', companionshipIds: [], leaderId: null, leaderName: null },
            { name: 'Distrito 2', companionshipIds: [], leaderId: null, leaderName: null },
            { name: 'Distrito 3', companionshipIds: [], leaderId: null, leaderName: null },
          ];
          const batch = writeBatch(doc(ministeringDistrictsCollection).firestore);
          for (const district of defaultDistricts) {
            const docRef = doc(ministeringDistrictsCollection);
            batch.set(docRef, { ...district, updatedAt: serverTimestamp() });
          }
          await batch.commit();
          districtsList = await getDistricts(); // Re-fetch after creation
        } else {
          // Rename districts to sequential names: Distrito 1, Distrito 2, etc.
          districtsList.sort((a, b) => a.name.localeCompare(b.name));
          const batch = writeBatch(doc(ministeringDistrictsCollection).firestore);
          let needsUpdate = false;
          districtsList.forEach((district, index) => {
            const newName = t('ministering.districtDefaultName').replace('{number}', (index + 1).toString());
            if (district.name !== newName) {
              batch.update(doc(ministeringDistrictsCollection, district.id), { name: newName, updatedAt: serverTimestamp() });
              district.name = newName;
              needsUpdate = true;
            }
          });
          if (needsUpdate) {
            await batch.commit();
          }
        }
        setDistricts(districtsList);
        
        setCompanionships(comps);
    } catch (error) {
      logger.error({ error, message: "Failed to fetch companionships" });
      toast({ title: t('ministering.error'), description: t('ministering.loadError'), variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast, t]);


  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [authLoading, user, loadData]);

  useEffect(() => {
    if (companionships.length === 0) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount((prev) => {
      const next = Math.max(prev, PAGE_SIZE);
      return Math.min(next, companionships.length);
    });
  }, [companionships]);

  useEffect(() => {
    const node = loadMoreTriggerRef.current;
    if (!node) return;
    if (loading) return;
    if (visibleCount >= companionships.length) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount((prev) => {
        const next = Math.min(prev + PAGE_SIZE, companionships.length);
        return next === prev ? prev : next;
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => {
            const next = Math.min(prev + PAGE_SIZE, companionships.length);
            return next === prev ? prev : next;
          });
        }
      });
    }, { rootMargin: '0px 0px 200px 0px' });

    observer.observe(node);

    return () => observer.disconnect();
  }, [loading, visibleCount, companionships.length]);

  return (
    <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-1">
          {loading ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <Card>
              <CardHeader className="space-y-1 pb-2">
                <CardTitle className="text-sm font-medium">{t('ministering.companionships')}</CardTitle>
                <CardDescription>{t('ministering.totalCompanionshipsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCompanionships}</div>
              </CardContent>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader>
              <CardTitle className="text-lg">Distritos de Ministración</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))
              ) : districts.map((district) => (
                <Card key={district.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {district.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium">Compañerismos: {district.companionshipIds.length}</p>
                      <p className="font-medium">Líder: {district.leaderName || 'No asignado'}</p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <Settings className="mr-2 h-4 w-4" />
                          Gestionar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Gestionar {district.name}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Seleccionar compañerismos</label>
                            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                              {companionships.map(comp => (
                                <div key={comp.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`comp-${comp.id}`}
                                    checked={district.companionshipIds.includes(comp.id)}
                                    onCheckedChange={(checked) => assignCompanionshipToDistrict(district.id, comp.id)}
                                  />
                                  <label htmlFor={`comp-${comp.id}`} className="text-sm">
                                    {comp.companions.join(', ')}
                                  </label>
                                </div>
                              ))}
                              {companionships.length === 0 && (
                                <p className="text-sm text-muted-foreground">No hay compañerismos disponibles</p>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Líder del distrito</label>
                            <Select
                              value={district.leaderId || 'none'}
                              onValueChange={(value) => assignLeaderToDistrict(district.id, value === 'none' ? null : value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Seleccionar líder" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No asignado</SelectItem>
                                {members.map(member => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.firstName} {member.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t('ministering.companionshipDetails')}</CardTitle>
              <Button asChild>
                <Link href="/ministering/add">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t('ministering.addCompanionship')}
                </Link>
              </Button>
          </CardHeader>
          <CardContent>
            {/* Desktop View: Table */}
            <div className="hidden md:block">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>{t('ministering.companions')}</TableHead>
                    <TableHead>{t('ministering.assignedFamilies')}</TableHead>
                    <TableHead>{t('ministering.status')}</TableHead>
                    <TableHead>Distrito</TableHead>
                    <TableHead className="text-right">
                        {t('ministering.actions')}
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-8 w-24" /></TableCell>
                            </TableRow>
                        ))
                    ) : visibleCompanionships.map((item) => (
                    <TableRow key={item.id} className={item.families.some(f => f.isUrgent) ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-medium">
                          {item.companions.map((c, i) => (
                            <div key={i} className={i < item.companions.length - 1 ? 'mb-1' : undefined}>
                              <Link href={getMemberLink(c)} className="text-blue-600 hover:underline">
                                {c}
                              </Link>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {item.families.map((f, i) => (
                            <div key={i} className={i < item.families.length - 1 ? 'mb-1' : undefined}>
                              <Link href={getMemberLink(f.name)} className="text-blue-600 hover:underline">
                                {f.name}
                              </Link>
                            </div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge companionship={item} />
                        </TableCell>
                        <TableCell>
                          {companionshipDistrictMap.get(item.id)?.join(', ') || 'No asignado'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/ministering/${item.id}`}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    {t('ministering.manage')}
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
                {loading ? (
                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)
                ) : visibleCompanionships.map((item) => (
                     <Card key={item.id} className={item.families.some(f => f.isUrgent) ? 'border-destructive' : ''}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">
                                      {item.companions.map((c, i) => (
                                        <div key={i} className={i < item.companions.length - 1 ? 'mb-1' : undefined}>
                                          <Link href={getMemberLink(c)} className="text-blue-600 hover:underline">
                                            {c}
                                          </Link>
                                        </div>
                                      ))}
                                    </CardTitle>
                                    <CardDescription>
                                        <div className="flex items-center gap-2 mt-1">
                                            <StatusBadge companionship={item} />
                                        </div>
                                    </CardDescription>
                                </div>
                               <Button variant="outline" size="sm" asChild>
                                    <Link href={`/ministering/${item.id}`}>
                                        <Settings className="mr-2 h-4 w-4" />
                                        {t('ministering.manage')}
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           <div>
                               <p className="font-semibold text-muted-foreground">{t('ministering.assignedFamilies')}</p>
                               {item.families.map((f, i) => (
                                <div key={i} className={i < item.families.length - 1 ? 'mb-1' : undefined}>
                                  <Link href={getMemberLink(f.name)} className="text-blue-600 hover:underline">
                                    <p>{f.name}</p>
                                  </Link>
                                </div>
                              ))}
                           </div>
                           <div>
                               <p className="font-semibold text-muted-foreground">Distrito</p>
                               <p>{companionshipDistrictMap.get(item.id)?.join(', ') || 'No asignado'}</p>
                           </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div ref={loadMoreTriggerRef} className="h-1" aria-hidden="true" />

            {!loading && companionships.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    {t('ministering.noCompanionships')}
                </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
