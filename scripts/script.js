document.addEventListener('DOMContentLoaded', function() {
    const modelButtons = document.querySelectorAll('.model-button');
    const modelContents = document.querySelectorAll('.model-content');

    // Manejar el clic en los botones de modelo
    modelButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Oculta todos los contenidos de modelo
            modelContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Desactiva todos los botones
            modelButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // Muestra el contenido correspondiente al botón clicado
            const targetId = button.dataset.target;
            document.getElementById(targetId).classList.remove('hidden');

            // Activa el botón clicado
            button.classList.add('active');
        });
    });

    // Código para el botón de envío (se mantiene)
    const chatInput = document.querySelector('.input-bar input');
    const sendButton = document.querySelector('.send-button');

    sendButton.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            console.log('Mensaje enviado:', message);
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendButton.click();
        }
    });
});