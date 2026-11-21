# ZaraRadio → LLDB: integración de canción actual (borrador para pruebas)

## Estado
Preparación en rama aislada. No desplegar ni fusionar hasta verificar pruebas y autorizar publicación.

## Evidencia de origen
- ZaraRadio en Windows genera un archivo diario de log en Documentos/ZaraRadioLogs.
- La muestra tiene columnas TIME y ACTION y una ruta de archivo para eventos `start`.
- La lista de ZaraRadio muestra título y artista si las etiquetas del archivo están completas.
- La PC permanece encendida mientras se transmite.
- Caster.fm Free bloquea el enlace directo; no asumir que se puede incrustar audio en LLDB.

## Diseño propuesto
1. Agente Windows local (sin contraseñas en repositorio): sigue el log diario, lee nuevas líneas `start`, resuelve ruta local del MP3, extrae etiquetas ID3 con fallback a nombre de archivo y evita duplicados. La captura actual no demuestra el formato de rutas con espacios o rotaciones: validar con archivo real antes de implementar parser.
2. Envío HTTPS a endpoint autenticado en Vercel usando token independiente, guardado como secreto local y en variables de entorno; aplicar limitación de tamaño, validación de contenido y tasa.
3. Persistencia duradera compartida (Vercel Blob o almacén existente apropiado); **no** guardar estado en memoria ni escribir a filesystem efímero de funciones.
4. Endpoint público GET con `title`, `artist`, `updatedAt`, `status`; respuesta cacheada brevemente y estado 'sin datos' cuando caduque.
5. UI existente: reutilizar solamente los indicadores del radio retro ya aprobado, sin modificar diseño, layout, iconos o navegación. Mostrar título/artista cuando haya datos; 'Programación musical' como fallback. No afirmar 'EN VIVO' solo porque exista un log.
6. 'Siguiente canción' necesita una fuente distinta del log de reproducción actual; no inventarla.
7. Separar audio de metadatos. Resolver restricciones de enlace directo Caster.fm antes de prometer reproducción integrada.

## Pruebas antes de publicación
- Registro de canción con nombre de archivo, espacios, acentos y caracteres especiales.
- Cambio de pista, repetición, log rotado a medianoche, reinicio del agente y corte de internet.
- Token inválido, carga malformada, caducidad y acceso público de solo lectura.
- Visualización en móvil y PC sin cambios al diseño original.
- Verificar que no se expongan rutas locales, credenciales o datos de la computadora.

## Próximo requisito
Obtener unas líneas completas del log de ZaraRadio (sin rutas personales) y confirmar si el usuario puede ejecutar un agente en Windows. No tocar producción hasta revisión explícita.
