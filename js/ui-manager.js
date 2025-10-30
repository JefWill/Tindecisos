// js/ui-manager.js
import { state } from './state.js';
import { selectCategoryAndCreateSession } from './session-manager.js';
import { saveUserLists, savePublicLists } from './firestore-service.js';

export let elements = {};
export let screens = {};

/**
 * Mapeia todos os elementos de UI importantes para fácil acesso.
 */
export function mapUI() {
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

    elements = {
        emailInput: document.getElementById('email-input'),
        passwordInput: document.getElementById('password-input'),
        loadingMessage: document.getElementById('loading-message'),
        sessionInput: document.getElementById('session-id-input'),
        userStatus: document.getElementById('user-status'),
        categorySelectList: document.getElementById('category-select-list'),
        categorySelectFeedback: document.getElementById('category-select-feedback'),
        lobbyStatus: document.getElementById('lobby-status'),
        sessionIdDisplay: document.getElementById('session-id-display'),
        itemCard: document.getElementById('item-card'),
        itemImage: document.getElementById('item-image'),
        itemName: document.getElementById('item-name'),
        likedList: document.getElementById('liked-list'),
        noMatchesMsg: document.getElementById('no-matches-msg'),
        addFeedback: document.getElementById('add-feedback'),
        homeErrorMessage: document.getElementById('home-error-message'),
        addItemModal: document.getElementById('item-modal'),
        modalTitle: document.getElementById('item-modal-title'),
        itemNameInput: document.getElementById('item-name-input'),
        itemImageInput: document.getElementById('item-image-input'),
        manageCategoryList: document.getElementById('manage-category-list'),
        manageList: document.getElementById('manage-list'),
        manageTitle: document.getElementById('manage-title'),
        managePublicListsSection: document.getElementById('manage-public-lists-section')
    };
}

export function renderLogo() {
    const logoHTML = '<h1><span class="logo-brand">T</span>indecisos</h1>';
    const placeholders = document.querySelectorAll('.logo-container');
    placeholders.forEach(placeholder => {
        placeholder.innerHTML = logoHTML;
    });
}

export function switchScreen(screenName) {
    console.log(`🔄 Mudando para tela: ${screenName}`);
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    } else {
        console.error(`❌ Tela não encontrada: ${screenName}`);
    }
}

export function showError(message) {
    const errorElement = document.querySelector('.screen.active .error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    } else if (elements.homeErrorMessage && screens.home.classList.contains('active')) {
        elements.homeErrorMessage.textContent = message;
        elements.homeErrorMessage.style.display = 'block';
    } else {
        elements.loadingMessage.textContent = message;
    }
}

export function renderCategorySelection() {
    elements.categorySelectList.innerHTML = '';
    const hasPrivateLists = state.userLists && Object.keys(state.userLists).length > 0;
    const hasPublicLists = state.publicLists && Object.keys(state.publicLists).length > 0;

    if (!hasPrivateLists && !hasPublicLists) {
        elements.categorySelectList.innerHTML = '<p style="padding: 2rem; text-align: center; color: var(--text-secondary);">Nenhuma lista encontrada. Crie uma em "Gerenciar Minhas Listas"!</p>';
        return;
    }

    const createCard = (categoryKey, isPrivate) => {
        const card = document.createElement('div');
        card.className = 'category-card-select';
        card.textContent = `${categoryKey} ${isPrivate ? '(Privada)' : '(Pública)'}`;
        card.dataset.category = categoryKey;
        card.dataset.private = isPrivate;
        elements.categorySelectList.appendChild(card);
    };

    if (hasPrivateLists) {
        const privateHeader = document.createElement('h4');
        privateHeader.textContent = 'Minhas Listas Privadas';
        privateHeader.style.cssText = 'text-align: left; margin-bottom: 0.5rem; color: var(--text-primary);';
        elements.categorySelectList.appendChild(privateHeader);
        Object.keys(state.userLists).forEach(key => createCard(key, true));
    }

    if (hasPublicLists) {
        const publicHeader = document.createElement('h4');
        publicHeader.textContent = 'Listas Públicas do App';
        publicHeader.style.cssText = 'text-align: left; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-primary);';
        elements.categorySelectList.appendChild(publicHeader);
        Object.keys(state.publicLists).forEach(key => createCard(key, false));
    }

    if (!elements.categorySelectList.dataset.listenerAttached) {
        elements.categorySelectList.addEventListener('click', (e) => {
            const card = e.target.closest('.category-card-select');
            if (card) {
                const category = card.dataset.category;
                const isPrivate = card.dataset.private === 'true';
                selectCategoryAndCreateSession(category, isPrivate);
            }
        });
        elements.categorySelectList.dataset.listenerAttached = 'true';
    }
}

