# Estructura y Código del Sistema de Solicitudes

## 1. Estructura de Directorios
```text
Sistema_Solicitudes/
    .env
    .gitignore
    README.md
    agente.py
    clasificador.py
    conexion.py
    dataset.py
    main.py
    ontologia.py
    preprocesamiento.py
    pruebas.py
    reglas.py
    requirements.txt
    resultados_pruebas.md
    server.py
    Frontend/
        css/
            estilo_alumno.css
            estilo_areas.css
            estilo_login.css
        js/
            app.js
            dashboard_alumno.js
            login.js
        pages/
            areas.html
            dashboard_alumno.html
            login.html
    data/
        agente_config.json
        dataset.json
        ontologia.json
        reglas.json
    database/
        schema.sql
    uploads/
```

## 2. Código Fuente y Datos

### Archivo: `.env`
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=SICOU_IA
DB_USER=postgres
DB_PASSWORD=root
```

### Archivo: `README.md`
```markdown
# Sistema Inteligente de Clasificación, Priorización y Canalización de Solicitudes Universitarias (Equipo 5)

Prototipo Fase 5 en Python (VS Code). Sistema **híbrido**: ML (scikit-learn) + conocimiento simbólico (ontología y reglas).

## Instalación y ejecución
```bash
python -m venv .venv
.venv\Scripts\activate        # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
python main.py                # demo con ejemplos
python main.py -i             # modo interactivo (texto libre)
python pruebas.py             # Fase 6: tabla de pruebas + accuracy
```

# Creación de un servidor ligero para la conexión con la base de datos
- Crea la base de datos en pgadmin con el nombre: SICOU_IA
en .git ignore agregue el .env que es la conexión con la BDD, ahí debes cambiar tus datos:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=SICOU_IA
DB_USER=postgres
DB_PASSWORD=joss18
- Cree dos tablas: usuarios y facultades, el script esta en:
Sistema_Solicitudes\database\schema.sql
(solo debes abrir un Query tool -> pegar y ejecutar)
- instalar en terminal (\Sistema_Solicitudes> pip install psycopg2-binary):
        pip install psycopg2-binary
- tambien se agrego nuevas herramientas a requirements.txt

- Iniciar el proyecto completo con interfaz conectada:
cd Sistema_Solicitudes
python server.py    

# tablas de departamentos y de solicitudes
# agregar en la base de datos:

-- ==========================================
-- 1. TABLA DE DEPARTAMENTOS
-- ==========================================

CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    activo BOOLEAN DEFAULT TRUE
);

INSERT INTO departamentos (nombre) VALUES
    ('Coordinación Académica'),
    ('Servicios Escolares'),
    ('Soporte Técnico'),
    ('Bienestar Universitario')
ON CONFLICT (nombre) DO NOTHING;


-- ==========================================
-- 2. RELACIONAR GERENTES CON DEPARTAMENTOS
-- ==========================================

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS departamento_id INT
REFERENCES departamentos(id) ON DELETE RESTRICT;


-- ==========================================
-- 3. TABLA DE SOLICITUDES
-- ==========================================

CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,

    usuario_id INT NOT NULL,
    departamento_id INT,

    descripcion TEXT NOT NULL,

    categoria VARCHAR(100) NOT NULL,
    prioridad VARCHAR(50) NOT NULL,

    canal_destino VARCHAR(150) NOT NULL,

    confianza NUMERIC(5,4) NOT NULL,

    alerta_supervisor BOOLEAN DEFAULT FALSE,
    motivo_alerta TEXT,

    estado VARCHAR(50) DEFAULT 'Pendiente',

    palabras_clave JSONB,
    reglas_activadas JSONB,
    conceptos JSONB,
    tripletas JSONB,
    notificaciones JSONB,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_solicitud_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id) ON DELETE RESTRICT,

    CONSTRAINT fk_solicitud_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES departamentos(id) ON DELETE RESTRICT,

    CONSTRAINT chk_confianza
        CHECK (confianza >= 0 AND confianza <= 1)
);


-- ==========================================
-- 4. ÍNDICES PARA CONSULTAS
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario
ON solicitudes(usuario_id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_departamento
ON solicitudes(departamento_id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado
ON solicitudes(estado);

CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha
ON solicitudes(fecha_creacion);

# Script para la creación de Administrador en la BDD
- Se crea la tabla rol de admon. y usuario
- ya redirige si es admon. a  la interaz indicada, si es usuario a la del alumno
-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(150)
);

INSERT INTO roles (id, nombre, descripcion) VALUES
    (1, 'administrador', 'Acceso al panel administrativo y de gerencia'),
    (2, 'estudiante', 'Acceso al portal de solicitudes del alumno')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 2. Clave foránea en la tabla Usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_id INT REFERENCES roles(id) DEFAULT 2;

-- 3. Registro del Primer Administrador Oficial
INSERT INTO usuarios (nombre, correo, contrasena, facultad_id, rol_id, rol, activo)
VALUES (
    'administrador',
    'adminsicou@unach.mx',
    'b20b0f63ce2ed361e8845d6bf2e59811aaa06ec96bcdb92f9bc0c5a25e83c9a6', -- SHA-256 de 'administrador'
    1,
    1,
    'administrador',
    TRUE
)
ON CONFLICT (correo) DO UPDATE 
SET rol_id = 1, rol = 'administrador', activo = TRUE;

- Datos del admon. para probar:
correo: adminsicou@unach.mx
contraseña: administrador
rol asignado: administrador (rol_id: 1)

# Se agrego a base de datos un usuario para cada area 

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM roles WHERE nombre = 'gerente_area'
    ) THEN
        INSERT INTO roles (id, nombre, descripcion)
        VALUES (
            3,
            'gerente_area',
            'Acceso a las solicitudes de su departamento'
        );
    END IF;
END $$;


-- =====================================================
-- 2. Crear los usuarios gerentes
-- Facultad de Arquitectura: ID 1
-- Contraseña común: Prueba2026*
-- =====================================================

DO $$
DECLARE
    id_rol_gerente INTEGER;
    contrasena_hash TEXT :=
    'b980c7026bb786851b28309bd36820fa29537a3e22cfb6fe4cd967a806f76b6f';
BEGIN

    SELECT id INTO id_rol_gerente
    FROM roles
    WHERE nombre = 'gerente_area';

    -- Coordinación Académica
    INSERT INTO usuarios (
        nombre, correo, contrasena, facultad_id,
        rol, activo, departamento_id, rol_id
    )
    VALUES (
        'Gerente Coordinación Académica',
        'gerente.academica@sicou.test',
        contrasena_hash,
        1,
        'gerente_area',
        TRUE,
        1,
        id_rol_gerente
    );

    -- Servicios Escolares
    INSERT INTO usuarios (
        nombre, correo, contrasena, facultad_id,
        rol, activo, departamento_id, rol_id
    )
    VALUES (
        'Gerente Servicios Escolares',
        'gerente.escolares@sicou.test',
        contrasena_hash,
        1,
        'gerente_area',
        TRUE,
        2,
        id_rol_gerente
    );

    -- Soporte Técnico
    INSERT INTO usuarios (
        nombre, correo, contrasena, facultad_id,
        rol, activo, departamento_id, rol_id
    )
    VALUES (
        'Gerente Soporte Técnico',
        'gerente.soporte@sicou.test',
        contrasena_hash,
        1,
        'gerente_area',
        TRUE,
        3,
        id_rol_gerente
    );

    -- Bienestar Universitario
    INSERT INTO usuarios (
        nombre, correo, contrasena, facultad_id,
        rol, activo, departamento_id, rol_id
    )
    VALUES (
        'Gerente Bienestar Universitario',
        'gerente.bienestar@sicou.test',
        contrasena_hash,
        1,
        'gerente_area',
        TRUE,
        4,
        id_rol_gerente
    );

END $$;

- datos para entrar a esos perfiles
Departamento			    Correo
Coordinación Académica		gerente.academica@sicou.test
Servicios Escolares		    gerente.escolares@sicou.test
Soporte Técnico			    gerente.soporte@sicou.test
Bienestar Universitario		gerente.bienestar@sicou.test

- Contraseña para los cuatro: 
Prueba2026*

```

### Archivo: `agente.py`
```python
"""Agente inteligente racional (modelo REAS / PAMA) con supervisión humana.

La configuración del agente (canales, umbral) se carga desde data/agente_config.json.

REAS (agente racional):
  Rendimiento : clasificar/priorizar/canalizar correctamente y escalar lo crítico.
  Entorno     : solicitudes universitarias en texto libre.
  Actuadores  : asignación de canal, notificaciones y alertas al supervisor.
  Sensores    : texto de la solicitud.
PAMA (ciclo): Percepción -> Análisis (IA) -> Meta (reglas) -> Acción.
"""
import json
import os
from dataclasses import dataclass, field

import ontologia
from clasificador import ClasificadorSolicitudes
from preprocesamiento import extraer_palabras_clave
from reglas import aplicar_reglas

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "agente_config.json")


def _cargar_config() -> dict:
    """Lee la configuración del agente desde el JSON."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


_CONFIG = _cargar_config()
UMBRAL_CONFIANZA = _CONFIG["umbral_confianza"]
BANDEJA_SUPERVISOR = _CONFIG["bandeja_supervisor"]
CANAL_POR_DEFECTO = _CONFIG["canal_por_defecto"]


@dataclass
class Resultado:
    texto: str
    palabras_clave: list
    categoria: str
    confianza: float
    prioridad: str
    canal: str
    alerta_supervisor: bool
    motivo_alerta: str
    reglas: list = field(default_factory=list)
    conceptos: list = field(default_factory=list)
    tripletas: list = field(default_factory=list)
    notificaciones: list = field(default_factory=list)


class AgenteSolicitudes:
    def __init__(self, umbral: float = UMBRAL_CONFIANZA):
        self.clasificador = ClasificadorSolicitudes()
        self.umbral = umbral

    def procesar(self, texto: str) -> Resultado:
        # PERCEPCIÓN + PLN
        claves = extraer_palabras_clave(texto)
        # ANÁLISIS: componente de ML
        cat_ml, confianza, _ = self.clasificador.predecir(texto)
        # CONOCIMIENTO SIMBÓLICO: ontología + reglas
        conceptos = ontologia.conceptos_detectados(texto)
        if cat_ml == "Desconocida":
            categoria, prioridad, alerta_regla, reglas = cat_ml, "Media", False, []
        else:
            r = aplicar_reglas(texto, cat_ml)
            categoria, prioridad, alerta_regla, reglas = r.categoria, r.prioridad, r.alerta_humana, r.reglas_activadas

        # CANALIZACIÓN: ontología (concepto -> gestionada_por) o canal por defecto
        canal = CANAL_POR_DEFECTO.get(categoria, BANDEJA_SUPERVISOR)
        tripletas = []
        for c in conceptos:
            if ontologia.consultar(c, "pertenece_a") == categoria:
                dest = ontologia.consultar(c, "gestionada_por")
                if dest:
                    canal = dest
                    tripletas.append((c, "gestionada_por", dest))
                    break

        
        # SUPERVISIÓN HUMANA
        motivo = ""
        if alerta_regla:
            motivo = "Criticidad alta (reglas: " + ", ".join(reglas) + ")"
            # Solo enviar al supervisor si la alerta viene de R8 o R9 (ambigüedad/mixto)
            if any(r in ["R8_texto_ambiguo", "R9_solicitud_mixta"] for r in reglas):
                canal = BANDEJA_SUPERVISOR
        elif confianza < self.umbral:
            motivo = f"Confianza baja ({confianza:.2f} < {self.umbral})"
            canal = BANDEJA_SUPERVISOR
        alerta = bool(motivo)

        # ACCIÓN: notificaciones simuladas
        notif = []
        if alerta:
            notif.append(f"[ALERTA] Supervisor humano: revisar solicitud ({motivo}).")
            if alerta_regla:
                notif.append(f"[NOTIFICACIÓN] {canal}: caso crítico, atención inmediata.")
        else:
            notif.append(f"[NOTIFICACIÓN] {canal}: nueva solicitud {categoria}, prioridad {prioridad}.")
            notif.append("[NOTIFICACIÓN] Solicitante: su solicitud fue canalizada correctamente.")

        return Resultado(texto, claves, categoria, confianza, prioridad, canal,
                         alerta, motivo, reglas, conceptos, tripletas, notif)


def mostrar(res: Resultado) -> None:
    print("=" * 70)
    print(f"Solicitud     : {res.texto}")
    print(f"Palabras clave: {', '.join(res.palabras_clave)}")
    print(f"Conceptos     : {', '.join(res.conceptos) or '-'}")
    print(f"Categoría     : {res.categoria}   (confianza ML: {res.confianza:.2f})")
    print(f"Prioridad     : {res.prioridad}")
    print(f"Reglas        : {', '.join(res.reglas) or '-'}")
    print(f"Canal         : {res.canal}")
    print(f"Alerta humana : {'SÍ - ' + res.motivo_alerta if res.alerta_supervisor else 'No'}")
    for n in res.notificaciones:
        print("  ", n)

```

### Archivo: `clasificador.py`
```python
"""Componente de Aprendizaje Automático: TF-IDF + Regresión Logística (scikit-learn).

Devuelve la categoría y la probabilidad (confianza) de la predicción.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from dataset import DATOS
from preprocesamiento import preprocesar


def crear_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            preprocessor=preprocesar,
            ngram_range=(1, 3),      # ← Cambiado de (1,2) a (1,3) para capturar trigramas
            max_features=5000,       # ← Aumentado para más vocabulario
            min_df=1,                # ← Incluir términos que aparecen al menos 1 vez
            max_df=0.95,             # ← Excluir términos que aparecen en >95% de docs
            sublinear_tf=True        # ← Aplicar log-normalization a TF
        )),
        ("clf", LogisticRegression(
            C=5,                     # ← Reducido de 10 para evitar overfitting
            max_iter=3000,           # ← Aumentado para convergencia
            class_weight='balanced', # ← Balancear clases si hay desbalance
            solver='lbfgs'           # ← Solver más estable
        )),
    ])

class ClasificadorSolicitudes:
    def __init__(self):
        self.modelo = crear_pipeline()
        textos = [t for t, _ in DATOS]
        etiquetas = [c for _, c in DATOS]
        self.modelo.fit(textos, etiquetas)          # <-- ENTRENAMIENTO
        self.vocabulario = set(self.modelo.named_steps["tfidf"].vocabulary_)

    def predecir(self, texto: str) -> tuple[str, float, dict]:
        """Retorna (categoría, confianza, probabilidades por clase)."""
        # Si ninguna palabra del texto existe en el vocabulario aprendido,
        # el modelo no tiene evidencia: confianza 0.
        tokens = preprocesar(texto).split()
        if not any(t in self.vocabulario for t in tokens):
            return "Desconocida", 0.0, {}
        probas = self.modelo.predict_proba([texto])[0]   # <-- INFERENCIA
        clases = self.modelo.classes_
        i = probas.argmax()
        return clases[i], float(probas[i]), dict(zip(clases, map(float, probas)))

```

### Archivo: `conexion.py`
```python
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
        query += " AND s.departamento_id = %s"
        params.append(int(departamento_id))
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
        query += " AND departamento_id = %s"
        params.append(int(departamento_id))
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

```

### Archivo: `dataset.py`
```python
"""Dataset de solicitudes universitarias etiquetadas (datos de entrenamiento).

Los datos se cargan desde data/dataset.json para separar los datos del código.
Cada entrada es (texto, categoria).
"""
import json
import os

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "dataset.json")


def _cargar_datos() -> list[tuple[str, str]]:
    """Lee el archivo JSON y devuelve la lista de tuplas (texto, categoria)."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        contenido = json.load(f)
    return [(item["texto"], item["categoria"]) for item in contenido["datos"]]


DATOS = _cargar_datos()

```

### Archivo: `main.py`
```python
"""Punto de entrada. Uso:
    python main.py              -> ejecuta ejemplos de demostración
    python main.py -i           -> modo interactivo (texto libre)
"""
import sys
from agente import AgenteSolicitudes, mostrar

EJEMPLOS = [
    "Necesito saber por qué no aparece mi calificación del semestre",
    "Se cayó la red de toda la universidad y no podemos entrar a la plataforma",
    "Quiero solicitar informes sobre los requisitos para la beca de manutención",
    "Un compañero me amenaza y me hostiga todos los días",
    "Necesito una constancia de estudios para un trámite",
    "asdf algo sobre un tema que no sé cómo explicar",
]

if __name__ == "__main__":
    agente = AgenteSolicitudes()
    if "-i" in sys.argv:
        print("Escribe tu solicitud (vacío para salir):")
        while (texto := input("> ").strip()):
            mostrar(agente.procesar(texto))
    else:
        for e in EJEMPLOS:
            mostrar(agente.procesar(e))

```

### Archivo: `ontologia.py`
```python
"""Ontología del dominio universitario como grafo de tripletas Sujeto -> Predicado -> Objeto.

Las tripletas y los términos se cargan desde data/ontologia.json.
"""
import json
import os

import networkx as nx
from preprocesamiento import normalizar

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "ontologia.json")


def _cargar_ontologia() -> tuple[list[tuple[str, str, str]], dict[str, list[str]]]:
    """Lee el archivo JSON y devuelve (tripletas, términos)."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        contenido = json.load(f)
    tripletas = [(t["sujeto"], t["predicado"], t["objeto"])
                 for t in contenido["tripletas"]]
    terminos = contenido["terminos"]
    return tripletas, terminos


TRIPLETAS, TERMINOS = _cargar_ontologia()


def construir_grafo() -> nx.DiGraph:
    g = nx.DiGraph()
    for s, p, o in TRIPLETAS:
        g.add_edge(s, o, predicado=p)
    return g


GRAFO = construir_grafo()


def conceptos_detectados(texto: str) -> list[str]:
    """Busca en el texto los conceptos de la ontología (por términos asociados)."""
    t = " " + normalizar(texto) + " "
    encontrados = []
    for concepto, terminos in TERMINOS.items():
        if any(f" {term} " in t for term in terminos):
            encontrados.append(concepto)
    return encontrados


def consultar(sujeto: str, predicado: str) -> str | None:
    """Devuelve el objeto de la tripleta (sujeto, predicado, ?)."""
    for _, destino, datos in GRAFO.out_edges(sujeto, data=True):
        if datos["predicado"] == predicado:
            return destino
    return None


def tripletas_usadas(conceptos: list[str]) -> list[tuple[str, str, str]]:
    return [(c, "gestionada_por", consultar(c, "gestionada_por"))
            for c in conceptos if consultar(c, "gestionada_por")]

```

### Archivo: `preprocesamiento.py`
```python
"""Módulo de PLN: normalización, tokenización, stopwords y lematización (stemming)."""
import re
import unicodedata
from nltk.stem.snowball import SnowballStemmer

_stemmer = SnowballStemmer("spanish")

STOPWORDS = set("""
a al algo ante con contra cual cuando de del desde donde e el ella ellos en entre era es esa ese eso esta este esto
fue ha han hay la las le les lo los me mi mis muy ni no nos o para pero por porque que quiero necesito se si sin
sobre su sus te tengo un una uno unos unas y ya yo como cuanto cuando puedo solicito quisiera favor buen dia
""".split())


def normalizar(texto: str) -> str:
    """Minúsculas, sin acentos y sin signos de puntuación."""
    texto = texto.lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ\s]", " ", texto)


def tokenizar(texto: str) -> list[str]:
    return normalizar(texto).split()


def preprocesar(texto: str) -> str:
    """Devuelve el texto como cadena de raíces (stems) sin stopwords."""
    tokens = [t for t in tokenizar(texto) if t not in STOPWORDS and len(t) > 1]
    return " ".join(_stemmer.stem(t) for t in tokens)


def extraer_palabras_clave(texto: str) -> list[str]:
    """Palabras relevantes del texto (sin stopwords), sin repetir y en orden."""
    vistas, claves = set(), []
    for t in tokenizar(texto):
        if t not in STOPWORDS and len(t) > 2 and t not in vistas:
            vistas.add(t)
            claves.append(t)
    return claves

```

### Archivo: `pruebas.py`
```python
"""Fase 6 (apoyo): ejecuta pruebas y genera la tabla en consola y en resultados_pruebas.md.
Las pruebas son libres: edita la lista PRUEBAS con los casos de tu equipo.
Formato: (entrada, categoria_esperada, prioridad_esperada, canal_esperado, alerta_esperada)
"""
from agente import AgenteSolicitudes, BANDEJA_SUPERVISOR
from clasificador import crear_pipeline
from dataset import DATOS
from sklearn.model_selection import cross_val_score, StratifiedKFold

