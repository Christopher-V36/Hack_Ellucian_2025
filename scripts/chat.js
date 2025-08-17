const chatBox = document.getElementById('chat-box');
const userInputField = document.getElementById('user-input');
const sendBtn = document.getElementById('send-button');
const cardList = document.getElementById('card-list');
const loadingOptionsIndicator = document.getElementById('loading-options');
const noSuggestionsMessage = document.getElementById('no-suggestions');

let chatHistory = []; // Almacena los mensajes de la conversación (solo en el frontend)
let suggestedOptions = []; // Almacena las sugerencias de carrera (solo en el frontend)

// --- Perfil de Estudiante Simulado y User ID ---
// Como el formulario vocacional aún no está implementado o conectado a una DB,
// usamos datos por defecto para simular un estudiante y un ID único temporal.
// Este perfil se enviará al backend para que Gemini tenga contexto.
const simulatedUserId = "user-html-temp-12345"; // ID de usuario temporal para probar
let simulatedStudentProfile = {
    name: 'Joss', // Nombre por defecto para el mensaje de bienvenida
    age: 20,
    interests: ['tecnología', 'diseño', 'música'],
    skills: ['resolución de problemas', 'creatividad', 'comunicación'],
    preferences: {} // Preferencias adicionales que se podrían aprender del chat
};

// --- Funciones de Interfaz de Usuario (UI) ---

/**
 * Agrega y muestra un nuevo mensaje en la caja de chat.
 * Aplica clases CSS para diferenciar mensajes del usuario y del bot y manejar el scroll.
 * @param {string} sender - 'user' si el mensaje es del usuario, 'bot' si es del asistente.
 * @param {string} message - El contenido del mensaje a mostrar.
 */
function displayMessage(sender, message) {
    const messageDiv = document.createElement('div');
    // Las clases 'chat-message-user' y 'chat-message-bot' deben estar definidas
    // en tu archivo de estilos (ej. estilo.css o en un bloque <style> en tu HTML).
    // Las clases 'max-w-[70%]', 'p-3', 'rounded-lg', 'shadow-sm', 'ml-auto', 'mr-auto'
    // son de Tailwind CSS y asumen que Tailwind está cargado.
    messageDiv.className = `max-w-[70%] p-3 rounded-lg shadow-sm ${
        sender === 'user' ? 'chat-message-user ml-auto' : 'chat-message-bot mr-auto'
    }`;
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; // Hace scroll automático al final del chat
}

/**
 * Actualiza la lista de sugerencias de carrera en el panel lateral.
 * Limpia las tarjetas existentes y las vuelve a dibujar con las nuevas opciones.
 * @param {Array<Object>} options - Un array de objetos, donde cada objeto representa una carrera sugerida
 * y contiene al menos 'name', 'percentageMatch' y 'reason'.
 */
function displaySuggestions(options) {
    cardList.innerHTML = ''; // Limpia todas las tarjetas actuales en el panel
    if (options.length === 0) {
        // Muestra el mensaje "No hay sugerencias" si la lista está vacía
        noSuggestionsMessage.classList.remove('hidden');
        return;
    }
    noSuggestionsMessage.classList.add('hidden'); // Oculta el mensaje si hay sugerencias

    // Itera sobre las opciones y crea un elemento de tarjeta para cada una
    options.forEach((option, index) => {
        const cardDiv = document.createElement('div');
        // Clases de Tailwind para el estilo visual de la tarjeta
        cardDiv.className = 'card p-4 bg-blue-50 rounded-lg shadow-sm border border-blue-200';
        cardDiv.innerHTML = `
            <h3 class="text-lg font-bold text-blue-800 mb-1">${option.name}</h3>
            <p class="text-gray-700 text-sm">${option.reason}</p>
            <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${option.percentageMatch || 0}%;"></div>
            </div>
            <span class="text-sm font-medium text-blue-700 mt-2 block">
                ${option.percentageMatch || 0}% de Coincidencia
            </span>
            <a href="Segunda_pag.html" class="mt-3 w-full inline-block text-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out">
                Ver Detalles
            </a>
        `;
        cardList.appendChild(cardDiv); // Agrega la tarjeta al contenedor de la lista
    });
}

// --- Lógica Principal del Chat y Comunicación con Backend ---

/**
 * Función asincrónica para enviar el mensaje del usuario al backend.
 * Maneja el estado de la UI (deshabilitar input/botón, mostrar spinners)
 * y actualiza el chat y las sugerencias con la respuesta del backend.
 */
