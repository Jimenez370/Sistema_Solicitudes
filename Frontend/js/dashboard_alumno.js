// ==============================================================================
// Lógica del Dashboard de Alumno - Conectado con Agente IA y PostgreSQL
// ==============================================================================

let listaSolicitudesMemoria = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosUsuario();
    cargarEstadisticas();
    cargarMisSolicitudes();
    cargarNotificaciones();
    inicializarNavegacion();
    inicializarFormulario();
});

// ========== NAVEGACIÓN ENTRE SECCIONES ==========
function inicializarNavegacion() {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const seccion = link.getAttribute('data-seccion');
            if (seccion) cambiarSeccion(seccion);
        });
    });

    // Cerrar sesión
    const btnCerrar = document.getElementById('btnCerrarSesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            sessionStorage.removeItem('sicou_usuario');
            window.location.href = 'login.html';
        });
    }
}

function cambiarSeccion(seccion) {
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('activo'));
    const linkActivo = document.querySelector(`.sidebar nav a[data-seccion="${seccion}"]`);
    if (linkActivo) linkActivo.classList.add('activo');

    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    const secTarget = document.getElementById(`sec-${seccion}`);
    if (secTarget) secTarget.classList.add('activa');

    if (seccion === 'solicitudes') {
        cargarMisSolicitudes();
    }
}

// ========== DATOS DE USUARIO ==========
function obtenerUsuarioActual() {
    return JSON.parse(sessionStorage.getItem('sicou_usuario') || '{}');
}

function cargarDatosUsuario() {
    const usuario = obtenerUsuarioActual();
    const spanNombre = document.getElementById('nombreUsuario');
    const spanFacultad = document.getElementById('facultadUsuario');
    const areaAlumno = document.getElementById('areaAlumno');

    if (spanNombre) spanNombre.textContent = usuario.nombre || 'Alumno';
    if (spanFacultad) spanFacultad.textContent = usuario.facultad_nombre || 'Facultad';
    if (areaAlumno) areaAlumno.textContent = usuario.facultad_nombre || 'Área Académica';

    const pNombre = document.getElementById('perfilNombre');
    const pCorreo = document.getElementById('perfilCorreo');
    const pFacultad = document.getElementById('perfilFacultad');

    if (pNombre) pNombre.textContent = usuario.nombre || '-';
    if (pCorreo) pCorreo.textContent = usuario.correo || '-';
    if (pFacultad) pFacultad.textContent = usuario.facultad_nombre || '-';
}

// ========== ESTADÍSTICAS ==========
async function cargarEstadisticas() {
    const usuario = obtenerUsuarioActual();
    if (!usuario.id) return;

    try {
        const res = await fetch(`/api/solicitudes?usuario_id=${usuario.id}`);
        const data = await res.json();
        if (data.ok && data.estadisticas) {
            const stats = data.estadisticas;
            document.getElementById('statPendientes').textContent = stats.pendientes || 0;
            document.getElementById('statRevision').textContent = stats.revision || 0;
            document.getElementById('statResueltas').textContent = stats.resueltas || 0;
            document.getElementById('statTotal').textContent = stats.total || 0;
        }
    } catch (e) {
        console.warn("No se pudieron cargar estadísticas en vivo:", e);
    }
}

