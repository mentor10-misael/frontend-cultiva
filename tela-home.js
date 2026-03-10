const btnChart = document.getElementById('btn-chart');
const btnTable = document.getElementById('btn-table');
const viewChart = document.getElementById('view-chart');
const viewTable = document.getElementById('view-table');
const tableBody = document.querySelector('.table tbody');

//Alterna entre Gráfico e Tabela
btnTable.addEventListener('click', () => {
    // 1. Mostra a tabela garantindo que a classe d-block seja adicionada
    viewTable.classList.remove('d-none');
    viewTable.classList.add('d-block');
    
    // 2. Esconde o gráfico de forma forçada
    viewChart.classList.remove('d-block');
    viewChart.classList.add('d-none');
    
    // 3. Atualiza o visual dos botões
    btnTable.classList.add('btn-white', 'active', 'shadow-sm', 'rounded-2');
    btnTable.classList.remove('text-muted', 'border-0');
    
    btnChart.classList.remove('btn-white', 'active', 'shadow-sm', 'rounded-2');
    btnChart.classList.add('text-muted', 'border-0');
});

btnChart.addEventListener('click', () => {
    // 1. Mostra o gráfico garantindo que a classe d-block seja adicionada
    viewChart.classList.remove('d-none');
    viewChart.classList.add('d-block');
    
    // 2. Esconde a tabela de forma forçada
    viewTable.classList.remove('d-block');
    viewTable.classList.add('d-none');
    
    // 3. Atualiza o visual dos botões
    btnChart.classList.add('btn-white', 'active', 'shadow-sm', 'rounded-2');
    btnChart.classList.remove('text-muted', 'border-0');
    
    btnTable.classList.remove('btn-white', 'active', 'shadow-sm', 'rounded-2');
    btnTable.classList.add('text-muted', 'border-0');
});

// 3. Deixando a estrutura pronta para a API do Back-end
async function buscarMovimentacoesFinanceiras() {
    try {
        // Colocar a URL correta do back-end (ex: http://localhost:3000/api/fluxo)
        // const resposta = await fetch('URL_API_AQUI');
        // const dados = await resposta.json();

        // Enquanto o back não é integrado, isso simula a resposta da API
        const dados = [
            { mes: 'Jan', entradas: 3000, saidas: 1800 },
            { mes: 'Fev', entradas: 2500, saidas: 1700 },
            { mes: 'Mar', entradas: 3200, saidas: 1700 },
            { mes: 'Abr', entradas: 4250, saidas: 2250 }
        ];

        // Se a API não retornar nada, avisamos o usuário
        if (!dados || dados.length === 0) {
            console.warn("Nenhuma movimentação encontrada neste período.");
            return;
        }

        // 1. Renderiza a tabela com os dados da API
        renderizarTabela(dados);

        // 2. Renderiza o gráfico com os dados da API
        renderizarGrafico(dados);

        // 3. Inicializa o rodapé pegando sempre o último mês retornado pelo Back-end
        atualizarResumo(dados[dados.length - 1]);

    } catch (erro) {
        console.error("Erro ao buscar dados financeiros:", erro);
    }
}

// Executa a busca assim que a tela carregar
buscarMovimentacoesFinanceiras();

// 4. Função para popular a tabela dinamicamente
function renderizarTabela(dados) {
    // Limpa a tabela antes de preencher
    tableBody.innerHTML = ''; 

    dados.forEach(item => {
        const saldo = item.entradas - item.saidas;
        
        // Cria a linha do HTML
        const tr = document.createElement('tr');
        tr.className = 'border-bottom';
        tr.innerHTML = `
            <td class="px-0">${item.mes}</td>
            <td class="text-success">R$ ${item.entradas.toFixed(2)}</td>
            <td class="text-danger">R$ ${item.saidas.toFixed(2)}</td>
            <td class="fw-bold text-end px-0">R$ ${saldo.toFixed(2)}</td>
        `;
        
        tableBody.appendChild(tr);
    });
}

// 5. Configuração do Gráfico com Chart.js
function renderizarGrafico(dados) {
    const ctx = document.getElementById('financeChart').getContext('2d');

    // Extrai apenas os meses para o eixo X
    const labels = dados.map(item => item.mes);
    
    // Calcula o saldo para o tamanho das barras (Entradas - Saídas)
    const saldos = dados.map(item => item.entradas - item.saidas);

    const backgroundColors = labels.map((_, index) => {
        return index === labels.length - 1 ? '#198754' : '#dee2e6';
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Saldo',
                data: saldos,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            
            onClick: (event, activeElements, chart) => {
                if (activeElements.length > 0) {
                    const indiceClicado = activeElements[0].index;
                    
                    //Atualiza os textos e valores lá no rodapé
                    atualizarResumo(dados[indiceClicado]);
                    
                    // Muda a cor das barras dinamicamente 
                    // A barra clicada fica verde (#198754) e as outras ficam cinza (#dee2e6)
                    chart.data.datasets[0].backgroundColor = chart.data.labels.map((_, i) => {
                        return i === indiceClicado ? '#198754' : '#dee2e6';
                    });
                    
                    // Manda o gráfico se redesenhar com as novas cores
                    chart.update();
                }
            },
            
            // Muda o cursor 
            onHover: (event, chartElement) => {
                event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
            },

            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'R$ ' + context.raw.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false }
                },
                y: {
                    display: false,
                    beginAtZero: true,
                    grid: { display: false }
                }
            }
        }
    });
}

