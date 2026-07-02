@echo off
echo Este modo crea una URL temporal trycloudflare.com para pruebas.
echo Debes tener cloudflared instalado y el backend encendido en http://127.0.0.1:8765
echo.
cloudflared tunnel --url http://127.0.0.1:8765
pause
