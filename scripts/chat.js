const chatBox = document.getElementById('chat-box');
const userInputField = document.getElementById('user-input');
const sendBtn = document.getElementById('send-button');
const cardList = document.getElementById('card-list');
const loadingOptionsIndicator = document.getElementById('loading-options');
const noSuggestionsMessage = document.getElementById('no-suggestions');

let chatHistory = []; 
let suggestedOptions = []; 

const simulatedUserId = "user-html-temp-12345"; 
let simulatedStudentProfile = {
    name: 'Joss', 
    age: 20,
    interests: ['tecnología', 'diseño', 'música'],
    skills: ['resolución de problemas', 'creatividad', 'comunicación'],
    preferences: {} 
};


/**
 * Agrega y muestra un nuevo mensaje en la caja de chat.
 * Aplica clases CSS para diferenciar mensajes del usuario y del bot y manejar el scroll.
 * @param {string} sender - 
 * @param {string} message 
 */
function displayMessage(sender, message) {
    const messageDiv = document.createElement('div');
 
    messageDiv.className = `max-w-[70%] p-3 rounded-lg shadow-sm ${
        sender === 'user' ? 'chat-message-user ml-auto' : 'chat-message-bot mr-auto'
    }`;
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight; 
}

/**
 * Actualiza la lista de sugerencias de carrera en el panel lateral.
 * Limpia las tarjetas existentes y las vuelve a dibujar con las nuevas opciones.
 * @param {Array<Object>} options - Un array de objetos, donde cada objeto representa una carrera sugerida
 * y contiene al menos 'name', 'percentageMatch' y 'reason'.
 */
function displaySuggestions(options) {
    cardList.innerHTML = ''; 
    if (options.length === 0) {
        noSuggestionsMessage.classList.remove('hidden');
        return;
    }
    noSuggestionsMessage.classList.add('hidden'); 


    options.forEach((option, index) => {
        const cardDiv = document.createElement('div');
        
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


async function sendMessage() {
    const message = userInputField.value.trim();
    if (message === '') return; 

    // 1. Mostrar el mensaje del usuario en el chat inmediatamente
    displayMessage('user', message);
    chatHistory.push({ sender: 'user', message: message }); 
    userInputField.value = '';

 
    userInputField.disabled = true;
    sendBtn.disabled = true;
    loadingOptionsIndicator.classList.remove('hidden'); 
    

    const loadingSpinnerChat = document.createElement('div');
    loadingSpinnerChat.className = 'flex justify-center items-center p-3';
    loadingSpinnerChat.innerHTML = '<div class="loading-spinner"></div>';
    chatBox.appendChild(loadingSpinnerChat);
    chatBox.scrollTop = chatBox.scrollHeight; 

    try {
 
        const response = await fetch('http://localhost:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: simulatedUserId, 
                message: message,
                studentProfile: simulatedStudentProfile, 
                chatHistory: chatHistory 
            }),
        });

        // 4. Verificar si la respuesta del backend fue exitosa (código de estado 200-299)
        if (!response.ok) {
            const errorBody = await response.json(); 
            throw new Error(`Error HTTP: ${response.status} - ${errorBody.error || 'Unknown error'}`);
        }

        const data = await response.json();

        if (chatBox.contains(loadingSpinnerChat)) {
            chatBox.removeChild(loadingSpinnerChat);
        }

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

        console.error('Error al enviar mensaje al backend:', error);

        if (chatBox.contains(loadingSpinnerChat)) {
            chatBox.removeChild(loadingSpinnerChat);
        }

        displayMessage('bot', 'Lo siento, hubo un error al procesar tu solicitud. Por favor, asegúrate de que el backend esté corriendo y la clave de API sea válida. Error: ' + (error.message || ''));
    } finally {
        // 10. Volver a habilitar la interfaz de usuario y ocultar los spinners
        userInputField.disabled = false;
        sendBtn.disabled = false;
        loadingOptionsIndicator.classList.add('hidden');
    }
}


sendBtn.addEventListener('click', sendMessage);


userInputField.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') { 
        sendMessage();
    }
});

window.onload = () => {
    const initialParagraph = chatBox.querySelector('p');
    if (initialParagraph) {
        chatBox.removeChild(initialParagraph);
    }
    displayMessage('bot', `¡Hola, ${simulatedStudentProfile.name}! Muchas gracias por compartir tus intereses conmigo. Soy tu asesor vocacional. Ya me has brindado un buen panorama sobre ti, pero quisiera conocer más sobre tus intereses y lo que te gustaría explorar.`);
    displaySuggestions(suggestedOptions);
};
