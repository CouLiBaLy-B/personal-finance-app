// reports.js - Gestion des rapports

import {
    getTransactions,
    getCategoryExpenses,
    getFinancialSummary,
    formatCurrency
} from './data.js';

// Rendu de la page des rapports
function renderReports() {
    initTimePeriodSelector();
    initReportFilters();
    renderFinancialStats();
    renderExpenseTable();
}

// Initialisation du sélecteur de période
function initTimePeriodSelector() {
    const timePeriods = document.querySelectorAll('.time-period');
    
    timePeriods.forEach(period => {
        period.addEventListener('click', () => {
            // Désactiver toutes les périodes
            timePeriods.forEach(p => p.classList.remove('active'));
            
            // Activer la période cliquée
            period.classList.add('active');
            
            // Mettre à jour les rapports en fonction de la période
            const periodValue = period.getAttribute('data-period');
            updateReportsForPeriod(periodValue);
        });
    });
}

// Mise à jour des rapports en fonction de la période
function updateReportsForPeriod(period) {
    // Cette fonction pourrait filtrer les données en fonction de la période
    console.log(`Mise à jour des rapports pour la période: ${period}`);
    
    // Pour l'instant, nous mettons simplement à jour les statistiques
    renderFinancialStats();
    renderExpenseTable();
}

// Initialisation des filtres de rapport
function initReportFilters() {
    const reportType = document.getElementById('report-type');
    const reportPeriod = document.getElementById('report-period');
    
    reportType.addEventListener('change', updateReportView);
    reportPeriod.addEventListener('change', updateReportView);
}

// Mise à jour de la vue du rapport
function updateReportView() {
    const reportType = document.getElementById('report-type').value;
    const reportPeriod = document.getElementById('report-period').value;
    
    console.log(`Type de rapport: ${reportType}, Période: ${reportPeriod}`);
    
    // Cette fonction pourrait mettre à jour le graphique en fonction des sélections
    // Pour l'instant, nous gardons le graphique statique
}

// Rendu des statistiques financières
function renderFinancialStats() {
    const summary = getFinancialSummary();
    
    // Mettre à jour les cartes de statistiques
    const statsCards = document.querySelectorAll('.stats-card .value');
    statsCards[0].textContent = formatCurrency(summary.income);
    statsCards[1].textContent = formatCurrency(summary.expenses);
    statsCards[2].textContent = formatCurrency(summary.balance);
}

// Rendu du tableau des dépenses
function renderExpenseTable() {
    // Cette fonction pourrait générer dynamiquement le tableau des dépenses
    // Pour l'instant, nous gardons le tableau statique
    console.log("Tableau des dépenses rendu (statique pour l'instant)");
}

export { renderReports };
