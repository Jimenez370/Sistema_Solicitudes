"""Componente de Aprendizaje Automático: TF-IDF + Regresión Logística (scikit-learn).

Devuelve la categoría y la probabilidad (confianza) de la predicción.
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from dataset import DATOS
from preprocesamiento import preprocesar


def crear_pipeline() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(preprocessor=preprocesar, ngram_range=(1, 2))),
        ("clf", LogisticRegression(C=10, max_iter=2000)),
    ])


class ClasificadorSolicitudes:
    def __init__(self):
        self.modelo = crear_pipeline()
        textos = [t for t, _ in DATOS]
        etiquetas = [c for _, c in DATOS]
        self.modelo.fit(textos, etiquetas)          # <-- ENTRENAMIENTO
        self.vocabulario = set(self.modelo.named_steps["tfidf"].vocabulary_)

    def predecir(self, texto: str) -> tuple[str, float, dict]:
        """Retorna (categoría, confianza, probabilidades por clase)."""
        # Si ninguna palabra del texto existe en el vocabulario aprendido,
        # el modelo no tiene evidencia: confianza 0.
        tokens = preprocesar(texto).split()
        if not any(t in self.vocabulario for t in tokens):
            return "Desconocida", 0.0, {}
        probas = self.modelo.predict_proba([texto])[0]   # <-- INFERENCIA
        clases = self.modelo.classes_
        i = probas.argmax()
        return clases[i], float(probas[i]), dict(zip(clases, map(float, probas)))
