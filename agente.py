"""Agente inteligente racional (modelo REAS / PAMA) con supervisión humana.

REAS (agente racional):
  Rendimiento : clasificar/priorizar/canalizar correctamente y escalar lo crítico.
  Entorno     : solicitudes universitarias en texto libre.
  Actuadores  : asignación de canal, notificaciones y alertas al supervisor.
  Sensores    : texto de la solicitud.
PAMA (ciclo): Percepción -> Análisis (IA) -> Meta (reglas) -> Acción.
"""
from dataclasses import dataclass, field

import ontologia
from clasificador import ClasificadorSolicitudes
from preprocesamiento import extraer_palabras_clave
from reglas import aplicar_reglas

UMBRAL_CONFIANZA = 0.50
BANDEJA_SUPERVISOR = "Bandeja de revisión por Supervisor Humano"

CANAL_POR_DEFECTO = {
    "Académica": "Coordinación Académica",
    "Financiera/Becas": "Servicios Escolares",
    "Soporte Técnico": "Soporte Técnico",
    "Servicios Escolares": "Servicios Escolares",
    "Bienestar Universitario": "Bienestar Universitario",
}


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
        if alerta_regla:
            motivo = "Criticidad alta (reglas: " + ", ".join(reglas) + ")"
        elif confianza < self.umbral:
            motivo = f"Confianza baja ({confianza:.2f} < {self.umbral})"
        alerta = bool(motivo)
        if alerta and not alerta_regla:
            canal = BANDEJA_SUPERVISOR      # no se procesa automáticamente

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
