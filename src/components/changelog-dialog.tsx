
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

export function ChangelogDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Historial de Cambios</DialogTitle>
          <DialogDescription>
            Aquí puedes ver las últimas actualizaciones de la aplicación.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <h3 className="font-semibold">v 1.0.3 (Actual)</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Se resolvieron errores de runtime con dependencias de lucide-react.</li>
              <li>Ahora se muestra automáticamente a los miembros en la página de Reportes la sección de Bautismos si se bautizó ese año.</li>
              <li>Mejoras en la generación de reportes completos con estadísticas de bautismos.</li>
              <li>Correcciones de estabilidad y mejoras de rendimiento.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">v 1.0.2</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Nueva función para editar notas de miembros y conversos.</li>
              <li>Se añadió la capacidad de subir fotos de bautismo en el registro de nuevos conversos.</li>
              <li>Correcciones internas de estabilidad y mejoras de rendimiento.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">v 1.0.1</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Se corrigió un error que impedía subir fotos de perfil.</li>
              <li>
                Se agregó una nueva sección en Ministración para comparar el
                progreso actual con el del mes anterior.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold">v 1.0.0</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li>Lanzamiento inicial de la aplicación.</li>
               <li>Funcionalidades básicas de gestión de quórum.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
