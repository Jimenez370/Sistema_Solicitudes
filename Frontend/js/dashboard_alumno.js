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
            sessionStorage.removeItem('sicou_token');
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
    if (seccion === 'notificaciones') {
        cargarNotificaciones();
    }
}

// ========== DATOS DE USUARIO ==========
function obtenerUsuarioActual() {
    return JSON.parse(sessionStorage.getItem('sicou_usuario') || '{}');
}

function obtenerToken() {
    return sessionStorage.getItem('sicou_token');
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
    const token = obtenerToken();

    if (!usuario.id || !token) return;

    try {
        const res = await fetch('/api/solicitudes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            alert('Tu sesión expiró. Inicia sesión nuevamente.');
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            window.location.href = 'login.html';
            return;
        }

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

    const token = obtenerToken();

    if (!token) {
        alert('Sesión no detectada. Inicia sesión nuevamente.');
        window.location.href = 'login.html';
        return;
    }

    let url = '/api/solicitudes';

    if (filtros.estado && filtros.estado !== 'todos') {
        url += `?estado=${encodeURIComponent(filtros.estado)}`;
    }

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            alert('Tu sesión expiró. Inicia sesión nuevamente.');
            window.location.href = 'login.html';
            return;
        }

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
    
    // Botón de cancelar: solo visible si está Pendiente
    const puedeCancelar = (s.estado === 'Pendiente');
    const btnCancelar = puedeCancelar 
        ? `<button class="btn-cancelar" onclick="cancelarSolicitud('${s.folio}')" title="Cancelar solicitud">✕ Cancelar</button>`
        : '';
    
    tr.innerHTML = `
        <td><strong>${s.folio}</strong></td>
        <td>${s.categoria || 'General'}</td>
        <td>${s.descripcion}</td>
        <td>${s.fecha || '-'}</td>
        <td><span class="badge badge-${prioClase}">${s.prioridad || 'Media'}</span></td>
        <td><span class="badge ${getClaseEstado(s.estado)}">${s.estado || 'Pendiente'}</span></td>
        <td style="text-align:center;">
        ${s.archivo_adjunto 
            ? '<a href="/uploads/' + s.archivo_adjunto + '" target="_blank" title="Ver archivo adjunto" style="font-size:20px; text-decoration:none;">📎</a>' 
            : '<span style="color:#cbd5e1;">—</span>'}
        </td>
        <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-ver" onclick="verDetalle('${s.folio}')">Ver</button>
                ${btnCancelar}
            </div>
        </td>
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
        'Resuelta': 'badge-atendida',
        'Cancelada': 'badge-cancelada'
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
    
    // 📥 Mostrar archivo adjunto si existe
    const modalBody = document.querySelector('#modalDetalle .modal-body');
    let adjuntoHtml = '';
    if (s.archivo_adjunto) {
        adjuntoHtml = `
            <div style="margin-top:15px; padding:12px; background:#eaf4ff; border-radius:6px; border-left:4px solid #28649e;">
                <strong style="color:#15345b;">📎 Archivo adjunto:</strong>
                <a href="/uploads/${s.archivo_adjunto}" target="_blank" 
                   style="color:#2563eb; font-weight:bold; text-decoration:underline; margin-left:8px;">
                    Ver / Descargar archivo
                </a>
            </div>
        `;
    }
    // Insertar antes del cierre del modal-body
    const seccionResp = document.getElementById('seccionRespuesta');
    if (s.motivo_alerta && s.alerta_supervisor) {
        seccionResp.style.display = 'block';
        document.getElementById('modalRespuesta').textContent = `Alerta al supervisor: ${s.motivo_alerta}`;
    } else {
        seccionResp.style.display = 'none';
    }
    // Agregar el HTML del adjunto si no existe ya
    let existente = document.getElementById('adjuntoAlumno');
    if (existente) existente.remove();
    if (adjuntoHtml) {
        const divAdj = document.createElement('div');
        divAdj.id = 'adjuntoAlumno';
        divAdj.innerHTML = adjuntoHtml;
        modalBody.appendChild(divAdj);
    }
    
    document.getElementById('modalDetalle').classList.add('activo');
}



// ========== NOTIFICACIONES (versión real conectada a BD) ==========
const STORAGE_KEY_LEIDAS = 'sicou_notificaciones_leidas';

function obtenerNotificacionesLeidas() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_LEIDAS) || '[]');
    } catch {
        return [];
    }
}

function marcarNotificacionLeida(idNotif) {
    const leidas = obtenerNotificacionesLeidas();
    if (!leidas.includes(idNotif)) {
        leidas.push(idNotif);
        localStorage.setItem(STORAGE_KEY_LEIDAS, JSON.stringify(leidas));
    }
}

function obtenerTipoNotificacion(texto) {
    const t = texto.toLowerCase();
    if (t.includes('alerta') || t.includes('crítico') || t.includes('revisar')) {
        return { icono: '⚠️', clase: 'notif-alerta' };
    }
    if (t.includes('canalizada correctamente') || t.includes('éxito') || t.includes('resuelta') || t.includes('atendida')) {
        return { icono: '✅', clase: 'notif-exito' };
    }
    if (t.includes('revisión') || t.includes('revisando')) {
        return { icono: '🔍', clase: 'notif-info' };
    }
    return { icono: '📩', clase: 'notif-info' };
}

async function cargarNotificaciones() {
    const cont = document.getElementById('listaNotificaciones');
    const contador = document.getElementById('contadorNotif');
    if (!cont) return;

    // Mostrar estado de carga
    cont.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7888;">Cargando notificaciones...</div>';

    const token = sessionStorage.getItem('sicou_token');
    if (!token) {
        cont.innerHTML = '<div style="text-align:center;padding:20px;color:#dc2626;">Sesión no detectada.</div>';
        return;
    }

    try {
        const res = await fetch('/api/solicitudes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 401) {
            sessionStorage.removeItem('sicou_token');
            sessionStorage.removeItem('sicou_usuario');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();
        const leidas = obtenerNotificacionesLeidas();
        let noLeidas = 0;

        if (!data.ok || !data.solicitudes || data.solicitudes.length === 0) {
            cont.innerHTML = `
                <div class="notif-item">
                    <div class="notif-icono">📭</div>
                    <div class="notif-contenido">
                        <strong>Sin notificaciones</strong>
                        <p>Aún no tienes notificaciones. Cuando envíes una solicitud, aparecerán aquí.</p>
                    </div>
                </div>
            `;
            if (contador) contador.textContent = '0';
            return;
        }

        // Construir lista de notificaciones desde las solicitudes
        const notifs = [];
        data.solicitudes.forEach(s => {
            // Parsear el campo notificaciones (viene como string JSON o array)
            let listaNotifs = [];
            try {
                if (typeof s.notificaciones === 'string') {
                    listaNotifs = JSON.parse(s.notificaciones);
                } else if (Array.isArray(s.notificaciones)) {
                    listaNotifs = s.notificaciones;
                }
            } catch (e) {
                listaNotifs = [];
            }

            listaNotifs.forEach((texto, idx) => {
                if (!texto.toLowerCase().includes('solicitante')) {
                return; // Saltar notificaciones que son para el departamento
                }
    
                const idNotif = `${s.folio}-${idx}`;
                const tipo = obtenerTipoNotificacion(texto);
                const yaLeida = leidas.includes(idNotif);

                if (!yaLeida) noLeidas++;

                notifs.push({
                    id: idNotif,
                    texto: texto,
                    folio: s.folio,
                    fecha: s.fecha || '-',
                    estado: s.estado || 'Pendiente',
                    icono: tipo.icono,
                    clase: tipo.clase,
                    leida: yaLeida
                });
            });
        });

        // Ordenar: primero las no leídas
        notifs.sort((a, b) => (a.leida - b.leida));

        // Renderizar
        if (notifs.length === 0) {
            cont.innerHTML = `
                <div class="notif-item">
                    <div class="notif-icono">📭</div>
                    <div class="notif-contenido">
                        <strong>Sin notificaciones</strong>
                        <p>Aún no tienes notificaciones. Cuando envíes una solicitud, aparecerán aquí.</p>
                    </div>
                </div>
            `;
        } else {
            cont.innerHTML = '';
            notifs.forEach(n => {
                const div = document.createElement('div');
                div.className = `notif-item ${n.leida ? '' : 'no-leida'} ${n.clase}`;
                div.style.cursor = 'pointer';
                div.title = 'Clic para marcar como leída';
                div.innerHTML = `
                    <div class="notif-icono">${n.icono}</div>
                    <div class="notif-contenido">
                        <strong>${n.folio} - ${n.estado}</strong>
                        <p>${n.texto}</p>
                    </div>
                    <div class="notif-fecha">${n.fecha}</div>
                `;
                div.addEventListener('click', () => {
                    if (!n.leida) {
                        marcarNotificacionLeida(n.id);
                        div.classList.remove('no-leida');
                        n.leida = true;
                        noLeidas = Math.max(0, noLeidas - 1);
                        if (contador) contador.textContent = noLeidas;
                    }
                });
                cont.appendChild(div);
            });
        }

        if (contador) contador.textContent = noLeidas;

    } catch (e) {
        console.warn("Error al cargar notificaciones:", e);
        cont.innerHTML = `
            <div class="notif-item">
                <div class="notif-icono">⚠️</div>
                <div class="notif-contenido">
                    <strong>Error de conexión</strong>
                    <p>No se pudieron cargar las notificaciones. Verifica que el servidor esté corriendo.</p>
                </div>
            </div>
        `;
        if (contador) contador.textContent = '0';
    }
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
        const inputArchivo = document.getElementById('archivo');
        const archivo = inputArchivo.files[0];

        if (!texto) {
            alert('Por favor describe tu problema o solicitud.');
            return;
        }

        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Procesando archivo y enviando...';

        // Función auxiliar para leer archivo en Base64
        const leerArchivoComoBase64 = (file) => {
            return new Promise((resolve, reject) => {
                if (!file) return resolve(null);
                const reader = new FileReader();
                reader.onload = () => resolve({ nombre: file.name, data: reader.result });
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });
        };

        try {
            let archivoInfo = null;
            if (archivo) {
                archivoInfo = await leerArchivoComoBase64(archivo);
            }

            const token = obtenerToken();
            const respuesta = await fetch('/api/solicitudes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    descripcion: texto,
                    archivo_nombre: archivoInfo ? archivoInfo.nombre : null,
                    archivo_base64: archivoInfo ? archivoInfo.data : null
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
                cargarNotificaciones();
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

        // Si el servidor responde con un error HTTP (4xx o 5xx), lanzamos un error manualmente
        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }

        const data = await respuesta.json();
        
        if (data.ok) {
            mostrarResultadoIA(data);
            return data;
        } else {
            throw new Error(data.error || "Respuesta no exitosa del servidor");
        }

    } catch (e) {
        console.warn("Fallo análisis remoto, usando estimación local:", e);
        
        // Fallback si el servidor está desconectado o devuelve error
        const local = estimacionLocalIA(texto);
        mostrarResultadoIA(local);
        return local;
    }
}
function mostrarResultadoIA(res) {
    document.getElementById('iaCategoria').textContent = res.categoria || 'Desconocida';
    document.getElementById('iaPrioridad').textContent = res.prioridad || 'Media';
    document.getElementById('iaCanal').textContent = res.canal || 'Bandeja de revisión por Supervisor Humano';
    
    // Respetar el 0% real y evitar que el operador || fuerce el 80%
    const confianzaReal = (res.confianza !== undefined && res.confianza !== null) ? res.confianza : 0.0;
    document.getElementById('iaConfianza').textContent = (confianzaReal * 100).toFixed(0) + '%';
    
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
        return { categoria: 'Académica', prioridad: 'Baja', canal: 'Coordinación Académica', confianza: 0.82 };
    }
    if (t.includes('red') || t.includes('plataforma') || t.includes('contraseña') || t.includes('sistema')) {
        return { categoria: 'Soporte Técnico', prioridad: 'Alta', canal: 'Soporte Técnico', confianza: 0.89 };
    }
    if (t.includes('beca') || t.includes('pago') || t.includes('colegiatura')) {
        return { categoria: 'Financiera/Becas', prioridad: 'Media', canal: 'Servicios Escolares', confianza: 0.85 };
    }
    if (t.includes('acoso') || t.includes('amenaza') || t.includes('urgente') || t.includes('violencia') || t.includes('incomodo')) {
        return { categoria: 'Bienestar Universitario', prioridad: 'Alta', canal: 'Bienestar Universitario', confianza: 0.95 };
    }
    // Si es texto basura o desconocido, retornar 0% y derivar al supervisor
    return { categoria: 'Desconocida', prioridad: 'Baja', canal: 'Bandeja de revisión por Supervisor Humano', confianza: 0.0 };
}

// ========== PERFIL ==========

// Función para abrir modales
function abrirModal(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.add('activo');
        
        // Si es el modal de editar datos, cargar los datos actuales
        if (idModal === 'modalEditarDatos') {
            const usuario = obtenerUsuarioActual();
            document.getElementById('editNombre').value = usuario.nombre || '';
            document.getElementById('editCorreo').value = usuario.correo || '';
        }
    }
}

function cerrarModal(idModal = 'modalDetalle') {
    const modal = document.getElementById(idModal);
    if (modal) {
        modal.classList.remove('activo');
        const form = modal.querySelector('form');
        if (form) form.reset();
    }
}
// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('activo');
    }
});

// Manejar formulario de cambiar contraseña
document.addEventListener('DOMContentLoaded', () => {
    const formPassword = document.getElementById('formCambiarPassword');
    if (formPassword) {
        formPassword.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const passwordActual = document.getElementById('passwordActual').value;
            const passwordNueva = document.getElementById('passwordNueva').value;
            const passwordConfirmar = document.getElementById('passwordConfirmar').value;
            
            if (passwordNueva !== passwordConfirmar) {
                alert('❌ Las contraseñas nuevas no coinciden');
                return;
            }
            
            if (passwordNueva.length < 6) {
                alert('❌ La contraseña debe tener al menos 6 caracteres');
                return;
            }
            
            const token = obtenerToken();
            if (!token) {
                alert('Sesión no detectada. Inicia sesión nuevamente.');
                return;
            }
            
            try {
                const respuesta = await fetch('/api/usuario/password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        password_actual: passwordActual,
                        password_nueva: passwordNueva
                    })
                });
                
                const data = await respuesta.json();
                
                if (respuesta.ok && data.ok) {
                    alert('✅ Contraseña actualizada correctamente');
                    cerrarModal('modalCambiarPassword');
                } else {
                    alert('❌ ' + (data.mensaje || data.error || 'Error al cambiar contraseña'));
                }
            } catch (error) {
                console.error('Error al cambiar contraseña:', error);
                alert('⚠️ No se pudo comunicar con el servidor');
            }
        });
    }
    
    // Manejar formulario de editar datos
    const formEditar = document.getElementById('formEditarDatos');
    if (formEditar) {
        formEditar.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const nuevoNombre = document.getElementById('editNombre').value.trim();
            const nuevoCorreo = document.getElementById('editCorreo').value.trim();
            
            const token = obtenerToken();
            if (!token) {
                alert('Sesión no detectada. Inicia sesión nuevamente.');
                return;
            }
            
            try {
                const respuesta = await fetch('/api/usuario/datos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        nombre: nuevoNombre,
                        correo: nuevoCorreo
                    })
                });
                
                const data = await respuesta.json();
                
                if (respuesta.ok && data.ok) {
                    // Actualizar en sessionStorage
                    const usuario = obtenerUsuarioActual();
                    usuario.nombre = nuevoNombre;
                    usuario.correo = nuevoCorreo;
                    sessionStorage.setItem('sicou_usuario', JSON.stringify(usuario));
                    
                    // Actualizar vista
                    cargarDatosUsuario();
                    
                    alert('✅ Datos actualizados correctamente');
                    cerrarModal('modalEditarDatos');
                } else {
                    alert('❌ ' + (data.mensaje || data.error || 'Error al actualizar datos'));
                }
            } catch (error) {
                console.error('Error al editar datos:', error);
                alert('⚠️ No se pudo comunicar con el servidor');
            }
        });
    }
});

// ========== CANCELAR SOLICITUD ==========
async function cancelarSolicitud(folio) {
    // Buscar la solicitud en memoria
    const s = listaSolicitudesMemoria.find(x => x.folio === folio);
    if (!s) {
        alert('❌ No se encontró la solicitud.');
        return;
    }
    
    // Validar estado
    if (s.estado !== 'Pendiente') {
        alert(`❌ No se puede cancelar una solicitud en estado "${s.estado}".\nSolo se pueden cancelar solicitudes pendientes.`);
        return;
    }
    
    // Confirmación
    const confirmar = confirm(
        `¿Estás seguro de que deseas cancelar la solicitud ${folio}?\n\n` +
        `Descripción: ${s.descripcion.substring(0, 100)}${s.descripcion.length > 100 ? '...' : ''}\n\n` +
        `⚠️ Esta acción no se puede deshacer.`
    );
    
    if (!confirmar) return;
    
    const token = obtenerToken();
    if (!token) {
        alert('Sesión no detectada. Inicia sesión nuevamente.');
        return;
    }
    
    try {
        const respuesta = await fetch('/api/solicitudes/cancelar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ solicitud_id: s.id })
        });
        
        const data = await respuesta.json();
        
        if (respuesta.ok && data.ok) {
            alert('✅ ' + (data.mensaje || 'Solicitud cancelada correctamente.'));
            // Recargar tabla y estadísticas
            cargarEstadisticas();
            cargarMisSolicitudes();
            cargarNotificaciones();
        } else {
            alert('❌ ' + (data.mensaje || data.error || 'Error al cancelar la solicitud.'));
        }
    } catch (error) {
        console.error('Error al cancelar solicitud:', error);
        alert('⚠️ No se pudo comunicar con el servidor.');
    }
}