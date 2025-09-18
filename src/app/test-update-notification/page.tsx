'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCookie, setCookieWithMinutes, deleteCookie } from '@/lib/cookie-utils';

export default function TestUpdateNotification() {
  const [cookieStatus, setCookieStatus] = useState<string>('');
  const [currentVersion, setCurrentVersion] = useState<string>('');

  useEffect(() => {
    checkCookieStatus();
    checkVersion();
  }, []);

  const checkCookieStatus = () => {
    const dismissed = getCookie('update_dismissed');
    setCookieStatus(dismissed || 'No existe');
  };

  const checkVersion = async () => {
    try {
      const response = await fetch('/version.json');
      const data = await response.json();
      setCurrentVersion(data.version);
    } catch (error) {
      setCurrentVersion('Error al obtener versión');
    }
  };

  const setDismissedCookie = () => {
    setCookieWithMinutes('update_dismissed', 'true', 30);
    checkCookieStatus();
  };

  const clearCookie = () => {
    deleteCookie('update_dismissed');
    checkCookieStatus();
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Test de Sistema de Notificación de Actualización</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>Información sobre el sistema de actualización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><strong>Versión actual del componente:</strong> 1.0.1</p>
              <p><strong>Versión del servidor:</strong> {currentVersion}</p>
              <p><strong>Estado de cookie 'update_dismissed':</strong> {cookieStatus}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Controles de Prueba</CardTitle>
            <CardDescription>Simula el comportamiento del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={setDismissedCookie}>
                  Simular "Cerrar" (30 min)
                </Button>
                <Button onClick={clearCookie} variant="outline">
                  Limpiar Cookie
                </Button>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>• Al hacer clic en "Simular Cerrar", se establecerá una cookie que expira en 30 minutos</p>
                <p>• La cookie evitará que se muestre nuevamente la notificación</p>
                <p>• Después de 30 minutos, la cookie expirará y la notificación podrá volver a aparecer</p>
                <p>• Al hacer clic en "Actualizar", la cookie se limpiará automáticamente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instrucciones de Prueba</CardTitle>
            <CardDescription>Cómo probar el sistema completo</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Abre la aplicación principal</li>
              <li>Si hay una nueva versión disponible, aparecerá una notificación</li>
              <li>Haz clic en "Cerrar" para ocultar la notificación por 30 minutos</li>
              <li>Recarga la página - la notificación no debería aparecer</li>
              <li>Limpia la cookie usando el botón de arriba</li>
              <li>Recarga la página - la notificación debería aparecer nuevamente</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}