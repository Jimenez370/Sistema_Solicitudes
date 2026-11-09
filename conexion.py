"""Módulo de conexión y operaciones con la base de datos PostgreSQL (SICOU_IA)."""

import hashlib
import json
import os
from typing import Any, Optional

# Cargar variables desde .env sin depender obligatoriamente de librerías externas
_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_PATH = os.path.join(_DIR, ".env")


def _cargar_env() -> dict[str, str]:
    config = {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "SICOU_IA",
        "DB_USER": "postgres",
        "DB_PASSWORD": "12345",
    }
    if os.path.exists(_ENV_PATH):
        with open(_ENV_PATH, "r", encoding="utf-8") as f:
            for linea in f:
                linea = linea.strip()
                if linea and not linea.startswith("#") and "=" in linea:
                    clave, valor = linea.split("=", 1)
                    config[clave.strip()] = valor.strip()
    # Permitir que las variables del sistema tengan prioridad si existen
    for k in config:
        if k in os.environ:
            config[k] = os.environ[k]
    return config


CONFIG_DB = _cargar_env()


def get_connection():
    """Crea y retorna una nueva conexión a la base de datos PostgreSQL."""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError:
        raise ImportError(
            "La librería 'psycopg2' no está instalada. Ejecuta: pip install psycopg2-binary"
        )

    return psycopg2.connect(
        host=CONFIG_DB["DB_HOST"],
        port=CONFIG_DB["DB_PORT"],
        dbname=CONFIG_DB["DB_NAME"],
        user=CONFIG_DB["DB_USER"],
        password=CONFIG_DB["DB_PASSWORD"],
        cursor_factory=RealDictCursor,
    )


