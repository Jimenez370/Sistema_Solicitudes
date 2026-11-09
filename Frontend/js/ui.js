/* Shared accessible dialogs. User/API content is always rendered as text. */
(() => {
    "use strict";
    const icons = {"info": "<svg class=\"sicou-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6m0-10h.01\"/></svg>", "success": "<svg class=\"sicou-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"m5 12 4 4L19 6\"/></svg>", "warning": "<svg class=\"sicou-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"m12 3 10 18H2L12 3Z\"/><path d=\"M12 9v4m0 4h.01\"/></svg>", "error": "<svg class=\"sicou-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"m6 6 12 12M6 18 18 6\"/></svg>", "close": "<svg class=\"sicou-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"m6 6 12 12M6 18 18 6\"/></svg>"};
    let queue = Promise.resolve();
    const clean = value => String(value ?? "").replace(/[\p{Extended_Pictographic}\uFE0F\u2705\u2714\u2715]/gu, "").trim();
    function open(options) {
        return new Promise(resolve => {
            const previous = document.activeElement;
            const dialog = document.createElement("dialog");
            dialog.className = "sicou-dialog";
            dialog.setAttribute("aria-labelledby", "sicou-dialog-title");
            dialog.setAttribute("aria-describedby", "sicou-dialog-message");
            const kind = options.kind || "info";
            dialog.innerHTML = `<div class="sicou-dialog-heading"><span class="sicou-dialog-symbol ${kind}">${icons[kind] || icons.info}</span><button type="button" class="sicou-dialog-close" aria-label="Cerrar aviso">${icons.close}</button></div><h2 id="sicou-dialog-title"></h2><p id="sicou-dialog-message"></p><dl class="sicou-dialog-details"></dl><div class="sicou-dialog-actions"></div>`;
            dialog.querySelector("h2").textContent = options.title || "Aviso del sistema";
            dialog.querySelector("p").textContent = clean(options.message);
            const details = dialog.querySelector("dl");
            for (const [label, value] of options.details || []) {
                const group = document.createElement("div");
                const dt = document.createElement("dt"), dd = document.createElement("dd");
                dt.textContent = label; dd.textContent = clean(value);
                group.append(dt, dd); details.append(group);
            }
            details.hidden = !details.children.length;
            let finished = false;
            const finish = result => {
                if (finished) return;
                finished = true;
                dialog.close(); dialog.remove();
                if (previous?.isConnected) previous.focus();
                resolve(result);
            };
            const actions = dialog.querySelector(".sicou-dialog-actions");
            let cancel;
            if (options.confirm) {
                cancel = document.createElement("button");
                cancel.type = "button"; cancel.className = "sicou-dialog-secondary";
                cancel.textContent = "Volver"; cancel.onclick = () => finish(false);
                actions.append(cancel);
            }
            const accept = document.createElement("button");
            accept.type = "button"; accept.className = "sicou-dialog-primary";
            accept.textContent = options.confirm ? "Sí, cancelar solicitud" : "Aceptar";
            accept.onclick = () => finish(true); actions.append(accept);
            dialog.querySelector(".sicou-dialog-close").onclick = () => finish(false);
            dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
            dialog.addEventListener("keydown", event => {
                if (event.key !== "Tab") return;
                const buttons = [...dialog.querySelectorAll("button")];
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            });
            document.body.append(dialog);
            dialog.showModal();
            (cancel || accept).focus();
        });
    }
    function enqueue(options) {
        const pending = queue.then(() => open(options));
        queue = pending.catch(() => {});
        return pending;
    }
    window.SicouUI = {
        alert(message) {
            const text = clean(message);
            const kind = /error|no se pudo|no se puede|no se encontró|denegado/i.test(text) ? "error"
                : /correctamente|éxito/i.test(text) ? "success" : "info";
            return enqueue({message: text, kind, title: kind === "error" ? "No se pudo completar la acción" : kind === "success" ? "Operación completada" : "Aviso del sistema"});
        },
        confirm(message) { return enqueue({message, confirm: true, kind: "warning", title: "Cancelar solicitud"}); },
        solicitud(id, analysis) {
            const confidence = Number(analysis.confianza);
            return enqueue({kind: "success", title: "Solicitud enviada", message: "Tu solicitud fue registrada y está disponible para el departamento correspondiente y el administrador.", details: [
                ["Folio", `SOL-${String(id).padStart(3, "0")}`], ["Categoría", analysis.categoria],
                ["Prioridad", analysis.prioridad], ["Departamento destino", analysis.canal],
                ["Confianza del análisis", Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : "No disponible"]
            ]});
        }
    };
})();
