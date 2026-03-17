const CloudAPI = {
    baseURL: 'http://localhost:3000', 
    
    agricultorId: "145837fc-ecec-497e-9ef5-7d8c5c4639cc",

    buscarCentrosCusto: async () => {
        const response = await fetch(`${CloudAPI.baseURL}/centro-custo`);
        if (!response.ok) throw new Error('Erro ao buscar centros de custo');
        return await response.json();
    },

    criarCentroCusto: async (dadosFront) => {
        const payload = {
            nome: dadosFront.nome,
            descricao: dadosFront.descricao || "",
            agricultorId: CloudAPI.agricultorId
        };

        const response = await fetch(`${CloudAPI.baseURL}/centro-custo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erro ao criar centro de custo');
        }
        return await response.json();
    },

    sincronizarMovimentacoes: async (movimentacoes) => {
    // Filtra apenas os campos que o Zod espera para evitar lixo no payload
        const payloadBanco = movimentacoes.map(mov => ({
        syncId: mov.id, 
        tipo: mov.tipo.toUpperCase(),
        valor: mov.valor,
        descricao: mov.descricao,
        dataMovimento: mov.dataMovimento,
        formaPagamento: mov.formaPagamento,
        entidade: mov.entidade || undefined, // Zod diz que é optional()
        centroCustoId: mov.centroCustoId,
        agricultorId: mov.agricultorId
    }));

    const response = await fetch(`${CloudAPI.baseURL}/movimentacoes/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBanco) 
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro de validação do Zod:", errorData);
        throw new Error('Falha ao sincronizar dados com o servidor.');
    }

    return await response.json();
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

    baixarCentrosDeCustoOficiais: async function() {
        try {
            const centrosDoBanco = await CloudAPI.buscarCentrosCusto();
            
            const centrosFormatados = centrosDoBanco.map(c => ({
                id: c.id,          // UUID
                slug: c.id,        // UUID para o <select> usar ele
                nome: c.nome,
                descricao: c.descricao,
                tipo: 'geral',     // 
                saldo: 0           // Será calculado dinamicamente
            }));

            // Sobrescreve as categorias mockadas ("lavoura", "maquinas") pelos dados reais
            localStorage.setItem(Repository.KEY_CATEGORIAS, JSON.stringify(centrosFormatados));
            UI.atualizarTela();
            
        } catch (error) {
            console.error("Aviso: Não foi possível baixar os centros de custo atualizados.", error);
        }
    },

    tentarSincronizar: async function() {
    if (!this.isOnline) return;

    // Busca todas as transações que ainda não foram enviadas
    const pendentes = Repository.getAllTransacoes().filter(t => t.syncStatus === 'pendente');

    if (pendentes.length === 0) return;

    UI.mostrarCarregandoSync(true);

    try {
        // Envia TODAS as pendentes de uma vez só!
        const resultado = await CloudAPI.sincronizarMovimentacoes(pendentes);
        console.log(resultado.message); // "Sincronização concluída!"
        
        // Se deu certo, atualiza o status de todas para 'sincronizado' (aparece o check verde)
        pendentes.forEach(item => {
            Repository.atualizarStatusSync(item.id, 'sincronizado');
        });

    } catch (error) {
        console.error("Falha na sincronização", error);
    }
    
    UI.mostrarCarregandoSync(false);
    UI.atualizarTela();
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

        this.prepararModalRelatorio(dados.todasCategorias, dados.transacoes);
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
                <div class="card card-transaction cursor-pointer mb-2" onclick="Controlador.abrirDetalhes('${t.id}')">
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
        document.getElementById('btnGerarRelatorio')?.addEventListener('click', () => Controlador.gerarRelatorio());
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

    prepararModalRelatorio: function(categorias, transacoes) {
        const containerCentros = document.getElementById('listaFiltroCentros');
        const selectColaborador = document.getElementById('relatorioColaborador');
        if(!containerCentros || !selectColaborador) return;

        // 1. Renderiza os Centros de Custo dinamicamente
        containerCentros.innerHTML = '';
        categorias.forEach(cat => {
            containerCentros.innerHTML += `
                <input type="checkbox" class="btn-check check-centro-relatorio" id="tagRel_${cat.slug}" value="${cat.slug}" autocomplete="off" checked>
                <label class="btn btn-outline-secondary rounded-pill fs-xs text-nowrap px-3" for="tagRel_${cat.slug}">${cat.nome}</label>
            `;
        });

        // Lógica do switch "Selecionar Todos"
        const checkTodos = document.getElementById('checkTodosCentros');
        const checksIndividuais = document.querySelectorAll('.check-centro-relatorio');

        checkTodos.onchange = (e) => {
            checksIndividuais.forEach(chk => chk.checked = e.target.checked);
        };

        checksIndividuais.forEach(chk => {
            chk.onchange = () => {
                const todosMarcados = Array.from(checksIndividuais).every(c => c.checked);
                checkTodos.checked = todosMarcados;
            };
        });

        // 2. Extrai os colaboradores únicos das transações
        // Puxando do campo "usuario" (você pode mudar para "pessoa" se preferir)
        const colaboradoresUnicos = [...new Set(transacoes.map(t => t.usuario).filter(Boolean))];
        
        selectColaborador.innerHTML = '<option value="todos" selected>Todos os colaboradores</option>';
        colaboradoresUnicos.forEach(colab => {
            selectColaborador.innerHTML += `<option value="${colab}">${colab}</option>`;
        });
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
    const tipoFront = document.getElementById('inputTipoMovimentacao').value; // 'entrada' ou 'saida'
    const valor = parseFloat(document.getElementById('inputValor').value);
    
    if(isNaN(valor) || valor <= 0) { 
        alert('Digite um valor maior que zero'); 
        return; 
    }
    
    const descricao = document.getElementById('inputDescricao').value;
    const dataInput = document.getElementById('inputData').value; 
    const pagamento = document.getElementById('selectPagamento').value;
    
    const select = document.getElementById('selectCentroCusto');
    const centroCustoId = select.value; // Agora isso é o UUID real
    const categoriaNome = select.options[select.selectedIndex].text;
    
    let entidade = tipoFront === 'entrada' 
        ? document.getElementById('inputQuemPagou').value 
        : document.getElementById('inputFornecedor').value;

    // Converte a data do input (YYYY-MM-DD) para ISO-8601 (exigência do Zod datetime)
    // O Zod exige o formato completo com horário, ex: "2026-02-24T00:00:00.000Z"
    const dataMovimentoISO = new Date(`${dataInput}T00:00:00`).toISOString();

    // Cria o objeto da transação misturando dados para a Tela e dados para a API
        const objetoTransacao = {
        id: this.idEmEdicao || crypto.randomUUID(), 
        tipo: tipoFront, // Mantém 'entrada' ou 'saida' minúsculo pro front-end funcionar
        valor,
        descricao, 
        data: dataInput, // Mantém para mostrar na tela facilmente
        dataMovimento: dataMovimentoISO, // Para a API
        pagamento, // Tela
        formaPagamento: pagamento, // Zod
        pessoa: entidade, // Tela
        entidade: entidade, // Zod
        categoria: centroCustoId, // Tela vincula com o <select>
        centroCustoId: centroCustoId, // Zod
        categoriaNome, 
        usuario: 'Admin',
        agricultorId: CloudAPI.agricultorId // Pega o ID temporário que definimos
    };

    Repository.salvarTransacao(objetoTransacao);

    const modalNova = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovaMovimentacao')); modalNova.hide();    
    UI.atualizarTela();
},

    excluirTransacao: function() {
        if(confirm('Deseja excluir esta movimentação?')) {
            Repository.removerTransacao(this.idEmEdicao);
            
            // Fecha o modal garantindo que a instância existe
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetalhes'));
            modal.hide();
            
            UI.atualizarTela();
        }
    },
    
    prepararEdicao: function() {
        const todas = Repository.getAllTransacoes(); 
        const transacao = todas.find(t => t.id === this.idEmEdicao);
        if(!transacao) return;

        // Fecha o modal de detalhes com segurança antes de abrir o próximo
        const modalDetalhes = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalDetalhes'));
        modalDetalhes.hide();
        
        // Preenche os dados no formulário
        document.getElementById('inputTipoMovimentacao').value = transacao.tipo;
        document.getElementById('inputValor').value = transacao.valor;
        document.getElementById('inputDescricao').value = transacao.descricao;
        document.getElementById('inputData').value = transacao.data;
        document.getElementById('selectPagamento').value = transacao.pagamento || 'Dinheiro';
        document.getElementById('selectCentroCusto').value = transacao.categoria;

        if (transacao.tipo === 'entrada') {
            document.getElementById('inputQuemPagou').value = transacao.pessoa || '';
        } else {
            document.getElementById('inputFornecedor').value = transacao.pessoa || '';
        }

        UI.toggleTipoModal(transacao.tipo);
        
        // Abre o modal de edição corretamente
        const modalNova = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovaMovimentacao'));
        modalNova.show();
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

    salvarNovoCentro: async function() {
    const nome = document.getElementById('inputNomeCentro').value;
    const descricao = document.getElementById('inputDescricaoCentro').value;
    const tipoEl = document.querySelector('input[name="tipoCentro"]:checked');
    const tipo = tipoEl ? tipoEl.value : 'geral';

    if (!nome) return;

    // Verifica se tem internet (não deixamos criar Categoria offline para evitar conflitos de ID)
    if (!SyncService.isOnline) {
        alert("Você precisa de conexão com a internet para criar um novo Centro de Custo.");
        return;
    }

    // Muda o texto do botão para dar feedback pro usuário
    const btn = document.getElementById('btnCriarCentro');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        // Manda pro Back-end real
        const novoCentroDB = await CloudAPI.criarCentroCusto({ nome, descricao });

        const centroFront = {
            id: novoCentroDB.id, // UUID gerado pelo banco
            slug: novoCentroDB.id, // Usado no <select> de transações
            nome: novoCentroDB.nome,
            descricao: novoCentroDB.descricao,
            tipo: tipo,
            saldo: 0
        };

        // Salva localmente
        Repository.adicionarCategoria(centroFront);

        // Limpa e fecha Modal
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoCentro')).hide();        document.getElementById('formNovoCentro').reset();
        UI.mudarTipoCentro('lavoura'); 
        UI.atualizarTela();

    } catch (error) {
        alert(error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
    },

   gerarRelatorio: async function() {
        // 1. Captura os filtros
        const dataInicio = document.getElementById('relatorioDataInicio').value;
        const dataFim = document.getElementById('relatorioDataFim').value;
        const colaborador = document.getElementById('relatorioColaborador').value;
        const formato = document.getElementById('relatorioFormato').value;
        const incluirGrafico = document.getElementById('checkIncluirGrafico').checked;
        
        const checksCentros = document.querySelectorAll('.check-centro-relatorio:checked');
        const centrosSelecionados = Array.from(checksCentros).map(chk => chk.value);

        if(centrosSelecionados.length === 0) {
            alert('Por favor, selecione pelo menos um Centro de Custo.');
            return;
        }

        // 2. Filtra os dados
        let transacoesFiltradas = Repository.getAllTransacoes().filter(t => {
            if (!centrosSelecionados.includes(t.categoria)) return false;
            if (dataInicio && t.data < dataInicio) return false;
            if (dataFim && t.data > dataFim) return false;
            if (colaborador !== 'todos' && t.usuario !== colaborador) return false;
            return true;
        });

        if (transacoesFiltradas.length === 0) {
            alert('Nenhuma movimentação encontrada para o período selecionado.');
            return;
        }

        transacoesFiltradas.sort((a, b) => new Date(a.data) - new Date(b.data));

        // 3. Cálculos Avançados (Total, Lucro por Centro e Despesas por Centro)
        let totalEntradas = 0;
        let totalSaidas = 0;
        const lucrosPorCentro = {};
        const despesasPorCentro = {};

        transacoesFiltradas.forEach(t => {
            if (!lucrosPorCentro[t.categoriaNome]) lucrosPorCentro[t.categoriaNome] = 0;
            if (!despesasPorCentro[t.categoriaNome]) despesasPorCentro[t.categoriaNome] = 0;

            if (t.tipo === 'entrada') {
                totalEntradas += t.valor;
                lucrosPorCentro[t.categoriaNome] += t.valor;
            } else {
                totalSaidas += t.valor;
                lucrosPorCentro[t.categoriaNome] -= t.valor;
                despesasPorCentro[t.categoriaNome] += t.valor;
            }
        });

        // 4. Prepara o Subtítulo
        const strPeriodo = `Período: ${dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início'} até ${dataFim ? dataFim.split('-').reverse().join('/') : 'Hoje'}`;
        const strColaborador = `Colaborador: ${colaborador === 'todos' ? 'Todos' : colaborador}`;
        document.getElementById('rfSubtitulo').innerText = `${strPeriodo} | ${strColaborador}`;

        // 5. Lida com os Gráficos (Chart.js)
        const canvasBarras = document.getElementById('canvasGraficoBarras');
        const canvasPizza = document.getElementById('canvasGraficoPizza');
        const graficosContainer = document.getElementById('rfGraficosContainer');
        
        if(window.graficoBarras) window.graficoBarras.destroy();
        if(window.graficoPizza) window.graficoPizza.destroy();

        if (incluirGrafico && (totalEntradas > 0 || totalSaidas > 0)) {
            graficosContainer.style.display = 'flex';

            // CORREÇÃO: Forçar dimensões explicitamente pro Chart.js não se perder na div invisível
            canvasBarras.width = 450;
            canvasBarras.height = 300;
            canvasPizza.width = 450;
            canvasPizza.height = 300;

            // --- GRÁFICO 1: Barras ---
            window.graficoBarras = new Chart(canvasBarras, {
                type: 'bar',
                data: {
                    labels: ['Balanço Geral'],
                    datasets: [
                        { label: 'Entradas', data: [totalEntradas], backgroundColor: '#198754' },
                        { label: 'Saídas', data: [totalSaidas], backgroundColor: '#dc3545' }
                    ]
                },
                options: { 
                    animation: false,
                    responsive: false, // CORREÇÃO: Remove a dependência do CSS/DOM
                    maintainAspectRatio: false,
                    plugins: { 
                        title: { display: true, text: 'Entradas vs Saídas', font: { size: 16 } },
                        legend: { display: true } 
                    },
                    scales: { y: { beginAtZero: true } }
                }
            });

            // --- GRÁFICO 2: Pizza ---
            const labelsDespesas = Object.keys(despesasPorCentro).filter(k => despesasPorCentro[k] > 0);
            const dataDespesas = labelsDespesas.map(k => despesasPorCentro[k]);
            const paletaCores = ['#f6c23e', '#e74a3b', '#4e73df', '#1cc88a', '#36b9cc', '#858796', '#fd7e14', '#6f42c1'];

            if (dataDespesas.length > 0) {
                canvasPizza.style.display = 'block';
                window.graficoPizza = new Chart(canvasPizza, {
                    type: 'pie',
                    data: {
                        labels: labelsDespesas,
                        datasets: [{ data: dataDespesas, backgroundColor: paletaCores, borderWidth: 1, borderColor: '#fff' }]
                    },
                    options: { 
                        animation: false,
                        responsive: false, // CORREÇÃO: Remove a dependência do CSS/DOM
                        maintainAspectRatio: false, 
                        plugins: { title: { display: true, text: 'Despesas Por Centro de Custo', font: { size: 16 } } }
                    }
                });
            } else {
                canvasPizza.style.display = 'none';
            }

        } else {
            graficosContainer.style.display = 'none';
        }

        // Aguarda renderização dos canvas
        await new Promise(r => setTimeout(r, 150)); 

        // 6. Gera PDF ou PNG
        if (formato === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape'); 
            
            doc.setFontSize(22);
            doc.setTextColor(15, 81, 50);
            doc.text('Relatório de Custos - Cultiva', 14, 20);
            
            doc.setFontSize(11);
            doc.setTextColor(100, 100, 100);
            doc.text(`${strPeriodo} | ${strColaborador}`, 14, 28);

            let startY = 38;

            if (incluirGrafico) {
                const margem = 14;
                const espacoMeio = 10;
                const larguraMaxGrafico = (297 - (margem * 2) - espacoMeio) / 2; 

                const imgBarras = canvasBarras.toDataURL('image/png', 1.0);
                
                // CORREÇÃO: Lendo propriedades direto do canvas em vez do doc.getImageProperties()
                const alturaPdfBarras = (canvasBarras.height * larguraMaxGrafico) / canvasBarras.width;
                
                doc.addImage(imgBarras, 'PNG', margem, startY, larguraMaxGrafico, alturaPdfBarras);
                
                let alturaPdfPizza = 0;
                const labelsDespesas = Object.keys(despesasPorCentro).filter(k => despesasPorCentro[k] > 0);
                
                if (labelsDespesas.length > 0) {
                    const imgPizza = canvasPizza.toDataURL('image/png', 1.0);
                    alturaPdfPizza = (canvasPizza.height * larguraMaxGrafico) / canvasPizza.width;
                    
                    doc.addImage(imgPizza, 'PNG', margem + larguraMaxGrafico + espacoMeio, startY, larguraMaxGrafico, alturaPdfPizza);
                }
                
                const maiorAltura = Math.max(alturaPdfBarras, alturaPdfPizza);
                startY += maiorAltura + 15; 
            }

            // Tabela 
            const dadosTabela = transacoesFiltradas.map(t => [
                t.data.split('-').reverse().join('/'), 
                t.descricao, 
                t.categoriaNome, 
                t.pagamento || '-', 
                t.tipo === 'entrada' ? UI.formatarMoeda(t.valor) : `- ${UI.formatarMoeda(t.valor)}`
            ]);

            doc.autoTable({
                startY: startY,
                head: [['Data', 'Descrição', 'Centro de Custo', 'Pagamento', 'Valor']],
                body: dadosTabela,
                theme: 'striped',
                headStyles: { 
                    fillColor: [25, 135, 84], 
                    textColor: 255,
                    halign: 'center' 
                },
                columnStyles: {
                    0: { halign: 'center' },
                    1: { halign: 'left' },
                    2: { halign: 'center' },
                    3: { halign: 'center' },
                    4: { halign: 'right', fontStyle: 'bold' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 4) {
                        if (data.cell.raw.toString().includes('-')) {
                            data.cell.styles.textColor = [220, 53, 69]; // Vermelho
                        } else {
                            data.cell.styles.textColor = [25, 135, 84]; // Verde
                        }
                    }
                }
            });

            const finalY = doc.lastAutoTable.finalY || startY;
            const margemDireita = 283; 
            
            // Rodapé
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100); 
            doc.text(`Entradas: ${UI.formatarMoeda(totalEntradas)}      Saídas: ${UI.formatarMoeda(totalSaidas)}`, margemDireita, finalY + 15, { align: 'right' });
            
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            const saldoGeral = totalEntradas - totalSaidas;
            if (saldoGeral >= 0) {
                doc.setTextColor(25, 135, 84); // Verde
            } else {
                doc.setTextColor(220, 53, 69); // Vermelho
            }
            doc.text(`Saldo Total: ${UI.formatarMoeda(saldoGeral)}`, margemDireita, finalY + 25, { align: 'right' });

            doc.save(`Cultiva_Relatorio_${new Date().getTime()}.pdf`);

        } else if (formato === 'png') {
            let htmlTabela = `<table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px;">
                <tr style="background-color: #198754; color: white;">
                    <th style="padding: 10px; text-align: left;">Data</th>
                    <th style="padding: 10px; text-align: left;">Descrição</th>
                    <th style="padding: 10px; text-align: center;">Centro de Custo</th>
                    <th style="padding: 10px; text-align: center;">Pagamento</th>
                    <th style="padding: 10px; text-align: right;">Valor</th>
                </tr>`;
            
            transacoesFiltradas.forEach((t, i) => {
                const bg = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
                const corText = t.tipo === 'entrada' ? '#198754' : '#dc3545';
                const sinal = t.tipo === 'entrada' ? '' : '- ';
                htmlTabela += `<tr style="background-color: ${bg}; border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${t.data.split('-').reverse().join('/')}</td>
                    <td style="padding: 10px;">${t.descricao}</td>
                    <td style="padding: 10px; text-align: center;">${t.categoriaNome}</td>
                    <td style="padding: 10px; text-align: center;">${t.pagamento || '-'}</td>
                    <td style="padding: 10px; text-align: right; color: ${corText}; font-weight: bold;">${sinal}${UI.formatarMoeda(t.valor)}</td>
                </tr>`;
            });
            
            htmlTabela += `</table>
            <div style="margin-top: 20px; font-family: sans-serif; text-align: right; font-size: 16px;">
                <span style="margin-right: 20px; color: #666;">Entradas: <strong>${UI.formatarMoeda(totalEntradas)}</strong></span>
                <span style="margin-right: 20px; color: #666;">Saídas: <strong>${UI.formatarMoeda(totalSaidas)}</strong></span>
                <br><br>
                <strong>Saldo Total: <span style="color: ${totalEntradas - totalSaidas >= 0 ? '#198754' : '#dc3545'}">${UI.formatarMoeda(totalEntradas - totalSaidas)}</span></strong>
            </div>`;

            document.getElementById('rfTabelaContainer').innerHTML = htmlTabela;

            const elementoFantasma = document.getElementById('relatorioFantasma');
            elementoFantasma.style.display = 'block'; 
            
            await new Promise(r => setTimeout(r, 300)); 
            
            const canvasImg = await html2canvas(elementoFantasma, { 
                scale: 2, 
                scrollY: -window.scrollY, 
                windowHeight: elementoFantasma.scrollHeight, 
                height: elementoFantasma.scrollHeight 
            }); 
            
            elementoFantasma.style.display = 'none'; 
            
            const link = document.createElement('a');
            link.download = `Cultiva_Relatorio_${new Date().getTime()}.png`;
            link.href = canvasImg.toDataURL('image/png');
            link.click();
        }

        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalRelatorio')).hide();
    },
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    Controlador.init();
});