"""Ontología del dominio universitario como grafo de tripletas Sujeto -> Predicado -> Objeto."""
import networkx as nx
from preprocesamiento import normalizar

# (Sujeto, Predicado, Objeto)
TRIPLETAS = [
    # Conceptos -> categoría
    ("Calificación", "pertenece_a", "Académica"),
    ("Examen", "pertenece_a", "Académica"),
    ("Materia", "pertenece_a", "Académica"),
    ("Beca", "pertenece_a", "Financiera/Becas"),
    ("Colegiatura", "pertenece_a", "Financiera/Becas"),
    ("Reembolso", "pertenece_a", "Financiera/Becas"),
    ("Red", "pertenece_a", "Soporte Técnico"),
    ("Plataforma", "pertenece_a", "Soporte Técnico"),
    ("Contraseña", "pertenece_a", "Soporte Técnico"),
    ("Constancia", "pertenece_a", "Servicios Escolares"),
    ("Baja", "pertenece_a", "Servicios Escolares"),
    ("Kárdex", "pertenece_a", "Servicios Escolares"),
    ("Acoso", "pertenece_a", "Bienestar Universitario"),
    ("Emergencia", "pertenece_a", "Bienestar Universitario"),
    ("Apoyo psicológico", "pertenece_a", "Bienestar Universitario"),
    # Conceptos -> departamento responsable
    ("Calificación", "gestionada_por", "Servicios Escolares"),
    ("Examen", "gestionada_por", "Coordinación Académica"),
    ("Materia", "gestionada_por", "Coordinación Académica"),
    ("Beca", "gestionada_por", "Servicios Escolares"),
    ("Colegiatura", "gestionada_por", "Caja y Finanzas"),
    ("Reembolso", "gestionada_por", "Caja y Finanzas"),
    ("Red", "gestionada_por", "Soporte Técnico"),
    ("Plataforma", "gestionada_por", "Soporte Técnico"),
    ("Contraseña", "gestionada_por", "Soporte Técnico"),
    ("Constancia", "gestionada_por", "Servicios Escolares"),
    ("Baja", "gestionada_por", "Servicios Escolares"),
    ("Kárdex", "gestionada_por", "Servicios Escolares"),
    ("Acoso", "gestionada_por", "Bienestar Universitario"),
    ("Emergencia", "gestionada_por", "Bienestar Universitario"),
    ("Apoyo psicológico", "gestionada_por", "Bienestar Universitario"),
    # Departamentos -> estructura
    ("Servicios Escolares", "depende_de", "Secretaría Académica"),
    ("Coordinación Académica", "depende_de", "Secretaría Académica"),
    ("Caja y Finanzas", "depende_de", "Administración"),
    ("Soporte Técnico", "depende_de", "Dirección de TI"),
    ("Bienestar Universitario", "depende_de", "Dirección"),
]

# Términos del texto (ya normalizados) que activan cada concepto
TERMINOS = {
    "Calificación": ["calificacion", "calificaciones", "nota", "promedio", "kardex"],
    "Examen": ["examen", "parcial", "extraordinario", "evaluacion"],
    "Materia": ["materia", "profesor", "docente", "maestro", "clase", "curso", "tutoria"],
    "Beca": ["beca", "becas", "manutencion", "apoyo economico"],
    "Colegiatura": ["colegiatura", "mensualidad", "pago", "pagar", "adeudo", "inscripcion"],
    "Reembolso": ["reembolso", "cobraron", "cargo"],
    "Red": ["red", "wifi", "internet", "conexion", "servidor"],
    "Plataforma": ["plataforma", "moodle", "portal", "sistema", "correo"],
    "Contraseña": ["contrasena", "sesion", "cuenta", "bloqueada"],
    "Constancia": ["constancia", "certificado", "credencial", "carta", "titulacion", "expediente"],
    "Baja": ["baja", "reinscripcion", "cambio de carrera", "equivalencia"],
    "Kárdex": ["kardex", "historial"],
    "Acoso": ["acoso", "hostiga", "amenaza", "bullying", "violencia", "agresion", "discriminacion"],
    "Emergencia": ["emergencia", "accidente", "desmayo", "herido", "robo"],
    "Apoyo psicológico": ["psicologico", "psicologia", "ansiedad", "deprimida", "depresion", "estres"],
}


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
