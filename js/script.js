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
let isAppDataReady = false; // Flag para saber se appData já carregou

// --- Lista de Usuários Autorizados ---
const allowedEmails = [
    "jeffersonsenarn@gmail.com",
    "jessicaminern@gmail.com",
    "jeffersonwillamern@gmail.com",
    "pedrobilau177@gmail.com",
    "ellydapereira596@gmail.com"
];

// --- Elementos de UI Globais ---
let screens = {};
let elements = {};
let buttons = {};

// --- Dados Locais (para criar novas sessões) ---
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
 */
function listenToAppData() {
    const appDataRef = doc(db, "app-data", "lists");

    onSnapshot(appDataRef, (docSnap) => {
        if (docSnap.exists()) {
            appData = docSnap.data();
            isAppDataReady = true;
            console.log("Dados de listas sincronizados do Firestore:", appData);
            
            if (screens.manageCategory?.classList.contains('active')) {
                renderManageCategoryList();
            }
        } else {
            console.log("Nenhum dado de lista encontrado no Firestore. Criando com dados padrão...");
            appData = JSON.parse(JSON.stringify(defaultData));
            isAppDataReady = true;
            saveAppData();
        }
    });
}

/**
 * Salva o objeto appData inteiro no Firestore.
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
        if (typeof firebaseConfig === 'undefined') {
            throw new Error("Configuração do Firebase não encontrada. Verifique se o arquivo firebase-config.js está correto e foi incluído.");
        }

        appId = firebaseConfig.projectId;
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('error');

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (allowedEmails.includes(user.email)) {
                    userId = user.uid;
                    
                    if (elements.userStatus) {
                        elements.userStatus.textContent = `Conectado como: ${user.email}`;
                    }
                    
                    listenToAppData(); 
                    console.log("Usuário autorizado autenticado:", user.email, "| UserID:", userId);
                    elements.loadingMessage.style.display = 'none';
                    switchScreen('home');
                } else {
                    console.warn("Usuário não autorizado tentou login:", user.email);
                    await signOut(auth);
                    showError("Você não tem permissão para acessar este app.");
                    switchScreen('login');
                }
            } else {
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
    } catch (error) {
        console.error("Erro no login:", error);
        showError("E-mail ou senha incorretos. Tente novamente.");
        switchScreen('login');
    }
}

// --- Função de Logout ---
async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Usuário deslogado com sucesso.");
        leaveSession(); 
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showError("Ocorreu um erro ao sair.");
    }
}

// --- Funções de Navegação e UI ---

/**
 * Renderiza o logo do app em todos os placeholders.
 */
function renderLogo() {
    const logoHTML = '<h1><span class="logo-brand">T</span>indecisos</h1>';
    const placeholders = document.querySelectorAll('.logo-container');
    placeholders.forEach(placeholder => {
        placeholder.innerHTML = logoHTML;
    });
}

function switchScreen(screenName) {
    console.log("🔄 Mudando para tela:", screenName);
    
    // Remove active de todas as telas
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Ativa a tela solicitada
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        console.log("✅ Tela ativada:", screenName);
    } else {
        console.error("❌ Tela não encontrada:", screenName);
        console.log("📋 Telas disponíveis:", Object.keys(screens));
    }
}

function showError(message) {
    const errorElement = document.querySelector('.screen.active .error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else {
        elements.loadingMessage.textContent = message;
    }
}

// --- Lógica Principal da Sessão ---

/**
 * Cria uma nova sessão (mostra seleção de categoria).
 */
function createSession() {
    isCreator = true;
    
    // Verifica se appData está pronto
    if (!isAppDataReady || !appData || Object.keys(appData).length === 0) {
        elements.loadingMessage.textContent = "Carregando listas...";
        switchScreen('loading');
        
        // Aguarda appData estar pronto
        const checkInterval = setInterval(() => {
            if (isAppDataReady && appData && Object.keys(appData).length > 0) {
                clearInterval(checkInterval);
                renderCategorySelection();
                switchScreen('categorySelect'); // CORRIGIDO
            }
        }, 100);
        return;
    }
    
    // Força renderização e mudança de tela
    console.log("Renderizando categorias:", Object.keys(appData));
    renderCategorySelection();
    switchScreen('categorySelect'); // CORRIGIDO: usa o nome correto do mapeamento
    
    // DEBUG: Log para verificar
    setTimeout(() => {
        console.log("Tela ativa:", document.querySelector('.screen.active')?.id);
        console.log("Categorias renderizadas:", elements.categorySelectList.children.length);
    }, 100);
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

        isCreator = false;
        currentSessionId = sessionIdToJoin;
        
        await updateDoc(sessionRef, {
            joinerId: userId
        });
        
        listenToSession(currentSessionId);

    } catch (error) {
        console.error("Erro ao entrar na sessão:", error);
        showError(`Erro ao entrar na sessão. ${error.message}`);
        switchScreen('home');
    }
}

