"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
type BarrioEntry = { id: string; name: string };

export default function BarriosPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [adminReady, setAdminReady] = useState(false);
  const [barrios, setBarrios] = useState<BarrioEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Agregar
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  // Confirmar antes de agregar
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Eliminar
  const [deleteTarget, setDeleteTarget] = useState<BarrioEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBarrios = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.replace("/app-admin/login");
        return;
      }
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/app-admin/barrios", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        toast({
          title: "Sin permiso",
          description: "Solo el admin general puede gestionar barrios.",
          variant: "destructive",
        });
        await signOut(auth);
        router.replace("/app-admin/login");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Error al cargar barrios");
      }
      const data = (await res.json()) as { barrios: BarrioEntry[] };
      setBarrios(data.barrios ?? []);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "No se pudieron cargar los barrios.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  // Verificar auth al montar
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/app-admin/login");
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/app-admin/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          await signOut(auth);
          router.replace("/app-admin/login");
          return;
        }
        setAdminReady(true);
        await loadBarrios();
      } catch {
        router.replace("/app-admin/login");
      }
    });
    return () => unsub();
  }, [loadBarrios, router]);

  const openAdd = () => {
    setNewName("");
    setAddOpen(true);
  };

  const handleContinueToConfirm = () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Nombre requerido", description: "Escribe el nombre del barrio.", variant: "destructive" });
      return;
    }
    if (name.length < 2) {
      toast({ title: "Muy corto", description: "El nombre debe tener al menos 2 caracteres.", variant: "destructive" });
      return;
    }
    // Cerrar diálogo de agregar y abrir confirmación
    setAddOpen(false);
    setConfirmOpen(true);
  };

  const handleConfirmAdd = async () => {
    setAdding(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/app-admin/barrios", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        barrio?: BarrioEntry;
      };

      if (!res.ok) {
        throw new Error(body.error || "No se pudo crear el barrio");
      }

      toast({
        title: "Barrio agregado",
        description: `"${body.barrio?.name || newName.trim()}" ya está disponible para registro.`,
      });

      setConfirmOpen(false);
      setNewName("");
      await loadBarrios();
    } catch (error) {
      setConfirmOpen(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const token = await currentUser.getIdToken();
      const res = await fetch("/api/app-admin/barrios", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(body.error || "No se pudo eliminar el barrio");
      }

      toast({
        title: "Barrio eliminado",
        description: `"${deleteTarget.name}" fue eliminado. Los usuarios existentes no se ven afectados.`,
      });

      setDeleteTarget(null);
      await loadBarrios();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MapPin className="h-6 w-6" />
            Barrios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona los barrios disponibles para el registro de usuarios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !adminReady}
            onClick={loadBarrios}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
          <Button size="sm" onClick={openAdd} disabled={!adminReady}>
            <Plus className="h-4 w-4" />
            Agregar barrio
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Barrios registrados
          </CardTitle>
          <CardDescription>
            Los barrios listados aquí aparecen en el formulario de registro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : barrios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay barrios registrados. Agrega el primero.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead className="w-[100px] text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barrios.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {b.id}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deleting}
                          onClick={() => setDeleteTarget(b)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo: Agregar barrio (nombre) */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Agregar barrio
            </DialogTitle>
            <DialogDescription>
              Escribe el nombre del nuevo barrio. Se pedirá confirmación antes de crearlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="barrio-name">Nombre del barrio</Label>
              <Input
                id="barrio-name"
                placeholder="Ej: Centro"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleContinueToConfirm();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleContinueToConfirm}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Confirmación antes de agregar */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar creación de barrio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de agregar <strong>&quot;{newName.trim()}&quot;</strong> como nuevo barrio?
              <br />
              <br />
              Una vez creado, los usuarios podrán seleccionarlo al registrarse en la aplicación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={adding}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAdd} disabled={adding}>
              {adding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Agregando…</> : "Sí, agregar barrio"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo: Confirmar eliminación */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar barrio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar <strong>&quot;{deleteTarget?.name}&quot;</strong>?
              <br />
              <br />
              Esta acción no afecta a los usuarios ya registrados en este barrio,
              pero el barrio ya no aparecerá como opción en el formulario de registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Eliminando…</> : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
