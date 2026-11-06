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


