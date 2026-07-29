"use client";

import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  LogOut,
  Settings,
  Shield,
  Users,
  MapPin,
  Mail,
} from "lucide-react";
import { getAppName } from "@/lib/app-config";

const appName = getAppName();

const navItems = [
  { href: "/app-admin/panel/usuarios", label: "Usuarios", icon: Users },
  { href: "/app-admin/panel/barrios", label: "Barrios", icon: MapPin },
  { href: "/app-admin/panel/boletin", label: "Boletín", icon: Mail },
];

function PanelSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/app-admin/panel/usuarios"
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <Shield className="h-5 w-5 shrink-0 text-rose-600" />
          <span className="group-data-[state=expanded]:inline hidden text-base">
            {appName}
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} onClick={() => setOpenMobile(false)}>
                <SidebarMenuButton
                  isActive={pathname.startsWith(item.href)}
                  tooltip={{ children: item.label }}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {item.label}
                  </span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);
  return user;
}

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const firebaseUser = useAuthUser();
  const [selfAccountOpen, setSelfAccountOpen] = useState(false);
  const [selfEmail, setSelfEmail] = useState("");
  const [selfPassword, setSelfPassword] = useState("");
  const [selfPasswordConfirm, setSelfPasswordConfirm] = useState("");
  const [selfSaving, setSelfSaving] = useState(false);

  const email = firebaseUser?.email ?? "";
  const initials = email ? email.substring(0, 2).toUpperCase() : "AD";

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/app-admin/login");
  };

  const handleSaveSelfAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const newEmail = selfEmail.trim().toLowerCase();
    const password = selfPassword;
    const currentEmail = (currentUser.email ?? "").toLowerCase();

    const emailChanged = Boolean(newEmail) && newEmail !== currentEmail;
    const passwordChanged = password.length > 0;

    if (!emailChanged && !passwordChanged) {
      toast({
        title: "Sin cambios",
        description: "Escribe un correo nuevo y/o una contraseña nueva.",
        variant: "destructive",
      });
      return;
    }

    if (emailChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: "Correo no válido", variant: "destructive" });
      return;
    }
    if (passwordChanged && password.length < 6) {
      toast({ title: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    if (passwordChanged && password !== selfPasswordConfirm) {
      toast({ title: "No coinciden", variant: "destructive" });
      return;
    }

    setSelfSaving(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/app-admin/update-self", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailChanged ? newEmail : "",
          password: passwordChanged ? password : "",
        }),
      });
      const body = (await res.json()) as { error?: string; emailChanged?: boolean; passwordChanged?: boolean };
      if (!res.ok) throw new Error(body.error || "Error");

      toast({ title: "Cuenta actualizada" });
      setSelfAccountOpen(false);
      if (body.emailChanged || body.passwordChanged) {
        await signOut(auth);
        router.replace("/app-admin/login");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error inesperado",
        variant: "destructive",
      });
    } finally {
      setSelfSaving(false);
    }
  };

  return (
    <SidebarProvider>
      <PanelSidebar />
      <SidebarInset className="h-svh max-h-svh overflow-hidden">
        <header className="sticky top-0 z-30 flex shrink-0 min-h-[3.5rem] items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <SidebarTrigger />
          <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
            <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              ADMIN GENERAL
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">Admin General</p>
                    <p className="text-xs text-muted-foreground">{email || "—"}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setSelfEmail(email);
                    setSelfPassword("");
                    setSelfPasswordConfirm("");
                    setSelfAccountOpen(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" /> Mi cuenta
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </SidebarInset>

      <Dialog open={selfAccountOpen} onOpenChange={setSelfAccountOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Configurar mi cuenta
            </DialogTitle>
            <DialogDescription>
              Cambia el correo y/o la contraseña del admin general.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Sesión actual: <span className="font-mono text-foreground">{email || "—"}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-email">Correo electrónico</Label>
              <Input id="self-email" type="email" autoComplete="username" placeholder="admin@sionflow.app" value={selfEmail} disabled={selfSaving} onChange={(e) => setSelfEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-password">Nueva contraseña</Label>
              <Input id="self-password" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={selfPassword} disabled={selfSaving} onChange={(e) => setSelfPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="self-password-confirm">Confirmar contraseña</Label>
              <Input id="self-password-confirm" type="password" autoComplete="new-password" placeholder="Repite la contraseña" value={selfPasswordConfirm} disabled={selfSaving} onChange={(e) => setSelfPasswordConfirm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={selfSaving} onClick={() => setSelfAccountOpen(false)}>Cancelar</Button>
            <Button disabled={selfSaving} onClick={handleSaveSelfAccount}>
              {selfSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando…</> : "Guardar mi cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
