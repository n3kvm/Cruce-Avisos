# Configuracion SharePoint espejo

El backend puede consultar el sitio espejo completo siempre que la App Registration tenga permiso para leerlo.

## Variables principales

Desde una URL de SharePoint como esta:

```text
https://brillaseo2.sharepoint.com/sites/SoportesEspejo/Shared%20Documents/Forms/AllItems.aspx
```

configura:

```env
SITE_HOST=brillaseo2.sharepoint.com
SITE_PATH=/sites/SoportesEspejo
DRIVE_NAME=Shared Documents
FOLDER_PATH=
```

Con `FOLDER_PATH` vacio, el backend lee recursivamente toda la biblioteca `Shared Documents`, incluyendo carpetas como:

- `Soportes`
- `Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez`

Si quieres limitar la consulta a una sola carpeta, usa:

```env
FOLDER_PATH=Soportes
```

o:

```env
FOLDER_PATH=Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez
```

## Permisos requeridos

La App Registration debe tener permiso para leer ese sitio. Opciones comunes:

- `Files.Read.All` delegado.
- `Sites.Read.All` delegado o de aplicacion.
- `Sites.Selected` si el administrador solo autoriza este sitio especifico.

## Prueba rapida

Despues de iniciar el backend, abre:

```text
http://127.0.0.1:8765/api/status
```

Debe responder algo parecido a:

```json
{
  "ok": true,
  "mode": "graph",
  "site": "brillaseo2.sharepoint.com/sites/SoportesEspejo",
  "folder": ""
}
```
