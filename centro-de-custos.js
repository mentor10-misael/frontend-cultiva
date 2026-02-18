// ==========================================
// 1. CAMADA DE DADOS (Repository & Sync)
// ==========================================

// Simula sua API na nuvem (Node.js) e faz a tradução para o formato do Banco SQL
const FakeCloudAPI = {
    enviarTransacao: (transacaoFront) => {
        return new Promise((resolve, reject) => {
            // Simula delay de rede de 1 segundo
            setTimeout(() => {
                // 1. Tradução para o formato do seu Banco de Dados (Diagrama)
                const payloadBanco = {
                    tipo: transacaoFront.tipo === 'entrada' ? 'RECEITA' : 'DESPESA',
                    descricao: transacaoFront.descricao,
                    valor: transacaoFront.valor,
                    data: transacaoFront.data,
                    forma_pagamento: transacaoFront.pagamento, // Campo novo
                    beneficiario: transacaoFront.pessoa,       // Campo novo
                    centro_custo_id: transacaoFront.categoria, // Slug (ideal seria ID UUID)
                    usuario_id: 1
                };

                console.log(`[CLOUD] Sincronizando:`, payloadBanco);

                // Simula 10% de chance de erro na rede
                if (Math.random() > 0.95) reject("Erro de conexão simulado");
                else resolve({ status: 'ok', idServer: Date.now() });
            }, 1000);
        });
    }
};

const Repository = {
    KEY_TRANSACOES: 'cultiva_transacoes',
    KEY_CATEGORIAS: 'cultiva_categorias',

    // Dados iniciais (Seed)
    dadosIniciaisCategorias: [
        { slug: 'lavoura', nome: 'Lavoura (Geral)', tipo: 'lavoura' },
        { slug: 'maquinas', nome: 'Máquinas', tipo: 'maquinas' },
        { slug: 'geral', nome: 'Despesas Gerais', tipo: 'geral' }
    ],

    getAllTransacoes: () => JSON.parse(localStorage.getItem('cultiva_transacoes')) || [],
    getAllCategorias: () => JSON.parse(localStorage.getItem('cultiva_categorias')) || [],

    init: function() {
        if (!localStorage.getItem(this.KEY_CATEGORIAS)) {
            localStorage.setItem(this.KEY_CATEGORIAS, JSON.stringify(this.dadosIniciaisCategorias));
        }
        if (!localStorage.getItem(this.KEY_TRANSACOES)) {
            localStorage.setItem(this.KEY_TRANSACOES, JSON.stringify([]));
        }
    },

    salvarTransacao: function(transacao) {
        const transacoes = this.getAllTransacoes();
        
        // Se já existe (edição), substitui. Se não, adiciona no começo.
        const index = transacoes.findIndex(t => t.id === transacao.id);
        
        // Configura flags de sincronização
        transacao.updatedAt = new Date().toISOString();
        transacao.syncStatus = 'pendente'; 

        if (index !== -1) {
            transacoes[index] = transacao;
        } else {
            transacoes.unshift(transacao);
        }

        localStorage.setItem(this.KEY_TRANSACOES, JSON.stringify(transacoes));
        
        // Tenta sincronizar imediatamente se estiver online
        SyncService.tentarSincronizar();
        return transacoes;
    },

    atualizarStatusSync: function(id, status) {
        const transacoes = this.getAllTransacoes();
        const index = transacoes.findIndex(t => t.id === id);
        if (index !== -1) {
            transacoes[index].syncStatus = status;
            localStorage.setItem(this.KEY_TRANSACOES, JSON.stringify(transacoes));
        }
    },

    removerTransacao: function(id) {
        let transacoes = this.getAllTransacoes();
        // Em produção, usaríamos "soft delete" (deletedAt), aqui removemos do array
        transacoes = transacoes.filter(t => t.id !== id);
        localStorage.setItem(this.KEY_TRANSACOES, JSON.stringify(transacoes));
        return transacoes;
    },

    adicionarCategoria: function(categoria) {
        const categorias = this.getAllCategorias();
        categorias.push(categoria);
        localStorage.setItem(this.KEY_CATEGORIAS, JSON.stringify(categorias));
        return categorias;
    }
};

