// 1. CAMADA DE DADOS

const MockBackendService = {
    // Chaves para salvar no navegador
    KEY_TRANSACOES: 'cultiva_transacoes',
    KEY_CATEGORIAS: 'cultiva_categorias',

    dadosIniciaisTransacoes: [], //Vazio, pro agricultor registrar os dados

    dadosIniciaisCategorias: [
        { slug: 'lavoura', nome: 'Lavoura (Geral)', tipo: 'lavoura' },
        { slug: 'maquinas', nome: 'Máquinas', tipo: 'maquinas' },
        { slug: 'geral', nome: 'Despesas Gerais', tipo: 'geral' }
    ],

    // Carrega do LocalStorage ou usa os iniciais
    database: [],
    categorias: [],

    init: function() {
        const transacoesSalvas = localStorage.getItem(this.KEY_TRANSACOES);
        const categoriasSalvas = localStorage.getItem(this.KEY_CATEGORIAS);

        if (transacoesSalvas) {
            this.database = JSON.parse(transacoesSalvas);
        } else {
            // Se não tem nada salvo, pega o array vazio que foi definido acima
            this.database = this.dadosIniciaisTransacoes;
            this.salvarLocal(); 
        }

        if (categoriasSalvas) {
            this.categorias = JSON.parse(categoriasSalvas);
        } else {
            this.categorias = this.dadosIniciaisCategorias;
            this.salvarCategoriasLocal();
        }
    },
    
    salvarLocal: function() {
        localStorage.setItem(this.KEY_TRANSACOES, JSON.stringify(this.database));
    },

    salvarCategoriasLocal: function() {
        localStorage.setItem(this.KEY_CATEGORIAS, JSON.stringify(this.categorias));
    },

    //MÉTODOS DE API

    getDashboardData: function(filtroCategoria = 'todos', termoBusca = '') {
        // Garante que carregou os dados
        if (this.database.length === 0 && this.categorias.length === 0) this.init();

        let totalReceitas = 0;
        let totalDespesas = 0;
        
        this.database.forEach(t => {
            if (t.tipo === 'entrada') totalReceitas += t.valor;
            else totalDespesas += t.valor;
        });

        const mapaCentros = {};
        this.categorias.forEach(cat => {
            mapaCentros[cat.slug] = {
                slug: cat.slug, nome: cat.nome, tipo: cat.tipo, saldo: 0
            };
        });
        
        this.database.forEach(t => {
            if (mapaCentros[t.categoria]) {
                if (t.tipo === 'entrada') mapaCentros[t.categoria].saldo += t.valor;
                else mapaCentros[t.categoria].saldo -= t.valor;
            }
        });

        const transacoesFiltradas = this.database.filter(t => {
            const passaFiltroCat = filtroCategoria === 'todos' || t.categoria === filtroCategoria;
            const passaBusca = termoBusca === '' || 
                               t.descricao.toLowerCase().includes(termoBusca) || 
                               t.pessoa.toLowerCase().includes(termoBusca);
            return passaFiltroCat && passaBusca;
        });

        transacoesFiltradas.sort((a, b) => new Date(b.data) - new Date(a.data));

        return {
            resumo: { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas },
            centrosDeCusto: Object.values(mapaCentros),
            transacoes: transacoesFiltradas,
            todasCategorias: this.categorias
        };
    },

    adicionarTransacao: function(transacao) {
        if (this.database.length === 0) this.init();
        transacao.id = Date.now();
        // Marca como pendente de sincronização
        transacao.syncStatus = 'pendente'; 
        this.database.unshift(transacao);
        this.salvarLocal();
    },

    atualizarTransacao: function(transacaoAtualizada) {
        const index = this.database.findIndex(t => t.id === transacaoAtualizada.id);
        if (index !== -1) {
            transacaoAtualizada.syncStatus = 'pendente';
            this.database[index] = transacaoAtualizada;
            this.salvarLocal(); 
        }
    },

    removerTransacao: function(id) {
        this.database = this.database.filter(t => t.id !== id);
        this.salvarLocal(); // 
    },

    adicionarCategoria: function(nome, tipo) {
        if (this.categorias.length === 0) this.init();
        const slug = nome.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        const novaCat = { slug, nome, tipo };
        this.categorias.push(novaCat);
        this.salvarCategoriasLocal();
        return novaCat;
    }
};

