"""Módulo de conexión y operaciones con la base de datos PostgreSQL (SICOU_IA)."""

import hashlib
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
        "DB_PASSWORD": "",
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
    """Ejecuta el script SQL para crear las tablas y registrar las facultades en SICOU_IA."""
    ruta_schema = os.path.join(_DIR, "database", "schema.sql")
    if not os.path.exists(ruta_schema):
        raise FileNotFoundError(f"No se encontró el archivo de esquema: {ruta_schema}")

    with open(ruta_schema, "r", encoding="utf-8") as f:
        sql = f.read()

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("✅ Tablas inicializadas y catálogo de facultades insertado correctamente en SICOU_IA.")


def obtener_facultades() -> list[dict[str, Any]]:
    """Obtiene la lista de todas las facultades activas."""
    query = "SELECT id, nombre FROM facultades WHERE activa = TRUE ORDER BY id ASC;"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            return list(cur.fetchall())


def registrar_usuario(
    nombre: str, correo: str, contrasena: str, facultad_id: int, rol: str = "usuario"
) -> tuple[bool, str]:
    """Registra un nuevo usuario en la base de datos."""
    query = """
        INSERT INTO usuarios (nombre, correo, contrasena, facultad_id, rol)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    query,
                    (
                        nombre.strip(),
                        correo.strip().lower(),
                        hashear_password(contrasena),
                        int(facultad_id),
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
    """Verifica las credenciales del usuario y su facultad."""
    query = """
        SELECT u.id, u.nombre, u.correo, u.contrasena, u.facultad_id, u.rol, f.nombre AS facultad_nombre
        FROM usuarios u
        JOIN facultades f ON u.facultad_id = f.id
        WHERE LOWER(u.correo) = %s AND u.activo = TRUE;
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (correo.strip().lower(),))
                usuario = cur.fetchone()

                if not usuario:
                    return False, None, "El correo no está registrado o la cuenta está inactiva."

                if usuario["contrasena"] != hashear_password(contrasena):
                    return False, None, "Contraseña incorrecta."

                if facultad_id and int(usuario["facultad_id"]) != int(facultad_id):
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


if __name__ == "__main__":
    print(f"Probando conexión a base de datos '{CONFIG_DB['DB_NAME']}' en {CONFIG_DB['DB_HOST']}...")
    try:
        inicializar_tablas()
        facultades = obtener_facultades()
        print(f"Facultades registradas ({len(facultades)}):")
        for f in facultades:
            print(f"  [{f['id']}] {f['nombre']}")
    except Exception as e:
        print(f"❌ Error al conectar o inicializar: {e}")
