# ZaraRadio now playing — puesta en marcha

**Estado:** desarrollo en rama aislada, sin publicar.

## Arquitectura
- `scripts/zararadio_now_playing.py`: extrae el último evento `start` del log diario.
- `scripts/zararadio_sender.py`: consulta cada 15 segundos y envía cambios por HTTPS con un Bearer token.
- `api/now-playing.js`: POST autenticado y GET público; persiste el estado en Vercel Blob y renueva el registro cada cinco minutos y deja de mostrar información caducada a los 20 minutos.

## Antes de desplegar
1. Conectar exclusivamente el almacén `lldb-zararadio-metadata-2026` al proyecto de Vercel con una variable de conexión específica `LLDB_RADIO_BLOB_READ_WRITE_TOKEN`. **No sustituir ni reutilizar `BLOB_READ_WRITE_TOKEN` ni el almacén privado de peticiones.** El almacén está creado, pero aún no está conectado al proyecto.
2. Generar un token aleatorio independiente y configurarlo en Vercel como `LLDB_NOW_PLAYING_TOKEN`. Nunca guardarlo en GitHub ni enviarlo por chat.
3. Desplegar únicamente a Preview; probar POST 401 sin token, POST 200 con token, GET con canción y GET con estado caducado.
4. Confirmar formato de logs y caracteres con canciones reales.
5. Añadir visualización al radio aprobado **sin alterar diseño**, probar y pedir aprobación antes de fusionar a main.

## En la computadora de ZaraRadio (cuando el servidor esté aprobado)
Configurar dos variables de entorno locales, `LLDB_NOW_PLAYING_URL` con el endpoint HTTPS y `LLDB_NOW_PLAYING_TOKEN` con el token secreto. Ejecutar el sender con la carpeta de logs como argumento. No usar credenciales de Caster.fm para este propósito.

**Pendiente:** comprobar recepción real en Vercel y enlazar UI. La presencia del código en GitHub no significa que esté funcionando en producción.
