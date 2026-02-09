// Configuração básica do Axios
const api = axios.create({
    baseURL: 'http://localhost:3000'
});

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const apiMessage = document.getElementById('api-message');

    statusDiv.classList.remove('d-none');
    apiMessage.textContent = 'Verificando conexão com a API...';

    try {
        const response = await api.get('/');
        apiMessage.textContent = response.data.message;
        statusDiv.classList.replace('alert-info', 'alert-success');
    } catch (error) {
        apiMessage.textContent = 'Erro ao conectar com o backend.';
        statusDiv.classList.replace('alert-info', 'alert-danger');
        console.error('Erro detalhado:', error);
    }
});
