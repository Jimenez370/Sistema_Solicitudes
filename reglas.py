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
