// Importar os serviços do Firebase necessários
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuração do Firebase ---
// A variável firebaseConfig é importada do arquivo firebase-config.js no HTML

let db, auth, userId, appId;
let sessionUnsubscribe = null; // Para limpar o listener do Firestore

// Estado da sessão do jogo
let currentSessionId = null;
let isCreator = false;
let sessionData = null; // Cópia local dos dados da sessão
let currentCategoryKey = null; // Categoria sendo gerenciada
let currentEditIndex = null; // Índice do item sendo editado

// --- Lista de Usuários Autorizados ---
const allowedEmails = [
    "jeffersonsenarn@gmail.com",       // <-- TROQUE PELO SEU E-MAIL
    "jessicaminern@gmail.com",          // <-- COLOQUE OS E-MAILS REAIS AQUI
    "jeffersonwillamern@gmail.com",
    "pedrobilau177@gmail.com",
    "ellydapereira124@gmail.com"

];

// --- Elementos de UI Globais ---
// (Serão inicializados no DOMContentLoaded)
let screens = {};
let elements = {};
let buttons = {};

// --- Dados Locais (para criar novas sessões) ---
// (O CRUD ainda edita estes dados)
let appData = {};
const defaultData = {
    "Hobbies": [
        { name: "Ler 📚", image: "https://placehold.co/400x250/A9D8E5/333?text=Ler" },
        { name: "Correr 🏃", image: "https://placehold.co/400x250/C1E1C1/333?text=Correr" },
        { name: "Cozinhar 🍳", image: "https://placehold.co/400x250/FFDDC1/333?text=Cozinhar" },
        { name: "Viajar ✈️", image: "https://placehold.co/400x250/D4A5A5/333?text=Viajar" },
        { name: "Tocar Violão 🎸", image: "https://placehold.co/400x250/F0E68C/333?text=Tocar+Viol%C3%A3o" }
    ],
    "Comidas": [
        { name: "Pizza 🍕", image: "https://placehold.co/400x250/E5A9A9/333?text=Pizza" },
        { name: "Hambúrguer 🍔", image: "https://placehold.co/400x250/E5C2A9/333?text=Hamb%C3%BArguer" },
        { name: "Sushi 🍣", image: "https://placehold.co/400x250/A9E5E0/333?text=Sushi" },
        { name: "Salada 🥗", image: "https://placehold.co/400x250/A9E5B2/333?text=Salada" },
        { name: "Churrasco 🥩", image: "https://placehold.co/400x250/E5A9C2/333?text=Churrasco" }
    ]
};

// --- Funções de Persistência (AGORA COM FIRESTORE) ---

/**
 * Ouve as mudanças nos dados do aplicativo (listas) do Firestore.
 * Esta função substitui o antigo loadLocalData.
 */
function listenToAppData() {
    const appDataRef = doc(db, "app-data", "lists");

    onSnapshot(appDataRef, (docSnap) => {
        if (docSnap.exists()) {
            appData = docSnap.data();
            console.log("Dados de listas sincronizados do Firestore:", appData);
        } else {
            // Se o documento não existir, cria com os dados padrão
            console.log("Nenhum dado de lista encontrado no Firestore. Criando com dados padrão...");
            appData = JSON.parse(JSON.stringify(defaultData));
            saveAppData(); // Salva os dados padrão no Firestore
        }
    });
}

/**
 * Salva o objeto appData inteiro no Firestore.
 * Esta função substitui o antigo saveLocalData.
 */
async function saveAppData() {
    const appDataRef = doc(db, "app-data", "lists");
    try {
        await setDoc(appDataRef, appData);
    } catch (error) {
        console.error("Erro ao salvar dados das listas no Firestore:", error);
        showError("Erro ao sincronizar listas.");
    }
}


