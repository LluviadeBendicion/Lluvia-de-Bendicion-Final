# Lecturas NVI

Biblia, concordancia, versículo del día, memorización, devocionales, estudios y sermones consultan `/api/bible`. No se sustituyen textos por otra traducción cuando la NVI no responde.

El servidor usa `API_BIBLE_KEY`, guardada como variable del entorno de Vercel. Su cuenta de API.Bible debe tener acceso autorizado a una edición española NVI. El identificador se descubre en el catálogo del proveedor; no se usa la NIV inglesa ni otra Reina-Valera. No publicar claves en código ni en el navegador.

Los campos `reference` de `api/content-config.json` eligen las lecturas de cada recurso. El texto de reflexión se mantiene separado del pasaje, que se obtiene de la NVI junto con el crédito del proveedor. Los textos guardados antes para el versículo diario y de memorización se han eliminado para evitar mezclar traducciones. El calendario automático selecciona las referencias y los textos de acompañamiento conforme a las reglas descritas abajo.

Verificación local: `node scripts/check-bible.cjs`. Estas pruebas simulan API.Bible y verifican rutas, edición, referencias y errores. Para verificar el servicio real, desplegar y consultar `/api/bible?ref=JHN.3.16` y `/api/bible?q=esperanza`; ambos deben responder con `version: "NVI"`. Después comprobar los recursos en el navegador.

Si falta acceso a la NVI, la interfaz muestra el error y no presenta otra versión como si fuera NVI. Leer gratis en otra plataforma no confirma permisos de API para esta cuenta.

## Renovación automática

- Versículo del día y oración: cada día a medianoche.
- Versículo para memorizar: cada dos días naturales, contando desde el 23 de noviembre de 2026 (23–24, 25–26, 27–28, etc.).
- Sermón, devocional y estudio: cada lunes a medianoche.
- Zona horaria compartida: America/Chicago, incluyendo horario de verano.

El servidor calcula el período al consultar la configuración. No hace falta dejar una sesión abierta ni programar un cron: la primera visita del período recibe su contenido. La página abierta comprueba cambios cada minuto mientras está visible y al volver a ella. El service worker no conserva la configuración editorial ni las respuestas bíblicas.

La rotación usa los doce temas preparados en api/resources-calendar.json; se repiten después de doce días, veinticuatro días y doce semanas respectivamente. Son oraciones, reflexiones y bosquejos preparados, no textos nuevos generados por IA ni grabaciones de sermones. Las citas bíblicas se obtienen siempre de la NVI. Se puede ampliar el banco sin cambiar el algoritmo. Cada recurso puede desactivarse con enabled:false o conservar selección manual con automatic:false en content-config.json.

Pruebas: node scripts/check-resources-calendar.cjs. Verifican medianoche, períodos de dos días, lunes, cambio de año, horario de verano, contenido estable y configuración sin caché.
