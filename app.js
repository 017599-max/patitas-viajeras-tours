

/* =========================================
   1. FIREBASE Y CONFIGURACIÓN
========================================= */

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const COLECCION_RESERVAS = "reservas";

const camposCostos = [
    "vuelos",
    "hospedaje",
    "traslado",
    "asientos",
    "tua"
];

const formLogin = document.getElementById("formLogin");
const pantallaLogin = document.getElementById("pantallaLogin");
const aplicacion = document.getElementById("aplicacion");
const mensajeLogin = document.getElementById("mensajeLogin");

const formReserva = document.getElementById("formReserva");
const botonGuardar = document.getElementById("guardarReserva");
const botonCancelar = document.getElementById("cancelarEdicion");
const botonExportar = document.getElementById("exportarExcel");
const botonCerrarSesion = document.getElementById("cerrarSesion");

const tablaReservas = document.getElementById("tablaReservas");
const campoBusqueda = document.getElementById("buscarReserva");

let reservas = [];
let reservaEnEdicionId = null;
let detenerEscuchaReservas = null;
let usuarioAutenticado = null;


/* =========================================
   2. INICIO DE SESIÓN CON FIREBASE
========================================= */

formLogin.addEventListener("submit", async function(event) {
    event.preventDefault();

    const correo = document.getElementById("usuario").value.trim();
    const contrasena = document.getElementById("contrasena").value;

    mensajeLogin.textContent = "Iniciando sesión...";

    try {
        await signInWithEmailAndPassword(auth, correo, contrasena);

        mensajeLogin.textContent = "";
        formLogin.reset();
    } catch (error) {
        console.error("Error de inicio de sesión:", error);

        mensajeLogin.textContent =
            "Correo o contraseña incorrectos. Verifica tus datos.";
    }
});

onAuthStateChanged(auth, function(usuario) {
    usuarioAutenticado = usuario;

    if (usuario) {
        pantallaLogin.hidden = true;
        aplicacion.hidden = false;
        mensajeLogin.textContent = "";

        escucharReservas();
    } else {
        if (detenerEscuchaReservas) {
            detenerEscuchaReservas();
            detenerEscuchaReservas = null;
        }

        reservas = [];
        mostrarReservas();

        cancelarEdicion();

        aplicacion.hidden = true;
        pantallaLogin.hidden = false;
    }
});

botonCerrarSesion.addEventListener("click", async function() {
    try {
        cancelarEdicion();
        await signOut(auth);
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error(error);
        alert("No se pudo cerrar la sesión. Intenta nuevamente.");
    }
});


/* =========================================
   3. FORMATO DE MONEDA
========================================= */

function formatoMoneda(cantidad) {
    return Number(cantidad || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
    });
}


/* =========================================
   4. ESCUCHAR RESERVAS EN FIRESTORE
========================================= */

function escucharReservas() {
    if (detenerEscuchaReservas) {
        detenerEscuchaReservas();
    }

    const referenciaReservas = collection(db, COLECCION_RESERVAS);

    detenerEscuchaReservas = onSnapshot(
        referenciaReservas,
        function(snapshot) {
            reservas = snapshot.docs.map(documento => {
                const datos = documento.data();

                const vuelos = Number(datos.vuelos) || 0;
                const hospedaje = Number(datos.hospedaje) || 0;
                const traslado = Number(datos.traslado) || 0;
                const asientos = Number(datos.asientos) || 0;
                const tua = Number(datos.tua) || 0;

                return {
                    ...datos,
                    id: documento.id,
                    numero: String(datos.numero || ""),
                    vuelos,
                    hospedaje,
                    traslado,
                    asientos,
                    tua,
                    total: vuelos + hospedaje + traslado + asientos + tua,
                    estado: ["Pendiente", "Confirmada", "Cancelada"]
                        .includes(datos.estado)
                        ? datos.estado
                        : "Pendiente"
                };
            });

            mostrarReservas();
            actualizarResumen();
        },
        function(error) {
            console.error("Error al leer Firestore:", error);

            alert(
                "No se pudieron cargar las reservas de la nube. " +
                "Verifica las reglas de Firestore y tu conexión."
            );
        }
    );
}


/* =========================================
   5. CÁLCULO AUTOMÁTICO DEL TOTAL
========================================= */

