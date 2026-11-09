// ==============================================================================
// SICOU_IA - Lógica del Panel de Administrador (admin.html)
// Gestión dinámica de los 4 Departamentos, Filtrado de Solicitudes y Conexión API
// ==============================================================================

// Estado global de la aplicación
let tokenSesion = null;
let usuarioSesion = null;
let solicitudesActuales = [];
let deptoSeleccionadoId = null; // null = todas
let deptoSeleccionadoNombre = "Todas las Solicitudes";

document.addEventListener("DOMContentLoaded", () => {
    validarAutenticacion();
    inicializarNavbar();
    inicializarEventosDepartamentos();
    inicializarHerramientasFiltro();
    inicializarModal();
    cargarDepartamentos();
    cargarSolicitudes(); // Carga inicial
});

/**
 * 1. Valida que el usuario tenga sesión activa y rol de administrador
 */
function validarAutenticacion() {
    tokenSesion = sessionStorage.getItem("sicou_token");
    const rawUsuario = sessionStorage.getItem("sicou_usuario");

    if (!tokenSesion || !rawUsuario) {
        console.warn("Sin sesión activa. Redirigiendo al login...");
        window.location.href = "login.html";
        return;
    }

    try {
        usuarioSesion = JSON.parse(rawUsuario);
    } catch (e) {
        usuarioSesion = { rol: "administrador", nombre: "Administrador" };
    }

    const rolNormalizado = (usuarioSesion.rol || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();

    if (rolNormalizado !== "administrador" && rolNormalizado !== "admin") {
        alert("Acceso denegado. Este portal es exclusivo para el Administrador.");
        window.location.href = "login.html";
    }
}

/**
 * 2. Configura el Navbar: Nombre de rol y botón de Cerrar sesión
 */
function inicializarNavbar() {
    const spanRol = document.getElementById("navbarRol");
    if (spanRol) {
        spanRol.textContent = usuarioSesion.rol || "Administrador";
    }

    const btnLogout = document.getElementById("btnCerrarSesion");
    if (btnLogout) {
        btnLogout.addEventListener("click", (e) => {
            e.preventDefault();
            sessionStorage.removeItem("sicou_token");
            sessionStorage.removeItem("sicou_usuario");
            mostrarToast("Sesión finalizada correctamente.", "exito");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 600);
        });
    }
}

/**
 * 3. Configura los clics a las 4 tarjetas de los departamentos
 */
function inicializarEventosDepartamentos() {
    const tarjetas = document.querySelectorAll(".tarjeta-depto");

    tarjetas.forEach((tarjeta) => {
        // Clic en la tarjeta completa o en su botón "VER SOLICITUDES"
        tarjeta.addEventListener("click", () => {
            const deptoId = parseInt(tarjeta.getAttribute("data-depto-id"), 10);
            const deptoNombre = tarjeta.getAttribute("data-depto-nombre");
            seleccionarDepartamento(deptoId, deptoNombre);
        });

        // Soporte de accesibilidad por teclado
        tarjeta.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                tarjeta.click();
            }
        });
    });

    // Botón para limpiar filtro y ver todas
    const btnLimpiar = document.getElementById("btnLimpiarFiltro");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", (e) => {
            e.preventDefault();
            limpiarSeleccionDepartamento();
        });
    }
}

/**
 * 4. Acción al dar clic en una de las tarjetas de departamento:
 * Resalta la tarjeta, actualiza títulos y jala las solicitudes de ese departamento
 */
