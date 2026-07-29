"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Mail,
  Send,
  RefreshCw,
  Users,
} from "lucide-react";

interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string | null;
  source: string;
}

export default function BoletinPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [adminReady, setAdminReady] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const authUnsubRef = useRef<(() => void) | null>(null);

  const loadSubscribers = useCallback(
    async (user: User) => {
      setLoadingSubscribers(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/app-admin/newsletter", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          toast({
            title: "Sin permiso",
            description: "Esta sesión no es del admin general.",
            variant: "destructive",
          });
          await signOut(auth);
          router.replace("/app-admin/login");
          return;
        }
        if (!res.ok) throw new Error("Error al cargar suscriptores");
        const data = (await res.json()) as { subscribers: Subscriber[] };
        setSubscribers(data.subscribers ?? []);
      } catch {
        toast({
          title: "Error",
          description: "No se pudieron cargar los suscriptores.",
          variant: "destructive",
        });
      } finally {
        setLoadingSubscribers(false);
      }
    },
    [router, toast]
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null);
        setAdminReady(false);
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
        setFirebaseUser(user);
        setAdminReady(true);
        await loadSubscribers(user);
      } catch {
        router.replace("/app-admin/login");
      }
    });
    authUnsubRef.current = unsub;
    return () => {
      unsub();
      authUnsubRef.current = null;
    };
  }, [loadSubscribers, router]);

  const handleSend = async () => {
    if (!firebaseUser) return;

    if (!subject.trim()) {
      toast({ title: "El asunto es obligatorio", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: "El contenido es obligatorio", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/app-admin/newsletter", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject: subject.trim(), content: content.trim() }),
      });

      const data = (await res.json()) as {
        error?: string;
        message?: string;
        total?: number;
        success?: number;
        failed?: number;
      };

      if (!res.ok) throw new Error(data.error || "Error al enviar");

      toast({
        title: "Boletín enviado",
        description: `Total: ${data.total} | Enviados: ${data.success} | Fallidos: ${data.failed}`,
      });

      setSubject("");
      setContent("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al enviar el boletín",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!adminReady) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Mail className="h-6 w-6" />
            Boletín de noticias
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Envía correos masivos a los suscriptores del boletín.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loadingSubscribers || !firebaseUser}
          onClick={() => firebaseUser && loadSubscribers(firebaseUser)}
        >
          {loadingSubscribers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Suscriptores
            </CardDescription>
            <CardTitle className="text-3xl">
              {loadingSubscribers ? "…" : subscribers.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registrados desde el registro</CardDescription>
            <CardTitle className="text-3xl">
              {loadingSubscribers
                ? "…"
                : subscribers.filter((s) => s.source === "register").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Enviar boletín */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar boletín
          </CardTitle>
          <CardDescription>
            Redacta y envía un correo a todos los suscriptores. El contenido soporta HTML.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Asunto</Label>
            <Input
              id="subject"
              placeholder="Ej: Novedades de Sionflow - Julio 2026"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Contenido (HTML)</Label>
            <Textarea
              id="content"
              placeholder="<h1>Hola</h1><p>Escribe el contenido del boletín aquí...</p>"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={sending}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Se enviará a {subscribers.length} suscriptor{subscribers.length !== 1 ? "es" : ""}.
            </p>
            <Button
              onClick={handleSend}
              disabled={sending || subscribers.length === 0 || !subject.trim() || !content.trim()}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar boletín
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de suscriptores */}
      <Card>
        <CardHeader>
          <CardTitle>Todos los suscriptores</CardTitle>
          <CardDescription>
            Lista de correos suscritos al boletín de noticias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSubscribers ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : subscribers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay suscriptores todavía.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha de suscripción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.email}</TableCell>
                      <TableCell className="text-xs capitalize">{s.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.subscribedAt
                          ? new Date(s.subscribedAt).toLocaleDateString("es-EC", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
