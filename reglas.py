"""Motor de reglas de producción SI-ENTONCES (conocimiento simbólico).

Cada regla evalúa un contexto (texto normalizado, categoría y confianza del
clasificador) y, si se cumple, dispara una acción: subir prioridad,
forzar categoría o exigir supervisión humana.
"""
from dataclasses import dataclass, field
from preprocesamiento import normalizar

ORDEN = {"Baja": 0, "Media": 1, "Alta": 2}

# Prioridad por defecto según la categoría (cuando ninguna regla la sube)
PRIORIDAD_BASE = {
    "Académica": "Baja",
    "Financiera/Becas": "Baja",
    "Servicios Escolares": "Baja",
    "Soporte Técnico": "Media",
    "Bienestar Universitario": "Media",
}


def contiene(texto: str, terminos: list[str]) -> bool:
    t = " " + texto + " "
    return any(f" {x} " in t or (len(x) > 4 and x in t) for x in terminos)


@dataclass
class Regla:
    nombre: str
    condicion: callable             # SI: (texto_normalizado, categoria) -> bool
    prioridad: str | None = None    # ENTONCES: prioridad mínima
    alerta_humana: bool = False     # ENTONCES: enviar a supervisor
    categoria: str | None = None    # ENTONCES: forzar categoría
    descripcion: str = ""


REGLAS = [
    Regla("R1_acoso_violencia",
          lambda t, c: contiene(t, ["acoso", "hostiga", "amenaza", "amenazas", "violencia",
                                    "agresion", "bullying", "maltrato", "discriminacion",
                                    "comentarios inapropiados"]),
          prioridad="Alta", alerta_humana=True, categoria="Bienestar Universitario",
          descripcion="SI contiene acoso/violencia ENTONCES prioridad Alta + alerta a supervisor"),
    Regla("R2_emergencia",
          lambda t, c: contiene(t, ["emergencia", "accidente", "herido", "desmayo", "ambulancia",
                                    "hacerse dano", "suicidio", "suicidarme", "quitarme la vida"]),
          prioridad="Alta", alerta_humana=True, categoria="Bienestar Universitario",
          descripcion="SI contiene emergencia/riesgo vital ENTONCES prioridad Alta + alerta"),
    Regla("R3_seguridad",
          lambda t, c: contiene(t, ["robo", "asalto", "inseguro", "arma"]),
          prioridad="Alta", alerta_humana=True, categoria="Bienestar Universitario",
          descripcion="SI contiene robo/inseguridad ENTONCES prioridad Alta + alerta"),
    Regla("R4_falla_masiva",
          lambda t, c: c == "Soporte Técnico" and contiene(
              t, ["falla", "caida", "cayo", "impide", "nos impide", "no responde", "toda la", "todos"]),
          prioridad="Alta",
          descripcion="SI categoría=Soporte Y hay falla/caída general ENTONCES prioridad Alta"),
    Regla("R5_urgencia_explicita",
          lambda t, c: contiene(t, ["urgente", "urgencia", "hoy", "manana", "inmediato", "lo antes posible"]),
          prioridad="Media",
          descripcion="SI el usuario indica urgencia ENTONCES prioridad al menos Media"),
    Regla("R6_plazos",
          lambda t, c: contiene(t, ["fecha limite", "cierre de", "plazo", "vence", "antes del cierre"]),
          prioridad="Media",
          descripcion="SI menciona plazos/fechas límite ENTONCES prioridad al menos Media"),
    Regla("R7_dinero_retenido",
          lambda t, c: c == "Financiera/Becas" and contiene(t, ["suspendieron", "no me ha llegado", "cobraron dos veces"]),
          prioridad="Media",
          descripcion="SI hay problema de dinero/beca retenida ENTONCES prioridad Media"),
]


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