function seleccionarDepartamento(deptoId, deptoNombre) {
    deptoSeleccionadoId = deptoId;
    deptoSeleccionadoNombre = deptoNombre;

    // Resaltar tarjeta seleccionada en la cuadrícula
    document.querySelectorAll(".tarjeta-depto").forEach((t) => {
        if (parseInt(t.getAttribute("data-depto-id"), 10) === deptoId) {
            t.classList.add("activa");
        } else {
            t.classList.remove("activa");
        }
    });

    // Mostrar indicador de filtro
    const indFiltro = document.getElementById("indicadorFiltro");
    const spanFiltro = document.getElementById("nombreFiltroActual");
    if (indFiltro && spanFiltro) {
        indFiltro.style.display = "flex";
        spanFiltro.textContent = deptoNombre;
    }

    // Actualizar título de la bandeja
    const tituloBandeja = document.getElementById("tituloBandeja");
    if (tituloBandeja) {
        tituloBandeja.textContent = `Solicitudes de: ${deptoNombre}`;
    }

    // Jalar las solicitudes del departamento
    cargarSolicitudes(deptoId);

    // Scroll suave hacia la sección de la tabla
    const secTabla = document.getElementById("seccionSolicitudes");
    if (secTabla) {
        secTabla.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

/**
 * Quita el filtro de departamento y muestra todas las solicitudes
 */
function limpiarSeleccionDepartamento() {
    deptoSeleccionadoId = null;
    deptoSeleccionadoNombre = "Todas las Solicitudes";

    document.querySelectorAll(".tarjeta-depto").forEach((t) => t.classList.remove("activa"));

    const indFiltro = document.getElementById("indicadorFiltro");
    if (indFiltro) indFiltro.style.display = "none";

    const tituloBandeja = document.getElementById("tituloBandeja");
    if (tituloBandeja) tituloBandeja.textContent = "Todas las Solicitudes";

    cargarSolicitudes(null);
}

/**
 * 5. Carga los contadores de solicitudes de los 4 departamentos desde /api/departamentos
 */
async function cargarDepartamentos() {
    try {
        const respuesta = await fetch("/api/departamentos", {
            headers: {
                "Authorization": `Bearer ${tokenSesion}`
            }
        });

        if (!respuesta.ok) return;

        const datos = await respuesta.json();
        const lista = datos.departamentos || [];

        // Mapeo id -> total
        lista.forEach((d) => {
            const contadorEl = document.getElementById(`count-dept-${d.id}`);
            if (contadorEl) {
                contadorEl.textContent = d.total || 0;
            }
        });
    } catch (error) {
        console.warn("No se pudieron cargar contadores de departamentos:", error);
    }
}

/**
 * 6. Consulta las solicitudes a la API (/api/solicitudes), filtrando por departamento si aplica
 */
async function cargarSolicitudes(deptoId = deptoSeleccionadoId) {
    const tbody = document.getElementById("cuerpoTablaSolicitudes");
    const estadoVacio = document.getElementById("estadoVacio");
    const badgeTotal = document.getElementById("contadorSolicitudesTabla");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="td-cargando">
                    <div class="spinner"></div>
                    <span>Consultando solicitudes en la base de datos...</span>
                </td>
            </tr>
        `;
    }
    if (estadoVacio) estadoVacio.style.display = "none";
    if (badgeTotal) badgeTotal.textContent = "Cargando...";

    try {
        let url = "/api/solicitudes";
        const params = new URLSearchParams();

        if (deptoId !== null && deptoId !== undefined) {
            params.append("departamento_id", deptoId);
        }

        const selectEstado = document.getElementById("selectEstado");
        if (selectEstado && selectEstado.value && selectEstado.value !== "todos") {
            params.append("estado", selectEstado.value);
        }

        const queryString = params.toString();
        if (queryString) {
            url += `?${queryString}`;
        }

        const respuesta = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${tokenSesion}`
            }
        });

        if (respuesta.status === 401) {
            mostrarToast("Tu sesión ha expirado. Inicia sesión nuevamente.", "error");
            setTimeout(() => window.location.href = "login.html", 1500);
            return;
        }

        if (!respuesta.ok) {
            throw new Error(`Error en el servidor (${respuesta.status})`);
        }

        const datos = await respuesta.json();
        solicitudesActuales = datos.solicitudes || [];

        renderizarTabla(solicitudesActuales);
        actualizarContadoresLocales();
    } catch (error) {
        console.error("Error al obtener solicitudes:", error);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; color: var(--rojo-error); padding: 30px;">
                        ⚠️ Error de conexión al consultar solicitudes. Verifica que <code>server.py</code> esté en ejecución.
                    </td>
                </tr>
            `;
        }
        if (badgeTotal) badgeTotal.textContent = "0";
    }
}

/**
 * 7. Renderiza las filas en la tabla de solicitudes
 */
function renderizarTabla(lista) {
    const tbody = document.getElementById("cuerpoTablaSolicitudes");
    const estadoVacio = document.getElementById("estadoVacio");
    const badgeTotal = document.getElementById("contadorSolicitudesTabla");
    const msgVacio = document.getElementById("mensajeEstadoVacio");

    if (!tbody) return;

    if (!lista || lista.length === 0) {
        tbody.innerHTML = "";
        if (estadoVacio) {
            estadoVacio.style.display = "block";
            if (deptoSeleccionadoId) {
                msgVacio.textContent = `No hay solicitudes registradas para el departamento "${deptoSeleccionadoNombre}".`;
            } else {
                msgVacio.textContent = "No se encontraron solicitudes con los filtros aplicados.";
            }
        }
        if (badgeTotal) badgeTotal.textContent = "0 solicitudes";
        return;
    }

    if (estadoVacio) estadoVacio.style.display = "none";
    if (badgeTotal) badgeTotal.textContent = `${lista.length} solicitud${lista.length === 1 ? "" : "es"}`;

    const htmlFilas = lista.map((sol) => {
        const folio = sol.folio || `SOL-${String(sol.id).padStart(3, "0")}`;
        const alumnoNombre = sol.alumno_nombre || "Estudiante";
        const alumnoCorreo = sol.alumno_correo || "";
        const facultad = sol.alumno_facultad || "No especificada";
        const departamento = sol.depto_nombre || sol.canal_destino || "General";
        const descripcion = sol.descripcion || "";
        const categoria = sol.categoria || "Trámite General";
        const prioridad = (sol.prioridad || "Media").toLowerCase();
        const confianza = sol.confianza ? Math.round(sol.confianza * 100) : 85;
        const alerta = Boolean(sol.alerta_supervisor);
        const estado = sol.estado || "Pendiente";
        const fecha = sol.fecha || "Reciente";

        // Badge de prioridad
        let prioridadClase = "media";
        if (prioridad.includes("alta") || prioridad.includes("urgente")) prioridadClase = "alta";
        else if (prioridad.includes("baja")) prioridadClase = "baja";

        // Selector de estado
        const estadoClase = estado.toLowerCase().replace(/\s+/g, "-");

        return `
            <tr data-solicitud-id="${sol.id}">
                <td class="td-folio">${folio}</td>
                <td class="td-alumno">
                    <span class="nombre">${escaparHtml(alumnoNombre)}</span>
                    <span class="correo">${escaparHtml(alumnoCorreo)}</span>
                </td>
                <td><small>${escaparHtml(facultad)}</small></td>
                <td><strong>${escaparHtml(departamento)}</strong></td>
                <td class="td-desc" title="${escaparHtml(descripcion)}">${escaparHtml(descripcion)}</td>
                <td><span class="chip-tag">${escaparHtml(categoria)}</span></td>
                <td><span class="badge-prioridad ${prioridadClase}">${escaparHtml(sol.prioridad || "Media")}</span></td>
                <td>
                    <div class="barra-confianza" title="${confianza}% de confianza de la IA">
                        <div class="barra-progreso">
                            <div class="barra-fill" style="width: ${confianza}%;"></div>
                        </div>
                        <small><b>${confianza}%</b></small>
                    </div>
                </td>
                <td>
                    ${alerta 
                        ? `<span class="badge-alerta-si" title="${escaparHtml(sol.motivo_alerta || 'Requiere revisión de supervisor')}">⚠️ Alerta</span>` 
                        : `<span class="badge-alerta-no">—</span>`}
                </td>
                <td>
                    <select class="select-tabla-estado ${estadoClase}" data-id="${sol.id}" onchange="cambiarEstadoSolicitud(${sol.id}, this.value, this)">
                        <option value="Pendiente" ${estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                        <option value="En revisión" ${estado === "En revisión" || estado === "En revision" ? "selected" : ""}>En revisión</option>
                        <option value="Resuelta" ${estado === "Resuelta" || estado === "Atendida" ? "selected" : ""}>Resuelta</option>
                        <option value="Cancelada" ${estado === "Cancelada" ? "selected" : ""}>Cancelada</option>
                    </select>
                </td>
                <td><small>${escaparHtml(fecha)}</small></td>
                <td>
                    <button class="btn-detalle" onclick="abrirModalDetalle(${sol.id})">Ver detalle</button>
                </td>
            </tr>
        `;
    }).join("");

    tbody.innerHTML = htmlFilas;
}

/**
 * 8. Cambio de estado directo desde el selector de la tabla
 */
async function cambiarEstadoSolicitud(solicitudId, nuevoEstado, selectElement) {
    try {
        const respuesta = await fetch("/api/solicitudes/estado", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${tokenSesion}`
            },
            body: JSON.stringify({
                solicitud_id: solicitudId,
                estado: nuevoEstado
            })
        });

        const datos = await respuesta.json();

        if (respuesta.ok && datos.ok) {
            mostrarToast(`Solicitud actualizada a "${nuevoEstado}".`, "exito");
            
            // Actualizar estilo visual del select
            if (selectElement) {
                selectElement.className = `select-tabla-estado ${nuevoEstado.toLowerCase().replace(/\s+/g, "-")}`;
            }

            // Actualizar en memoria local
            const encontrada = solicitudesActuales.find((s) => s.id === solicitudId);
            if (encontrada) encontrada.estado = nuevoEstado;

            cargarDepartamentos(); // Refrescar conteos
        } else {
            mostrarToast(datos.error || datos.mensaje || "Error al actualizar estado", "error");
        }
    } catch (error) {
        console.error("Error al actualizar estado:", error);
        mostrarToast("No se pudo conectar con el servidor para actualizar el estado.", "error");
    }
}

