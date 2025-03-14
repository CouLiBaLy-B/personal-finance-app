// app.js - Fichier principal de l'application

import {
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
} from './data.js';

import { renderDashboard } from './dashboard.js';
import { renderTransactions } from './transactions.js';
import { renderBudgets } from './budgets.js';
import { renderReports } from './reports.js';
import { renderSettings } from './settings.js';

// État global de l'application
const appState = {
    currentPage: 'dashboard',
    currentTransaction: null,
    filters: {
        category: 'all',
        type: 'all',
        dateFrom: null,
        dateTo: null
    }
};

// Initialisation de l'application
function initApp() {
    // Initialiser la navigation
    initNavigation();
    
    // Initialiser les modales
    initModals();
    
    // Charger la page par défaut
    loadPage('dashboard');
}

// Initialisation de la navigation
function initNavigation() {
    const navLinks = document.querySelectorAll('nav ul li a');
    const logo = document.querySelector('.logo');
    
    // Événement pour les liens de navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Désactiver tous les liens
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Activer le lien cliqué
            link.classList.add('active');
            
            // Obtenir la page à afficher
            const page = link.getAttribute('data-page');
            
            // Afficher la page correspondante
            loadPage(page);
        });
    });
    
    // Événement pour le logo (retour au tableau de bord)
    logo.addEventListener('click', () => {
        // Désactiver tous les liens
        navLinks.forEach(l => l.classList.remove('active'));
        
        // Activer le lien du tableau de bord
        document.querySelector('nav ul li a[data-page="dashboard"]').classList.add('active');
        
        // Afficher le tableau de bord
        loadPage('dashboard');
    });
}

// Chargement des pages
function loadPage(page) {
    appState.currentPage = page;
    
    // Masquer toutes les pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Afficher la page demandée
    const pageElement = document.getElementById(`${page}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
    }
    
    // Charger le contenu de la page
    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'transactions':
            renderTransactions();
            break;
        case 'budgets':
            renderBudgets();
            break;
        case 'reports':
            renderReports();
            break;
        case 'settings':
            renderSettings();
            break;
    }
}

// Initialisation des modales
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.modal-close, .modal-cancel');
    
    // Fermeture des modales
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modals.forEach(modal => {
                modal.classList.remove('active');
            });
        });
    });
    
    // Fermeture en cliquant en dehors de la modale
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Initialiser la modale d'édition de transaction
    initEditTransactionModal();
    
    // Initialiser la modale de confirmation de suppression
    initDeleteConfirmModal();
}

// Modale d'édition de transaction
function initEditTransactionModal() {
    const modal = document.getElementById('edit-transaction-modal');
    const form = modal.querySelector('form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!appState.currentTransaction) return;
        
        const updatedData = {
            description: document.getElementById('edit-description').value,
            amount: parseFloat(document.getElementById('edit-amount').value),
            category: document.getElementById('edit-category').value,
            date: document.getElementById('edit-date').value
        };
        
        updateTransaction(appState.currentTransaction, updatedData);
        
        // Fermer la modale
        modal.classList.remove('active');
        
        // Rafraîchir la page actuelle
        loadPage(appState.currentPage);
    });
}

// Modale de confirmation de suppression
function initDeleteConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    const confirmButton = modal.querySelector('.confirm-delete');
    
    confirmButton.addEventListener('click', () => {
        if (!appState.currentTransaction) return;
        
        deleteTransaction(appState.currentTransaction);
        
        // Fermer la modale
        modal.classList.remove('active');
        
        // Rafraîchir la page actuelle
        loadPage(appState.currentPage);
    });
}

// Fonctions utilitaires pour l'interface
function showEditTransactionModal(transactionId) {
    const transaction = getTransactions().find(t => t.id === transactionId);
    if (!transaction) return;
    
    // Stocker l'ID de la transaction en cours d'édition
    appState.currentTransaction = transactionId;
    
    // Remplir le formulaire avec les données de la transaction
    document.getElementById('edit-description').value = transaction.description;
    document.getElementById('edit-amount').value = Math.abs(transaction.amount);
    document.getElementById('edit-category').value = transaction.category;
    document.getElementById('edit-date').value = transaction.date;
    
    // Afficher la modale
    document.getElementById('edit-transaction-modal').classList.add('active');
}

function showDeleteConfirmModal(transactionId) {
    // Stocker l'ID de la transaction à supprimer
    appState.currentTransaction = transactionId;
    
    // Afficher la modale
    document.getElementById('delete-confirm-modal').classList.add('active');
}

// Initialiser l'application au chargement
document.addEventListener('DOMContentLoaded', initApp);

// Export des fonctions pour les autres modules
export {
    appState,
    loadPage,
    showEditTransactionModal,
    showDeleteConfirmModal
};