function calcularTotal() {
    let total = 0;

    camposCostos.forEach(id => {
        const valor = Number(document.getElementById(id).value) || 0;
        total += valor;
    });

    document.getElementById("total").textContent = formatoMoneda(total);

    return total;
}

camposCostos.forEach(id => {
    document.getElementById(id).addEventListener("input", calcularTotal);
});

calcularTotal();


/* =========================================
   6. RESUMEN DEL PANEL
========================================= */

function actualizarResumen() {
    const confirmadas = reservas.filter(
        reserva => reserva.estado === "Confirmada"
    ).length;

    const pendientes = reservas.filter(
        reserva => reserva.estado === "Pendiente"
    ).length;

    const importe = reservas
        .filter(reserva => reserva.estado !== "Cancelada")
        .reduce((suma, reserva) => suma + Number(reserva.total || 0), 0);

    document.getElementById("totalReservas").textContent = reservas.length;
    document.getElementById("reservasConfirmadas").textContent = confirmadas;
    document.getElementById("reservasPendientes").textContent = pendientes;
    document.getElementById("importeTotal").textContent = formatoMoneda(importe);
}


/* =========================================
   7. CREAR BOTONES
========================================= */

function crearBoton(texto, clase, accion) {
    const boton = document.createElement("button");

    boton.type = "button";
    boton.textContent = texto;
    boton.className = "boton " + clase;
    boton.addEventListener("click", accion);

    return boton;
}


/* =========================================
   8. MOSTRAR Y BUSCAR RESERVAS
========================================= */

function mostrarReservas() {
    tablaReservas.innerHTML = "";

    const busqueda = campoBusqueda.value.trim().toLowerCase();

    const filtradas = reservas.filter(reserva =>
        reserva.numero.toLowerCase().includes(busqueda)
    );

    if (filtradas.length === 0) {
        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 9;
        celda.textContent = busqueda
            ? "No se encontraron reservas."
            : "Todavía no hay reservas registradas.";

        fila.appendChild(celda);
        tablaReservas.appendChild(fila);
        actualizarResumen();
        return;
    }

    filtradas.forEach(reserva => {
        const fila = document.createElement("tr");

        const valores = [
            reserva.numero,
            formatoMoneda(reserva.vuelos),
            formatoMoneda(reserva.hospedaje),
            formatoMoneda(reserva.traslado),
            formatoMoneda(reserva.asientos),
            formatoMoneda(reserva.tua),
            formatoMoneda(reserva.total)
        ];

        valores.forEach(valor => {
            const celda = document.createElement("td");
            celda.textContent = valor;
            fila.appendChild(celda);
        });

        // ESTADO
        const celdaEstado = document.createElement("td");
        const etiquetaEstado = document.createElement("span");

        etiquetaEstado.className =
            "estado estado-" + reserva.estado.toLowerCase();

        etiquetaEstado.textContent = reserva.estado;
        celdaEstado.appendChild(etiquetaEstado);

        const selectorEstado = document.createElement("select");

        selectorEstado.setAttribute(
            "aria-label",
            "Cambiar estado de " + reserva.numero
        );

        ["Pendiente", "Confirmada", "Cancelada"].forEach(estado => {
            const opcion = document.createElement("option");
            opcion.value = estado;
            opcion.textContent = estado;
            selectorEstado.appendChild(opcion);
        });

        selectorEstado.value = reserva.estado;
        selectorEstado.style.marginTop = "8px";
        selectorEstado.style.minWidth = "125px";

        selectorEstado.addEventListener("change", async function() {
            selectorEstado.disabled = true;

            try {
                await updateDoc(
                    doc(db, COLECCION_RESERVAS, reserva.id),
                    { estado: selectorEstado.value }
                );
            } catch (error) {
                console.error(error);
                alert("No se pudo actualizar el estado de la reserva.");
                mostrarReservas();
            } finally {
                selectorEstado.disabled = false;
            }
        });

        celdaEstado.appendChild(selectorEstado);
        fila.appendChild(celdaEstado);

        // ACCIONES
        const celdaAcciones = document.createElement("td");
        const contenedorAcciones = document.createElement("div");

        contenedorAcciones.className = "acciones-tabla";

        const botonEditar = crearBoton("Editar", "boton-editar", function() {
            cargarEnFormulario(reserva.id);
        });

        const botonPDF = crearBoton("Recibo PDF", "boton-pdf", function() {
            generarPDF(reserva.id);
        });

        const botonEliminar = crearBoton(
            "Eliminar",
            "boton-eliminar",
            async function() {
                const confirmar = confirm(
                    "¿Deseas eliminar la reserva " + reserva.numero + "?"
                );

                if (!confirmar) return;

                botonEliminar.disabled = true;

                try {
                    await deleteDoc(
                        doc(db, COLECCION_RESERVAS, reserva.id)
                    );

                    if (reservaEnEdicionId === reserva.id) {
                        cancelarEdicion();
                    }

                    alert("Reserva eliminada correctamente.");
                } catch (error) {
                    console.error(error);
                    alert("No se pudo eliminar la reserva.");
                    botonEliminar.disabled = false;
                }
            }
        );

        contenedorAcciones.append(
            botonEditar,
            botonPDF,
            botonEliminar
        );

        celdaAcciones.appendChild(contenedorAcciones);
        fila.appendChild(celdaAcciones);
        tablaReservas.appendChild(fila);
    });

    actualizarResumen();
}