// --- Inicialização do App ---
async function initializeAppFirebase() {
    try {
        // A variável `firebaseConfig` é global, vinda de `firebase-config.js`
        if (typeof firebaseConfig === 'undefined') {
            throw new Error("Configuração do Firebase não encontrada. Verifique se o arquivo firebase-config.js está correto e foi incluído.");
        }

        // Usa o projectId como o appId para os caminhos do Firestore
        appId = firebaseConfig.projectId;
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('error'); // Mude para 'debug' para mais logs

        // Autenticar o usuário
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Verifica se o e-mail do usuário está na lista de permitidos
                if (allowedEmails.includes(user.email)) {
                    userId = user.uid;
                    // Inicia o listener para os dados do app (listas) APÓS autenticação
                    if (elements.userStatus) {
                        elements.userStatus.textContent = `Conectado como: ${user.email}`;
                    }
                    listenToAppData(); 
                    console.log("Usuário autorizado autenticado:", user.email, "| UserID:", userId);
                    elements.loadingMessage.style.display = 'none';
                    switchScreen('home'); // Vai para a tela principal
                } else {
                    // Se não for um usuário permitido, desloga e mostra erro
                    console.warn("Usuário não autorizado tentou login:", user.email);
                    await signOut(auth);
                    showError("Você não tem permissão para acessar este app.");
                    switchScreen('login'); // Mostra a tela de login com a mensagem de erro
                }
            } else {
                // Nenhum usuário logado, mostrar a tela de login
                if (elements.userStatus) {
                    elements.userStatus.textContent = '';
                }
                console.log("Nenhum usuário logado. Mostrando tela de login.");
                elements.loadingMessage.style.display = 'none';
                switchScreen('login');
            }
        });

    } catch (e) {
        console.error("Erro ao inicializar o Firebase:", e);
        showError("Erro fatal ao carregar o app. Verifique o console.");
    }
}

// --- Função de Login com E-mail e Senha ---
async function handleLogin() {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!email || !password) {
        showError("Por favor, preencha e-mail e senha.");
        return;
    }

    elements.loadingMessage.textContent = "Autenticando...";
    elements.loadingMessage.style.display = 'block';
    switchScreen('loading');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // O onAuthStateChanged cuidará do resto
    } catch (error) {
        console.error("Erro no login:", error);
        showError("E-mail ou senha incorretos. Tente novamente.");
        switchScreen('login'); // Volta para a tela de login em caso de erro
    }
}

// --- Função de Logout ---
async function handleLogout() {
    try {
        await signOut(auth);
        // O onAuthStateChanged vai detectar a saída e redirecionar para a tela de login.
        console.log("Usuário deslogado com sucesso.");
        // Limpa qualquer estado de sessão residual
        leaveSession(); 
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showError("Ocorreu um erro ao sair.");
    }
}
// --- Funções de Navegação e UI ---

/**
 * Renderiza o logo do app em todos os placeholders.
 * Isso centraliza a aparência do logo em um único lugar.
 */
function renderLogo() {
    // O HTML correto para o logo, com o "T" destacado.
    const logoHTML = '<h1><span class="logo-brand">T</span>indecisos</h1>';
    const placeholders = document.querySelectorAll('.logo-container');
    placeholders.forEach(placeholder => {
        placeholder.innerHTML = logoHTML;
    });
}

function switchScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function showError(message) {
    const errorElement = document.querySelector('.screen.active .error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else { // Fallback para a tela de loading
        elements.loadingMessage.textContent = message;
    }
}

// --- Lógica Principal da Sessão (NOVO) ---

/**
 * Cria uma nova sessão no Firestore.
 */
async function createSession() {
    isCreator = true;
    // Gera um ID de sessão curto e amigável
    currentSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    elements.loadingMessage.textContent = `Criando sessão ${currentSessionId}...`;
    switchScreen('loading');

    try {
        // Caminho simplificado para a coleção de sessões
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        
        // Estrutura de dados inicial da sessão
        const newSessionData = {
            creatorId: userId,
            joinerId: null,
            categoryName: null, // Será definido pelo criador
            itemsWithVotes: [], // Será preenchido após escolher a categoria
            player1Index: 0, // Índice do criador
            player2Index: 0, // Índice do jogador 2
            player1Done: false,
            player2Done: false,
            createdAt: serverTimestamp()
        };

        await setDoc(sessionRef, newSessionData);
        
        // Inicia o listener que reagirá a mudanças na sessão.
        listenToSession(currentSessionId);
        // O listener, na sua primeira execução, nos levará para a tela de Lobby.

    } catch (error) {
        console.error("Erro ao criar sessão:", error);
        showError(`Erro ao criar sessão. Tente novamente. ${error.message}`);
        switchScreen('home');
        isCreator = false;
        currentSessionId = null;
    }
}

