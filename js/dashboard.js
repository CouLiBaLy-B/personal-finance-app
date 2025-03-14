// dashboard.js - Gestion du tableau de bord

import {
    getTransactions,
    getRecentTransactions,
    getBudgets,
    getCategoryExpenses,
    getFinancialSummary,
    formatCurrency
} from './data.js';

// Rendu du tableau de bord
function renderDashboard() {
    renderFinancialSummary();
    renderRecentTransactions();
    renderBudgetProgress();
    renderExpenseChart();
    initAddTransactionForm();
}

// Rendu du résumé financier
function renderFinancialSummary() {
    const summary = getFinancialSummary();
    
    // Mettre à jour les cartes de résumé
    const summaryCards = document.querySelectorAll('.summary-card .amount');
    summaryCards[0].textContent = formatCurrency(summary.income);
    summaryCards[1].textContent = formatCurrency(summary.expenses);
    summaryCards[2].textContent = formatCurrency(summary.balance);
}

// Rendu des transactions récentes
function renderRecentTransactions() {
    const transactionsList = document.querySelector('#dashboard-page .transactions-list');
    transactionsList.innerHTML = '';
    
    const recentTransactions = getRecentTransactions(5);
    
    if (recentTransactions.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">Aucune transaction récente.</p>';
        return;
    }
    
    recentTransactions.forEach(transaction => {
        const transactionElement = createTransactionElement(transaction);
        transactionsList.appendChild(transactionElement);
    });
}

// Création d'un élément de transaction
function createTransactionElement(transaction) {
    const transactionElement = document.createElement('div');
    transactionElement.className = 'transaction-item editable';
    transactionElement.setAttribute('data-id', transaction.id);
    
    const categoryIcon = getCategoryIcon(transaction.category);
    const amountClass = transaction.type === 'income' ? 'income-amount' : 'expense-amount';
    const amountPrefix = transaction.type === 'income' ? '+' : '-';
    
    transactionElement.innerHTML = `
        <div class="transaction-info">
            <div class="category-icon">${categoryIcon}</div>
            <div class="transaction-details">
                <h4>${transaction.description}</h4>
                <p>${new Date(transaction.date).toLocaleDateString()}</p>
            </div>
        </div>
        <div class="transaction-amount ${amountClass}">${amountPrefix}${formatCurrency(transaction.amount)}</div>
    `;
    
    // Ajouter un événement de clic pour éditer la transaction
    transactionElement.addEventListener('click', () => {
        showEditTransactionModal(transaction.id);
    });
    
    return transactionElement;
}

// Rendu de la progression du budget
function renderBudgetProgress() {
    const budgetProgress = document.querySelector('.budget-progress');
    budgetProgress.innerHTML = '';
    
    const budgets = getBudgets();
    
    if (budgets.length === 0) {
        budgetProgress.innerHTML = '<p class="no-data">Aucun budget défini.</p>';
        return;
    }
    
    budgets.slice(0, 5).forEach(budget => {
        const percentage = (budget.spent / budget.amount) * 100;
        let progressClass = 'good';
        
        if (percentage >= 90 && percentage < 100) {
            progressClass = 'warning';
        } else if (percentage >= 100) {
            progressClass = 'danger';
        }
        
        const budgetElement = document.createElement('div');
        budgetElement.className = 'budget-category';
        budgetElement.innerHTML = `
            <h4>
                <span>${budget.name}</span>
                <span>${formatCurrency(budget.spent)} / ${formatCurrency(budget.amount)}</span>
            </h4>
            <div class="progress-bar">
                <div class="progress ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>
        `;
        
        budgetProgress.appendChild(budgetElement);
    });
}

