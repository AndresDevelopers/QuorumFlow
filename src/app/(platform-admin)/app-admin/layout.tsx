import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin general",
  description:
    "Panel del administrador general de la aplicación. Acceso restringido.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Layout raíz del admin general (platform-admin).
 * Las rutas /app-admin/login y /app-admin/panel/** tienen sus propios
 * layouts con verificación de autenticación.
 */
export default function PlatformAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background">
      {children}
    </div>
  );
}