/**
 * Entra em uma sessão existente no Firestore.
 */
async function joinSession() {
    const sessionIdToJoin = elements.sessionInput.value.trim().toUpperCase();
    if (!sessionIdToJoin) {
        showError("Por favor, insira um ID de sessão.");
        return;
    }
    
    elements.loadingMessage.textContent = `Entrando na sessão ${sessionIdToJoin}...`;
    switchScreen('loading');

    try {
        const sessionRef = doc(db, `tindecisos-sessions/${sessionIdToJoin}`);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
            showError("Sessão não encontrada. Verifique o ID.");
            switchScreen('home');
            return;
        }

        // Sessão encontrada, vamos entrar
        isCreator = false;
        currentSessionId = sessionIdToJoin;
        
        // Atualiza o documento da sessão com o ID do jogador 2
        await updateDoc(sessionRef, {
            joinerId: userId
        });
        
        // Inicia o listener e vai para o Lobby
        listenToSession(currentSessionId);
        // (O listener cuidará de mover para a tela correta)

    } catch (error) {
        console.error("Erro ao entrar na sessão:", error);
        showError(`Erro ao entrar na sessão. ${error.message}`);
        switchScreen('home');
    }
}

/**
 * Inicia o listener (onSnapshot) para a sessão atual.
 * Este é o coração do app multiplayer.
 */
function listenToSession(sessionId) {
    // Se já houver um listener, cancela antes de criar um novo
    if (sessionUnsubscribe) {
        sessionUnsubscribe();
    }

    const sessionRef = doc(db, `tindecisos-sessions/${sessionId}`);
    
    sessionUnsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (!docSnap.exists()) {
            showError("A sessão foi encerrada ou não existe mais.");
            leaveSession();
            return;
        }
        
        sessionData = docSnap.data();
        console.log("Dados da sessão atualizados:", sessionData);
        
        // Atualiza o ID do usuário no Lobby (útil para debug)
        if(elements.lobbyUserId) {
             elements.lobbyUserId.textContent = `Seu ID: ${userId}`;
        }

        // --- Roteamento de Tela baseado no Estado da Sessão ---
        const currentScreen = document.querySelector('.screen.active');
        const currentScreenId = currentScreen ? currentScreen.id : null;


        // 1. Ambos jogadores terminaram? Mostrar Resultados.
        if (sessionData.player1Done && sessionData.player2Done) {
            if (currentScreenId !== 'results-screen') {
                showResults();
            }
            return;
        }

        // 2. O swipe está em progresso? (Categoria escolhida)
        if (sessionData.categoryName) {
            // Se a tela de swipe ainda não estiver ativa, mostre-a.
            if (currentScreenId !== 'swipe-screen') {
                switchScreen('swipe');
                showNextCard(); // Carrega o card correto
            }
            // (Se já estiver ativa, não faz nada, deixa o jogador deslizar)
            return;
        }

        // 3. Estamos no Lobby (Alguém entrou, mas categoria não escolhida)
        if (sessionData.joinerId) {
            // Jogador 2 entrou. Se eu sou o criador, vou para a seleção de categoria.
            if (isCreator) {
                if (currentScreenId !== 'category-select-screen') {
                    renderCategorySelection();
                    switchScreen('category-select-screen');
                }
            } else {
                // Se eu sou o jogador 2, continuo no lobby esperando o criador escolher.
                if (currentScreenId !== 'lobby-screen') {
                    switchScreen('lobby');
                }
                updateLobbyStatus(true); // true = jogador 2 conectado
            }
            return;
        }

        // 4. Ninguém entrou ainda, ambos aguardam no Lobby.
        if (currentScreenId !== 'lobby-screen') {
            switchScreen('lobby');
        }
        updateLobbyStatus(false); // false = aguardando
    });
}

/**
 * O Criador seleciona uma categoria e a salva na sessão.
 */
