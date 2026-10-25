"""Punto de entrada. Uso:
    python main.py              -> ejecuta ejemplos de demostración
    python main.py -i           -> modo interactivo (texto libre)
"""
import sys
from agente import AgenteSolicitudes, mostrar

EJEMPLOS = [
    "Necesito saber por qué no aparece mi calificación del semestre",
    "Se cayó la red de toda la universidad y no podemos entrar a la plataforma",
    "Quiero solicitar informes sobre los requisitos para la beca de manutención",
    "Un compañero me amenaza y me hostiga todos los días",
    "Necesito una constancia de estudios para un trámite",
    "asdf algo sobre un tema que no sé cómo explicar",
]

if __name__ == "__main__":
    agente = AgenteSolicitudes()
    if "-i" in sys.argv:
        print("Escribe tu solicitud (vacío para salir):")
        while (texto := input("> ").strip()):
            mostrar(agente.procesar(texto))
    else:
        for e in EJEMPLOS:
            mostrar(agente.procesar(e))
