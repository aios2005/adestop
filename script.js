const firebaseConfig = {
  apiKey: "AIzaSyBT-DOCnbFzUnyuM50GN44Al7q6NTszrE0",
  authDomain: "adestop-29519.firebaseapp.com",
  databaseURL: "https://adestop-29519-default-rtdb.firebaseio.com",
  projectId: "adestop-29519",
  storageBucket: "adestop-29519.firebasestorage.app",
  messagingSenderId: "385351023437",
  appId: "1:385351023437:web:9e732a2955a6849ef01504"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ELEMENTOS DA INTERFACE (Mapeados conforme o seu novo HTML)
const telaLobby = document.getElementById('tela-lobby');
const cardInicial = document.querySelector('.card'); // Card de criar/entrar
const painelEspera = document.getElementById('painel-espera');
const listaJogadoresElement = document.getElementById('lista-jogadores');
const qtdJogadoresElement = document.getElementById('qtd-jogadores');
const codigoSalaDisplay = document.getElementById('codigo-sala-display');
const btnIniciarJogo = document.getElementById('btn-iniciar-jogo');

const telaJogo = document.getElementById('tela-jogo');
const letraSorteadaElement = document.getElementById('letra-sorteada');
const inputsCategoria = document.querySelectorAll('.input-categoria');
const btnStop = document.getElementById('btn-stop');

const telaCorrecao = document.getElementById('tela-correcao');
const letraCorrecaoDisplay = document.getElementById('letra-correcao-display');
const gradeCorrecao = document.getElementById('grade-correcao');
const btnProximaRodada = document.getElementById('btn-proxima-rodada');

// ESTADO GLOBAL DO JOGADOR LOCAL
let salaId = null;
let meuNome = "";
let meuIdUnico = null;
let souCriador = false;

// OUVINTES DOS BOTÕES INICIAIS
document.getElementById('btn-criar-sala').addEventListener('click', criarSala);
document.getElementById('btn-entrar-sala').addEventListener('click', entrarSala);
btnStop.addEventListener('click', dispararStop);
btnIniciarJogo.addEventListener('click', iniciarPartidaOficial);
btnProximaRodada.addEventListener('click', reiniciarParaProximaRodada);

// =================== LOGICA DO LOBBY DINÂMICO ===================

function criarSala() {
    meuNome = document.getElementById('input-nome').value.trim();
    if (!meuNome) { alert("Digite seu nome primeiro!"); return; }

    salaId = Math.floor(1000 + Math.random() * 9000).toString(); // Sala com 4 dígitos
    meuIdUnico = "player_" + Date.now(); // Gera ID único por timestamp
    souCriador = true;

    // Estrutura dinâmica na nuvem
    database.ref('salas_adestop/' + salaId).set({
        status: 'aguardando',
        letra: '',
        criadorId: meuIdUnico,
        jogadores: {
            [meuIdUnico]: { nome: meuNome, pronto: false }
        }
    }).then(() => {
        conectarAoLobby();
    });
}

function entrarSala() {
    salaId = document.getElementById('input-sala').value.trim();
    meuNome = document.getElementById('input-nome').value.trim();

    if (!salaId || !meuNome) { alert("Preencha o código da sala e seu nome!"); return; }
    meuIdUnico = "player_" + Date.now();

    const salaRef = database.ref('salas_adestop/' + salaId);

    salaRef.once('value', (snapshot) => {
        if (!snapshot.exists()) { alert("Sala não encontrada!"); return; }
        
        const dados = snapshot.val();
        const listaJogadores = dados.jogadores ? Object.keys(dados.jogadores) : [];

        // Limitação dinâmica de vagas (Mínimo 2, Máximo 6)
        if (listaJogadores.length >= 6) { alert("A sala já está cheia (Máximo 6 jogadores)!"); return; }
        if (dados.status !== 'aguardando') { alert("O jogo nesta sala já começou!"); return; }

        // Injeta o novo jogador no array associativo do banco
        salaRef.child('jogadores/' + meuIdUnico).set({
            nome: meuNome,
            pronto: false
        }).then(() => {
            conectarAoLobby();
        });
    });
}

function conectarAoLobby() {
    cardInicial.style.display = 'none'; // Esconde painel de login
    painelEspera.style.display = 'block'; // Mostra painel com a lista viva
    codigoSalaDisplay.textContent = salaId;

    // Escuta em tempo real mudanças no Lobby
    database.ref('salas_adestop/' + salaId).on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        const dados = snapshot.val();

        // 1. Atualizar lista de jogadores visível
        listaJogadoresElement.innerHTML = "";
        const jogadores = dados.jogadores ? Object.values(dados.jogadores) : [];
        const ids = dados.jogadores ? Object.keys(dados.jogadores) : [];
        
        qtdJogadoresElement.textContent = jogadores.length;

        jogadores.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.nome;
            listaJogadoresElement.appendChild(li);
        });

        // 2. Controlar ativação do botão iniciar (Apenas o dono da sala pode iniciar)
        if (souCriador) {
            btnIniciarJogo.style.display = 'block';
            if (jogadores.length >= 2) {
                btnIniciarJogo.disabled = false;
                btnIniciarJogo.textContent = "INICIAR JOGO";
                document.getElementById('aviso-minimo').style.display = 'none';
            } else {
                btnIniciarJogo.disabled = true;
                btnIniciarJogo.textContent = "Aguardando Jogadores...";
                document.getElementById('aviso-minimo').style.display = 'block';
            }
        } else {
            btnIniciarJogo.style.display = 'none';
            document.getElementById('aviso-minimo').textContent = "Aguardando o criador iniciar o jogo...";
        }

        // 3. Monitorar transições de telas globais (Mudança de Estados do Jogo)
        if (dados.status === 'jogando') {
            irParaTelaJogo(dados.letra);
        } else if (dados.status === 'correcao') {
            irParaTelaCorrecao(dados.letra, dados.jogadores);
        } else if (dados.status === 'aguardando' && telaJogo.style.display === 'block') {
            // Se foi resetado para o lobby
            location.reload(); 
        }
    });
}

