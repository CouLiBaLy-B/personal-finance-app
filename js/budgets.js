// budgets.js - Gestion des budgets

import {
    getBudgets,
    addBudget,
    updateBudget,
    deleteBudget,
    formatCurrency
} from './data.js';

// Rendu de la page des budgets
function renderBudgets() {
    renderBudgetsList();
    initTabs();
    initAddBudgetForm();
}

// Rendu de la liste des budgets
function renderBudgetsList() {
    const activeBudgetsContainer = document.getElementById('active-budgets');
    const allBudgetsContainer = document.getElementById('all-budgets');
    const budgets = getBudgets();
    
    // Vider les conteneurs
    activeBudgetsContainer.innerHTML = '';
    allBudgetsContainer.innerHTML = '';
    
    // Ajouter chaque budget
    budgets.forEach(budget => {
        const budgetElement = createBudgetElement(budget);
        
        // Ajouter au conteneur des budgets actifs
        activeBudgetsContainer.appendChild(budgetElement.cloneNode(true));
        
        // Ajouter au conteneur de tous les budgets
        allBudgetsContainer.appendChild(budgetElement);
    });
    
    // Ajouter les événements
    addBudgetEvents(activeBudgetsContainer);
    addBudgetEvents(allBudgetsContainer);
}

// Création d'un élément de budget
function createBudgetElement(budget) {
    const percentage = (budget.spent / budget.amount) * 100;
    let progressClass = 'good';
    
    if (percentage >= 90 && percentage < 100) {
        progressClass = 'warning';
    } else if (percentage >= 100) {
        progressClass = 'danger';
    }
    
    const budgetElement = document.createElement('div');
    budgetElement.className = 'budget-item';
    budgetElement.setAttribute('data-id', budget.id);
    
    budgetElement.innerHTML = `
        <div class="budget-info">
            <div class="budget-name">${budget.name}</div>
            <div class="budget-details">${formatCurrency(budget.spent)} / ${formatCurrency(budget.amount)} - ${Math.round(percentage)}%</div>
            <div class="progress-bar">
                <div class="progress ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
        </div>
        <div class="transaction-actions">
            <span class="action-btn edit">✏️</span>
            <span class="action-btn delete">🗑️</span>
        </div>
    `;
    
    return budgetElement;
}

// Ajout des événements pour les budgets
function addBudgetEvents(container) {
    const editButtons = container.querySelectorAll('.action-btn.edit');
    const deleteButtons = container.querySelectorAll('.action-btn.delete');
    
    editButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const budgetId = parseInt(button.closest('.budget-item').getAttribute('data-id'));
            showEditBudgetModal(budgetId);
        });
    });
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const budgetId = parseInt(button.closest('.budget-item').getAttribute('data-id'));
            showDeleteBudgetConfirm(budgetId);
        });
    });
}

