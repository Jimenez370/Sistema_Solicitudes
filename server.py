"""Servidor Web y API ligera para el Sistema Universitario (SICOU_IA).
Sirve los archivos de Frontend y expone endpoints para Login y Registro conectados a PostgreSQL.
"""

import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.join(_DIR, "Frontend")

# Intentar importar la capa de base de datos
try:
    import conexion
except ImportError:
    conexion = None


class CustomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Servir archivos estáticos desde la carpeta Frontend
        super().__init__(*args, directory=_FRONTEND_DIR, **kwargs)

    def _responder_json(self, status_code: int, datos: dict):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(json.dumps(datos, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        """Manejo de pre-flight CORS."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)

        # Redirigir la raíz al login
        if url.path == "/" or url.path == "":
            self.send_response(302)
            self.send_header("Location", "/pages/login.html")
            self.end_headers()
            return

        # Endpoint API: Obtener facultades
        if url.path == "/api/facultades":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de conexión no disponible"})
            try:
                facultades = conexion.obtener_facultades()
                return self._responder_json(200, {"facultades": facultades})
            except Exception as e:
                return self._responder_json(500, {"error": str(e)})

        # Servir archivos estáticos normalmente
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        cuerpo = self.rfile.read(content_length)

        try:
            datos = json.loads(cuerpo.decode("utf-8")) if cuerpo else {}
        except Exception:
            return self._responder_json(400, {"error": "Formato JSON inválido"})

        # Endpoint API: Registro de usuario
        if url.path == "/api/registro":
            if not conexion:
                return self._responder_json(500, {"error": "psycopg2 no instalado. Ejecuta: pip install psycopg2-binary"})

            nombre = datos.get("nombre")
            correo = datos.get("correo")
            contrasena = datos.get("contrasena")
            facultad_id = datos.get("facultad_id")

            if not all([nombre, correo, contrasena, facultad_id]):
                return self._responder_json(400, {"error": "Todos los campos son obligatorios"})

            ok, mensaje = conexion.registrar_usuario(nombre, correo, contrasena, int(facultad_id))
            return self._responder_json(200 if ok else 400, {"ok": ok, "mensaje": mensaje})

        # Endpoint API: Login de usuario
        if url.path == "/api/login":
            if not conexion:
                return self._responder_json(500, {"error": "psycopg2 no instalado. Ejecuta: pip install psycopg2-binary"})

            correo = datos.get("correo")
            contrasena = datos.get("contrasena")
            facultad_id = datos.get("facultad_id")

            if not all([correo, contrasena, facultad_id]):
                return self._responder_json(400, {"error": "Correo, contraseña y facultad son requeridos"})

            ok, usuario, mensaje = conexion.autenticar_usuario(correo, contrasena, int(facultad_id))
            if ok:
                return self._responder_json(200, {"ok": True, "mensaje": mensaje, "usuario": usuario})
            else:
                return self._responder_json(401, {"ok": False, "mensaje": mensaje})

        return self._responder_json(404, {"error": "Ruta no encontrada"})


def iniciar_servidor(puerto: int = 8000):
    servidor = HTTPServer(("0.0.0.0", puerto), CustomHandler)
    print(f"============================================================")
    print(f"🚀 Servidor SICOU_IA iniciado exitosamente")
    print(f"👉 Abre en tu navegador: http://localhost:{puerto}/pages/login.html")
    print(f"============================================================")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        servidor.server_close()


if __name__ == "__main__":
    puerto = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        puerto = int(sys.argv[1])
    iniciar_servidor(puerto)