// =================== LOGICA DO JOGO ATIVO ===================

function iniciarPartidaOficial() {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letraSorteada = letras[Math.floor(Math.random() * letras.length)];

    // Altera o estado global na nuvem para disparar a tela de jogo para todos
    database.ref('salas_adestop/' + salaId).update({
        status: 'jogando',
        letra: letraSorteada
    });
}

function irParaTelaJogo(letra) {
    telaLobby.style.display = 'none';
    telaJogo.style.display = 'block';
    telaCorrecao.style.display = 'none';
    letraSorteadaElement.textContent = letra;
    
    // Libera inputs e limpa dados da rodada anterior
    inputsCategoria.forEach(input => {
        input.value = "";
        input.disabled = false;
    });
    btnStop.disabled = false;
}

function dispararStop() {
    btnStop.disabled = true;
    
    // Captura as respostas locais do jogador
    const minhasRespostas = {};
    inputsCategoria.forEach(input => {
        const categoria = input.getAttribute('data-categoria');
        minhasRespostas[categoria] = input.value.trim().toUpperCase(); // Padroniza em maiúsculo
    });

    // Envia minhas respostas para a minha subpasta na nuvem e puxa o gatilho de STOP global
    database.ref('salas_adestop/' + salaId + '/jogadores/' + meuIdUnico).update({
        respostas: minhasRespostas
    }).then(() => {
        database.ref('salas_adestop/' + salaId).update({
            status: 'correcao'
        });
    });
}

// =================== LOGICA DA CORREÇÃO DINÂMICA ===================

function irParaTelaCorrecao(letra, objetoJogadores) {
    telaJogo.style.display = 'none';
    telaCorrecao.style.display = 'block';
    letraCorrecaoDisplay.textContent = letra;

    gradeCorrecao.innerHTML = ""; // Limpa a tabela

    const jogadoresIds = Object.keys(objetoJogadores);

    // Renderização dinâmica baseada em quem está na sala (2 a 6 colunas automatizadas pelo CSS Grid)
    jogadoresIds.forEach(id => {
        const jogador = objetoJogadores[id];
        const respostas = jogador.respostas || { nome: "", animal: "", objeto: "", fruta: "", cor: "" };

        // Monta o elemento HTML da coluna daquele participante
        const coluna = document.createElement('div');
        coluna.className = 'coluna-jogador';
        
        // Destaca se a coluna for do próprio usuário logado
        if (id === meuIdUnico) {
            coluna.style.borderColor = '#eeff00';
        }

        coluna.innerHTML = `
            <div class="nome-coluna-titulo">${jogador.nome} ${id === meuIdUnico ? '(Você)' : ''}</div>
            <div class="item-resposta"><small>Nome</small><p>${respostas.nome || '-'}</p></div>
            <div class="item-resposta"><small>País</small><p>${respostas.animal || '-'}</p></div>
            <div class="item-resposta"><small>Cidade</small><p>${respostas.objeto || '-'}</p></div>
            <div class="item-resposta"><small>Adjetivo</small><p>${respostas.fruta || '-'}</p></div>
            <div class="item-resposta"><small>Personagem</small><p>${respostas.cor || '-'}</p></div>
        `;
        
        gradeCorrecao.appendChild(coluna);
    });

    // Apenas o criador vê o botão de reset/próxima rodada
    if (souCriador) {
        btnProximaRodada.style.display = 'block';
    } else {
        btnProximaRodada.style.display = 'none';
    }
}

function reiniciarParaProximaRodada() {
    // Limpa os nós de respostas anteriores do banco e joga o estado de volta para o Lobby
    database.ref('salas_adestop/' + salaId + '/jogadores').once('value', (snapshot) => {
        const jogadores = snapshot.val();
        for (let id in jogadores) {
            database.ref('salas_adestop/' + salaId + '/jogadores/' + id + '/respostas').remove();
        }
        database.ref('salas_adestop/' + salaId).update({
            status: 'aguardando',
            letra: ''
        });
    });
}