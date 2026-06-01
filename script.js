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

// ELEMENTOS DA INTERFACE
const telaLobby = document.getElementById('tela-lobby');
const cardInicial = document.querySelector('.card'); 
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
let jaEnvieiNestaRodada = false; // Evita envios duplicados no Firebase

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

    salaId = Math.floor(1000 + Math.random() * 9000).toString(); 
    meuIdUnico = "player_" + Date.now(); 
    souCriador = true;

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

        if (listaJogadores.length >= 6) { alert("A sala já está cheia (Máximo 6 jogadores)!"); return; }
        if (dados.status !== 'aguardando') { alert("O jogo nesta sala já começou!"); return; }

        salaRef.child('jogadores/' + meuIdUnico).set({
            nome: meuNome,
            pronto: false
        }).then(() => {
            conectarAoLobby();
        });
    });
}

function conectarAoLobby() {
    cardInicial.style.display = 'none'; 
    painelEspera.style.display = 'block'; 
    codigoSalaDisplay.textContent = salaId;

    database.ref('salas_adestop/' + salaId).on('value', (snapshot) => {
        if (!snapshot.exists()) return;
        const dados = snapshot.val();

        listaJogadoresElement.innerHTML = "";
        const jogadores = dados.jogadores ? Object.values(dados.jogadores) : [];
        
        qtdJogadoresElement.textContent = jogadores.length;

        jogadores.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.nome;
            listaJogadoresElement.appendChild(li);
        });

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

        // MONITORA ESTRUTURA DE TRANSIÇÃO DE TELAS
        if (dados.status === 'jogando') {
            irParaTelaJogo(dados.letra);
        } else if (dados.status === 'correcao') {
            // CORREÇÃO DO BUG 2: Se a sala foi para correção e eu ainda não enviei minhas respostas, envia agora!
            if (!jaEnvieiNestaRodada) {
                enviarRespostasLocais();
            }
            // Pequeno delay de 300ms para garantir que o Firebase recebeu o dado de todo mundo antes de desenhar a tabela
            setTimeout(() => {
                irParaTelaCorrecao(dados.letra, dados.jogadores);
            }, 300);
        } else if (dados.status === 'aguardando' && telaJogo.style.display === 'block') {
            location.reload(); 
        }
    });
}

// =================== LOGICA DO JOGO ATIVO ===================

function iniciarPartidaOficial() {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letraSorteada = letras[Math.floor(Math.random() * letras.length)];

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
    jaEnvieiNestaRodada = false; // Reseta o controle de envio para a nova rodada
    
    inputsCategoria.forEach(input => {
        input.value = "";
        input.disabled = false;
    });
    btnStop.disabled = false;
}

// CORREÇÃO DO BUG 1: Validar preenchimento antes de deixar dar STOP
function dispararStop() {
    let todosPreenchidos = true;

    inputsCategoria.forEach(input => {
        if (input.value.trim() === "") {
            todosPreenchidos = false;
        }
    });

    if (!todosPreenchidos) {
        alert("Você precisa preencher TODAS as categorias antes de bater STOP! 🛑");
        return; // Cancela a execução da função
    }

    btnStop.disabled = true;
    enviarRespostasLocais();

    // Modifica o status da sala na nuvem para travar a tela dos oponentes
    database.ref('salas_adestop/' + salaId).update({
        status: 'correcao'
    });
}

// Função isolada para coletar os inputs atuais e salvar no respectivo nó do jogador
function enviarRespostasLocais() {
    jaEnvieiNestaRodada = true;
    const minhasRespostas = {};
    
    inputsCategoria.forEach(input => {
        const categoria = input.getAttribute('data-categoria');
        minhasRespostas[categoria] = input.value.trim().toUpperCase();
    });

    database.ref('salas_adestop/' + salaId + '/jogadores/' + meuIdUnico).update({
        respostas: minhasRespostas
    });
}

// =================== LOGICA DA CORREÇÃO DINÂMICA ===================

function irParaTelaCorrecao(letra, objetoJogadores) {
    telaJogo.style.display = 'none';
    telaCorrecao.style.display = 'block';
    letraCorrecaoDisplay.textContent = letra;

    gradeCorrecao.innerHTML = ""; 

    const jogadoresIds = Object.keys(objetoJogadores);

    jogadoresIds.forEach(id => {
        const jogador = objetoJogadores[id];
        const respostas = jogador.respostas || { nome: "", animal: "", objeto: "", fruta: "", cor: "" };

        const coluna = document.createElement('div');
        coluna.className = 'coluna-jogador';
        
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

    if (souCriador) {
        btnProximaRodada.style.display = 'block';
    } else {
        btnProximaRodada.style.display = 'none';
    }
}

function reiniciarParaProximaRodada() {
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