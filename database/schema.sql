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

-- 3. Inserción de las Facultades oficiales requeridas
INSERT INTO facultades (nombre) VALUES
    ('Facultad de Arquitectura'),
    ('Facultad de Contaduría y Administración'),
    ('Facultad de Ingeniería'),
    ('Facultad de Lenguas'),
    ('Facultad de Ciencias en Física y Matemáticas'),
    ('Facultad de Medicina Humana'),
    ('Facultad de Medicina Veterinaria y Zootecnia'),
    ('Facultad de Humanidades')
ON CONFLICT (nombre) DO NOTHING;

-- 4. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    correo VARCHAR(150) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    facultad_id INT NOT NULL,
    rol VARCHAR(50) DEFAULT 'usuario', -- 'usuario', 'gerente_area', 'administrador'
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuario_facultad FOREIGN KEY (facultad_id) 
        REFERENCES facultades(id) ON DELETE RESTRICT
);

-- 5. Índices para acelerar búsquedas en el login
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);
CREATE INDEX IF NOT EXISTS idx_usuarios_facultad ON usuarios(facultad_id);

