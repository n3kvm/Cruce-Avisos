# Montaje en Cloudflare Dashboard

Cuenta Cloudflare:

```text
https://dash.cloudflare.com/0fbf6a60c3d6e75ec77340e0a9dad2e6/home
```

## Objetivo

Publicar el backend local:

```text
http://127.0.0.1:8765
```

por una URL publica de Cloudflare, por ejemplo:

```text
https://avisos.tudominio.com
```

## 1. Levantar el backend local

En la carpeta del proyecto ejecuta:

```powershell
.\run_backend_cloudflare.bat
```

Valida en el navegador:

```text
http://127.0.0.1:8765/api/status
```

Debe responder:

```json
{"ok": true}
```

## 2. Crear el tunnel en Cloudflare

Entra al dashboard:

```text
https://dash.cloudflare.com/0fbf6a60c3d6e75ec77340e0a9dad2e6/home
```

Luego ve a:

```text
Zero Trust > Networks > Tunnels
```

Si no aparece Zero Trust, abre:

```text
https://one.dash.cloudflare.com/
```

Pasos:

1. Clic en `Create a tunnel`.
2. Selecciona `Cloudflared`.
3. Nombre sugerido:

```text
cruce-avisos-backend
```

4. Selecciona sistema operativo `Windows`.
5. Copia el comando que Cloudflare muestra para instalar/ejecutar `cloudflared`.
6. Ejecuta ese comando en PowerShell en el equipo donde corre el backend.

## 3. Crear el Public Hostname

Dentro del tunnel, agrega un `Public Hostname`.

Configura:

```text
Subdomain: avisos
Domain: tu dominio en Cloudflare
Path: dejar vacio
Type: HTTP
URL: 127.0.0.1:8765
```

Debe quedar algo como:

```text
https://avisos.tudominio.com -> http://127.0.0.1:8765
```

## 4. Probar backend publicado

Abre:

```text
https://avisos.tudominio.com/api/status
```

Debe responder:

```json
{
  "ok": true,
  "mode": "graph",
  "site": "brillaseo2.sharepoint.com/sites/SoportesEspejo",
  "folder": ""
}
```

## 5. Conectar GitHub Pages al backend

Edita:

```text
dashboard_html/config.js
```

y coloca:

```js
window.BACKEND_URL = "https://avisos.tudominio.com";
```

Despues sube el cambio a GitHub:

```powershell
git add dashboard_html/config.js
git commit -m "Configurar backend Cloudflare"
git push
```

## 6. Opcion sin GitHub Pages

Tambien puedes abrir directamente:

```text
https://avisos.tudominio.com
```

El backend sirve el dashboard desde `dashboard_html`, asi que Cloudflare puede publicar todo desde la misma URL.

## Recomendacion

Para uso estable:

- Deja `run_backend_cloudflare.bat` o el backend Python como tarea programada/servicio.
- Deja `cloudflared` instalado como servicio de Windows.
- No cierres la sesion del equipo si el backend no esta instalado como servicio.
