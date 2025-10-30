// js/firestore-service.js
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { state } from './state.js';
import { showError, renderManageCategoryList } from './ui-manager.js';

const defaultPublicData = {
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

export function listenToPublicLists() {
    const appDataRef = doc(state.db, "app-data", "lists");

    onSnapshot(appDataRef, (docSnap) => {
        if (docSnap.exists()) {
            state.publicLists = docSnap.data();
            console.log("Listas públicas sincronizadas:", state.publicLists);
        } else {
            console.log("Nenhum dado de lista encontrado no Firestore. Criando com dados padrão...");
            state.publicLists = JSON.parse(JSON.stringify(defaultPublicData));
            savePublicLists();
        }
        state.arePublicListsReady = true;
    });
}

export function listenToUserLists(uid) {
    const userListsRef = doc(state.db, "user-lists", uid);
    onSnapshot(userListsRef, (docSnap) => {
        if (docSnap.exists()) {
            state.userLists = docSnap.data();
            console.log("Listas do usuário sincronizadas:", state.userLists);
        } else {
            state.userLists = {};
            console.log("Usuário não possui listas privadas ainda.");
        }
        state.areUserListsReady = true;
        
        // Importa screens dinamicamente para evitar dependência circular
        import('./ui-manager.js').then(({ screens }) => {
            if (screens.manageCategory?.classList.contains('active')) {
                renderManageCategoryList();
            }
        });
    });
}

export async function saveUserLists() {
    if (!state.userId) return;
    const userListsRef = doc(state.db, "user-lists", state.userId);
    try {
        await setDoc(userListsRef, state.userLists);
    } catch (error) {
        console.error("Erro ao salvar listas do usuário:", error);
        showError("Erro ao sincronizar suas listas privadas.");
    }
}

export async function savePublicLists() {
    const appDataRef = doc(state.db, "app-data", "lists");
    try {
        await setDoc(appDataRef, state.publicLists);
    } catch (error) {
        console.error("Erro ao salvar dados das listas no Firestore:", error);
        showError("Erro ao sincronizar listas.");
    }
}