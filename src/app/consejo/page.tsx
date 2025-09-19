"use client";
import React, { useState, useEffect } from 'react';
import { getDocs, query, orderBy, where, Timestamp, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { convertsCollection, membersCollection, annotationsCollection } from '@/lib/collections';
import { Convert, Annotation } from '@/lib/types';
import { subMonths } from 'date-fns';
import { AnnotationManager } from '@/components/shared/annotation-manager';
import { useAuth } from '@/contexts/auth-context';

const ConsejoPage: React.FC = () => {
  const { user } = useAuth();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newConverts, setNewConverts] = useState<Convert[]>([]);
  const [loading, setLoading] = useState(true);
  const [annotationsLoading, setAnnotationsLoading] = useState(true);

  const fetchAnnotations = async () => {
    try {
      setAnnotationsLoading(true);
      const q = query(
        annotationsCollection,
        where('source', '==', 'council'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const annotationsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Annotation)
      );
      setAnnotations(annotationsData);
    } catch (error) {
      console.error('Error fetching annotations:', error);
    } finally {
      setAnnotationsLoading(false);
    }
  };

  useEffect(() => {
    const fetchNewConverts = async () => {
      try {
        const twentyFourMonthsAgo = subMonths(new Date(), 24);
        const twentyFourMonthsAgoTimestamp = Timestamp.fromDate(twentyFourMonthsAgo);

        // Obtener conversos de la colección c_conversos
        const convertsSnapshot = await getDocs(query(convertsCollection, orderBy('baptismDate', 'desc')));
        let convertsFromCollection = convertsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Convert))
          .filter(convert =>
              convert.baptismDate &&
              convert.baptismDate.toDate &&
              convert.baptismDate.toDate() > twentyFourMonthsAgo
          );

        // Obtener fotos de miembros para conversos que tienen memberId
        const memberIds = convertsFromCollection
          .map(convert => convert.memberId)
          .filter(id => id) as string[];
        const membersMap = new Map<string, any>();
        if (memberIds.length > 0) {
          // Dividir memberIds en chunks de 10 para evitar límite de Firestore
          const chunks = [];
          for (let i = 0; i < memberIds.length; i += 10) {
            chunks.push(memberIds.slice(i, i + 10));
          }
          for (const chunk of chunks) {
            const membersSnapshot = await getDocs(query(membersCollection, where('__name__', 'in', chunk)));
            membersSnapshot.docs.forEach(doc => {
              membersMap.set(doc.id, doc.data());
            });
          }
          convertsFromCollection = convertsFromCollection.map(convert => {
            if (convert.memberId && membersMap.has(convert.memberId)) {
              const memberData = membersMap.get(convert.memberId);
              return {
                ...convert,
                name: convert.name || `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim(),
                photoURL: convert.photoURL || memberData.photoURL
              };
            }
            return convert;
          });
        }

        // Obtener miembros bautizados hace menos de 2 años
        const membersSnapshot = await getDocs(query(membersCollection, orderBy('baptismDate', 'desc')));
        const membersAsConverts = membersSnapshot.docs
          .map(doc => {
            const memberData = doc.data();
            if (memberData.baptismDate && memberData.baptismDate.toDate) {
              const baptismDate = memberData.baptismDate.toDate();
              if (baptismDate > twentyFourMonthsAgo) {
                return {
                  id: `member_${doc.id}`,
                  name: `${memberData.firstName || ''} ${memberData.lastName || ''}`.trim(),
                  baptismDate: memberData.baptismDate,
                  photoURL: memberData.photoURL,
                  councilCompleted: memberData.councilCompleted || false,
                  councilCompletedAt: memberData.councilCompletedAt || null,
                  observation: 'Bautizado como miembro',
                  missionaryReference: 'Registro de miembros'
                } as Convert;
              }
            }
            return null;
          })
          .filter(Boolean) as Convert[];

        // Combinar y ordenar por fecha de bautismo (más reciente primero)
        const allConverts = [...convertsFromCollection, ...membersAsConverts]
          .sort((a, b) => b.baptismDate.toDate().getTime() - a.baptismDate.toDate().getTime());

        // Eliminar duplicados basados en nombre y fecha de bautismo, y filtrar nombres vacíos
        const uniqueConverts = allConverts
          .filter(convert => convert.name && convert.name.trim() !== '')
          .filter((convert, index, self) =>
            index === self.findIndex(c =>
              c.name === convert.name &&
              c.baptismDate.toDate().getTime() === convert.baptismDate.toDate().getTime()
            )
          );

        setNewConverts(uniqueConverts);
      } catch (error) {
        console.error('Error fetching new converts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNewConverts();
    fetchAnnotations();
  }, []);

  const handleAddAnnotation = async (description: string) => {
    if (!user) return;

    await addDoc(annotationsCollection, {
      text: description,
      source: 'council',
      isCouncilAction: false,
      isResolved: false,
      createdAt: serverTimestamp(),
      userId: user.uid,
    });
    await fetchAnnotations();
  };

  const handleDeleteAnnotation = async (id: string) => {
    await deleteDoc(doc(annotationsCollection, id));
    await fetchAnnotations();
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Consejo</h1>
      
      <AnnotationManager
        title="Anotaciones"
        description="Notas y recordatorios para el consejo del quórum."
        buttonText="Anotación"
        dialogTitle="Nueva Anotación"
        placeholder="Ej: Revisar situación de la familia Pérez..."
        items={annotations.map(ann => ({
          id: ann.id,
          description: ann.text,
          createdAt: ann.createdAt,
          userId: ann.userId
        }))}
        loading={annotationsLoading}
        onAdd={handleAddAnnotation}
        onDelete={handleDeleteAnnotation}
        emptyMessage="No hay anotaciones."
        currentUserId={user?.uid}
      />

      <section style={{ marginTop: '40px' }}>
        <h2>Seguimiento de Conversos</h2>
        {loading ? (
          <p>Cargando...</p>
        ) : newConverts.length > 0 ? (
          <ul style={{ marginTop: '20px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '5px', padding: '10px' }}>
            {newConverts.map((convert) => (
              <li key={convert.id} style={{ marginBottom: '15px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                {convert.photoURL && (
                  <img
                    src={convert.photoURL}
                    alt={`Foto de ${convert.name}`}
                    style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>
                    {convert.name}
                  </span>
                  <span style={{ fontSize: '14px', color: '#666' }}>
                    Bautismo: {convert.baptismDate?.toDate().toLocaleDateString('es-ES')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay conversos nuevos en los últimos 2 años.</p>
        )}
      </section>
    </div>
  );
};

export default ConsejoPage;
