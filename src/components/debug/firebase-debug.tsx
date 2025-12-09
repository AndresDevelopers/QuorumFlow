'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';
import { firestore, storage } from '@/lib/firebase';
import { createMember } from '@/lib/members-data';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente de diagnóstico para Firebase
 * Ayuda a identificar problemas de configuración y permisos
 */
export function FirebaseDebug() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    auth: boolean | null;
    firestore: boolean | null;
    storage: boolean | null;
    memberCreation: boolean | null;
    error?: string;
  }>({
    auth: null,
    firestore: null,
    storage: null,
    memberCreation: null,
  });

  const runDiagnostics = async () => {
    setTesting(true);
    const newResults = {
      auth: false,
      firestore: false,
      storage: false,
      memberCreation: false,
      error: undefined as string | undefined,
    };

    try {
      // Test 1: Authentication
      if (user && !authLoading) {
        newResults.auth = true;
        console.log('✅ Usuario autenticado:', user.email);
      } else {
        newResults.error = 'Usuario no autenticado';
        setResults(newResults);
        setTesting(false);
        return;
      }

      // Test 2: Firestore connection
      if (firestore) {
        newResults.firestore = true;
        console.log('✅ Firestore inicializado');
      } else {
        newResults.error = 'Firestore no inicializado';
        setResults(newResults);
        setTesting(false);
        return;
      }

      // Test 3: Storage connection
      if (storage) {
        newResults.storage = true;
        console.log('✅ Storage inicializado');
      } else {
        console.warn('⚠️ Storage no inicializado');
      }

      // Test 4: Member creation
      try {
        const testMemberData = {
          firstName: 'Test',
          lastName: 'Usuario',
          phoneNumber: '+1234567890',
          status: 'active' as const,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user.uid,
          lastActiveDate: Timestamp.now(),
        };

        console.log('🧪 Intentando crear miembro de prueba...');
        const memberId = await createMember(testMemberData);
        
        if (memberId) {
          newResults.memberCreation = true;
          console.log('✅ Miembro de prueba creado exitosamente:', memberId);
          
          // Cleanup: Delete the test member
          try {
            const { deleteMember } = await import('@/lib/members-data');
            await deleteMember(memberId);
            console.log('🧹 Miembro de prueba eliminado');
          } catch (cleanupError) {
            console.warn('⚠️ No se pudo eliminar el miembro de prueba:', cleanupError);
          }
        }
      } catch (memberError) {
        console.error('❌ Error creando miembro:', memberError);
        newResults.error = `Error creando miembro: ${memberError instanceof Error ? memberError.message : 'Error desconocido'}`;
      }

    } catch (error) {
      console.error('❌ Error en diagnósticos:', error);
      newResults.error = `Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`;
    }

    setResults(newResults);
    setTesting(false);

    // Show toast with results
    if (newResults.memberCreation) {
      toast({
        title: '✅ Diagnóstico exitoso',
        description: 'Todos los sistemas funcionan correctamente. El problema podría ser temporal.',
      });
    } else {
      toast({
        title: '❌ Problema detectado',
        description: newResults.error || 'Revisa la consola para más detalles.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: boolean | null) => {
    if (status === null) return <Badge variant="outline">No probado</Badge>;
    if (status === true) return <Badge variant="default" className="bg-green-600">✅ OK</Badge>;
    return <Badge variant="destructive">❌ Error</Badge>;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔧 Diagnóstico de Firebase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between items-center">
            <span>Autenticación:</span>
            {getStatusBadge(results.auth)}
          </div>
          <div className="flex justify-between items-center">
            <span>Firestore:</span>
            {getStatusBadge(results.firestore)}
          </div>
          <div className="flex justify-between items-center">
            <span>Storage:</span>
            {getStatusBadge(results.storage)}
          </div>
          <div className="flex justify-between items-center">
            <span>Crear Miembro:</span>
            {getStatusBadge(results.memberCreation)}
          </div>
        </div>

        {results.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">
              <strong>Error:</strong> {results.error}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium">Estado del Usuario:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Email: {user?.email || 'No autenticado'}</p>
            <p>UID: {user?.uid || 'N/A'}</p>
            <p>Cargando: {authLoading ? 'Sí' : 'No'}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Variables de Entorno:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Configurada' : '❌ Faltante'}</p>
            <p>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? '✅ Configurada' : '❌ Faltante'}</p>
            <p>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? '✅ Configurada' : '❌ Faltante'}</p>
            <p>Storage Bucket: {process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? '✅ Configurada' : '❌ Faltante'}</p>
          </div>
        </div>

        <Button 
          onClick={runDiagnostics} 
          disabled={testing || authLoading}
          className="w-full"
        >
          {testing ? '🔄 Ejecutando diagnósticos...' : '🚀 Ejecutar Diagnósticos'}
        </Button>

        <div className="text-xs text-muted-foreground">
          <p>Este componente ejecuta pruebas para identificar problemas con Firebase.</p>
          <p>Revisa la consola del navegador para logs detallados.</p>
        </div>
      </CardContent>
    </Card>
  );
}
