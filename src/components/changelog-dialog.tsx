
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ChangelogDialog({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-full h-full max-w-none sm:max-w-[425px] sm:h-auto">
        <DialogHeader>
          <DialogTitle>Historial de Cambios</DialogTitle>
          <DialogDescription>
            AquÃ­ puedes ver las Ãºltimas actualizaciones de la aplicaciÃ³n.
          </DialogDescription>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <span className="sr-only">Cerrar</span>
            Ã
          </DialogClose>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] sm:max-h-none">
          <div className="grid gap-4 py-4">
            <div>
              <h3 className="font-semibold">v 1.1.5 (Actual)</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Se añadió en Observaciones una vista dedicada para los compañerismos de ministración con familias menos activas o inactivas, facilitando el seguimiento de esas visitas.</li>
                <li>La tarjeta de Anotaciones del Tablero ahora mantiene la interacción en la misma página, evitando redirecciones inesperadas.</li>
                <li>En Ministración el listado carga más compañerismos de forma incremental al desplazarse, superando el límite inicial de diez registros.</li>
                <li>El registro de usuarios crea automáticamente el documento en c_users con el rol predeterminado <code>president</code>, además de la cuenta en Auth.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.4</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Corregido problema donde los datos no se guardaban al crear o editar miembros en la pÃ¡gina de Miembros.</li>
                <li>Optimizada la sincronizaciÃ³n en la pÃ¡gina de Miembros para que solo ocurra al agregar, editar o eliminar miembros, en lugar de cada recarga de pÃ¡gina.</li>
                <li>En la pÃ¡gina de Consejo, en la secciÃ³n de Seguimiento de Conversos, ahora se muestra el nombre del miembro junto a su foto y encima del texto de Bautismo.</li>
                <li>Las secciones del Dashboard ahora son clicables y redirigen a las pÃ¡ginas correspondientes que muestran los datos.</li>
                <li>En la pÃ¡gina de Consejo, en la secciÃ³n de Anotaciones, solo se pueden editar o eliminar las notas creadas por el usuario autenticado.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.3</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Implementado componente reutilizable de anotaciones con reconocimiento de voz automÃ¡tico para facilitar el mantenimiento y consistencia en toda la aplicaciÃ³n.</li>
                <li>Las anotaciones en Dashboard, Consejo y FamilySearch ahora incluyen reconocimiento de voz automÃ¡tico al abrir el diÃ¡logo, similar a la funcionalidad de Obra Misional.</li>
                <li>En la pÃ¡gina de Obra Misional, la tabla de Asignaciones ahora utiliza el componente reutilizable manteniendo toda su funcionalidad original (agregar, completar, eliminar).</li>
                <li>Mejorada la secciÃ³n de Seguimiento de Conversos en la pÃ¡gina de Consejo: el nombre del miembro ahora aparece prominentemente al lado de la imagen, con la informaciÃ³n de bautismo debajo.</li>
                <li>Las anotaciones en la pÃ¡gina de Consejo ahora se guardan de forma persistente en Firebase en lugar de solo localmente.</li>
                <li>Agregado manejo global de errores con Sentry para capturar y reportar errores de renderizado de React automÃ¡ticamente.</li>
                <li>Todas las funcionalidades de anotaciones ahora comparten la misma interfaz y comportamiento consistente en toda la aplicaciÃ³n.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.2</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>En la pÃ¡gina de Consejo, en la secciÃ³n de Seguimiento de Conversos, ahora se muestran los nombres y fotos de los miembros en la lista.</li>
                <li>Agregada una nueva secciÃ³n en la pÃ¡gina de ObservaciÃ³n que muestra a las personas que no han recibido la ordenanza del sacerdocio mayor, similar a la pÃ¡gina de Miembros.</li>
                <li>Removido el Ã­cono del lÃ¡piz en la pestaÃ±a de Nuevos Conversos de la pÃ¡gina de Obra Misional.</li>
                <li>Agregada funcionalidad de voz a texto en las pestaÃ±as de Asignaciones e Investigadores de la pÃ¡gina de Obra Misional, permitiendo a los usuarios dictar en lugar de escribir.</li>
                <li>Nueva pestaÃ±a de ImÃ¡genes en la pÃ¡gina de Obra Misional, donde los usuarios pueden subir imÃ¡genes, la IA genera descripciones editables que se pueden guardar o eliminar.</li>
                <li>Aumentado el tamaÃ±o de fuente para preguntas y respuestas en la secciÃ³n de Preguntas Frecuentes de la pÃ¡gina de Obra Misional.</li>
                <li>En la pÃ¡gina de MinistraciÃ³n, las familias y compaÃ±erismos son ahora clicables y llevan a los perfiles de los miembros.</li>
                <li>Al editar un compaÃ±erismo en la pÃ¡gina de MinistraciÃ³n, se pueden seleccionar miembros guardados para compaÃ±eros y familias asignadas.</li>
                <li>Al eliminar una familia en la pÃ¡gina de MinistraciÃ³n, se sincroniza eliminando las cuentas seleccionadas de la pÃ¡gina del miembro.</li>
                <li>Implementado cachÃ© inteligente para la pÃ¡gina de Miembros, que almacena datos y se regenera en cambios, funcionando solo en producciÃ³n.</li>
                <li>Implementado cachÃ© inteligente para la pÃ¡gina de Reportes, almacenando sugerencias de IA y regenerando solo al actualizar, funcionando solo en producciÃ³n.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.1</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>En la pÃ¡gina de Consejo, la secciÃ³n de Seguimiento de Conversos ahora muestra los miembros bautizados hace menos de dos aÃ±os comparados con la fecha actual.</li>
                <li>Corregido el error de suscripciÃ³n de notificaciones en la pÃ¡gina de Ajustes, ahora funciona correctamente.</li>
                <li>La pÃ¡gina de Futuros Miembros ahora solo muestra miembros sin bautismo marcado o con fecha de bautismo futura, actualizÃ¡ndose automÃ¡ticamente cuando la fecha llegue.</li>
                <li>El Dashboard actualiza el contador de Futuros Miembros reflejando exactamente lo que se muestra en la pÃ¡gina correspondiente.</li>
                <li>Al editar un miembro y quitar su imagen, se actualiza inmediatamente y se elimina del almacenamiento si ya no se usa.</li>
                <li>La imagen ahora es opcional al agregar o editar miembros, facilitando el proceso de registro.</li>
                <li>El diÃ¡logo de historial de cambios es ahora deslizable en dispositivos mÃ³viles para mejor usabilidad.</li>
                <li>Corregida la visualizaciÃ³n de servicios agregados en la pÃ¡gina de Servicios.</li>
                <li>En Reportes, eliminada la opciÃ³n de agregar bautismos manualmente, mostrando solo aquellos de origen automÃ¡tico.</li>
                <li>Al cerrar el diÃ¡logo de actualizaciÃ³n, se guarda el estado de la versiÃ³n en las preferencias del usuario.</li>
                <li>En Obra Misional, la secciÃ³n de Amigos del QuÃ³rum muestra automÃ¡ticamente nuevos conversos bautizados en los Ãºltimos dos aÃ±os.</li>
                <li>Al agregar un nuevo miembro, se valida si el nombre ya existe, permitiendo continuar o cancelar el proceso.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.0</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Nueva pÃ¡gina Observaciones para que se vean los miembros inactivos, sin ministrantes y sin ordenanzas</li>
                <li>La pÃ¡gina de cumpleaÃ±os ahora muestra mÃ¡s informaciÃ³n y es mÃ¡s fÃ¡cil de usar.</li>
                <li>La pÃ¡gina de conversos recientes tiene una mejor organizaciÃ³n y muestra mÃ¡s detalles Ãºtiles.</li>
                <li>El panel principal ahora muestra la informaciÃ³n de manera mÃ¡s clara y organizada.</li>
                <li>Las anotaciones en el panel principal son mÃ¡s fÃ¡ciles de leer y gestionar.</li>
                <li>Los reportes descargados ahora muestran las imÃ¡genes correctamente en lugar de solo enlaces.</li>
                <li>Nueva funcionalidad de notificaciones push para recibir alertas en el celular.</li>
                <li>Se corrigieron problemas que impedÃ­an que algunas pÃ¡ginas funcionaran correctamente.</li>
                <li>La aplicaciÃ³n ahora carga mÃ¡s rÃ¡pido y funciona de manera mÃ¡s fluida.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.0.3</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Se solucionaron problemas con algunos Ã­conos que no se mostraban correctamente.</li>
                <li>Ahora se muestra automÃ¡ticamente a los miembros bautizados del aÃ±o en la secciÃ³n de reportes.</li>
                <li>Mejoras en la creaciÃ³n de reportes con informaciÃ³n de bautismos.</li>
                <li>La aplicaciÃ³n es mÃ¡s estable y rÃ¡pida.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.0.2</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Nueva funciÃ³n para editar notas de miembros y conversos.</li>
                <li>Se aÃ±adiÃ³ la capacidad de subir fotos de bautismo en el registro de nuevos conversos.</li>
                <li>Correcciones internas de estabilidad y mejoras de rendimiento.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.0.1</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Se corrigiÃ³ un error que impedÃ­a subir fotos de perfil.</li>
                <li>
                  Se agregÃ³ una nueva secciÃ³n en MinistraciÃ³n para comparar el
                  progreso actual con el del mes anterior.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.0.0</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Lanzamiento inicial de la aplicaciÃ³n.</li>
                <li>Funcionalidades bÃ¡sicas de gestiÃ³n de quÃ³rum.</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
