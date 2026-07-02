# Backend cloud en Cloudflare Workers

Esta opcion deja el backend corriendo en la nube de Cloudflare. No depende de un PC encendido.

## Que cambia frente al Tunnel

- Tunnel: publica un backend Python que corre en tu PC.
- Worker: ejecuta el backend directamente en Cloudflare.

Para Worker se usa Microsoft Graph con permisos de aplicacion, por eso necesitas un `CLIENT_SECRET` en la App Registration.

## Requisitos Microsoft Entra ID

En la App Registration:

1. Crea un secreto en `Certificados y secretos`.
2. Copia el valor del secreto una sola vez.
3. En `Permisos de API`, deja permisos de aplicacion para leer SharePoint:
   - `Sites.Read.All`, o
   - `Files.Read.All`, o
   - `Sites.Selected` si el admin solo autoriza el sitio espejo.
4. El administrador debe conceder consentimiento.

El Worker usa flujo `client_credentials` contra:

```text
https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token
```

## Archivos del Worker

```text
worker/
  package.json
  wrangler.toml
  src/index.js
```

Endpoints:

```text
GET  /api/status
POST /api/cruce
```

El endpoint `/api/cruce` recibe `AVISOS.xlsx`, consulta el SharePoint espejo y devuelve la data al dashboard.

## Variables configuradas

En `worker/wrangler.toml` quedan variables no sensibles:

```toml
TENANT_ID = "organizations"
SITE_HOST = "brillaseo2.sharepoint.com"
SITE_PATH = "/sites/SoportesEspejo"
DRIVE_NAME = "Shared Documents"
FOLDER_PATH = ""
MAX_FILES = "500"
```

## Secretos de Cloudflare

Desde la carpeta `worker/` ejecuta:

```powershell
npm install
npx wrangler login
npx wrangler secret put CLIENT_ID
npx wrangler secret put CLIENT_SECRET
```

Pega el valor cuando Wrangler lo pida.

## Probar local

```powershell
cd worker
npm install
npm run dev
```

Prueba:

```text
http://127.0.0.1:8787/api/status
```

## Publicar

```powershell
cd worker
npm run deploy
```

Cloudflare entregara una URL parecida a:

```text
https://cruce-avisos-backend.tu-subdominio.workers.dev
```

## No reutilizar un Worker existente

Si ya tienes un Worker usado por otra aplicacion, por ejemplo:

```text
indicadordocumental
```

no pegues este codigo encima. Ese Worker ya tiene rutas y secretos propios para disparar workflows de GitHub, y se podria romper.

Para este proyecto crea un Worker nuevo con nombre:

```text
cruce-avisos-backend
```

Ese nombre ya esta configurado en:

```text
worker/wrangler.toml
```

La URL quedara parecida a:

```text
https://cruce-avisos-backend.TU_SUBDOMINIO.workers.dev
```

## Conectar el dashboard

Edita:

```text
dashboard_html/config.js
```

y coloca:

```js
window.BACKEND_URL = "https://cruce-avisos-backend.tu-subdominio.workers.dev";
```

Luego sube el cambio a GitHub.

## Nota sobre archivos grandes

El Worker escanea los Excel del SharePoint en vivo. Si el espejo crece demasiado, se puede optimizar luego con:

- R2 para guardar indice de hallazgos.
- KV o D1 para cachear resultados.
- Cron Trigger para reindexar programado.

La primera version queda simple: cargar `AVISOS.xlsx`, consultar SharePoint y devolver el cruce.