async function sendMessage() {
    const message = userInputField.value.trim();
    if (message === '') return; // No hacer nada si el campo de entrada está vacío

    // 1. Mostrar el mensaje del usuario en el chat inmediatamente
    displayMessage('user', message);
    chatHistory.push({ sender: 'user', message: message }); // Añadir al historial local
    userInputField.value = ''; // Limpiar el campo de entrada

    // 2. Deshabilitar la interfaz de usuario para evitar múltiples envíos
    // y mostrar indicadores de carga.
    userInputField.disabled = true;
    sendBtn.disabled = true;
    loadingOptionsIndicator.classList.remove('hidden'); // Muestra el spinner de opciones
    
    // Añadir un spinner visual al final del chat para indicar que el bot está "pensando"
    const loadingSpinnerChat = document.createElement('div');
    loadingSpinnerChat.className = 'flex justify-center items-center p-3';
    loadingSpinnerChat.innerHTML = '<div class="loading-spinner"></div>';
    chatBox.appendChild(loadingSpinnerChat);
    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll para ver el spinner

    try {
        // 3. Realizar la llamada HTTP (fetch) al endpoint /chat de tu backend de Node.js.
        // Se envía el userId simulado, el mensaje actual y el perfil/historial para contexto de Gemini.
        const response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: simulatedUserId, // ID único para el backend (para persistencia o en memoria)
                message: message, // El mensaje que el usuario acaba de escribir
                studentProfile: simulatedStudentProfile, // Perfil del estudiante (para contexto de Gemini)
                chatHistory: chatHistory // Historial de conversación (para contexto de Gemini)
            }),
        });

        // 4. Verificar si la respuesta del backend fue exitosa (código de estado 200-299)
        if (!response.ok) {
            const errorBody = await response.json(); // Intentar leer el cuerpo del error
            throw new Error(`Error HTTP: ${response.status} - ${errorBody.error || 'Unknown error'}`);
        }

        // 5. Procesar la respuesta JSON del backend (que contiene el mensaje del bot y las sugerencias)
        const data = await response.json();

        // 6. Eliminar el spinner de carga del chat
        if (chatBox.contains(loadingSpinnerChat)) {
            chatBox.removeChild(loadingSpinnerChat);
        }

        // 7. Mostrar la respuesta del bot en el chat y actualizar el historial local
        displayMessage('bot', data.botMessage);
        chatHistory.push({ sender: 'bot', message: data.botMessage });
        
        // 8. Actualizar las sugerencias de carrera en el panel lateral
        suggestedOptions = data.suggestedOptions;
        displaySuggestions(suggestedOptions);

        // 9. Opcional: Si el backend envía un perfil de estudiante actualizado, actualizamos nuestra copia local.
        if (data.updatedStudentProfile) {
            simulatedStudentProfile = data.updatedStudentProfile;
        }

    } catch (error) {
        // Manejo de errores durante la comunicación con el backend o la API de Gemini
        console.error('Error al enviar mensaje al backend:', error);
        // Asegurarse de que el spinner se elimine incluso en caso de error
        if (chatBox.contains(loadingSpinnerChat)) {
            chatBox.removeChild(loadingSpinnerChat);
        }
        // Mostrar un mensaje de error amigable al usuario en el chat
        displayMessage('bot', 'Lo siento, hubo un error al procesar tu solicitud. Por favor, asegúrate de que el backend esté corriendo y la clave de API sea válida. Error: ' + (error.message || ''));
    } finally {
        // 10. Volver a habilitar la interfaz de usuario y ocultar los spinners
        userInputField.disabled = false;
        sendBtn.disabled = false;
        loadingOptionsIndicator.classList.add('hidden');
    }
}

// --- Event Listeners para la interacción del usuario ---
// Asigna la función sendMessage al evento click del botón "Enviar"
sendBtn.addEventListener('click', sendMessage);

// Asigna la función sendMessage al evento keypress (cuando se presiona Enter) en el campo de texto
userInputField.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') { // Detecta si la tecla presionada fue 'Enter'
        sendMessage();
    }
});

// --- Función de Inicialización al Cargar la Página ---
// Se ejecuta una vez que todo el contenido del DOM está cargado y listo.
window.onload = () => {
    // Elimina el párrafo de placeholder inicial del chatbox ("Aquí se mostrarán los mensajes del chat.")
    const initialParagraph = chatBox.querySelector('p');
    if (initialParagraph) {
        chatBox.removeChild(initialParagraph);
    }
    // Muestra un mensaje de bienvenida del bot al iniciar la aplicación
    displayMessage('bot', `¡Hola, ${simulatedStudentProfile.name}! Muchas gracias por compartir tus intereses conmigo. Soy tu asesor vocacional. Ya me has brindado un buen panorama sobre ti, pero quisiera conocer más sobre tus intereses y lo que te gustaría explorar.`);
    // Muestra las sugerencias iniciales (si las hubiera, o el mensaje de "No hay sugerencias")
    displaySuggestions(suggestedOptions);
};
