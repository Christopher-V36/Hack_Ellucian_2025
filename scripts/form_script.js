document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('cuestionario-form');
    const secciones = ['seccion1', 'seccion2', 'seccion3', 'seccion4', 'seccion5'];
    let seccionActual = 0;
    const btnAnterior = document.getElementById('btn-anterior');
    const btnSiguiente = document.getElementById('btn-siguiente');
    
    btnAnterior.style.display = 'none';

    function cambiarSeccion(direccion) {
        document.getElementById(secciones[seccionActual]).style.display = 'none';
        seccionActual += direccion;
        document.getElementById(secciones[seccionActual]).style.display = 'block';

        if (seccionActual === 0) {
            btnAnterior.style.display = 'none';
        } else {
            btnAnterior.style.display = 'inline';
        }

        if (seccionActual === secciones.length - 1) {
            btnSiguiente.style.display = 'none';
        } else {
            btnSiguiente.style.display = 'inline';
        }
    }
    
    document.getElementById('btn-anterior').addEventListener('click', () => cambiarSeccion(-1));
    document.getElementById('btn-siguiente').addEventListener('click', () => cambiarSeccion(1));


    formulario.addEventListener('submit', async function(e) {
        e.preventDefault();

        const datos = {};
        const formData = new FormData(formulario);
        formData.forEach((valor, clave) => {
            datos[clave] = valor;
        });

        try {
            const respuesta = await fetch('http://localhost:3000/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datos)
            });

            if (respuesta.ok) {
                alert('¡Respuestas enviadas correctamente al proyecto colaborativo! 😊');
                formulario.reset();
            } else {
                alert('Hubo un error al enviar las respuestas.');
            }
        } catch (error) {
            alert('No se pudo conectar con el servidor. Asegúrate de que esté encendido.');
        }
    });
});