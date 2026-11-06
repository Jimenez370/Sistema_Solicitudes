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