campoBusqueda.addEventListener("input", mostrarReservas);


/* =========================================
   9. CARGAR RESERVA PARA EDITAR
========================================= */

function cargarEnFormulario(id) {
    const reserva = reservas.find(item => item.id === id);

    if (!reserva) {
        alert("No se encontró esa reserva. Actualiza la lista e intenta otra vez.");
        return;
    }

    document.getElementById("numeroReserva").value = reserva.numero;
    document.getElementById("estado").value = reserva.estado;

    camposCostos.forEach(idCampo => {
        document.getElementById(idCampo).value = reserva[idCampo];
    });

    reservaEnEdicionId = id;
    botonGuardar.textContent = "Actualizar reserva";
    botonCancelar.hidden = false;

    document.getElementById("tituloFormulario").textContent =
        "Editar reserva " + reserva.numero;

    calcularTotal();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================
   10. CANCELAR EDICIÓN
========================================= */

function cancelarEdicion() {
    reservaEnEdicionId = null;
    formReserva.reset();

    camposCostos.forEach(id => {
        document.getElementById(id).value = "0";
    });

    document.getElementById("estado").value = "Pendiente";
    botonGuardar.textContent = "Guardar reserva";
    botonCancelar.hidden = true;

    document.getElementById("tituloFormulario").textContent =
        "Registrar nueva reserva";

    calcularTotal();
}

botonCancelar.addEventListener("click", cancelarEdicion);


/* =========================================
   11. GUARDAR O ACTUALIZAR EN FIRESTORE
========================================= */

formReserva.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!usuarioAutenticado) {
        alert("Inicia sesión para guardar reservas.");
        return;
    }

    const numero = document.getElementById("numeroReserva").value.trim();
    const estado = document.getElementById("estado").value;

    if (!numero) {
        alert("Escribe el número de reserva.");
        return;
    }

    const originales = camposCostos.map(id =>
        document.getElementById(id).value.trim()
    );

    if (originales.some(valor => valor === "")) {
        alert("Completa todos los costos. Si alguno es cero, escribe 0.");
        return;
    }

    const valores = originales.map(Number);

    if (valores.some(valor =>
        !Number.isFinite(valor) || valor < 0
    )) {
        alert("Los costos deben ser números iguales o mayores a cero.");
        return;
    }

    const duplicada = reservas.some(reserva =>
        reserva.id !== reservaEnEdicionId &&
        reserva.numero.toLowerCase() === numero.toLowerCase()
    );

    if (duplicada) {
        alert("Ese número de reserva ya existe.");
        return;
    }

    const reservaNueva = {
        numero,
        vuelos: valores[0],
        hospedaje: valores[1],
        traslado: valores[2],
        asientos: valores[3],
        tua: valores[4],
        total: valores.reduce((suma, valor) => suma + valor, 0),
        estado
    };

    const estabaEditando = reservaEnEdicionId !== null;

    botonGuardar.disabled = true;

    try {
        if (estabaEditando) {
            await updateDoc(
                doc(db, COLECCION_RESERVAS, reservaEnEdicionId),
                reservaNueva
            );
        } else {
            await addDoc(
                collection(db, COLECCION_RESERVAS),
                reservaNueva
            );
        }

        cancelarEdicion();

        alert(estabaEditando
            ? "¡Reserva actualizada correctamente!"
            : "¡Reserva guardada correctamente!");
    } catch (error) {
        console.error("Error al guardar:", error);

        alert(
            "No se pudo guardar la reserva en la nube. " +
            "Verifica tu conexión y las reglas de Firestore."
        );
    } finally {
        botonGuardar.disabled = false;
    }
});


