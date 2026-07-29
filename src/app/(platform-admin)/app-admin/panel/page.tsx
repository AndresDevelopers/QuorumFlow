"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect /app-admin/panel → /app-admin/panel/usuarios
 */
export default function PanelRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app-admin/panel/usuarios");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
      Redirigiendo…
    </div>
  );
}