// Rendu du graphique des dépenses
function renderExpenseChart() {
    const chartContainer = document.querySelector('#dashboard-page .chart-container');
    
    // Obtenir les données de dépenses par catégorie
    const categoryExpenses = getCategoryExpenses();
    
    // Si aucune dépense, afficher un message
    if (Object.keys(categoryExpenses).length === 0) {
        chartContainer.innerHTML = '<p class="no-data">Aucune donnée disponible pour le graphique.</p>';
        return;
    }
    
    // Calculer le total des dépenses
    const totalExpenses = Object.values(categoryExpenses).reduce((sum, value) => sum + value, 0);
    
    // Définir les couleurs pour chaque catégorie
    const colors = {
        housing: '#2563eb',
        food: '#10b981',
        transport: '#f59e0b',
        leisure: '#ef4444',
        health: '#8b5cf6',
        other: '#6b7280',
        income: '#059669'
    };
    
    // Créer le graphique en camembert
    let svgContent = `
        <svg viewBox="0 0 400 200" width="100%" height="100%">
            <g transform="translate(150, 100)">
    `;
    
    // Variables pour le graphique en camembert
    let startAngle = 0;
    let legendItems = '';
    let index = 0;
    
    // Générer les segments du camembert et la légende
    for (const [category, amount] of Object.entries(categoryExpenses)) {
        if (amount === 0) continue;
        
        const percentage = (amount / totalExpenses) * 100;
        const endAngle = startAngle + (percentage / 100) * 2 * Math.PI;
        
        // Calculer les points pour le segment
        const x1 = Math.sin(startAngle) * 80;
        const y1 = -Math.cos(startAngle) * 80;
        const x2 = Math.sin(endAngle) * 80;
        const y2 = -Math.cos(endAngle) * 80;
        
        // Déterminer si l'arc est grand (plus de 180 degrés)
        const largeArcFlag = percentage > 50 ? 1 : 0;
        
        // Créer le segment
        svgContent += `
            <path d="M 0,0 L ${x1},${y1} A 80,80 0 ${largeArcFlag},1 ${x2},${y2} Z" 
                  fill="${colors[category] || colors.other}" />
        `;
        
        // Ajouter à la légende
        legendItems += `
            <rect x="0" y="${index * 25}" width="15" height="15" fill="${colors[category] || colors.other}" />
            <text x="20" y="${index * 25 + 12}" font-size="12">${getCategoryName(category)} (${Math.round(percentage)}%)</text>
        `;
        
        startAngle = endAngle;
        index++;
    }
    
    // Ajouter la légende
    svgContent += `
            </g>
            <g transform="translate(300, 70)">
                ${legendItems}
            </g>
        </svg>
    `;
    
    chartContainer.innerHTML = svgContent;
}

// Obtenir le nom de la catégorie
function getCategoryName(category) {
    const categories = {
        housing: 'Logement',
        food: 'Nourriture',
        transport: 'Transport',
        leisure: 'Loisirs',
        health: 'Santé',
        income: 'Revenus',
        other: 'Autre'
    };
    
    return categories[category] || 'Autre';
}

// Obtenir l'icône de la catégorie
function getCategoryIcon(category) {
    const icons = {
        housing: '🏠',
        food: '🍔',
        transport: '🚗',
        leisure: '🎮',
        health: '🏥',
        income: '💰',
        other: '📦'
    };
    
    return icons[category] || '📦';
}

// Initialisation du formulaire d'ajout de transaction
function initAddTransactionForm() {
    const form = document.querySelector('#dashboard-page .add-transaction-form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const type = document.querySelector('input[name="transaction-type"]:checked').value;
        const description = document.getElementById('description').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];
        
        if (!description || isNaN(amount) || amount <= 0 || !category) {
            alert('Veuillez remplir tous les champs correctement.');
            return;
        }
        
        // Ajouter la transaction via le module data.js
        import('./data.js').then(module => {
            module.addTransaction({
                type,
                description,
                amount,
                category,
                date
            });
            
            // Réinitialiser le formulaire
            form.reset();
            
            // Mettre à jour le tableau de bord
            renderDashboard();
        });
    });
    
    // Événement pour le bouton d'ajout de transaction
    document.getElementById('addTransactionBtn').addEventListener('click', () => {
        // Faire défiler jusqu'au formulaire
        form.scrollIntoView({
            behavior: 'smooth'
        });
    });
}

// Afficher la modale d'édition de transaction
function showEditTransactionModal(transactionId) {
    // Importer dynamiquement le module transactions.js pour utiliser sa fonction
    import('./transactions.js').then(module => {
        module.showEditTransactionModal(transactionId);
    });
}

export { renderDashboard, renderFinancialSummary };
