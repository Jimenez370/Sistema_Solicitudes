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


# Se agrega en DB los departamentos/áreas
INSERT INTO facultades (nombre)
VALUES ('Departamento de Coordinación Académica')

INSERT INTO facultades (nombre)
VALUES ('Departamento de Servicios Escolares')

INSERT INTO facultades (nombre)
VALUES ('Departamento Soporte Técnico')

INSERT INTO facultades (nombre)
VALUES ('Departamento de Bienestar Universitario')

# Se cambian los usuarios creados como representantes de áreas a su respectiva area
UPDATE usuarios
SET facultad_id = 10
WHERE id = 5;

UPDATE usuarios
SET facultad_id = 11
WHERE id = 6;

UPDATE usuarios
SET facultad_id = 12
WHERE id = 7;

UPDATE usuarios
SET facultad_id = 13
WHERE id = 8;

__________________________________
interfaz de admon
__________________________________

Ejecutar este script en pgadmin:
# Sincronización de la tabla departamentos con los 4 departamentos oficiales y la columna activo
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'departamentos' AND column_name = 'activo') THEN
        ALTER TABLE departamentos ADD COLUMN activo BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

INSERT INTO departamentos (id, nombre, activo) VALUES
    (1, 'Coordinación Académica', TRUE),
    (2, 'Servicios Escolares', TRUE),
    (3, 'Soporte Técnico', TRUE),
    (4, 'Bienestar Universitario', TRUE)
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, activo = EXCLUDED.activo;


# añadir esta columna a la tabla solicitudes

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS archivo_adjunto VARCHAR(255);


