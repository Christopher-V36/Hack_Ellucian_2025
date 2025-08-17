require('dotenv').config();



const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Conecta a tu base de datos de MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Conectado a la base de datos de tu proyecto colaborativo.'))
    .catch(err => console.error('❌ Error de conexión:', err));

// Define la estructura de los datos que se guardarán
const cuestionarioSchema = new mongoose.Schema({
    pregunta1: String,
    pregunta2: String,
    pregunta3: String,
    pregunta4: String,
    pregunta5: String,
    pregunta6: String,
    pregunta7: String,
    pregunta8: String,
    pregunta9: String,
    pregunta10: String,
    pregunta11: String,
    pregunta12: String,
    pregunta13: String,
    pregunta14: String,
    pregunta15: String,
    pregunta16: String,
    pregunta17: String,
    pregunta18: String,
    fechaEnvio: { type: Date, default: Date.now }
});

const Cuestionario = mongoose.model('Cuestionario', cuestionarioSchema);

// Middleware para logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Crea la "ruta" que recibirá los datos del formulario
app.post('/api/submit', async (req, res) => {
    try {
        console.log('📨 Datos recibidos del cliente:');
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        // Verificar que llegaron todas las preguntas
        const preguntasRecibidas = [];
        const preguntasFaltantes = [];
        
        for (let i = 1; i <= 18; i++) {
            const pregunta = `pregunta${i}`;
            if (req.body[pregunta] && req.body[pregunta].trim() !== '') {
                preguntasRecibidas.push(i);
            } else {
                preguntasFaltantes.push(i);
            }
        }
        
        console.log(`✅ Preguntas recibidas (${preguntasRecibidas.length}/18):`, preguntasRecibidas);
        if (preguntasFaltantes.length > 0) {
            console.log(`❌ Preguntas faltantes (${preguntasFaltantes.length}/18):`, preguntasFaltantes);
        }
        
        const nuevaRespuesta = new Cuestionario(req.body);
        const resultado = await nuevaRespuesta.save();
        
        console.log('💾 Respuesta guardada exitosamente con ID:', resultado._id);
        console.log('📊 Total de campos guardados:', Object.keys(req.body).length);
        
        res.status(200).json({
            mensaje: 'Respuestas guardadas correctamente.',
            id: resultado._id,
            preguntasGuardadas: preguntasRecibidas.length,
            totalPreguntas: 18
        });
        
    } catch (error) {
        console.error('❌ Error al guardar las respuestas:', error);
        res.status(500).json({
            error: 'Error al guardar las respuestas',
            detalle: error.message
        });
    }
});

// Ruta para verificar cuántas respuestas hay en la base de datos
app.get('/api/stats', async (req, res) => {
    try {
        const total = await Cuestionario.countDocuments();
        const ultimaRespuesta = await Cuestionario.findOne().sort({ fechaEnvio: -1 });
        
        res.json({
            totalRespuestas: total,
            ultimaRespuesta: ultimaRespuesta ? ultimaRespuesta.fechaEnvio : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor listo en http://localhost:${port}`);
    console.log(`📊 Estadísticas disponibles en http://localhost:${port}/api/stats`);
});