// ========== SOLICITUDES ==========
async function cargarMisSolicitudes(filtros = {}) {
    const tbody = document.getElementById('tablaMisSolicitudes');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Cargando solicitudes...</td></tr>';

    const usuario = obtenerUsuarioActual();
    let url = `/api/solicitudes?usuario_id=${usuario.id || ''}`;

    if (filtros.estado && filtros.estado !== 'todos') {
        url += `&estado=${encodeURIComponent(filtros.estado)}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.ok && data.solicitudes) {
            listaSolicitudesMemoria = data.solicitudes;
            renderizarTablaSolicitudes(listaSolicitudesMemoria, filtros);
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7888;padding:30px;">No tienes solicitudes registradas aún.</td></tr>';
        }
    } catch (e) {
        console.warn("Modo local o sin conexión:", e);
        renderizarTablaSolicitudes(listaSolicitudesMemoria, filtros);
    }
}

function renderizarTablaSolicitudes(solicitudes, filtros = {}) {
    const tbody = document.getElementById('tablaMisSolicitudes');
    if (!tbody) return;
    tbody.innerHTML = '';

    let datos = [...solicitudes];
    if (filtros.prioridad && filtros.prioridad !== 'todos') {
        datos = datos.filter(s => s.prioridad === filtros.prioridad);
    }

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7888;padding:30px;">No hay solicitudes registradas con estos filtros.</td></tr>';
        return;
    }

    datos.forEach(s => {
        const tr = document.createElement('tr');
        const prioClase = (s.prioridad || 'media').toLowerCase();
        tr.innerHTML = `
            <td><strong>${s.folio}</strong></td>
            <td>${s.categoria || 'General'}</td>
            <td>${s.descripcion}</td>
            <td>${s.fecha || '-'}</td>
            <td><span class="badge badge-${prioClase}">${s.prioridad || 'Media'}</span></td>
            <td><span class="badge ${getClaseEstado(s.estado)}">${s.estado || 'Pendiente'}</span></td>
            <td><button class="btn-ver" onclick="verDetalle('${s.folio}')">Ver</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function getClaseEstado(estado) {
    const clases = {
        'Pendiente': 'badge-pendiente',
        'En revisión': 'badge-revision',
        'En revision': 'badge-revision',
        'Atendida': 'badge-atendida',
        'Resuelta': 'badge-atendida'
    };
    return clases[estado] || 'badge-pendiente';
}

function aplicarFiltros() {
    const estado = document.getElementById('filtroEstado').value;
    const prioridad = document.getElementById('filtroPrioridad').value;
    cargarMisSolicitudes({ estado, prioridad });
}

// ========== DETALLE / MODAL ==========
function verDetalle(folio) {
    const s = listaSolicitudesMemoria.find(x => x.folio === folio);
    if (!s) return;

    document.getElementById('modalFolio').textContent = s.folio;
    document.getElementById('modalTipo').textContent = s.categoria || 'General';
    document.getElementById('modalPrioridad').textContent = s.prioridad || 'Media';
    document.getElementById('modalEstado').textContent = s.estado || 'Pendiente';
    document.getElementById('modalDepto').textContent = s.depto_nombre || s.canal_destino || 'Servicios Escolares';
    document.getElementById('modalDescripcion').textContent = s.descripcion;

    const seccionResp = document.getElementById('seccionRespuesta');
    if (s.motivo_alerta && s.alerta_supervisor) {
        seccionResp.style.display = 'block';
        document.getElementById('modalRespuesta').textContent = `Alerta al supervisor: ${s.motivo_alerta}`;
    } else {
        seccionResp.style.display = 'none';
    }

    document.getElementById('modalDetalle').classList.add('activo');
}

function cerrarModal() {
    document.getElementById('modalDetalle').classList.remove('activo');
}

// ========== NOTIFICACIONES ==========
function cargarNotificaciones() {
    const cont = document.getElementById('listaNotificaciones');
    if (!cont) return;
    cont.innerHTML = `
        <div class="notif-item">
            <div class="notif-icono">🤖</div>
            <div class="notif-contenido">
                <strong>Agente Inteligente Activo</strong>
                <p>Tus solicitudes son analizadas y canalizadas automáticamente según su prioridad y categoría.</p>
            </div>
            <div class="notif-fecha">Ahora</div>
        </div>
    `;
    const contador = document.getElementById('contadorNotif');
    if (contador) contador.textContent = "1";
}

// ========== FORMULARIO NUEVA SOLICITUD ==========
function inicializarFormulario() {
    const form = document.getElementById('formNuevaSolicitud');
    const descripcion = document.getElementById('descripcion');
    const btnEnviar = document.getElementById('btnEnviar');
    let analisisTimeout;
    let iaAnalisis = null;

    if (!form || !descripcion || !btnEnviar) return;

    // Análisis en tiempo real con el Agente de IA mientras escribe (debounce 1.2s)
    descripcion.addEventListener('input', () => {
        clearTimeout(analisisTimeout);
        const texto = descripcion.value.trim();

        if (texto.length < 15) {
            document.getElementById('resultadoIA').style.display = 'none';
            btnEnviar.disabled = true;
            iaAnalisis = null;
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Analizando con IA...';

        analisisTimeout = setTimeout(async () => {
            iaAnalisis = await analizarConIA(texto);
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }, 1200);
    });

    // Envío oficial de la solicitud a PostgreSQL
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const texto = descripcion.value.trim();

        if (!texto) {
            alert('Por favor describe tu problema o solicitud.');
            return;
        }

        const usuario = obtenerUsuarioActual();
        if (!usuario.id) {
            alert('Sesión no detectada. Por favor vuelve a iniciar sesión.');
            window.location.href = 'login.html';
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Canalizando solicitud...';

        try {
            const respuesta = await fetch('/api/solicitudes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario_id: usuario.id,
                    descripcion: texto
                })
            });

            const data = await respuesta.json();

            if (respuesta.ok && data.ok) {
                const a = data.analisis;
                alert(`✅ ¡Solicitud enviada y clasificada con éxito!\n\n` +
                      `📌 Folio: SOL-${String(data.solicitud_id).padStart(3, '0')}\n` +
                      `📂 Categoría: ${a.categoria}\n` +
                      `⚡ Prioridad asignada: ${a.prioridad}\n` +
                      `🏢 Departamento destino: ${a.canal}\n` +
                      `🎯 Confianza IA: ${(a.confianza * 100).toFixed(0)}%\n\n` +
                      `La solicitud ya se encuentra disponible para el departamento correspondiente y el administrador.`);

                form.reset();
                document.getElementById('resultadoIA').style.display = 'none';
                btnEnviar.disabled = true;
                iaAnalisis = null;

                // Actualizar estadísticas y tabla
                cargarEstadisticas();
                cargarMisSolicitudes();
                cambiarSeccion('solicitudes');
            } else {
                alert('❌ Error al registrar solicitud: ' + (data.error || 'Intenta de nuevo.'));
            }
        } catch (error) {
            console.error('Error al enviar solicitud:', error);
            alert('⚠️ No se pudo comunicar con el servidor backend. Verifica que esté corriendo: python server.py');
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }
    });
}

