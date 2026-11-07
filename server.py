"""Servidor Web y API para el Sistema Universitario (SICOU_IA).
Sirve los archivos de Frontend y conecta la interfaz con el Agente Inteligente y PostgreSQL.
"""

import datetime
import decimal
import json
import os
import sys
import secrets
import threading
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

#sesiones activas de los usuarios
sesiones = {}

#proteccion para el acceso a las sesiones
#Cada sesión tendrá asociado un token y la información del usuario autenticado.
sesiones_lock = threading.Lock()

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

    def _obtener_usuario_sesion(self):
        """Obtiene la información del usuario autenticado a partir del token de sesión."""
        encabezado = self.headers.get("Authorization", "")

        if not encabezado.startswith("Bearer "):
            return None

        token = encabezado.replace("Bearer ", "", 1).strip()

        with sesiones_lock:
            return sesiones.get(token)

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

        # Endpoint API: Consultar solicitudes dependiendo el rol del usuario
        if url.path == "/api/solicitudes":

            if not conexion:
                return self._responder_json(
                    500,
                    {"error": "Módulo de base de datos no disponible"}
                )

            # 1. Identificar al usuario mediante su token
            usuario = self._obtener_usuario_sesion()

            if not usuario:
                return self._responder_json(
                    401,
                    {"ok": False, "error": "Sesión no válida. Inicia sesión nuevamente."}
                )

            rol = usuario["rol"]
            usuario_id = usuario["id"]
            departamento_id = usuario.get("departamento_id")

            # 2. Obtener el estado solicitado (si existe)
            estado = params.get("estado", [None])[0]

            # 3. Determinar qué solicitudes puede consultar
            if rol == "administrador":

                # El administrador puede consultar todas
                solicitudes = conexion.obtener_solicitudes(
                    estado=estado
                )

                estadisticas = conexion.obtener_estadisticas_solicitudes()

            elif rol == "gerente_area":

                # El gerente solamente puede consultar su departamento
                if departamento_id is None:
                    return self._responder_json(
                        403,
                        {"ok": False, "error": "El gerente no tiene un departamento asignado."}
                    )

                solicitudes = conexion.obtener_solicitudes(
                    departamento_id=int(departamento_id),
                    estado=estado
                )

                estadisticas = conexion.obtener_estadisticas_solicitudes(
                    departamento_id=int(departamento_id)
                )

            elif rol == "estudiante":

                # El estudiante solamente consulta sus propias solicitudes
                solicitudes = conexion.obtener_solicitudes(
                    usuario_id=int(usuario_id),
                    estado=estado
                )

                estadisticas = conexion.obtener_estadisticas_solicitudes(
                    usuario_id=int(usuario_id)
                )

            else:
                return self._responder_json(
                    403,
                    {"ok": False, "error": "No tienes permisos para consultar solicitudes."}
                )

            # 4. Enviar resultados al frontend
            return self._responder_json(
                200,
                {
                    "ok": True,
                    "solicitudes": solicitudes,
                    "estadisticas": estadisticas
                }
            )

        # Si no es una ruta API, entregar el archivo estático
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
                #generar token de sesion
                token = secrets.token_urlsafe(32)

                #guardar la sesion
                datos_sesion = {
                    "id": usuario["id"],
                    "nombre": usuario["nombre"],
                    "correo": usuario["correo"],
                    "rol": str(usuario["rol"]).lower(),
                    "departamento_id": usuario.get("departamento_id")
                }

                with sesiones_lock:
                    sesiones[token] = datos_sesion

                return self._responder_json(
                    200,
                    {
                        "ok": True,
                        "mensaje": mensaje,
                        "token": token,
                        "usuario": usuario
                    }
                )
            else:
                return self._responder_json(
                    401,
                    {"ok": False, "mensaje": mensaje}
                )

            
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
        
        # Endpoint API: Crear solicitud, procesar con IA y guardar en PostgreSQL
        if url.path == "/api/solicitudes":
            if not conexion:
                return self._responder_json(
                    500,
                    {"ok": False, "error": "Módulo de base de datos no disponible"}
                )

            if not agente_ia:
                return self._responder_json(
                    500,
                    {"ok": False, "error": "Agente inteligente no disponible"}
                )

            # 1. Identificar al usuario mediante su token
            usuario = self._obtener_usuario_sesion()

            if not usuario:
                return self._responder_json(
                    401,
                    {"ok": False, "error": "Sesión no válida. Inicia sesión nuevamente."}
                )

            # 2. Solo los estudiantes pueden enviar solicitudes
            rol = usuario["rol"]

            if rol not in ("estudiante", "usuario"):
                return self._responder_json(
                    403,
                    {"ok": False, "error": "No tienes permisos para enviar solicitudes."}
                )

            # 3. Obtener los datos
            descripcion = (datos.get("descripcion") or "").strip()

            if not descripcion:
                return self._responder_json(
                    400,
                    {"ok": False, "error": "La descripción de la solicitud es obligatoria."}
                )

            # El ID se obtiene de la sesión, nunca del navegador
            usuario_id = usuario["id"]

            try:
                # 4. Procesar la solicitud con el agente inteligente
                resultado = agente_ia.procesar(descripcion)

                # 5. Guardar en PostgreSQL
                ok, mensaje, solicitud_id = conexion.guardar_solicitud(
                    int(usuario_id),
                    resultado
                )

                if not ok:
                    return self._responder_json(
                        500,
                        {"ok": False, "error": mensaje}
                    )

                # 6. Responder al frontend
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
                print(f"Error al procesar solicitud: {e}")
                return self._responder_json(
                    500,
                    {"ok": False, "error": f"Error al procesar solicitud: {str(e)}"}
                )

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
