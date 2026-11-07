// ==============================================================================
// Lógica del Panel de Administración / Gerencia (areas.html)
// Conexión y Gestión de Bandejas en Tiempo Real con PostgreSQL y Agente IA
// ==============================================================================

let solicitudesGlobal = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarDatosUsuario();
    inicializarBotonCerrarSesion();
    inicializarNavegacionSidebar();
    cargarDatosDashboard();
});

/**
 * Cambia la bandeja visible en el panel del administrador
 */
function cambiarVistaAdmin(vistaId) {
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
                cambiarVistaAdmin(vista);
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
        nombre: "administrador",
        correo: "adminsicou@unach.mx",
        rol: "administrador",
        facultad_nombre: "Administración Central"
    };

    // Header
    const spanNombre = document.getElementById("nombreUsuarioAdmin");
    if (spanNombre) spanNombre.textContent = `${usuario.nombre} (${usuario.rol || "Administrador"})`;

    const h3Area = document.getElementById("nombreArea");
    if (h3Area) h3Area.textContent = `Panel Central - ${usuario.facultad_nombre || "Administración Central"}`;

    // Vista de Perfil
    const pNombre = document.getElementById("perfilNombre");
    const pCorreo = document.getElementById("perfilCorreo");
    const pRol = document.getElementById("perfilRol");
    const pFac = document.getElementById("perfilFacultad");

    if (pNombre) pNombre.textContent = usuario.nombre || "Administrador";
    if (pCorreo) pCorreo.textContent = usuario.correo || "adminsicou@unach.mx";
    if (pRol) pRol.textContent = `Rol: ${usuario.rol || "Administrador"}`;
    if (pFac) pFac.textContent = usuario.facultad_nombre || "Administración Central";
}

/**
 * Botón oficial de Cerrar Sesión del encabezado
 */
function inicializarBotonCerrarSesion() {
    const btn = document.getElementById("btnCerrarSesion");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
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
        const respuesta = await fetch("/api/solicitudes");
        const datos = await respuesta.json();

        if (datos.ok) {
            solicitudesGlobal = datos.solicitudes || [];

            // 1. Actualizar tarjetas estadísticas
            const stats = datos.estadisticas || {};
            const elTotal = document.getElementById("totalSolicitudes");
            const elPend = document.getElementById("solicitudesPendientes");
            const elRev = document.getElementById("solicitudesRevision");
            const elRes = document.getElementById("solicitudesResueltas");

            if (elTotal) elTotal.textContent = stats.total || 0;
            if (elPend) elPend.textContent = stats.pendientes || 0;
            if (elRev) elRev.textContent = stats.revision || 0;
            if (elRes) elRes.textContent = stats.resueltas || 0;

            // 2. Renderizar la tabla en la bandeja de solicitudes
            aplicarFiltros();

            // 3. Renderizar alertas de supervisor
            renderizarNotificaciones(solicitudesGlobal);
        } else {
            console.warn("Error en datos:", datos.error);
        }
    } catch (error) {
        console.error("Error al consultar API:", error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:25px;color:#dc2626;">⚠️ Servidor no detectado o error de conexión. Verifica que 'python server.py' esté corriendo.</td></tr>`;
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#64748b;">No hay solicitudes registradas con estos filtros.</td></tr>`;
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
                        Confianza IA: ${((s.confianza || 0.8) * 100).toFixed(0)}%
                    </span>
                </div>
            </td>
            <td style="font-size:12px;color:#64748b;">${s.fecha || "-"}</td>
            <td>
                <span style="background:${colorEstado};color:${textEstado};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600;display:inline-block;">
                    ${s.estado || "Pendiente"}
                </span>
            </td>
            <td>
                <div style="display:flex;gap:6px;align-items:center;">
                    <select onchange="cambiarEstadoDirecto(${s.id}, this.value)" style="padding:5px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;background:#ffffff;cursor:pointer;">
                        <option value="Pendiente" ${s.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option value="En revisión" ${s.estado === "En revisión" || s.estado === "En revision" ? "selected" : ""}>En revisión</option>
                        <option value="Resuelta" ${s.estado === "Resuelta" || s.estado === "Atendida" ? "selected" : ""}>Resuelta</option>
                    </select>
                    <button onclick="verDetalleSolicitudAdmin(${s.id})" style="background:#1d5c96;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;">
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
    const contador = document.getElementById("contadorNotifAdmin");
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
                <button onclick="verDetalleSolicitudAdmin(${s.id})" style="background:#dc2626;color:white;border:none;padding:7px 12px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;">
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
        const respuesta = await fetch("/api/solicitudes/estado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
function verDetalleSolicitudAdmin(solicitudId) {
    const s = solicitudesGlobal.find((x) => x.id === solicitudId);
    if (!s) return;

    let info = `📋 REPORTE DE SOLICITUD ${s.folio}\n\n`;
    info += `👤 Alumno: ${s.alumno_nombre} (${s.alumno_correo || "Sin correo"})\n`;
    info += `🏛️ Facultad: ${s.alumno_facultad || "No especificada"}\n`;
    info += `📅 Fecha: ${s.fecha}\n`;
    info += `📌 Estado actual: ${s.estado}\n\n`;
    info += `----------------------------------------\n`;
    info += `🤖 ANÁLISIS DEL AGENTE DE INTELIGENCIA ARTIFICIAL:\n`;
    info += `📂 Categoría (Machine Learning): ${s.categoria}\n`;
    info += `⚡ Prioridad (Motor de Reglas): ${s.prioridad}\n`;
    info += `🏢 Departamento destino: ${s.depto_nombre || s.canal_destino}\n`;
    info += `🎯 Nivel de confianza: ${((s.confianza || 0) * 100).toFixed(1)}%\n`;
    info += `⚠️ Alerta a supervisor: ${s.alerta_supervisor ? "SÍ -> " + (s.motivo_alerta || "Atención inmediata") : "No requerida"}\n\n`;
    info += `----------------------------------------\n`;
    info += `📝 DESCRIPCIÓN:\n${s.descripcion}`;

    alert(info);
}

// Exportar funciones para los atributos inline del HTML
window.cambiarVistaAdmin = cambiarVistaAdmin;
window.aplicarFiltros = aplicarFiltros;
window.cambiarEstadoDirecto = cambiarEstadoDirecto;
window.verDetalleSolicitudAdmin = verDetalleSolicitudAdmin;
