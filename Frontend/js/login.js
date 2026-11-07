// ==============================================================================
// Lógica de interacción para Login y Registro - Conexión con PostgreSQL / API
// ==============================================================================

document.addEventListener("DOMContentLoaded", () => {
    const seccionLogin = document.getElementById("seccionLogin");
    const seccionRegistro = document.getElementById("seccionRegistro");
    const linkIrRegistro = document.getElementById("linkIrRegistro");
    const linkIrLogin = document.getElementById("linkIrLogin");
    const mensajeAlerta = document.getElementById("mensajeAlerta");

    const formLogin = document.getElementById("formLogin");
    const formRegistro = document.getElementById("formRegistro");

    // Función para mostrar alertas estilizadas
    function mostrarMensaje(texto, tipo = "error") {
        mensajeAlerta.textContent = texto;
        mensajeAlerta.className = `alerta-msg ${tipo}`;
        mensajeAlerta.style.display = "block";

        setTimeout(() => {
            mensajeAlerta.style.display = "none";
        }, 4000);
    }

    // Alternar a formulario de Registro
    linkIrRegistro.addEventListener("click", (e) => {
        e.preventDefault();
        mensajeAlerta.style.display = "none";
        seccionLogin.classList.remove("activo");
        seccionRegistro.classList.add("activo");
    });

    // Alternar a formulario de Login
    linkIrLogin.addEventListener("click", (e) => {
        e.preventDefault();
        mensajeAlerta.style.display = "none";
        seccionRegistro.classList.remove("activo");
        seccionLogin.classList.add("activo");
    });

    // Cargar correo recordado si existe
    const correoGuardado = localStorage.getItem("sicou_remember_email");
    if (correoGuardado) {
        const inputCorreo = document.getElementById("loginCorreo");
        const checkRemember = document.getElementById("rememberMe");
        if (inputCorreo && checkRemember) {
            inputCorreo.value = correoGuardado;
            checkRemember.checked = true;
        }
    }

    // Manejo de envío de LOGIN
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const correo = document.getElementById("loginCorreo").value.trim();
        const contrasena = document.getElementById("loginPassword").value;
        const facultad_id = document.getElementById("loginFacultad").value;
        const rememberMe = document.getElementById("rememberMe").checked;

        if (!correo || !contrasena || !facultad_id) {
            mostrarMensaje("Por favor completa todos los campos, incluida la facultad.", "error");
            return;
        }

        try {
            const respuesta = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ correo, contrasena, facultad_id })
            });

            const datos = await respuesta.json();

            console.log("Usuario recibido:", datos.usuario);
            console.log("Rol recibido:", datos.usuario?.rol);

            if (respuesta.ok && datos.ok) {
                if (rememberMe) {
                    localStorage.setItem("sicou_remember_email", correo);
                } else {
                    localStorage.removeItem("sicou_remember_email");
                }

                
                // Guardar token y datos de sesión
                sessionStorage.setItem("sicou_token", datos.token);

                console.log("Token guardado:", sessionStorage.getItem("sicou_token"));
                console.log("Rol guardado:", datos.usuario.rol);
                
                sessionStorage.setItem("sicou_usuario", JSON.stringify(datos.usuario));

                mostrarMensaje(`¡Bienvenido/a, ${datos.usuario.nombre}! Redirigiendo...`, "exito");
                
                setTimeout(() => {
                    const rol = (datos.usuario.rol || "")
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .trim()
                        .replace(/\s+/g, "_");

                    console.log("Rol del usuario autenticado:", rol);

                    if (
                        rol === "administrador" ||
                        rol === "admin" ||
                        rol === "gerente_area" ||
                        rol === "gerente_de_area"
                    ) {
                        window.location.href = "areas.html";
                    } else {
                        window.location.href = "dashboard_alumno.html";
                    }
                }, 1200);
            } else {
                mostrarMensaje(datos.mensaje || datos.error || "Credenciales incorrectas", "error");
            }
        } catch (error) {
            console.warn("API no disponible, modo sin conexión:", error);
            mostrarMensaje("Servidor backend no detectado. Para conectar a PostgreSQL ejecuta: python server.py", "error");
        }
    });

    // Manejo de envío de REGISTRO
    formRegistro.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nombre = document.getElementById("regNombre").value.trim();
        const correo = document.getElementById("regCorreo").value.trim();
        const contrasena = document.getElementById("regPassword").value;
        const facultad_id = document.getElementById("regFacultad").value;

        if (!nombre || !correo || !contrasena || !facultad_id) {
            mostrarMensaje("Todos los datos y la selección de facultad son obligatorios.", "error");
            return;
        }

        try {
            const respuesta = await fetch("/api/registro", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre, correo, contrasena, facultad_id })
            });

            const datos = await respuesta.json();

            if (respuesta.ok && datos.ok) {
                mostrarMensaje("¡Usuario registrado con éxito! Ahora inicia sesión.", "exito");
                formRegistro.reset();

                setTimeout(() => {
                    seccionRegistro.classList.remove("activo");
                    seccionLogin.classList.add("activo");
                    document.getElementById("loginCorreo").value = correo;
                    document.getElementById("loginFacultad").value = facultad_id;
                }, 1500);
            } else {
                mostrarMensaje(datos.mensaje || datos.error || "Error al registrar usuario", "error");
            }
        } catch (error) {
            console.warn("API no disponible, modo sin conexión:", error);
            mostrarMensaje("Servidor backend no detectado. Para conectar a PostgreSQL ejecuta: python server.py", "error");
        }
    });
});
