"""Ontología del dominio universitario como grafo de tripletas Sujeto -> Predicado -> Objeto.

Las tripletas y los términos se cargan desde data/ontologia.json.
"""
import json
import os

import networkx as nx
from preprocesamiento import normalizar

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "ontologia.json")


def _cargar_ontologia() -> tuple[list[tuple[str, str, str]], dict[str, list[str]]]:
    """Lee el archivo JSON y devuelve (tripletas, términos)."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        contenido = json.load(f)
    tripletas = [(t["sujeto"], t["predicado"], t["objeto"])
                 for t in contenido["tripletas"]]
    terminos = contenido["terminos"]
    return tripletas, terminos


TRIPLETAS, TERMINOS = _cargar_ontologia()


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
