'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };

  useEffect(() => {
    // Check if the prompt was previously dismissed
    const dismissed = localStorage.getItem('installPromptDismissed');
    if (dismissed) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Hide the prompt after user action
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Store dismissal in localStorage
    localStorage.setItem('installPromptDismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 max-w-sm w-full sm:w-96">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium">Instalar QuorumFlow</h3>
        <button 
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Instala QuorumFlow en tu dispositivo para un acceso más rápido y funcionalidad offline completa.
      </p>
      <div className="flex gap-2">
        <Button 
          onClick={handleInstallClick}
          size="sm"
          className="w-full"
        >
          Instalar
        </Button>
      </div>
    </div>
  );
}
