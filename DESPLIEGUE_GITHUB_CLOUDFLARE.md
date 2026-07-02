# Despliegue GitHub + Cloudflare Worker

Este proyecto tiene dos partes:

```text
GitHub Pages -> dashboard_html
Cloudflare Worker -> worker
```

El dashboard visual vive en GitHub Pages. El backend que consulta SharePoint vive en Cloudflare Workers.

## 1. Crear repositorio en GitHub

Desde la carpeta del proyecto:

```powershell
cd "D:\Datos\OneDrive - BRILLASEO SAS\Documentos\SEGUIMIENTO ENTREGA DOCUMENTAL\cruce-avisos-github"
git init
git add .
git commit -m "Dashboard cruce avisos con backend Cloudflare Worker"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## 2. Activar GitHub Pages

En GitHub:

1. Entra al repositorio.
2. Ve a `Settings`.
3. Ve a `Pages`.
4. En `Build and deployment`, selecciona `GitHub Actions`.
5. El workflow `.github/workflows/pages.yml` publicara `dashboard_html`.

La URL sera parecida a:

```text
https://TU_USUARIO.github.io/TU_REPO/
```

## 3. Crear App Registration en Microsoft Entra

La App Registration debe poder leer el SharePoint espejo.

Configura permisos de Microsoft Graph tipo `Aplicacion`:

```text
Sites.Read.All
```

o:

```text
Files.Read.All
```

Si la empresa quiere limitarlo solo al sitio espejo, usar:

```text
Sites.Selected
```

Luego un administrador debe dar `Conceder consentimiento de administrador`.

Tambien crea un secreto en:

```text
Certificados y secretos > Nuevo secreto de cliente
```

Guarda:

```text
CLIENT_ID
CLIENT_SECRET
TENANT_ID
```

## 4. Crear el Worker en Cloudflare

No uses un Worker existente que ya pertenezca a otra aplicacion. Si tienes uno llamado `indicadordocumental`, dejalo quieto.

Este proyecto debe usar un Worker nuevo:

```text
cruce-avisos-backend
```

Desde tu equipo:

```powershell
cd "D:\Datos\OneDrive - BRILLASEO SAS\Documentos\SEGUIMIENTO ENTREGA DOCUMENTAL\cruce-avisos-github\worker"
npm install
npx wrangler login
```

Luego configura secretos del Worker:

```powershell
npx wrangler secret put CLIENT_ID
npx wrangler secret put CLIENT_SECRET
```

Cuando pregunte el valor, pega cada dato.

Publica:

```powershell
npm run deploy
```

Cloudflare entregara una URL parecida a:

```text
https://cruce-avisos-backend.TU_SUBDOMINIO.workers.dev
```

Prueba:

```text
https://cruce-avisos-backend.TU_SUBDOMINIO.workers.dev/api/status
```

Debe responder con:

```json
{
  "ok": true,
  "mode": "cloudflare-worker"
}
```

## 5. Conectar frontend con backend

Edita:

```text
dashboard_html/config.js
```

Coloca la URL del Worker:

```js
window.BACKEND_URL = "https://cruce-avisos-backend.TU_SUBDOMINIO.workers.dev";
```

Sube el cambio:

```powershell
git add dashboard_html/config.js
git commit -m "Conectar dashboard con backend Worker"
git push
```

GitHub Pages se actualizara automaticamente.

## 6. Configurar despliegue automatico del Worker desde GitHub

En Cloudflare necesitas crear un API Token.

En Cloudflare:

1. Ve a `My Profile`.
2. Entra a `API Tokens`.
3. Crea un token.
4. Permisos recomendados:

```text
Account > Workers Scripts > Edit
Account > Account Settings > Read
```

Tambien necesitas el Account ID de Cloudflare.

En GitHub:

1. Entra al repositorio.
2. Ve a `Settings`.
3. Ve a `Secrets and variables > Actions`.
4. Crea estos `Repository secrets`:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

El workflow `.github/workflows/worker.yml` publicara el Worker cuando cambie algo dentro de `worker/`.

## 7. Variables del Worker

Las variables no sensibles ya estan en:

```text
worker/wrangler.toml
```

Valores actuales:

```toml
TENANT_ID = "organizations"
SITE_HOST = "brillaseo2.sharepoint.com"
SITE_PATH = "/sites/SoportesEspejo"
DRIVE_NAME = "Shared Documents"
FOLDER_PATH = "Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez"
MAX_FILES = "500"
```

Si quieres usar un tenant fijo, cambia:

```toml
TENANT_ID = "organizations"
```

por el ID real del tenant.

## 8. Flujo final

```text
Usuario abre GitHub Pages
        |
        v
Dashboard carga AVISOS.xlsx
        |
        v
Cloudflare Worker recibe el Excel
        |
        v
Microsoft Graph consulta SharePoint espejo
        |
        v
Dashboard muestra montados, pendientes y duplicados
```
