

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

  DialogTrigger,

  DialogDescription,

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

            Aquí puedes ver las últimas actualizaciones de la aplicación.

          </DialogDescription>

        </DialogHeader>

        <ScrollArea className="max-h-[70vh] sm:max-h-none">

          <div className="grid gap-4 py-4">

            <div>
              <h3 className="font-semibold">v 1.1.7 (Actual)</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Mejoramos la vista móvil de Ajustes y Miembros para que todo el contenido se ajuste bien en pantallas pequeñas, en especial la sección de gestión de roles.</li>
                <li>Ahora los tres roles de la presidencia pueden abrir Ajustes, pero solo la persona asignada como secretario puede cambiar los permisos de los usuarios.</li>
                <li>Las notificaciones funcionan en celulares y avisan automáticamente sobre actividades nuevas, familias marcadas como urgentes y asignaciones recientes de Obra Misional.</li>
                <li>Al cancelar o cerrar la edición de un miembro desde otra página, se regresa a la página de origen.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">v 1.1.5</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground">
                <li>Se añadió en Observaciones una vista dedicada para los compañerismos de ministración con familias menos activas o inactivas, facilitando el seguimiento de esas familias.</li>
                <li>La tarjeta de Anotaciones del Tablero ahora mantiene la interacción en la misma página, evitando redirecciones inesperadas.</li>
                <li>En Ministración el listado carga más compañerismos de forma incremental al desplazarse, superando el límite inicial de diez registros.</li>
                <li>El registro de usuarios crea automáticamente el documento en c_users con el rol predeterminado <code>user</code>, además de la cuenta en Auth.</li>
              </ul>
            </div>
            <div>

              <h3 className="font-semibold">v 1.1.4</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>Corregido problema donde los datos no se guardaban al crear o editar miembros en la página de Miembros.</li>

                <li>Optimizada la sincronización en la página de Miembros para que solo ocurra al agregar, editar o eliminar miembros, en lugar de cada recarga de página.</li>

                <li>En la página de Consejo, en la sección de Seguimiento de Conversos, ahora se muestra el nombre del miembro junto a su foto y encima del texto de Bautismo.</li>

                <li>Las secciones del Dashboard ahora son clicables y redirigen a las páginas correspondientes que muestran los datos.</li>

                <li>En la página de Consejo, en la sección de Anotaciones, solo se pueden editar o eliminar las notas creadas por el usuario autenticado.</li>

              </ul>

            </div>

            <div>

              <h3 className="font-semibold">v 1.1.3</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>Implementado componente reutilizable de anotaciones con reconocimiento de voz automático para facilitar el mantenimiento y consistencia en toda la aplicación.</li>

                <li>Las anotaciones en Dashboard, Consejo y FamilySearch ahora incluyen reconocimiento de voz automático al abrir el diálogo, similar a la funcionalidad de Obra Misional.</li>

                <li>En la página de Obra Misional, la tabla de Asignaciones ahora utiliza el componente reutilizable manteniendo toda su funcionalidad original (agregar, completar, eliminar).</li>

                <li>Mejorada la sección de Seguimiento de Conversos en la página de Consejo: el nombre del miembro ahora aparece prominentemente al lado de la imagen, con la información de bautismo debajo.</li>

                <li>Las anotaciones en la página de Consejo ahora se guardan de forma persistente en Firebase en lugar de solo localmente.</li>

                <li>Agregado manejo global de errores con Sentry para capturar y reportar errores de renderizado de React automáticamente.</li>

                <li>Todas las funcionalidades de anotaciones ahora comparten la misma interfaz y comportamiento consistente en toda la aplicación.</li>

              </ul>

            </div>

            <div>

              <h3 className="font-semibold">v 1.1.2</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>En la página de Consejo, en la sección de Seguimiento de Conversos, ahora se muestran los nombres y fotos de los miembros en la lista.</li>

                <li>Agregada una nueva sección en la página de Observación que muestra a las personas que no han recibido la ordenanza del sacerdocio mayor, similar a la página de Miembros.</li>

                <li>Removido el ícono del lápiz en la pestaña de Nuevos Conversos de la página de Obra Misional.</li>

                <li>Agregada funcionalidad de voz a texto en las pestañas de Asignaciones e Investigadores de la página de Obra Misional, permitiendo a los usuarios dictar en lugar de escribir.</li>

                <li>Nueva pestaña de Imágenes en la página de Obra Misional, donde los usuarios pueden subir imágenes, la IA genera descripciones editables que se pueden guardar o eliminar.</li>

                <li>Aumentado el tamaño de fuente para preguntas y respuestas en la sección de Preguntas Frecuentes de la página de Obra Misional.</li>

                <li>En la página de Ministración, las familias y compañerismos son ahora clicables y llevan a los perfiles de los miembros.</li>

                <li>Al editar un compañerismo en la página de Ministración, se pueden seleccionar miembros guardados para compañeros y familias asignadas.</li>

                <li>Al eliminar una familia en la página de Ministración, se sincroniza eliminando las cuentas seleccionadas de la página del miembro.</li>

                <li>Implementado caché inteligente para la página de Miembros, que almacena datos y se regenera en cambios, funcionando solo en producción.</li>

                <li>Implementado caché inteligente para la página de Reportes, almacenando sugerencias de IA y regenerando solo al actualizar, funcionando solo en producción.</li>

              </ul>

            </div>

            <div>

              <h3 className="font-semibold">v 1.1.1</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>En la página de Consejo, la sección de Seguimiento de Conversos ahora muestra los miembros bautizados hace menos de dos años comparados con la fecha actual.</li>

                <li>Corregido el error de suscripción de notificaciones en la página de Ajustes, ahora funciona correctamente.</li>

                <li>La página de Futuros Miembros ahora solo muestra miembros sin bautismo marcado o con fecha de bautismo futura, actualizándose automáticamente cuando la fecha llegue.</li>

                <li>El Dashboard actualiza el contador de Futuros Miembros reflejando exactamente lo que se muestra en la página correspondiente.</li>

                <li>Al editar un miembro y quitar su imagen, se actualiza inmediatamente y se elimina del almacenamiento si ya no se usa.</li>

                <li>La imagen ahora es opcional al agregar o editar miembros, facilitando el proceso de registro.</li>

                <li>El diálogo de historial de cambios es ahora deslizable en dispositivos móviles para mejor usabilidad.</li>

                <li>Corregida la visualización de servicios agregados en la página de Servicios.</li>

                <li>En Reportes, eliminada la opción de agregar bautismos manualmente, mostrando solo aquellos de origen automático.</li>

                <li>Al cerrar el diálogo de actualización, se guarda el estado de la versión en las preferencias del usuario.</li>

                <li>En Obra Misional, la sección de Amigos del Quórum muestra automáticamente nuevos conversos bautizados en los últimos dos años.</li>

                <li>Al agregar un nuevo miembro, se valida si el nombre ya existe, permitiendo continuar o cancelar el proceso.</li>

              </ul>

            </div>

            <div>

              <h3 className="font-semibold">v 1.1.0</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>Nueva página Observaciones para que se vean los miembros inactivos, sin ministrantes y sin ordenanzas</li>

                <li>La página de cumpleaños ahora muestra más información y es más fácil de usar.</li>

                <li>La página de conversos recientes tiene una mejor organización y muestra más detalles útiles.</li>

                <li>El panel principal ahora muestra la información de manera más clara y organizada.</li>

                <li>Las anotaciones en el panel principal son más fáciles de leer y gestionar.</li>

                <li>Los reportes descargados ahora muestran las imágenes correctamente en lugar de solo enlaces.</li>

                <li>Nueva funcionalidad de notificaciones push para recibir alertas en el celular.</li>

                <li>Se corrigieron problemas que impedían que algunas páginas funcionaran correctamente.</li>

                <li>La aplicación ahora carga más rápido y funciona de manera más fluida.</li>

              </ul>

            </div>

            <div>

              <h3 className="font-semibold">v 1.0.3</h3>

              <ul className="list-disc list-inside text-sm text-muted-foreground">

                <li>Se solucionaron problemas con algunos íconos que no se mostraban correctamente.</li>

                <li>Ahora se muestra automáticamente a los miembros bautizados del año en la sección de reportes.</li>

                <li>Mejoras en la creación de reportes con información de bautismos.</li>

                <li>La aplicación es más estable y rápida.</li>

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

        </ScrollArea>

      </DialogContent>

    </Dialog>

  );

}
