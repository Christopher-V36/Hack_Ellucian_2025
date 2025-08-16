//Necesitamos importar las bibliotecas necesarias
const express = require('express'); 
const dotenv = require('dotenv'); 
const cors = require('cors'); 
const {GoogleGenerativeAI} = require('@google/generative-ai');

dotenv.config(); 

//Inicialización para la aplicación Express
const app = express(); 
const port = process.env.PORT || 5000; 

//Middleware: Permitirá a Express analizar el cuerpo de solicitudes
app.use(express.json()); 

//Middleware: Configura CORS. Crucial para react
app.use(cors({
    origin: 'http://localhost:3000'
})); 

//Inicialización del cliente de API 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); 

//Ruta  POST para el chat 
app.post('/chat', async (req, res) => {
    try {
        // Extrae los datos enviados desde el frontend
        const { message, studentProfile, chatHistory } = req.body;

        // Validación básica para asegurar que los datos necesarios están presentes
        if (!message || !studentProfile) {
            return res.status(400).json({ error: 'Faltan datos en la solicitud (mensaje o perfil del estudiante).' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            // Formatea el historial de chat para que Gemini lo entienda
            conversationContext = chatHistory.map(entry => `${entry.sender}: ${entry.message}`).join('\n');
            conversationContext = `Historial de conversación reciente:\n${conversationContext}\n\n`;
        }

        const fullPrompt = `Eres un asistente vocacional muy útil y personalizado.
        Aquí está el perfil actual del estudiante:
        Nombre: ${studentProfile.name}
        Edad: ${studentProfile.age}
        Intereses: ${studentProfile.interests.join(', ')}
        Habilidades: ${studentProfile.skills.join(', ')}
        Preferencias (adicionales del chat): ${JSON.stringify(studentProfile.preferences)}

        ${conversationContext}

        El estudiante acaba de decir: "${message}"

        Basándote en el perfil del estudiante, el historial de conversación y el último mensaje:
        1. Responde de manera conversacional, amigable y que invite a seguir explorando.
        2. Intenta identificar si hay nuevos intereses o disgustos que puedan actualizar el perfil.
        3. SIEMPRE, al final de tu respuesta de chat, SUGIERE 3 a 5 opciones vocacionales o áreas de estudio relevantes para el estudiante, dándoles formato de lista enumerada (ej. "1. Opción A\n2. Opción B"). Estas sugerencias deben basarse en TODO el contexto proporcionado (perfil + conversación). Estas opciones las usaré para actualizar el panel de "Opciones Sugeridas" fuera del chat. Si no tienes suficientes sugerencias nuevas, puedes repetir algunas o pedir más información.
        `;

        // Realiza la llamada real a la API de Gemini
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const geminiText = response.text(); 
        let chatbotReply = geminiText;
        let newSuggestions = [];

        // Regex para encontrar el bloque de sugerencias enumeradas
        const suggestionRegex = /(\d+\.\s.*(?:\n\d+\.\s.*)*)/;
        const match = geminiText.match(suggestionRegex);

        if (match && match[1]) {
            const suggestionsBlock = match[1];
            // Remueve el bloque de sugerencias del mensaje principal del chatbot
            chatbotReply = geminiText.replace(suggestionsBlock, '').trim();

            // Parsea las líneas del bloque de sugerencias en un array limpio
            newSuggestions = suggestionsBlock.split('\n').map(line =>
                line.replace(/^\d+\.\s*/, '').trim() // Elimina los números y puntos (ej. "1. ")
            ).filter(line => line !== ''); // Filtra cualquier línea vacía
        }

        // Aquí podrías implementar una lógica más sofisticada para actualizar el perfil
        // del estudiante basada en la conversación. Por ahora, solo es una simulación.
        const updatedProfile = {
            ...studentProfile,
            preferences: { ...studentProfile.preferences, lastChatTopic: message }
        };

        // Envía la respuesta procesada de vuelta al frontend
        res.json({
            botMessage: chatbotReply,
            suggestedOptions: newSuggestions,
            updatedStudentProfile: updatedProfile
        });

    } catch (error) {
        // Manejo de errores si algo sale mal con la API de Gemini o el proceso
        console.error('Error al comunicarse con la API de Gemini:', error);
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud.' });
    }
});

// Inicia el servidor Express para que empiece a escuchar solicitudes
app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    console.log(`Asegúrate de que tu frontend (React) haga solicitudes a este puerto (${port}).`);
});