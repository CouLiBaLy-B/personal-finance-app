// settings.js - Gestion des paramètres

import { userSettings } from './data.js';

// Rendu de la page des paramètres
function renderSettings() {
    loadUserSettings();
    initSettingsForm();
    initThemeToggle();
}

// Chargement des paramètres utilisateur
function loadUserSettings() {
    // Remplir les champs avec les paramètres actuels
    document.getElementById('currency').value = userSettings.currency;
    document.getElementById('theme').value = userSettings.theme;
    document.getElementById('language').value = userSettings.language;
    document.getElementById('date-format').value = userSettings.dateFormat;
    
    // Remplir les toggles de notification
    const toggles = document.querySelectorAll('.toggle-switch input');
    toggles[0].checked = userSettings.notifications.budgetAlerts;
    toggles[1].checked = userSettings.notifications.paymentReminders;
    toggles[2].checked = userSettings.notifications.monthlyReports;
    toggles[3].checked = userSettings.notifications.emailNotifications;
    
    // Remplir les informations du compte
    document.getElementById('name').value = userSettings.account.name;
    document.getElementById('email').value = userSettings.account.email;
    document.getElementById('password').value = userSettings.account.password;
}

// Initialisation du formulaire des paramètres
function initSettingsForm() {
    const saveButton = document.querySelector('#settings-page .btn-primary');
    
    saveButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Récupérer les valeurs des champs
        userSettings.currency = document.getElementById('currency').value;
        userSettings.theme = document.getElementById('theme').value;
        userSettings.language = document.getElementById('language').value;
        userSettings.dateFormat = document.getElementById('date-format').value;
        
        // Récupérer les valeurs des toggles
        const toggles = document.querySelectorAll('.toggle-switch input');
        userSettings.notifications.budgetAlerts = toggles[0].checked;
        userSettings.notifications.paymentReminders = toggles[1].checked;
        userSettings.notifications.monthlyReports = toggles[2].checked;
        userSettings.notifications.emailNotifications = toggles[3].checked;
        
        // Récupérer les informations du compte
        userSettings.account.name = document.getElementById('name').value;
        userSettings.account.email = document.getElementById('email').value;
        userSettings.account.password = document.getElementById('password').value;
        
        // Afficher un message de confirmation
        alert('Paramètres sauvegardés avec succès !');
    });
    
    // Initialiser les boutons d'exportation
    const exportButtons = document.querySelectorAll('.export-section .btn');
    
    exportButtons.forEach(button => {
        button.addEventListener('click', () => {
            alert('Fonctionnalité d\'exportation non implémentée dans cette démo.');
        });
    });
}

// Initialisation du toggle de thème
function initThemeToggle() {
    const themeSelect = document.getElementById('theme');
    
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        
        userSettings.theme = theme;
    });
    
    // Appliquer le thème actuel
    if (userSettings.theme === 'dark') {
        document.body.classList.add('dark-mode');
    }
}

export { renderSettings };
