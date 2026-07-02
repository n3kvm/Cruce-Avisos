# Dashboard de cruce de avisos

Dashboard web para cruzar un archivo `AVISOS.xlsx` contra soportes/cotizaciones almacenadas en un SharePoint espejo mediante Microsoft Graph.

## Estructura

- `dashboard_html/`: frontend listo para GitHub Pages.
- `backend_graph.py`: backend Python que consulta Microsoft Graph y sirve el dashboard si se ejecuta localmente.
- `cruce_avisos_local.py`: cruce alterno contra una carpeta sincronizada localmente.
- `powerbi/`: generacion de CSV auxiliares.
- `.env.example`: variables que debes copiar a `.env` en el backend.
- `.env.sharepoint-espejo.example`: ejemplo especifico para el SharePoint espejo.
- `SHAREPOINT_ESPEJO.md`: guia para configurar `SITE_HOST`, `SITE_PATH`, `DRIVE_NAME` y `FOLDER_PATH`.
- `CLOUDFLARE_TUNNEL.md`: guia para publicar el backend con Cloudflare Tunnel.
- `CLOUDFLARE_DASHBOARD_PASO_A_PASO.md`: pasos especificos para montarlo desde el dashboard de Cloudflare.
- `CLOUDFLARE_WORKER_BACKEND.md`: backend cloud en Cloudflare Workers, sin depender de un PC encendido.
- `DESPLIEGUE_GITHUB_CLOUDFLARE.md`: pasos completos para GitHub Pages + Cloudflare Worker.
- `.github/workflows/pages.yml`: publicacion automatica del frontend en GitHub Pages.

## Lo que no se sube

No subas tokens, caches ni archivos de datos reales. El `.gitignore` excluye `.env`, tokens, Excel, `data/`, `soportes/`, `salidas/` y CSV generados.

## Configurar SharePoint espejo

Si la URL del sitio es similar a:

```text
https://brillaseo2.sharepoint.com/sites/SoportesEspejo/Shared%20Documents/Forms/AllItems.aspx
```

configura el backend asi:

```env
SITE_HOST=brillaseo2.sharepoint.com
SITE_PATH=/sites/SoportesEspejo
DRIVE_NAME=Shared Documents
FOLDER_PATH=
```

`FOLDER_PATH` vacio significa: consultar toda la biblioteca `Shared Documents` de forma recursiva. Si solo quieres leer una carpeta, coloca el nombre exacto:

```env
FOLDER_PATH=Soportes
```

## Configurar Microsoft Graph

En Microsoft Entra ID, la App Registration debe tener permiso para leer los archivos del SharePoint espejo:

- `Files.Read.All` delegado, o
- `Sites.Read.All` / `Sites.Selected` segun la politica del tenant.

Luego copia `.env.sharepoint-espejo.example` como `.env` en el servidor donde corra el backend y ajusta:

```env
CLIENT_ID=tu-client-id
TENANT_ID=organizations
SITE_HOST=brillaseo2.sharepoint.com
SITE_PATH=/sites/SoportesEspejo
DRIVE_NAME=Shared Documents
FOLDER_PATH=
```

## Ejecutar backend local

En Windows:

```powershell
cd ruta\del\repo
copy .env.sharepoint-espejo.example .env
.\run_backend.bat
```

El backend quedara en:

```text
http://127.0.0.1:8765
```

Si lo vas a usar por red interna, configura:

```env
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8765
```

y abre en el firewall el puerto `8765`.

## Configurar frontend

Edita `dashboard_html/config.js`:

```js
window.BACKEND_URL = "https://url-de-tu-backend";
```

Para pruebas locales puede quedar:

```js
window.BACKEND_URL = "http://127.0.0.1:8765";
```

Si el dashboard se abre desde el mismo backend, puedes dejarlo vacio:

```js
window.BACKEND_URL = "";
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube esta carpeta completa.
3. En GitHub, entra a `Settings > Pages`.
4. En `Build and deployment`, selecciona `GitHub Actions`.
5. Haz push a la rama `main`.
6. El workflow `Publicar dashboard` publicara `dashboard_html/`.

## Backend en nube

GitHub Pages no ejecuta Python. Para que el boton `Actualizar cruce` y `Cargar AVISOS.xlsx` consulten SharePoint, el backend debe estar publicado en un servicio aparte.

Opciones viables:

- Cloudflare Workers usando `worker/`.
- Azure App Service.
- Render, Railway o Fly.io usando `Dockerfile` o `Procfile`.
- Servidor propio con Python.
- Equipo local + Cloudflare Tunnel si quieres exponer temporalmente el backend sin abrir puertos.

Cuando tengas la URL publica del backend, ponla en `dashboard_html/config.js`.

Para backend cloud en Cloudflare Workers, revisa `CLOUDFLARE_WORKER_BACKEND.md`.
Para Cloudflare Tunnel, revisa `CLOUDFLARE_TUNNEL.md`.

## Comandos Git

```powershell
git init
git add .
git commit -m "Dashboard cruce de avisos"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```
