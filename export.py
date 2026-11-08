import os

carpeta_origen = "." 
archivo_salida = "codigo_sistema_solicitudes_completo.md"

# Ignoramos la carpeta virtual, caché y carpetas innecesarias
ignorar_carpetas = ['.git', '.venv', '__pycache__', '.vscode']

# Ignoramos el propio script de exportación
ignorar_archivos = ['export.py', archivo_salida]

# Extensiones de código, JSON, SQL, estilos y documentación
extensiones_codigo = ['.py', '.sql', '.html', '.css', '.js', '.json', '.md', '.txt', '.env']

with open(archivo_salida, 'w', encoding='utf-8') as f:
    f.write("# Estructura y Código del Sistema de Solicitudes\n\n")
    
    # 1. GENERAR ÁRBOL DE CARPETAS
    f.write("## 1. Estructura de Directorios\n```text\n")
    for root, dirs, files in os.walk(carpeta_origen):
        dirs[:] = sorted([d for d in dirs if d not in ignorar_carpetas])
        nivel = root.replace(carpeta_origen, '').count(os.sep)
        indentacion = ' ' * 4 * nivel
        nombre_carpeta = os.path.basename(root) if root != '.' else 'Sistema_Solicitudes'
        f.write(f"{indentacion}{nombre_carpeta}/\n")
        sub_indent = ' ' * 4 * (nivel + 1)
        
        for file in sorted(files):
            if file not in ignorar_archivos and not file.endswith('.pyc'):
                f.write(f"{sub_indent}{file}\n")
    f.write("```\n\n")

    # 2. GENERAR CONTENIDO DE LOS ARCHIVOS
    f.write("## 2. Código Fuente y Datos\n\n")
    for root, dirs, files in os.walk(carpeta_origen):
        dirs[:] = sorted([d for d in dirs if d not in ignorar_carpetas])
        for file in sorted(files):
            es_codigo = any(file.endswith(ext) for ext in extensiones_codigo) or file == '.env'
            
            if es_codigo and file not in ignorar_archivos and not file.endswith('.pyc'):
                ruta_completa = os.path.join(root, file)
                ruta_relativa = os.path.relpath(ruta_completa, carpeta_origen)
                
                f.write(f"### Archivo: `{ruta_relativa}`\n")
                
                # Asignar lenguaje para el resaltado correcto en Markdown
                lenguaje = "text"
                if file.endswith('.py'): lenguaje = "python"
                elif file.endswith('.sql'): lenguaje = "sql"
                elif file.endswith('.html'): lenguaje = "html"
                elif file.endswith('.css'): lenguaje = "css"
                elif file.endswith('.js'): lenguaje = "javascript"
                elif file.endswith('.json'): lenguaje = "json"
                elif file.endswith('.md'): lenguaje = "markdown"
                elif file.endswith('.env') or file == '.env': lenguaje = "bash"
                
                f.write(f"```{lenguaje}\n")
                try:
                    with open(ruta_completa, 'r', encoding='utf-8') as code_file:
                        f.write(code_file.read() + "\n")
                except Exception:
                    f.write("// No se pudo leer el archivo.\n")
                f.write("```\n\n")

print(f"¡Listo! Se ha creado el archivo '{archivo_salida}' incluyendo los JSON de la carpeta data.")