// Importa las bibliotecas necesarias
const express = require('express'); // Framework para construir el servidor web
const dotenv = require('dotenv');   // Para cargar variables de entorno de .env
const cors = require('cors');       // Para permitir comunicación entre dominios (frontend y backend)
const { GoogleGenerativeAI } = require('@google/generative-ai'); // SDK de Google Gemini
const mongoose = require('mongoose'); // Importa Mongoose para MongoDB

// Carga las variables de entorno al inicio de la aplicación
dotenv.config();

// --- Configuración de MongoDB ---
// Define la cadena de conexión a tu base de datos MongoDB
// Asegúrate de tener MONGO_URI en tu archivo .env (ej: MONGO_URI=mongodb://localhost:27017/vocational_chatbot)
// Para MongoDB Atlas, la URI será más compleja y segura.
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vocational_chatbot';
let isMongoConnected = false; // Bandera para saber si MongoDB está conectado

mongoose.connect(mongoUri)
    .then(() => {
        console.log('Conectado a MongoDB');
        isMongoConnected = true; // La conexión fue exitosa
    })
    .catch(err => {
        console.error('No se pudo conectar a MongoDB. La persistencia de datos NO funcionará:', err.message);
        console.warn('La aplicación continuará funcionando usando almacenamiento en memoria para el perfil y el chat.');
        isMongoConnected = false; // La conexión falló
    });

// --- Almacenamiento en memoria para modo de desarrollo sin DB ---
// Esto solo se usará si isMongoConnected es false.
// Las claves de estos objetos son los userId.
let inMemoryStudentProfiles = {};
let inMemoryChatHistories = {};

// --- Definición de Esquemas y Modelos de Mongoose ---
// Los esquemas siguen siendo necesarios para definir la estructura, aunque no se usen si MongoDB falla.
const StudentProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // ID único del usuario (ej. de Firebase Auth)
    name: { type: String, default: '' },
    age: { type: Number, default: 0 },
    interests: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    preferences: { type: Object, default: {} }, // Preferencias que evolucionan con la conversación
});
const StudentProfile = mongoose.model('StudentProfile', StudentProfileSchema);

const ChatMessageSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    sender: { type: String, enum: ['user', 'bot'], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

// --- Datos de Carreras Simuladas (Hardcodeadas) ---
// En una aplicación real, esta data probablemente vendría de otra colección en MongoDB
// o de una fuente de datos administrada. La incluimos aquí para dar contexto a Gemini.
const careersData = [
    { name: 'Ingeniería en Sistemas Computacionales', description: 'Desarrollo de software, algoritmos, redes, seguridad informática. Materias: Programación Avanzada, Estructuras de Datos, Redes de Computadoras, Inteligencia Artificial.' },
    { name: 'Diseño Gráfico Digital', description: 'Creación de contenido visual, diseño web, animación, branding. Materias: Teoría del Color, Tipografía, Diseño Web Responsive, Animación 2D/3D.' },
    { name: 'Mecatrónica', description: 'Integración de mecánica, electrónica, informática y control. Diseño de robots, sistemas automatizados. Materias: Robótica, Control Automático, Electrónica Digital, Neumática e Hidráulica.' },
    { name: 'Psicología', description: 'Estudio del comportamiento humano, procesos mentales, terapia, investigación social. Materias: Psicología Clínica, Psicología del Desarrollo, Neuropsicología, Estadística Aplicada a la Psicología.' },
    { name: 'Contaduría Pública', description: 'Gestión financiera, auditoría, impuestos, costos. Materias: Contabilidad Financiera, Auditoría, Derecho Fiscal, Finanzas Corporativas.' },
    { name: 'Ingeniería Civil', description: 'Diseño, construcción y mantenimiento de infraestructuras. Materias: Estructuras, Geotecnia, Hidráulica, Vías Terrestres, Construcción. Incluye temas de Mecánica de Fluidos para sistemas de agua.' },
    { name: 'Ingeniería Mecánica', description: 'Diseño y análisis de máquinas, sistemas de energía, procesos de manufactura. Materias: Termodinámica, Mecánica de Materiales, Diseño Mecánico, Mecánica de Fluidos.' },
    { name: 'Matemáticas Aplicadas', description: 'Modelado matemático de fenómenos, análisis de datos, optimización. Materias: Álgebra Lineal, Cálculo Avanzado, Ecuaciones Diferenciales, Optimización, Análisis Numérico.' },
    { name: 'Literatura y Lingüística', description: 'Análisis de textos, estudio de idiomas, creación literaria, traducción. Materias: Historia de la Literatura, Teorías Lingüísticas, Retórica, Escritura Creativa.' }
];

// --- Configuración de Express y Gemini API ---
const app = express();
const port = process.env.PORT || 5000; // Define el puerto del servidor

// Configura el middleware para analizar JSON en el cuerpo de las solicitudes
app.use(express.json());

// Configura CORS para permitir solicitudes desde tu frontend (HTML local)
// Si usas un servidor web para tu HTML, ajusta 'origin' a su URL (ej. 'http://localhost' o 'http://127.0.0.1')
// Si abres el HTML directamente desde el archivo (file://), esta configuración CORS podría no aplicarse
// en algunos navegadores (CORS es para solicitudes entre dominios/orígenes).
app.use(cors({
    origin: '*', // Permite cualquier origen por ahora para facilitar la prueba con HTML directo.
                  // ¡ATENCIÓN! Cambiar a un origen específico para producción (ej. 'http://localhost:3000' si usas React, o tu dominio real)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Inicializa el cliente de la API de Gemini con tu clave
// La clave se obtiene de las variables de entorno para mayor seguridad
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- NUEVO ENDPOINT: Guardar o actualizar el perfil del estudiante ---
// Este endpoint es llamado por tu formulario vocacional (sea HTML o React)
app.post('/save-profile', async (req, res) => {
    const { userId, profileData } = req.body;
    if (!userId || !profileData) {
        return res.status(400).json({ error: 'Faltan userId o profileData.' });
    }
    try {
        let updatedProfile;
        if (isMongoConnected) {
            // Guarda/actualiza en MongoDB
            updatedProfile = await StudentProfile.findOneAndUpdate(
                { userId: userId },
                profileData,
                { upsert: true, new: true, setDefaultsOnInsert: true } // upsert: crea si no existe; new: devuelve el doc actualizado
            );
            res.json({ message: 'Perfil guardado/actualizado con éxito (DB).', profile: updatedProfile });
        } else {
            // Fallback en memoria si MongoDB no está conectado
            inMemoryStudentProfiles[userId] = { userId, ...profileData };
            res.json({ message: 'Perfil guardado/actualizado con éxito (Memoria).', profile: inMemoryStudentProfiles[userId] });
        }
    } catch (error) {
        console.error('Error al guardar el perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor al guardar el perfil.' });
    }
});

// --- NUEVO ENDPOINT: Cargar datos iniciales del usuario (perfil y historial de chat) ---
// Este endpoint es llamado al cargar tu HTML/aplicación para ver si el usuario ya tiene datos.
app.get('/load-data/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({ error: 'Falta userId.' });
    }
    try {
        let studentProfile = null;
        let chatHistory = [];

        if (isMongoConnected) {
            // Cargar de MongoDB
            studentProfile = await StudentProfile.findOne({ userId });
            chatHistory = await ChatMessage.find({ userId }).sort({ timestamp: 1 }); // Ordenar por tiempo
        } else {
            // Fallback en memoria
            studentProfile = inMemoryStudentProfiles[userId] || null;
            chatHistory = inMemoryChatHistories[userId] || [];
        }

        res.json({ studentProfile, chatHistory });
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor al cargar datos.' });
    }
});


// --- ENDPOINT PRINCIPAL DEL CHATBOT ---
app.post('/chat', async (req, res) => {
    try {
        // Extrae el mensaje del usuario y su ID
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'Faltan datos en la solicitud (userId o message).' });
        }

        // 1. Cargar perfil y historial del usuario desde la base de datos o memoria
        let studentProfile;
        let chatHistory;

        if (isMongoConnected) {
            studentProfile = await StudentProfile.findOne({ userId });
            chatHistory = await ChatMessage.find({ userId }).sort({ timestamp: 1 });
        } else {
            // Fallback en memoria si no hay DB
            studentProfile = inMemoryStudentProfiles[userId] || {
                name: 'Joss', // Perfil básico si no se ha guardado nada
                age: '20',
                interests: ['Programación'],
                skills: [],
                preferences: {}
            };
            chatHistory = inMemoryChatHistories[userId] || [];
        }

        // --- Modelo de Gemini actualizado para compatibilidad ---
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        // Alternativas si 'gemini-1.5-flash' no funciona: "gemini-1.5-pro", o usa ListModels para verificar.

        // 2. Preparar el contexto de las carreras para Gemini (datos hardcodeados)
        const careersContext = careersData.map(c => `Nombre: ${c.name}\nDescripción: ${c.description}`).join('\n\n');

        // 3. Construcción del PROMPT CONTEXTUAL y solicitud de salida ESTRUCTURADA
        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
            // Incluimos solo los últimos 10 mensajes para evitar que el prompt sea demasiado largo
            const recentHistory = chatHistory.slice(-10);
            conversationContext = recentHistory.map(entry => `${entry.sender}: ${entry.message}`).join('\n');
            conversationContext = `Historial de conversación reciente (últimos ${recentHistory.length} mensajes):\n${conversationContext}\n\n`;
        }

        const fullPrompt = `Eres un asistente vocacional experto y personalizado. Tu objetivo es guiar a los estudiantes hacia carreras adecuadas basándote en su perfil, conversación y las carreras disponibles.

        Aquí está el perfil actual del estudiante:
        Nombre: ${studentProfile.name || 'No especificado'}
        Edad: ${studentProfile.age || 'No especificada'}
        Intereses Iniciales: ${(studentProfile.interests && studentProfile.interests.length > 0) ? studentProfile.interests.join(', ') : 'Ninguno especificado'}
        Habilidades Iniciales: ${(studentProfile.skills && studentProfile.skills.length > 0) ? studentProfile.skills.join(', ') : 'Ninguna especificada'}
        Preferencias Adicionales (de conversaciones previas): ${JSON.stringify(studentProfile.preferences || {})}

        ${conversationContext}

        El estudiante acaba de decir: "${message}"

        Aquí está la lista de carreras disponibles con sus descripciones detalladas. Analiza la conversación del estudiante y su perfil en relación con estas carreras. Si el estudiante expresa disgusto por algún tema (ej. "mecánica de fluidos"), considera cómo eso afecta la relevancia de las carreras que incluyen ese tema.

        ${careersContext}

        Basándote en TODO el contexto proporcionado (perfil, historial, último mensaje y carreras disponibles), tu respuesta DEBE ser SOLAMENTE un objeto JSON, sin ningún texto adicional fuera del JSON. El campo "chatReply" DEBE contener toda la respuesta conversacional, amigable y que invite a seguir explorando.

        Formato de la respuesta JSON (ESTRICTO - no incluyas ningún otro texto fuera de este JSON):
        \`\`\`json
        {
          "chatReply": "Tu mensaje conversacional aquí...",
          "suggestedCareers": [
            {
              "name": "Nombre de la Carrera (de la lista proporcionada)",
              "percentageMatch": 0, // Un número del 0 al 100
              "reason": "Breve explicación de por qué coincide, considerando gustos/disgustos."
            },
            // ... 3 a 4 carreras más (debes sugerir entre 3 y 4)
          ]
        }
        \`\`\`
        Asegúrate de que 'name' sea exactamente uno de los nombres de la lista de 'careersData' proporcionada.
        `;

        // 4. Realizar la llamada a la API de Gemini con el esquema de respuesta JSON
        const apiPayload = {
            // 'contents' debe ser un array de objetos Part directos (cada Part puede ser text, inlineData, etc.)
            contents: [{ text: fullPrompt }], 
            generationConfig: {
                responseMimeType: "application/json", // ¡Le pedimos un JSON!
                responseSchema: { // Definimos la estructura del JSON esperado
                    type: "OBJECT",
                    properties: {
                        chatReply: { type: "STRING" },
                        suggestedCareers: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    percentageMatch: { type: "NUMBER" },
                                    reason: { type: "STRING" }
                                },
                                required: ["name", "percentageMatch", "reason"]
                            }
                        }
                    },
                    required: ["chatReply", "suggestedCareers"]
                }
            }
        };

        // Pasa apiPayload.contents (el array completo) como primer argumento, y generationConfig como segundo.
        const apiResponse = await model.generateContent(apiPayload.contents, apiPayload.generationConfig);
        let geminiJsonText = apiResponse.response.text(); // Usa let, no const, para poder modificarla

        // --- Depuración: Imprime la respuesta cruda de Gemini antes de parsear ---
        console.log('Respuesta cruda de Gemini:', geminiJsonText);

        // --- Pre-procesamiento para extraer el JSON válido ---
        // Expresión regular para encontrar el primer bloque JSON completo
        const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
        const jsonMatch = geminiJsonText.match(jsonRegex);

        if (jsonMatch && jsonMatch[1]) {
            geminiJsonText = jsonMatch[1]; // Extrae solo el contenido dentro de ```json ```
            console.log('JSON extraído para parsear:', geminiJsonText);
        } else {
            // Si no se encuentra el bloque ```json ```, intenta parsear directamente
            // o maneja el error si esperas estrictamente ese formato.
            console.warn('No se encontró el bloque ```json ```. Intentando parsear la respuesta completa.');
        }

        const parsedGeminiResponse = JSON.parse(geminiJsonText); // Parsear la respuesta JSON de Gemini

        const chatbotReply = parsedGeminiResponse.chatReply;
        const newSuggestions = parsedGeminiResponse.suggestedCareers;

        // 5. Guardar el historial de la conversación (en MongoDB si conectado, sino en memoria)
        if (isMongoConnected) {
            await ChatMessage.create({ userId, sender: 'user', message });
            await ChatMessage.create({ userId, sender: 'bot', message: chatbotReply });
        } else {
            if (!inMemoryChatHistories[userId]) {
                inMemoryChatHistories[userId] = [];
            }
            inMemoryChatHistories[userId].push({ sender: 'user', message, timestamp: new Date() });
            inMemoryChatHistories[userId].push({ sender: 'bot', message: chatbotReply, timestamp: new Date() });
            // console.log("Historial en memoria:", inMemoryChatHistories[userId]); // Para depuración
        }

        // 6. Enviar la respuesta procesada de vuelta al frontend
        res.json({
            botMessage: chatbotReply,
            suggestedOptions: newSuggestions, // Ahora contiene name, percentageMatch, reason
            updatedStudentProfile: studentProfile // Enviamos el perfil consultado (no directamente actualizado por el chat aquí)
        });

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini o la DB (en chat endpoint):', error);
        // Si el error es específicamente de JSON.parse, podemos dar un mensaje más útil
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
             console.error('¡ATENCIÓN! La respuesta de Gemini NO fue un JSON válido. Revisa el log de "Respuesta cruda de Gemini" arriba.');
        }
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud del chat.' });
    }
});


// Inicia el servidor Express para que empiece a escuchar solicitudes
app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    console.log(`Asegúrate de que tu frontend (HTML) haga solicitudes a este puerto (${port}).`);
});
