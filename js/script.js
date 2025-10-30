// js/script.js - Arquivo Principal (Orquestrador)

import { state } from './state.js';
import { initializeAppFirebase, handleLogin, handleLogout } from './firebase-auth.js';
import { createSession, joinSession, leaveSession, handleSwipe } from './session-manager.js';
import { 
    mapUI, renderLogo, switchScreen, renderManageCategoryList, closeAddItemModal, 
    saveModalData, openEditModal, deleteItem, showAddItemModal, handleManageCategoryClick,
    dragStart, dragMove, dragEnd, elements
} from './ui-manager.js';

let buttons = {};

// --- Inicialização do DOM ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 DOM Carregado - Iniciando app...");
    
    // Mapeia todos os elementos da UI
    mapUI();
    
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
    
    // --- Renderiza elementos reutilizáveis ---
    renderLogo();

    // --- Listeners de Eventos Globais ---
    // Tela de Login
    buttons.login.addEventListener('click', handleLogin);
    elements.emailInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    elements.passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });

    // Tela Inicial
    buttons.createSession.addEventListener('click', () => {
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
        state.isCreator = false;
        switchScreen('home');
        // Reseta o tipo de lista atual ao sair da seleção de categoria
        state.currentListType = 'private';
        state.currentCategoryKey = null;
        state.currentEditIndex = null;
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
            const singular = state.currentCategoryKey.endsWith('s') ? state.currentCategoryKey.slice(0, -1) : state.currentCategoryKey;
            elements.modalTitle.textContent = `Adicionar Novo ${singular}`;
            state.currentEditIndex = null; 
            elements.itemNameInput.value = '';
            elements.itemImageInput.value = '';
            showAddItemModal(false); // Não é uma nova categoria, mas um novo item
        }
    });
    
    // Anexa o listener centralizado para cliques no gerenciamento de categorias
    // Substitui o listener antigo que estava em `renderManageCategoryList`
    if (!elements.manageCategoryList.dataset.listenerAttached) {
        elements.manageCategoryList.addEventListener('click', handleManageCategoryClick);
        elements.manageCategoryList.dataset.listenerAttached = 'true';
    }
    elements.managePublicListsSection.addEventListener('click', handleManageCategoryClick);

    // Listeners para o Arraste
    elements.itemCard.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', dragMove);
    document.addEventListener('mouseup', (e) => dragEnd(e, handleSwipe));
    elements.itemCard.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', dragMove, { passive: false });
    document.addEventListener('touchend', (e) => dragEnd(e, handleSwipe));

    // --- Inicialização ---
    console.log("🎬 Iniciando Firebase...");
    initializeAppFirebase();
});