// 6. Função para atualizar os valores no rodapé do card
function atualizarResumo(dadosDoMes) {
    const formatarMoeda = (valor) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Atualiza os textos de Entradas
    document.getElementById('label-entradas').textContent = `Entradas (${dadosDoMes.mes})`;
    document.getElementById('valor-entradas').textContent = `↗ ${formatarMoeda(dadosDoMes.entradas)}`;

    // Atualiza os textos de Saídas
    document.getElementById('label-saidas').textContent = `Saídas (${dadosDoMes.mes})`;
    document.getElementById('valor-saidas').textContent = `↘ ${formatarMoeda(dadosDoMes.saidas)}`;
}


// DATA DE HOJE
function atualizarDataDeHoje() {
    const hoje = new Date();
    
    // Configura o formato: "quarta-feira, 4 de março"
    const opcoes = { weekday: 'long', day: 'numeric', month: 'long' };
    let dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
    
    // Deixa a primeira letra maiúscula
    dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
    
    document.getElementById('data-hoje').textContent = dataFormatada;
}

// Executa a função da data
atualizarDataDeHoje();

// Função auxiliar para injetar os dados na tela
function renderizarClimaNaTela(dados) {
    document.getElementById('clima-cidade').textContent = `Clima em ${dados.cidade}`;
    document.getElementById('clima-temp').textContent = `${dados.temperatura}°C`;
    document.getElementById('clima-desc').textContent = dados.descricao;
    
    document.getElementById('clima-minmax').textContent = `Mín: ${dados.tempMin}°C | Máx: ${dados.tempMax}°C`;
    
    // Atualizando chuva e umidade
    document.getElementById('clima-chuva').innerHTML = `<i class="fa-solid fa-cloud-rain text-primary"></i> ${dados.probabilidadeChuva}% Chuva`;
    document.getElementById('clima-umidade').innerHTML = `<i class="fa-solid fa-droplet text-info"></i> ${dados.umidade}% Umidade`;
    
    document.getElementById('clima-icone').src = dados.icone;
}

    // FUNÇÕES AUXILIARES DE CLIMA

// Pede a localização do navegador (retorna uma Promise para usarmos com async/await)
function obterLocalizacao() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Navegador não suporta GPS."));
        } else {
            // Timeout de 5000ms (5 segundos). Se o GPS demorar, ele rejeita e vai pro catch.
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        }
    });
}

// Transforma o código do OpenWeatherMap no caminho do SVG
function obterIconeClima(codigoIcone) {
    const pastaBase = 'assets/'; 
    
    const mapaIcones = {
        '01d': 'sol.svg', '01n': 'noite-limpa.svg', // Céu limpo
        '02d': 'poucas-nuvens.svg', '02n': 'poucas-nuvens-noite.svg', // Poucas nuvens
        '03d': 'nublado.svg', '03n': 'nublado-noite.svg', // Nuvens dispersas
        '04d': 'nublado.svg', '04n': 'nublado-noite.svg', // Nublado
        '09d': 'garoa.svg', '09n': 'garoa.svg', // Garoa
        '10d': 'chuva.svg', '10n': 'chuva.svg', // Chuva
        '11d': 'tempestade.svg', '11n': 'tempestade.svg', // Tempestade
        '50d': 'vento.svg', '50n': 'vento.svg'  // Vento
    };

    const nomeArquivo = mapaIcones[codigoIcone] || 'sol.svg';
    return pastaBase + nomeArquivo;
}

// Simula a busca da cidade salva no perfil do usuário
function obterCidadeDoUsuario() {
    // Tenta pegar a cidade salva no armazenamento do navegador
    const cidadeSalva = localStorage.getItem('cultiva_cidade_perfil');
    
    return cidadeSalva; 
}