async function selectCategoryForSession(categoryKey) {
    if (!isCreator || !currentSessionId) return;
    
    // Pega os itens da lista local
    const items = appData[categoryKey] || [];
    
    // Transforma os itens para a estrutura do Firestore
    const itemsWithVotes = items.map(item => ({
        ...item,
        p1_vote: null, // null, 'like', 'dislike'
        p2_vote: null
    }));

    try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await updateDoc(sessionRef, {
            categoryName: categoryKey,
            itemsWithVotes: itemsWithVotes
        });
        
        // O onSnapshot vai pegar essa mudança e mover ambos os jogadores
        // para a tela de swipe (Lógica no listenToSession)
        
    } catch (error) {
        console.error("Erro ao selecionar categoria:", error);
        showError("Erro ao iniciar a sessão. Tente novamente.");
    }
}

/**
 * Atualiza a UI do Lobby (aguardando jogador)
 */
function updateLobbyStatus(isJoinerConnected) {
    elements.sessionIdDisplay.textContent = currentSessionId;
    elements.lobbyStatus.textContent = isJoinerConnected 
        ? "Jogador 2 conectado! O criador está escolhendo a categoria..."
        : "Aguardando outro jogador entrar...";
}

/**
 * Limpa o estado da sessão e volta para casa.
 */
function leaveSession() {
    if (sessionUnsubscribe) {
        sessionUnsubscribe(); // Para o listener
        sessionUnsubscribe = null;
    }

    // Se o usuário é o criador da sessão, deleta o documento da sessão.
    // Se for o jogador 2, apenas remove seu ID da sessão.
    if (currentSessionId && sessionData) {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        if (isCreator) {
            console.log("Criador saindo. Deletando sessão...");
            // Usamos deleteDoc para remover a sessão inteira.
            deleteDoc(sessionRef).catch(err => console.error("Erro ao deletar sessão:", err)); // Agora funciona, pois o import está correto.
        } else {
            console.log("Jogador 2 saindo. Limpando joinerId...");
            // Apenas remove o ID do jogador 2, mantendo a sessão aberta.
            updateDoc(sessionRef, { joinerId: null }).catch(err => console.error("Erro ao sair da sessão:", err));
        }
    }

    currentSessionId = null;
    isCreator = false;
    sessionData = null;

    // Limpa mensagens de erro
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });

    switchScreen('home');
}

/**
 * Renderiza a lista de categorias para o Criador escolher.
 */
function renderCategorySelection() {
    elements.categorySelectList.innerHTML = ''; // Limpa a lista
    
    Object.keys(appData).forEach(categoryKey => {
        const card = document.createElement('div');
        card.className = 'category-card-select'; // Estilo simples de botão
        card.textContent = categoryKey;
        card.dataset.category = categoryKey;
        elements.categorySelectList.appendChild(card);
    });
    
    // Adiciona listener (reutilizável)
    if (!elements.categorySelectList.dataset.listenerAttached) {
        elements.categorySelectList.addEventListener('click', (e) => {
            const category = e.target.closest('.category-card-select')?.dataset.category;
            if (category) {
                selectCategoryForSession(category);
            }
        });
        elements.categorySelectList.dataset.listenerAttached = 'true';
    }
}


// --- Lógica de Swipe (Atualizada para Firebase) ---

/**
 * Mostra o card correto baseado no progresso do jogador.
 */
function showNextCard() {
    if (!sessionData) return; // Guarda de segurança

    // Determina qual índice usar (P1 ou P2)
    const myIndex = isCreator ? sessionData.player1Index : sessionData.player2Index;
    
    if (myIndex < sessionData.itemsWithVotes.length) {
        const item = sessionData.itemsWithVotes[myIndex];
        
        elements.itemName.textContent = item.name;
        const imageUrl = item.image || `https://placehold.co/400x250/eee/ccc?text=${encodeURIComponent(item.name)}`;
        elements.itemImage.src = imageUrl;
        elements.itemImage.onerror = function() { 
            this.src = `https://placehold.co/400x250/eee/ccc?text=${encodeURIComponent(item.name)}`; 
        };

        elements.itemCard.className = 'card slide-in';
        elements.itemCard.style.transform = '';
        
        setTimeout(() => {
            elements.itemCard.classList.remove('slide-in');
        }, 20);
    } else {
        // O jogador terminou de deslizar
        markPlayerAsDone();
    }
}

/**
 * Processa o swipe e salva no Firestore.
 */