export function updateLobbyStatus() {
    elements.sessionIdDisplay.textContent = state.currentSessionId;
    elements.lobbyStatus.textContent = "Aguardando outro jogador entrar...";
}

export function showNextCard(onDoneCallback) {
    if (!state.sessionData) return;
    const myIndex = state.isCreator ? state.sessionData.player1Index : state.sessionData.player2Index;

    if (myIndex < state.sessionData.itemsWithVotes.length) {
        const item = state.sessionData.itemsWithVotes[myIndex];
        elements.itemName.textContent = item.name;
        elements.itemImage.src = item.image || ''; // Define o src, se for vazio, o onerror será acionado
        elements.itemImage.onerror = function() {
            this.src = `https://placehold.co/400x250/eee/ccc?text=${encodeURIComponent(item.name)}`;
            this.onerror = null; // Evita loop de erro se a imagem de fallback também falhar
        };
        elements.itemCard.className = 'card slide-in';
        elements.itemCard.style.transform = '';
        setTimeout(() => elements.itemCard.classList.remove('slide-in'), 20);
    } else {
        // Chama o callback fornecido quando os cards acabam
        if (onDoneCallback) onDoneCallback();
    }
}

export function showResults() {
    elements.likedList.innerHTML = '';
    let matchesFound = [];

    if (state.sessionData && state.sessionData.itemsWithVotes) {
        matchesFound = state.sessionData.itemsWithVotes.filter(item =>
            item.p1_vote === 'like' && item.p2_vote === 'like'
        );
    }

    if (matchesFound.length > 0) {
        elements.noMatchesMsg.style.display = 'none';
        elements.likedList.style.display = 'block';
        matchesFound.forEach(item => {
            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = item.image || `https://placehold.co/60x60/eee/ccc?text=...`;
            img.alt = item.name;
            img.className = 'result-thumb';
            img.onerror = function() { this.src = 'https://placehold.co/60x60/eee/ccc?text=...'; };
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

// --- Funções de Gerenciamento (CRUD UI) ---

export function showAddItemModal(isNewCategory = false) {
    elements.addItemModal.classList.add('active');
    elements.itemNameInput.focus();
    elements.itemNameInput.placeholder = isNewCategory ? 'Nome da Categoria (Ex: Filmes)' : 'Nome (Ex: Tocar violão 🎸)';
    elements.itemImageInput.style.display = isNewCategory ? 'none' : 'block';
}

export function closeAddItemModal() {
    elements.addItemModal.classList.remove('active');
    elements.itemNameInput.value = '';
    elements.itemImageInput.value = '';
    elements.itemNameInput.placeholder = 'Nome (Ex: Tocar violão 🎸)';
    elements.itemImageInput.style.display = 'block';
    state.currentEditIndex = null;
    state.currentListType = 'private';
}

export function renderManageList(categoryKey) {
    elements.manageTitle.textContent = `Gerenciando "${categoryKey}"`;
    elements.manageList.innerHTML = '';

    const listToRender = state.currentListType === 'private' ? state.userLists[categoryKey] : state.publicLists[categoryKey];

    if (!listToRender || listToRender.length === 0) {
        elements.manageList.innerHTML = '<p style="padding: 1rem; text-align: center; color: #777;">Nenhum item cadastrado.</p>';
    } else {
        listToRender.forEach((item, index) => {
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
    }

    const addButtonLi = document.createElement('li');
    addButtonLi.innerHTML = `<button class="add-new-item-btn-list">Adicionar Novo Item +</button>`;
    elements.manageList.appendChild(addButtonLi);
}

export function openEditModal(index) {
    const listToEdit = state.currentListType === 'private' ? state.userLists : state.publicLists;
    state.currentEditIndex = index;
    const item = listToEdit[state.currentCategoryKey][index];

    elements.modalTitle.textContent = `Editar "${item.name}"`;
    elements.itemNameInput.value = item.name;
    elements.itemImageInput.value = item.image || '';

    showAddItemModal(false);
}

export function deleteItem(index) {
    const listToDeleteFrom = state.currentListType === 'private' ? state.userLists : state.publicLists;
    const itemToDelete = listToDeleteFrom[state.currentCategoryKey][index];
    const confirmModal = document.getElementById('confirm-modal');
    const confirmText = document.getElementById('confirm-modal-text');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');

    confirmText.innerHTML = `Você tem certeza de que deseja excluir "<strong>${itemToDelete.name}</strong>"? Esta ação não pode ser desfeita.`;
    confirmModal.classList.add('active');

    const saveFunction = state.currentListType === 'private' ? saveUserLists : savePublicLists;

    const performDelete = () => {
        listToDeleteFrom[state.currentCategoryKey].splice(index, 1);
        saveFunction();
        renderManageList(state.currentCategoryKey);
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

export function renderManageCategoryList() {
    elements.manageCategoryList.innerHTML = '';
    elements.managePublicListsSection.innerHTML = '';
    elements.managePublicListsSection.style.display = 'none';

    if (!state.userLists || Object.keys(state.userLists).length === 0) {
        elements.manageCategoryList.innerHTML = '<p style="padding: 1rem; text-align: center; color: #777;">Você ainda não tem nenhuma lista privada.</p>';
    }

    // Renderiza Listas Privadas
    const privateHeader = document.createElement('h3');
    privateHeader.textContent = 'Minhas Listas';
    privateHeader.style.cssText = 'text-align: left; margin-bottom: 0.5rem; color: var(--text-primary);';
    elements.manageCategoryList.appendChild(privateHeader);

    Object.keys(state.userLists).forEach(categoryKey => {
        const card = document.createElement('div');
        card.className = 'category-card-select category-card-manage'; // Adiciona a classe para flexbox
        card.dataset.category = categoryKey;
        card.dataset.listType = 'private';
        card.innerHTML = `
            <span>${categoryKey}</span>
            <button class="delete-btn delete-category-btn" data-key="${categoryKey}" data-type="private" aria-label="Excluir lista ${categoryKey}">🗑️</button>
        `;
        elements.manageCategoryList.appendChild(card);
    });

    const addPrivateCategoryBtn = document.createElement('button');
    addPrivateCategoryBtn.id = 'add-new-private-category-btn';
    addPrivateCategoryBtn.className = 'manage-btn';
    addPrivateCategoryBtn.textContent = 'Adicionar Nova Lista Privada +';
    elements.manageCategoryList.appendChild(addPrivateCategoryBtn);

    // Renderiza seção de Listas Públicas se for admin
    if (state.isAdmin) {
        elements.managePublicListsSection.style.display = 'block';
        const publicHeader = document.createElement('h3');
        publicHeader.textContent = 'Listas Públicas';
        publicHeader.style.cssText = 'text-align: left; margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text-primary);';
        elements.managePublicListsSection.appendChild(publicHeader);

        if (!state.publicLists || Object.keys(state.publicLists).length === 0) {
            elements.managePublicListsSection.innerHTML += '<p style="padding: 1rem; text-align: center; color: #777;">Nenhuma lista pública cadastrada.</p>';
        }

        Object.keys(state.publicLists).forEach(categoryKey => {
            const card = document.createElement('div');
            card.className = 'category-card-select category-card-manage'; // Adiciona a classe para flexbox
            card.dataset.category = categoryKey;
            card.dataset.listType = 'public';
            card.innerHTML = `
                <span>${categoryKey}</span>
                <button class="delete-btn delete-category-btn" data-key="${categoryKey}" data-type="public" aria-label="Excluir lista ${categoryKey}">🗑️</button>
            `;
            elements.managePublicListsSection.appendChild(card);
        });

        const addPublicCategoryBtn = document.createElement('button');
        addPublicCategoryBtn.id = 'add-new-public-category-btn';
        addPublicCategoryBtn.className = 'manage-btn';
        addPublicCategoryBtn.textContent = 'Adicionar Nova Lista Pública +';
        elements.managePublicListsSection.appendChild(addPublicCategoryBtn);
    }
}

export function handleManageCategoryClick(e) {
    const categoryCard = e.target.closest('.category-card-select');
    const addPrivateCategoryBtn = e.target.closest('#add-new-private-category-btn');
    const addPublicCategoryBtn = e.target.closest('#add-new-public-category-btn');

    if (categoryCard) {
        const category = categoryCard.dataset.category;
        const listType = categoryCard.dataset.listType;
        if (category && listType) {
            state.currentCategoryKey = category;
            state.currentListType = listType;
            renderManageList(category);
            switchScreen('manageItems');
        }
    } else if (addPrivateCategoryBtn) {
        state.currentEditIndex = null;
        state.currentCategoryKey = null;
        state.currentListType = 'private';
        elements.modalTitle.textContent = `Adicionar Nova Lista Privada`;
        showAddItemModal(true);
    } else if (addPublicCategoryBtn && state.isAdmin) {
        state.currentEditIndex = null;
        state.currentCategoryKey = null;
        state.currentListType = 'public';
        elements.modalTitle.textContent = `Adicionar Nova Lista Pública`;
        showAddItemModal(true);
    }
}

export function saveModalData() {
    const newName = elements.itemNameInput.value.trim();
    if (!newName) {
        elements.itemNameInput.focus();
        return;
    }

    if (state.currentCategoryKey === null) {
        // Criando uma nova categoria
        const targetList = state.currentListType === 'private' ? state.userLists : state.publicLists;
        const saveFunction = state.currentListType === 'private' ? saveUserLists : savePublicLists;

        if (targetList[newName]) {
            elements.addFeedback.textContent = `Lista "${newName}" já existe!`;
        } else {
            targetList[newName] = [];
            saveFunction();
            elements.addFeedback.textContent = `Lista "${newName}" foi criada!`;
            renderManageCategoryList();
        }
    } else {
        // Adicionando/Editando um item
        const newImage = elements.itemImageInput.value.trim();
        const newItem = { name: newName, image: newImage || null };

        const targetList = state.currentListType === 'private' ? state.userLists : state.publicLists;
        const saveFunction = state.currentListType === 'private' ? saveUserLists : savePublicLists;

        if (state.currentEditIndex !== null) {
            targetList[state.currentCategoryKey][state.currentEditIndex] = newItem;
            elements.addFeedback.textContent = `${newName} foi atualizado!`;
        } else {
            targetList[state.currentCategoryKey].push(newItem);
            elements.addFeedback.textContent = `${newName} foi adicionado!`;
        }
        saveFunction();

        if (screens.manageItems.classList.contains('active')) {
            renderManageList(state.currentCategoryKey);
        }
    }

    setTimeout(() => { elements.addFeedback.textContent = ''; }, 2000);
    closeAddItemModal();
}

/**
 * Verifica se a tela de gerenciamento de categorias está ativa e, se estiver,
 * a renderiza novamente para refletir as mudanças de estado.
 */
export function checkAndRender() {
    if (screens.manageCategory?.classList.contains('active')) {
        renderManageCategoryList();
    }
}

// --- Funções de Drag (Arrastar) ---
let startX = 0;
let currentX = 0;
const swipeThreshold = 100;

function getClientX(e) {
    if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
    return e.clientX;
}

export function dragStart(e) {
    if (state.isAnimating || !state.sessionData) return;
    const myIndex = state.isCreator ? state.sessionData.player1Index : state.sessionData.player2Index;
    if (myIndex >= state.sessionData.itemsWithVotes.length) return;

    state.isDragging = true;
    startX = getClientX(e);
    currentX = startX;
    elements.itemCard.style.transition = 'none';
    elements.itemCard.style.cursor = 'grabbing';
}

export function dragMove(e) {
    if (!state.isDragging || state.isAnimating) return;
    e.preventDefault();
    currentX = getClientX(e);
    const deltaX = currentX - startX;
    elements.itemCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.1}deg)`;
}

export function dragEnd(e, onSwipeCallback) {
    if (!state.isDragging || state.isAnimating) return;
    state.isDragging = false;
    const deltaX = currentX - startX;

    elements.itemCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
    elements.itemCard.style.cursor = 'grab';

    if (onSwipeCallback && (deltaX > swipeThreshold || deltaX < -swipeThreshold)) {
        const action = deltaX > swipeThreshold ? 'like' : 'dislike';
        onSwipeCallback(action);
    } else {
        elements.itemCard.style.transform = 'translateX(0) rotate(0)';
    }
    startX = 0;
    currentX = 0;
}