// FUNÇÃO PRINCIPAL
async function carregarDadosDoClima() {
    const climaSalvo = localStorage.getItem('cultiva_clima_cache');
    if (climaSalvo) {
        renderizarClimaNaTela(JSON.parse(climaSalvo));
    }

    try {
            const apiKey = 'CHAVE_API'; 
            
            // Puxa a cidade dinâmica do perfil do usuário
            const cidadePlanoB = obterCidadeDoUsuario(); 
            
            // Fazendo as duas buscas usando a cidade dinâmica
            const resAtualFallback = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${cidadePlanoB}&units=metric&lang=pt_br&appid=${apiKey}`);
            if (!resAtualFallback.ok) throw new Error("Erro na API de clima");
            const dadosAPI = await resAtualFallback.json();

            const resPrevFallback = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${cidadePlanoB}&units=metric&lang=pt_br&appid=${apiKey}`);
            const dadosPrevisao = await resPrevFallback.json();

        // Pega os próximos 8 blocos de previsão (que representam as próximas 24 horas, já que a API manda de 3 em 3 horas)
        const proximas24h = dadosPrevisao.list.slice(0, 8);
        
        // Descobre a maior e menor temperatura dessas 24 horas
        const tempMinDia = Math.round(Math.min(...proximas24h.map(item => item.main.temp_min)));
        const tempMaxDia = Math.round(Math.max(...proximas24h.map(item => item.main.temp_max)));
        
        // Pega a probabilidade de chuva (vem de 0 a 1, então multiplicamos por 100)
        const chanceDeChuva = Math.round(proximas24h[0].pop * 100);

        const dadosNovos = {
            cidade: dadosAPI.name,
            temperatura: Math.round(dadosAPI.main.temp), 
            tempMin: tempMinDia, 
            tempMax: tempMaxDia, 
            descricao: dadosAPI.weather[0].description.charAt(0).toUpperCase() + dadosAPI.weather[0].description.slice(1),
            probabilidadeChuva: chanceDeChuva, 
            umidade: dadosAPI.main.humidity,
            icone: obterIconeClima(dadosAPI.weather[0].icon)
        };

        renderizarClimaNaTela(dadosNovos);
        localStorage.setItem('cultiva_clima_cache', JSON.stringify(dadosNovos));

    } catch (erro) {
        console.warn("GPS falhou ou demorou");

        //BUSCA O CLIMA DA CIDADE PADRÃO SE O GPS NÃO FUNCIONAR
        try {
            const apiKey = 'CHAVE_API';
            
            const resAtualFallback = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Schroeder,BR&units=metric&lang=pt_br&appid=${apiKey}`);
            if (!resAtualFallback.ok) throw new Error("Erro na API de clima");
            const dadosAPI = await resAtualFallback.json();

            const resPrevFallback = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=Schroeder,BR&units=metric&lang=pt_br&appid=${apiKey}`);
            const dadosPrevisao = await resPrevFallback.json();

            const proximas24h = dadosPrevisao.list.slice(0, 8);
            const tempMinDia = Math.round(Math.min(...proximas24h.map(item => item.main.temp_min)));
            const tempMaxDia = Math.round(Math.max(...proximas24h.map(item => item.main.temp_max)));
            const chanceDeChuva = Math.round(proximas24h[0].pop * 100);

            const dadosNovos = {
                cidade: dadosAPI.name,
                temperatura: Math.round(dadosAPI.main.temp), 
                tempMin: tempMinDia,
                tempMax: tempMaxDia,
                descricao: dadosAPI.weather[0].description.charAt(0).toUpperCase() + dadosAPI.weather[0].description.slice(1),
                probabilidadeChuva: chanceDeChuva, 
                umidade: dadosAPI.main.humidity,
                icone: obterIconeClima(dadosAPI.weather[0].icon) 
            };

            renderizarClimaNaTela(dadosNovos);
            localStorage.setItem('cultiva_clima_cache', JSON.stringify(dadosNovos));

        } catch (erroFatal) {
            console.error("Falha total na busca do clima.", erroFatal);
            if (!climaSalvo) {
                document.getElementById('clima-cidade').textContent = "Localização indisponível";
                document.getElementById('clima-temp').textContent = "--";
                document.getElementById('clima-desc').textContent = "Sem conexão.";
                document.getElementById('clima-minmax').textContent = "";
            }
        }
    }
}

// Executa a busca assim que o script carregar
carregarDadosDoClima();



//FASE DA LUA COM SUNCALC
function atualizarFaseDaLua() {
    const lua = SunCalc.getMoonIllumination(new Date());
    const fase = lua.phase; 

    let nome = "";
    let desc = "";
    let caminhoImagem = ""; 
    let corDesc = "text-success"; 

    // Ajuste as rotas abaixo para a pasta correta onde seus vetores estão salvos!
    if (fase < 0.05 || fase > 0.95) {
        nome = "Nova";
        caminhoImagem = "/assets/lua-nova.svg"; 
        desc = "Lua Nova - Ideal para plantio de raízes";
        corDesc = "text-secondary"; 
    } else if (fase >= 0.05 && fase < 0.45) {
        nome = "Crescente";
        caminhoImagem = "/assets/lua-crescente.svg";
        desc = "Lua Crescente - Bom para plantas que crescem acima do solo.";
        corDesc = "text-secondary";
    } else if (fase >= 0.45 && fase < 0.55) {
        nome = "Cheia";
        caminhoImagem = "/assets/lua-cheia.svg";
        desc = "Lua Cheia - Ótima para colheita de frutos e ervas.";
        corDesc = "text-secondary";
    } else {
        nome = "Minguante";
        caminhoImagem = "/assets/lua-minguante.svg";
        desc = "Lua Minguante - Excelente para poda e controle de pragas.";
        corDesc = "text-secondary";
    }

    // Injetando os textos
    document.getElementById('lua-nome').textContent = nome;
    
    // Injetando a imagem 
    document.getElementById('lua-icone').src = caminhoImagem;
    
    // Atualizando a descrição
    const descElement = document.getElementById('lua-desc');
    descElement.textContent = desc;
    descElement.className = `small mb-0 ${corDesc}`; 
}

atualizarFaseDaLua();