def hashear_password(password: str) -> str:
    """Hashea la contraseña con SHA-256."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def inicializar_tablas():
    """Ejecuta el script SQL para crear las tablas, roles, facultades y el primer administrador."""
    ruta_schema = os.path.join(_DIR, "database", "schema.sql")
    if not os.path.exists(ruta_schema):
        raise FileNotFoundError(f"No se encontró el archivo de esquema: {ruta_schema}")

    with open(ruta_schema, "r", encoding="utf-8") as f:
        sql = f.read()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("✅ Tablas inicializadas, roles, facultades y primer administrador creados en SICOU_IA.")


def obtener_facultades() -> list[dict[str, Any]]:
    """Obtiene la lista de todas las facultades activas."""
    query = "SELECT id, nombre FROM facultades WHERE activa = TRUE ORDER BY id ASC;"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            return list(cur.fetchall())


def registrar_usuario(
    nombre: str, correo: str, contrasena: str, facultad_id: int, rol: str = "estudiante"
) -> tuple[bool, str]:
    """Registra un nuevo usuario en la base de datos con rol estudiante por defecto."""
    rol_id = 1 if rol.lower() == "administrador" else 2
    query = """
        INSERT INTO usuarios (nombre, correo, contrasena, facultad_id, rol, rol_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(
                        query,
                        (
                            nombre.strip(),
                            correo.strip().lower(),
                            hashear_password(contrasena),
                            int(facultad_id) if facultad_id else None,
                            rol,
                            rol_id,
                        ),
                    )
                except Exception:
                    # Fallback si rol_id aún no existe
                    conn.rollback()
                    cur.execute(
                        """
                        INSERT INTO usuarios (nombre, correo, contrasena, facultad_id, rol)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id;
                        """,
                        (
                            nombre.strip(),
                            correo.strip().lower(),
                            hashear_password(contrasena),
                            int(facultad_id) if facultad_id else None,
                            rol,
                        ),
                    )
                conn.commit()
                return True, "Usuario registrado exitosamente."
    except Exception as e:
        error_msg = str(e)
        if "usuarios_correo_key" in error_msg or "unique" in error_msg.lower():
            return False, "El correo electrónico ya se encuentra registrado."
        elif "fk_usuario_facultad" in error_msg:
            return False, "La facultad seleccionada no es válida."
        return False, f"Error al registrar: {error_msg}"


def autenticar_usuario(
    correo: str, contrasena: str, facultad_id: Optional[int] = None
) -> tuple[bool, Optional[dict[str, Any]], str]:
    """Verifica credenciales del usuario, devolviendo su rol ('administrador' o 'estudiante')."""
    query = """
        SELECT 
            u.id, 
            u.nombre, 
            u.correo, 
            u.contrasena, 
            u.facultad_id, 
            u.departamento_id,
            COALESCE(r.nombre, u.rol, 'estudiante') AS rol,
            COALESCE(f.nombre, 'Administración General') AS facultad_nombre,
            COALESCE(d.nombre, 'Sin departamento') AS departamento_nombre
        FROM usuarios u
        LEFT JOIN roles r ON u.rol_id = r.id
        LEFT JOIN facultades f ON u.facultad_id = f.id
        LEFT JOIN departamentos d ON u.departamento_id = d.id
        WHERE LOWER(u.correo) = %s AND u.activo = TRUE;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    cur.execute(query, (correo.strip().lower(),))
                    usuario = cur.fetchone()
                except Exception:
                    # Fallback si roles no está unido
                    conn.rollback()
                    cur.execute(
                        """
                        SELECT u.id, u.nombre, u.correo, u.contrasena, u.facultad_id, u.rol,
                               COALESCE(f.nombre, 'General') AS facultad_nombre
                        FROM usuarios u
                        LEFT JOIN facultades f ON u.facultad_id = f.id
                        WHERE LOWER(u.correo) = %s AND u.activo = TRUE;
                        """,
                        (correo.strip().lower(),),
                    )
                    usuario = cur.fetchone()

                if not usuario:
                    return False, None, "El correo no está registrado o la cuenta está inactiva."

                if usuario["contrasena"] != hashear_password(contrasena):
                    return False, None, "Contraseña incorrecta."

                rol = str(usuario.get("rol", "estudiante")).lower()

                departamento_id = usuario.get("departamento_id")

                # el gerente de departamento debe tener un departamento asignado
                if rol == "gerente_area" and departamento_id is None:
                    return (
                        False,
                        None,
                        "El usuario tiene rol de gerente de área pero no tiene un departamento asignado.",
                    )

                # Si es administrador, tiene acceso directo sin restringir por facultad
                if rol != "administrador":
                    if facultad_id and usuario.get("facultad_id") and int(facultad_id) > 0 and int(usuario["facultad_id"]) != int(facultad_id):
                        return (
                            False,
                            None,
                            f"El usuario no pertenece a la facultad seleccionada (adscrito a: {usuario['facultad_nombre']}).",
                        )

                usuario_limpio = dict(usuario)
                usuario_limpio.pop("contrasena", None)
                return True, usuario_limpio, "Autenticación exitosa."
    except Exception as e:
        return False, None, f"Error de conexión: {str(e)}"


def guardar_solicitud(usuario_id: int, resultado) -> tuple[bool, str, Optional[int]]:
    """Guarda en PostgreSQL una solicitud procesada por el agente inteligente."""
    query_departamento = "SELECT id FROM departamentos WHERE LOWER(nombre) = LOWER(%s) LIMIT 1;"
    query_solicitud = """
        INSERT INTO solicitudes (
            usuario_id, departamento_id, descripcion, categoria, prioridad,
            canal_destino, confianza, alerta_supervisor, motivo_alerta,
            palabras_clave, reglas_activadas, conceptos, tripletas, notificaciones
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
    """
    try:
        departamento_id = None
        canal_nombre = getattr(resultado, "canal", "Servicios Escolares")

        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Obtener o crear departamento correspondiente
                cur.execute(query_departamento, (canal_nombre,))
                dept = cur.fetchone()
                if dept:
                    departamento_id = dept["id"]
                else:
                    cur.execute(
                        "INSERT INTO departamentos (nombre) VALUES (%s) RETURNING id;",
                        (canal_nombre,),
                    )
                    dept = cur.fetchone()
                    if dept:
                        departamento_id = dept["id"]

                # 2. Insertar solicitud
                cur.execute(
                    query_solicitud,
                    (
                        usuario_id,
                        departamento_id,
                        resultado.texto,
                        resultado.categoria,
                        resultado.prioridad,
                        resultado.canal,
                        resultado.confianza,
                        resultado.alerta_supervisor,
                        resultado.motivo_alerta,
                        json.dumps(resultado.palabras_clave, ensure_ascii=False),
                        json.dumps(resultado.reglas, ensure_ascii=False),
                        json.dumps(resultado.conceptos, ensure_ascii=False),
                        json.dumps(resultado.tripletas, ensure_ascii=False),
                        json.dumps(resultado.notificaciones, ensure_ascii=False),
                    ),
                )
                solicitud_id = cur.fetchone()["id"]
                conn.commit()

        return True, f"Solicitud registrada correctamente. Folio: SOL-{str(solicitud_id).zfill(3)}", solicitud_id
    except Exception as e:
        return False, f"Error al guardar la solicitud: {str(e)}", None


def obtener_departamentos() -> list[dict[str, Any]]:
    """Consulta la lista de los 4 departamentos oficiales y el conteo de solicitudes por cada uno."""
    deptos_default = [
        {"id": 1, "nombre": "Coordinación Académica", "activo": True, "total": 0, "pendientes": 0},
        {"id": 2, "nombre": "Servicios Escolares", "activo": True, "total": 0, "pendientes": 0},
        {"id": 3, "nombre": "Soporte Técnico", "activo": True, "total": 0, "pendientes": 0},
        {"id": 4, "nombre": "Bienestar Universitario", "activo": True, "total": 0, "pendientes": 0},
    ]
    query = """
        SELECT 
            d.id, 
            d.nombre, 
            COALESCE(d.activo, TRUE) AS activo,
            COUNT(s.id)::int AS total,
            COUNT(s.id) FILTER (WHERE s.estado = 'Pendiente' OR s.estado IS NULL)::int AS pendientes
        FROM departamentos d
        LEFT JOIN solicitudes s ON (s.departamento_id = d.id OR LOWER(s.canal_destino) = LOWER(d.nombre))
        WHERE d.activo IS NULL OR d.activo = TRUE
        GROUP BY d.id, d.nombre, d.activo
        ORDER BY d.id ASC;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query)
                res = [dict(r) for r in cur.fetchall()]
                if res:
                    return res
    except Exception as e:
        print(f"Error al obtener departamentos de la BD: {e}")
    return deptos_default


def obtener_solicitudes(
    usuario_id: Optional[int] = None,
    departamento_id: Optional[int] = None,
    estado: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Consulta las solicitudes de la BD uniendo usuario, facultad y departamento."""
    query = """
        SELECT 
            s.id,
            CONCAT('SOL-', LPAD(s.id::text, 3, '0')) AS folio,
            s.usuario_id,
            COALESCE(u.nombre, 'Anónimo') AS alumno_nombre,
            COALESCE(u.correo, '') AS alumno_correo,
            COALESCE(f.nombre, 'No especificada') AS alumno_facultad,
            s.departamento_id,
            COALESCE(d.nombre, s.canal_destino, 'Sin asignar') AS depto_nombre,
            s.descripcion,
            s.categoria,
            s.prioridad,
            s.canal_destino,
            ROUND(s.confianza::numeric, 2) AS confianza,
            s.alerta_supervisor,
            s.motivo_alerta,
            COALESCE(s.estado, 'Pendiente') AS estado,
            s.palabras_clave,
            s.reglas_activadas,
            s.conceptos,
            s.tripletas,
            s.notificaciones,
            TO_CHAR(s.fecha_creacion, 'YYYY-MM-DD HH24:MI') AS fecha
        FROM solicitudes s
        LEFT JOIN usuarios u ON s.usuario_id = u.id
        LEFT JOIN facultades f ON u.facultad_id = f.id
        LEFT JOIN departamentos d ON s.departamento_id = d.id
        WHERE 1=1
    """
    params: list[Any] = []
    if usuario_id:
        query += " AND s.usuario_id = %s"
        params.append(int(usuario_id))
    if departamento_id:
        query += " AND (s.departamento_id = %s OR (s.departamento_id IS NULL AND LOWER(s.canal_destino) = (SELECT LOWER(nombre) FROM departamentos WHERE id = %s)))"
        params.extend([int(departamento_id), int(departamento_id)])
    if estado and estado != "todos":
        query += " AND s.estado = %s"
        params.append(estado)

    query += " ORDER BY s.id DESC;"

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                filas = []
                for row in cur.fetchall():
                    item = dict(row)
                    if item.get("confianza") is not None:
                        try:
                            item["confianza"] = float(item["confianza"])
                        except Exception:
                            item["confianza"] = 0.0
                    filas.append(item)
                return filas
    except Exception as e:
        print(f"Error al obtener solicitudes: {e}")
        return []


def actualizar_estado_solicitud(solicitud_id: int, nuevo_estado: str) -> tuple[bool, str]:
    """Actualiza el estado de una solicitud ('Pendiente', 'En revisión', 'Resuelta')."""
    query = "UPDATE solicitudes SET estado = %s WHERE id = %s RETURNING id;"
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (nuevo_estado, int(solicitud_id)))
                if cur.fetchone():
                    conn.commit()
                    return True, "Estado actualizado con éxito."
                return False, "Solicitud no encontrada."
    except Exception as e:
        return False, f"Error al actualizar estado: {str(e)}"


def obtener_estadisticas_solicitudes(usuario_id: Optional[int] = None,
                                     departamento_id: Optional[int] = None) -> dict[str, int]:
    """Obtiene los contadores de solicitudes para las tarjetas estadísticas."""
    query = """
        SELECT 
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE estado = 'Pendiente' OR estado IS NULL)::int AS pendientes,
            COUNT(*) FILTER (WHERE estado = 'En revisión' OR estado = 'En revision')::int AS revision,
            COUNT(*) FILTER (WHERE estado = 'Resuelta' OR estado = 'Atendida')::int AS resueltas,
            COUNT(*) FILTER (WHERE estado = 'Cancelada')::int AS canceladas
        FROM solicitudes
        WHERE 1=1
    """
    params: list[Any] = []
    if usuario_id:
        query += " AND usuario_id = %s"
        params.append(int(usuario_id))
    if departamento_id:
        query += " AND (departamento_id = %s OR (departamento_id IS NULL AND LOWER(canal_destino) = (SELECT LOWER(nombre) FROM departamentos WHERE id = %s)))"
        params.extend([int(departamento_id), int(departamento_id)])
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, tuple(params))
                fila = cur.fetchone()
                return dict(fila) if fila else {"total": 0, "pendientes": 0, "revision": 0, "resueltas": 0, "canceladas": 0}
    except Exception as e:
        print(f"Error al obtener estadísticas: {e}")
        return {"total": 0, "pendientes": 0, "revision": 0, "resueltas": 0, "canceladas": 0}

def actualizar_password_usuario(usuario_id: int, password_actual: str, password_nueva: str) -> tuple[bool, str]:
    """Actualiza la contraseña de un usuario después de verificar la actual."""
    query_verificar = "SELECT contrasena FROM usuarios WHERE id = %s;"
    query_actualizar = "UPDATE usuarios SET contrasena = %s WHERE id = %s RETURNING id;"
    
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Verificar contraseña actual
                cur.execute(query_verificar, (int(usuario_id),))
                resultado = cur.fetchone()
                
                if not resultado:
                    return False, "Usuario no encontrado."
                
                if resultado["contrasena"] != hashear_password(password_actual):
                    return False, "La contraseña actual es incorrecta."
                
                # Actualizar contraseña
                cur.execute(query_actualizar, (hashear_password(password_nueva), int(usuario_id)))
                
                if cur.fetchone():
                    conn.commit()
                    return True, "Contraseña actualizada correctamente."
                return False, "No se pudo actualizar la contraseña."
    except Exception as e:
        return False, f"Error al actualizar contraseña: {str(e)}"


def actualizar_datos_usuario(usuario_id: int, nombre: str, correo: str) -> tuple[bool, str]:
    """Actualiza el nombre y correo de un usuario."""
    query = """
        UPDATE usuarios 
        SET nombre = %s, correo = LOWER(%s) 
        WHERE id = %s 
        RETURNING id;
    """
    
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (nombre.strip(), correo.strip().lower(), int(usuario_id)))
                
                if cur.fetchone():
                    conn.commit()
                    return True, "Datos actualizados correctamente."
                return False, "Usuario no encontrado."
    except Exception as e:
        error_msg = str(e)
        if "usuarios_correo_key" in error_msg or "unique" in error_msg.lower():
            return False, "El correo electrónico ya se encuentra registrado."
        return False, f"Error al actualizar datos: {error_msg}"


def cancelar_solicitud_usuario(solicitud_id: int, usuario_id: int) -> tuple[bool, str]:
    """Cancela una solicitud, solo si pertenece al usuario y está en estado Pendiente."""
    query_verificar = """
        SELECT id, estado, usuario_id 
        FROM solicitudes 
        WHERE id = %s;
    """
    query_cancelar = """
        UPDATE solicitudes 
        SET estado = 'Cancelada' 
        WHERE id = %s AND usuario_id = %s AND estado = 'Pendiente'
        RETURNING id;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # 1. Verificar que la solicitud existe
                cur.execute(query_verificar, (int(solicitud_id),))
                solicitud = cur.fetchone()
                if not solicitud:
                    return False, "La solicitud no existe."
                
                # 2. Verificar que pertenece al usuario
                if solicitud["usuario_id"] != int(usuario_id):
                    return False, "No tienes permiso para cancelar esta solicitud."
                
                # 3. Verificar que está en estado Pendiente
                if solicitud["estado"] != "Pendiente":
                    return False, f"La solicitud no se puede cancelar (estado actual: {solicitud['estado']})."
                
                # 4. Cancelar la solicitud
                cur.execute(query_cancelar, (int(solicitud_id), int(usuario_id)))
                if cur.fetchone():
                    conn.commit()
                    return True, "Solicitud cancelada correctamente."
                return False, "No se pudo cancelar la solicitud."
    except Exception as e:
        return False, f"Error al cancelar solicitud: {str(e)}"


if __name__ == "__main__":
    print(f"Probando conexión a base de datos '{CONFIG_DB['DB_NAME']}' en {CONFIG_DB['DB_HOST']}...")
    try:
        inicializar_tablas()
        facultades = obtener_facultades()
        print(f"Facultades registradas ({len(facultades)}):")
        for f in facultades:
            print(f"  [{f['id']}] {f['nombre']}")
    except Exception as e:
        print(f"Error al conectar o inicializar: {e}")