// Serviço responsável por ouvir a internet e empurrar dados
const SyncService = {
    isOnline: navigator.onLine,

    init: function() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Conexão restabelecida. Sincronizando...');
            UI.mostrarStatusConexao(true);
            this.tentarSincronizar();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Sem internet. Modo Offline ativado.');
            UI.mostrarStatusConexao(false);
        });

        // Tenta sincronizar ao abrir o app
        if(this.isOnline) this.tentarSincronizar();
    },

    tentarSincronizar: async function() {
        if (!this.isOnline) return;

        const pendentes = Repository.getAllTransacoes().filter(t => t.syncStatus === 'pendente');

        if (pendentes.length === 0) return;

        UI.mostrarCarregandoSync(true);

        for (const item of pendentes) {
            try {
                await FakeCloudAPI.enviarTransacao(item);
                Repository.atualizarStatusSync(item.id, 'sincronizado');
            } catch (error) {
                console.error(`Falha ao sincronizar item ${item.id}`, error);
            }
        }
        
        UI.mostrarCarregandoSync(false);
        UI.atualizarTela(); // Atualiza a lista para mostrar os "checks" verdes
    }
};


// ==========================================
// 2. CAMADA DE INTERFACE (VIEW)
// ==========================================

const UI = {
    elementos: {
        lista: document.getElementById('listaTransacoes'),
        totalReceitas: document.getElementById('totalReceitas'),
        totalDespesas: document.getElementById('totalDespesas'),
        containerCentros: document.getElementById('containerCentros'),
        badgeFiltro: document.getElementById('badgeFiltroAtual'),
        btnLimparFiltro: document.getElementById('btnLimparFiltro'),
        selectCentroCusto: document.getElementById('selectCentroCusto')
    },

    estado: {
        filtroCategoria: 'todos',
        termoBusca: ''
    },

    inicializar: function() {
        this.atualizarTela();
        this.configurarEventos();
    },

    atualizarTela: function() {
        // Agora pede os dados processados ao Controlador
        const dados = Controlador.obterDadosParaTela();

        this.renderizarTotais(dados.resumo);
        this.renderizarCentrosDeCusto(dados.centrosDeCusto);
        this.renderizarListaTransacoes(dados.transacoes);
        this.atualizarDropdownCentros(dados.todasCategorias); 
    },

    renderizarTotais: function(resumo) {
        if(this.elementos.totalReceitas) this.elementos.totalReceitas.innerText = this.formatarMoeda(resumo.totalReceitas);
        if(this.elementos.totalDespesas) this.elementos.totalDespesas.innerText = this.formatarMoeda(resumo.totalDespesas);
    },

    renderizarCentrosDeCusto: function(listaCentros) {
        const container = this.elementos.containerCentros;
        if(!container) return;
        
        container.innerHTML = ''; 

        // Botão "Novo"
        const btnNovo = `
            <div class="card d-flex align-items-center justify-content-center flex-shrink-0 card-add-new"
                data-bs-toggle="modal" data-bs-target="#modalNovoCentro">
                <div class="text-center text-muted">
                    <i class="fa-solid fa-plus fs-4 mb-1"></i>
                    <div class="fs-xs">Novo</div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', btnNovo);

        // Lista de Cards
        listaCentros.forEach(centro => {
            const isAtivo = this.estado.filtroCategoria === centro.slug ? 'active' : '';
            const corValor = centro.saldo >= 0 ? 'text-success' : 'text-danger';
            
            let icone = 'fa-layer-group';
            if (centro.tipo === 'lavoura') icone = 'fa-seedling';
            if (centro.tipo === 'maquinas') icone = 'fa-tractor';
            if (centro.tipo === 'geral') icone = 'fa-building';

            const cardHTML = `
                <div class="card flex-shrink-0 card-cost-center cursor-pointer ${isAtivo}"
                     onclick="Controlador.filtrarPorCategoria('${centro.slug}', '${centro.nome}')">
                    <div class="card-body p-2 d-flex flex-column justify-content-between">
                        <div class="${centro.saldo >= 0 ? 'text-success' : 'text-secondary'}">
                            <i class="fa-solid ${icone} fs-5"></i>
                        </div>
                        <div>
                            <div class="fw-bold text-dark fs-card-title text-truncate" style="max-width: 90px;">
                                ${centro.nome}
                            </div>
                            <div class="${corValor} fw-bold fs-xxs">
                                ${this.formatarMoeda(centro.saldo)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHTML);
        });
    },

    atualizarDropdownCentros: function(categorias) {
        const select = this.elementos.selectCentroCusto;
        if(!select) return;

        const valorAtual = select.value;
        select.innerHTML = '<option value="" disabled selected>Selecione...</option>';
        
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.slug;
            option.text = cat.nome;
            select.appendChild(option);
        });

        if(valorAtual) select.value = valorAtual;
    },

    renderizarListaTransacoes: function(lista) {
        const container = this.elementos.lista;
        if(!container) return;
        
        container.innerHTML = '';

        if (lista.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-4 fs-sm">Nenhuma movimentação encontrada.</div>';
            return;
        }

        lista.forEach(t => {
            const isEntrada = t.tipo === 'entrada';
            const corBorda = isEntrada ? 'border-start-success-thick' : 'border-start-danger-thick';
            const corTexto = isEntrada ? 'text-success' : 'text-danger';
            const sinal = isEntrada ? '' : '- ';
            const dataF = t.data.split('-').reverse().join('/');

            // Ícone de status de sincronização
            const iconeSync = t.syncStatus === 'pendente' 
                ? '<i class="fa-solid fa-cloud-arrow-up text-warning ms-2" title="Pendente de envio"></i>' 
                : '<i class="fa-solid fa-check text-success ms-2 fs-xxs" title="Sincronizado"></i>';

            // Define o nome do usuário (fallback para 'Sistema' se estiver vazio)
            const nomeUsuario = t.usuario || 'Sistema';

            const html = `
                <div class="card card-transaction cursor-pointer mb-2" onclick="Controlador.abrirDetalhes(${t.id})">
                  <div class="card-body p-3 d-flex justify-content-between align-items-center ${corBorda}">
                    <div class="d-flex flex-column gap-1">
                      
                      <div class="d-flex align-items-center gap-2">
                        <span class="fw-bold text-dark text-truncate" style="max-width: 180px;">${t.descricao}</span>
                        ${iconeSync}
                      </div>

                      <div class="d-flex align-items-center flex-wrap gap-2">
                        <span class="badge bg-light text-secondary border fw-normal d-flex align-items-center px-2 py-1" style="font-size: 9px;">
                            <i class="fa-solid fa-user fs-xxs me-1"></i> ${nomeUsuario}
                        </span>
                        
                        <span class="text-muted small text-date" style="font-size: 11px;">
                            ${t.categoriaNome} • ${dataF}
                        </span>
                      </div>

                    </div>
                    
                    <div class="text-end ps-2">
                      <div class="fw-bold ${corTexto} mb-1 text-nowrap">${sinal}${this.formatarMoeda(t.valor)}</div>
                    </div>
                  </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    },

    configurarEventos: function() {
        document.getElementById('inputBusca')?.addEventListener('input', (e) => {
            this.estado.termoBusca = e.target.value.toLowerCase();
            this.atualizarTela();
        });

        document.getElementById('btnLimparBusca')?.addEventListener('click', () => {
            const input = document.getElementById('inputBusca');
            if(input) input.value = '';
            this.estado.termoBusca = '';
            this.atualizarTela();
        });

        this.elementos.btnLimparFiltro?.addEventListener('click', () => Controlador.limparFiltroCategoria());

        document.getElementById('formMovimentacao')?.addEventListener('submit', (e) => {
            e.preventDefault();
            Controlador.salvarTransacao();
        });

        document.getElementById('formNovoCentro')?.addEventListener('submit', (e) => {
            e.preventDefault();
            Controlador.salvarNovoCentro();
        });

        document.getElementById('btnExcluirTransacao')?.addEventListener('click', () => Controlador.excluirTransacao());
        document.getElementById('btnEditarTransacao')?.addEventListener('click', () => Controlador.prepararEdicao());
        document.getElementById('btnNovaTransacao')?.addEventListener('click', () => Controlador.prepararNova());
        
        document.querySelector('.btn-tab-entrada')?.addEventListener('click', () => UI.toggleTipoModal('entrada'));
        document.querySelector('.btn-tab-saida')?.addEventListener('click', () => UI.toggleTipoModal('saida'));
    },

    formatarMoeda: (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),

    toggleTipoModal: function(tipo) {
        const btnEntrada = document.querySelector('.btn-tab-entrada');
        const btnSaida = document.querySelector('.btn-tab-saida');
        const camposEntrada = document.getElementById('camposEntrada');
        const camposSaida = document.getElementById('camposSaida');
        const inputTipo = document.getElementById('inputTipoMovimentacao');
        const btnSubmit = document.getElementById('btnSubmitMovimentacao');
        const inputDescricao = document.getElementById('inputDescricao');
        
        if(inputTipo) inputTipo.value = tipo;

        if (tipo === 'entrada') {
            btnEntrada.classList.add('active');
            btnSaida.classList.remove('active');
            camposEntrada.classList.remove('d-none');
            camposSaida.classList.add('d-none');
            btnSubmit.classList.replace('btn-danger', 'btn-success');
            btnSubmit.textContent = Controlador.idEmEdicao ? 'Salvar Alterações' : 'Registrar Entrada';
            if(inputDescricao) inputDescricao.placeholder = 'Ex: Venda de Soja';
        } else {
            btnSaida.classList.add('active');
            btnEntrada.classList.remove('active');
            camposSaida.classList.remove('d-none');
            camposEntrada.classList.add('d-none');
            btnSubmit.classList.replace('btn-success', 'btn-danger');
            btnSubmit.textContent = Controlador.idEmEdicao ? 'Salvar Alterações' : 'Registrar Saída';
            if(inputDescricao) inputDescricao.placeholder = 'Ex: Manutenção Trator';
        }
    },

    mostrarStatusConexao: function(online) {
        const header = document.querySelector('.header-custom h3');
        if(!header) return;
        if(!online) {
            header.innerHTML = `Controle de Custos <span class="badge bg-warning text-dark fs-xxs ms-2">OFFLINE</span>`;
        } else {
            header.innerHTML = `Controle de Custos`;
        }
    },

    mostrarCarregandoSync: function(loading) {
        const btn = document.getElementById('btnNovaTransacao');
        if(!btn) return;
        
        if(loading) {
            // Guarda o HTML original se não tiver guardado ainda
            if(!btn.getAttribute('data-orig')) btn.setAttribute('data-orig', btn.innerHTML);
            btn.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i>';
        } else {
            const original = btn.getAttribute('data-orig');
            if(original) btn.innerHTML = original;
        }
    },

mudarTipoCentro: function(tipo) {
    // 1. Esconder todos os grupos específicos
    document.getElementById('camposLavoura').classList.add('d-none');
    document.getElementById('camposMaquinas').classList.add('d-none');
    document.getElementById('infoGeral').classList.add('d-none');
    
    // 2. Elementos de UI para alterar
    const btn = document.getElementById('btnCriarCentro');
    const inputNome = document.getElementById('inputNomeCentro');

    // 3. Lógica por tipo
    if (tipo === 'lavoura') {
        document.getElementById('camposLavoura').classList.remove('d-none');
        inputNome.placeholder = "Ex: Terreno do Rio";
        
        // Muda cor do botão para VERDE
        btn.className = 'btn btn-lavoura w-100 py-2 rounded-3 fw-bold transition-all';
    } 
    else if (tipo === 'maquinas') {
        document.getElementById('camposMaquinas').classList.remove('d-none');
        inputNome.placeholder = "Ex: Trator Principal";
        
        // Muda cor do botão para AZUL
        btn.className = 'btn btn-maquinas w-100 py-2 rounded-3 fw-bold transition-all';
    } 
    else if (tipo === 'geral') {
        document.getElementById('infoGeral').classList.remove('d-none');
        inputNome.placeholder = "Ex: Escritório Sede";
        
        // Muda cor do botão para ROXO
        btn.className = 'btn btn-geral w-100 py-2 rounded-3 fw-bold transition-all';
    }
},
};

// ==========================================
// 3. CONTROLADOR (Lógica de Negócio)
// ==========================================

const Controlador = {
    idEmEdicao: null,

    init: function() {
        Repository.init();
        SyncService.init();
        UI.inicializar();
    },

    // Lógica principal: Busca dados brutos e calcula o que a tela precisa
    obterDadosParaTela: function() {
        const todasTransacoes = Repository.getAllTransacoes();
        const categorias = Repository.getAllCategorias();
        
        // 1. Filtros
        const termo = UI.estado.termoBusca;
        const catFiltro = UI.estado.filtroCategoria;

        const transacoesFiltradas = todasTransacoes.filter(t => {
            const passaFiltroCat = catFiltro === 'todos' || t.categoria === catFiltro;
            // Proteção contra campos nulos no search
            const desc = t.descricao ? t.descricao.toLowerCase() : '';
            const pes = t.pessoa ? t.pessoa.toLowerCase() : '';
            
            const passaBusca = termo === '' || desc.includes(termo) || pes.includes(termo);
            return passaFiltroCat && passaBusca;
        });

        // 2. Ordenação
        transacoesFiltradas.sort((a, b) => new Date(b.data) - new Date(a.data));

        // 3. Cálculos de Totais Gerais
        let totalReceitas = 0;
        let totalDespesas = 0;

        todasTransacoes.forEach(t => {
            if (t.tipo === 'entrada') totalReceitas += t.valor;
            else totalDespesas += t.valor;
        });

        // 4. Cálculos dos Saldos por Centro de Custo
        const centrosCalculados = categorias.map(cat => {
            let saldo = 0;
            todasTransacoes.forEach(t => {
                if (t.categoria === cat.slug) {
                    if (t.tipo === 'entrada') saldo += t.valor;
                    else saldo -= t.valor;
                }
            });
            return { ...cat, saldo };
        });

        return {
            resumo: { totalReceitas, totalDespesas },
            centrosDeCusto: centrosCalculados,
            transacoes: transacoesFiltradas,
            todasCategorias: categorias
        };
    },

    salvarTransacao: function() {
        const tipo = document.getElementById('inputTipoMovimentacao').value;
        const valor = parseFloat(document.getElementById('inputValor').value);
        if(isNaN(valor) || valor <= 0) { alert('Digite um valor válido'); return; }
        
        const descricao = document.getElementById('inputDescricao').value;
        const data = document.getElementById('inputData').value;
        const pagamento = document.getElementById('selectPagamento').value;
        
        const select = document.getElementById('selectCentroCusto');
        const categoria = select.value;
        const categoriaNome = select.options[select.selectedIndex].text;
        
        // Pega a pessoa certa dependendo da aba ativa
        let pessoa = tipo === 'entrada' 
            ? document.getElementById('inputQuemPagou').value 
            : document.getElementById('inputFornecedor').value;

        const objetoTransacao = {
            id: this.idEmEdicao || Date.now(), 
            tipo, valor, descricao, data, pagamento, pessoa, categoria, categoriaNome,
            usuario: 'Admin'
        };

        Repository.salvarTransacao(objetoTransacao);

        bootstrap.Modal.getInstance(document.getElementById('modalNovaMovimentacao')).hide();
        UI.atualizarTela();
    },

    excluirTransacao: function() {
        if(confirm('Deseja excluir esta movimentação?')) {
            Repository.removerTransacao(this.idEmEdicao);
            bootstrap.Modal.getInstance(document.getElementById('modalDetalhes')).hide();
            UI.atualizarTela();
        }
    },
    
    prepararEdicao: function() {
        // Agora busca do Repository
        const todas = Repository.getAllTransacoes(); 
        const transacao = todas.find(t => t.id === this.idEmEdicao);
        if(!transacao) return;

        // Fecha modal de detalhes e prepara o de edição
        const modalDetalhes = bootstrap.Modal.getInstance(document.getElementById('modalDetalhes'));
        if(modalDetalhes) modalDetalhes.hide();
        
        document.getElementById('inputTipoMovimentacao').value = transacao.tipo;
        document.getElementById('inputValor').value = transacao.valor;
        document.getElementById('inputDescricao').value = transacao.descricao;
        document.getElementById('inputData').value = transacao.data;
        document.getElementById('selectPagamento').value = transacao.pagamento || 'Dinheiro';
        document.getElementById('selectCentroCusto').value = transacao.categoria;

        if (transacao.tipo === 'entrada') {
            document.getElementById('inputQuemPagou').value = transacao.pessoa;
        } else {
            document.getElementById('inputFornecedor').value = transacao.pessoa;
        }

        UI.toggleTipoModal(transacao.tipo);
        new bootstrap.Modal(document.getElementById('modalNovaMovimentacao')).show();
    },

    prepararNova: function() {
        this.idEmEdicao = null;
        document.getElementById('formMovimentacao').reset();
        
        // Define data de hoje como padrão
        document.getElementById('inputData').valueAsDate = new Date();
        
        UI.toggleTipoModal('entrada');
    },

    filtrarPorCategoria: function(slug, nome) {
        UI.estado.filtroCategoria = slug;
        
        const badge = document.getElementById("badgeFiltroAtual");
        if(badge) {
            badge.innerText = nome;
            badge.classList.remove("d-none");
            document.getElementById("btnLimparFiltro").classList.remove("d-none");
        }
        UI.atualizarTela();
    },
    
    limparFiltroCategoria: function() {
        UI.estado.filtroCategoria = 'todos';
        document.getElementById("badgeFiltroAtual").classList.add("d-none");
        document.getElementById("btnLimparFiltro").classList.add("d-none");
        UI.atualizarTela();
    },

    salvarNovoCentro: function() {
    // Dados Comuns
    const nome = document.getElementById('inputNomeCentro').value;
    const descricao = document.getElementById('inputDescricaoCentro').value;
    const tipoEl = document.querySelector('input[name="tipoCentro"]:checked');
    const tipo = tipoEl ? tipoEl.value : 'geral';

    if (!nome) return;

    // Objeto base
    let novoCentro = {
        id: Date.now(), // ID único temporário
        slug: nome.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
        nome,
        descricao,
        tipo,
        saldo: 0
    };

    // Pega dados específicos baseado no tipo
    if (tipo === 'lavoura') {
        novoCentro.area = document.getElementById('inputArea').value;
        novoCentro.unidade = document.getElementById('inputUnidade').value;
        novoCentro.cultura = document.getElementById('inputCultura').value;
    } else if (tipo === 'maquinas') {
        novoCentro.modelo = document.getElementById('inputModelo').value;
        novoCentro.ano = document.getElementById('inputAno').value;
        novoCentro.serial = document.getElementById('inputSerial').value;
    }

    // Salva no Repository
    Repository.adicionarCategoria(novoCentro);

    // Fecha modal e limpa
    bootstrap.Modal.getInstance(document.getElementById('modalNovoCentro')).hide();
    document.getElementById('formNovoCentro').reset();
    
    // Reseta visual para o padrão (Lavoura)
    UI.mudarTipoCentro('lavoura'); 
    
    UI.atualizarTela();
},
    
    abrirDetalhes: function(id) {
        this.idEmEdicao = id;
        const t = Repository.getAllTransacoes().find(item => item.id === id);
        if(!t) return;

        // Preenche Modal Detalhes
        document.getElementById('detalheDescricao').innerText = t.descricao;
        document.getElementById('detalheData').innerText = t.data.split('-').reverse().join('/');
        document.getElementById('detalhePagamento').innerText = t.pagamento || '-';
        document.getElementById('detalheCategoria').innerText = t.categoriaNome;
        document.getElementById('detalhePessoa').innerText = t.pessoa || '-';

        const elValor = document.getElementById('detalheValor');
        const elBadge = document.getElementById('detalheTipoBadge');
        const elIcone = document.getElementById('detalheIcone');
        const elIconeBg = document.getElementById('detalheIconeBg');
        const labelPessoa = document.getElementById('labelPessoa');

        if (t.tipo === 'entrada') {
            elValor.innerText = UI.formatarMoeda(t.valor);
            elValor.className = 'fw-bold m-0 text-success';
            elBadge.innerText = 'ENTRADA';
            elBadge.className = 'badge rounded-pill bg-success-subtle text-success px-3 py-1 mt-2 fs-xxs';
            elIcone.className = 'fa-solid fa-arrow-up fs-3 text-success';
            elIconeBg.style.backgroundColor = '#d1e7dd';
            labelPessoa.innerText = 'QUEM PAGOU?';
        } else {
            elValor.innerText = '- ' + UI.formatarMoeda(t.valor);
            elValor.className = 'fw-bold m-0 text-danger';
            elBadge.innerText = 'SAÍDA';
            elBadge.className = 'badge rounded-pill bg-danger-subtle text-danger px-3 py-1 mt-2 fs-xxs';
            elIcone.className = 'fa-solid fa-arrow-down fs-3 text-danger';
            elIconeBg.style.backgroundColor = '#f8d7da';
            labelPessoa.innerText = 'FORNECEDOR';
        }

        new bootstrap.Modal(document.getElementById('modalDetalhes')).show();
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    Controlador.init();
});