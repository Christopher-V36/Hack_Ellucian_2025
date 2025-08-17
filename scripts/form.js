document.addEventListener('DOMContentLoaded', function() {
      const formulario   = document.getElementById('cuestionario-form');
      const secciones    = ['seccion1', 'seccion2', 'seccion3', 'seccion4', 'seccion5'];
      let seccionActual  = 0;

      const btnAnterior  = document.getElementById('btn-anterior');
      const btnSiguiente = document.getElementById('btn-siguiente');
      const btnSubmit    = document.getElementById('btn-submit');

      const loadingOverlay = document.getElementById('loading-overlay');
      const loadingSpinner = document.getElementById('loading-spinner');
      const successIcon    = document.getElementById('success-icon');
      const loadingText    = document.getElementById('loading-text');
      const loadingSubtext = document.getElementById('loading-subtext');

      // ==== NAV LATERAL: construir usando los h2 de cada sección ====
      const navContenedor = document.getElementById('secciones-nav');

      function obtenerTitulosSecciones() {
        return secciones.map(id => {
          const h2 = document.querySelector('#' + id + ' h2');
          return h2 ? h2.textContent.trim() : id;
        });
      }

      function construirSidebar() {
        if (!navContenedor) return;
        const titulos = obtenerTitulosSecciones();

        navContenedor.innerHTML = '';
        const lista = document.createElement('ul');
        lista.className = 'sidebar-list';

        titulos.forEach((titulo, index) => {
          const li = document.createElement('li');
          li.className = 'sidebar-item';

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'sidebar-link';
          btn.textContent = titulo;
          btn.setAttribute('data-index', String(index));
          btn.addEventListener('click', () => irASeccion(index));

          li.appendChild(btn);
          lista.appendChild(li);
        });

        navContenedor.appendChild(lista);
        actualizarActivoSidebar();
      }

      function actualizarActivoSidebar() {
        if (!navContenedor) return;
        const botones = navContenedor.querySelectorAll('.sidebar-link');
        botones.forEach((b, i) => {
          if (i === seccionActual) {
            b.classList.add('active');
            b.setAttribute('aria-current', 'true');
          } else {
            b.classList.remove('active');
            b.removeAttribute('aria-current');
          }
        });
      }

      function actualizarBotones() {
        btnAnterior.style.display = seccionActual === 0 ? 'none' : 'inline-block';
        if (seccionActual === secciones.length - 1) {
          btnSiguiente.style.display = 'none';
          btnSubmit.style.display = 'inline-block';
        } else {
          btnSiguiente.style.display = 'inline-block';
          btnSubmit.style.display = 'none';
        }
      }

      function ocultarTodas() {
        secciones.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
      }

      function mostrarSeccionActual() {
        const el = document.getElementById(secciones[seccionActual]);
        if (el) el.style.display = 'block';
        actualizarBotones();
        actualizarActivoSidebar();
        // sube al inicio del contenedor visible
        window.scrollTo({ top: 0, behavior: 'auto' });
      }

      function cambiarSeccion(delta) {
        const nueva = seccionActual + delta;
        if (nueva < 0 || nueva >= secciones.length) return;
        ocultarTodas();
        seccionActual = nueva;
        mostrarSeccionActual();
      }

      function irASeccion(indice) {
        if (indice < 0 || indice >= secciones.length || indice === seccionActual) return;
        ocultarTodas();
        seccionActual = indice;
        mostrarSeccionActual();
      }

      // Botones prev/next
      btnAnterior.addEventListener('click', () => cambiarSeccion(-1));
      btnSiguiente.addEventListener('click', () => cambiarSeccion(1));

      // Init
      ocultarTodas();
      const primera = document.getElementById(secciones[0]);
      if (primera) primera.style.display = 'block';
      construirSidebar();
      actualizarBotones();

      // ====== Overlay ======
      function mostrarPantallaCarga() {
        loadingOverlay.style.display = 'flex';
        loadingSpinner.style.display = 'block';
        successIcon.style.display = 'none';
        loadingText.textContent = 'Guardando respuestas...';
        loadingSubtext.textContent = 'Por favor espera un momento';
      }

      function mostrarExito() {
        loadingSpinner.style.display = 'none';
        successIcon.style.display = 'block';
        loadingText.textContent = '¡Respuestas guardadas!';
        loadingSubtext.textContent = 'Redirigiendo...';
      }

      function ocultarPantallaCarga() {
        loadingOverlay.style.display = 'none';
      }

      // ====== Submit ======
      formulario.addEventListener('submit', async function(e) {
        e.preventDefault();

        const datos = {};
        for (let i = 1; i <= 18; i++) {
          const pregunta = `pregunta${i}`;
          if ([3, 7, 12, 15, 18].includes(i)) {
            const textarea = document.querySelector(`textarea[name="${pregunta}"]`);
            datos[pregunta] = textarea ? textarea.value.trim() : '';
          } else {
            const radioSeleccionado = document.querySelector(`input[name="${pregunta}"]:checked`);
            datos[pregunta] = radioSeleccionado ? radioSeleccionado.value : '';
          }
        }

        const respuestasVacias = [];
        for (let i = 1; i <= 18; i++) {
          const pregunta = `pregunta${i}`;
          if (!datos[pregunta]) respuestasVacias.push(i);
        }

        if (respuestasVacias.length > 0) {
          alert(`Por favor responde todas las preguntas. Faltan: ${respuestasVacias.join(', ')}`);
          return;
        }

        mostrarPantallaCarga();

        try {
          const respuesta = await fetch('http://localhost:3000/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
          });

          if (respuesta.ok) {
            setTimeout(() => {
              mostrarExito();
              setTimeout(() => { window.location.href = 'chat.html'; }, 2000);
            }, 3000);
          } else {
            const errorText = await respuesta.text();
            ocultarPantallaCarga();
            alert('Hubo un error al enviar las respuestas: ' + errorText);
          }
        } catch (error) {
          ocultarPantallaCarga();
          alert('No se pudo conectar con el servidor. Asegúrate de que esté encendido.');
        }
      });
    });