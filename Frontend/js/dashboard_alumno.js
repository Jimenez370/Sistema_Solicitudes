//==============================================================================
// Lógica del Dashboard de Alumno
//==============================================================================

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
            cambiarSeccion(seccion);
        });
    });

    // Cerrar sesión
    document.getElementById('btnCerrarSesion').addEventListener('click', () => {
        sessionStorage.removeItem('sicou_usuario');
        window.location.href = 'login.html';
    });
}

function cambiarSeccion(seccion) {
    // Actualizar sidebar
    document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('activo'));
    const linkActivo = document.querySelector(`.sidebar nav a[data-seccion="${seccion}"]`);
    if (linkActivo) linkActivo.classList.add('activo');

    // Mostrar sección
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    document.getElementById(`sec-${seccion}`).classList.add('activa');
}

// ========== DATOS DE USUARIO ==========
function cargarDatosUsuario() {
    const usuario = JSON.parse(sessionStorage.getItem('sicou_usuario') || '{}');
    document.getElementById('nombreUsuario').textContent = usuario.nombre || 'Alumno';
    document.getElementById('facultadUsuario').textContent = usuario.facultad_nombre || 'Facultad';
    document.getElementById('areaAlumno').textContent = usuario.facultad_nombre || 'Área Académica';

    // Perfil
    document.getElementById('perfilNombre').textContent = usuario.nombre || '-';
    document.getElementById('perfilCorreo').textContent = usuario.correo || '-';
    document.getElementById('perfilFacultad').textContent = usuario.facultad_nombre || '-';
}

// ========== ESTADÍSTICAS ==========
function cargarEstadisticas() {
    // Datos de ejemplo (reemplazar con fetch a API)
    const stats = { pendientes: 3, revision: 2, resueltas: 8, total: 13 };
    document.getElementById('statPendientes').textContent = stats.pendientes;
    document.getElementById('statRevision').textContent = stats.revision;
    document.getElementById('statResueltas').textContent = stats.resueltas;
    document.getElementById('statTotal').textContent = stats.total;
}

// ========== SOLICITUDES ==========
const solicitudesEjemplo = [
    { folio: 'SOL-001', tipo: 'Académica', descripcion: 'No aparece mi calificación', fecha: '2026-11-05', prioridad: 'Baja', estado: 'Pendiente', depto: 'Servicios Escolares' },
    { folio: 'SOL-002', tipo: 'Soporte Técnico', descripcion: 'No puedo entrar al campus virtual', fecha: '2026-11-04', prioridad: 'Alta', estado: 'En revisión', depto: 'Soporte Técnico' },
    { folio: 'SOL-003', tipo: 'Financiera/Becas', descripcion: 'Informes sobre beca de manutención', fecha: '2026-11-02', prioridad: 'Media', estado: 'Atendida', depto: 'Caja y Finanzas', respuesta: 'Tu beca fue aprobada. Revisa tu correo.' },
];