/**
 * O Criador seleciona uma categoria e cria a sessão.
 */
async function selectCategoryAndCreateSession(categoryKey) {
    if (!isCreator) return;

    currentSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    elements.loadingMessage.textContent = `Criando sessão ${currentSessionId}...`;
    switchScreen('loading');

    const items = appData[categoryKey] || [];
    const itemsWithVotes = items.map(item => ({
        ...item, p1_vote: null, p2_vote: null
    }));

    const newSessionData = {
        creatorId: userId,
        joinerId: null,
        categoryName: categoryKey,
        itemsWithVotes: itemsWithVotes,
        player1Index: 0,
        player2Index: 0,
        player1Done: false,
        player2Done: false,
        createdAt: serverTimestamp()
    };

    try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await setDoc(sessionRef, newSessionData);
        listenToSession(currentSessionId);
    } catch (error) {
        console.error("Erro ao criar sessão:", error);
        showError("Erro ao criar sessão. Tente novamente.");
        switchScreen('home');
    }
}

/**
 * Inicia o listener (onSnapshot) para a sessão atual.
 */
function listenToSession(sessionId) {
    const sessionRef = doc(db, `tindecisos-sessions/${sessionId}`);
    
    sessionUnsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (!docSnap.exists()) {
            showError("A sessão foi encerrada ou não existe mais.");
            leaveSession();
            return;
        }
        
        sessionData = docSnap.data();
        handleSessionStateChange(sessionData);
    });
}

/**
 * Gerencia mudanças de estado da sessão.
 */
function handleSessionStateChange(data) {
    const currentScreenId = document.querySelector('.screen.active')?.id;

    // 1. Fim de jogo: Ambos terminaram
    if (data.player1Done && data.player2Done) {
        if (currentScreenId !== 'results-screen') showResults();
        return;
    }

    // 2. Jogo em andamento: Ambos conectados
    if (data.joinerId) {
        if (currentScreenId !== 'swipe-screen') {
            switchScreen('swipe');
            showNextCard();
        }
        return;
    }

    // 3. Lobby: Aguardando jogador 2
    if (isCreator && !data.joinerId) {
        if (currentScreenId !== 'lobby-screen') {
            switchScreen('lobby');
            updateLobbyStatus();
        }
        return;
    }
}

/**
 * Atualiza a UI do Lobby.
 */
function updateLobbyStatus() {
    elements.sessionIdDisplay.textContent = currentSessionId;
    elements.lobbyStatus.textContent = "Aguardando outro jogador entrar...";
}

/**
 * Limpa o estado da sessão e volta para casa.
 */
function leaveSession() {
    if (sessionUnsubscribe) {
        sessionUnsubscribe();
        sessionUnsubscribe = null;
    }

    if (currentSessionId && sessionData) {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        if (isCreator) {
            console.log("Criador saindo. Deletando sessão...");
            deleteDoc(sessionRef).catch(err => console.error("Erro ao deletar sessão:", err));
        } else {
            console.log("Jogador 2 saindo. Limpando joinerId...");
            updateDoc(sessionRef, { joinerId: null }).catch(err => console.error("Erro ao sair da sessão:", err));
        }
    }

    currentSessionId = null;
    isCreator = false;
    sessionData = null;

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
    elements.categorySelectList.innerHTML = '';
    
    if (!appData || Object.keys(appData).length === 0) {
        elements.categorySelectList.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">Carregando categorias...</p>';
        console.warn("renderCategorySelection: appData está vazio");
        return;
    }
    
    console.log("Renderizando categorias:", Object.keys(appData));
    
    Object.keys(appData).forEach(categoryKey => {
        const card = document.createElement('div');
        card.className = 'category-card-select';
        card.textContent = categoryKey;
        card.dataset.category = categoryKey;
        elements.categorySelectList.appendChild(card);
        console.log("Categoria adicionada:", categoryKey);
    });
    
    console.log("Total de categorias renderizadas:", elements.categorySelectList.children.length);
    
    if (!elements.categorySelectList.dataset.listenerAttached) {
        elements.categorySelectList.addEventListener('click', (e) => {
            const category = e.target.closest('.category-card-select')?.dataset.category;
            if (category) {
                console.log("Categoria selecionada:", category);
                selectCategoryAndCreateSession(category);
            }
        });
        elements.categorySelectList.dataset.listenerAttached = 'true';
    }
}

