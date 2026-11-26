# Lecturas NVI

Biblia, concordancia, versículo del día, memorización, devocionales, estudios y sermones consultan `/api/bible`. No se sustituyen textos por otra traducción cuando la NVI no responde.

El servidor usa `API_BIBLE_KEY`, guardada como variable del entorno de Vercel. Su cuenta de API.Bible debe tener acceso autorizado a una edición española NVI. El identificador se descubre en el catálogo del proveedor; no se usa la NIV inglesa ni otra Reina-Valera. No publicar claves en código ni en el navegador.

Los campos `reference` de `api/content-config.json` eligen las lecturas de cada recurso. El texto de reflexión se mantiene separado del pasaje, que se obtiene de la NVI junto con el crédito del proveedor. Los textos guardados antes para el versículo diario y de memorización se han eliminado para evitar mezclar traducciones. No se cambia automáticamente la referencia diaria: se sigue la selección editorial del panel.

Verificación local: `node scripts/check-bible.cjs`. Estas pruebas simulan API.Bible y verifican rutas, edición, referencias y errores. Para verificar el servicio real, desplegar y consultar `/api/bible?ref=JHN.3.16` y `/api/bible?q=esperanza`; ambos deben responder con `version: "NVI"`. Después comprobar los recursos en el navegador.

Si falta acceso a la NVI, la interfaz muestra el error y no presenta otra versión como si fuera NVI. Leer gratis en otra plataforma no confirma permisos de API para esta cuenta.