function cargarMisSolicitudes(filtros = {}) {
    const tbody = document.getElementById('tablaMisSolicitudes');
    tbody.innerHTML = '';

    let datos = [...solicitudesEjemplo];

    if (filtros.estado && filtros.estado !== 'todos') {
        datos = datos.filter(s => s.estado === filtros.estado);
    }
    if (filtros.prioridad && filtros.prioridad !== 'todos') {
        datos = datos.filter(s => s.prioridad === filtros.prioridad);
    }

    datos.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${s.folio}</strong></td>
            <td>${s.tipo}</td>
            <td>${s.descripcion}</td>
            <td>${s.fecha}</td>
            <td><span class="badge badge-${s.prioridad.toLowerCase()}">${s.prioridad}</span></td>
            <td><span class="badge ${getClaseEstado(s.estado)}">${s.estado}</span></td>
            <td><button class="btn-ver" onclick="verDetalle('${s.folio}')">Ver</button></td>
        `;
        tbody.appendChild(tr);
    });

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#6b7888;padding:30px;">No hay solicitudes con estos filtros.</td></tr>';
    }
}

function getClaseEstado(estado) {
    const clases = { 'Pendiente': 'badge-pendiente', 'En revisión': 'badge-revision', 'Atendida': 'badge-atendida' };
    return clases[estado] || '';
}

function aplicarFiltros() {
    const estado = document.getElementById('filtroEstado').value;
    const prioridad = document.getElementById('filtroPrioridad').value;
    cargarMisSolicitudes({ estado, prioridad });
}

// ========== DETALLE / MODAL ==========
function verDetalle(folio) {
    const s = solicitudesEjemplo.find(x => x.folio === folio);
    if (!s) return;

    document.getElementById('modalFolio').textContent = s.folio;
    document.getElementById('modalTipo').textContent = s.tipo;
    document.getElementById('modalPrioridad').textContent = s.prioridad;
    document.getElementById('modalEstado').textContent = s.estado;
    document.getElementById('modalDepto').textContent = s.depto;
    document.getElementById('modalDescripcion').textContent = s.descripcion;

    const seccionResp = document.getElementById('seccionRespuesta');
    if (s.respuesta) {
        seccionResp.style.display = 'block';
        document.getElementById('modalRespuesta').textContent = s.respuesta;
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
    const notifs = [
        { icono: '✅', titulo: 'Solicitud SOL-003 atendida', msg: 'Tu solicitud de beca fue resuelta.', fecha: 'Hace 2 horas', leida: false },
        { icono: '🔍', titulo: 'Solicitud SOL-002 en revisión', msg: 'El área de Soporte Técnico está revisando tu caso.', fecha: 'Hace 1 día', leida: true },
        { icono: '📩', titulo: 'Nueva solicitud registrada', msg: 'SOL-001 fue enviada correctamente.', fecha: 'Hace 3 días', leida: true },
    ];

    const cont = document.getElementById('listaNotificaciones');
    cont.innerHTML = '';
    let noLeidas = 0;

    notifs.forEach(n => {
        if (!n.leida) noLeidas++;
        const div = document.createElement('div');
        div.className = `notif-item ${n.leida ? '' : 'no-leida'}`;
        div.innerHTML = `
            <div class="notif-icono">${n.icono}</div>
            <div class="notif-contenido">
                <strong>${n.titulo}</strong>
                <p>${n.msg}</p>
            </div>
            <div class="notif-fecha">${n.fecha}</div>
        `;
        cont.appendChild(div);
    });

    document.getElementById('contadorNotif').textContent = noLeidas;
}

// ========== FORMULARIO NUEVA SOLICITUD ==========
function inicializarFormulario() {
    const form = document.getElementById('formNuevaSolicitud');
    const descripcion = document.getElementById('descripcion');
    const btnEnviar = document.getElementById('btnEnviar');
    let analisisTimeout;
    let iaAnalisis = null; // Guarda el último análisis de la IA

    // Analizar con IA mientras el alumno escribe (con debounce de 1.5s)
    descripcion.addEventListener('input', () => {
        clearTimeout(analisisTimeout);
        
        const texto = descripcion.value.trim();
        
        // Si borra el texto, ocultar resultado y deshabilitar botón
        if (texto.length < 20) {
            document.getElementById('resultadoIA').style.display = 'none';
            btnEnviar.disabled = true;
            iaAnalisis = null;
            return;
        }

        // Mostrar indicador de "analizando..."
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Analizando...';

        // Esperar 1.5 segundos después de que deje de escribir
        analisisTimeout = setTimeout(() => {
            iaAnalisis = analizarConIA(texto);
            btnEnviar.disabled = false;
            btnEnviar.textContent = 'Enviar solicitud';
        }, 1500);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!iaAnalisis) {
            alert('⚠️ La IA aún no ha analizado tu solicitud. Espera un momento.');
            return;
        }

        const datos = {
            descripcion: descripcion.value,
            categoria: iaAnalisis.categoria,
            prioridad: iaAnalisis.prioridad,
            canal: iaAnalisis.canal,
            confianza: iaAnalisis.confianza,
        };
        
        console.log('📤 Enviando solicitud:', datos);
        
        // Simulación de envío exitoso
        alert(`✅ Solicitud enviada correctamente.\n\n📂 Categoría: ${datos.categoria}\n⚡ Prioridad: ${datos.prioridad}\n🏢 Departamento: ${datos.canal}\n\nRecibirás notificaciones sobre el avance.`);
        
        // Limpiar formulario
        form.reset();
        document.getElementById('resultadoIA').style.display = 'none';
        btnEnviar.disabled = true;
        iaAnalisis = null;
        
        // Ir a la sección de solicitudes
        cambiarSeccion('solicitudes');
    });
}

function analizarConIA(texto) {
    // Simulación de la respuesta del agente.py
    // En producción, esto vendría de: fetch('/api/analizar', { method: 'POST', body: JSON.stringify({ texto }) })
    
    const resultado = simularAnalisisIA(texto);

    // Mostrar panel de análisis
    document.getElementById('iaCategoria').textContent = resultado.categoria;
    document.getElementById('iaPrioridad').textContent = resultado.prioridad;
    document.getElementById('iaCanal').textContent = resultado.canal;
    document.getElementById('iaConfianza').textContent = (resultado.confianza * 100).toFixed(0) + '%';
    document.getElementById('resultadoIA').style.display = 'block';

    // Colorear según prioridad
    const elemPrioridad = document.getElementById('iaPrioridad');
    elemPrioridad.className = 'resultado-valor';
    if (resultado.prioridad === 'Alta') {
        elemPrioridad.style.color = '#dc2626';
    } else if (resultado.prioridad === 'Media') {
        elemPrioridad.style.color = '#d97706';
    } else {
        elemPrioridad.style.color = '#15345b';
    }

    return resultado;
}
// ========== COMENTARIOS ==========
function enviarComentario() {
    const input = document.getElementById('inputComentario');
    const texto = input.value.trim();
    if (!texto) return;

    const chat = document.getElementById('chatMensajes');
    const msg = document.createElement('div');
    msg.className = 'chat-msg alumno';
    msg.innerHTML = `<div class="autor">Tú</div>${texto}`;
    chat.appendChild(msg);
    input.value = '';
    chat.scrollTop = chat.scrollHeight;
}

// Simulación inteligente basada en palabras clave
// (En producción esto se reemplaza por la llamada real a tu agente.py)
function simularAnalisisIA(texto) {
    const t = texto.toLowerCase();
    
    // Lógica de clasificación (reemplazar por fetch a /api/analizar)
    if (t.includes('calificación') || t.includes('calificacion') || t.includes('nota') || t.includes('examen') || t.includes('reprobé') || t.includes('reprobe')) {
        return { categoria: 'Académica', prioridad: 'Baja', canal: 'Servicios Escolares', confianza: 0.85 };
    }
    if (t.includes('no puedo entrar') || t.includes('contraseña') || t.includes('password') || t.includes('campus virtual') || t.includes('plataforma') || t.includes('correo institucional')) {
        return { categoria: 'Soporte Técnico', prioridad: 'Alta', canal: 'Soporte Técnico', confianza: 0.92 };
    }
    if (t.includes('beca') || t.includes('pago') || t.includes('colegiatura') || t.includes('dinero') || t.includes('financiero')) {
        return { categoria: 'Financiera/Becas', prioridad: 'Media', canal: 'Caja y Finanzas', confianza: 0.88 };
    }
    if (t.includes('constancia') || t.includes('trámite') || t.includes('tramite') || t.includes('documento') || t.includes('certificado')) {
        return { categoria: 'Servicios Escolares', prioridad: 'Media', canal: 'Servicios Escolares', confianza: 0.90 };
    }
    if (t.includes('acoso') || t.includes('amenaza') || t.includes('emergencia') || t.includes('urgente') || t.includes('violencia')) {
        return { categoria: 'Bienestar Universitario', prioridad: 'Alta', canal: 'Bienestar Universitario', confianza: 0.95 };
    }
    
    // Por defecto
    return { categoria: 'Otro', prioridad: 'Media', canal: 'Bandeja de Supervisor', confianza: 0.50 };
}