const express = require('express'); 
const dotenv = require('dotenv');  
const cors = require('cors');       
const { GoogleGenerativeAI } = require('@google/generative-ai'); 
const mongoose = require('mongoose'); 


dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/vocational_chatbot';
let isMongoConnected = false; 

mongoose.connect(mongoUri)
    .then(() => {
        console.log('Conectado a MongoDB');
        isMongoConnected = true; 
    })
    .catch(err => {
        console.error('No se pudo conectar a MongoDB. La persistencia de datos NO funcionará:', err.message);
        console.warn('La aplicación continuará funcionando usando almacenamiento en memoria para el perfil y el chat.');
        isMongoConnected = false; 
    });


let inMemoryStudentProfiles = {};
let inMemoryChatHistories = {};


const StudentProfileSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, 
    name: { type: String, default: '' },
    age: { type: Number, default: 0 },
    interests: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    preferences: { type: Object, default: {} }, 
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
const port = process.env.PORT || 5000; 


app.use(express.json());


app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


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
                { upsert: true, new: true, setDefaultsOnInsert: true } 
            );
            res.json({ message: 'Perfil guardado/actualizado con éxito (DB).', profile: updatedProfile });
        } else {
         
            inMemoryStudentProfiles[userId] = { userId, ...profileData };
            res.json({ message: 'Perfil guardado/actualizado con éxito (Memoria).', profile: inMemoryStudentProfiles[userId] });
        }
    } catch (error) {
        console.error('Error al guardar el perfil:', error);
        res.status(500).json({ error: 'Error interno del servidor al guardar el perfil.' });
    }
});


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
                name: 'Joss', 
                age: '20',
                interests: ['Programación'],
                skills: [],
                preferences: {}
            };
            chatHistory = inMemoryChatHistories[userId] || [];
        }

     
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        

 
        const careersContext = careersData.map(c => `Nombre: ${c.name}\nDescripción: ${c.description}`).join('\n\n');

        // 3. Construcción del PROMPT CONTEXTUAL y solicitud de salida ESTRUCTURADA
        let conversationContext = '';
        if (chatHistory && chatHistory.length > 0) {
           
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
            
            contents: [{ text: fullPrompt }], 
            generationConfig: {
                responseMimeType: "application/json", 
                responseSchema: { 
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

    
        const apiResponse = await model.generateContent(apiPayload.contents, apiPayload.generationConfig);
        let geminiJsonText = apiResponse.response.text(); 


        console.log('Respuesta cruda de Gemini:', geminiJsonText);


        const jsonRegex = /```json\s*(\{[\s\S]*?\})\s*```/;
        const jsonMatch = geminiJsonText.match(jsonRegex);

        if (jsonMatch && jsonMatch[1]) {
            geminiJsonText = jsonMatch[1]; 
            console.log('JSON extraído para parsear:', geminiJsonText);
        } else {

            console.warn('No se encontró el bloque ```json ```. Intentando parsear la respuesta completa.');
        }

        const parsedGeminiResponse = JSON.parse(geminiJsonText); 

        const chatbotReply = parsedGeminiResponse.chatReply;
        const newSuggestions = parsedGeminiResponse.suggestedCareers;

 
        if (isMongoConnected) {
            await ChatMessage.create({ userId, sender: 'user', message });
            await ChatMessage.create({ userId, sender: 'bot', message: chatbotReply });
        } else {
            if (!inMemoryChatHistories[userId]) {
                inMemoryChatHistories[userId] = [];
            }
            inMemoryChatHistories[userId].push({ sender: 'user', message, timestamp: new Date() });
            inMemoryChatHistories[userId].push({ sender: 'bot', message: chatbotReply, timestamp: new Date() });
            
        }

        // 6. Enviar la respuesta procesada de vuelta al frontend
        res.json({
            botMessage: chatbotReply,
            suggestedOptions: newSuggestions, 
            updatedStudentProfile: studentProfile 
        });

    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini o la DB (en chat endpoint):', error);
       
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
             console.error('¡ATENCIÓN! La respuesta de Gemini NO fue un JSON válido. Revisa el log de "Respuesta cruda de Gemini" arriba.');
        }
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud del chat.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${port}`);
    console.log(`Asegúrate de que tu frontend (HTML) haga solicitudes a este puerto (${port}).`);
});