async function handleSwipe(action) {
    if (isAnimating || !sessionData) return;

    const myIndex = isCreator ? sessionData.player1Index : sessionData.player2Index;
    // Se já tiver terminado, não faz nada
    if (myIndex >= sessionData.itemsWithVotes.length) return; 

    isAnimating = true;

    const voteField = isCreator ? `p1_vote` : `p2_vote`;
    const indexField = isCreator ? 'player1Index' : 'player2Index';
    const nextIndex = myIndex + 1;

    // Cópia local para atualização
    let updatedItems = [...sessionData.itemsWithVotes];
    updatedItems[myIndex][voteField] = action;
    
    try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await updateDoc(sessionRef, {
            itemsWithVotes: updatedItems, // Atualiza o array inteiro
            [indexField]: nextIndex        // Atualiza o índice
        });
        
        // Animação de saída
        elements.itemCard.style.transform = ''; 
        elements.itemCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out'; 
        elements.itemCard.classList.add(action === 'like' ? 'slide-out-right' : 'slide-out-left');

        // O onSnapshot vai pegar a mudança no índice e chamar showNextCard
        // Mas chamamos localmente para animação
        setTimeout(() => {
            // O onSnapshot deve ter atualizado o sessionData
            // e chamado showNextCard. Se não, forçamos.
            if (screens.swipe.classList.contains('active')) {
                 showNextCard();
            }
            isAnimating = false;
        }, 400);

    } catch (error) {
        console.error("Erro ao salvar swipe:", error);
        showError("Erro de conexão ao salvar voto.");
        isAnimating = false;
    }
}

/**
 * Marca o jogador como "pronto" no Firestore.
 */
async function markPlayerAsDone() {
     if (!sessionData) return;
     
     const doneField = isCreator ? 'player1Done' : 'player2Done';
     
     // Evita escritas desnecessárias
     if (sessionData[doneField] === true) return;
     
     try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await updateDoc(sessionRef, {
            [doneField]: true
        });
        
        // O onSnapshot vai verificar se ambos estão prontos
        // e mover para os resultados.
        
        // Mostra uma tela de espera
        elements.itemName.textContent = "Aguardando o outro jogador...";
        elements.itemImage.src = `https://placehold.co/400x250/eee/ccc?text=Aguardando...`;
        elements.itemCard.className = 'card';
        elements.itemCard.style.transform = 'none';

     } catch (error) {
         console.error("Erro ao finalizar:", error);
         showError("Erro ao finalizar sua parte.");
     }
}


/**
 * Mostra a tela de resultados (calcula matches).
 */
function showResults() {
    elements.likedList.innerHTML = '';
    let matchesFound = [];

    if (sessionData && sessionData.itemsWithVotes) {
        matchesFound = sessionData.itemsWithVotes.filter(item => 
            item.p1_vote === 'like' && item.p2_vote === 'like'
        );
    }

    if (matchesFound.length > 0) {
        elements.noMatchesMsg.style.display = 'none';
        elements.likedList.style.display = 'block';

        matchesFound.forEach(item => {
            const li = document.createElement('li');
            const img = document.createElement('img');
            const thumbUrl = item.image || `https://placehold.co/60x60/eee/ccc?text=...`;
            img.src = thumbUrl;
            img.alt = item.name;
            img.className = 'result-thumb';
            img.onerror = function() { this.src='https://placehold.co/60x60/eee/ccc?text=...'; };

            const span = document.createElement('span');
            span.textContent = item.name;
            
            li.appendChild(img);
            li.appendChild(span);
            elements.likedList.appendChild(li);
        });
    } else {
        elements.noMatchesMsg.style.display = 'block';
        elements.likedList.style.display = 'none';
    }

    switchScreen('results');
}


// --- Funções de Gerenciamento (CRUD Local) ---

function showAddItemModal() {
    elements.addItemModal.classList.add('active');
    elements.itemNameInput.focus();
}

