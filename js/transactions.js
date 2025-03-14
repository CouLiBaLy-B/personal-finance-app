// transactions.js - Gestion des transactions

import {
    getTransactions,
    addTransaction,
    formatCurrency,
    formatDate
} from './data.js';

import {
    appState,
    showEditTransactionModal,
    showDeleteConfirmModal
} from './app.js';

// Rendu de la page des transactions
function renderTransactions() {
    renderTransactionsList();
    initFilters();
    initAddTransactionForm();
}

// Rendu de la liste des transactions
function renderTransactionsList() {
    const transactionsList = document.querySelector('#transactions-page .transactions-list');
    const transactions = getTransactions(appState.filters);
    
    // Vider la liste
    transactionsList.innerHTML = '';
    
    // Ajouter chaque transaction
    transactions.forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        transactionsList.appendChild(transactionElement);
    });
}

// Création d'un élément de transaction avec actions
function createTransactionElement(transaction) {
    const transactionElement = document.createElement('div');
    transactionElement.className = 'transaction-item editable';
    transactionElement.setAttribute('data-id', transaction.id);
    
    const isIncome = transaction.amount > 0;
    const amountClass = isIncome ? 'income-amount' : 'expense-amount';
    const amountSign = isIncome ? '+' : '-';
    
    transactionElement.innerHTML = `
        <div class="transaction-info">
            <div class="category-icon">${transaction.icon}</div>
            <div class="transaction-details">
                <h4>${transaction.description}</h4>
                <p>${formatDate(transaction.date)}</p>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">${amountSign}${formatCurrency(Math.abs(transaction.amount))}</div>
        <div class="transaction-actions">
            <span class="action-btn edit">✏️</span>
            <span class="action-btn delete">🗑️</span>
        </div>
    `;
    
    // Ajouter les événements
    const editBtn = transactionElement.querySelector('.action-btn.edit');
    const deleteBtn = transactionElement.querySelector('.action-btn.delete');
    
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const transactionId = parseInt(transactionElement.getAttribute('data-id'));
        showEditTransactionModal(transactionId);
    });
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const transactionId = parseInt(transactionElement.getAttribute('data-id'));
        showDeleteConfirmModal(transactionId);
    });
    
    return transactionElement;
}

// Initialisation des filtres
function initFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const typeFilter = document.getElementById('type-filter');
    const dateFromFilter = document.getElementById('date-from');
    const dateToFilter = document.getElementById('date-to');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    // Charger les valeurs actuelles des filtres
    categoryFilter.value = appState.filters.category || 'all';
    typeFilter.value = appState.filters.type || 'all';
    dateFromFilter.value = appState.filters.dateFrom || '';
    dateToFilter.value = appState.filters.dateTo || '';
    
    // Événement pour appliquer les filtres
    applyFiltersBtn.addEventListener('click', () => {
        appState.filters = {
            category: categoryFilter.value,
            type: typeFilter.value,
            dateFrom: dateFromFilter.value,
            dateTo: dateToFilter.value
        };
        
        renderTransactionsList();
    });
}

// Initialisation du formulaire d'ajout de transaction
function initAddTransactionForm() {
    // Événement pour le bouton d'ajout de transaction
    document.getElementById('addTransactionBtnAll').addEventListener('click', () => {
        // Afficher une modale ou rediriger vers le formulaire du tableau de bord
        // Pour simplifier, nous redirigeons vers le tableau de bord
        document.querySelector('a[data-page="dashboard"]').click();
        
        // Faire défiler jusqu'au formulaire après un court délai
        setTimeout(() => {
            document.querySelector('#dashboard-page .add-transaction-form').scrollIntoView({
                behavior: 'smooth'
            });
        }, 100);
    });
}

// Ajouter une transaction
function addTransaction(transactionData) {
    // Importer les fonctions nécessaires
    import('./data.js').then(dataModule => {
        // Ajouter la transaction
        dataModule.addTransaction(transactionData);
        
        // Mettre à jour la liste des transactions
        renderTransactionsList();
        
        // Mettre à jour le tableau de bord si on est sur cette page
        if (document.getElementById('dashboard-page').classList.contains('active')) {
            import('./dashboard.js').then(dashboardModule => {
                dashboardModule.renderDashboard();
            });
        }
    });
}


export { renderTransactions };
