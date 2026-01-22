'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
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
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, Mic, MicOff, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { doc, getDoc } from 'firebase/firestore';
import { usersCollection } from '@/lib/collections';

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

interface AnnotationItem {
    id: string;
    description: string;
    isCompleted?: boolean;
    isCouncilAction?: boolean;
    createdAt?: any;
    userId?: string;
}

interface AnnotationManagerProps {
    title: string;
    description: string;
    buttonText: string;
    dialogTitle: string;
    placeholder: string;
    items: AnnotationItem[];
    loading: boolean;
    showCheckbox?: boolean;
    showResolveButton?: boolean;
    onAdd: (description: string) => Promise<void>;
    onToggle?: (id: string, status: boolean) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onResolve?: (id: string) => Promise<void>;
    emptyMessage?: string;
    currentUserId?: string;
}

export function AnnotationManager({
    title,
    description,
    buttonText,
    dialogTitle,
    placeholder,
    items,
    loading,
    showCheckbox = false,
    showResolveButton = false,
    onAdd,
    onToggle,
    onDelete,
    onResolve,
    emptyMessage = 'No hay elementos.',
    currentUserId,
}: AnnotationManagerProps) {
    const { toast } = useToast();
    const { userRole } = useAuth();
    const isSecretary = userRole === 'secretary';
    const [isDialogOpen, setDialogOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [errors, setErrors] = useState<{ description?: string[] }>({});
    const [isPending, setIsPending] = useState(false);
    const [deleteItem, setDeleteItem] = useState<AnnotationItem | null>(null);
    const [userNames, setUserNames] = useState<Record<string, string>>({});

    // Voice recognition states
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    const startRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            toast({
                title: 'Error',
                description: 'Reconocimiento de voz no soportado en este navegador.',
                variant: 'destructive',
            });
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'es-ES';

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue(prev => prev + (prev ? ' ' : '') + transcript);
        };
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event: any) => {
            console.error('Error en reconocimiento de voz', event.error);
            setIsRecording(false);

            // Don't show error toast for "aborted" errors as they are normal behavior
            if (event.error !== 'aborted') {
                toast({
                    title: 'Error',
                    description: 'Error en el reconocimiento de voz.',
                    variant: 'destructive',
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

    const handleDialogOpenChange = (open: boolean) => {
        setDialogOpen(open);
        if (open) {
            // Auto-start recording when dialog opens
            setTimeout(() => {
                startRecording();
            }, 300);
        } else {
            if (isRecording) {
                stopRecording();
            }
            // Reset form when closing
            setInputValue('');
            setErrors({});
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

    useEffect(() => {
        let isMounted = true;

        const fetchUserNames = async () => {
            const uniqueUserIds = Array.from(
                new Set(
                    items
                        .map((item) => item.userId)
                        .filter((id): id is string => Boolean(id))
                )
            );
            const missingUserIds = uniqueUserIds.filter((id) => !userNames[id]);

            if (missingUserIds.length === 0) return;

            try {
                const entries = await Promise.all(
                    missingUserIds.map(async (id) => {
                        const userDocRef = doc(usersCollection, id);
                        const userDoc = await getDoc(userDocRef);
                        if (!userDoc.exists()) {
                            return [id, 'Usuario'] as const;
                        }
                        const data = userDoc.data() as { name?: string; displayName?: string };
                        return [id, data.name ?? data.displayName ?? 'Usuario'] as const;
                    })
                );

                if (isMounted) {
                    setUserNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
                }
            } catch (error) {
                console.error('Error fetching annotation user names:', error);
            }
        };

        fetchUserNames();

        return () => {
            isMounted = false;
        };
    }, [items, userNames]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrors({});

        if (!inputValue.trim() || inputValue.trim().length < 5) {
            setErrors({ description: ['La descripción es requerida (mínimo 5 caracteres).'] });
            return;
        }

        setIsPending(true);
        try {
            await onAdd(inputValue.trim());
            toast({ title: 'Éxito', description: `${buttonText} agregado.` });
            setDialogOpen(false);
            setInputValue('');
        } catch (error: any) {
            console.error('Error adding item:', error);
            toast({
                title: 'Error',
                description: `No se pudo agregar el ${buttonText.toLowerCase()}.`,
                variant: 'destructive',
            });
        } finally {
            setIsPending(false);
        }
    };

    const handleToggle = async (id: string, status: boolean) => {
        if (!onToggle) return;

        setIsPending(true);
        try {
            await onToggle(id, status);
        } catch (error) {
            console.error('Error toggling item:', error);
            toast({
                title: 'Error',
                description: 'No se pudo actualizar el elemento.',
                variant: 'destructive',
            });
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteItem) return;

        setIsPending(true);
        try {
            await onDelete(deleteItem.id);
            toast({ title: 'Éxito', description: 'Elemento eliminado.' });
            setDeleteItem(null);
        } catch (error) {
            console.error('Error deleting item:', error);
            toast({
                title: 'Error',
                description: 'No se pudo eliminar el elemento.',
                variant: 'destructive',
            });
        } finally {
            setIsPending(false);
        }
    };

    return (
        <>
            <section>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">{title}</h2>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                {buttonText}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <form onSubmit={handleSubmit}>
                                <DialogHeader>
                                    <DialogTitle>{dialogTitle}</DialogTitle>
                                </DialogHeader>
                                <div className="py-4">
                                    <Label htmlFor="description">Descripción</Label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Input
                                            id="description"
                                            name="description"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            placeholder={placeholder}
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
                                        <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
                                            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                                            Escuchando...
                                        </div>
                                    )}
                                    {errors?.description && (
                                        <p className="text-sm text-destructive mt-1">
                                            {errors.description[0]}
                                        </p>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isPending}>
                                        {isPending ? 'Guardando...' : 'Guardar'}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {loading ? (
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-center py-4 text-muted-foreground">
                        {emptyMessage}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-center justify-between gap-3 p-3 border rounded-md"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    {showCheckbox && onToggle && (
                                        <Checkbox
                                            id={item.id}
                                            checked={item.isCompleted || false}
                                            onCheckedChange={() => handleToggle(item.id, item.isCompleted || false)}
                                            disabled={isPending}
                                        />
                                    )}
                                    <div className="flex-1">
                                        <Label
                                            htmlFor={item.id}
                                            className={`${item.isCompleted
                                                ? 'line-through text-muted-foreground'
                                                : ''
                                                }`}
                                        >
                                            {item.description}
                                        </Label>
                                        {item.userId && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Por: {userNames[item.userId] ?? 'Usuario'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {showResolveButton && onResolve && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onResolve(item.id)}
                                            disabled={isPending}
                                            title="Marcar como resuelta"
                                        >
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Resuelta
                                        </Button>
                                    )}
                                    {(isSecretary || (currentUserId && item.userId === currentUserId)) && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteItem(item)}
                                            disabled={isPending}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente: &quot;{deleteItem?.description}&quot;.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90"
                            disabled={isPending}
                        >
                            {isPending ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
