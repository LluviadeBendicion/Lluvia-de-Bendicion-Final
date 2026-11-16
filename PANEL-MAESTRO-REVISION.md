# Panel Maestro LLDB · revisión local

El respaldo `respaldo/panel-maestro-2026-11-16` contiene la vista funcional de Peticiones anterior a la reorganización. `respaldo/peticiones-antes-2026-11-16` identifica el código público antes de este trabajo. Esta rama es local.

## Qué se puede probar

- Abrir el Panel Maestro con cinco clics en LLDB desde Inicio. Iniciar sesión con contraseña y código de autenticador.
- En Peticiones, enviar, localizar un expediente, controlar quién puede verlo, asignarlo, registrar notas y seguimiento, exportar con permiso y autorizar una versión exacta para la presentación privada de iglesia.
- Registrar y anular donaciones manualmente. Los reportes separan monedas y excluyen registros anulados. En Afiliados, crear expedientes, registrar bloqueos y descontinuaciones y dejar constancias de las tareas de retiro. En Propuestas y Facturación, registrar las etapas, el contrato, la factura interna y el pago recibido.
- Crear usuarios, limitar módulos, establecer vencimiento, generar credenciales de dos factores y suspender el acceso. La cuenta de director se configura fuera del panel.
- Gestionar borradores y versiones internas, previsualizar, solicitar revisión y autorizar la revisión exacta. El panel permite guardar una fecha prevista; ningún proceso conectará esa fecha a una publicación automática en esta rama.
- Ver actividad y descargar un respaldo cifrado del estado de prueba. Para recuperar un respaldo se necesita la misma clave de cifrado y un entorno aislado. No se debe subir el archivo a un repositorio público.

## Qué falta antes de habilitar fuera de la vista local

- Aprobar y verificar el almacenamiento privado de Vercel Blob y configurar `LLDB_PRAYER_PRIVATE_BLOB_TOKEN`, `LLDB_PRAYER_KEY` (32 bytes en base64) y `LLDB_PRAYER_USERS` (configuración privada del usuario de director). La API de producción permanece desactivada sin `LLDB_PRAYER_ENABLED=1`. Probar la restauración en un almacén de prueba y fijar un procedimiento de acceso, retención y eliminación de expedientes.
- No hay sincronización de pagos ni emisión fiscal automática. Propuestas, pagos, contratos y tareas de ZaraRadio se documentan internamente; el panel no envía comunicaciones ni retira contenido público. Los totales solo representan los registros ingresados en el entorno actual.
- Las herramientas de medios e IA existentes conservan su autenticación y dependen de sus servicios. Falta migrar el ingreso público de testimonios y enlazar la cola privada con la publicación real y programada de los módulos existentes. La interfaz no es una afirmación de que esos servicios estén conectados.

Archivos principales: `index.html`, `assets/panel-maestro.css`, `assets/panel-maestro.js`, `assets/peticion-*`, `api/prayer.js`, `lib/master-domain.cjs`, `lib/prayer-*.cjs`, `oracion-presentacion.html`. Pruebas: `scripts/check-prayer.cjs`, `scripts/check-master.cjs` y comprobaciones de navegador sobre la vista local.
