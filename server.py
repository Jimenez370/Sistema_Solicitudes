"""Servidor Web y API para el Sistema Universitario (SICOU_IA).
Sirve los archivos de Frontend y conecta la interfaz con el Agente Inteligente y PostgreSQL.
"""

import datetime
import decimal
import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.join(_DIR, "Frontend")

# Intentar importar la capa de base de datos
try:
    import conexion
except ImportError:
    conexion = None

# Importar el agente inteligente de IA
try:
    from agente import AgenteSolicitudes
    print("Entrenando y cargando modelo de Machine Learning y reglas en memoria...")
    agente_ia = AgenteSolicitudes()
    print("Agente Inteligente listo para procesar solicitudes.")
except Exception as e:
    print(f"⚠️ No se pudo inicializar el agente de IA: {e}")
    agente_ia = None


def serializador_json(obj):
    """Convierte tipos no serializables nativamente por JSON (Decimal, datetime) a tipos válidos."""
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    return str(obj)


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
        self.wfile.write(json.dumps(datos, default=serializador_json, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        """Manejo de pre-flight CORS."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        params = parse_qs(url.query)

        # Redirigir la raíz al login
        if url.path == "/" or url.path == "":
            self.send_response(302)
            self.send_header("Location", "/pages/login.html")
            self.end_headers()
            return

        # Endpoint API: Obtener facultades
        if url.path == "/api/facultades":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})
            try:
                facultades = conexion.obtener_facultades()
                return self._responder_json(200, {"facultades": facultades})
            except Exception as e:
                return self._responder_json(500, {"error": str(e)})

        # Endpoint API: Consultar solicitudes
        if url.path == "/api/solicitudes":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})

            usuario_id = params.get("usuario_id", [None])[0]
            estado = params.get("estado", [None])[0]
            depto_id = params.get("departamento_id", [None])[0]

            solicitudes = conexion.obtener_solicitudes(
                usuario_id=int(usuario_id) if usuario_id else None,
                departamento_id=int(depto_id) if depto_id else None,
                estado=estado,
            )
            estadisticas = conexion.obtener_estadisticas_solicitudes(
                usuario_id=int(usuario_id) if usuario_id else None
            )

            return self._responder_json(
                200, {"ok": True, "solicitudes": solicitudes, "estadisticas": estadisticas}
            )

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

        # Endpoint API: Análisis en tiempo real con IA (sin guardar en BD aún)
        if url.path == "/api/analizar":
            texto = datos.get("texto", "").strip()
            if not texto:
                return self._responder_json(400, {"error": "El texto a analizar es requerido"})

            if not agente_ia:
                return self._responder_json(500, {"error": "Agente IA no disponible en el servidor"})

            try:
                res = agente_ia.procesar(texto)
                return self._responder_json(
                    200,
                    {
                        "ok": True,
                        "categoria": res.categoria,
                        "prioridad": res.prioridad,
                        "canal": res.canal,
                        "confianza": float(res.confianza) if hasattr(res, "confianza") else 0.8,
                        "alerta_supervisor": res.alerta_supervisor,
                        "motivo_alerta": res.motivo_alerta,
                        "palabras_clave": res.palabras_clave,
                    },
                )
            except Exception as e:
                return self._responder_json(500, {"error": f"Error en análisis IA: {str(e)}"})

        # Endpoint API: Crear solicitud, procesar con IA y guardar en PostgreSQL
        if url.path == "/api/solicitudes":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})

            if not agente_ia:
                return self._responder_json(500, {"error": "Agente inteligente no disponible"})

            descripcion = datos.get("descripcion", "").strip()
            usuario_id = datos.get("usuario_id")

            if not descripcion or not usuario_id:
                return self._responder_json(400, {"error": "La descripción y el usuario son obligatorios"})

            try:
                # 1. Ejecutar el agente inteligente híbrido (ML + Reglas + Ontología)
                resultado = agente_ia.procesar(descripcion)

                # 2. Guardar el resultado en la tabla solicitudes de PostgreSQL
                ok, mensaje, solicitud_id = conexion.guardar_solicitud(int(usuario_id), resultado)

                if not ok:
                    return self._responder_json(500, {"error": mensaje})

                # 3. Retornar confirmación y datos clasificados al frontend
                return self._responder_json(
                    201,
                    {
                        "ok": True,
                        "solicitud_id": solicitud_id,
                        "mensaje": mensaje,
                        "analisis": {
                            "categoria": resultado.categoria,
                            "prioridad": resultado.prioridad,
                            "canal": resultado.canal,
                            "confianza": float(resultado.confianza),
                            "alerta_supervisor": resultado.alerta_supervisor,
                            "motivo_alerta": resultado.motivo_alerta,
                        },
                    },
                )
            except Exception as e:
                return self._responder_json(500, {"error": f"Error al procesar solicitud: {str(e)}"})

        # Endpoint API: Actualizar estado de solicitud (por el administrador)
        if url.path == "/api/solicitudes/estado":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})

            solicitud_id = datos.get("solicitud_id")
            nuevo_estado = datos.get("estado")

            if not solicitud_id or not nuevo_estado:
                return self._responder_json(400, {"error": "solicitud_id y estado son requeridos"})

            ok, mensaje = conexion.actualizar_estado_solicitud(int(solicitud_id), nuevo_estado)
            return self._responder_json(200 if ok else 400, {"ok": ok, "mensaje": mensaje})

        return self._responder_json(404, {"error": "Ruta no encontrada"})


def iniciar_servidor(puerto: int = 8000):
    servidor = HTTPServer(("0.0.0.0", puerto), CustomHandler)
    print("============================================================")
    print("🚀 Servidor SICOU_IA iniciado exitosamente")
    print(f"Abre en tu navegador: http://localhost:{puerto}/pages/login.html")
    print("============================================================")
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