/**
 * 9. Inicializa herramientas de filtrado (Búsqueda en vivo y filtro por estado)
 */
function inicializarHerramientasFiltro() {
    const inputBuscar = document.getElementById("inputBuscar");
    const selectEstado = document.getElementById("selectEstado");
    const btnRecargar = document.getElementById("btnRecargar");

    // Buscador en tiempo real
    if (inputBuscar) {
        inputBuscar.addEventListener("input", () => {
            const query = inputBuscar.value.toLowerCase().trim();
            if (!query) {
                renderizarTabla(solicitudesActuales);
                return;
            }

            const filtradas = solicitudesActuales.filter((s) => {
                const folio = (s.folio || `SOL-${s.id}`).toLowerCase();
                const alumno = (s.alumno_nombre || "").toLowerCase();
                const depto = (s.depto_nombre || s.canal_destino || "").toLowerCase();
                const desc = (s.descripcion || "").toLowerCase();
                const cat = (s.categoria || "").toLowerCase();
                return folio.includes(query) || alumno.includes(query) || depto.includes(query) || desc.includes(query) || cat.includes(query);
            });

            renderizarTabla(filtradas);
        });
    }

    // Filtro por estado
    if (selectEstado) {
        selectEstado.addEventListener("change", () => {
            cargarSolicitudes(deptoSeleccionadoId);
        });
    }

    // Botón de recargar
    if (btnRecargar) {
        btnRecargar.addEventListener("click", () => {
            cargarDepartamentos();
            cargarSolicitudes(deptoSeleccionadoId);
            mostrarToast("Datos sincronizados con la base de datos.", "exito");
        });
    }
}