// --- Lógica de Swipe ---

/**
 * Mostra o card correto baseado no progresso do jogador.
 */
function showNextCard() {
    if (!sessionData) return;

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
        markPlayerAsDone();
    }
}

/**
 * Processa o swipe e salva no Firestore.
 */
async function handleSwipe(action) {
    if (isAnimating || !sessionData) return;

    const myIndex = isCreator ? sessionData.player1Index : sessionData.player2Index;
    if (myIndex >= sessionData.itemsWithVotes.length) return;

    isAnimating = true;

    const voteField = isCreator ? `p1_vote` : `p2_vote`;
    const indexField = isCreator ? 'player1Index' : 'player2Index';
    const nextIndex = myIndex + 1;

    let updatedItems = [...sessionData.itemsWithVotes];
    updatedItems[myIndex][voteField] = action;
    
    try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await updateDoc(sessionRef, {
            itemsWithVotes: updatedItems,
            [indexField]: nextIndex
        });
        
        elements.itemCard.style.transform = ''; 
        elements.itemCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out'; 
        elements.itemCard.classList.add(action === 'like' ? 'slide-out-right' : 'slide-out-left');

        setTimeout(() => {
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
     
     if (sessionData[doneField] === true) return;
     
     try {
        const sessionRef = doc(db, `tindecisos-sessions/${currentSessionId}`);
        await updateDoc(sessionRef, {
            [doneField]: true
        });
        
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

// --- Funções de Gerenciamento (CRUD) ---

function showAddItemModal() {
    elements.addItemModal.classList.add('active');
    elements.itemNameInput.focus();
}

function renderManageList(categoryKey) {
    elements.manageTitle.textContent = `Gerenciando "${categoryKey}"`;
    elements.manageList.innerHTML = '';
    
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
    const itemToDelete = appData[currentCategoryKey][index];
    const confirmModal = document.getElementById('confirm-modal');
    const confirmText = document.getElementById('confirm-modal-text');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');

    confirmText.innerHTML = `Você tem certeza de que deseja excluir "<strong>${itemToDelete.name}</strong>"? Esta ação não pode ser desfeita.`;
    confirmModal.classList.add('active');

    const performDelete = () => {
        appData[currentCategoryKey].splice(index, 1);
        saveAppData();
        renderManageList(currentCategoryKey);

        elements.addFeedback.textContent = `"${itemToDelete.name}" foi excluído!`;
        setTimeout(() => { elements.addFeedback.textContent = ''; }, 2000);

        closeModal();
    };

    const closeModal = () => {
        confirmModal.classList.remove('active');
        confirmBtn.removeEventListener('click', performDelete);
        cancelBtn.removeEventListener('click', closeModal);
    };

    confirmBtn.addEventListener('click', performDelete, { once: true });
    cancelBtn.addEventListener('click', closeModal, { once: true });
}

function renderManageCategoryList() {
    elements.manageCategoryList.innerHTML = '';
    
    Object.keys(appData).forEach(categoryKey => {
        const card = document.createElement('div');
        card.className = 'category-card-select';
        card.textContent = `Gerenciar "${categoryKey}"`;
        card.dataset.category = categoryKey;
        elements.manageCategoryList.appendChild(card);
    });
    
    const addButton = document.createElement('button');
    addButton.id = 'add-new-category-btn';
    addButton.className = 'manage-btn';
    addButton.textContent = 'Adicionar Nova Categoria +';
    elements.manageCategoryList.appendChild(addButton);
    
    if (!elements.manageCategoryList.dataset.listenerAttached) {
         elements.manageCategoryList.addEventListener('click', (e) => {
            const categoryCard = e.target.closest('.category-card-select');
            const addCategoryBtn = e.target.closest('#add-new-category-btn');

            if (categoryCard) {
                const category = categoryCard.dataset.category;
                if (category) {
                    currentCategoryKey = category;
                    renderManageList(category);
                    switchScreen('manageItems');
                }
            } else if (addCategoryBtn) {
                currentEditIndex = null;
                currentCategoryKey = null;
                elements.modalTitle.textContent = `Adicionar Nova Categoria`;
                elements.itemNameInput.placeholder = 'Nome da Categoria (Ex: Filmes)';
                elements.itemImageInput.style.display = 'none';
                showAddItemModal();
            }
        });
        elements.manageCategoryList.dataset.listenerAttached = 'true';
    }
}

function saveModalData() {
    const newName = elements.itemNameInput.value.trim();
    if (!newName) {
        elements.itemNameInput.focus();
        return;
    }

    if (currentCategoryKey === null) {
        if (appData[newName]) {
             elements.addFeedback.textContent = `Categoria "${newName}" já existe!`;
        } else {
            appData[newName] = [];
            saveAppData();
            elements.addFeedback.textContent = `Categoria "${newName}" adicionada!`;
            renderManageCategoryList();
        }
    } else {
        const newImage = elements.itemImageInput.value.trim();
        const newItem = {
            name: newName,
            image: newImage || null
        };

        if (currentEditIndex !== null) {
            appData[currentCategoryKey][currentEditIndex] = newItem;
            elements.addFeedback.textContent = `${newName} foi atualizado!`;
        } else {
            appData[currentCategoryKey].push(newItem);
            elements.addFeedback.textContent = `${newName} foi adicionado!`;
        }
        saveAppData();
        if (screens.manageItems.classList.contains('active')) {
             renderManageList(currentCategoryKey);
        }
    }
    
    setTimeout(() => {
        elements.addFeedback.textContent = '';
    }, 2000);

    closeAddItemModal();
}

function closeAddItemModal() {
    elements.addItemModal.classList.remove('active');
    elements.itemNameInput.value = '';
    elements.itemImageInput.value = '';
    elements.itemNameInput.placeholder = 'Nome (Ex: Tocar violão 🎸)';
    elements.itemImageInput.style.display = 'block';
    currentEditIndex = null;
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
    if (myIndex >= sessionData.itemsWithVotes.length) return;
    
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
    
    console.log("🚀 DOM Carregado - Iniciando app...");
    
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
        loading: document.getElementById('loading-screen')
    };
    
    console.log("✅ Telas mapeadas:", Object.keys(screens));
    
    console.log("✅ Telas mapeadas:", Object.keys(screens));
    
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
        backToHomeFromCategory: document.getElementById('back-to-home-from-category'),
        cancelLobby: document.getElementById('cancel-lobby-btn'),
        logout: document.getElementById('logout-btn'),
        confirmDelete: document.getElementById('confirm-delete-btn'),
        cancelDelete: document.getElementById('cancel-delete-btn')
    };
    
    console.log("✅ Botões mapeados:", Object.keys(buttons).length);

    // Mapeia outros elementos
    elements = {
        emailInput: document.getElementById('email-input'),
        passwordInput: document.getElementById('password-input'),
        loadingMessage: document.getElementById('loading-message'),
        sessionInput: document.getElementById('session-id-input'),
        userStatus: document.getElementById('user-status'),
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
    buttons.createSession.addEventListener('click', () => {
        console.log("🔵 Botão 'Criar Nova Sessão' clicado!");
        console.log("📊 Estado atual - isAppDataReady:", isAppDataReady);
        console.log("📊 Estado atual - appData keys:", Object.keys(appData));
        createSession();
    });
    buttons.joinSession.addEventListener('click', joinSession);
    buttons.openManage.addEventListener('click', () => {
        renderManageCategoryList();
        switchScreen('manageCategory');
    });
    buttons.logout.addEventListener('click', handleLogout);
    
    // Botões do Modal
    buttons.saveItem.addEventListener('click', saveModalData);
    buttons.cancelAdd.addEventListener('click', closeAddItemModal);
    elements.addItemModal.addEventListener('click', (e) => {
        if (e.target === elements.addItemModal) closeAddItemModal();
    });
    elements.itemNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveModalData(); });
    elements.itemImageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveModalData(); });

    // Botões de Swipe
    buttons.like.addEventListener('click', () => handleSwipe('like'));
    buttons.dislike.addEventListener('click', () => handleSwipe('dislike'));

    // Botão "Recomeçar"
    buttons.restart.addEventListener('click', leaveSession);
    
    // Botões de Navegação
    buttons.backToHomeFromManageCat.addEventListener('click', () => switchScreen('home'));
    buttons.backToManageCat.addEventListener('click', () => switchScreen('manageCategory'));
    buttons.backToHomeFromCategory.addEventListener('click', () => {
        isCreator = false;
        switchScreen('home');
    });
    buttons.cancelLobby.addEventListener('click', leaveSession);

    // Listeners da Lista de Gerenciamento
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
            elements.itemNameInput.placeholder = 'Nome (Ex: Tocar violão 🎸)';
            elements.itemImageInput.style.display = 'block';
            showAddItemModal();
        }
    });
    
    // Listeners para o Arraste
    elements.itemCard.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove); 
    document.addEventListener('mouseup', dragEnd); 
    elements.itemCard.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove, { passive: false }); 
    document.addEventListener('touchend', dragEnd); 

    // --- Inicialização ---
    console.log("🎬 Iniciando Firebase...");
    initializeAppFirebase();
});
