// js/firebase-auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state, allowedEmails, adminEmails } from './state.js';
import { switchScreen, showError, elements } from './ui-manager.js';
import { listenToPublicLists, listenToUserLists } from './firestore-service.js';
import { leaveSession } from './session-manager.js';

export async function initializeAppFirebase() {
    try {
        if (typeof firebaseConfig === 'undefined') {
            throw new Error("Configuração do Firebase não encontrada.");
        }
        const app = initializeApp(firebaseConfig);
        state.db = getFirestore(app);
        state.auth = getAuth(app);
        setLogLevel('error');

        onAuthStateChanged(state.auth, async (user) => {
            if (user) {
                if (allowedEmails.includes(user.email)) {
                    state.userId = user.uid;
                    state.isAdmin = adminEmails.includes(user.email);
                    if (elements.userStatus) {
                        elements.userStatus.textContent = `Conectado como: ${user.email}`;
                    }
                    listenToPublicLists();
                    listenToUserLists(state.userId);
                    elements.loadingMessage.style.display = 'none';
                    switchScreen('home');
                } else {
                    await signOut(state.auth);
                    showError("Você não tem permissão para acessar este app.");
                    switchScreen('login');
                }
            } else {
                state.userLists = {};
                state.isAdmin = false;
                state.areUserListsReady = false;
                state.arePublicListsReady = false;
                if (elements.userStatus) {
                    elements.userStatus.textContent = '';
                }
                elements.loadingMessage.style.display = 'none';
                switchScreen('login');
            }
        });
    } catch (e) {
        console.error("Erro ao inicializar o Firebase:", e);
        showError("Erro fatal ao carregar o app. Verifique o console.");
    }
}

export async function handleLogin() {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    if (!email || !password) {
        showError("Por favor, preencha e-mail e senha.");
        return;
    }
    elements.loadingMessage.textContent = "Autenticando...";
    switchScreen('loading');
    try {
        await signInWithEmailAndPassword(state.auth, email, password);
    } catch (error) {
        console.error("Erro no login:", error.code, error.message);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            showError("E-mail ou senha incorretos. Tente novamente.");
        } else {
            showError("Ocorreu um erro ao tentar fazer login. Verifique sua conexão.");
        }
        switchScreen('login');
    }
}

export async function handleLogout() {
    try {
        // 1. Primeiro, limpa a sessão no Firestore (enquanto o usuário ainda está logado)
        await leaveSession();
        // 2. Depois, desloga o usuário do Firebase Auth
        await signOut(state.auth);
    } catch (error) {
        showError("Ocorreu um erro ao sair.");
    }
}