PRUEBAS = [
    ("Necesito sabker por qué no aparece mi calificación del semestre",
     "Académica", "Baja", "Servicios Escolares", False),
    ("Existe una falla de red que nos impide acceder a la plataforma universitaria",
     "Soporte Técnico", "Alta", "Soporte Técnico", False),
    ("Quiero solicitar informes sobre los requisitos para la beca de manutención",
     "Financiera/Becas", "Baja", "Servicios Escolares", False),
    ("Reporte de situación grave de acoso en el campus",
     "Bienestar Universitario", "Alta", "Bienestar Universitario", True),
    ("Texto ambiguo o poco claro sobre un trámite no especificado",
     None, None, BANDEJA_SUPERVISOR, True),
    ("NECESITO MI CONSTANCIA DE ESTUDIOS URGENTE PARA MAÑANA",
     "Servicios Escolares", "Media", "Servicios Escolares", False),
    ("no puedo entrar a mi cuenta del correo institucional, olvide la contraseña",
     "Soporte Técnico", "Media", "Soporte Técnico", False),
    ("Un alumno se desmayó en el patio y necesita una ambulancia",
     "Bienestar Universitario", "Alta", "Bienestar Universitario", True),
    ("Quiero saber cuando es la fecha limite para pagar la colegiatura",
     "Financiera/Becas", "Media", "Caja y Finanzas", False),
    ("Necesito una beca y además no puedo entrar a la plataforma de tareas",
     "Financiera/Becas", "Media", BANDEJA_SUPERVISOR, True),
    ("asdf algo sobre un tema que no sé cómo explicar",
     None, None, BANDEJA_SUPERVISOR, True),
]


def main():
    agente = AgenteSolicitudes()
    filas = ["| Prueba | Entrada | Resultado esperado | Resultado obtenido | ¿Fue correcto? | Observaciones |",
             "|---|---|---|---|---|---|"]
    ok_total = 0
    for i, (texto, cat, pri, canal, alerta) in enumerate(PRUEBAS, 1):
        r = agente.procesar(texto)
        ok = (r.canal == canal and r.alerta_supervisor == alerta
              and (cat is None or r.categoria == cat) and (pri is None or r.prioridad == pri))
        ok_total += ok
        esperado = f"Cat: {cat or 'n/a'} / Prior: {pri or 'n/a'} / Canal: {canal} / Alerta: {'Sí' if alerta else 'No'}"
        obtenido = (f"Cat: {r.categoria} / Prior: {r.prioridad} / Canal: {r.canal} / "
                    f"Alerta: {'Sí' if r.alerta_supervisor else 'No'}")
        obs = (f"Confianza={r.confianza:.2f}; reglas={','.join(r.reglas) or 'ninguna'}; "
               f"conceptos={','.join(r.conceptos) or 'ninguno'}")
        filas.append(f"| {i} | \"{texto}\" | {esperado} | {obtenido} | {'Sí' if ok else 'No'} | {obs} |")
    tabla = "\n".join(filas)
    print(tabla)
    print(f"\nPruebas correctas: {ok_total}/{len(PRUEBAS)}")

    # Métrica global del clasificador de ML (validación cruzada 5 pliegues)
    X = [t for t, _ in DATOS]; y = [c for _, c in DATOS]
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    acc = cross_val_score(crear_pipeline(), X, y, cv=cv)
    print(f"Accuracy del clasificador (validación cruzada 5-fold): {acc.mean():.2f} ± {acc.std():.2f}")
    with open("resultados_pruebas.md", "w", encoding="utf-8") as f:
        f.write(tabla + f"\n\nPruebas correctas: {ok_total}/{len(PRUEBAS)}\n"
                f"Accuracy (5-fold): {acc.mean():.2f} ± {acc.std():.2f}\n")


if __name__ == "__main__":
    main()

```

### Archivo: `reglas.py`
```python
"""Motor de reglas de producción SI-ENTONCES (conocimiento simbólico).

Las reglas y prioridades se cargan desde data/reglas.json para separar
el conocimiento del código.
"""
import json
import os
from dataclasses import dataclass, field
from preprocesamiento import normalizar

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "reglas.json")

ORDEN = {"Baja": 0, "Media": 1, "Alta": 2}


def contiene(texto: str, terminos: list[str]) -> bool:
    t = " " + texto + " "
    return any(f" {x} " in t or (len(x) > 4 and x in t) for x in terminos)


@dataclass
class Regla:
    nombre: str
    terminos: list[str]
    requiere_categoria: str | None = None
    prioridad: str | None = None
    alerta_humana: bool = False
    categoria: str | None = None
    descripcion: str = ""

    def condicion(self, texto: str, cat: str) -> bool:
        """Evalúa si la regla se activa dado el texto normalizado y la categoría."""
        if self.requiere_categoria and cat != self.requiere_categoria:
            return False
        return contiene(texto, self.terminos)