/**
 * 10. Actualiza los contadores de cada departamento en las tarjetas si están en pantalla
 */
function actualizarContadoresLocales() {
    cargarDepartamentos();
}

/**
 * 11. Modal de detalle de solicitud con diagnóstico completo de IA
 */
function inicializarModal() {
    const modal = document.getElementById("modalDetalle");
    const btnCerrar = document.getElementById("btnCerrarModal");
    const btnCerrarPie = document.getElementById("btnCerrarModalPie");

    function cerrar() {
        if (modal) modal.classList.remove("activo");
    }

    if (btnCerrar) btnCerrar.addEventListener("click", cerrar);
    if (btnCerrarPie) btnCerrarPie.addEventListener("click", cerrar);
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) cerrar();
        });
    }
}

function abrirModalDetalle(solicitudId) {
    const sol = solicitudesActuales.find((s) => s.id === solicitudId);
    if (!sol) return;

    const modal = document.getElementById("modalDetalle");
    const modalFolio = document.getElementById("modalFolio");
    const modalContenido = document.getElementById("modalContenido");

    if (modalFolio) modalFolio.textContent = sol.folio || `SOL-${String(sol.id).padStart(3, "0")}`;

    // Deserializar posibles campos JSON
    let palabras = [];
    let reglas = [];
    try {
        if (sol.palabras_clave) palabras = typeof sol.palabras_clave === "string" ? JSON.parse(sol.palabras_clave) : sol.palabras_clave;
    } catch (_) {}
    try {
        if (sol.reglas_activadas) reglas = typeof sol.reglas_activadas === "string" ? JSON.parse(sol.reglas_activadas) : sol.reglas_activadas;
    } catch (_) {}

    const confianza = sol.confianza ? Math.round(sol.confianza * 100) : 85;

    if (modalContenido) {
        modalContenido.innerHTML = `
            <div class="modal-fila">
                <div class="campo-detalle">
                    <label>Estudiante Solicitante</label>
                    <p><strong>${escaparHtml(sol.alumno_nombre || "Anónimo")}</strong><br><small>${escaparHtml(sol.alumno_correo || "")}</small></p>
                </div>
                <div class="campo-detalle">
                    <label>Facultad</label>
                    <p>${escaparHtml(sol.alumno_facultad || "No especificada")}</p>
                </div>
            </div>

            <div class="campo-detalle campo-detalle-full">
                <label>Descripción Completa de la Solicitud</label>
                <p>${escaparHtml(sol.descripcion || "Sin descripción")}</p>
            </div>

            <div class="modal-fila">
                <div class="campo-detalle">
                    <label>Departamento Asignado</label>
                    <p><strong>${escaparHtml(sol.depto_nombre || sol.canal_destino || "Sin asignar")}</strong></p>
                </div>
                <div class="campo-detalle">
                    <label>Categoría</label>
                    <p>${escaparHtml(sol.categoria || "General")}</p>
                </div>
            </div>

            <div class="modal-fila">
                <div class="campo-detalle">
                    <label>Prioridad Calculada</label>
                    <p><strong>${escaparHtml(sol.prioridad || "Media")}</strong></p>
                </div>
                <div class="campo-detalle">
                    <label>Confianza de la IA</label>
                    <p>${confianza}%</p>
                </div>
            </div>

            ${sol.alerta_supervisor ? `
                <div class="alerta-box">
                    <strong>⚠️ ALERTA DE SUPERVISIÓN HUMANA:</strong>
                    <div style="margin-top: 4px;">${escaparHtml(sol.motivo_alerta || "Esta solicitud fue marcada para revisión inmediata por reglas del sistema.")}</div>
                </div>
            ` : ""}

            ${palabras && palabras.length > 0 ? `
                <div class="campo-detalle campo-detalle-full">
                    <label>Palabras Clave Identificadas por NLP</label>
                    <div class="chips-ia">
                        ${palabras.map((p) => `<span class="chip-tag">${escaparHtml(p)}</span>`).join("")}
                    </div>
                </div>
            ` : ""}

            ${reglas && reglas.length > 0 ? `
                <div class="campo-detalle campo-detalle-full">
                    <label>Reglas Ontológicas Activadas</label>
                    <div class="chips-ia">
                        ${reglas.map((r) => `<span class="chip-tag" style="background:#fef3c7; color:#b45309; border-color:#fcd34d;">${escaparHtml(r)}</span>`).join("")}
                    </div>
                </div>
            ` : ""}

            <div class="modal-fila">
                <div class="campo-detalle">
                    <label>Estado Actual</label>
                    <p><strong>${escaparHtml(sol.estado || "Pendiente")}</strong></p>
                </div>
                <div class="campo-detalle">
                    <label>Fecha de Creación</label>
                    <p>${escaparHtml(sol.fecha || "Reciente")}</p>
                </div>
            </div>
        `;
    }

    if (modal) modal.classList.add("activo");
}

/**
 * 12. Mensajes Toast flotantes
 */
function mostrarToast(mensaje, tipo = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;

    toast.textContent = mensaje;
    toast.className = `toast ${tipo}`;
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 3500);
}

/**
 * 13. Utilidad para prevenir inyecciones de código en HTML
 */
function escaparHtml(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
