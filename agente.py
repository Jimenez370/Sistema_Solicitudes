"""Agente inteligente racional (modelo REAS / PAMA) con supervisión humana.

La configuración del agente (canales, umbral) se carga desde data/agente_config.json.

REAS (agente racional):
  Rendimiento : clasificar/priorizar/canalizar correctamente y escalar lo crítico.
  Entorno     : solicitudes universitarias en texto libre.
  Actuadores  : asignación de canal, notificaciones y alertas al supervisor.
  Sensores    : texto de la solicitud.
PAMA (ciclo): Percepción -> Análisis (IA) -> Meta (reglas) -> Acción.
"""
import json
import os
from dataclasses import dataclass, field

import ontologia
from clasificador import ClasificadorSolicitudes
from preprocesamiento import extraer_palabras_clave
from reglas import aplicar_reglas

_DIR = os.path.dirname(os.path.abspath(__file__))
_RUTA_JSON = os.path.join(_DIR, "data", "agente_config.json")


def _cargar_config() -> dict:
    """Lee la configuración del agente desde el JSON."""
    with open(_RUTA_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


_CONFIG = _cargar_config()
UMBRAL_CONFIANZA = _CONFIG["umbral_confianza"]
BANDEJA_SUPERVISOR = _CONFIG["bandeja_supervisor"]
CANAL_POR_DEFECTO = _CONFIG["canal_por_defecto"]


@dataclass
class Resultado:
    texto: str
    palabras_clave: list
    categoria: str
    confianza: float
    prioridad: str
    canal: str
    alerta_supervisor: bool
    motivo_alerta: str
    reglas: list = field(default_factory=list)
    conceptos: list = field(default_factory=list)
    tripletas: list = field(default_factory=list)
    notificaciones: list = field(default_factory=list)


class AgenteSolicitudes:
    def __init__(self, umbral: float = UMBRAL_CONFIANZA):
        self.clasificador = ClasificadorSolicitudes()
        self.umbral = umbral

    def procesar(self, texto: str) -> Resultado:
        # PERCEPCIÓN + PLN
        claves = extraer_palabras_clave(texto)
        # ANÁLISIS: componente de ML
        cat_ml, confianza, _ = self.clasificador.predecir(texto)
        # CONOCIMIENTO SIMBÓLICO: ontología + reglas
        conceptos = ontologia.conceptos_detectados(texto)
        if cat_ml == "Desconocida":
            categoria, prioridad, alerta_regla, reglas = cat_ml, "Media", False, []
            confianza = 0.0
        else:
            r = aplicar_reglas(texto, cat_ml)
            categoria, prioridad, alerta_regla, reglas = r.categoria, r.prioridad, r.alerta_humana, r.reglas_activadas

        # CANALIZACIÓN: ontología (concepto -> gestionada_por) o canal por defecto
        canal = CANAL_POR_DEFECTO.get(categoria, BANDEJA_SUPERVISOR)
        tripletas = []
        for c in conceptos:
            if ontologia.consultar(c, "pertenece_a") == categoria:
                dest = ontologia.consultar(c, "gestionada_por")
                if dest:
                    canal = dest
                    tripletas.append((c, "gestionada_por", dest))
                    break

        
        # SUPERVISIÓN HUMANA
        motivo = ""
        if categoria == "Desconocida":
            confianza = 0.0
            motivo = f"Texto incoherente o desconocido (confianza: 0.00 < {self.umbral})"
            canal = BANDEJA_SUPERVISOR
            alerta = True
        elif alerta_regla:
            motivo = "Criticidad alta (reglas: " + ", ".join(reglas) + ")"
            # Solo enviar al supervisor si la alerta viene de R8 o R9 (ambigüedad/mixto)
            if any(r in ["R8_texto_ambiguo", "R9_solicitud_mixta"] for r in reglas):
                canal = BANDEJA_SUPERVISOR
            alerta = True
        elif confianza < self.umbral:
            motivo = f"Confianza baja ({confianza:.2f} < {self.umbral})"
            canal = BANDEJA_SUPERVISOR
            alerta = True
        else:
            alerta = False

        # ACCIÓN: notificaciones simuladas
        notif = []
        if alerta:
            notif.append(f"[ALERTA] Supervisor humano: revisar solicitud ({motivo}).")
            if alerta_regla:
                notif.append(f"[NOTIFICACIÓN] {canal}: caso crítico, atención inmediata.")
        else:
            notif.append(f"[NOTIFICACIÓN] {canal}: nueva solicitud {categoria}, prioridad {prioridad}.")
            notif.append("[NOTIFICACIÓN] Solicitante: su solicitud fue canalizada correctamente.")

        return Resultado(texto, claves, categoria, confianza, prioridad, canal,
                         alerta, motivo, reglas, conceptos, tripletas, notif)


def mostrar(res: Resultado) -> None:
    print("=" * 70)
    print(f"Solicitud     : {res.texto}")
    print(f"Palabras clave: {', '.join(res.palabras_clave)}")
    print(f"Conceptos     : {', '.join(res.conceptos) or '-'}")
    print(f"Categoría     : {res.categoria}   (confianza ML: {res.confianza:.2f})")
    print(f"Prioridad     : {res.prioridad}")
    print(f"Reglas        : {', '.join(res.reglas) or '-'}")
    print(f"Canal         : {res.canal}")
    print(f"Alerta humana : {'SÍ - ' + res.motivo_alerta if res.alerta_supervisor else 'No'}")
    for n in res.notificaciones:
        print("  ", n)
