"""Módulo de PLN: normalización, tokenización, stopwords y lematización (stemming)."""
import re
import unicodedata
from nltk.stem.snowball import SnowballStemmer

_stemmer = SnowballStemmer("spanish")

STOPWORDS = set("""
a al algo ante con contra cual cuando de del desde donde e el ella ellos en entre era es esa ese eso esta este esto
fue ha han hay la las le les lo los me mi mis muy ni no nos o para pero por porque que quiero necesito se si sin
sobre su sus te tengo un una uno unos unas y ya yo como cuanto cuando puedo solicito quisiera favor buen dia
""".split())


def normalizar(texto: str) -> str:
    """Minúsculas, sin acentos y sin signos de puntuación."""
    texto = texto.lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ\s]", " ", texto)


def tokenizar(texto: str) -> list[str]:
    return normalizar(texto).split()


def preprocesar(texto: str) -> str:
    """Devuelve el texto como cadena de raíces (stems) sin stopwords."""
    tokens = [t for t in tokenizar(texto) if t not in STOPWORDS and len(t) > 1]
    return " ".join(_stemmer.stem(t) for t in tokens)


def extraer_palabras_clave(texto: str) -> list[str]:
    """Palabras relevantes del texto (sin stopwords), sin repetir y en orden."""
    vistas, claves = set(), []
    for t in tokenizar(texto):
        if t not in STOPWORDS and len(t) > 2 and t not in vistas:
            vistas.add(t)
            claves.append(t)
    return claves
