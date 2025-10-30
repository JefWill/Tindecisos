// js/state.js

// --- Listas de Usuários ---
export const allowedEmails = [
    "jeffersonsenarn@gmail.com",
    "jessicaminern@gmail.com",
    "jeffersonwillamern@gmail.com",
    "pedrobilau177@gmail.com",
    "ellydapereira124@gmail.com"
];

export const adminEmails = [
    "jeffersonsenarn@gmail.com",
    "jessicaminern@gmail.com",
    "jeffersonwillamern@gmail.com"
];

// --- Estado da Aplicação ---
export let state = {
    db: null,
    auth: null,
    userId: null,
    sessionUnsubscribe: null,
    currentSessionId: null,
    isCreator: false,
    sessionData: null,
    isAdmin: false,
    currentListType: 'private',
    currentCategoryKey: null,
    currentEditIndex: null,
    arePublicListsReady: false,
    areUserListsReady: false,
    publicLists: {},
    userLists: {},
    isDragging: false,
    isAnimating: false
};