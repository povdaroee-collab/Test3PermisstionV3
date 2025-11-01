//
// 🚀 FILE 2: utils.js
// ផ្ទុកនូវ Helper Functions ទាំងអស់ (Dates, Telegram, Alerts)
//

import { BOT_TOKEN, CHAT_ID } from './config.js';

// --- Module-scoped variables for Alert elements ---
let customAlertModal, customAlertTitle, customAlertMessage;
let customAlertIconWarning, customAlertIconSuccess;

/**
 * Initializes the utility module with necessary DOM elements.
 * This function is called from the main app.js after the DOM is ready.
 * @param {object} elements - An object containing references to DOM elements.
 */
export function initUtils(elements) {
    customAlertModal = elements.customAlertModal;
    customAlertTitle = elements.customAlertTitle;
    customAlertMessage = elements.customAlertMessage;
    customAlertIconWarning = elements.customAlertIconWarning;
    customAlertIconSuccess = elements.customAlertIconSuccess;

    // Attach the event listener for the OK button right here
    if (elements.customAlertOkBtn) {
        elements.customAlertOkBtn.addEventListener('click', hideCustomAlert);
    }
}

// --- Date Helper Functions ---

export function getTodayString(format = 'yyyy-mm-dd') {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    if (format === 'dd/mm/yyyy') return `${dd}/${mm}/${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
}

export function formatDbDateToInput(dbDate) {
    if (!dbDate || dbDate.split('/').length !== 3) return getTodayString();
    const parts = dbDate.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function formatInputDateToDb(inputDate) {
    if (!inputDate || inputDate.split('-').length !== 3) return getTodayString('dd/mm/yyyy');
    const parts = inputDate.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function addDays(startDateStr, days) {
    try {
        const date = new Date(startDateStr);
        if (isNaN(date.getTime())) return getTodayString();
        date.setDate(date.getDate() + Math.ceil(days) - 1);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    } catch (e) {
        console.error("Error in addDays:", e);
        return getTodayString();
    }
}

export function formatFirestoreTimestamp(timestamp, format = 'HH:mm dd/MM/yyyy') {
    let date;
    if (!timestamp) return "";
    if (timestamp instanceof Date) date = timestamp;
    else if (timestamp.toDate) date = timestamp.toDate();
    else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
        if (isNaN(date.getTime())) return "";
    } else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else return "";

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === 'HH:mm' || format === 'time') return `${hours}:${minutes}`;
    if (format === 'dd/MM/yyyy' || format === 'date') return `${day}/${month}/${year}`;
    return `${hours}:${minutes} ${day}/${month}/${year}`;
}

// This function was in your original code but not used. I've kept it.
export function parseReturnedAt_(returnedAtString) {
    if (!returnedAtString || typeof returnedAtString !== 'string') return { date: "", time: "" };
    const parts = returnedAtString.split(' ');
    if (parts.length === 2) return { time: parts[0], date: parts[1] };
    return { date: returnedAtString, time: "" };
}

// --- Telegram Helper ---

export async function sendTelegramNotification(message) {
    console.log("Sending Telegram notification...");
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'HTML' })
        });
        if (!res.ok) {
            const errBody = await res.text();
            console.error("Telegram API error:", res.status, errBody);
        } else {
            console.log("Telegram notification sent successfully.");
        }
    } catch (e) {
        console.error("Failed to send Telegram message:", e);
    }
}

// --- Custom Alert Modal Logic ---

export function showCustomAlert(title, message, type = 'warning') {
    if (!customAlertModal) return;
    if (customAlertTitle) customAlertTitle.textContent = title;
    if (customAlertMessage) customAlertMessage.textContent = message;

    if (type === 'success') {
        if (customAlertIconSuccess) customAlertIconSuccess.classList.remove('hidden');
        if (customAlertIconWarning) customAlertIconWarning.classList.add('hidden');
    } else {
        if (customAlertIconSuccess) customAlertIconSuccess.classList.add('hidden');
        if (customAlertIconWarning) customAlertIconWarning.classList.remove('hidden');
    }
    customAlertModal.classList.remove('hidden');
}

export function hideCustomAlert() {
    if (customAlertModal) customAlertModal.classList.add('hidden');
}
