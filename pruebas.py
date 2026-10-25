"""Fase 6 (apoyo): ejecuta pruebas y genera la tabla en consola y en resultados_pruebas.md.
Las pruebas son libres: edita la lista PRUEBAS con los casos de tu equipo.
Formato: (entrada, categoria_esperada, prioridad_esperada, canal_esperado, alerta_esperada)
"""
from agente import AgenteSolicitudes, BANDEJA_SUPERVISOR
from clasificador import crear_pipeline
from dataset import DATOS
from sklearn.model_selection import cross_val_score, StratifiedKFold

PRUEBAS = [
    ("Necesito saber por qué no aparece mi calificación del semestre",
     "Académica", "Baja", "Servicios Escolares", False),
    ("Existe una falla de red que nos impide acceder a la plataforma universitaria",
     "Soporte Técnico", "Alta", "Soporte Técnico", False),
    ("Quiero solicitar informes sobre los requisitos para la beca de manutención",
     "Financiera/Becas", "Baja", "Servicios Escolares", False),
    ("Reporte de situación grave de acoso en el campus",
     "Bienestar Universitario", "Alta", "Bienestar Universitario", True),
    ("Texto ambiguo o poco claro sobre un trámite no especificado",
     None, None, BANDEJA_SUPERVISOR, True),
    ("NECESITO MI CONSTANCIA DE ESTUDIOS URGENTE PARA MAÑANA",
     "Servicios Escolares", "Media", "Servicios Escolares", False),
    ("no puedo entrar a mi cuenta del correo institucional, olvide la contraseña",
     "Soporte Técnico", "Media", "Soporte Técnico", False),
    ("Un alumno se desmayó en el patio y necesita una ambulancia",
     "Bienestar Universitario", "Alta", "Bienestar Universitario", True),
    ("Quiero saber cuando es la fecha limite para pagar la colegiatura",
     "Financiera/Becas", "Media", "Caja y Finanzas", False),
    ("Necesito una beca y además no puedo entrar a la plataforma de tareas",
     "Financiera/Becas", "Baja", "Servicios Escolares", False),
    ("asdf algo sobre un tema que no sé cómo explicar",
     None, None, BANDEJA_SUPERVISOR, True),
]


def main():
    agente = AgenteSolicitudes()
    filas = ["| Prueba | Entrada | Resultado esperado | Resultado obtenido | ¿Fue correcto? | Observaciones |",
             "|---|---|---|---|---|---|"]
    ok_total = 0
    for i, (texto, cat, pri, canal, alerta) in enumerate(PRUEBAS, 1):
        r = agente.procesar(texto)
        ok = (r.canal == canal and r.alerta_supervisor == alerta
              and (cat is None or r.categoria == cat) and (pri is None or r.prioridad == pri))
        ok_total += ok
        esperado = f"Cat: {cat or 'n/a'} / Prior: {pri or 'n/a'} / Canal: {canal} / Alerta: {'Sí' if alerta else 'No'}"
        obtenido = (f"Cat: {r.categoria} / Prior: {r.prioridad} / Canal: {r.canal} / "
                    f"Alerta: {'Sí' if r.alerta_supervisor else 'No'}")
        obs = (f"Confianza={r.confianza:.2f}; reglas={','.join(r.reglas) or 'ninguna'}; "
               f"conceptos={','.join(r.conceptos) or 'ninguno'}")
        filas.append(f"| {i} | \"{texto}\" | {esperado} | {obtenido} | {'Sí' if ok else 'No'} | {obs} |")
    tabla = "\n".join(filas)
    print(tabla)
    print(f"\nPruebas correctas: {ok_total}/{len(PRUEBAS)}")

    # Métrica global del clasificador de ML (validación cruzada 5 pliegues)
    X = [t for t, _ in DATOS]; y = [c for _, c in DATOS]
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    acc = cross_val_score(crear_pipeline(), X, y, cv=cv)
    print(f"Accuracy del clasificador (validación cruzada 5-fold): {acc.mean():.2f} ± {acc.std():.2f}")
    with open("resultados_pruebas.md", "w", encoding="utf-8") as f:
        f.write(tabla + f"\n\nPruebas correctas: {ok_total}/{len(PRUEBAS)}\n"
                f"Accuracy (5-fold): {acc.mean():.2f} ± {acc.std():.2f}\n")


if __name__ == "__main__":
    main()