// 2. CAMADA DE INTERFACE (VIEW)


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
        const dados = MockBackendService.getDashboardData(this.estado.filtroCategoria, this.estado.termoBusca);

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

        listaCentros.forEach(centro => {
            const isAtivo = this.estado.filtroCategoria === centro.slug ? 'active' : '';
            const corValor = centro.saldo >= 0 ? 'text-success' : 'text-danger';
            
            // Ícones baseados no tipo
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

    // Atualiza o <select> do modal de nova movimentação
    atualizarDropdownCentros: function(categorias) {
        const select = this.elementos.selectCentroCusto;
        if(!select) return;

        // Salva o valor atual caso esteja editando
        const valorAtual = select.value;

        select.innerHTML = '<option value="" disabled selected>Selecione...</option>';
        
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.slug;
            option.text = cat.nome;
            select.appendChild(option);
        });

        // Tenta restaurar o valor selecionado
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

            const html = `
                <div class="card card-transaction cursor-pointer mb-2" onclick="Controlador.abrirDetalhes(${t.id})">
                  <div class="card-body p-3 d-flex justify-content-between align-items-center ${corBorda}">
                    <div>
                      <div class="d-flex align-items-center gap-2 mb-1">
                        <span class="fw-bold text-dark">${t.descricao}</span>
                      </div>
                      <div class="text-muted small text-date">${t.categoriaNome} • ${dataF}</div>
                    </div>
                    <div class="text-end">
                      <div class="fw-bold ${corTexto} mb-1">${sinal}${this.formatarMoeda(t.valor)}</div>
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

        //Salvar novo centro de custo
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
    }
};

// 3. CONTROLADOR


const Controlador = {
    idEmEdicao: null,

    filtrarPorCategoria: function(slug, nome) {
        UI.estado.filtroCategoria = slug;
        
        const badge = document.getElementById("badgeFiltroAtual");
        const btnLimpar = document.getElementById("btnLimparFiltro");
        
        if(badge) {
            badge.innerText = nome;
            badge.classList.remove("d-none");
        }
        if(btnLimpar) btnLimpar.classList.remove("d-none");

        UI.atualizarTela();
    },

    limparFiltroCategoria: function() {
        UI.estado.filtroCategoria = 'todos';
        document.getElementById("badgeFiltroAtual").classList.add("d-none");
        document.getElementById("btnLimparFiltro").classList.add("d-none");
        UI.atualizarTela();
    },

    prepararNova: function() {
        this.idEmEdicao = null;
        document.getElementById('formMovimentacao').reset();
        UI.toggleTipoModal('entrada');
    },

    prepararEdicao: function() {
        const transacao = MockBackendService.database.find(t => t.id === this.idEmEdicao);
        if(!transacao) return;

        bootstrap.Modal.getInstance(document.getElementById('modalDetalhes')).hide();
        
        document.getElementById('inputTipoMovimentacao').value = transacao.tipo;
        document.getElementById('inputValor').value = transacao.valor;
        document.getElementById('inputDescricao').value = transacao.descricao;
        document.getElementById('inputData').value = transacao.data;
        document.getElementById('selectPagamento').value = transacao.pagamento;
        document.getElementById('selectCentroCusto').value = transacao.categoria;

        if (transacao.tipo === 'entrada') {
            document.getElementById('inputQuemPagou').value = transacao.pessoa;
        } else {
            document.getElementById('inputFornecedor').value = transacao.pessoa;
        }

        UI.toggleTipoModal(transacao.tipo);
        new bootstrap.Modal(document.getElementById('modalNovaMovimentacao')).show();
    },

    salvarTransacao: function() {
        const tipo = document.getElementById('inputTipoMovimentacao').value;
        const valor = parseFloat(document.getElementById('inputValor').value);
        const descricao = document.getElementById('inputDescricao').value;
        const data = document.getElementById('inputData').value;
        const pagamento = document.getElementById('selectPagamento').value;
        
        const select = document.getElementById('selectCentroCusto');
        const categoria = select.value;
        const categoriaNome = select.options[select.selectedIndex].text;
        
        let pessoa = "";
        
        if (tipo === 'entrada') {
            pessoa = document.getElementById('inputQuemPagou').value;
        } else {
            pessoa = document.getElementById('inputFornecedor').value;
        }

        const objetoTransacao = {
            id: this.idEmEdicao || null, 
            tipo, valor, descricao, data, pagamento, pessoa, categoria, categoriaNome,
            usuario: 'Admin'
        };

        if (this.idEmEdicao) {
            MockBackendService.atualizarTransacao(objetoTransacao);
        } else {
            MockBackendService.adicionarTransacao(objetoTransacao);
        }

        bootstrap.Modal.getInstance(document.getElementById('modalNovaMovimentacao')).hide();
        UI.atualizarTela();
    },

    //Função chamada pelo form do modal novo centro
    salvarNovoCentro: function() {
        const nome = document.getElementById('inputNomeCentro').value;
        // Pega qual radio button está marcado
        const tipo = document.querySelector('input[name="tipoCentro"]:checked').value;

        if(nome) {
            MockBackendService.adicionarCategoria(nome, tipo);
            
            // Fecha o modal
            bootstrap.Modal.getInstance(document.getElementById('modalNovoCentro')).hide();
            
            // Reseta o form para a proxima vez
            document.getElementById('formNovoCentro').reset();
            
            //Vai aparecer o card novo e atualizar o select
            UI.atualizarTela();
        }
    },

    excluirTransacao: function() {
        if(confirm('Deseja excluir esta movimentação?')) {
            MockBackendService.removerTransacao(this.idEmEdicao);
            bootstrap.Modal.getInstance(document.getElementById('modalDetalhes')).hide();
            UI.atualizarTela();
        }
    },

    abrirDetalhes: function(id) {
        this.idEmEdicao = id;
        const t = MockBackendService.database.find(item => item.id === id);
        
        document.getElementById('detalheDescricao').innerText = t.descricao;
        document.getElementById('detalheData').innerText = t.data.split('-').reverse().join('/');
        document.getElementById('detalhePagamento').innerText = t.pagamento;
        document.getElementById('detalheCategoria').innerText = t.categoriaNome;
        document.getElementById('detalhePessoa').innerText = t.pessoa;

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

document.addEventListener('DOMContentLoaded', () => {
    UI.inicializar();
});