/**
 * Consulta al endpoint /api/analizar que ejecuta el Agente IA de Python
 */
async function analizarConIA(texto) {
    try {
        const respuesta = await fetch('/api/analizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texto })
        });

        const data = await respuesta.json();
        if (respuesta.ok && data.ok) {
            mostrarResultadoIA(data);
            return data;
        }
    } catch (e) {
        console.warn("Fallo análisis remoto, usando estimación local:", e);
    }

    // Fallback si el servidor está desconectado
    const local = estimacionLocalIA(texto);
    mostrarResultadoIA(local);
    return local;
}

function mostrarResultadoIA(res) {
    document.getElementById('iaCategoria').textContent = res.categoria || 'General';
    document.getElementById('iaPrioridad').textContent = res.prioridad || 'Media';
    document.getElementById('iaCanal').textContent = res.canal || 'Servicios Escolares';
    document.getElementById('iaConfianza').textContent = ((res.confianza || 0.8) * 100).toFixed(0) + '%';
    document.getElementById('resultadoIA').style.display = 'block';

    const elemPrioridad = document.getElementById('iaPrioridad');
    elemPrioridad.className = 'resultado-valor';
    if (res.prioridad === 'Alta') {
        elemPrioridad.style.color = '#dc2626';
    } else if (res.prioridad === 'Media') {
        elemPrioridad.style.color = '#d97706';
    } else {
        elemPrioridad.style.color = '#15345b';
    }
}

function estimacionLocalIA(texto) {
    const t = texto.toLowerCase();
    if (t.includes('calificacion') || t.includes('nota') || t.includes('examen')) {
        return { categoria: 'Académica', prioridad: 'Baja', canal: 'Servicios Escolares', confianza: 0.82 };
    }
    if (t.includes('red') || t.includes('plataforma') || t.includes('contraseña') || t.includes('sistema')) {
        return { categoria: 'Soporte Técnico', prioridad: 'Alta', canal: 'Soporte Técnico', confianza: 0.89 };
    }
    if (t.includes('beca') || t.includes('pago') || t.includes('colegiatura')) {
        return { categoria: 'Financiera/Becas', prioridad: 'Media', canal: 'Caja y Finanzas', confianza: 0.85 };
    }
    if (t.includes('acoso') || t.includes('amenaza') || t.includes('urgente') || t.includes('violencia')) {
        return { categoria: 'Bienestar Universitario', prioridad: 'Alta', canal: 'Bienestar Universitario', confianza: 0.95 };
    }
    return { categoria: 'Servicios Escolares', prioridad: 'Media', canal: 'Servicios Escolares', confianza: 0.75 };
}

function enviarComentario() {
    const input = document.getElementById('inputComentario');
    const texto = input ? input.value.trim() : '';
    if (!texto) return;

    const chat = document.getElementById('chatMensajes');
    const msg = document.createElement('div');
    msg.className = 'chat-msg alumno';
    msg.innerHTML = `<div class="autor">Tú</div>${texto}`;
    chat.appendChild(msg);
    input.value = '';
    chat.scrollTop = chat.scrollHeight;
}
