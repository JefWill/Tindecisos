// js/session-manager.js
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { switchScreen, showError, renderCategorySelection, updateLobbyStatus, showNextCard, showResults, elements } from './ui-manager.js';

export function createSession() {
    state.isCreator = true;

    if (!state.arePublicListsReady || !state.areUserListsReady) {
        elements.loadingMessage.textContent = "Carregando listas...";
        switchScreen('loading');

        const checkInterval = setInterval(() => {
            if (state.arePublicListsReady && state.areUserListsReady) {
                clearInterval(checkInterval);
                renderCategorySelection();
                switchScreen('categorySelect');
            }
        }, 100);
        return;
    }

    renderCategorySelection();
    switchScreen('categorySelect');
}

export async function joinSession() {
    const sessionIdToJoin = elements.sessionInput.value.trim().toUpperCase();
    if (!sessionIdToJoin) {
        showError("Por favor, insira um ID de sessão.");
        return;
    }

    elements.loadingMessage.textContent = `Entrando na sessão ${sessionIdToJoin}...`;
    switchScreen('loading');

    try {
        const sessionRef = doc(state.db, `tindecisos-sessions/${sessionIdToJoin}`);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
            showError("Sessão não encontrada. Verifique o ID.");
            switchScreen('home');
            return;
        }

        state.isCreator = false;
        state.currentSessionId = sessionIdToJoin;

        await updateDoc(sessionRef, { joinerId: state.userId });
        listenToSession(state.currentSessionId);

    } catch (error) {
        console.error("Erro ao entrar na sessão:", error);
        showError(`Erro ao entrar na sessão. ${error.message}`);
        switchScreen('home');
    }
}

export async function selectCategoryAndCreateSession(categoryKey, isPrivate) {
    if (!state.isCreator) return;

    state.currentSessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    elements.loadingMessage.textContent = `Criando sessão ${state.currentSessionId}...`;
    switchScreen('loading');

    const items = isPrivate ? state.userLists[categoryKey] || [] : state.publicLists[categoryKey] || [];
    const itemsWithVotes = items.map(item => ({ ...item, p1_vote: null, p2_vote: null }));

    const newSessionData = {
        creatorId: state.userId,
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
        const sessionRef = doc(state.db, `tindecisos-sessions/${state.currentSessionId}`);
        await setDoc(sessionRef, newSessionData);
        listenToSession(state.currentSessionId);
    } catch (error) {
        console.error("Erro ao criar sessão:", error);
        showError("Erro ao criar sessão. Tente novamente.");
        switchScreen('home');
    }
}

function listenToSession(sessionId) {
    const sessionRef = doc(state.db, `tindecisos-sessions/${sessionId}`);
    state.sessionUnsubscribe = onSnapshot(sessionRef, (docSnap) => {
        if (!docSnap.exists()) {
            showError("A sessão foi encerrada ou não existe mais.");
            leaveSession();
            return;
        }
        state.sessionData = docSnap.data();
        handleSessionStateChange(state.sessionData);
    });
}

function handleSessionStateChange(data) {
    const currentScreenId = document.querySelector('.screen.active')?.id;

    if (data.player1Done && data.player2Done) {
        if (currentScreenId !== 'results-screen') showResults();
        return;
    }

    if (data.joinerId) {
        if (currentScreenId !== 'swipe-screen') {
            switchScreen('swipe');
            showNextCard(markPlayerAsDone); // Passa a função como callback
        }
        return;
    }

    if (state.isCreator && !data.joinerId) {
        if (currentScreenId !== 'lobby-screen') {
            switchScreen('lobby');
            updateLobbyStatus();
        }
    }
}

export function leaveSession() {
    if (state.sessionUnsubscribe) {
        state.sessionUnsubscribe();
        state.sessionUnsubscribe = null;
    }

    if (state.currentSessionId && state.sessionData) {
        const sessionRef = doc(state.db, `tindecisos-sessions/${state.currentSessionId}`);
        if (state.isCreator) {
            deleteDoc(sessionRef).catch(err => console.error("Erro ao deletar sessão:", err));
        } else {
            updateDoc(sessionRef, { joinerId: null }).catch(err => console.error("Erro ao sair da sessão:", err));
        }
    }

    state.currentSessionId = null;
    state.isCreator = false;
    state.sessionData = null;

    document.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });

    switchScreen('home');
}

export async function handleSwipe(action) {
    if (state.isAnimating || !state.sessionData) return;

    const myIndex = state.isCreator ? state.sessionData.player1Index : state.sessionData.player2Index;
    if (myIndex >= state.sessionData.itemsWithVotes.length) return;

    state.isAnimating = true;

    const voteField = state.isCreator ? `p1_vote` : `p2_vote`;
    const indexField = state.isCreator ? 'player1Index' : 'player2Index';
    const nextIndex = myIndex + 1;

    let updatedItems = [...state.sessionData.itemsWithVotes];
    updatedItems[myIndex][voteField] = action;

    try {
        const sessionRef = doc(state.db, `tindecisos-sessions/${state.currentSessionId}`);
        await updateDoc(sessionRef, { itemsWithVotes: updatedItems, [indexField]: nextIndex });

        elements.itemCard.style.transform = '';
        elements.itemCard.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';
        elements.itemCard.classList.add(action === 'like' ? 'slide-out-right' : 'slide-out-left');

        setTimeout(() => {
            showNextCard(markPlayerAsDone); // Passa a função como callback aqui também
            state.isAnimating = false;
        }, 400);

    } catch (error) {
        console.error("Erro ao salvar swipe:", error);
        showError("Erro de conexão ao salvar voto.");
        state.isAnimating = false;
    }
}

export async function markPlayerAsDone() {
    if (!state.sessionData) return;
    const doneField = state.isCreator ? 'player1Done' : 'player2Done';
    if (state.sessionData[doneField] === true) return;

    try {
        const sessionRef = doc(state.db, `tindecisos-sessions/${state.currentSessionId}`);
        await updateDoc(sessionRef, { [doneField]: true });
        elements.itemName.textContent = "Aguardando o outro jogador...";
        elements.itemImage.src = `https://placehold.co/400x250/eee/ccc?text=Aguardando...`;
        elements.itemCard.className = 'card';
        elements.itemCard.style.transform = 'none';
    } catch (error) {
        console.error("Erro ao finalizar:", error);
        showError("Erro ao finalizar sua parte.");
    }
}