def _cargar_reglas() -> tuple[dict[str, str], list[Regla]]:
    """Lee el archivo JSON y devuelve (prioridad_base, lista_de_reglas)."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        contenido = json.load(f)
    prioridad_base = contenido["prioridad_base"]
    reglas = []
    for r in contenido["reglas"]:
        reglas.append(Regla(
            nombre=r["nombre"],
            terminos=r["terminos"],
            requiere_categoria=r.get("requiere_categoria"),
            prioridad=r.get("prioridad"),
            alerta_humana=r.get("alerta_humana", False),
            categoria=r.get("forzar_categoria"),
            descripcion=r.get("descripcion", ""),
        ))
    return prioridad_base, reglas


PRIORIDAD_BASE, REGLAS = _cargar_reglas()


@dataclass
class ResultadoReglas:
    categoria: str
    prioridad: str
    alerta_humana: bool = False
    reglas_activadas: list[str] = field(default_factory=list)


def aplicar_reglas(texto: str, categoria_ml: str) -> ResultadoReglas:
    """Ejecuta el motor de reglas (encadenamiento hacia adelante, un solo ciclo)."""
    t = normalizar(texto)
    categoria = categoria_ml
    # 1) las reglas de criticidad pueden forzar la categoría
    activadas = [r for r in REGLAS if r.condicion(t, categoria_ml)]
    for r in activadas:
        if r.categoria:
            categoria = r.categoria
    # 2) re-evaluar con la categoría final (reglas que dependen de ella)
    activadas = [r for r in REGLAS if r.condicion(t, categoria)]
    prioridad = PRIORIDAD_BASE[categoria]
    alerta = False
    for r in activadas:
        if r.prioridad and ORDEN[r.prioridad] > ORDEN[prioridad]:
            prioridad = r.prioridad
        alerta = alerta or r.alerta_humana
    return ResultadoReglas(categoria, prioridad, alerta, [r.nombre for r in activadas])

```

### Archivo: `requirements.txt`
```text
scikit-learn>=1.3
networkx>=3.0
nltk>=3.8
pandas>=2.0
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0

```

### Archivo: `resultados_pruebas.md`
```markdown
| Prueba | Entrada | Resultado esperado | Resultado obtenido | ¿Fue correcto? | Observaciones |
|---|---|---|---|---|---|
| 1 | "Necesito sabker por qué no aparece mi calificación del semestre" | Cat: Académica / Prior: Baja / Canal: Servicios Escolares / Alerta: No | Cat: Académica / Prior: Baja / Canal: Coordinación Académica / Alerta: No | No | Confianza=0.64; reglas=ninguna; conceptos=Calificación |
| 2 | "Existe una falla de red que nos impide acceder a la plataforma universitaria" | Cat: Soporte Técnico / Prior: Alta / Canal: Soporte Técnico / Alerta: No | Cat: Soporte Técnico / Prior: Alta / Canal: Soporte Técnico / Alerta: No | Sí | Confianza=0.73; reglas=R4_falla_masiva; conceptos=Red,Plataforma |
| 3 | "Quiero solicitar informes sobre los requisitos para la beca de manutención" | Cat: Financiera/Becas / Prior: Baja / Canal: Servicios Escolares / Alerta: No | Cat: Financiera/Becas / Prior: Baja / Canal: Servicios Escolares / Alerta: No | Sí | Confianza=0.85; reglas=ninguna; conceptos=Beca |
| 4 | "Reporte de situación grave de acoso en el campus" | Cat: Bienestar Universitario / Prior: Alta / Canal: Bienestar Universitario / Alerta: Sí | Cat: Bienestar Universitario / Prior: Alta / Canal: Bienestar Universitario / Alerta: Sí | Sí | Confianza=0.81; reglas=R1_acoso_violencia; conceptos=Acoso |
| 5 | "Texto ambiguo o poco claro sobre un trámite no especificado" | Cat: n/a / Prior: n/a / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Cat: Servicios Escolares / Prior: Media / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Sí | Confianza=0.84; reglas=R8_texto_ambiguo; conceptos=Trámite |
| 6 | "NECESITO MI CONSTANCIA DE ESTUDIOS URGENTE PARA MAÑANA" | Cat: Servicios Escolares / Prior: Media / Canal: Servicios Escolares / Alerta: No | Cat: Servicios Escolares / Prior: Media / Canal: Servicios Escolares / Alerta: No | Sí | Confianza=0.59; reglas=R5_urgencia_explicita; conceptos=Constancia |
| 7 | "no puedo entrar a mi cuenta del correo institucional, olvide la contraseña" | Cat: Soporte Técnico / Prior: Media / Canal: Soporte Técnico / Alerta: No | Cat: Soporte Técnico / Prior: Media / Canal: Soporte Técnico / Alerta: No | Sí | Confianza=0.94; reglas=ninguna; conceptos=Plataforma,Contraseña |
| 8 | "Un alumno se desmayó en el patio y necesita una ambulancia" | Cat: Bienestar Universitario / Prior: Alta / Canal: Bienestar Universitario / Alerta: Sí | Cat: Bienestar Universitario / Prior: Alta / Canal: Bienestar Universitario / Alerta: Sí | Sí | Confianza=0.56; reglas=R2_emergencia; conceptos=Emergencia |
| 9 | "Quiero saber cuando es la fecha limite para pagar la colegiatura" | Cat: Financiera/Becas / Prior: Media / Canal: Caja y Finanzas / Alerta: No | Cat: Financiera/Becas / Prior: Media / Canal: Caja y Finanzas / Alerta: No | Sí | Confianza=0.80; reglas=R6_plazos; conceptos=Colegiatura |
| 10 | "Necesito una beca y además no puedo entrar a la plataforma de tareas" | Cat: Financiera/Becas / Prior: Media / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Cat: Financiera/Becas / Prior: Media / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Sí | Confianza=0.46; reglas=R9_solicitud_mixta; conceptos=Beca,Plataforma |
| 11 | "asdf algo sobre un tema que no sé cómo explicar" | Cat: n/a / Prior: n/a / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Cat: Académica / Prior: Media / Canal: Bandeja de revisión por Supervisor Humano / Alerta: Sí | Sí | Confianza=0.39; reglas=R8_texto_ambiguo; conceptos=ninguno |

Pruebas correctas: 10/11
Accuracy (5-fold): 0.89 ± 0.03

```

### Archivo: `server.py`
```python
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

                # Endpoint API: Cambiar contraseña del usuario
        if url.path == "/api/usuario/password":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})
            
            usuario = self._obtener_usuario_sesion()
            if not usuario:
                return self._responder_json(401, {"ok": False, "error": "Sesión no válida"})
            
            password_actual = datos.get("password_actual", "")
            password_nueva = datos.get("password_nueva", "")
            
            if not password_actual or not password_nueva:
                return self._responder_json(400, {"ok": False, "error": "Ambas contraseñas son requeridas"})
            
            ok, mensaje = conexion.actualizar_password_usuario(
                int(usuario["id"]),
                password_actual,
                password_nueva
            )
            
            return self._responder_json(200 if ok else 400, {"ok": ok, "mensaje": mensaje})

        # Endpoint API: Actualizar datos del usuario
        if url.path == "/api/usuario/datos":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})
            
            usuario = self._obtener_usuario_sesion()
            if not usuario:
                return self._responder_json(401, {"ok": False, "error": "Sesión no válida"})
            
            nombre = datos.get("nombre", "").strip()
            correo = datos.get("correo", "").strip()
            
            if not nombre or not correo:
                return self._responder_json(400, {"ok": False, "error": "Nombre y correo son requeridos"})
            
            ok, mensaje = conexion.actualizar_datos_usuario(
                int(usuario["id"]),
                nombre,
                correo
            )
            
            return self._responder_json(200 if ok else 400, {"ok": ok, "mensaje": mensaje})

        # Endpoint API: Cancelar solicitud del alumno (solo si es suya y está pendiente)
        if url.path == "/api/solicitudes/cancelar":
            if not conexion:
                return self._responder_json(500, {"error": "Módulo de base de datos no disponible"})
            
            usuario = self._obtener_usuario_sesion()
            if not usuario:
                return self._responder_json(401, {"ok": False, "error": "Sesión no válida"})
            
            # Solo estudiantes pueden cancelar sus propias solicitudes
            if usuario["rol"] not in ("estudiante", "usuario"):
                return self._responder_json(403, {"ok": False, "error": "No tienes permisos para cancelar solicitudes."})
            
            solicitud_id = datos.get("solicitud_id")
            if not solicitud_id:
                return self._responder_json(400, {"ok": False, "error": "solicitud_id es requerido"})
            
            ok, mensaje = conexion.cancelar_solicitud_usuario(int(solicitud_id), int(usuario["id"]))
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

```

### Archivo: `Frontend\css\estilo_alumno.css`
```css
/* ============================================================
   ESTILOS ESPECÍFICOS DEL DASHBOARD DE ALUMNO
   Mantiene coherencia con estilo_areas.css (azul corporativo)
   ============================================================ */

/* Badge de facultad en header */
.facultad-tag {
    background: rgba(255, 255, 255, 0.15);
    padding: 5px 12px;
    border-radius: 12px;
    font-size: 12px;
}

/* Badge de notificaciones en sidebar */
.badge-notif {
    background: #e74c3c;
    color: white;
    border-radius: 10px;
    padding: 2px 7px;
    font-size: 11px;
    margin-left: 8px;
}

/* Colores diferenciados para tarjetas de alumno */
.tarjeta-pendiente {
    border-left-color: #f59e0b !important;
}
.tarjeta-revision {
    border-left-color: #3b82f6 !important;
}
.tarjeta-resuelta {
    border-left-color: #10b981 !important;
}

/* Accesos rápidos */
.accesos-rapidos {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
}

.btn-acceso {
    background: #f3f6fa;
    border: 2px solid #e5eaf0;
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transition: all 0.2s;
    font-size: 14px;
    color: #15345b;
    font-weight: 500;
}

.btn-acceso:hover {
    background: #eaf0f7;
    border-color: #28649e;
    transform: translateY(-2px);
}

.btn-acceso .icono {
    font-size: 28px;
}

/* Formulario de solicitud */
.formulario-solicitud form {
    max-width: 700px;
}

.grupo-campos {
    margin-bottom: 20px;
}

.grupo-campos label {
    display: block;
    font-weight: 600;
    color: #15345b;
    margin-bottom: 8px;
    font-size: 14px;
}

.grupo-campos input,
.grupo-campos select,
.grupo-campos textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #d1dbe8;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    background: white;
    transition: border-color 0.2s;
}

.grupo-campos input:focus,
.grupo-campos select:focus,
.grupo-campos textarea:focus {
    outline: none;
    border-color: #28649e;
    box-shadow: 0 0 0 3px rgba(40, 100, 158, 0.15);
}

.grupo-campos textarea {
    resize: vertical;
    min-height: 120px;
}

.ayuda-ia {
    display: block;
    margin-top: 6px;
    color: #6b7888;
    font-size: 12px;
    font-style: italic;
}

.acciones-form {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 25px;
}

.btn-primario {
    background: #1d5c96;
    color: white;
    border: none;
    padding: 10px 22px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: background 0.2s;
}

.btn-primario:hover {
    background: #15345b;
}

.btn-secundario {
    background: white;
    color: #15345b;
    border: 1px solid #d1dbe8;
    padding: 10px 22px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s;
}

.btn-secundario:hover {
    background: #f3f6fa;
}

.btn-sm {
    padding: 8px 14px;
    font-size: 13px;
}

/* Resultado IA */
.resultado-ia {
    margin-top: 25px;
    padding: 18px;
    background: #eaf4ff;
    border-left: 4px solid #28649e;
    border-radius: 6px;
}

.resultado-ia h3 {
    color: #15345b;
    margin-bottom: 12px;
    font-size: 16px;
}

.grid-resultado {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    font-size: 14px;
    color: #263445;
}

.grid-resultado strong {
    color: #15345b;
}

/* Filtros */
.filtros {
    display: flex;
    gap: 15px;
    align-items: flex-end;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5eaf0;
    flex-wrap: wrap;
}

.grupo-filtro {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.grupo-filtro label {
    font-size: 12px;
    font-weight: 600;
    color: #6b7888;
}

.grupo-filtro select {
    padding: 8px 12px;
    border: 1px solid #d1dbe8;
    border-radius: 5px;
    font-size: 13px;
    background: white;
    min-width: 150px;
}

/* Badges de estado y prioridad en tabla */
.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}

.badge-pendiente {
    background: #fef3c7;
    color: #92400e;
}

.badge-revision {
    background: #dbeafe;
    color: #1e40af;
}

.badge-atendida {
    background: #d1fae5;
    color: #065f46;
}

.badge-alta {
    background: #fee2e2;
    color: #991b1b;
}

.badge-media {
    background: #fef3c7;
    color: #92400e;
}

.badge-baja {
    background: #e0e7ff;
    color: #3730a3;
}

/* Botón de acción en tabla */
.btn-ver {
    background: #1d5c96;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.btn-ver:hover {
    background: #15345b;
}

/* Notificaciones */
.lista-notificaciones {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.notif-item {
    display: flex;
    gap: 15px;
    padding: 15px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 4px solid #28649e;
    transition: background 0.2s;
}

.notif-item.no-leida {
    background: #eaf4ff;
    border-left-color: #1d5c96;
}

.notif-item:hover {
    background: #eaf0f7;
}

.notif-icono {
    font-size: 24px;
    flex-shrink: 0;
}

.notif-contenido {
    flex: 1;
}

.notif-contenido strong {
    color: #15345b;
    display: block;
    margin-bottom: 4px;
}

.notif-contenido p {
    color: #526173;
    font-size: 13px;
    margin: 0;
}

.notif-fecha {
    color: #6b7888;
    font-size: 11px;
    white-space: nowrap;
}

/* Perfil */
.perfil-card {
    max-width: 600px;
}

.perfil-info {
    display: flex;
    gap: 20px;
    align-items: center;
    padding-bottom: 20px;
    border-bottom: 1px solid #e5eaf0;
    margin-bottom: 20px;
}

.avatar {
    width: 80px;
    height: 80px;
    background: #1d5c96;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    color: white;
}

.datos-perfil h3 {
    color: #15345b;
    margin-bottom: 5px;
}

.datos-perfil p {
    color: #526173;
    font-size: 13px;
    margin: 3px 0;
}

.badge-rol {
    display: inline-block;
    background: #1d5c96;
    color: white;
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 11px;
    margin-top: 8px;
}

.perfil-acciones {
    display: flex;
    gap: 10px;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    justify-content: center;
    align-items: center;
}

.modal.activo {
    display: flex;
}

.modal-contenido {
    background: white;
    border-radius: 10px;
    width: 90%;
    max-width: 700px;
    max-height: 85vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #e5eaf0;
    background: #f8fafc;
    border-radius: 10px 10px 0 0;
}

.modal-header h3 {
    color: #15345b;
    margin: 0;
}

.btn-cerrar {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #6b7888;
}

.modal-body {
    padding: 25px;
}

.detalle-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
    font-size: 14px;
}

.detalle-grid strong {
    color: #15345b;
}

.detalle-descripcion h4,
.detalle-respuesta h4,
.chat-area h4 {
    color: #15345b;
    margin: 20px 0 10px 0;
    font-size: 15px;
}

.respuesta-box {
    background: #eaf4ff;
    padding: 15px;
    border-radius: 6px;
    border-left: 3px solid #28649e;
    color: #263445;
    font-size: 14px;
}

/* Secciones (ocultar/mostrar) */
.seccion {
    display: none;
}

.seccion.activa {
    display: block;
}

/* Responsive */
@media (max-width: 900px) {
    .accesos-rapidos {
        grid-template-columns: 1fr;
    }
    .detalle-grid {
        grid-template-columns: 1fr;
    }
}

/* Panel de análisis IA (solo informativo) */
.resultado-ia {
    margin-top: 25px;
    padding: 20px;
    background: linear-gradient(135deg, #eaf4ff 0%, #f0f7ff 100%);
    border-left: 5px solid #28649e;
    border-radius: 8px;
    animation: aparecerIA 0.4s ease;
}

@keyframes aparecerIA {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.resultado-ia h3 {
    color: #15345b;
    margin-bottom: 8px;
    font-size: 17px;
}

.resultado-ia-info {
    color: #526173;
    font-size: 13px;
    margin-bottom: 15px;
    font-style: italic;
}

.grid-resultado {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.resultado-item {
    background: white;
    padding: 12px 15px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.resultado-label {
    font-size: 11px;
    color: #6b7888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
}

.resultado-valor {
    font-size: 15px;
    color: #15345b;
    font-weight: 700;
}

/* Botón deshabilitado hasta que la IA analice */
.btn-primario:disabled {
    background: #b0c4de;
    cursor: not-allowed;
    opacity: 0.7;
}

.btn-primario:not(:disabled):hover {
    background: #15345b;
    transform: translateY(-1px);
}

/* Indicador de "analizando..." */
.analizando {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid #28649e;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-left: 8px;
    vertical-align: middle;
}


/* Tipos de notificación */
.notif-alerta {
    border-left-color: #dc2626 !important;
    background: #fef2f2;
}

.notif-alerta.no-leida {
    background: #fee2e2;
    border-left-color: #b91c1c !important;
}

.notif-exito {
    border-left-color: #16a34a !important;
    background: #f0fdf4;
}

.notif-exito.no-leida {
    background: #dcfce7;
    border-left-color: #15803d !important;
}

.notif-info {
    border-left-color: #28649e !important;
}

/* Efecto hover para indicar que es clickeable */
.notif-item[style*="cursor: pointer"]:hover {
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* Modal pequeño */
.modal-pequeno {
    max-width: 500px;
}

/* Ayuda de campos */
.ayuda-campo {
    display: block;
    margin-top: 6px;
    color: #6b7888;
    font-size: 11px;
    font-style: italic;
}

/* Botón peligro */
.btn-peligro {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
}

.btn-peligro:hover {
    background: #fee2e2;
    border-color: #dc2626;
}

/* Badge de estado Cancelada */
.badge-cancelada {
    background: #f3f4f6;
    color: #6b7280;
    text-decoration: line-through;
}

/* Botón cancelar solicitud */
.btn-cancelar {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s;
}

.btn-cancelar:hover {
    background: #fee2e2;
    border-color: #dc2626;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}


```

### Archivo: `Frontend\css\estilo_areas.css`
```css

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    background-color: #f3f6fa;
    color: #263445;
}

/* ENCABEZADO */
.encabezado {
    background-color: #15345b;
    color: white;
    height: 70px;
    padding: 0 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo h2 {
    font-size: 21px;
}

.usuario {
    display: flex;
    align-items: center;
    gap: 20px;
}

.usuario button {
    background-color: #ffffff;
    color: #15345b;
    border: none;
    padding: 9px 15px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
}

/* CONTENEDOR PRINCIPAL */
.contenedor {
    display: flex;
    min-height: calc(100vh - 70px);
}

/* MENÚ LATERAL */
.sidebar {
    width: 230px;
    background-color: #1d426d;
    padding: 25px 15px;
    color: white;
}

.sidebar h3 {
    font-size: 12px;
    margin-bottom: 20px;
    color: #b9cce2;
    letter-spacing: 1px;
}

.sidebar nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.sidebar nav a {
    text-decoration: none;
    color: white;
    padding: 13px 15px;
    border-radius: 5px;
    transition: 0.2s;
}

.sidebar nav a:hover,
.sidebar nav a.activo {
    background-color: #315c8b;
}

/* CONTENIDO */
.contenido {
    flex: 1;
    padding: 30px;
    overflow-x: auto;
}

.bienvenida {
    margin-bottom: 25px;
}

.bienvenida h1 {
    color: #15345b;
    font-size: 26px;
    margin-bottom: 8px;
}

.bienvenida p {
    color: #6b7888;
    margin-bottom: 12px;
}

.bienvenida h3 {
    color: #28649e;
    font-size: 17px;
}

/* TARJETAS DE ESTADÍSTICAS */
.estadisticas {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 35px;
}

.tarjeta {
    background-color: white;
    padding: 22px;
    border-radius: 8px;
    border-left: 5px solid #28649e;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tarjeta h3 {
    font-size: 14px;
    color: #687789;
    margin-bottom: 12px;
}

.tarjeta p {
    font-size: 30px;
    font-weight: bold;
    color: #15345b;
}

/* SECCIÓN DE SOLICITUDES */
.seccion-solicitudes {
    background-color: white;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.titulo-seccion {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.titulo-seccion h2 {
    color: #15345b;
    font-size: 20px;
}

.titulo-seccion button {
    background-color: #1d5c96;
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 5px;
    cursor: pointer;
}

.titulo-seccion button:hover {
    background-color: #15345b;
}

/* TABLA */
table {
    width: 100%;
    border-collapse: collapse;
    min-width: 650px;
}

thead {
    background-color: #eaf0f7;
}

th, td {
    padding: 15px 12px;
    text-align: left;
    border-bottom: 1px solid #e5eaf0;
    font-size: 14px;
}

th {
    color: #15345b;
}

td {
    color: #526173;
}

/* ADAPTACIÓN A PANTALLAS PEQUEÑAS */
@media (max-width: 900px) {
    .estadisticas {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 600px) {
    .encabezado {
        padding: 0 15px;
    }

    .logo h2 {
        font-size: 16px;
    }

    .usuario {
        gap: 8px;
        font-size: 12px;
    }

    .usuario button {
        padding: 8px;
        font-size: 11px;
    }

    .sidebar {
        width: 150px;
        padding: 20px 8px;
    }

    .sidebar nav a {
        font-size: 13px;
        padding: 12px 8px;
    }

    .contenido {
        padding: 18px 12px;
    }

    .estadisticas {
        gap: 10px;
    }

    .tarjeta {
        padding: 14px;
    }

    .tarjeta p {
        font-size: 24px;
    }

    .seccion-solicitudes {
        padding: 15px;
    }
}


/* ==============================================================================
   ESTILOS PARA MULTI-SECCIONES DEL PANEL DE ADMINISTRADOR (Inicio, Solicitudes, Notificaciones, Perfil)
   ============================================================================== */

.seccion {
    display: none;
}

.seccion.activa {
    display: block;
    animation: aparecerSeccion 0.25s ease forwards;
}

@keyframes aparecerSeccion {
    from {
        opacity: 0;
        transform: translateY(6px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.badge-notif {
    background: #e11d48;
    color: white;
    border-radius: 10px;
    padding: 2px 7px;
    font-size: 11px;
    margin-left: 6px;
    font-weight: bold;
}

/* Barra de Filtros y Búsqueda */
.filtros-admin {
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    background: #ffffff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    margin-bottom: 20px;
}

.filtros-admin .grupo-filtro {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #1e293b;
    font-weight: 500;
}

.filtros-admin select,
.filtros-admin input {
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 13px;
    color: #334155;
    outline: none;
    background: #f8fafc;
}

.filtros-admin select:focus,
.filtros-admin input:focus {
    border-color: #2563eb;
    background: #ffffff;
}

/* Tarjetas de Notificaciones y Alertas */
.lista-notificaciones {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 15px;
}

.notif-card {
    background: #ffffff;
    border-radius: 8px;
    padding: 16px 20px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    border-left: 4px solid #ef4444;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}

.notif-card.alerta {
    border-left-color: #dc2626;
    background: #fffafa;
}

.notif-icono {
    font-size: 24px;
    line-height: 1;
}

.notif-cuerpo {
    flex: 1;
}

.notif-cuerpo h4 {
    font-size: 15px;
    color: #1e293b;
    margin-bottom: 4px;
}

.notif-cuerpo p {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 6px;
}

.notif-meta {
    font-size: 12px;
    color: #94a3b8;
}

/* Tarjeta de Perfil */
.tarjeta-perfil {
    background: #ffffff;
    border-radius: 12px;
    padding: 30px;
    max-width: 600px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.perfil-avatar {
    width: 65px;
    height: 65px;
    background: #15345b;
    color: white;
    font-size: 28px;
    font-weight: bold;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
}

.perfil-grid {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 14px 20px;
    font-size: 14px;
    border-top: 1px solid #e2e8f0;
    padding-top: 20px;
    margin-top: 15px;
}

.perfil-grid .label {
    font-weight: 600;
    color: #64748b;
}

.perfil-grid .valor {
    color: #1e293b;
    font-weight: 500;
}

```

### Archivo: `Frontend\css\estilo_login.css`
```css
/* ==============================================================================
   Estilo de Login y Registro - Sistema Universitario
   Diseño inspirado en tonalidades Azul y Blanco con Glassmorphism y Ondas
   ============================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 20% 20%, #1e3a8a 0%, #0f172a 100%),
                linear-gradient(135deg, #1d4ed8 0%, #0c1a3b 60%, #020617 100%);
    background-color: #0c1a3b;
    position: relative;
    overflow-x: hidden;
    padding: 20px;
}

/* Efectos visuales de fondo (ondas y partículas) */
.bg-waves {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
}

.wave {
    position: absolute;
    width: 200%;
    height: 200%;
    opacity: 0.15;
    background: radial-gradient(ellipse at center, rgba(59, 130, 246, 0.4) 0%, rgba(30, 58, 138, 0) 70%);
    border-radius: 40%;
    animation: flotarOnda 22s infinite linear;
}

.wave:nth-child(1) {
    top: -80%;
    left: -40%;
    animation-duration: 25s;
}

.wave:nth-child(2) {
    bottom: -90%;
    right: -40%;
    opacity: 0.1;
    animation-duration: 35s;
    animation-direction: reverse;
}

@keyframes flotarOnda {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Tarjeta principal con efecto Glassmorphism */
.login-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 440px;
    background: rgba(15, 30, 68, 0.65);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    padding: 40px 35px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                0 0 40px rgba(37, 99, 235, 0.15);
    color: #ffffff;
    transition: all 0.3s ease;
}

/* Encabezado del Card */
.card-header {
    text-align: center;
    margin-bottom: 28px;
}

.card-header h2 {
    font-size: 28px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
}

.card-header p {
    font-size: 13px;
    color: #94a3b8;
    font-weight: 400;
}

/* Grupos de Formulario e Inputs */
.form-group {
    margin-bottom: 18px;
}

.input-container {
    position: relative;
    display: flex;
    align-items: center;
}

.input-container .input-icon {
    position: absolute;
    left: 16px;
    width: 18px;
    height: 18px;
    color: #93c5fd;
    opacity: 0.85;
    pointer-events: none;
    transition: color 0.3s ease;
}

.input-container input,
.input-container select {
    width: 100%;
    padding: 13px 16px 13px 44px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    transition: all 0.25s ease;
}

.input-container input::placeholder {
    color: #94a3b8;
    font-weight: 300;
}

.input-container input:focus,
.input-container select:focus {
    background: rgba(255, 255, 255, 0.18);
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}

/* Estilo para el Dropdown de Facultades */
.input-container select {
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg2+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2393c5fd'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 16px;
    padding-right: 40px;
}

.input-container select option {
    background-color: #0f172a;
    color: #ffffff;
    padding: 10px;
}

/* Opciones extras (Remember me y Olvidaste contraseña) */
.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-top: 5px;
    margin-bottom: 22px;
}

.remember-me {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #cbd5e1;
    user-select: none;
}

.remember-me input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
    border-radius: 4px;
}

.forgot-password {
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s ease;
}

.forgot-password:hover {
    color: #60a5fa;
    text-decoration: underline;
}

/* Botón Principal */
.btn-submit {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border: none;
    border-radius: 12px;
    color: #ffffff;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
    text-transform: uppercase;
}

.btn-submit:hover {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    transform: translateY(-1px);
    box-shadow: 0 8px 22px rgba(59, 130, 246, 0.5);
}

.btn-submit:active {
    transform: translateY(0);
}

/* Pie de tarjeta (Cambiar entre Login y Registro) */
.card-footer {
    text-align: center;
    margin-top: 24px;
    font-size: 13px;
    color: #94a3b8;
}

.card-footer a {
    color: #60a5fa;
    font-weight: 600;
    text-decoration: none;
    margin-left: 4px;
    transition: all 0.2s ease;
}

.card-footer a:hover {
    color: #ffffff;
    text-decoration: underline;
}

/* Mensajes de feedback (Alerta o Éxito) */
.alerta-msg {
    display: none;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 18px;
    text-align: center;
}

.alerta-msg.error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #fca5a5;
    display: block;
}

.alerta-msg.exito {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #86efac;
    display: block;
}

/* Transición suave entre formularios */
.formulario {
    display: none;
    animation: aparecer 0.35s ease forwards;
}

.formulario.activo {
    display: block;
}

@keyframes aparecer {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

```

### Archivo: `Frontend\js\app.js`
```javascript
// ==============================================================================
// Lógica del Panel de Administración / Gerencia (areas.html)
// Conexión y Gestión de Bandejas en Tiempo Real con PostgreSQL y Agente IA
// ==============================================================================

let solicitudesGlobal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarDatosUsuario();
    inicializarBotonCerrarSesion();
    inicializarNavegacionSidebar();
    cargarDatosDashboard();
});

/**
 * Cambia la bandeja visible en el panel del administrador
 */
function cambiarVistaAdmin(vistaId) {
    // 1. Marcar botón activo en el sidebar
    document.querySelectorAll(".sidebar nav a").forEach((a) => {
        a.classList.remove("activo");
        if (a.getAttribute("data-vista") === vistaId) {
            a.classList.add("activo");
        }
    });

    // 2. Ocultar todas las secciones y activar únicamente la seleccionada
    document.querySelectorAll(".seccion-panel").forEach((s) => s.classList.remove("activa"));
    const secTarget = document.getElementById(`vista-${vistaId}`);
    if (secTarget) {
        secTarget.classList.add("activa");
    }

    // 3. Acciones específicas al entrar a cada bandeja
    if (vistaId === "solicitudes") {
        aplicarFiltros();
    } else if (vistaId === "notificaciones") {
        renderizarNotificaciones(solicitudesGlobal);
    }
}

/**
 * Configura los clics de las bandejas laterales del menú principal
 */
function inicializarNavegacionSidebar() {
    const enlaces = document.querySelectorAll(".sidebar nav a");
    enlaces.forEach((enlace) => {
        enlace.addEventListener("click", (e) => {
            e.preventDefault();
            const vista = enlace.getAttribute("data-vista");
            if (vista) {
                cambiarVistaAdmin(vista);
            }
        });
    });
}

/**
 * Carga los datos de la sesión del administrador
 */
function inicializarDatosUsuario() {
    const rawUsuario = sessionStorage.getItem("sicou_usuario");
    const usuario = rawUsuario ? JSON.parse(rawUsuario) : {
        nombre: "administrador",
        correo: "adminsicou@unach.mx",
        rol: "administrador",
        facultad_nombre: "Administración Central"
    };

    // Header
    const spanNombre = document.getElementById("nombreUsuarioAdmin");
    if (spanNombre) spanNombre.textContent = `${usuario.nombre} (${usuario.rol || "Administrador"})`;

    const h3Area = document.getElementById("nombreArea");
    if (h3Area) h3Area.textContent = `Panel Central - ${usuario.facultad_nombre || "Administración Central"}`;

    // Vista de Perfil
    const pNombre = document.getElementById("perfilNombre");
    const pCorreo = document.getElementById("perfilCorreo");
    const pRol = document.getElementById("perfilRol");
    const pFac = document.getElementById("perfilFacultad");

    if (pNombre) pNombre.textContent = usuario.nombre || "Administrador";
    if (pCorreo) pCorreo.textContent = usuario.correo || "adminsicou@unach.mx";
    if (pRol) pRol.textContent = `Rol: ${usuario.rol || "Administrador"}`;
    if (pFac) pFac.textContent = usuario.facultad_nombre || "Administración Central";
}

/**
 * Botón oficial de Cerrar Sesión del encabezado
 */
function inicializarBotonCerrarSesion() {
    const btn = document.getElementById("btnCerrarSesion");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.removeItem("sicou_token");
        sessionStorage.removeItem("sicou_usuario");
        window.location.href = "login.html";
    });
}

/**
 * Consulta a la API para obtener solicitudes y métricas de PostgreSQL
 */
async function cargarDatosDashboard() {
    const tbody = document.getElementById("tablaSolicitudesBody");

    try {

        //1. Recuperar el token de la sesion
        const token = sessionStorage.getItem("sicou_token");

        if (!token){
            console.warn("No se encontró token de sesión.");
            alert("Tu sesión ha expirado o no estás autenticado. Serás redirigido al login.");
            return window.location.href = "login.html";
        }

        // 2. Consultar las solicitudes enviando eltoken
        const respuesta = await fetch("/api/solicitudes", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        // 3. Comprobar si la sesión es válida
        if (respuesta.status === 401) {
            sessionStorage.removeItem("sicou_token");
            sessionStorage.removeItem("sicou_usuario");

            alert("Tu sesión ha expirado. Inicia sesión nuevamente.");
            window.location.href = "login.html";
            return;
        }

        const datos = await respuesta.json();

        if (datos.ok) {
            solicitudesGlobal = datos.solicitudes || [];
        
            // 4. Actualizar tarjetas estadísticas
            const stats = datos.estadisticas || {};

            const elTotal = document.getElementById("totalSolicitudes");
            const elPend = document.getElementById("solicitudesPendientes");
            const elRev = document.getElementById("solicitudesRevision");
            const elRes = document.getElementById("solicitudesResueltas");

            if (elTotal) elTotal.textContent = stats.total || 0;
            if (elPend) elPend.textContent = stats.pendientes || 0;
            if (elRev) elRev.textContent = stats.revision || 0;
            if (elRes) elRes.textContent = stats.resueltas || 0;

            // 5. Renderizar la tabla de solicitudes
            aplicarFiltros();

            // 6. Renderizar alertas de supervisor
            renderizarNotificaciones(solicitudesGlobal);

        } else {
            console.warn("Error en datos:", datos.error);
        }
    
    } catch (error) {
        console.error("Error al consultar API:", error);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center;padding:25px;color:#dc2626;">
                        ⚠️ Servidor no detectado o error de conexión.
                        Verifica que 'python server.py' esté corriendo.
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Filtra y renderiza la tabla de solicitudes
 */
function aplicarFiltros() {
    const tbody = document.getElementById("tablaSolicitudesBody");
    if (!tbody) return;

    const filtroEstado = document.getElementById("filtroEstado") ? document.getElementById("filtroEstado").value : "todos";
    const filtroPrioridad = document.getElementById("filtroPrioridad") ? document.getElementById("filtroPrioridad").value : "todos";
    const buscarTexto = document.getElementById("inputBuscar") ? document.getElementById("inputBuscar").value.trim().toLowerCase() : "";

    let lista = [...solicitudesGlobal];

    if (filtroEstado !== "todos") {
        lista = lista.filter((s) => (s.estado || "Pendiente") === filtroEstado);
    }

    if (filtroPrioridad !== "todos") {
        lista = lista.filter((s) => (s.prioridad || "Baja") === filtroPrioridad);
    }

    if (buscarTexto) {
        lista = lista.filter((s) =>
            (s.folio && s.folio.toLowerCase().includes(buscarTexto)) ||
            (s.alumno_nombre && s.alumno_nombre.toLowerCase().includes(buscarTexto)) ||
            (s.descripcion && s.descripcion.toLowerCase().includes(buscarTexto)) ||
            (s.categoria && s.categoria.toLowerCase().includes(buscarTexto)) ||
            (s.depto_nombre && s.depto_nombre.toLowerCase().includes(buscarTexto))
        );
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#64748b;">No hay solicitudes registradas con estos filtros.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    lista.forEach((s) => {
        const tr = document.createElement("tr");

        // Color según prioridad asignada por IA
        let colorPrio = "#2563eb"; // Baja
        let bgPrio = "#dbeafe";
        if (s.prioridad === "Alta") {
            colorPrio = "#dc2626";
            bgPrio = "#fee2e2";
        } else if (s.prioridad === "Media") {
            colorPrio = "#d97706";
            bgPrio = "#fef3c7";
        }

        // Color de estado
        let colorEstado = "#e0f2fe";
        let textEstado = "#0284c7";
        if (s.estado === "En revisión" || s.estado === "En revision") {
            colorEstado = "#fef9c3";
            textEstado = "#a16207";
        } else if (s.estado === "Resuelta" || s.estado === "Atendida") {
            colorEstado = "#dcfce7";
            textEstado = "#15803d";
        }

        // Badge si tiene alerta para supervisor humano
        const badgeAlerta = s.alerta_supervisor
            ? `<span class="badge-alerta">⚠️ Alerta Supervisor</span>`
            : "";

        tr.innerHTML = `
            <td><strong style="color:#15345b;">${s.folio}</strong></td>
            <td>
                <div style="font-weight:600;color:#1e293b;">${s.alumno_nombre}</div>
                <div style="font-size:12px;color:#64748b;">${s.alumno_facultad || "Sin facultad"}</div>
            </td>
            <td>
                <div style="margin-bottom:4px;">
                    <span style="font-weight:600;color:#15345b;">${s.categoria || "General"}</span>
                    <span style="color:#64748b;font-size:12px;"> → Depto: <strong>${s.depto_nombre || s.canal_destino}</strong></span>
                    ${badgeAlerta}
                </div>
                <div style="color:#475569;font-size:13px;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${s.descripcion}
                </div>
                <div style="margin-top:4px;">
                    <span style="background:${bgPrio};color:${colorPrio};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">
                        Prioridad ${s.prioridad || "Baja"}
                    </span>
                    <span style="font-size:11px;color:#94a3b8;margin-left:6px;">
                        Confianza IA: ${((s.confianza || 0.8) * 100).toFixed(0)}%
                    </span>
                </div>
            </td>
            <td style="font-size:12px;color:#64748b;">${s.fecha || "-"}</td>
            <td>
                <span style="background:${colorEstado};color:${textEstado};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;display:inline-block;">
                    ${s.estado || "Pendiente"}
                </span>
            </td>
            <td>
                <div style="display:flex;gap:6px;align-items:center;">
                    <select onchange="cambiarEstadoDirecto(${s.id}, this.value)" style="padding:5px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;background:#ffffff;cursor:pointer;">
                        <option value="Pendiente" ${s.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option value="En revisión" ${s.estado === "En revisión" || s.estado === "En revision" ? "selected" : ""}>En revisión</option>
                        <option value="Resuelta" ${s.estado === "Resuelta" || s.estado === "Atendida" ? "selected" : ""}>Resuelta</option>
                    </select>
                    <button onclick="verDetalleSolicitudAdmin(${s.id})" style="background:#1d5c96;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">
                        Ver
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * Renderiza la bandeja de Notificaciones (Alertas de supervisor)
 */
function renderizarNotificaciones(solicitudes) {
    const contenedor = document.getElementById("contenedorAlertas");
    const contador = document.getElementById("contadorNotifAdmin");
    if (!contenedor) return;

    const alertas = solicitudes.filter((s) => s.alerta_supervisor);

    if (contador) {
        contador.textContent = alertas.length;
    }

    if (alertas.length === 0) {
        contenedor.innerHTML = `
            <div class="notif-card" style="border-left-color:#16a34a;">
                <div class="notif-icono">✅</div>
                <div class="notif-cuerpo">
                    <h4>Sin alertas pendientes</h4>
                    <p>No existen solicitudes críticas que requieran atención inmediata del supervisor.</p>
                </div>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";

    alertas.forEach((s) => {
        const div = document.createElement("div");
        div.className = "notif-card alerta";
        div.innerHTML = `
            <div class="notif-icono">⚠️</div>
            <div class="notif-cuerpo">
                <h4>Atención Requerida: ${s.folio} - ${s.categoria}</h4>
                <p><strong>Motivo de alerta:</strong> ${s.motivo_alerta || "Caso crítico o baja confianza"}</p>
                <p><strong>Alumno:</strong> ${s.alumno_nombre} (${s.alumno_facultad || ""})</p>
                <div style="margin: 8px 0; font-size:13px; color:#334155;"><em>"${s.descripcion}"</em></div>
                <div class="notif-meta">Canal: ${s.depto_nombre || s.canal_destino} | Fecha: ${s.fecha}</div>
            </div>
            <div>
                <button onclick="verDetalleSolicitudAdmin(${s.id})" style="background:#dc2626;color:white;border:none;padding:7px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">
                    Revisar caso
                </button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

/**
 * Actualiza el estado de una solicitud en PostgreSQL
 */
async function cambiarEstadoDirecto(solicitudId, nuevoEstado) {
    try {
        const token = sessionStorage.getItem("sicou_token");

        const respuesta = await fetch("/api/solicitudes/estado", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                estado: nuevoEstado
            })
        });

        const data = await respuesta.json();
        if (respuesta.ok && data.ok) {
            cargarDatosDashboard();
        } else {
            alert("No se pudo actualizar el estado: " + (data.error || "Error"));
        }
    } catch (e) {
        console.error("Error al actualizar estado:", e);
        alert("Error de conexión al actualizar estado.");
    }
}

/**
 * Muestra el análisis completo del agente IA para la solicitud seleccionada
 */
function verDetalleSolicitudAdmin(solicitudId) {
    const s = solicitudesGlobal.find((x) => x.id === solicitudId);
    if (!s) return;

    let info = `📋 REPORTE DE SOLICITUD ${s.folio}\n\n`;
    info += `👤 Alumno: ${s.alumno_nombre} (${s.alumno_correo || "Sin correo"})\n`;
    info += `🏛️ Facultad: ${s.alumno_facultad || "No especificada"}\n`;
    info += `📅 Fecha: ${s.fecha}\n`;
    info += `📌 Estado actual: ${s.estado}\n\n`;
    info += `----------------------------------------\n`;
    info += `🤖 ANÁLISIS DEL AGENTE DE INTELIGENCIA ARTIFICIAL:\n`;
    info += `📂 Categoría (Machine Learning): ${s.categoria}\n`;
    info += `⚡ Prioridad (Motor de Reglas): ${s.prioridad}\n`;
    info += `🏢 Departamento destino: ${s.depto_nombre || s.canal_destino}\n`;
    info += `🎯 Nivel de confianza: ${((s.confianza || 0) * 100).toFixed(1)}%\n`;
    info += `⚠️ Alerta a supervisor: ${s.alerta_supervisor ? "SÍ -> " + (s.motivo_alerta || "Atención inmediata") : "No requerida"}\n\n`;
    info += `----------------------------------------\n`;
    info += `📝 DESCRIPCIÓN:\n${s.descripcion}`;

    alert(info);
}

// Exportar funciones para los atributos inline del HTML
window.cambiarVistaAdmin = cambiarVistaAdmin;
window.aplicarFiltros = aplicarFiltros;
window.cambiarEstadoDirecto = cambiarEstadoDirecto;
window.verDetalleSolicitudAdmin = verDetalleSolicitudAdmin;

```

### Archivo: `Frontend\js\dashboard_alumno.js`
```javascript
// ==============================================================================
// Lógica del Dashboard de Alumno - Conectado con Agente IA y PostgreSQL
// ==============================================================================

let listaSolicitudesMemoria = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosUsuario();
    cargarEstadisticas();
    cargarMisSolicitudes();
    cargarNotificaciones();
    inicializarNavegacion();
    inicializarFormulario();
});

// ========== NAVEGACIÓN ENTRE SECCIONES ==========
function inicializarNavegacion() {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const seccion = link.getAttribute('data-seccion');
            if (seccion) cambiarSeccion(seccion);
        });
    });

    // Cerrar sesión
    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            sessionStorage.removeItem('sicou_usuario');
            sessionStorage.removeItem('sicou_token');
            window.location.href = 'login.html';
        });
    }
}

function cambiarSeccion(seccion) {
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('activo'));
    const linkActivo = document.querySelector(`.sidebar nav a[data-seccion="${seccion}"]`);
    if (linkActivo) linkActivo.classList.add('activo');
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    const secTarget = document.getElementById(`sec-${seccion}`);
    if (secTarget) secTarget.classList.add('activa');
    
    if (seccion === 'solicitudes') {
        cargarMisSolicitudes();
    }
    if (seccion === 'notificaciones') {
        cargarNotificaciones();
    }
}

// ========== DATOS DE USUARIO ==========
function obtenerUsuarioActual() {
    return JSON.parse(sessionStorage.getItem('sicou_usuario') || '{}');
}

function obtenerToken() {
    return sessionStorage.getItem('sicou_token');
}

function cargarDatosUsuario() {
    const usuario = obtenerUsuarioActual();
    const spanNombre = document.getElementById('nombreUsuario');
    const spanFacultad = document.getElementById('facultadUsuario');
    const areaAlumno = document.getElementById('areaAlumno');

    if (spanNombre) spanNombre.textContent = usuario.nombre || 'Alumno';
    if (spanFacultad) spanFacultad.textContent = usuario.facultad_nombre || 'Facultad';
    if (areaAlumno) areaAlumno.textContent = usuario.facultad_nombre || 'Área Académica';

    const pNombre = document.getElementById('perfilNombre');
    const pCorreo = document.getElementById('perfilCorreo');
    const pFacultad = document.getElementById('perfilFacultad');

    if (pNombre) pNombre.textContent = usuario.nombre || '-';
    if (pCorreo) pCorreo.textContent = usuario.correo || '-';
    if (pFacultad) pFacultad.textContent = usuario.facultad_nombre || '-';
}

// ========== ESTADÍSTICAS ==========
async function cargarEstadisticas() {
    const usuario = obtenerUsuarioActual();
    const token = obtenerToken();

    if (!usuario.id || !token) return;

    try {
        const res = await fetch('/api/solicitudes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            alert('Tu sesión expiró. Inicia sesión nuevamente.');
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();

        if (data.ok && data.estadisticas) {
            const stats = data.estadisticas;

            document.getElementById('statPendientes').textContent = stats.pendientes || 0;
            document.getElementById('statRevision').textContent = stats.revision || 0;
            document.getElementById('statResueltas').textContent = stats.resueltas || 0;
            document.getElementById('statTotal').textContent = stats.total || 0;
        }
    } catch (e) {
        console.warn("No se pudieron cargar estadísticas en vivo:", e);
    }
}

// ========== SOLICITUDES ==========
async function cargarMisSolicitudes(filtros = {}) {
    const tbody = document.getElementById('tablaMisSolicitudes');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Cargando solicitudes...</td></tr>';

    const token = obtenerToken();

    if (!token) {
        alert('Sesión no detectada. Inicia sesión nuevamente.');
        window.location.href = 'login.html';
        return;
    }

    let url = '/api/solicitudes';

    if (filtros.estado && filtros.estado !== 'todos') {
        url += `?estado=${encodeURIComponent(filtros.estado)}`;
    }

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            alert('Tu sesión expiró. Inicia sesión nuevamente.');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();

        if (data.ok && data.solicitudes) {
            listaSolicitudesMemoria = data.solicitudes;
            renderizarTablaSolicitudes(listaSolicitudesMemoria, filtros);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7888;padding:30px;">No tienes solicitudes registradas aún.</td></tr>';
        }
    } catch (e) {
        console.warn("Modo local o sin conexión:", e);
        renderizarTablaSolicitudes(listaSolicitudesMemoria, filtros);
    }
}

function renderizarTablaSolicitudes(solicitudes, filtros = {}) {
    const tbody = document.getElementById('tablaMisSolicitudes');
    if (!tbody) return;
    tbody.innerHTML = '';

    let datos = [...solicitudes];
    if (filtros.prioridad && filtros.prioridad !== 'todos') {
        datos = datos.filter(s => s.prioridad === filtros.prioridad);
    }

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7888;padding:30px;">No hay solicitudes registradas con estos filtros.</td></tr>';
        return;
    }

    datos.forEach(s => {
    const tr = document.createElement('tr');
    const prioClase = (s.prioridad || 'media').toLowerCase();
    
    // Botón de cancelar: solo visible si está Pendiente
    const puedeCancelar = (s.estado === 'Pendiente');
    const btnCancelar = puedeCancelar 
        ? `<button class="btn-cancelar" onclick="cancelarSolicitud('${s.folio}')" title="Cancelar solicitud">✕ Cancelar</button>`
        : '';
    
    tr.innerHTML = `
        <td><strong>${s.folio}</strong></td>
        <td>${s.categoria || 'General'}</td>
        <td>${s.descripcion}</td>
        <td>${s.fecha || '-'}</td>
        <td><span class="badge badge-${prioClase}">${s.prioridad || 'Media'}</span></td>
        <td><span class="badge ${getClaseEstado(s.estado)}">${s.estado || 'Pendiente'}</span></td>
        <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-ver" onclick="verDetalle('${s.folio}')">Ver</button>
                ${btnCancelar}
            </div>
        </td>
    `;
    tbody.appendChild(tr);
});
}

function getClaseEstado(estado) {
    const clases = {
        'Pendiente': 'badge-pendiente',
        'En revisión': 'badge-revision',
        'En revision': 'badge-revision',
        'Atendida': 'badge-atendida',
        'Resuelta': 'badge-atendida',
        'Cancelada': 'badge-cancelada'
    };
    return clases[estado] || 'badge-pendiente';
}

function aplicarFiltros() {
    const estado = document.getElementById('filtroEstado').value;
    const prioridad = document.getElementById('filtroPrioridad').value;
    cargarMisSolicitudes({ estado, prioridad });
}

// ========== DETALLE / MODAL ==========
function verDetalle(folio) {
    const s = listaSolicitudesMemoria.find(x => x.folio === folio);
    if (!s) return;

    document.getElementById('modalFolio').textContent = s.folio;
    document.getElementById('modalTipo').textContent = s.categoria || 'General';
    document.getElementById('modalPrioridad').textContent = s.prioridad || 'Media';
    document.getElementById('modalEstado').textContent = s.estado || 'Pendiente';
    document.getElementById('modalDepto').textContent = s.depto_nombre || s.canal_destino || 'Servicios Escolares';
    document.getElementById('modalDescripcion').textContent = s.descripcion;

    const seccionResp = document.getElementById('seccionRespuesta');
    if (s.motivo_alerta && s.alerta_supervisor) {
        seccionResp.style.display = 'block';
        document.getElementById('modalRespuesta').textContent = `Alerta al supervisor: ${s.motivo_alerta}`;
    } else {
        seccionResp.style.display = 'none';
    }

    document.getElementById('modalDetalle').classList.add('activo');
}



// ========== NOTIFICACIONES (versión real conectada a BD) ==========
const STORAGE_KEY_LEIDAS = 'sicou_notificaciones_leidas';

function obtenerNotificacionesLeidas() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_LEIDAS) || '[]');
    } catch {
        return [];
    }
}

function marcarNotificacionLeida(idNotif) {
    const leidas = obtenerNotificacionesLeidas();
    if (!leidas.includes(idNotif)) {
        leidas.push(idNotif);
        localStorage.setItem(STORAGE_KEY_LEIDAS, JSON.stringify(leidas));
    }
}

function obtenerTipoNotificacion(texto) {
    const t = texto.toLowerCase();
    if (t.includes('alerta') || t.includes('crítico') || t.includes('revisar')) {
        return { icono: '⚠️', clase: 'notif-alerta' };
    }
    if (t.includes('canalizada correctamente') || t.includes('éxito') || t.includes('resuelta') || t.includes('atendida')) {
        return { icono: '✅', clase: 'notif-exito' };
    }
    if (t.includes('revisión') || t.includes('revisando')) {
        return { icono: '🔍', clase: 'notif-info' };
    }
    return { icono: '📩', clase: 'notif-info' };
}

async function cargarNotificaciones() {
    const cont = document.getElementById('listaNotificaciones');
    const contador = document.getElementById('contadorNotif');
    if (!cont) return;

    // Mostrar estado de carga
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7888;">Cargando notificaciones...</div>';

    const token = sessionStorage.getItem('sicou_token');
    if (!token) {
        cont.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;">Sesión no detectada.</div>';
        return;
    }

    try {
        const res = await fetch('/api/solicitudes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();
        const leidas = obtenerNotificacionesLeidas();
        let noLeidas = 0;

        if (!data.ok || !data.solicitudes || data.solicitudes.length === 0) {
            cont.innerHTML = `
                <div class="notif-item">
                    <div class="notif-icono">📭</div>
                    <div class="notif-contenido">
                        <strong>Sin notificaciones</strong>
                        <p>Aún no tienes notificaciones. Cuando envíes una solicitud, aparecerán aquí.</p>
                    </div>
                </div>
            `;
            if (contador) contador.textContent = '0';
            return;
        }

        // Construir lista de notificaciones desde las solicitudes
        const notifs = [];
        data.solicitudes.forEach(s => {
            // Parsear el campo notificaciones (viene como string JSON o array)
            let listaNotifs = [];
            try {
                if (typeof s.notificaciones === 'string') {
                    listaNotifs = JSON.parse(s.notificaciones);
                } else if (Array.isArray(s.notificaciones)) {
                    listaNotifs = s.notificaciones;
                }
            } catch (e) {
                listaNotifs = [];
            }

            listaNotifs.forEach((texto, idx) => {
                if (!texto.toLowerCase().includes('solicitante')) {
                return; // Saltar notificaciones que son para el departamento
                }
    
                const idNotif = `${s.folio}-${idx}`;
                const tipo = obtenerTipoNotificacion(texto);
                const yaLeida = leidas.includes(idNotif);

                if (!yaLeida) noLeidas++;

                notifs.push({
                    id: idNotif,
                    texto: texto,
                    folio: s.folio,
                    fecha: s.fecha || '-',
                    estado: s.estado || 'Pendiente',
                    icono: tipo.icono,
                    clase: tipo.clase,
                    leida: yaLeida
                });
            });
        });

        // Ordenar: primero las no leídas
        notifs.sort((a, b) => (a.leida - b.leida));

        // Renderizar
        if (notifs.length === 0) {
            cont.innerHTML = `
                <div class="notif-item">
                    <div class="notif-icono">📭</div>
                    <div class="notif-contenido">
                        <strong>Sin notificaciones</strong>
                        <p>Aún no tienes notificaciones. Cuando envíes una solicitud, aparecerán aquí.</p>
                    </div>
                </div>
            `;
        } else {
            cont.innerHTML = '';
            notifs.forEach(n => {
                const div = document.createElement('div');
                div.className = `notif-item ${n.leida ? '' : 'no-leida'} ${n.clase}`;
                div.style.cursor = 'pointer';
                div.title = 'Clic para marcar como leída';
                div.innerHTML = `
                    <div class="notif-icono">${n.icono}</div>
                    <div class="notif-contenido">
                        <strong>${n.folio} - ${n.estado}</strong>
                        <p>${n.texto}</p>
                    </div>
                    <div class="notif-fecha">${n.fecha}</div>
                `;
                div.addEventListener('click', () => {
                    if (!n.leida) {
                        marcarNotificacionLeida(n.id);
                        div.classList.remove('no-leida');
                        n.leida = true;
                        noLeidas = Math.max(0, noLeidas - 1);
                        if (contador) contador.textContent = noLeidas;
                    }
                });
                cont.appendChild(div);
            });
        }

        if (contador) contador.textContent = noLeidas;

    } catch (e) {
        console.warn("Error al cargar notificaciones:", e);
        cont.innerHTML = `
            <div class="notif-item">
                <div class="notif-icono">⚠️</div>
                <div class="notif-contenido">
                    <strong>Error de conexión</strong>
                    <p>No se pudieron cargar las notificaciones. Verifica que el servidor esté corriendo.</p>
                </div>
            </div>
        `;
        if (contador) contador.textContent = '0';
    }
}

// ========== FORMULARIO NUEVA SOLICITUD ==========
function inicializarFormulario() {
    const form = document.getElementById('formNuevaSolicitud');
    const descripcion = document.getElementById('descripcion');
    const btnEnviar = document.getElementById('btnEnviar');
    let analisisTimeout;
    let iaAnalisis = null;

    if (!form || !descripcion || !btnEnviar) return;

    // Análisis en tiempo real con el Agente de IA mientras escribe (debounce 1.2s)
    descripcion.addEventListener('input', () => {
        clearTimeout(analisisTimeout);
        const texto = descripcion.value.trim();

        if (texto.length < 15) {
            document.getElementById('resultadoIA').style.display = 'none';
            btnEnviar.disabled = true;
            iaAnalisis = null;
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Analizando con IA...';

        analisisTimeout = setTimeout(async () => {
            iaAnalisis = await analizarConIA(texto);
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }, 1200);
    });

    // Envío oficial de la solicitud a PostgreSQL
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = descripcion.value.trim();

        if (!texto) {
            alert('Por favor describe tu problema o solicitud.');
            return;
        }

        const usuario = obtenerUsuarioActual();
        if (!usuario.id) {
            alert('Sesión no detectada. Por favor vuelve a iniciar sesión.');
            window.location.href = 'login.html';
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Canalizando solicitud...';

        try {
            const token = obtenerToken();

            const respuesta = await fetch('/api/solicitudes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    descripcion: texto
                })
            });

            const data = await respuesta.json();

            if (respuesta.ok && data.ok) {
                const a = data.analisis;
                alert(`✅ ¡Solicitud enviada y clasificada con éxito!\n\n` +
                      `📌 Folio: SOL-${String(data.solicitud_id).padStart(3, '0')}\n` +
                      `📂 Categoría: ${a.categoria}\n` +
                      `⚡ Prioridad asignada: ${a.prioridad}\n` +
                      `🏢 Departamento destino: ${a.canal}\n` +
                      `🎯 Confianza IA: ${(a.confianza * 100).toFixed(0)}%\n\n` +
                      `La solicitud ya se encuentra disponible para el departamento correspondiente y el administrador.`);

                form.reset();
                document.getElementById('resultadoIA').style.display = 'none';
                btnEnviar.disabled = true;
                iaAnalisis = null;

                // Actualizar estadísticas y tabla
                cargarEstadisticas();
                cargarMisSolicitudes();
                cargarNotificaciones();
                cambiarSeccion('solicitudes');
            } else {
                alert('❌ Error al registrar solicitud: ' + (data.error || 'Intenta de nuevo.'));
            }
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            alert('⚠️ No se pudo comunicar con el servidor backend. Verifica que esté corriendo: python server.py');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    });
}

/**
 * Consulta al endpoint /api/analizar que ejecuta el Agente IA de Python
 */
async function analizarConIA(texto) {
    try {
        const respuesta = await fetch('/api/analizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto })
        });

        const data = await respuesta.json();
        if (respuesta.ok && data.ok) {
            mostrarResultadoIA(data);
            return data;
        }
    } catch (e) {
        console.warn("Fallo análisis remoto, usando estimación local:", e);
    }

    // Fallback si el servidor está desconectado
    const local = estimacionLocalIA(texto);
    mostrarResultadoIA(local);
    return local;
}

function mostrarResultadoIA(res) {
    document.getElementById('iaCategoria').textContent = res.categoria || 'General';
    document.getElementById('iaPrioridad').textContent = res.prioridad || 'Media';
    document.getElementById('iaCanal').textContent = res.canal || 'Servicios Escolares';
    document.getElementById('iaConfianza').textContent = ((res.confianza || 0.8) * 100).toFixed(0) + '%';
    document.getElementById('resultadoIA').style.display = 'block';

    const elemPrioridad = document.getElementById('iaPrioridad');
    elemPrioridad.className = 'resultado-valor';
    if (res.prioridad === 'Alta') {
        elemPrioridad.style.color = '#dc2626';
    } else if (res.prioridad === 'Media') {
        elemPrioridad.style.color = '#d97706';
    } else {
        elemPrioridad.style.color = '#15345b';
    }
}

function estimacionLocalIA(texto) {
    const t = texto.toLowerCase();
    if (t.includes('calificacion') || t.includes('nota') || t.includes('examen')) {
        return { categoria: 'Académica', prioridad: 'Baja', canal: 'Servicios Escolares', confianza: 0.82 };
    }
    if (t.includes('red') || t.includes('plataforma') || t.includes('contraseña') || t.includes('sistema')) {
        return { categoria: 'Soporte Técnico', prioridad: 'Alta', canal: 'Soporte Técnico', confianza: 0.89 };
    }
    if (t.includes('beca') || t.includes('pago') || t.includes('colegiatura')) {
        return { categoria: 'Financiera/Becas', prioridad: 'Media', canal: 'Caja y Finanzas', confianza: 0.85 };
    }
    if (t.includes('acoso') || t.includes('amenaza') || t.includes('urgente') || t.includes('violencia')) {
        return { categoria: 'Bienestar Universitario', prioridad: 'Alta', canal: 'Bienestar Universitario', confianza: 0.95 };
    }
    return { categoria: 'Servicios Escolares', prioridad: 'Media', canal: 'Servicios Escolares', confianza: 0.75 };
}

// ========== PERFIL ==========

// Función para abrir modales
function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.add('activo');
        
        // Si es el modal de editar datos, cargar los datos actuales
        if (idModal === 'modalEditarDatos') {
            const usuario = obtenerUsuarioActual();
            document.getElementById('editNombre').value = usuario.nombre || '';
            document.getElementById('editCorreo').value = usuario.correo || '';
        }
    }
}

function cerrarModal(idModal = 'modalDetalle') {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.remove('activo');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}
// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('activo');
    }
});

// Manejar formulario de cambiar contraseña
document.addEventListener('DOMContentLoaded', () => {
    const formPassword = document.getElementById('formCambiarPassword');
    if (formPassword) {
        formPassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const passwordActual = document.getElementById('passwordActual').value;
            const passwordNueva = document.getElementById('passwordNueva').value;
            const passwordConfirmar = document.getElementById('passwordConfirmar').value;
            
            if (passwordNueva !== passwordConfirmar) {
                alert('❌ Las contraseñas nuevas no coinciden');
                return;
            }
            
            if (passwordNueva.length < 6) {
                alert('❌ La contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            const token = obtenerToken();
            if (!token) {
                alert('Sesión no detectada. Inicia sesión nuevamente.');
                return;
            }
            
            try {
                const respuesta = await fetch('/api/usuario/password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        password_actual: passwordActual,
                        password_nueva: passwordNueva
                    })
                });
                
                const data = await respuesta.json();
                
                if (respuesta.ok && data.ok) {
                    alert('✅ Contraseña actualizada correctamente');
                    cerrarModal('modalCambiarPassword');
                } else {
                    alert('❌ ' + (data.mensaje || data.error || 'Error al cambiar contraseña'));
                }
            } catch (error) {
                console.error('Error al cambiar contraseña:', error);
                alert('⚠️ No se pudo comunicar con el servidor');
            }
        });
    }
    
    // Manejar formulario de editar datos
    const formEditar = document.getElementById('formEditarDatos');
    if (formEditar) {
        formEditar.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nuevoNombre = document.getElementById('editNombre').value.trim();
            const nuevoCorreo = document.getElementById('editCorreo').value.trim();
            
            const token = obtenerToken();
            if (!token) {
                alert('Sesión no detectada. Inicia sesión nuevamente.');
                return;
            }
            
            try {
                const respuesta = await fetch('/api/usuario/datos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nombre: nuevoNombre,
                        correo: nuevoCorreo
                    })
                });
                
                const data = await respuesta.json();
                
                if (respuesta.ok && data.ok) {
                    // Actualizar en sessionStorage
                    const usuario = obtenerUsuarioActual();
                    usuario.nombre = nuevoNombre;
                    usuario.correo = nuevoCorreo;
                    sessionStorage.setItem('sicou_usuario', JSON.stringify(usuario));
                    
                    // Actualizar vista
                    cargarDatosUsuario();
                    
                    alert('✅ Datos actualizados correctamente');
                    cerrarModal('modalEditarDatos');
                } else {
                    alert('❌ ' + (data.mensaje || data.error || 'Error al actualizar datos'));
                }
            } catch (error) {
                console.error('Error al editar datos:', error);
                alert('⚠️ No se pudo comunicar con el servidor');
            }
        });
    }
});

// ========== CANCELAR SOLICITUD ==========
async function cancelarSolicitud(folio) {
    // Buscar la solicitud en memoria
    const s = listaSolicitudesMemoria.find(x => x.folio === folio);
    if (!s) {
        alert('❌ No se encontró la solicitud.');
        return;
    }
    
    // Validar estado
    if (s.estado !== 'Pendiente') {
        alert(`❌ No se puede cancelar una solicitud en estado "${s.estado}".\nSolo se pueden cancelar solicitudes pendientes.`);
        return;
    }
    
    // Confirmación
    const confirmar = confirm(
        `¿Estás seguro de que deseas cancelar la solicitud ${folio}?\n\n` +
        `Descripción: ${s.descripcion.substring(0, 100)}${s.descripcion.length > 100 ? '...' : ''}\n\n` +
        `⚠️ Esta acción no se puede deshacer.`
    );
    
    if (!confirmar) return;
    
    const token = obtenerToken();
    if (!token) {
        alert('Sesión no detectada. Inicia sesión nuevamente.');
        return;
    }
    
    try {
        const respuesta = await fetch('/api/solicitudes/cancelar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ solicitud_id: s.id })
        });
        
        const data = await respuesta.json();
        
        if (respuesta.ok && data.ok) {
            alert('✅ ' + (data.mensaje || 'Solicitud cancelada correctamente.'));
            // Recargar tabla y estadísticas
            cargarEstadisticas();
            cargarMisSolicitudes();
            cargarNotificaciones();
        } else {
            alert('❌ ' + (data.mensaje || data.error || 'Error al cancelar la solicitud.'));
        }
    } catch (error) {
        console.error('Error al cancelar solicitud:', error);
        alert('⚠️ No se pudo comunicar con el servidor.');
    }
}
```

### Archivo: `Frontend\js\login.js`
```javascript
// ==============================================================================
// Lógica de interacción para Login y Registro - Conexión con PostgreSQL / API
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
    const seccionLogin = document.getElementById("seccionLogin");
    const seccionRegistro = document.getElementById("seccionRegistro");
    const linkIrRegistro = document.getElementById("linkIrRegistro");
    const linkIrLogin = document.getElementById("linkIrLogin");
    const mensajeAlerta = document.getElementById("mensajeAlerta");

    const formLogin = document.getElementById("formLogin");
    const formRegistro = document.getElementById("formRegistro");

    // Función para mostrar alertas estilizadas
    function mostrarMensaje(texto, tipo = "error") {
        mensajeAlerta.textContent = texto;
        mensajeAlerta.className = `alerta-msg ${tipo}`;
        mensajeAlerta.style.display = "block";

        setTimeout(() => {
            mensajeAlerta.style.display = "none";
        }, 4000);
    }

    // Alternar a formulario de Registro
    linkIrRegistro.addEventListener("click", (e) => {
        e.preventDefault();
        mensajeAlerta.style.display = "none";
        seccionLogin.classList.remove("activo");
        seccionRegistro.classList.add("activo");
    });

    // Alternar a formulario de Login
    linkIrLogin.addEventListener("click", (e) => {
        e.preventDefault();
        mensajeAlerta.style.display = "none";
        seccionRegistro.classList.remove("activo");
        seccionLogin.classList.add("activo");
    });

    // Cargar correo recordado si existe
    const correoGuardado = localStorage.getItem("sicou_remember_email");
    if (correoGuardado) {
        const inputCorreo = document.getElementById("loginCorreo");
        const checkRemember = document.getElementById("rememberMe");
        if (inputCorreo && checkRemember) {
            inputCorreo.value = correoGuardado;
            checkRemember.checked = true;
        }
    }

    // Manejo de envío de LOGIN
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const correo = document.getElementById("loginCorreo").value.trim();
        const contrasena = document.getElementById("loginPassword").value;
        const facultad_id = document.getElementById("loginFacultad").value;
        const rememberMe = document.getElementById("rememberMe").checked;

        if (!correo || !contrasena || !facultad_id) {
            mostrarMensaje("Por favor completa todos los campos, incluida la facultad.", "error");
            return;
        }

        try {
            const respuesta = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ correo, contrasena, facultad_id })
            });

            const datos = await respuesta.json();

            console.log("Usuario recibido:", datos.usuario);
            console.log("Rol recibido:", datos.usuario?.rol);

            if (respuesta.ok && datos.ok) {
                if (rememberMe) {
                    localStorage.setItem("sicou_remember_email", correo);
                } else {
                    localStorage.removeItem("sicou_remember_email");
                }

                
                // Guardar token y datos de sesión
                sessionStorage.setItem("sicou_token", datos.token);

                console.log("Token guardado:", sessionStorage.getItem("sicou_token"));
                console.log("Rol guardado:", datos.usuario.rol);
                
                sessionStorage.setItem("sicou_usuario", JSON.stringify(datos.usuario));

                mostrarMensaje(`¡Bienvenido/a, ${datos.usuario.nombre}! Redirigiendo...`, "exito");
                
                setTimeout(() => {
                    const rol = (datos.usuario.rol || "")
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .trim()
                        .replace(/\s+/g, "_");

                    console.log("Rol del usuario autenticado:", rol);

                    if (
                        rol === "administrador" ||
                        rol === "admin" ||
                        rol === "gerente_area" ||
                        rol === "gerente_de_area"
                    ) {
                        window.location.href = "areas.html";
                    } else {
                        window.location.href = "dashboard_alumno.html";
                    }
                }, 1200);
            } else {
                mostrarMensaje(datos.mensaje || datos.error || "Credenciales incorrectas", "error");
            }
        } catch (error) {
            console.warn("API no disponible, modo sin conexión:", error);
            mostrarMensaje("Servidor backend no detectado. Para conectar a PostgreSQL ejecuta: python server.py", "error");
        }
    });

    // Manejo de envío de REGISTRO
    formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("regNombre").value.trim();
        const correo = document.getElementById("regCorreo").value.trim();
        const contrasena = document.getElementById("regPassword").value;
        const facultad_id = document.getElementById("regFacultad").value;

        if (!nombre || !correo || !contrasena || !facultad_id) {
            mostrarMensaje("Todos los datos y la selección de facultad son obligatorios.", "error");
            return;
        }

        try {
            const respuesta = await fetch("/api/registro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, correo, contrasena, facultad_id })
            });

            const datos = await respuesta.json();

            if (respuesta.ok && datos.ok) {
                mostrarMensaje("¡Usuario registrado con éxito! Ahora inicia sesión.", "exito");
                formRegistro.reset();

                setTimeout(() => {
                    seccionRegistro.classList.remove("activo");
                    seccionLogin.classList.add("activo");
                    document.getElementById("loginCorreo").value = correo;
                    document.getElementById("loginFacultad").value = facultad_id;
                }, 1500);
            } else {
                mostrarMensaje(datos.mensaje || datos.error || "Error al registrar usuario", "error");
            }
        } catch (error) {
            console.warn("API no disponible, modo sin conexión:", error);
            mostrarMensaje("Servidor backend no detectado. Para conectar a PostgreSQL ejecuta: python server.py", "error");
        }
    });
});

```

### Archivo: `Frontend\pages\areas.html`
```html
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Universitario | Panel de Administración</title>
    <link rel="stylesheet" href="../css/estilo_areas.css">

    <!-- Estilos directos para garantizar que solo se muestre la bandeja seleccionada -->
    <style>
        .seccion-panel {
            display: none !important;
        }
        .seccion-panel.activa {
            display: block !important;
        }

        /* Buscador y filtros limpios en la bandeja de solicitudes */
        .barra-herramientas {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: center;
            background: #ffffff;
            padding: 14px 18px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #e2e8f0;
        }

        .barra-herramientas select,
        .barra-herramientas input {
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
            background: #f8fafc;
        }

        .barra-herramientas input:focus,
        .barra-herramientas select:focus {
            border-color: #1d5c96;
            background: #ffffff;
        }

        .badge-alerta {
            background: #fee2e2;
            color: #b91c1c;
            border: 1px solid #f87171;
            padding: 2px 7px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            margin-left: 6px;
        }
    </style>
</head>

<body>

    <!-- Encabezado con el único botón oficial de Cerrar sesión -->
    <header class="encabezado">
        <div class="logo">
            <h2>Sistema Universitario</h2>
        </div>

        <div class="usuario">
            <span id="nombreUsuarioAdmin">Administrador</span>
            <button id="btnCerrarSesion">Cerrar sesión</button>
        </div>
    </header>

    <div class="contenedor">

        <!-- Menú lateral -->
        <aside class="sidebar">
            <h3>MENÚ PRINCIPAL</h3>
            <nav id="menuSidebar">
                <a href="#" class="activo" data-vista="inicio">Inicio</a>
                <a href="#" data-vista="solicitudes">Solicitudes</a>
                <a href="#" data-vista="notificaciones">Notificaciones <span class="badge-notif" id="contadorNotifAdmin">0</span></a>
                <a href="#" data-vista="perfil">Mi perfil</a>
            </nav>
        </aside>

        <!-- Contenido dinámico según la opción seleccionada -->
        <main class="contenido">

            <!-- ======================================================== -->
            <!-- BANDEJA 1: INICIO (Estadísticas y Resumen Ejecutivo)     -->
            <!-- ======================================================== -->
            <section id="vista-inicio" class="seccion-panel activa">
                <div class="bienvenida">
                    <h1>Panel de Gerencia</h1>
                    <p>Bienvenido al sistema de clasificación y canalización de solicitudes universitarias.</p>
                    <h3 id="nombreArea">Área Administrativa Central</h3>
                </div>

                <div class="estadisticas">
                    <div class="tarjeta">
                        <h3>Total de solicitudes</h3>
                        <p id="totalSolicitudes">0</p>
                    </div>

                    <div class="tarjeta">
                        <h3>Pendientes</h3>
                        <p id="solicitudesPendientes">0</p>
                    </div>

                    <div class="tarjeta">
                        <h3>En revisión</h3>
                        <p id="solicitudesRevision">0</p>
                    </div>

                    <div class="tarjeta">
                        <h3>Resueltas</h3>
                        <p id="solicitudesResueltas">0</p>
                    </div>
                </div>

                <!-- Tarjeta de estado del sistema -->
                <div class="seccion-solicitudes" style="margin-top: 25px;">
                    <div class="titulo-seccion">
                        <h2>Estado del Agente Inteligente</h2>
                    </div>
                    <div style="font-size: 14px; color: #475569; line-height: 1.8;">
                        <p>✔ <strong>Modelo de Clasificación (ML):</strong> TF-IDF + Regresión Logística (Activo y entrenado).</p>
                        <p>✔ <strong>Conocimiento Simbólico:</strong> Grafo de Ontología con NetworkX y Motor de Reglas SI-ENTONCES.</p>
                        <p>✔ <strong>Supervisión Humana:</strong> Detección automática de criticidad y canalización por departamentos.</p>
                        <div style="margin-top: 15px;">
                            <button onclick="cambiarVistaAdmin('solicitudes')" style="background:#1d5c96;color:white;border:none;padding:10px 18px;border-radius:6px;cursor:pointer;font-weight:600;">
                                Ir a la Bandeja de Solicitudes →
                            </button>
                        </div>
                    </div>
                </div>
            </section>


            <!-- ======================================================== -->
            <!-- BANDEJA 2: SOLICITUDES (Bandeja Completa y Única)        -->
            <!-- ======================================================== -->
            <section id="vista-solicitudes" class="seccion-panel">
                <div class="bienvenida">
                    <h1>Bandeja de Solicitudes</h1>
                    <p>Administra, filtra y canaliza todas las solicitudes registradas por los estudiantes.</p>
                </div>

                <!-- Barra de Herramientas de Filtros y Búsqueda -->
                <div class="barra-herramientas">
                    <div>
                        <label for="filtroEstado" style="font-size:13px; font-weight:600; color:#1e293b;">Estado:</label>
                        <select id="filtroEstado" onchange="aplicarFiltros()">
                            <option value="todos">Todos los estados</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="En revisión">En revisión</option>
                            <option value="Resuelta">Resuelta</option>
                        </select>
                    </div>

                    <div>
                        <label for="filtroPrioridad" style="font-size:13px; font-weight:600; color:#1e293b;">Prioridad:</label>
                        <select id="filtroPrioridad" onchange="aplicarFiltros()">
                            <option value="todos">Todas las prioridades</option>
                            <option value="Alta">Alta</option>
                            <option value="Media">Media</option>
                            <option value="Baja">Baja</option>
                        </select>
                    </div>

                    <div style="flex:1;">
                        <input type="text" id="inputBuscar" placeholder="🔍 Buscar por alumno, folio o palabras clave..." oninput="aplicarFiltros()" style="width:100%;">
                    </div>
                </div>

                <!-- Tabla Principal de Solicitudes -->
                <div class="seccion-solicitudes">
                    <table>
                        <thead>
                            <tr>
                                <th>Folio</th>
                                <th>Alumno y Facultad</th>
                                <th>Solicitud clasificada</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Gestionar</th>
                            </tr>
                        </thead>
                        <tbody id="tablaSolicitudesBody">
                            <tr>
                                <td colspan="6" style="text-align:center;padding:25px;color:#64748b;">
                                    Consultando solicitudes en la base de datos...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>


            <!-- ======================================================== -->
            <!-- BANDEJA 3: NOTIFICACIONES (Alertas del Agente IA)        -->
            <!-- ======================================================== -->
            <section id="vista-notificaciones" class="seccion-panel">
                <div class="bienvenida">
                    <h1>Bandeja de Notificaciones y Alertas</h1>
                    <p>Solicitudes escaladas por el Agente IA para atención prioritaria del supervisor humano.</p>
                </div>

                <div id="contenedorAlertas" class="lista-notificaciones">
                    <!-- Se llena dinámicamente con JavaScript -->
                </div>
            </section>


            <!-- ======================================================== -->
            <!-- BANDEJA 4: MI PERFIL (Datos del Administrador)           -->
            <!-- ======================================================== -->
            <section id="vista-perfil" class="seccion-panel">
                <div class="bienvenida">
                    <h1>Mi Perfil</h1>
                    <p>Información de tu cuenta de usuario administrador.</p>
                </div>

                <div class="tarjeta-perfil">
                    <div class="perfil-avatar">A</div>
                    <h2 id="perfilNombre" style="color:#15345b;margin-bottom:4px;">Administrador</h2>
                    <p style="color:#64748b;font-size:13px;" id="perfilRol">Rol: Administrador del Sistema</p>

                    <div class="perfil-grid">
                        <div class="label">Correo institucional:</div>
                        <div class="valor" id="perfilCorreo">adminsicou@unach.mx</div>

                        <div class="label">Adscripción:</div>
                        <div class="valor" id="perfilFacultad">Administración Central</div>

                        <div class="label">Permisos:</div>
                        <div class="valor">Gestión de Solicitudes, Supervisión y Canalización</div>

                        <div class="label">Estado de sesión:</div>
                        <div class="valor"><span style="color:#16a34a;font-weight:bold;">● Activa</span></div>
                    </div>
                </div>
            </section>

        </main>
    </div>

    <!-- Script con versión para forzar actualización inmediata -->
    <script src="../js/app.js?v=4"></script>
</body>
</html>

```

### Archivo: `Frontend\pages\dashboard_alumno.html`
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Universitario | Mi Panel</title>
    <link rel="stylesheet" href="../css/estilo_areas.css">
    <link rel="stylesheet" href="../css/estilo_alumno.css">
</head>
<body>
    <!-- Encabezado (mismo estilo) -->
    <header class="encabezado">
        <div class="logo">
            <h2>Sistema Universitario</h2>
        </div>
        <div class="usuario">
            <span id="nombreUsuario">Alumno</span>
            <span id="facultadUsuario" class="facultad-tag">Facultad</span>
            <button id="btnCerrarSesion">Cerrar sesión</button>
        </div>
    </header>

    <div class="contenedor">
        <!-- Menú lateral -->
        <aside class="sidebar">
            <h3>MENÚ PRINCIPAL</h3>
            <nav>
                <a href="#" class="activo" data-seccion="inicio">Inicio</a>
                <a href="#" data-seccion="nueva">Nueva solicitud</a>
                <a href="#" data-seccion="solicitudes">Mis solicitudes</a>
                <a href="#" data-seccion="notificaciones">Notificaciones <span class="badge-notif" id="contadorNotif">0</span></a>
                <a href="#" data-seccion="perfil">Mi perfil</a>
            </nav>
        </aside>

        <!-- Contenido principal -->
        <main class="contenido">

            <!-- SECCIÓN: INICIO -->
            <section id="sec-inicio" class="seccion activa">
                <section class="bienvenida">
                    <h1>Mi Panel</h1>
                    <p>Bienvenido al sistema de solicitudes universitarias.</p>
                    <h3 id="areaAlumno">Área Académica</h3>
                </section>

                <section class="estadisticas">
                    <div class="tarjeta tarjeta-pendiente">
                        <h3>Pendientes</h3>
                        <p id="statPendientes">0</p>
                    </div>
                    <div class="tarjeta tarjeta-revision">
                        <h3>En revisión</h3>
                        <p id="statRevision">0</p>
                    </div>
                    <div class="tarjeta tarjeta-resuelta">
                        <h3>Resueltas</h3>
                        <p id="statResueltas">0</p>
                    </div>
                    <div class="tarjeta">
                        <h3>Total</h3>
                        <p id="statTotal">0</p>
                    </div>
                </section>

                <!-- Accesos rápidos -->
                <section class="seccion-solicitudes">
                    <div class="titulo-seccion">
                        <h2>Accesos rápidos</h2>
                    </div>
                    <div class="accesos-rapidos">
                        <button class="btn-acceso" onclick="cambiarSeccion('nueva')">
                            <span>Nueva solicitud</span>
                        </button>
                        <button class="btn-acceso" onclick="cambiarSeccion('solicitudes')">
                            <span>Ver mis solicitudes</span>
                        </button>
                        <button class="btn-acceso" onclick="cambiarSeccion('notificaciones')">
                            <span>Notificaciones</span>
                        </button>
                    </div>
                </section>
            </section>

            <!-- SECCIÓN: NUEVA SOLICITUD -->
            <section id="sec-nueva" class="seccion">
                <section class="bienvenida">
                    <h1>Nueva Solicitud</h1>
                    <p>Describe tu problema y nuestra IA lo clasificará y enviará automáticamente al departamento correspondiente.</p>
                </section>

                <section class="seccion-solicitudes formulario-solicitud">
                    <form id="formNuevaSolicitud">
                        <!-- DESCRIPCIÓN: único campo obligatorio -->
                        <div class="grupo-campos">
                            <label for="descripcion">Describe tu problema o solicitud *</label>
                            <textarea id="descripcion" rows="8" 
                                placeholder="Ej: No aparece mi calificación del semestre en el campus virtual, ya revisé en servicios escolares y me dicen que no hay registro..." 
                                required></textarea>
                            <small class="ayuda-ia">Escribe con el mayor detalle posible. La IA analizará tu texto para clasificar la categoría, prioridad y departamento destino.</small>
                        </div>

                        <!-- ARCHIVO ADJUNTO (opcional) -->
                        <div class="grupo-campos">
                            <label for="archivo">Archivo adjunto (opcional)</label>
                            <input type="file" id="archivo" accept=".pdf,.jpg,.png,.doc,.docx">
                        </div>

                        <!-- RESULTADO DEL ANÁLISIS IA (aparece automáticamente al escribir) -->
                        <div id="resultadoIA" class="resultado-ia" style="display:none;">
                            <h3>🤖 Análisis automático de la IA</h3>
                            <p class="resultado-ia-info">Tu solicitud será canalizada de la siguiente manera:</p>
                            <div class="grid-resultado">
                                <div class="resultado-item">
                                    <span class="resultado-label">Categoría</span>
                                    <span class="resultado-valor" id="iaCategoria">-</span>
                                </div>
                                <div class="resultado-item">
                                    <span class="resultado-label">Prioridad</span>
                                    <span class="resultado-valor" id="iaPrioridad">-</span>
                                </div>
                                <div class="resultado-item">
                                    <span class="resultado-label">Departamento destino</span>
                                    <span class="resultado-valor" id="iaCanal">-</span>
                                </div>
                                <div class="resultado-item">
                                    <span class="resultado-label">Confianza del análisis</span>
                                    <span class="resultado-valor" id="iaConfianza">-</span>
                                </div>
                            </div>
                        </div>

                        <!-- BOTONES -->
                        <div class="acciones-form">
                            <button type="button" class="btn-secundario" onclick="cambiarSeccion('inicio')">Cancelar</button>
                            <button type="submit" class="btn-primario" id="btnEnviar" disabled>Enviar solicitud</button>
                        </div>
                    </form>
                </section>
            </section>

            <!-- SECCIÓN: MIS SOLICITUDES -->
            <section id="sec-solicitudes" class="seccion">
                <section class="bienvenida">
                    <h1>Mis Solicitudes</h1>
                    <p>Revisa el estado de todas tus solicitudes.</p>
                </section>

                <section class="seccion-solicitudes">
                    <!-- Filtros -->
                    <div class="filtros">
                        <div class="grupo-filtro">
                            <label>Estado:</label>
                            <select id="filtroEstado">
                                <option value="todos">Todos</option>
                                <option value="Pendiente">Pendientes</option>
                                <option value="En revisión">En revisión</option>
                                <option value="Atendida">Atendidas</option>
                                <option value="Cancelada">Canceladas</option>
                            </select>
                        </div>
                        <div class="grupo-filtro">
                            <label>Prioridad:</label>
                            <select id="filtroPrioridad">
                                <option value="todos">Todas</option>
                                <option value="Alta">Alta</option>
                                <option value="Media">Media</option>
                                <option value="Baja">Baja</option>
                            </select>
                        </div>
                        <button class="btn-primario btn-sm" onclick="aplicarFiltros()">Filtrar</button>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Folio</th>
                                <th>Tipo</th>
                                <th>Descripción</th>
                                <th>Fecha</th>
                                <th>Prioridad</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="tablaMisSolicitudes">
                            <!-- Se llena dinámicamente -->
                        </tbody>
                    </table>
                </section>
            </section>

            <!-- SECCIÓN: NOTIFICACIONES -->
            <section id="sec-notificaciones" class="seccion">
                <section class="bienvenida">
                    <h1>Notificaciones</h1>
                    <p>Actualizaciones sobre tus solicitudes.</p>
                </section>

                <section class="seccion-solicitudes">
                    <div class="lista-notificaciones" id="listaNotificaciones">
                        <!-- Se llena dinámicamente -->
                    </div>
                </section>
            </section>

            <!-- SECCIÓN: PERFIL -->
            <section id="sec-perfil" class="seccion">
                <section class="bienvenida">
                    <h1>Mi Perfil</h1>
                    <p>Información de tu cuenta.</p>
                </section>

                <section class="seccion-solicitudes perfil-card">
                    <div class="perfil-info">
                        <div class="avatar">👤</div>
                        <div class="datos-perfil">
                            <h3 id="perfilNombre">Nombre del alumno</h3>
                            <p id="perfilCorreo">correo@universidad.edu</p>
                            <p id="perfilFacultad">Facultad</p>
                            <span class="badge-rol">Alumno</span>
                        </div>
                    </div>
                    <div class="perfil-acciones">
                        <button class="btn-secundario" onclick="abrirModal('modalCambiarPassword')">Cambiar contraseña</button>
                        <button class="btn-secundario" onclick="abrirModal('modalEditarDatos')">Editar datos</button>
                    </div>
                </section>
            </section>

        </main>
    </div>

        <!-- MODAL: Cambiar Contraseña -->
    <div id="modalCambiarPassword" class="modal">
        <div class="modal-contenido modal-pequeno">
            <div class="modal-header">
                <h3>🔒 Cambiar Contraseña</h3>
                <button class="btn-cerrar" onclick="cerrarModal('modalCambiarPassword')">✕</button>
            </div>
            <div class="modal-body">
                <form id="formCambiarPassword">
                    <div class="grupo-campos">
                        <label for="passwordActual">Contraseña actual *</label>
                        <input type="password" id="passwordActual" required>
                    </div>
                    <div class="grupo-campos">
                        <label for="passwordNueva">Nueva contraseña *</label>
                        <input type="password" id="passwordNueva" required minlength="6">
                        <small class="ayuda-campo">Mínimo 6 caracteres</small>
                    </div>
                    <div class="grupo-campos">
                        <label for="passwordConfirmar">Confirmar nueva contraseña *</label>
                        <input type="password" id="passwordConfirmar" required minlength="6">
                    </div>
                    <div class="acciones-form">
                        <button type="button" class="btn-secundario" onclick="cerrarModal('modalCambiarPassword')">Cancelar</button>
                        <button type="submit" class="btn-primario">Actualizar contraseña</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- MODAL: Editar Datos -->
    <div id="modalEditarDatos" class="modal">
        <div class="modal-contenido modal-pequeno">
            <div class="modal-header">
                <h3>✏️ Editar Datos Personales</h3>
                <button class="btn-cerrar" onclick="cerrarModal('modalEditarDatos')">✕</button>
            </div>
            <div class="modal-body">
                <form id="formEditarDatos">
                    <div class="grupo-campos">
                        <label for="editNombre">Nombre completo *</label>
                        <input type="text" id="editNombre" required>
                    </div>
                    <div class="grupo-campos">
                        <label for="editCorreo">Correo electrónico *</label>
                        <input type="email" id="editCorreo" required>
                        <small class="ayuda-campo">⚠️ Cambiar el correo puede afectar tu acceso</small>
                    </div>
                    <div class="acciones-form">
                        <button type="button" class="btn-secundario" onclick="cerrarModal('modalEditarDatos')">Cancelar</button>
                        <button type="submit" class="btn-primario">Guardar cambios</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal de detalle de solicitud -->
    <div id="modalDetalle" class="modal">
        <div class="modal-contenido">
            <div class="modal-header">
                <h3>Detalle de solicitud <span id="modalFolio"></span></h3>
                <button class="btn-cerrar" onclick="cerrarModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="detalle-grid">
                    <div><strong>Tipo:</strong> <span id="modalTipo"></span></div>
                    <div><strong>Prioridad:</strong> <span id="modalPrioridad"></span></div>
                    <div><strong>Estado:</strong> <span id="modalEstado"></span></div>
                    <div><strong>Departamento:</strong> <span id="modalDepto"></span></div>
                </div>
                <div class="detalle-descripcion">
                    <h4>Descripción</h4>
                    <p id="modalDescripcion"></p>
                </div>
                <div class="detalle-respuesta" id="seccionRespuesta" style="display:none;">
                    <h4>Respuesta del área</h4>
                    <div class="respuesta-box" id="modalRespuesta"></div>
                </div>
            </div>
        </div>
    </div>

    <script src="../js/app.js"></script>
    <script src="../js/dashboard_alumno.js"></script>
</body>
</html>
```

### Archivo: `Frontend\pages\login.html`
```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistema Universitario | Acceso</title>
    <link rel="stylesheet" href="../css/estilo_login.css">
</head>
<body>

    <!-- Fondo de ondas y partículas estilo abstracto -->
    <div class="bg-waves">
        <div class="wave"></div>
        <div class="wave"></div>
    </div>

    <div class="login-card">

        <!-- Mensaje de estado/alerta -->
        <div id="mensajeAlerta" class="alerta-msg"></div>

        <!-- ========================================== -->
        <!-- FORMULARIO 1: INICIAR SESIÓN (LOGIN)       -->
        <!-- ========================================== -->
        <div id="seccionLogin" class="formulario activo">
            <div class="card-header">
                <h2>Login</h2>
                <p>Ingresa tus credenciales para acceder</p>
            </div>

            <form id="formLogin">
                <!-- Correo Electrónico -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <input type="email" id="loginCorreo" placeholder="Correo electrónico" required autocomplete="email">
                    </div>
                </div>

                <!-- Contraseña -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <input type="password" id="loginPassword" placeholder="Contraseña" required autocomplete="current-password">
                    </div>
                </div>

                <!-- Selección de Área / Facultad -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <select id="loginFacultad" required>
                            <option value="" disabled selected>Selecciona tu Facultad / Área</option>
                            <option value="0">Administración General (Administrador)</option>
                            <option value="1">Facultad de Arquitectura</option>
                            <option value="2">Facultad de Contaduría y Administración</option>
                            <option value="3">Facultad de Ingeniería</option>
                            <option value="4">Facultad de Lenguas</option>
                            <option value="5">Facultad de Ciencias en Física y Matemáticas</option>
                            <option value="6">Facultad de Medicina Humana</option>
                            <option value="7">Facultad de Medicina Veterinaria y Zootecnia</option>
                            <option value="8">Facultad de Humanidades</option>
                        </select>
                    </div>
                </div>

                <!-- Recordarme y Olvido de contraseña -->
                <div class="form-options">
                    <label class="remember-me">
                        <input type="checkbox" id="rememberMe">
                        <span>Remember me</span>
                    </label>
                    <a href="#" class="forgot-password" onclick="alert('Funcionalidad de recuperación en desarrollo'); return false;">Forgot your password?</a>
                </div>

                <!-- Botón de Login -->
                <button type="submit" class="btn-submit">LOGIN</button>

                <!-- Ir a Registro -->
                <div class="card-footer">
                    <span>New here?</span>
                    <a href="#" id="linkIrRegistro">Sign Up</a>
                </div>
            </form>
        </div>


        <!-- ========================================== -->
        <!-- FORMULARIO 2: REGISTRO DE USUARIO          -->
        <!-- ========================================== -->
        <div id="seccionRegistro" class="formulario">
            <div class="card-header">
                <h2>Sign Up</h2>
                <p>Crea tu cuenta universitaria</p>
            </div>

            <form id="formRegistro">
                <!-- Nombre Completo -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <input type="text" id="regNombre" placeholder="Nombre completo" required autocomplete="name">
                    </div>
                </div>

                <!-- Correo Electrónico -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        <input type="email" id="regCorreo" placeholder="Correo universitario" required autocomplete="email">
                    </div>
                </div>

                <!-- Contraseña -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <input type="password" id="regPassword" placeholder="Contraseña" required autocomplete="new-password">
                    </div>
                </div>

                <!-- Elección de Facultad / Área requerida al registrarse -->
                <div class="form-group">
                    <div class="input-container">
                        <svg class="input-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <select id="regFacultad" required>
                            <option value="" disabled selected>Elige tu Facultad de adscripción</option>
                            <option value="1">Facultad de Arquitectura</option>
                            <option value="2">Facultad de Contaduría y Administración</option>
                            <option value="3">Facultad de Ingeniería</option>
                            <option value="4">Facultad de Lenguas</option>
                            <option value="5">Facultad de Ciencias en Física y Matemáticas</option>
                            <option value="6">Facultad de Medicina Humana</option>
                            <option value="7">Facultad de Medicina Veterinaria y Zootecnia</option>
                            <option value="8">Facultad de Humanidades</option>
                        </select>
                    </div>
                </div>

                <!-- Botón de Registro -->
                <button type="submit" class="btn-submit">REGISTRARSE</button>

                <!-- Volver a Login -->
                <div class="card-footer">
                    <span>Already have an account?</span>
                    <a href="#" id="linkIrLogin">Login</a>
                </div>
            </form>
        </div>

    </div>

    <!-- Script de interacción -->
    <script src="../js/login.js"></script>
</body>
</html>

```

### Archivo: `data\agente_config.json`
```json
{
  "canal_por_defecto": {
    "Académica": "Coordinación Académica",
    "Financiera/Becas": "Servicios Escolares",
    "Soporte Técnico": "Soporte Técnico",
    "Servicios Escolares": "Servicios Escolares",
    "Bienestar Universitario": "Bienestar Universitario"
  },
  "umbral_confianza": 0.50,
  "bandeja_supervisor": "Bandeja de revisión por Supervisor Humano"
}

```

### Archivo: `data\dataset.json`
```json
{
  "categorias": {
    "ACADEMICA": "Académica",
    "BECAS": "Financiera/Becas",
    "SOPORTE": "Soporte Técnico",
    "ESCOLARES": "Servicios Escolares",
    "BIENESTAR": "Bienestar Universitario"
  },
  "datos": [
    {"texto": "Necesito saber por qué no aparece mi calificación del semestre", "categoria": "Académica"},
    {"texto": "Quiero revisar mi examen final porque creo que la nota está mal", "categoria": "Académica"},
    {"texto": "El profesor no ha subido las calificaciones del parcial", "categoria": "Académica"},
    {"texto": "Solicito una revisión de calificación de la materia de cálculo", "categoria": "Académica"},
    {"texto": "Tengo dudas sobre el programa de la materia y los temas del curso", "categoria": "Académica"},
    {"texto": "El docente falta mucho a clases y no se cubre el temario", "categoria": "Académica"},
    {"texto": "Quiero cambiar de grupo en la materia de programación", "categoria": "Académica"},
    {"texto": "Necesito información sobre el plan de estudios de mi carrera", "categoria": "Académica"},
    {"texto": "Pido una asesoría académica para recuperar la materia reprobada", "categoria": "Académica"},
    {"texto": "No estoy de acuerdo con la evaluación de mi proyecto final", "categoria": "Académica"},
    {"texto": "Como solicito presentar un examen extraordinario de álgebra", "categoria": "Académica"},
    {"texto": "El maestro no entrega las rúbricas de evaluación de la materia", "categoria": "Académica"},
    {"texto": "Quiero saber mi promedio y las materias que me faltan por cursar", "categoria": "Académica"},
    {"texto": "Solicito que revisen la calificación de mi tarea y de mi examen", "categoria": "Académica"},
    {"texto": "Mi nota del semestre no coincide con lo que dijo el profesor", "categoria": "Académica"},
    {"texto": "Necesito tutoría para la materia de física porque voy atrasado", "categoria": "Académica"}, 
    {"texto": "El profe no subio las calificaciones al sistema", "categoria": "Académica"},
    {"texto": "Quiero recursar la materia de programacion porque reprobe", "categoria": "Académica"},
    {"texto": "No entiendo nada de calculo diferencial necesito ayuda", "categoria": "Académica"},
    {"texto": "Cuando son los examenes finales del semestre", "categoria": "Académica"},
    {"texto": "El maestro no asistio a clase y no hubo reposicion", "categoria": "Académica"},
    {"texto": "Solicito cambio de grupo en la materia de fisica", "categoria": "Académica"},
    {"texto": "Mi promedio esta muy bajo y quiero mejorar mis notas", "categoria": "Académica"},
    {"texto": "Necesito una asesoria academica para el proyecto final", "categoria": "Académica"},
    {"texto": "El docente no explica bien y reprueba a muchos alumnos", "categoria": "Académica"},
    {"texto": "Quiero saber si puedo llevar materias de otro semestre", "categoria": "Académica"},
    {"texto": "No me aparece el grupo asignado en mi horario de clases", "categoria": "Académica"},
    {"texto": "Solicito revision de examen parcial de estadistica", "categoria": "Académica"},
    {"texto": "El profesor no entrega las rubricas de evaluacion", "categoria": "Académica"},
    {"texto": "Necesito tutoria para la materia de algebra lineal", "categoria": "Académica"},
    {"texto": "Quiero revisar el temario oficial de la materia", "categoria": "Académica"},
    {"texto": "No me han entregado mi certificado de bachillerato", "categoria": "Académica"},
    {"texto": "Solicito informacion sobre intercambio estudiantil", "categoria": "Académica"},
    {"texto": "El aula asignada no tiene proyector ni computadora", "categoria": "Académica"},
    {"texto": "Quiero saber cuantos creditos me faltan para graduarme", "categoria": "Académica"},
    {"texto": "El maestro de base de datos no viene a clase nunca", "categoria": "Académica"},
    {"texto": "Necesito que me validen las materias que curse en otra uni", "categoria": "Académica"},
    {"texto": "Mi calificacion de programacion no aparece en el portal", "categoria": "Académica"},
    {"texto": "Quiero inscribir materias optativas del siguiente semestre", "categoria": "Académica"},
    {"texto": "El profe de matematicas no cubre todo el temario", "categoria": "Académica"},
    {"texto": "Solicito constancia de no adeudo academico", "categoria": "Académica"},
    {"texto": "El docente reprobó a todo el grupo sin explicacion", "categoria": "Académica"},
    {"texto": "Necesito asesoria para mi proyecto de investigacion", "categoria": "Académica"},
    {"texto": "Quiero cambiar de carrera a ingenieria en sistemas", "categoria": "Académica"},
    {"texto": "No entiendo la materia de calculo integral y necesito apoyo", "categoria": "Académica"},
    {"texto": "El profesor no sube las tareas a la plataforma virtual", "categoria": "Académica"},
    {"texto": "Quiero solicitar informes sobre los requisitos para la beca de manutención", "categoria": "Financiera/Becas"},
    {"texto": "Cuándo es la fecha límite para pagar la colegiatura del semestre", "categoria": "Financiera/Becas"},
    {"texto": "Me cobraron dos veces la inscripción y necesito un reembolso", "categoria": "Financiera/Becas"},
    {"texto": "Necesito apoyo económico porque no puedo pagar la mensualidad", "categoria": "Financiera/Becas"},
    {"texto": "Como renuevo mi beca académica para el siguiente semestre", "categoria": "Financiera/Becas"},
    {"texto": "Solicito una prórroga para pagar la colegiatura atrasada", "categoria": "Financiera/Becas"},
    {"texto": "No me ha llegado el depósito de mi beca este mes", "categoria": "Financiera/Becas"},
    {"texto": "Quiero información sobre descuentos y becas por promedio", "categoria": "Financiera/Becas"},
    {"texto": "Hay un cargo que no reconozco en mi estado de cuenta", "categoria": "Financiera/Becas"},
    {"texto": "Necesito mi comprobante de pago y la factura de la inscripción", "categoria": "Financiera/Becas"},
    {"texto": "Requisitos para aplicar a la beca de excelencia deportiva", "categoria": "Financiera/Becas"},
    {"texto": "Me suspendieron la beca y quiero saber el motivo", "categoria": "Financiera/Becas"},
    {"texto": "Puedo pagar en parcialidades el costo del semestre", "categoria": "Financiera/Becas"},
    {"texto": "Cuánto cuesta la inscripción y qué apoyos financieros existen", "categoria": "Financiera/Becas"},
    {"texto": "Tengo un adeudo en caja y quiero aclarar el monto", "categoria": "Financiera/Becas"},
    {"texto": "Información sobre convocatoria de becas y crédito educativo", "categoria": "Financiera/Becas"},
    {"texto": "Existe una falla de red que nos impide acceder a la plataforma universitaria", "categoria": "Soporte Técnico"},
    {"texto": "No puedo iniciar sesión en la plataforma virtual, dice contraseña incorrecta", "categoria": "Soporte Técnico"},
    {"texto": "El wifi del edificio B no funciona desde ayer", "categoria": "Soporte Técnico"},
    {"texto": "Olvidé mi contraseña del correo institucional", "categoria": "Soporte Técnico"},
    {"texto": "El proyector del salón 204 no enciende", "categoria": "Soporte Técnico"},
    {"texto": "La plataforma de tareas marca error al subir archivos", "categoria": "Soporte Técnico"},
    {"texto": "Las computadoras del laboratorio están muy lentas y se traban", "categoria": "Soporte Técnico"},
    {"texto": "No tengo acceso a mi cuenta de Moodle ni al correo", "categoria": "Soporte Técnico"},
    {"texto": "Se cayó el sistema de internet en toda la biblioteca", "categoria": "Soporte Técnico"},
    {"texto": "Necesito instalar un software en la computadora del laboratorio", "categoria": "Soporte Técnico"},
    {"texto": "El servidor no responde y no se puede entrar al portal", "categoria": "Soporte Técnico"},
    {"texto": "Mi cuenta institucional fue bloqueada y no puedo ingresar", "categoria": "Soporte Técnico"},
    {"texto": "La página de inscripciones muestra un error y no carga", "categoria": "Soporte Técnico"},
    {"texto": "No hay conexión a internet en el aula y la red está caída", "categoria": "Soporte Técnico"},
    {"texto": "Falla en la impresora del centro de cómputo", "categoria": "Soporte Técnico"},
    {"texto": "El sistema de la universidad no abre desde mi celular", "categoria": "Soporte Técnico"},
    {"texto": "Necesito una constancia de estudios para un trámite", "categoria": "Servicios Escolares"},
    {"texto": "Quiero tramitar mi credencial de estudiante porque la perdí", "categoria": "Servicios Escolares"},
    {"texto": "Como solicito mi historial académico oficial con sellos", "categoria": "Servicios Escolares"},
    {"texto": "Necesito descargar mi historial de calificaciones de todos los semestres", "categoria": "Servicios Escolares"},
    {"texto": "Quiero ver mi record académico porque no me aparecen algunas materias", "categoria": "Servicios Escolares"},
    {"texto": "Necesito mi título provisional para buscar trabajo", "categoria": "Servicios Escolares"},
    {"texto": "Solicito carta de estudios con materias cursadas", "categoria": "Servicios Escolares"},
    {"texto": "Quiero cambiar de turno y actualizar mis datos escolares", "categoria": "Servicios Escolares"},
    {"texto": "Necesito una constancia de calificaciones para el IMSS", "categoria": "Servicios Escolares"},
    {"texto": "Tengo que entregar mi acta de nacimiento para actualizar el expediente", "categoria": "Servicios Escolares"},
    {"texto": "Solicito el trámite de equivalencia de materias de otra universidad", "categoria": "Servicios Escolares"},
    {"texto": "Como saco una carta de buena conducta y constancia de inscripción", "categoria": "Servicios Escolares"},
    {"texto": "Necesito dar de baja una materia antes del cierre de inscripciones", "categoria": "Servicios Escolares"},
    {"texto": "Quiero solicitar una baja temporal del semestre", "categoria": "Servicios Escolares"},
    {"texto": "Trámite de cambio de carrera, qué documentos debo entregar", "categoria": "Servicios Escolares"},
    {"texto": "Necesito mi certificado parcial y mi historial académico", "categoria": "Servicios Escolares"},
    {"texto": "Cuándo son las fechas de reinscripción y entrega de documentos", "categoria": "Servicios Escolares"},
    {"texto": "Solicito la corrección de mi nombre en mi expediente", "categoria": "Servicios Escolares"},
    {"texto": "Requisitos para el trámite de titulación y servicio social", "categoria": "Servicios Escolares"},
    {"texto": "Quiero registrar mi servicio social y entregar la carta de inicio", "categoria": "Servicios Escolares"},
    {"texto": "Necesito una constancia de calificaciones para el IMSS", "categoria": "Servicios Escolares"},
    {"texto": "Tengo que entregar mi acta de nacimiento para actualizar el expediente", "categoria": "Servicios Escolares"},
    {"texto": "Solicito el trámite de equivalencia de materias de otra universidad", "categoria": "Servicios Escolares"},
    {"texto": "Como saco una carta de buena conducta y constancia de inscripción", "categoria": "Servicios Escolares"},
    {"texto": "Necesito dar de baja una materia antes del cierre de inscripciones", "categoria": "Servicios Escolares"},
    {"texto": "Quiero solicitar una baja temporal del semestre", "categoria": "Servicios Escolares"},
    {"texto": "Trámite de cambio de carrera, qué documentos debo entregar", "categoria": "Servicios Escolares"},
    {"texto": "Necesito mi certificado parcial y mi historial académico", "categoria": "Servicios Escolares"},
    {"texto": "Cuándo son las fechas de reinscripción y entrega de documentos", "categoria": "Servicios Escolares"},
    {"texto": "Solicito la corrección de mi nombre en mi expediente", "categoria": "Servicios Escolares"},
    {"texto": "Requisitos para el trámite de titulación y servicio social", "categoria": "Servicios Escolares"},
    {"texto": "Quiero registrar mi servicio social y entregar la carta de inicio", "categoria": "Servicios Escolares"},
    {"texto": "Necesito una constancia de calificaciones para el IMSS", "categoria": "Servicios Escolares"},
    {"texto": "Tengo que entregar mi acta de nacimiento para actualizar el expediente", "categoria": "Servicios Escolares"},
    {"texto": "Solicito el trámite de equivalencia de materias de otra universidad", "categoria": "Servicios Escolares"},
    {"texto": "Como saco una carta de buena conducta y constancia de inscripción", "categoria": "Servicios Escolares"},
    {"texto": "Quiero cambiar de turno y actualizar mis datos escolares", "categoria": "Servicios Escolares"},
    {"texto": "Reporte de situación grave de acoso en el campus", "categoria": "Bienestar Universitario"},
    {"texto": "Un compañero me amenaza y me hostiga todos los días", "categoria": "Bienestar Universitario"},
    {"texto": "Me siento muy deprimida y necesito apoyo psicológico", "categoria": "Bienestar Universitario"},
    {"texto": "Presencié una pelea con agresión física afuera de la cafetería", "categoria": "Bienestar Universitario"},
    {"texto": "Un profesor me hace comentarios inapropiados y me incomoda", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito ayuda por ansiedad y estrés antes de los exámenes", "categoria": "Bienestar Universitario"},
    {"texto": "Hubo un accidente en el gimnasio y un alumno quedó herido", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero reportar discriminación y bullying en mi grupo", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito una cita con el servicio médico y psicología", "categoria": "Bienestar Universitario"},
    {"texto": "Me siento inseguro en el estacionamiento, sufrí un intento de robo", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero informes sobre talleres deportivos y actividades culturales", "categoria": "Bienestar Universitario"},
    {"texto": "Un alumno habló de hacerse daño y me preocupa su seguridad", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto violencia y maltrato de un compañero hacia otra alumna", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito orientación por problemas personales y emocionales", "categoria": "Bienestar Universitario"},
    {"texto": "Emergencia, una persona se desmayó en el patio y necesita ayuda", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información de las actividades de bienestar y salud mental", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito información sobre becas y también tengo problemas con la plataforma", "categoria": "Financiera/Becas"},
    {"texto": "Quiero saber sobre apoyos económicos y no puedo acceder al sistema", "categoria": "Financiera/Becas"},
    {"texto": "Requisitos para beca y además falla en el portal de tareas", "categoria": "Financiera/Becas"},
    {"texto": "Informes sobre becas de manutención y problemas técnicos con mi cuenta", "categoria": "Financiera/Becas"},
    {"texto": "No entiendo la materia de cálculo diferencial y necesito ayuda", "categoria": "Académica"},
    {"texto": "Quiero inscribirme en materias optativas del siguiente semestre", "categoria": "Académica"},
    {"texto": "El profesor no asistió a clase y no hubo reposición", "categoria": "Académica"},
    {"texto": "Necesito un certificado de estudios con promedio", "categoria": "Académica"},
    {"texto": "Mi horario de clases tiene materias traslapadas", "categoria": "Académica"},
    {"texto": "Quiero cambiar de carrera a ingeniería en sistemas", "categoria": "Académica"},
    {"texto": "No me aparece el grupo asignado en mi horario", "categoria": "Académica"},
    {"texto": "Solicito revisión de examen parcial de estadística", "categoria": "Académica"},
    {"texto": "El docente no sube las tareas a la plataforma", "categoria": "Académica"},
    {"texto": "Necesito carta de pasante para iniciar trámite de titulación", "categoria": "Académica"},
    {"texto": "Quiero saber si puedo llevar materias de otro semestre", "categoria": "Académica"},
    {"texto": "No me dejan inscribir la materia porque está llena", "categoria": "Académica"},
    {"texto": "Solicito constancia de no adeudo académico", "categoria": "Académica"},
    {"texto": "El profesor reprobó a todo el grupo sin explicación", "categoria": "Académica"},
    {"texto": "Necesito asesoría para mi proyecto de investigación", "categoria": "Académica"},
    {"texto": "Quiero revisar el temario oficial de la materia", "categoria": "Académica"},
    {"texto": "No me han entregado mi certificado de bachillerato", "categoria": "Académica"},
    {"texto": "Solicito información sobre intercambio estudiantil", "categoria": "Académica"},
    {"texto": "El aula asignada no tiene proyector ni computadora", "categoria": "Académica"},
    {"texto": "Quiero saber cuántos créditos me faltan para graduarme", "categoria": "Académica"},
    {"texto": "No me depositaron la beca del mes pasado", "categoria": "Financiera/Becas"},
    {"texto": "Quiero solicitar un crédito educativo para la maestría", "categoria": "Financiera/Becas"},
    {"texto": "Me cobraron recargos por pago tardío de colegiatura", "categoria": "Financiera/Becas"},
    {"texto": "Necesito factura fiscal por la inscripción pagada", "categoria": "Financiera/Becas"},
    {"texto": "Quiero conocer los convenios de descuento con empresas", "categoria": "Financiera/Becas"},
    {"texto": "Mi beca fue cancelada sin aviso previo", "categoria": "Financiera/Becas"},
    {"texto": "Solicito prórroga para pagar el seguro facultativo", "categoria": "Financiera/Becas"},
    {"texto": "No me dan recibo por el pago de laboratorio", "categoria": "Financiera/Becas"},
    {"texto": "Quiero aplicar a la beca de movilidad internacional", "categoria": "Financiera/Becas"},
    {"texto": "Me retuvieron el título por adeudo de 200 pesos", "categoria": "Financiera/Becas"},
    {"texto": "Necesito estado de cuenta actualizado de mis pagos", "categoria": "Financiera/Becas"},
    {"texto": "Quiero saber si hay becas para alumnos de nuevo ingreso", "categoria": "Financiera/Becas"},
    {"texto": "El sistema no me deja generar mi línea de captura", "categoria": "Financiera/Becas"},
    {"texto": "Solicito reembolso por materia que di de baja a tiempo", "categoria": "Financiera/Becas"},
    {"texto": "Me cobraron doble la reinscripción este semestre", "categoria": "Financiera/Becas"},
    {"texto": "Quiero información sobre pagos en parcialidades", "categoria": "Financiera/Becas"},
    {"texto": "No aparece mi pago en el sistema de caja", "categoria": "Financiera/Becas"},
    {"texto": "Necesito comprobante de beca para trámite externo", "categoria": "Financiera/Becas"},
    {"texto": "Quiero cancelar mi inscripción y solicitar devolución", "categoria": "Financiera/Becas"},
    {"texto": "Solicito apoyo económico por situación de vulnerabilidad", "categoria": "Financiera/Becas"},
    {"texto": "Hubo un robo en el campus y me siento inseguro", "categoria": "Bienestar Universitario"},
    {"texto": "Un compañero me agredió verbalmente y temo represalias", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito ayuda psicológica por estrés académico", "categoria": "Bienestar Universitario"},
    {"texto": "Presencié un asalto en el estacionamiento de la universidad", "categoria": "Bienestar Universitario"},
    {"texto": "Me siento acosada por un profesor y necesito orientación", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero reportar violencia de género en el campus", "categoria": "Bienestar Universitario"},
    {"texto": "Un alumno se lastimó durante la clase de educación física", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo por depresión y ansiedad", "categoria": "Bienestar Universitario"},
    {"texto": "Hubo un accidente en el laboratorio y alguien resultó herido", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información sobre talleres de bienestar y salud mental", "categoria": "Bienestar Universitario"},
    {"texto": "No puedo acceder al correo desde el celular", "categoria": "Soporte Técnico"},
    {"texto": "La plataforma de tareas se traba al subir archivos grandes", "categoria": "Soporte Técnico"},
    {"texto": "Olvidé mi usuario y no puedo recuperar la contraseña", "categoria": "Soporte Técnico"},
    {"texto": "El wifi de la biblioteca no conecta ningún dispositivo", "categoria": "Soporte Técnico"},
    {"texto": "Necesito que instalen MATLAB en las computadoras del lab", "categoria": "Soporte Técnico"},
    {"texto": "Mi cuenta fue hackeada y cambiaron mi contraseña", "categoria": "Soporte Técnico"},
    {"texto": "El sistema de inscripciones no carga desde ayer", "categoria": "Soporte Técnico"},
    {"texto": "No puedo imprimir desde las computadoras públicas", "categoria": "Soporte Técnico"},
    {"texto": "La página de la universidad no abre en ningún navegador", "categoria": "Soporte Técnico"},
    {"texto": "Necesito acceso remoto al servidor de la facultad", "categoria": "Soporte Técnico"},
    {"texto": "El antivirus bloquea la plataforma de clases", "categoria": "Soporte Técnico"},
    {"texto": "Quiero reportar un bug en el sistema de calificaciones", "categoria": "Soporte Técnico"},
    {"texto": "No me llega el correo de recuperación de contraseña", "categoria": "Soporte Técnico"},
    {"texto": "Las computadoras del aula 301 no tienen internet", "categoria": "Soporte Técnico"},
    {"texto": "Solicito aumentar mi espacio en el drive institucional", "categoria": "Soporte Técnico"},
    {"texto": "El proyector del auditorio no funciona para eventos", "categoria": "Soporte Técnico"},
    {"texto": "Necesito que reseteen mi token de autenticación", "categoria": "Soporte Técnico"},
    {"texto": "La app móvil de la universidad se cierra sola", "categoria": "Soporte Técnico"},
    {"texto": "Quiero cambiar mi correo institucional asignado", "categoria": "Soporte Técnico"},
    {"texto": "El sistema marca error 500 al consultar mi historial académico", "categoria": "Soporte Técnico"},
    {"texto": "No me jala el wifi en la biblioteca desde hace dos días", "categoria": "Soporte Técnico"},
    {"texto": "Se buguea la plataforma cuando intento subir mi tarea en PDF", "categoria": "Soporte Técnico"},
    {"texto": "Olvide mi contraseña del correo y no me llega el de recuperacion", "categoria": "Soporte Técnico"},
    {"texto": "Las computadoras del lab 3 no tienen Word ni Excel instalados", "categoria": "Soporte Técnico"},
    {"texto": "El sistema de inscripciones truena cuando le doy guardar", "categoria": "Soporte Técnico"},
    {"texto": "No puedo entrar a Moodle me dice credenciales invalidas", "categoria": "Soporte Técnico"},
    {"texto": "La impresora de la facultad no imprime dice que no hay toner", "categoria": "Soporte Técnico"},
    {"texto": "Mi cuenta fue hackeada alguien cambio mi password", "categoria": "Soporte Técnico"},
    {"texto": "El internet esta muy lento no puedo ver las clases en linea", "categoria": "Soporte Técnico"},
    {"texto": "Necesito que me activen el acceso al sistema de biblioteca virtual", "categoria": "Soporte Técnico"},
    {"texto": "Se cayo el servidor otra vez no puedo consultar mis calificaciones", "categoria": "Soporte Técnico"},
    {"texto": "El proyector del salon 102 no funciona para mi exposicion", "categoria": "Soporte Técnico"},
    {"texto": "No me deja descargar el software de Autodesk con mi cuenta institucional", "categoria": "Soporte Técnico"},
    {"texto": "La app del celular de la universidad se cierra sola al abrir", "categoria": "Soporte Técnico"},
    {"texto": "Me aparece error 404 en la pagina de pagos en linea", "categoria": "Soporte Técnico"},
    {"texto": "El microfono no me funciona en Teams para las clases virtuales", "categoria": "Soporte Técnico"},
    {"texto": "No puedo acceder a mi correo desde Outlook solo desde web", "categoria": "Soporte Técnico"},
    {"texto": "Las computadoras de la sala de computo estan muy lentas", "categoria": "Soporte Técnico"},
    {"texto": "Se me olvido el usuario y no recuerdo cual era mi correo institucional", "categoria": "Soporte Técnico"},
    {"texto": "El sistema marca que ya entregue la tarea pero no aparece", "categoria": "Soporte Técnico"},
    {"texto": "No me llega el codigo de verificacion para iniciar sesion", "categoria": "Soporte Técnico"},
    {"texto": "La plataforma no carga los videos de las clases grabadas", "categoria": "Soporte Técnico"},
    {"texto": "Me bloquearon la cuenta por muchos intentos fallidos de login", "categoria": "Soporte Técnico"},
    {"texto": "El antivirus de las compus de la uni bloquea la plataforma", "categoria": "Soporte Técnico"},
    {"texto": "Necesito instalar MATLAB en mi laptop pero no tengo la licencia", "categoria": "Soporte Técnico"},
    {"texto": "Solicito una constancia de estudios para un trámite", "categoria": "Servicios Escolares"},
    {"texto": "Quiero tramitar mi credencial de estudiante porque la perdí", "categoria": "Servicios Escolares"},
    {"texto": "Como solicito mi historial académico oficial con sellos", "categoria": "Servicios Escolares"},
    {"texto": "Necesito descargar mi historial de calificaciones de todos los semestres", "categoria": "Servicios Escolares"},
    {"texto": "Quiero ver mi record académico porque no me aparecen algunas materias", "categoria": "Servicios Escolares"},
    {"texto": "Necesito mi título provisional para buscar trabajo", "categoria": "Servicios Escolares"},
    {"texto": "Quiero tramitar mi credencial porque la extravié", "categoria": "Servicios Escolares"},
    {"texto": "Solicito carta de estudios con materias cursadas", "categoria": "Servicios Escolares"},
    {"texto": "Necesito actualizar mi dirección en el expediente", "categoria": "Servicios Escolares"},
    {"texto": "Quiero hacer equivalencia de materias de otra universidad", "categoria": "Servicios Escolares"},
    {"texto": "Solicito certificado de inscripción vigente", "categoria": "Servicios Escolares"},
    {"texto": "Necesito la constancia de situación académica", "categoria": "Servicios Escolares"},
    {"texto": "Quiero registrar mi servicio social en empresa externa", "categoria": "Servicios Escolares"},
    {"texto": "Solicito baja temporal por motivos de salud", "categoria": "Servicios Escolares"},
    {"texto": "Necesito que corrijan mi CURP en el sistema", "categoria": "Servicios Escolares"},
    {"texto": "Quiero conocer los requisitos para cambio de turno", "categoria": "Servicios Escolares"},
    {"texto": "Solicito constancia de no adeudo para trámite", "categoria": "Servicios Escolares"},
    {"texto": "Necesito mi historial académico completo sellado", "categoria": "Servicios Escolares"},
    {"texto": "Quiero tramitar mi cédula profesional", "categoria": "Servicios Escolares"},
    {"texto": "Solicito información sobre reinscripción en línea", "categoria": "Servicios Escolares"},
    {"texto": "Necesito que validen mis documentos de ingreso", "categoria": "Servicios Escolares"},
    {"texto": "Quiero saber el calendario escolar del próximo ciclo", "categoria": "Servicios Escolares"},
    {"texto": "Solicito carta de liberación de servicio social", "categoria": "Servicios Escolares"},
    {"texto": "Necesito actualizar mi acta de nacimiento en el expediente", "categoria": "Servicios Escolares"},
    {"texto": "Quiero conocer el proceso de titulación por tesina", "categoria": "Servicios Escolares"},
    {"texto": "Necesito atención psicológica por ansiedad severa", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto caso de discriminación por parte de un docente", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información sobre talleres de manejo del estrés", "categoria": "Bienestar Universitario"},
    {"texto": "Sufro acoso laboral en mi trabajo escolar", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo por situación de violencia familiar", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero reportar un caso de abuso sexual en el campus", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito cita con el departamento médico universitario", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito orientación vocacional para elegir carrera", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero participar en el programa de deporte universitario", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto venta de sustancias dentro de la universidad", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo económico por emergencia familiar", "categoria": "Bienestar Universitario"},
    {"texto": "Sufro depresión y necesito atención profesional", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero denunciar un caso de plagio académico grave", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito asesoría legal por problema con un compañero", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto condiciones inseguras en el laboratorio", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información sobre becas de alimentación", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo por discapacidad visual en clases", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito taller de prevención de adicciones", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto bullying sistemático en mi grupo de estudio", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito atención médica urgente por accidente en campus", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información sobre programas de salud mental", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo por situación de violencia de género", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito orientación sobre manejo de estrés académico", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto robo de pertenencias en el estacionamiento", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero participar en actividades culturales y artísticas", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito ayuda por problemas de ansiedad y pánico", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito información sobre programas de bienestar estudiantil", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto acoso cibernético por parte de un compañero", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito apoyo por situación de violencia intrafamiliar", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero información sobre becas deportivas y culturales", "categoria": "Bienestar Universitario"},
    {"texto": "Solicito atención psicológica por depresión severa", "categoria": "Bienestar Universitario"},
    {"texto": "Reporto condiciones inseguras en el área de laboratorios", "categoria": "Bienestar Universitario"},
    {"texto": "Necesito orientación sobre manejo de conflictos interpersonales", "categoria": "Bienestar Universitario"},
    {"texto": "Quiero participar en programas de desarrollo personal y liderazgo", "categoria": "Bienestar Universitario"}
    
  ]
}

```

### Archivo: `data\ontologia.json`
```json
{
  "tripletas": [
    {"sujeto": "Calificación", "predicado": "pertenece_a", "objeto": "Académica"},
    {"sujeto": "Examen", "predicado": "pertenece_a", "objeto": "Académica"},
    {"sujeto": "Materia", "predicado": "pertenece_a", "objeto": "Académica"},
    {"sujeto": "Beca", "predicado": "pertenece_a", "objeto": "Financiera/Becas"},
    {"sujeto": "Colegiatura", "predicado": "pertenece_a", "objeto": "Financiera/Becas"},
    {"sujeto": "Reembolso", "predicado": "pertenece_a", "objeto": "Financiera/Becas"},
    {"sujeto": "Red", "predicado": "pertenece_a", "objeto": "Soporte Técnico"},
    {"sujeto": "Plataforma", "predicado": "pertenece_a", "objeto": "Soporte Técnico"},
    {"sujeto": "Contraseña", "predicado": "pertenece_a", "objeto": "Soporte Técnico"},
    {"sujeto": "Constancia", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Baja", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Historial Académico", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Acoso", "predicado": "pertenece_a", "objeto": "Bienestar Universitario"},
    {"sujeto": "Emergencia", "predicado": "pertenece_a", "objeto": "Bienestar Universitario"},
    {"sujeto": "Apoyo psicológico", "predicado": "pertenece_a", "objeto": "Bienestar Universitario"},
    {"sujeto": "Historial Académico", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Titulación", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Servicio Social", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Trámite", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Equivalencia", "predicado": "pertenece_a", "objeto": "Servicios Escolares"},
    {"sujeto": "Calificación", "predicado": "gestionada_por", "objeto": "Coordinación Académica"},
    {"sujeto": "Examen", "predicado": "gestionada_por", "objeto": "Coordinación Académica"},
    {"sujeto": "Materia", "predicado": "gestionada_por", "objeto": "Coordinación Académica"},
    {"sujeto": "Beca", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Colegiatura", "predicado": "gestionada_por", "objeto": "Caja y Finanzas"},
    {"sujeto": "Reembolso", "predicado": "gestionada_por", "objeto": "Caja y Finanzas"},
    {"sujeto": "Red", "predicado": "gestionada_por", "objeto": "Soporte Técnico"},
    {"sujeto": "Plataforma", "predicado": "gestionada_por", "objeto": "Soporte Técnico"},
    {"sujeto": "Contraseña", "predicado": "gestionada_por", "objeto": "Soporte Técnico"},
    {"sujeto": "Constancia", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Baja", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Historial Académico", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Acoso", "predicado": "gestionada_por", "objeto": "Bienestar Universitario"},
    {"sujeto": "Emergencia", "predicado": "gestionada_por", "objeto": "Bienestar Universitario"},
    {"sujeto": "Apoyo psicológico", "predicado": "gestionada_por", "objeto": "Bienestar Universitario"},
    {"sujeto": "Historial Académico", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Titulación", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Servicio Social", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Equivalencia", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Trámite", "predicado": "gestionada_por", "objeto": "Servicios Escolares"},
    {"sujeto": "Servicios Escolares", "predicado": "depende_de", "objeto": "Secretaría Académica"},
    {"sujeto": "Coordinación Académica", "predicado": "depende_de", "objeto": "Secretaría Académica"},
    {"sujeto": "Caja y Finanzas", "predicado": "depende_de", "objeto": "Administración"},
    {"sujeto": "Soporte Técnico", "predicado": "depende_de", "objeto": "Dirección de TI"},
    {"sujeto": "Bienestar Universitario", "predicado": "depende_de", "objeto": "Dirección"}
  ],
  "terminos": {
    "Calificación": ["calificacion", "calificaciones", "nota", "promedio", "kardex"],
    "Examen": ["examen", "parcial", "extraordinario", "evaluacion", "prueba", "test"],
    "Materia": ["materia", "profesor", "docente", "maestro", "clase", "curso", "tutoria", "asesoria"],
    "Beca": ["beca", "becas", "manutencion", "apoyo economico"],
    "Colegiatura": ["colegiatura", "mensualidad", "pago", "pagar", "adeudo", "inscripcion"],
    "Reembolso": ["reembolso", "cobraron", "cargo"],
    "Red": ["red", "wifi", "internet", "conexion", "servidor"],
    "Plataforma": ["plataforma", "moodle", "portal", "sistema", "correo"],
    "Contraseña": ["contrasena", "sesion", "cuenta", "bloqueada"],
    "Constancia": ["constancia", "certificado", "credencial", "carta", "titulacion", "expediente", "historial"],
    "Baja": ["baja", "reinscripcion", "cambio de carrera", "equivalencia", "abandono", "retiro"],
    "Historial Académico": ["historial academico", "historial de calificaciones", "record academico", "kardex", "boleta de calificaciones", "calificaciones"],
    "Acoso": ["acoso", "hostiga", "amenaza", "bullying", "violencia", "agresion", "discriminacion"],
    "Emergencia": ["emergencia", "accidente", "desmayo", "herido", "robo"],
    "Apoyo psicológico": ["psicologico", "psicologia", "ansiedad", "deprimida", "depresion", "estres"],
    "Trámite": ["tramite", "trámite", "gestión", "gestion", "solicitud", "papeleo", "documento"],
    "Titulación": ["titulacion", "título", "titulo", "cedula", "cédula profesional", "graduación"],
    "Servicio Social": ["servicio social", "prácticas", "practicas", "residencia", "internado"],
    "Equivalencia": ["equivalencia", "convalidación", "convalidacion", "revalidación", "revalidacion", "materias de otra universidad"],
    "Coordinación Académica": ["coordinación", "coordinacion", "coordinador", "director de carrera"]

  }
}

```

### Archivo: `data\reglas.json`
```json
{
  "prioridad_base": {
    "Académica": "Baja",
    "Financiera/Becas": "Baja",
    "Servicios Escolares": "Baja",
    "Soporte Técnico": "Media",
    "Bienestar Universitario": "Media"
  },
  "reglas": [
    {
      "nombre": "R1_acoso_violencia",
      "terminos": ["acoso", "hostiga", "amenaza", "amenazas", "violencia", "agresion", "bullying", "maltrato", "discriminacion", "comentarios inapropiados"],
      "requiere_categoria": null,
      "prioridad": "Alta",
      "alerta_humana": true,
      "forzar_categoria": "Bienestar Universitario",
      "descripcion": "SI contiene acoso/violencia ENTONCES prioridad Alta + alerta a supervisor"
    },
    {
      "nombre": "R2_emergencia",
      "terminos": ["emergencia", "accidente", "herido", "desmayo", "ambulancia", "hacerse dano", "suicidio", "suicidarme", "quitarme la vida"],
      "requiere_categoria": null,
      "prioridad": "Alta",
      "alerta_humana": true,
      "forzar_categoria": "Bienestar Universitario",
      "descripcion": "SI contiene emergencia/riesgo vital ENTONCES prioridad Alta + alerta"
    },
    {
      "nombre": "R3_seguridad",
      "terminos": ["robo", "asalto", "inseguro", "arma"],
      "requiere_categoria": null,
      "prioridad": "Alta",
      "alerta_humana": true,
      "forzar_categoria": "Bienestar Universitario",
      "descripcion": "SI contiene robo/inseguridad ENTONCES prioridad Alta + alerta"
    },
    {
      "nombre": "R4_falla_masiva",
      "terminos": ["falla", "caida", "cayo", "impide", "nos impide", "no responde", "toda la", "todos"],
      "requiere_categoria": "Soporte Técnico",
      "prioridad": "Alta",
      "alerta_humana": false,
      "forzar_categoria": null,
      "descripcion": "SI categoría=Soporte Y hay falla/caída general ENTONCES prioridad Alta"
    },
    {
      "nombre": "R5_urgencia_explicita",
      "terminos": ["urgente", "urgencia", "hoy", "manana", "inmediato", "lo antes posible"],
      "requiere_categoria": null,
      "prioridad": "Media",
      "alerta_humana": false,
      "forzar_categoria": null,
      "descripcion": "SI el usuario indica urgencia ENTONCES prioridad al menos Media"
    },
    {
      "nombre": "R6_plazos",
      "terminos": ["fecha limite", "cierre de", "plazo", "vence", "antes del cierre"],
      "requiere_categoria": null,
      "prioridad": "Media",
      "alerta_humana": false,
      "forzar_categoria": null,
      "descripcion": "SI menciona plazos/fechas límite ENTONCES prioridad al menos Media"
    },
    {
      "nombre": "R7_dinero_retenido",
      "terminos": ["suspendieron", "no me ha llegado", "cobraron dos veces"],
      "requiere_categoria": "Financiera/Becas",
      "prioridad": "Media",
      "alerta_humana": false,
      "forzar_categoria": null,
      "descripcion": "SI hay problema de dinero/beca retenida ENTONCES prioridad Media"
    },
    {
      "nombre": "R8_texto_ambiguo",
      "terminos": ["ambiguo", "poco claro", "no especificado", "no se que", "no se como", "no se donde", "algo sobre un", "no estoy seguro de", "no tengo claro", "duda general", "no sabria", "no sabría"],
      "requiere_categoria": null,
      "prioridad": "Media",
      "alerta_humana": true,
      "forzar_categoria": null,
      "descripcion": "SI el texto es vago/ambiguo ENTONCES alerta al supervisor humano para revisión manual"
    },
    {
      "nombre": "R9_solicitud_mixta",
      "terminos": ["ademas", "además", "y también", "y tambien", "por otro lado", "también necesito", "tambien necesito"],
      "requiere_categoria": null,
      "prioridad": "Media",
      "alerta_humana": true,
      "forzar_categoria": null,
      "descripcion": "SI el usuario menciona múltiples temas ENTONCES alerta al supervisor porque puede requerir canalización dual"
    }
  ]
}

```

### Archivo: `database\schema.sql`
```sql
-- ==============================================================================
-- Script de Base de Datos PostgreSQL - Sistema Universitario (SICOU_IA)
-- ==============================================================================

-- 1. Tabla de Facultades / Áreas Universitarias
CREATE TABLE IF NOT EXISTS facultades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserción de las Facultades oficiales requeridas
INSERT INTO facultades (id, nombre) VALUES
    (1, 'Facultad de Arquitectura'),
    (2, 'Facultad de Contaduría y Administración'),
    (3, 'Facultad de Ingeniería'),
    (4, 'Facultad de Lenguas'),
    (5, 'Facultad de Ciencias en Física y Matemáticas'),
    (6, 'Facultad de Medicina Humana'),
    (7, 'Facultad de Medicina Veterinaria y Zootecnia'),
    (8, 'Facultad de Humanidades')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;


-- 2. Tabla de Roles de Usuario
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(150)
);

-- Inserción de Roles: Administrador y Estudiante
INSERT INTO roles (id, nombre, descripcion) VALUES
    (1, 'administrador', 'Acceso al panel administrativo y de gerencia'),
    (2, 'estudiante', 'Acceso al portal de solicitudes del alumno')
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, descripcion = EXCLUDED.descripcion;


-- 3. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    facultad_id INT, -- Puede ser NULL si es un administrador general
    rol_id INT NOT NULL DEFAULT 2, -- Por defecto 2 (estudiante)
    rol VARCHAR(50) DEFAULT 'estudiante',
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_facultad FOREIGN KEY (facultad_id) 
        REFERENCES facultades(id) ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) 
        REFERENCES roles(id) ON DELETE RESTRICT
);

-- Actualizaciones en caso de que la tabla ya existiese previamente
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'rol_id') THEN
        ALTER TABLE usuarios ADD COLUMN rol_id INT REFERENCES roles(id) DEFAULT 2;
    END IF;
    ALTER TABLE usuarios ALTER COLUMN facultad_id DROP NOT NULL;
END $$;


-- 4. Registro del Primer Administrador Oficial
-- Usuario: administrador
-- Correo: adminsicou@unach.mx
-- Contraseña plana: administrador -> SHA-256: b20b0f63ce2ed361e8845d6bf2e59811aaa06ec96bcdb92f9bc0c5a25e83c9a6
INSERT INTO usuarios (nombre, correo, contrasena, facultad_id, rol_id, rol, activo)
VALUES (
    'administrador',
    'adminsicou@unach.mx',
    'b20b0f63ce2ed361e8845d6bf2e59811aaa06ec96bcdb92f9bc0c5a25e83c9a6',
    1,
    1,
    'administrador',
    TRUE
)
ON CONFLICT (correo) DO UPDATE 
SET nombre = 'administrador',
    rol_id = 1,
    rol = 'administrador',
    contrasena = 'b20b0f63ce2ed361e8845d6bf2e59811aaa06ec96bcdb92f9bc0c5a25e83c9a6',
    activo = TRUE;


-- 5. Tabla de Departamentos / Canales de Atención
CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

INSERT INTO departamentos (nombre) VALUES
    ('Servicios Escolares'),
    ('Soporte Técnico'),
    ('Bienestar Universitario'),
    ('Caja y Finanzas'),
    ('Bandeja de revisión por Supervisor Humano')
ON CONFLICT (nombre) DO NOTHING;


-- 6. Tabla de Solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    departamento_id INT REFERENCES departamentos(id) ON DELETE SET NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(100),
    prioridad VARCHAR(50),
    canal_destino VARCHAR(100),
    confianza NUMERIC(5, 4),
    alerta_supervisor BOOLEAN DEFAULT FALSE,
    motivo_alerta TEXT,
    palabras_clave TEXT,
    reglas_activadas TEXT,
    conceptos TEXT,
    tripletas TEXT,
    notificaciones TEXT,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_facultad ON usuarios(facultad_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario ON solicitudes(usuario_id);

```

