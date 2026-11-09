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
-- Los tres roles del sistema
INSERT INTO roles (id, nombre, descripcion) VALUES
    (1, 'administrador', 'Acceso general a todos los departamentos'),
    (2, 'estudiante', 'Acceso a sus propias solicitudes'),
    (3, 'gerente_area', 'Acceso únicamente a su departamento')
ON CONFLICT (id) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion;


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
    nombre VARCHAR(150) NOT NULL UNIQUE,
    descripcion VARCHAR(200),
    activo BOOLEAN DEFAULT TRUE
);

-- Asegurar columna activo si la tabla ya existía
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
