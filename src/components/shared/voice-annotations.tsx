'use client';

import { useState, useRef, useEffect } from 'react';
import type { Annotation } from '@/lib/types';
import {
  addDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { annotationsCollection } from '@/lib/collections';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '../ui/skeleton';
import { CheckCircle, NotebookPen, PlusCircle, Trash2, Pencil, Mic, MicOff } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { EditAnnotationDialog } from '../dashboard/edit-annotation-dialog';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceAnnotationsProps {
  title: string;
  description: string;
  source: 'dashboard' | 'council' | 'family-search' | 'missionary-work';
  annotations: Annotation[];
  isLoading: boolean;
  onAnnotationAdded: () => void;
  onAnnotationToggled: () => void;
  showCouncilView?: boolean;
  onResolveAnnotation?: (id: string) => void;
  onDeleteAnnotation?: (id: string) => void;
  currentUserId?: string;
}

export function VoiceAnnotations({
  title,
  description,
  source,
  annotations,
  isLoading,
  onAnnotationAdded,
  onAnnotationToggled,
  showCouncilView = false,
  onResolveAnnotation,
  onDeleteAnnotation,
  currentUserId,
}: VoiceAnnotationsProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [annotationToEdit, setAnnotationToEdit] = useState<Annotation | null>(null);
  
  // Voice recognition states
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({ 
        title: 'Error', 
        description: 'Reconocimiento de voz no soportado en este navegador.', 
        variant: 'destructive' 
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'es-ES';
    
    recognition.onstart = () => {
      setIsRecording(true);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setNewAnnotation(prev => prev + (prev ? ' ' : '') + transcript);
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Error en reconocimiento de voz', event.error);
      setIsRecording(false);

      // Don't show error toast for "aborted" errors as they are normal behavior
      if (event.error !== 'aborted') {
        toast({
          title: 'Error',
          description: 'Error en el reconocimiento de voz.',
          variant: 'destructive'
        });
      }
    };
    
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Ignore errors when stopping recognition that may already be stopped
        console.warn('Error stopping recognition:', error);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Auto-start recording when dialog opens
  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Small delay to ensure dialog is fully rendered
      setTimeout(() => {
        startRecording();
      }, 300);
    } else {
      if (isRecording) {
        stopRecording();
      }
      // Clear annotation when closing without saving
      if (newAnnotation.trim() === '') {
        setNewAnnotation('');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isRecording) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore cleanup errors
          console.warn('Error stopping recognition on cleanup:', error);
        }
      }
    };
  }, [isRecording]);

  const handleAddAnnotation = async () => {
    if (newAnnotation.trim() === '') return;
    if (!currentUserId) return;

    try {
      await addDoc(annotationsCollection, {
        text: newAnnotation.trim(),
        source,
        isCouncilAction: false,
        isResolved: false,
        createdAt: serverTimestamp(),
        userId: currentUserId,
      });
      
      setNewAnnotation('');
      setOpen(false);
      onAnnotationAdded();
      
      toast({ 
        title: 'Éxito', 
        description: 'Anotación guardada correctamente.' 
      });
    } catch (error) {
      console.error("Failed to add annotation: ", error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo guardar la anotación.', 
        variant: 'destructive' 
      });
    }
  };

  const handleToggleCouncilAction = async (
    id: string,
    currentStatus: boolean
  ) => {
    try {
      const annotationRef = doc(annotationsCollection, id);
      await updateDoc(annotationRef, { isCouncilAction: !currentStatus });
      onAnnotationToggled();
    } catch (error) {
      console.error("Failed to toggle annotation: ", error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo actualizar la anotación.', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteTrigger = (annotation: Annotation) => {
    setSelectedAnnotation(annotation);
    setIsAlertOpen(true);
  };
  
  const handleDeleteConfirm = () => {
    if (selectedAnnotation && onDeleteAnnotation) {
      onDeleteAnnotation(selectedAnnotation.id);
    }
    setIsAlertOpen(false);
    setSelectedAnnotation(null);
  };

  const handleEditAnnotation = (annotation: Annotation) => {
    setAnnotationToEdit(annotation);
    setEditDialogOpen(true);
  };

  const handleAnnotationUpdated = () => {
    onAnnotationAdded();
    setEditDialogOpen(false);
    setAnnotationToEdit(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-3">
              <NotebookPen className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            <Dialog open={open} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Anotación
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nueva Anotación</DialogTitle>
                  <DialogDescription>
                    Habla o escribe la nota que quieres registrar. El reconocimiento de voz se inicia automáticamente.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Textarea
                      value={newAnnotation}
                      onChange={(e) => setNewAnnotation(e.target.value)}
                      placeholder="Ej: Contactar a la familia Pérez para ofrecer ayuda con la mudanza..."
                      rows={4}
                    />
                    <Button
                      type="button"
                      variant={isRecording ? "destructive" : "outline"}
                      size="icon"
                      onClick={toggleRecording}
                      title={isRecording ? "Detener grabación" : "Iniciar grabación"}
                    >
                      {isRecording ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                      Escuchando...
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddAnnotation}
                    disabled={!newAnnotation.trim()}
                  >
                    Guardar Anotación
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : annotations.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No hay anotaciones.
            </p>
          ) : (
            <ul className="space-y-3">
              {annotations.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-start gap-3">
                    {!showCouncilView && (
                      <Checkbox
                        id={`council-${item.id}`}
                        checked={item.isCouncilAction}
                        onCheckedChange={() => handleToggleCouncilAction(item.id, item.isCouncilAction)}
                        aria-label="Marcar para consejo"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(item.createdAt.toDate(), 'd LLL yyyy, h:mm a', { locale: es })}
                        {showCouncilView && ` - Creado en: ${item.source === 'dashboard' ? 'Dashboard' : 
                          item.source === 'council' ? 'Consejo' : 
                          item.source === 'family-search' ? 'FamilySearch' : 'Obra Misional'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {showCouncilView && onResolveAnnotation && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onResolveAnnotation(item.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Resolver
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditAnnotation(item)}
                      title="Editar anotación"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {onDeleteAnnotation && currentUserId && (item.userId === currentUserId || !item.userId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTrigger(item)}
                        title="Eliminar anotación"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente la anotación: <strong>"{selectedAnnotation?.text}"</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAnnotation(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <EditAnnotationDialog
        annotation={annotationToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onAnnotationUpdated={handleAnnotationUpdated}
      />
    </>
  );
}