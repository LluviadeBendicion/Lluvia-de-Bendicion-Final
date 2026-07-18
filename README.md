# Lluvia de Bendición .Com — Launch Edition Final

Proyecto estático preparado para GitHub y Vercel.

## Carpetas principales
- `/api`: funciones seguras del servidor.
- `/estudio`: estudios bíblicos.
- `/assets`: logo, iconos y wallpapers.
- `/admin`: prototipo del panel privado.
- `/donaciones`, `/videos`, `/wallpapers`: carpetas creadas para que aparezcan en GitHub.

## Publicar
1. Sube todo el contenido de esta carpeta a la raíz del repositorio.
2. En Vercel, importa el repositorio.
3. Framework Preset: **Other**.
4. Build Command: vacío.
5. Output Directory: vacío.
6. Edita `config.js` para añadir el stream HTTPS y enlaces públicos.
7. No pongas contraseñas, correos privados ni tokens en `config.js`.

## Radio
Pega en `config.js` la URL HTTPS directa del stream. Una página web no puede detectar automáticamente ZaraRadio si el proveedor no expone un endpoint público; el diseño ya admite los estados En vivo, Programación y Fuera del aire.

## Acceso oculto
Presiona cinco veces el pequeño diamante del footer para abrir el enlace administrativo.