function renderManageList(categoryKey) {
    elements.manageTitle.textContent = `Gerenciando "${categoryKey}"`;
    elements.manageList.innerHTML = ''; // Limpa
    
    const items = appData[categoryKey];

    if (items.length === 0) {
        elements.manageList.innerHTML = '<p style="padding: 1rem; text-align: center; color: #777;">Nenhum item cadastrado.</p>';
    }

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'manage-item';
        const thumbUrl = item.image || `https://placehold.co/60x60/eee/ccc?text=...`;
        
        li.innerHTML = `
            <img src="${thumbUrl}" alt="${item.name}" class="manage-thumb" onerror="this.src='https://placehold.co/60x60/eee/ccc?text=...';">
            <span class="manage-item-name">${item.name}</span>
            <div class="manage-item-buttons">
                <button class="edit-btn" data-index="${index}" aria-label="Editar">✏️</button>
                <button class="delete-btn" data-index="${index}" aria-label="Excluir">❌</button>
            </div>
        `;
        elements.manageList.appendChild(li);
    });
    
    // Adiciona o botão "Adicionar Novo" no final
    const addButtonLi = document.createElement('li');
    addButtonLi.innerHTML = `<button class="add-new-item-btn-list">Adicionar Novo Item +</button>`;
    elements.manageList.appendChild(addButtonLi);
}

function openEditModal(index) {
    currentEditIndex = index;
    const item = appData[currentCategoryKey][index];
    
    elements.modalTitle.textContent = `Editar "${item.name}"`;
    elements.itemNameInput.value = item.name;
    elements.itemImageInput.value = item.image || '';
    
    showAddItemModal();
}

function deleteItem(index) {
    // TODO: Adicionar um modal de confirmação customizado
    const itemName = appData[currentCategoryKey][index].name;
    appData[currentCategoryKey].splice(index, 1);
    saveAppData(); // Salva no Firestore
    renderManageList(currentCategoryKey); // Re-renderiza a lista
    
    // Mostra feedback na tela principal (home)
    elements.addFeedback.textContent = `${itemName} foi excluído!`;
    setTimeout(() => {
        elements.addFeedback.textContent = '';
    }, 2000);
}

/**
 * Renderiza a lista de categorias para a tela de gerenciamento.
 */
function renderManageCategoryList() {
    elements.manageCategoryList.innerHTML = ''; // Limpa a lista
    
    Object.keys(appData).forEach(categoryKey => {
        const card = document.createElement('div');
        card.className = 'category-card-select';
        card.textContent = `Gerenciar "${categoryKey}"`;
        card.dataset.category = categoryKey;
        elements.manageCategoryList.appendChild(card);
    });
    
     // Adiciona o botão "Adicionar Nova Categoria"
    const addButton = document.createElement('button');
    addButton.id = 'add-new-category-btn';
    addButton.className = 'manage-btn';
    addButton.textContent = 'Adicionar Nova Categoria +';
    elements.manageCategoryList.appendChild(addButton);
    
    // Adiciona listener (reutilizável)
    if (!elements.manageCategoryList.dataset.listenerAttached) {
         elements.manageCategoryList.addEventListener('click', (e) => {
            const categoryCard = e.target.closest('.category-card-select');
            const addCategoryBtn = e.target.closest('#add-new-category-btn');

            if (categoryCard) {
                const category = categoryCard.dataset.category;
                if (category) {
                    currentCategoryKey = category; // Define a categoria a ser gerenciada
                    renderManageList(category);
                    switchScreen('manageItems'); // Vai para a lista de itens
                }
            } else if (addCategoryBtn) {
                // Usar o modal genérico para adicionar categoria
                currentEditIndex = null;
                currentCategoryKey = null; // Indica que é uma *nova* categoria
                elements.modalTitle.textContent = `Adicionar Nova Categoria`;
                elements.itemNameInput.placeholder = 'Nome da Categoria (Ex: Filmes)';
                elements.itemImageInput.style.display = 'none'; // Esconde campo de imagem
                showAddItemModal();
            }
        });
        elements.manageCategoryList.dataset.listenerAttached = 'true';
    }
}

/**
 * Adiciona ou Edita Categoria/Item (Função unificada)
 */
