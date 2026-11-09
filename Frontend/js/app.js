// ==============================================================================
// Lógica del Panel de Administración / Gerencia (areas.html)
// Conexión y Gestión de Bandejas en Tiempo Real con PostgreSQL y Agente IA
// ==============================================================================

let solicitudesGlobal = [];

document.addEventListener("DOMContentLoaded", () => {
    // Redirigir al administrador a su interfaz exclusiva
    const rawUsuario = sessionStorage.getItem("sicou_usuario");
    if (rawUsuario) {
        try {
            const u = JSON.parse(rawUsuario);
            const rolNorm = (u.rol || "").toLowerCase().trim();
            if (rolNorm === "administrador" || rolNorm === "admin") {
                window.location.href = "admin.html";
                return;
            }
        } catch (_) {}
    }

    inicializarDatosUsuario();
    inicializarBotonCerrarSesion();
    inicializarNavegacionSidebar();
    cargarDatosDashboard();
});

/**
 * Cambia la bandeja visible en el panel del administrador
 */
function cambiarVistaArea(vistaId) {
    // 1. Marcar botón activo en el sidebar
    document.querySelectorAll(".sidebar nav a").forEach((a) => {
        a.classList.remove("activo");
        if (a.getAttribute("data-vista") === vistaId) {
            a.classList.add("activo");
        }
    });

    // 2. Ocultar todas las secciones y activar únicamente la seleccionada
    document.querySelectorAll(".seccion-panel").forEach((s) => s.classList.remove("activa"));
    const secTarget = document.getElementById(`vista-${vistaId}`);
    if (secTarget) {
        secTarget.classList.add("activa");
    }

    // 3. Acciones específicas al entrar a cada bandeja
    if (vistaId === "solicitudes") {
        aplicarFiltros();
    } else if (vistaId === "notificaciones") {
        renderizarNotificaciones(solicitudesGlobal);
    }
}

/**
 * Configura los clics de las bandejas laterales del menú principal
 */
function inicializarNavegacionSidebar() {
    const enlaces = document.querySelectorAll(".sidebar nav a");
    enlaces.forEach((enlace) => {
        enlace.addEventListener("click", (e) => {
            e.preventDefault();
            const vista = enlace.getAttribute("data-vista");
            if (vista) {
                cambiarVistaArea(vista);
            }
        });
    });
}

/**
 * Carga los datos de la sesión del administrador
 */
function inicializarDatosUsuario() {
    const rawUsuario = sessionStorage.getItem("sicou_usuario");
    const usuario = rawUsuario ? JSON.parse(rawUsuario) : {
        nombre: "Gerente de Área",
        correo: "gerencia@unach.mx",
        rol: "gerente_area",
        departamento_nombre: "Área Asignada"
    };

    // Header
    const spanNombre = document.getElementById("nombreUsuarioArea") || document.getElementById("nombreUsuarioAdmin");
    if (spanNombre) spanNombre.textContent = `${usuario.nombre} (${usuario.rol || "Gerente de Área"})`;

    const h3Area = document.getElementById("nombreArea");
    if (h3Area) h3Area.textContent = `Panel de Área - ${usuario.departamento_nombre || usuario.facultad_nombre || "Área Universitaria"}`;

    // Vista de Perfil
    const pNombre = document.getElementById("perfilNombre");
    const pCorreo = document.getElementById("perfilCorreo");
    const pRol = document.getElementById("perfilRol");
    const pFac = document.getElementById("perfilFacultad");

    if (pNombre) pNombre.textContent = usuario.nombre || "Gerente de Área";
    if (pCorreo) pCorreo.textContent = usuario.correo || "gerencia@unach.mx";
    if (pRol) pRol.textContent = `Rol: ${usuario.rol || "Gerente de Área"}`;
    if (pFac) pFac.textContent = usuario.departamento_nombre || usuario.facultad_nombre || "Área Asignada";
}

/**
 * Botón oficial de Cerrar Sesión del encabezado
 */
