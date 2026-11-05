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