function saveModalData() {
    const newName = elements.itemNameInput.value.trim();
    if (!newName) {
        elements.itemNameInput.focus();
        return;
    }

    if (currentCategoryKey === null) {
        // Estamos ADICIONANDO UMA NOVA CATEGORIA
        if (appData[newName]) {
             elements.addFeedback.textContent = `Categoria "${newName}" já existe!`;
        } else {
            appData[newName] = []; // Cria nova categoria vazia
            saveAppData(); // Salva no Firestore
            elements.addFeedback.textContent = `Categoria "${newName}" adicionada!`;
            renderManageCategoryList(); // Atualiza a lista de categorias
        }
    } else {
        // Estamos ADICIONANDO OU EDITANDO UM ITEM
        const newImage = elements.itemImageInput.value.trim();
        const newItem = {
            name: newName,
            image: newImage || null
        };

        if (currentEditIndex !== null) {
            // Editando item
            appData[currentCategoryKey][currentEditIndex] = newItem;
            elements.addFeedback.textContent = `${newName} foi atualizado!`;
        } else {
            // Adicionando novo item
            appData[currentCategoryKey].push(newItem);
            elements.addFeedback.textContent = `${newName} foi adicionado!`;
        }
        saveAppData(); // Salva no Firestore
        if (screens.manageItems.classList.contains('active')) {
             renderManageList(currentCategoryKey);
        }
    }
    
    setTimeout(() => {
        elements.addFeedback.textContent = '';
    }, 2000);

    closeAddItemModal();
}

/**
 * Resetar o modal ao fechar (para modo Categoria/Item)
 */
function closeAddItemModal() {
    elements.addItemModal.classList.remove('active');
    elements.itemNameInput.value = '';
    elements.itemImageInput.value = '';
    // Reseta o modal para o padrão (adicionar item)
    elements.itemNameInput.placeholder = 'Nome (Ex: Tocar violão 🎸)';
    elements.itemImageInput.style.display = 'block';
    currentEditIndex = null;
    // (currentCategoryKey é mantido)
}


// --- Funções de Drag (Arrastar) ---
let isDragging = false;
let startX = 0;
let currentX = 0;
let isAnimating = false;
const swipeThreshold = 100;

function getClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
}

function dragStart(e) {
    if (isAnimating || !sessionData) return;
    const myIndex = isCreator ? sessionData.player1Index : sessionData.player2Index;
    if (myIndex >= sessionData.itemsWithVotes.length) return; // Não arrasta se tiver terminado
    
    isDragging = true;
    startX = getClientX(e);
    currentX = startX;
    elements.itemCard.style.transition = 'none';
    elements.itemCard.style.cursor = 'grabbing';
}