function inicializarBotonCerrarSesion() {
    const btn = document.getElementById("btnCerrarSesion");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.removeItem("sicou_token");
        sessionStorage.removeItem("sicou_usuario");
        window.location.href = "login.html";
    });
}

/**
 * Consulta a la API para obtener solicitudes y métricas de PostgreSQL
 */
async function cargarDatosDashboard() {
    const tbody = document.getElementById("tablaSolicitudesBody");

    try {

        //1. Recuperar el token de la sesion
        const token = sessionStorage.getItem("sicou_token");

        if (!token){
            console.warn("No se encontró token de sesión.");
            alert("Tu sesión ha expirado o no estás autenticado. Serás redirigido al login.");
            return window.location.href = "login.html";
        }

        // 2. Consultar las solicitudes enviando eltoken
        const respuesta = await fetch("/api/solicitudes", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        // 3. Comprobar si la sesión es válida
        if (respuesta.status === 401) {
            sessionStorage.removeItem("sicou_token");
            sessionStorage.removeItem("sicou_usuario");

            alert("Tu sesión ha expirado. Inicia sesión nuevamente.");
            window.location.href = "login.html";
            return;
        }

        const datos = await respuesta.json();

        if (datos.ok) {
            solicitudesGlobal = datos.solicitudes || [];
        
            // 4. Actualizar tarjetas estadísticas
            const stats = datos.estadisticas || {};

            const elTotal = document.getElementById("totalSolicitudes");
            const elPend = document.getElementById("solicitudesPendientes");
            const elRev = document.getElementById("solicitudesRevision");
            const elRes = document.getElementById("solicitudesResueltas");

            if (elTotal) elTotal.textContent = stats.total || 0;
            if (elPend) elPend.textContent = stats.pendientes || 0;
            if (elRev) elRev.textContent = stats.revision || 0;
            if (elRes) elRes.textContent = stats.resueltas || 0;

            // 5. Renderizar la tabla de solicitudes
            aplicarFiltros();

            // 6. Renderizar alertas de supervisor
            renderizarNotificaciones(solicitudesGlobal);

        } else {
            console.warn("Error en datos:", datos.error);
        }
    
    } catch (error) {
        console.error("Error al consultar API:", error);

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:25px;color:#dc2626;">
                        ⚠️ Servidor no detectado o error de conexión.
                        Verifica que 'python server.py' esté corriendo.
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Filtra y renderiza la tabla de solicitudes
 */
function aplicarFiltros() {
    const tbody = document.getElementById("tablaSolicitudesBody");
    if (!tbody) return;

    const filtroEstado = document.getElementById("filtroEstado") ? document.getElementById("filtroEstado").value : "todos";
    const filtroPrioridad = document.getElementById("filtroPrioridad") ? document.getElementById("filtroPrioridad").value : "todos";
    const buscarTexto = document.getElementById("inputBuscar") ? document.getElementById("inputBuscar").value.trim().toLowerCase() : "";

    let lista = [...solicitudesGlobal];

    if (filtroEstado !== "todos") {
        lista = lista.filter((s) => (s.estado || "Pendiente") === filtroEstado);
    }

    if (filtroPrioridad !== "todos") {
        lista = lista.filter((s) => (s.prioridad || "Baja") === filtroPrioridad);
    }

    if (buscarTexto) {
        lista = lista.filter((s) =>
            (s.folio && s.folio.toLowerCase().includes(buscarTexto)) ||
            (s.alumno_nombre && s.alumno_nombre.toLowerCase().includes(buscarTexto)) ||
            (s.descripcion && s.descripcion.toLowerCase().includes(buscarTexto)) ||
            (s.categoria && s.categoria.toLowerCase().includes(buscarTexto)) ||
            (s.depto_nombre && s.depto_nombre.toLowerCase().includes(buscarTexto))
        );
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#64748b;">No hay solicitudes registradas con estos filtros.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    lista.forEach((s) => {
        const tr = document.createElement("tr");

        // Color según prioridad asignada por IA
        let colorPrio = "#2563eb"; // Baja
        let bgPrio = "#dbeafe";
        if (s.prioridad === "Alta") {
            colorPrio = "#dc2626";
            bgPrio = "#fee2e2";
        } else if (s.prioridad === "Media") {
            colorPrio = "#d97706";
            bgPrio = "#fef3c7";
        }

        // Color de estado
        let colorEstado = "#e0f2fe";
        let textEstado = "#0284c7";
        if (s.estado === "En revisión" || s.estado === "En revision") {
            colorEstado = "#fef9c3";
            textEstado = "#a16207";
        } else if (s.estado === "Resuelta" || s.estado === "Atendida") {
            colorEstado = "#dcfce7";
            textEstado = "#15803d";
        }

        // Badge si tiene alerta para supervisor humano
        const badgeAlerta = s.alerta_supervisor
            ? `<span class="badge-alerta">⚠️ Alerta Supervisor</span>`
            : "";

        tr.innerHTML = `
            <td><strong style="color:#15345b;">${s.folio}</strong></td>
            <td>
                <div style="font-weight:600;color:#1e293b;">${s.alumno_nombre}</div>
                <div style="font-size:12px;color:#64748b;">${s.alumno_facultad || "Sin facultad"}</div>
            </td>
            <td>
                <div style="margin-bottom:4px;">
                    <span style="font-weight:600;color:#15345b;">${s.categoria || "General"}</span>
                    <span style="color:#64748b;font-size:12px;"> → Depto: <strong>${s.depto_nombre || s.canal_destino}</strong></span>
                    ${badgeAlerta}
                </div>
                <div style="color:#475569;font-size:13px;max-width:380px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${s.descripcion}
                </div>
                <div style="margin-top:4px;">
                    <span style="background:${bgPrio};color:${colorPrio};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">
                        Prioridad ${s.prioridad || "Baja"}
                    </span>
                    <span style="font-size:11px;color:#94a3b8;margin-left:6px;">
                        Confianza IA: ${(s.categoria === "Desconocida" || s.confianza === undefined || s.confianza === null ? 0 : Math.round(Number(s.confianza) * 100))}%
                    </span>
                </div>
            </td>
            <td style="font-size:12px;color:#64748b;">${s.fecha || "-"}</td>
            <td>
                <span style="background:${colorEstado};color:${textEstado};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;display:inline-block;">
                    ${s.estado || "Pendiente"}
                </span>
            </td>
            <td style="text-align:center;">
                ${s.archivo_adjunto 
                    ? '<a href="/uploads/' + s.archivo_adjunto + '" target="_blank" title="Ver archivo adjunto" style="font-size:20px; text-decoration:none;">📎</a>' 
                    : '<span style="color:#cbd5e1;">—</span>'}
            </td>
            <td>
                <div style="display:flex;gap:6px;align-items:center;">
                    <select onchange="cambiarEstadoDirecto(${s.id}, this.value)" style="padding:5px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;background:#ffffff;cursor:pointer;">
                        <option value="Pendiente" ${s.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option value="En revisión" ${s.estado === "En revisión" || s.estado === "En revision" ? "selected" : ""}>En revisión</option>
                        <option value="Resuelta" ${s.estado === "Resuelta" || s.estado === "Atendida" ? "selected" : ""}>Resuelta</option>
                    </select>
                    <button onclick="verDetalleSolicitudArea(${s.id})" style="background:#1d5c96;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">
                        Ver
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

/**
 * Renderiza la bandeja de Notificaciones (Alertas de supervisor)
 */
function renderizarNotificaciones(solicitudes) {
    const contenedor = document.getElementById("contenedorAlertas");
    const contador = document.getElementById("contadorNotifArea") || document.getElementById("contadorNotifAdmin");
    if (!contenedor) return;

    const alertas = solicitudes.filter((s) => s.alerta_supervisor);

    if (contador) {
        contador.textContent = alertas.length;
    }

    if (alertas.length === 0) {
        contenedor.innerHTML = `
            <div class="notif-card" style="border-left-color:#16a34a;">
                <div class="notif-icono">✅</div>
                <div class="notif-cuerpo">
                    <h4>Sin alertas pendientes</h4>
                    <p>No existen solicitudes críticas que requieran atención inmediata del supervisor.</p>
                </div>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";

    alertas.forEach((s) => {
        const div = document.createElement("div");
        div.className = "notif-card alerta";
        div.innerHTML = `
            <div class="notif-icono">⚠️</div>
            <div class="notif-cuerpo">
                <h4>Atención Requerida: ${s.folio} - ${s.categoria}</h4>
                <p><strong>Motivo de alerta:</strong> ${s.motivo_alerta || "Caso crítico o baja confianza"}</p>
                <p><strong>Alumno:</strong> ${s.alumno_nombre} (${s.alumno_facultad || ""})</p>
                <div style="margin: 8px 0; font-size:13px; color:#334155;"><em>"${s.descripcion}"</em></div>
                <div class="notif-meta">Canal: ${s.depto_nombre || s.canal_destino} | Fecha: ${s.fecha}</div>
            </div>
            <div>
                <button onclick="verDetalleSolicitudArea(${s.id})" style="background:#dc2626;color:white;border:none;padding:7px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">
                    Revisar caso
                </button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

/**
 * Actualiza el estado de una solicitud en PostgreSQL
 */
async function cambiarEstadoDirecto(solicitudId, nuevoEstado) {
    try {
        const token = sessionStorage.getItem("sicou_token");

        const respuesta = await fetch("/api/solicitudes/estado", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                estado: nuevoEstado
            })
        });

        const data = await respuesta.json();
        if (respuesta.ok && data.ok) {
            cargarDatosDashboard();
        } else {
            alert("No se pudo actualizar el estado: " + (data.error || "Error"));
        }
    } catch (e) {
        console.error("Error al actualizar estado:", e);
        alert("Error de conexión al actualizar estado.");
    }
}

/**
 * Muestra el análisis completo del agente IA para la solicitud seleccionada
 */
function verDetalleSolicitudArea(solicitudId) {
    const s = solicitudesGlobal.find(x => x.id === solicitudId);
    if (!s) return;

    // Eliminar modal anterior si existe
    const anterior = document.getElementById('modalDetalleSolicitud');
    if (anterior) anterior.remove();

    const confNum = (s.categoria === "Desconocida" || s.confianza === undefined || s.confianza === null) ? 0 : Number(s.confianza);
    const confianza = (confNum * 100).toFixed(1);
    const departamento = s.depto_nombre || s.canal_destino || 'No asignado';

    const modal = document.createElement('div');
    modal.id = 'modalDetalleSolicitud';

    modal.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.65);
        padding: 20px;
        box-sizing: border-box;
    `;


    modal.innerHTML = `
        <div class="detalle-modal-overlay">
            <div class="detalle-modal">

                <div class="detalle-modal-header">
                    <div>
                        <span class="detalle-etiqueta">DETALLE DE SOLICITUD</span>
                        <h2>${s.folio || 'Sin folio'}</h2>
                    </div>
                    <button class="detalle-cerrar" onclick="cerrarDetalleSolicitud()">
                        &times;
                    </button>
                </div>

                <div class="detalle-modal-body">

                    <div class="detalle-seccion">
                        <h3>Información del estudiante</h3>
                        <div class="detalle-grid">
                            <div>
                                <span>Nombre</span>
                                <strong>${s.alumno_nombre || 'No disponible'}</strong>
                            </div>
                            <div>
                                <span>Correo electrónico</span>
                                <strong>${s.alumno_correo || 'Sin correo'}</strong>
                            </div>
                            <div>
                                <span>Facultad</span>
                                <strong>${s.alumno_facultad || 'No especificada'}</strong>
                            </div>
                            <div>
                                <span>Fecha de registro</span>
                                <strong>${s.fecha || 'No disponible'}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="detalle-seccion">
                        <h3>Estado de la solicitud</h3>
                        <span class="detalle-estado">
                            ${s.estado || 'Sin estado'}
                        </span>
                    </div>

                    <div class="detalle-seccion">
                        <h3>Análisis del agente inteligente</h3>

                        <div class="detalle-grid">
                            <div>
                                <span>Categoría</span>
                                <strong>${s.categoria || 'No identificada'}</strong>
                            </div>
                            <div>
                                <span>Prioridad</span>
                                <strong>${s.prioridad || 'No definida'}</strong>
                            </div>
                            <div>
                                <span>Departamento destino</span>
                                <strong>${departamento}</strong>
                            </div>
                            <div>
                                <span>Nivel de confianza</span>
                                <strong>${confianza}%</strong>
                            </div>
                        </div>

                        <div class="detalle-confianza">
                            <div class="detalle-confianza-barra">
                                <div style="width: ${Math.min(100, Math.max(0, Number(confianza)))}%"></div>
                            </div>
                        </div>

                        <div class="detalle-alerta ${s.alerta_supervisor ? 'activa' : ''}">
                            <strong>Alerta a supervisor:</strong>
                            ${s.alerta_supervisor
                                ? 'Sí - ' + (s.motivo_alerta || 'Atención inmediata')
                                : 'No requerida'}
                        </div>
                    </div>

                    <div class="detalle-seccion">
                        <h3>Descripción de la solicitud</h3>
                        <div class="detalle-descripcion">
                            ${s.descripcion || 'Sin descripción'}
                        </div>
                    </div>

                    <!-- 📥 ENLACE DE ARCHIVO ADJUNTO (GERENCIA) -->
                    ${s.archivo_adjunto ? `
                        <div class="detalle-seccion">
                            <h3>Archivo Adjunto</h3>
                            <div class="detalle-descripcion">
                                <a href="/uploads/${s.archivo_adjunto}" target="_blank" style="color: #2563eb; font-weight: bold; text-decoration: underline;">
                                    📥 Descargar / Ver archivo adjunto (${s.archivo_adjunto})
                                </a>
                            </div>
                        </div>
                    ` : ''}

                </div>

                <div class="detalle-modal-footer">
                    <button onclick="cerrarDetalleSolicitud()">
                        Cerrar
                    </button>
                </div>

            </div>
        </div>
    `;

    
const contenidoModal = modal.querySelector('.detalle-modal');

if (contenidoModal) {
    contenidoModal.style.cssText = `
        position: relative;
        background: #ffffff;
        width: 100%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        border-radius: 14px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        color: #263445;
        font-family: Arial, sans-serif;
    `;

    const encabezado = contenidoModal.querySelector('.detalle-modal-header');
    if (encabezado) {
        encabezado.style.cssText = `
            background: #15345b;
            color: white;
            padding: 22px 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
    }

    const cuerpo = contenidoModal.querySelector('.detalle-modal-body');
    if (cuerpo) {
        cuerpo.style.cssText = `
            padding: 25px;
            display: flex;
            flex-direction: column;
            gap: 20px;
        `;
    }

    contenidoModal.querySelectorAll('.detalle-modal-section').forEach(seccion => {
        seccion.style.cssText = `
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 18px;
        `;
    });

    contenidoModal.querySelectorAll('h3').forEach(titulo => {
        titulo.style.cssText = `
            color: #15345b;
            font-size: 16px;
            margin-bottom: 14px;
        `;
    });

    const pie = contenidoModal.querySelector('.detalle-modal-footer');
    if (pie) {
        pie.style.cssText = `
            padding: 16px 25px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: flex-end;
        `;
    }
}

    document.body.appendChild(modal);
}

function cerrarDetalleSolicitud() {
    const modal = document.getElementById('modalDetalleSolicitud');
    if (modal) modal.remove();
}

// Exportar funciones para los atributos inline del HTML
window.cambiarVistaArea = cambiarVistaArea;
window.cambiarVistaAdmin = cambiarVistaArea; // Compatibilidad
window.aplicarFiltros = aplicarFiltros;
window.cambiarEstadoDirecto = cambiarEstadoDirecto;
window.verDetalleSolicitudArea = verDetalleSolicitudArea;
window.verDetalleSolicitudAdmin = verDetalleSolicitudArea; // Compatibilidad
