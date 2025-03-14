// data.js - Gestion des données de l'application

// Structure de données pour les transactions
let transactions = [
    {
        id: 1,
        description: "Loyer",
        amount: -850.00,
        category: "housing",
        date: "2025-03-10",
        icon: "🏠"
    },
    {
        id: 2,
        description: "Salaire",
        amount: 2500.00,
        category: "income",
        date: "2025-03-05",
        icon: "💼"
    },
    {
        id: 3,
        description: "Restaurant",
        amount: -45.80,
        category: "food",
        date: "2025-03-08",
        icon: "🍔"
    },
    {
        id: 4,
        description: "Courses",
        amount: -120.30,
        category: "food",
        date: "2025-03-07",
        icon: "🛒"
    },
    {
        id: 5,
        description: "Freelance",
        amount: 750.00,
        category: "income",
        date: "2025-03-03",
        icon: "💰"
    },
    {
        id: 6,
        description: "Facture d'électricité",
        amount: -85.20,
        category: "housing",
        date: "2025-03-02",
        icon: "💡"
    },
    {
        id: 7,
        description: "Forfait téléphone",
        amount: -19.99,
        category: "other",
        date: "2025-03-01",
        icon: "📱"
    }
];

// Structure de données pour les budgets
let budgets = [
    {
        id: 1,
        name: "Loyer",
        amount: 850.00,
        spent: 850.00,
        category: "housing",
        period: "monthly"
    },
    {
        id: 2,
        name: "Nourriture",
        amount: 500.00,
        spent: 420.00,
        category: "food",
        period: "monthly"
    },
    {
        id: 3,
        name: "Transport",
        amount: 300.00,
        spent: 275.00,
        category: "transport",
        period: "monthly"
    },
    {
        id: 4,
        name: "Loisirs",
        amount: 200.00,
        spent: 230.00,
        category: "leisure",
        period: "monthly"
    },
    {
        id: 5,
        name: "Divers",
        amount: 250.00,
        spent: 110.00,
        category: "other",
        period: "monthly"
    }
];

// Structure de données pour les notifications
let notifications = [
    {
        id: 1,
        message: "Budget \"Loisirs\" dépassé de 15%",
        date: "Aujourd'hui",
        type: "warning"
    },
    {
        id: 2,
        message: "Rappel: Facture d'électricité à payer",
        date: "Hier",
        type: "info"
    },
    {
        id: 3,
        message: "Objectif d'épargne atteint à 75%",
        date: "Il y a 2 jours",
        type: "info"
    }
];

// Structure de données pour les paramètres utilisateur
let userSettings = {
    currency: "EUR",
    theme: "light",
    language: "fr",
    dateFormat: "dd/mm/yyyy",
    notifications: {
        budgetAlerts: true,
        paymentReminders: true,
        monthlyReports: false,
        emailNotifications: false
    },
    account: {
        name: "Jean Dupont",
        email: "jean.dupont@exemple.com",
        password: "********"
    }
};

// Fonctions pour manipuler les transactions
function getTransactions(filters = {}) {
    let result = [...transactions];
    
    // Filtrage par catégorie
    if (filters.category && filters.category !== 'all') {
        result = result.filter(t => t.category === filters.category);
    }
    
    // Filtrage par type (revenu/dépense)
    if (filters.type && filters.type !== 'all') {
        if (filters.type === 'income') {
            result = result.filter(t => t.amount > 0);
        } else if (filters.type === 'expense') {
            result = result.filter(t => t.amount < 0);
        }
    }
    
    // Filtrage par date
    if (filters.dateFrom) {
        result = result.filter(t => new Date(t.date) >= new Date(filters.dateFrom));
    }
    
    if (filters.dateTo) {
        result = result.filter(t => new Date(t.date) <= new Date(filters.dateTo));
    }
    
    // Tri par date (du plus récent au plus ancien)
    result.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return result;
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


function updateTransaction(id, updatedData) {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    const oldTransaction = transactions[index];
    
    // Mise à jour des budgets (annulation de l'ancienne transaction)
    updateBudgetSpending(oldTransaction.category, -oldTransaction.amount);
    
    // Mise à jour de la transaction
    transactions[index] = {
        ...oldTransaction,
        description: updatedData.description || oldTransaction.description,
        amount: updatedData.amount !== undefined ? updatedData.amount : oldTransaction.amount,
        category: updatedData.category || oldTransaction.category,
        date: updatedData.date || oldTransaction.date,
        icon: updatedData.icon || getCategoryIcon(updatedData.category || oldTransaction.category)
    };
    
    // Mise à jour des budgets avec la nouvelle transaction
    updateBudgetSpending(transactions[index].category, transactions[index].amount);
    
    return transactions[index];
}

function deleteTransaction(id) {
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return false;
    
    const transaction = transactions[index];
    
    // Mise à jour des budgets (annulation de la transaction)
    updateBudgetSpending(transaction.category, -transaction.amount);
    
    // Suppression de la transaction
    transactions.splice(index, 1);
    
    return true;
}

// Fonctions pour manipuler les budgets
function getBudgets() {
    return [...budgets];
}

function addBudget(budget) {
    const newId = budgets.length > 0 ? Math.max(...budgets.map(b => b.id)) + 1 : 1;
    
    const newBudget = {
        id: newId,
        name: budget.name,
        amount: budget.amount,
        spent: 0,
        category: budget.category,
        period: budget.period
    };
    
    budgets.push(newBudget);
    
    return newBudget;
}

function updateBudget(id, updatedData) {
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    budgets[index] = {
        ...budgets[index],
        name: updatedData.name || budgets[index].name,
        amount: updatedData.amount !== undefined ? updatedData.amount : budgets[index].amount,
        category: updatedData.category || budgets[index].category,
        period: updatedData.period || budgets[index].period
    };
    
    return budgets[index];
}

function deleteBudget(id) {
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) return false;
    
    budgets.splice(index, 1);
    
    return true;
}

function updateBudgetSpending(category, amount) {
    // Ne met à jour que les dépenses (montants négatifs)
    if (amount >= 0) return;
    
    const budget = budgets.find(b => b.category === category);
    if (budget) {
        budget.spent += Math.abs(amount);
    }
}

// Fonctions pour les statistiques
function getFinancialSummary() {
    const transactions = getTransactions();
    
    // Calculer les revenus et dépenses du mois en cours
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getMonth() === currentMonth && 
            transactionDate.getFullYear() === currentYear;
    });
    
    const income = monthlyTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthlyTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const balance = income - expenses;
    
    return { income, expenses, balance };
}


function getCategoryExpenses() {
    // Calculer les dépenses par catégorie
    const categoryExpenses = {};
    
    transactions
        .filter(t => t.amount < 0)
        .forEach(t => {
            if (!categoryExpenses[t.category]) {
                categoryExpenses[t.category] = 0;
            }
            categoryExpenses[t.category] += Math.abs(t.amount);
        });
    
    return categoryExpenses;
}

// Fonctions utilitaires
function getCategoryIcon(category) {
    const icons = {
        housing: "🏠",
        food: "🍔",
        transport: "🚗",
        leisure: "🎮",
        health: "🏥",
        income: "💰",
        other: "📦"
    };
    
    return icons[category] || "📦";
}

function formatCurrency(amount) {
    return amount.toFixed(2).replace('.', ',') + ' €';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

// Export des fonctions et données
export {
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getBudgets,
    addBudget,
    updateBudget,
    deleteBudget,
    getFinancialSummary,
    getCategoryExpenses,
    notifications,
    userSettings,
    formatCurrency,
    formatDate
};
