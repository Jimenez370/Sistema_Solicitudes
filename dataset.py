"""Dataset propio de solicitudes universitarias etiquetadas (datos de entrenamiento).

Se simulan solicitudes reales de estudiantes, docentes y personal administrativo.
Cada tupla es (texto, categoria).
"""

ACADEMICA = "Académica"
BECAS = "Financiera/Becas"
SOPORTE = "Soporte Técnico"
ESCOLARES = "Servicios Escolares"
BIENESTAR = "Bienestar Universitario"

DATOS = [
    # ---------------- Académica ----------------
    ("Necesito saber por qué no aparece mi calificación del semestre", ACADEMICA),
    ("Quiero revisar mi examen final porque creo que la nota está mal", ACADEMICA),
    ("El profesor no ha subido las calificaciones del parcial", ACADEMICA),
    ("Solicito una revisión de calificación de la materia de cálculo", ACADEMICA),
    ("Tengo dudas sobre el programa de la materia y los temas del curso", ACADEMICA),
    ("El docente falta mucho a clases y no se cubre el temario", ACADEMICA),
    ("Quiero cambiar de grupo en la materia de programación", ACADEMICA),
    ("Necesito información sobre el plan de estudios de mi carrera", ACADEMICA),
    ("Pido una asesoría académica para recuperar la materia reprobada", ACADEMICA),
    ("No estoy de acuerdo con la evaluación de mi proyecto final", ACADEMICA),
    ("Como solicito presentar un examen extraordinario de álgebra", ACADEMICA),
    ("El maestro no entrega las rúbricas de evaluación de la materia", ACADEMICA),
    ("Quiero saber mi promedio y las materias que me faltan por cursar", ACADEMICA),
    ("Solicito que revisen la calificación de mi tarea y de mi examen", ACADEMICA),
    ("Mi nota del semestre no coincide con lo que dijo el profesor", ACADEMICA),
    ("Necesito tutoría para la materia de física porque voy atrasado", ACADEMICA),
    # ---------------- Financiera / Becas ----------------
    ("Quiero solicitar informes sobre los requisitos para la beca de manutención", BECAS),
    ("Cuándo es la fecha límite para pagar la colegiatura del semestre", BECAS),
    ("Me cobraron dos veces la inscripción y necesito un reembolso", BECAS),
    ("Necesito apoyo económico porque no puedo pagar la mensualidad", BECAS),
    ("Como renuevo mi beca académica para el siguiente semestre", BECAS),
    ("Solicito una prórroga para pagar la colegiatura atrasada", BECAS),
    ("No me ha llegado el depósito de mi beca este mes", BECAS),
    ("Quiero información sobre descuentos y becas por promedio", BECAS),
    ("Hay un cargo que no reconozco en mi estado de cuenta", BECAS),
    ("Necesito mi comprobante de pago y la factura de la inscripción", BECAS),
    ("Requisitos para aplicar a la beca de excelencia deportiva", BECAS),
    ("Me suspendieron la beca y quiero saber el motivo", BECAS),
    ("Puedo pagar en parcialidades el costo del semestre", BECAS),
    ("Cuánto cuesta la inscripción y qué apoyos financieros existen", BECAS),
    ("Tengo un adeudo en caja y quiero aclarar el monto", BECAS),
    ("Información sobre convocatoria de becas y crédito educativo", BECAS),
    # ---------------- Soporte Técnico ----------------
    ("Existe una falla de red que nos impide acceder a la plataforma universitaria", SOPORTE),
    ("No puedo iniciar sesión en la plataforma virtual, dice contraseña incorrecta", SOPORTE),
    ("El wifi del edificio B no funciona desde ayer", SOPORTE),
    ("Olvidé mi contraseña del correo institucional", SOPORTE),
    ("El proyector del salón 204 no enciende", SOPORTE),
    ("La plataforma de tareas marca error al subir archivos", SOPORTE),
    ("Las computadoras del laboratorio están muy lentas y se traban", SOPORTE),
    ("No tengo acceso a mi cuenta de Moodle ni al correo", SOPORTE),
    ("Se cayó el sistema de internet en toda la biblioteca", SOPORTE),
    ("Necesito instalar un software en la computadora del laboratorio", SOPORTE),
    ("El servidor no responde y no se puede entrar al portal", SOPORTE),
    ("Mi cuenta institucional fue bloqueada y no puedo ingresar", SOPORTE),
    ("La página de inscripciones muestra un error y no carga", SOPORTE),
    ("No hay conexión a internet en el aula y la red está caída", SOPORTE),
    ("Falla en la impresora del centro de cómputo", SOPORTE),
    ("El sistema de la universidad no abre desde mi celular", SOPORTE),
    # ---------------- Servicios Escolares ----------------
    ("Necesito una constancia de estudios para un trámite", ESCOLARES),
    ("Quiero tramitar mi credencial de estudiante porque la perdí", ESCOLARES),
    ("Como solicito mi kárdex oficial con sellos", ESCOLARES),
    ("Necesito dar de baja una materia antes del cierre de inscripciones", ESCOLARES),
    ("Quiero solicitar una baja temporal del semestre", ESCOLARES),
    ("Trámite de cambio de carrera, qué documentos debo entregar", ESCOLARES),
    ("Necesito mi certificado parcial y mi historial académico", ESCOLARES),
    ("Cuándo son las fechas de reinscripción y entrega de documentos", ESCOLARES),
    ("Solicito la corrección de mi nombre en mi expediente", ESCOLARES),
    ("Requisitos para el trámite de titulación y servicio social", ESCOLARES),
    ("Quiero registrar mi servicio social y entregar la carta de inicio", ESCOLARES),
    ("Necesito una constancia de calificaciones para el IMSS", ESCOLARES),
    ("Tengo que entregar mi acta de nacimiento para actualizar el expediente", ESCOLARES),
    ("Solicito el trámite de equivalencia de materias de otra universidad", ESCOLARES),
    ("Como saco una carta de buena conducta y constancia de inscripción", ESCOLARES),
    ("Quiero cambiar de turno y actualizar mis datos escolares", ESCOLARES),
    # ---------------- Bienestar Universitario ----------------
    ("Reporte de situación grave de acoso en el campus", BIENESTAR),
    ("Un compañero me amenaza y me hostiga todos los días", BIENESTAR),
    ("Me siento muy deprimida y necesito apoyo psicológico", BIENESTAR),
    ("Presencié una pelea con agresión física afuera de la cafetería", BIENESTAR),
    ("Un profesor me hace comentarios inapropiados y me incomoda", BIENESTAR),
    ("Necesito ayuda por ansiedad y estrés antes de los exámenes", BIENESTAR),
    ("Hubo un accidente en el gimnasio y un alumno quedó herido", BIENESTAR),
    ("Quiero reportar discriminación y bullying en mi grupo", BIENESTAR),
    ("Solicito una cita con el servicio médico y psicología", BIENESTAR),
    ("Me siento inseguro en el estacionamiento, sufrí un intento de robo", BIENESTAR),
    ("Quiero informes sobre talleres deportivos y actividades culturales", BIENESTAR),
    ("Un alumno habló de hacerse daño y me preocupa su seguridad", BIENESTAR),
    ("Reporto violencia y maltrato de un compañero hacia otra alumna", BIENESTAR),
    ("Necesito orientación por problemas personales y emocionales", BIENESTAR),
    ("Emergencia, una persona se desmayó en el patio y necesita ayuda", BIENESTAR),
    ("Quiero información de las actividades de bienestar y salud mental", BIENESTAR),
]
