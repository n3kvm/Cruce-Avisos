# Backend con Cloudflare Tunnel

Cloudflare Tunnel publica el backend Python sin abrir puertos en el router. El backend queda local en:

```text
http://127.0.0.1:8765
```

y Cloudflare entrega una URL publica, por ejemplo:

```text
https://avisos.tudominio.com
```

## Flujo recomendado

```text
Usuario
  -> GitHub Pages o URL Cloudflare
  -> Backend por Cloudflare Tunnel
  -> Microsoft Graph
  -> SharePoint Soportes Espejo
```

## 1. Configurar el backend

Copia el archivo de ejemplo:

```powershell
copy .env.sharepoint-espejo.example .env
```

Edita `.env` y confirma:

```env
CLIENT_ID=tu-client-id
TENANT_ID=organizations
SITE_HOST=brillaseo2.sharepoint.com
SITE_PATH=/sites/SoportesEspejo
DRIVE_NAME=Shared Documents
FOLDER_PATH=
```

Para Cloudflare, el backend debe escuchar localmente:

```env
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8765
```

Tambien puedes usar el script:

```powershell
.\run_backend_cloudflare.bat
```

## 2. Prueba rapida con URL temporal

Instala `cloudflared` y luego ejecuta:

```powershell
.\run_backend_cloudflare.bat
```

En otra ventana:

```powershell
.\run_cloudflare_quick_tunnel.bat
```

Cloudflare mostrara una URL temporal tipo:

```text
https://algo.trycloudflare.com
```

Prueba:

```text
https://algo.trycloudflare.com/api/status
```

## 3. Configuracion estable con dominio

En Cloudflare Zero Trust:

1. Entra a `Networks > Connectors > Cloudflare Tunnels`.
2. Crea un tunnel nuevo.
3. Selecciona `cloudflared`.
4. Instala/ejecuta el conector en el equipo donde corre el backend.
5. Agrega una aplicacion publicada:
   - Subdomain: `avisos`
   - Domain: tu dominio en Cloudflare
   - Type: `HTTP`
   - URL: `localhost:8765`

Cloudflare recomienda crear el tunnel desde el dashboard, instalar `cloudflared`, ejecutar el comando que entrega el panel y luego publicar la aplicacion con servicio `localhost:PUERTO`.

## 4. Si usas GitHub Pages

Edita:

```text
dashboard_html/config.js
```

y coloca la URL publica del tunnel:

```js
window.BACKEND_URL = "https://avisos.tudominio.com";
```

Luego sube el cambio a GitHub.

## 5. Si usas solo Cloudflare

Tambien puedes abrir directamente:

```text
https://avisos.tudominio.com
```

En ese caso Cloudflare expone el backend, y el backend sirve tambien el dashboard HTML. No necesitas GitHub Pages para operar.

## 6. Mantenerlo encendido

Para pruebas, basta con dejar abiertas dos ventanas:

1. `run_backend_cloudflare.bat`
2. `cloudflared tunnel run ...` o `run_cloudflare_quick_tunnel.bat`

Para produccion, instala `cloudflared` como servicio de Windows y deja el backend corriendo tambien como servicio o tarea programada.