function dragMove(e) {
    if (!isDragging || isAnimating) return;
    e.preventDefault(); 
    currentX = getClientX(e);
    const deltaX = currentX - startX;
    elements.itemCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.1}deg)`;
}

function dragEnd(e) {
    if (!isDragging || isAnimating) return;
    isDragging = false;
    const deltaX = currentX - startX;

    elements.itemCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
    elements.itemCard.style.cursor = 'grab';

    if (deltaX > swipeThreshold) {
        handleSwipe('like');
    } else if (deltaX < -swipeThreshold) {
        handleSwipe('dislike');
    } else {
        elements.itemCard.style.transform = 'translateX(0) rotate(0)';
    }
    startX = 0;
    currentX = 0;
}


// --- Inicialização do DOM ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Mapeia todas as telas
    screens = {
        login: document.getElementById('login-screen'),
        home: document.getElementById('home-screen'),
        categorySelect: document.getElementById('category-select-screen'),
        lobby: document.getElementById('lobby-screen'),
        swipe: document.getElementById('swipe-screen'),
        results: document.getElementById('results-screen'),
        manageCategory: document.getElementById('manage-category-screen'),
        manageItems: document.getElementById('manage-items-screen'),
        loading: document.getElementById('loading-screen') // Tela de loading
    };
    
    // Mapeia botões
    buttons = {
        login: document.getElementById('login-btn'),
        createSession: document.getElementById('create-session-btn'),
        joinSession: document.getElementById('join-session-btn'),
        openManage: document.getElementById('open-manage-btn'),
        like: document.getElementById('like-btn'),
        dislike: document.getElementById('dislike-btn'),
        restart: document.getElementById('restart-btn'),
        saveItem: document.getElementById('save-item-btn'),
        cancelAdd: document.getElementById('cancel-add-btn'),
        backToHomeFromManageCat: document.getElementById('back-to-home-from-manage-cat-btn'),
        backToManageCat: document.getElementById('back-to-manage-cat-btn'),
        logout: document.getElementById('logout-btn') // Novo botão
    };

    // Mapeia outros elementos
    elements = {
        emailInput: document.getElementById('email-input'),
        passwordInput: document.getElementById('password-input'),
        loadingMessage: document.getElementById('loading-message'),
        sessionInput: document.getElementById('session-id-input'),
        userStatus: document.getElementById('user-status'), // Novo elemento
        categorySelectList: document.getElementById('category-select-list'),
        lobbyStatus: document.getElementById('lobby-status'),
        sessionIdDisplay: document.getElementById('session-id-display'),
        lobbyUserId: document.getElementById('lobby-user-id'),
        itemCard: document.getElementById('item-card'),
        itemImage: document.getElementById('item-image'),
        itemName: document.getElementById('item-name'),
        likedList: document.getElementById('liked-list'),
        noMatchesMsg: document.getElementById('no-matches-msg'),
        addFeedback: document.getElementById('add-feedback'),
        addItemModal: document.getElementById('item-modal'),
        modalTitle: document.getElementById('item-modal-title'),
        itemNameInput: document.getElementById('item-name-input'),
        itemImageInput: document.getElementById('item-image-input'),
        manageCategoryList: document.getElementById('manage-category-list'),
        manageList: document.getElementById('manage-list'),
        manageTitle: document.getElementById('manage-title')
    };

    // --- Renderiza elementos reutilizáveis ---
    renderLogo();

    // --- Listeners de Eventos Globais ---
    
    // Tela de Login
    buttons.login.addEventListener('click', handleLogin);
    elements.emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    elements.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

    // Tela Inicial
    buttons.createSession.addEventListener('click', createSession);
    buttons.joinSession.addEventListener('click', joinSession);
    buttons.openManage.addEventListener('click', () => {
        renderManageCategoryList();
        switchScreen('manageCategory');
    });
    buttons.logout.addEventListener('click', handleLogout); // Adiciona listener para logout
    
    // Botões do Modal (Adicionar/Editar Item/Categoria)
    buttons.saveItem.addEventListener('click', saveModalData); // Função unificada
    buttons.cancelAdd.addEventListener('click', closeAddItemModal);
    elements.addItemModal.addEventListener('click', (e) => {
        if (e.target === elements.addItemModal) closeAddItemModal();
    });
    elements.itemNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveModalData(); });
    elements.itemImageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveModalData(); });

    // Botões de Swipe
    buttons.like.addEventListener('click', () => handleSwipe('like'));
    buttons.dislike.addEventListener('click', () => handleSwipe('dislike'));

    // Botão "Recomeçar" (Tela de Resultados)
    buttons.restart.addEventListener('click', leaveSession);
    
    // Botões de Navegação (Gerenciamento)
    buttons.backToHomeFromManageCat.addEventListener('click', () => switchScreen('home'));
    buttons.backToManageCat.addEventListener('click', () => switchScreen('manageCategory'));

    // Listeners da Lista de Gerenciamento (Itens)
    elements.manageList.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-btn');
        const deleteButton = e.target.closest('.delete-btn');
        const addButton = e.target.closest('.add-new-item-btn-list');

        if (editButton) {
            const index = parseInt(editButton.dataset.index, 10);
            openEditModal(index);
            return;
        }
        if (deleteButton) {
            const index = parseInt(deleteButton.dataset.index, 10);
            deleteItem(index);
            return;
        }
        if (addButton) {
            const singular = currentCategoryKey.endsWith('s') ? currentCategoryKey.slice(0, -1) : currentCategoryKey;
            elements.modalTitle.textContent = `Adicionar Novo ${singular}`;
            currentEditIndex = null; 
            elements.itemNameInput.value = '';
            elements.itemImageInput.value = '';
            // Garante que o modal está no modo "item"
            elements.itemNameInput.placeholder = 'Nome (Ex: Tocar violão 🎸)';
            elements.itemImageInput.style.display = 'block';
            showAddItemModal();
        }
    });
    

    // --- Listeners para o Arraste (Drag) ---
    elements.itemCard.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove); 
    document.addEventListener('mouseup', dragEnd); 
    elements.itemCard.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove, { passive: false }); 
    document.addEventListener('touchend', dragEnd); 

    // --- Inicialização ---
    initializeAppFirebase();
});