/* =========================================
   12. GENERAR RECIBO PDF
========================================= */

function generarPDF(id) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("No se pudo cargar la biblioteca PDF. Revisa tu conexión a internet.");
        return;
    }

    const reserva = reservas.find(item => item.id === id);

    if (!reserva) {
        alert("No se encontró la reserva.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const documento = new jsPDF();

    documento.setFont("helvetica", "bold");
    documento.setFontSize(19);
    documento.text("COMPROBANTE DE RESERVA", 20, 22);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(11);
    documento.text("Sistema de Control de Reservas", 20, 32);
    documento.text(
        "Fecha de emisión: " + new Date().toLocaleDateString("es-MX"),
        20,
        40
    );

    documento.setDrawColor(36, 91, 145);
    documento.line(20, 46, 190, 46);

    documento.setFont("helvetica", "bold");
    documento.text("Número de reserva:", 20, 58);
    documento.setFont("helvetica", "normal");
    documento.text(String(reserva.numero), 75, 58);

    documento.setFont("helvetica", "bold");
    documento.text("Estado:", 20, 68);
    documento.setFont("helvetica", "normal");
    documento.text(String(reserva.estado), 75, 68);

    const conceptos = [
        ["Vuelos", reserva.vuelos],
        ["Hospedaje", reserva.hospedaje],
        ["Traslado", reserva.traslado],
        ["Asientos", reserva.asientos],
        ["TUA", reserva.tua]
    ];

    let y = 88;

    documento.setFont("helvetica", "bold");
    documento.text("Concepto", 20, y);
    documento.text("Importe (MXN)", 140, y);
    documento.line(20, y + 4, 190, y + 4);

    y += 14;
    documento.setFont("helvetica", "normal");

    conceptos.forEach(([concepto, importe]) => {
        documento.text(concepto, 20, y);

        documento.text(
            Number(importe).toLocaleString("es-MX", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }),
            190,
            y,
            { align: "right" }
        );

        y += 11;
    });

    documento.line(20, y, 190, y);
    y += 13;

    documento.setFont("helvetica", "bold");
    documento.setFontSize(14);
    documento.text("TOTAL:", 20, y);
    documento.text(
        formatoMoneda(reserva.total),
        190,
        y,
        { align: "right" }
    );

    y += 20;

    documento.setFont("helvetica", "normal");
    documento.setFontSize(10);
    documento.text(
        "Este documento es un comprobante informativo de los costos registrados.",
        20,
        y,
        { maxWidth: 170 }
    );

    const nombreArchivo = String(reserva.numero)
        .replace(/[^a-zA-Z0-9_-]/g, "_");

    documento.save("Recibo_" + nombreArchivo + ".pdf");
}


/* =========================================
   13. EXPORTAR RESERVAS A EXCEL
========================================= */

botonExportar.addEventListener("click", function() {
    if (!window.XLSX) {
        alert("No se pudo cargar la biblioteca de Excel. Revisa tu conexión a internet.");
        return;
    }

    if (reservas.length === 0) {
        alert("No hay reservas para exportar.");
        return;
    }

    const datosExcel = reservas.map(reserva => ({
        "Número de reserva": reserva.numero,
        "Vuelos (MXN)": Number(reserva.vuelos),
        "Hospedaje (MXN)": Number(reserva.hospedaje),
        "Traslado (MXN)": Number(reserva.traslado),
        "Asientos (MXN)": Number(reserva.asientos),
        "TUA (MXN)": Number(reserva.tua),
        "Total (MXN)": Number(reserva.total),
        "Estado": reserva.estado
    }));

    const hoja = window.XLSX.utils.json_to_sheet(datosExcel);

    hoja["!cols"] = [
        { wch: 22 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 }
    ];

    const libro = window.XLSX.utils.book_new();

    window.XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Reservas"
    );

    window.XLSX.writeFile(libro, "Reporte_Reservas.xlsx");
});


/* =========================================
   14. INICIAR EL SISTEMA
========================================= */

mostrarReservas();
actualizarResumen();
