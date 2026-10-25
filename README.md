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

## Módulos
| Archivo | Función | ¿Es IA? |
|---|---|---|
| `dataset.py` | 80 solicitudes etiquetadas (16 por categoría) | Datos de entrenamiento |
| `preprocesamiento.py` | Normalización, tokenización, stopwords, stemming (NLTK Snowball), palabras clave | PLN |
| `clasificador.py` | TF-IDF + Regresión Logística; devuelve categoría y probabilidad | **IA (aprendizaje automático)** |
| `ontologia.py` | Tripletas Sujeto→Predicado→Objeto en grafo NetworkX | **IA (representación del conocimiento)** |
| `reglas.py` | Motor SI-ENTONCES: prioridad, criticidad, forzar categoría | **IA (sistema basado en reglas)** |
| `agente.py` | Agente REAS/PAMA: orquesta todo, canaliza, notifica, escala a humano | Agente racional |
| `main.py` / `pruebas.py` | Ejecución y plan de pruebas | - |

## Flujo
texto libre → PLN → clasificador ML (categoría + confianza) → ontología (conceptos) → reglas (prioridad/criticidad)
→ canal → ¿criticidad alta o confianza < 0.50? → supervisor humano : notificación automática.

**Categoría** = tipo de solicitud (ML). **Canal** = departamento que la atiende (ontología).