// Initialisation des onglets
function initTabs() {
    const tabItems = document.querySelectorAll('.tab-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            // Désactiver tous les onglets
            tabItems.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Activer l'onglet cliqué
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Initialisation du formulaire d'ajout de budget
function initAddBudgetForm() {
    const form = document.querySelector('#budgets-page .add-transaction-form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('budget-name').value;
        const amount = parseFloat(document.getElementById('budget-amount').value);
        const category = document.getElementById('budget-category').value;
        const period = document.getElementById('budget-period').value;
        
        if (!name || isNaN(amount) || amount <= 0 || !category) {
            alert('Veuillez remplir tous les champs correctement.');
            return;
        }
        
        // Ajouter le budget
        addBudget({
            name,
            amount,
            category,
            period
        });
        
        // Réinitialiser le formulaire
        form.reset();
        
        // Mettre à jour la liste des budgets
        renderBudgetsList();
    });
    
    // Événement pour le bouton d'ajout de budget
    document.getElementById('addBudgetBtn').addEventListener('click', () => {
        // Faire défiler jusqu'au formulaire
        form.scrollIntoView({
            behavior: 'smooth'
        });
    });
}

// Afficher la modale d'édition de budget
function showEditBudgetModal(budgetId) {
    const budget = getBudgets().find(b => b.id === budgetId);
    if (!budget) return;
    
    // Créer une modale temporaire (car elle n'existe pas dans le HTML)
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'edit-budget-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Modifier le budget</h3>
                <span class="modal-close">&times;</span>
            </div>
            <form class="add-transaction-form">
                <div class="form-group">
                    <label for="edit-budget-name">Nom du budget</label>
                    <input type="text" id="edit-budget-name" class="form-control" value="${budget.name}">
                </div>
                <div class="form-group">
                    <label for="edit-budget-amount">Montant</label>
                    <input type="number" id="edit-budget-amount" class="form-control" value="${budget.amount}" step="0.01">
                </div>
                <div class="form-group">
                    <label for="edit-budget-category">Catégorie</label>
                    <select id="edit-budget-category" class="form-control">
                        <option value="housing" ${budget.category === 'housing' ? 'selected' : ''}>Logement</option>
                        <option value="food" ${budget.category === 'food' ? 'selected' : ''}>Nourriture</option>
                        <option value="transport" ${budget.category === 'transport' ? 'selected' : ''}>Transport</option>
                        <option value="leisure" ${budget.category === 'leisure' ? 'selected' : ''}>Loisirs</option>
                        <option value="health" ${budget.category === 'health' ? 'selected' : ''}>Santé</option>
                        <option value="other" ${budget.category === 'other' ? 'selected' : ''}>Autre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="edit-budget-period">Période</label>
                    <select id="edit-budget-period" class="form-control">
                        <option value="monthly" ${budget.period === 'monthly' ? 'selected' : ''}>Mensuel</option>
                        <option value="quarterly" ${budget.period === 'quarterly' ? 'selected' : ''}>Trimestriel</option>
                        <option value="yearly" ${budget.period === 'yearly' ? 'selected' : ''}>Annuel</option>
                    </select>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary modal-cancel">Annuler</button>
                    <button type="submit" class="btn btn-primary">Sauvegarder</button>
                </div>
            </form>
        </div>
    `;
    
    // Ajouter la modale au document
    document.body.appendChild(modal);
    
    // Gérer la fermeture de la modale
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Gérer la soumission du formulaire
    const form = modal.querySelector('form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const updatedData = {
            name: document.getElementById('edit-budget-name').value,
            amount: parseFloat(document.getElementById('edit-budget-amount').value),
            category: document.getElementById('edit-budget-category').value,
            period: document.getElementById('edit-budget-period').value
        };
        
        updateBudget(budgetId, updatedData);
        
        // Fermer la modale
        document.body.removeChild(modal);
        
        // Mettre à jour la liste des budgets
        renderBudgetsList();
    });
}

// Afficher la confirmation de suppression de budget
function showDeleteBudgetConfirm(budgetId) {
    const budget = getBudgets().find(b => b.id === budgetId);
    if (!budget) return;
    
    // Créer une modale temporaire
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'delete-budget-modal';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Confirmer la suppression</h3>
                <span class="modal-close">&times;</span>
            </div>
            <p>Êtes-vous sûr de vouloir supprimer le budget "${budget.name}" ? Cette action est irréversible.</p>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-cancel">Annuler</button>
                <button class="btn btn-danger confirm-delete">Supprimer</button>
            </div>
        </div>
    `;
    
    // Ajouter la modale au document
    document.body.appendChild(modal);
    
    // Gérer la fermeture de la modale
    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('.modal-cancel');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // Gérer la confirmation de suppression
    const confirmBtn = modal.querySelector('.confirm-delete');
    confirmBtn.addEventListener('click', () => {
        deleteBudget(budgetId);
        
        // Fermer la modale
        document.body.removeChild(modal);
        
        // Mettre à jour la liste des budgets
        renderBudgetsList();
    });
}

export { renderBudgets };

