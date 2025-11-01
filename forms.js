//
// 🚀 FILE 5: forms.js
// ផ្ទុកនូវ Logic សម្រាប់បើក និង បញ្ជូន (Submit) ទម្រង់សុំច្បាប់
//

import {
    leaveDurationItems, leaveReasonItems, singleDayLeaveDurations, durationToDaysMap,
    outDurationItems, outReasonItems, leaveRequestsCollectionPath, outRequestsCollectionPath,
    leaveDurations, outDurations
} from './config.js';

import {
    getTodayString, formatInputDateToDb, addDays, showCustomAlert, sendTelegramNotification
} from './utils.js';

import { navigateTo, setupSearchableDropdown } from './ui.js';

import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Module-scoped variables ---
let db, auth, getCurrentUserFn;
let selectedLeaveDuration = null, selectedLeaveReason = null;
let selectedOutDuration = null, selectedOutReason = null;

// --- DOM Elements ---
let leaveDurationSearchInput, leaveDurationDropdownEl, leaveReasonSearchInput, leaveReasonDropdownEl,
    leaveSingleDateContainer, leaveDateRangeContainer, leaveSingleDateInput, leaveStartDateInput,
    leaveEndDateInput, leaveRequestErrorEl, leaveRequestLoadingEl, submitLeaveRequestBtn,
    outDurationSearchInput, outDurationDropdownEl, outReasonSearchInput, outReasonDropdownEl,
    outDateInput, outRequestErrorEl, outRequestLoadingEl, submitOutRequestBtn;

/**
 * Initializes the Forms module with dependencies and elements.
 * @param {object} elements - An object containing references to all DOM elements.
 * @param {object} dbInstance - The initialized Firestore database instance.
 * @param {object} authInstance - The initialized Firebase Auth instance.
 * @param {function} fnToGetUser - A function that returns the current user object.
 */
export function initForms(elements, dbInstance, authInstance, fnToGetUser) {
    // --- Assign Dependencies ---
    db = dbInstance;
    auth = authInstance;
    getCurrentUserFn = fnToGetUser;

    // --- Assign Form Elements ---
    leaveDurationSearchInput = elements.leaveDurationSearchInput;
    leaveDurationDropdownEl = elements.leaveDurationDropdownEl;
    leaveReasonSearchInput = elements.leaveReasonSearchInput;
    leaveReasonDropdownEl = elements.leaveReasonDropdownEl;
    leaveSingleDateContainer = elements.leaveSingleDateContainer;
    leaveDateRangeContainer = elements.leaveDateRangeContainer;
    leaveSingleDateInput = elements.leaveSingleDateInput;
    leaveStartDateInput = elements.leaveStartDateInput;
    leaveEndDateInput = elements.leaveEndDateInput;
    leaveRequestErrorEl = elements.leaveRequestErrorEl;
    leaveRequestLoadingEl = elements.leaveRequestLoadingEl;
    submitLeaveRequestBtn = elements.submitLeaveRequestBtn;

    outDurationSearchInput = elements.outDurationSearchInput;
    outDurationDropdownEl = elements.outDurationDropdownEl;
    outReasonSearchInput = elements.outReasonSearchInput;
    outReasonDropdownEl = elements.outReasonDropdownEl;
    outDateInput = elements.outDateInput;
    outRequestErrorEl = elements.outRequestErrorEl;
    outRequestLoadingEl = elements.outRequestLoadingEl;
    submitOutRequestBtn = elements.submitOutRequestBtn;

    // --- Setup Form Dropdowns ---
    setupSearchableDropdown('leave-duration-search', 'leave-duration-dropdown', leaveDurationItems, (duration) => {
        selectedLeaveDuration = duration;
        updateLeaveDateFields(duration);
    }, false);
    setupSearchableDropdown('leave-reason-search', 'leave-reason-dropdown', leaveReasonItems, (reason) => {
        selectedLeaveReason = reason;
    }, true);
    setupSearchableDropdown('out-duration-search', 'out-duration-dropdown', outDurationItems, (duration) => {
        selectedOutDuration = duration;
    }, false);
    setupSearchableDropdown('out-reason-search', 'out-reason-dropdown', outReasonItems, (reason) => {
        selectedOutReason = reason;
    }, true);

    // --- Attach Event Listeners ---

    // Leave Request
    if (elements.openLeaveRequestBtn) {
        elements.openLeaveRequestBtn.addEventListener('click', () => {
            const user = getCurrentUserFn();
            if (!user) return showCustomAlert("Error", "សូម Login ជាមុនសិន។");
            openLeaveForm(user);
        });
    }
    if (elements.cancelLeaveRequestBtn) {
        elements.cancelLeaveRequestBtn.addEventListener('click', () => navigateTo('page-home'));
    }
    if (submitLeaveRequestBtn) {
        submitLeaveRequestBtn.addEventListener('click', async () => {
            const user = getCurrentUserFn();
            const authUser = auth.currentUser;
            if (!user || !authUser) return showCustomAlert("Error", "មានបញ្ហា៖ មិនអាចបញ្ជាក់អ្នកប្រើប្រាស់បានទេ។");
            await submitLeaveRequest(user, authUser);
        });
    }

    // Out Request
    if (elements.openOutRequestBtn) {
        elements.openOutRequestBtn.addEventListener('click', () => {
            const user = getCurrentUserFn();
            if (!user) return showCustomAlert("Error", "សូម Login ជាមុនសិន។");
            openOutForm(user);
        });
    }
    if (elements.cancelOutRequestBtn) {
        elements.cancelOutRequestBtn.addEventListener('click', () => navigateTo('page-home'));
    }
    if (submitOutRequestBtn) {
        submitOutRequestBtn.addEventListener('click', async () => {
            const user = getCurrentUserFn();
            const authUser = auth.currentUser;
            if (!user || !authUser) return showCustomAlert("Error", "មានបញ្ហា៖ មិនអាចបញ្ជាក់អ្នកប្រើប្រាស់បានទេ។");
            await submitOutRequest(user, authUser);
        });
    }
}

// --- Leave Request Logic ---

function openLeaveForm(user) {
    const reqPhoto = document.getElementById('request-leave-user-photo');
    const reqName = document.getElementById('request-leave-user-name');
    const reqId = document.getElementById('request-leave-user-id');
    const reqDept = document.getElementById('request-leave-user-department');

    if (reqPhoto) reqPhoto.src = user.photo || 'https://placehold.co/60x60/e2e8f0/64748b?text=User';
    if (reqName) reqName.textContent = user.name;
    if (reqId) reqId.textContent = user.id;
    if (reqDept) reqDept.textContent = user.department || 'មិនមាន';

    if (leaveDurationSearchInput) leaveDurationSearchInput.value = '';
    if (leaveReasonSearchInput) leaveReasonSearchInput.value = '';
    selectedLeaveDuration = null;
    selectedLeaveReason = null;
    if (leaveSingleDateContainer) leaveSingleDateContainer.classList.add('hidden');
    if (leaveDateRangeContainer) leaveDateRangeContainer.classList.add('hidden');
    if (leaveRequestErrorEl) leaveRequestErrorEl.classList.add('hidden');
    if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden');
    if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = false;

    navigateTo('page-request-leave');
}

function updateLeaveDateFields(duration) {
    const today = getTodayString();
    const todayFormatted = getTodayString('dd/mm/yyyy');

    if (!leaveSingleDateContainer || !leaveDateRangeContainer || !leaveSingleDateInput || !leaveStartDateInput || !leaveEndDateInput) {
        console.error("Date input elements not found for Leave form.");
        return;
    }

    if (!duration) {
        leaveSingleDateContainer.classList.add('hidden');
        leaveDateRangeContainer.classList.add('hidden');
        return;
    }

    if (singleDayLeaveDurations.includes(duration)) {
        leaveSingleDateContainer.classList.remove('hidden');
        leaveDateRangeContainer.classList.add('hidden');
        leaveSingleDateInput.value = todayFormatted;
    } else {
        leaveSingleDateContainer.classList.add('hidden');
        leaveDateRangeContainer.classList.remove('hidden');
        leaveStartDateInput.value = today;
        const days = durationToDaysMap[duration] ?? 1;
        const endDateValue = addDays(today, days);
        leaveEndDateInput.value = endDateValue;
        leaveEndDateInput.min = today;
    }
}

async function submitLeaveRequest(user, authUser) {
    // Re-read values from inputs, in case user typed instead of selecting
    selectedLeaveDuration = leaveDurations.includes(leaveDurationSearchInput.value) ? leaveDurationSearchInput.value : null;
    selectedLeaveReason = leaveReasonSearchInput.value;

    if (!selectedLeaveDuration) {
        if (leaveRequestErrorEl) {
            leaveRequestErrorEl.textContent = 'សូមជ្រើសរើស "រយៈពេល" ឲ្យបានត្រឹមត្រូវ (ពីក្នុងបញ្ជី)។';
            leaveRequestErrorEl.classList.remove('hidden');
        }
        return;
    }
    if (!selectedLeaveReason || selectedLeaveReason.trim() === '') {
        if (leaveRequestErrorEl) {
            leaveRequestErrorEl.textContent = 'សូមបំពេញ "មូលហេតុ" ជាមុនសិន។';
            leaveRequestErrorEl.classList.remove('hidden');
        }
        return;
    }

    if (leaveRequestErrorEl) leaveRequestErrorEl.classList.add('hidden');
    if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.remove('hidden');
    if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = true;

    try {
        const isSingleDay = singleDayLeaveDurations.includes(selectedLeaveDuration);
        const startDateInputVal = isSingleDay
            ? (leaveSingleDateInput ? leaveSingleDateInput.value : getTodayString('dd/mm/yyyy'))
            : (leaveStartDateInput ? formatInputDateToDb(leaveStartDateInput.value) : getTodayString('dd/mm/yyyy'));

        const endDateInputVal = isSingleDay
            ? startDateInputVal
            : (leaveEndDateInput ? formatInputDateToDb(leaveEndDateInput.value) : getTodayString('dd/mm/yyyy'));

        if (new Date(formatDbDateToInput(endDateInputVal)) < new Date(formatDbDateToInput(startDateInputVal))) {
            throw new Error('"ថ្ងៃបញ្ចប់" មិនអាចនៅមុន "ថ្ងៃចាប់ផ្តើម" បានទេ។');
        }

        const requestId = `leave_${Date.now()}`;
        const requestData = {
            userId: user.id,
            name: user.name,
            department: user.department || 'N/A',
            photo: user.photo || null,
            duration: selectedLeaveDuration,
            reason: selectedLeaveReason.trim(),
            startDate: startDateInputVal,
            endDate: endDateInputVal,
            status: 'pending',
            requestedAt: serverTimestamp(),
            requestId: requestId,
            firestoreUserId: authUser.uid
        };

        if (!db || !leaveRequestsCollectionPath) throw new Error("Firestore DB or Collection Path is not initialized.");
        const requestRef = doc(db, leaveRequestsCollectionPath, requestId);
        await setDoc(requestRef, requestData);

        console.log("Firestore (leave) write successful.");
        const dateString = (startDateInputVal === endDateInputVal) ? startDateInputVal : `ពី ${startDateInputVal} ដល់ ${endDateInputVal}`;
        let message = `<b>🔔 សំណើសុំច្បាប់ឈប់សម្រាក 🔔</b>\n\n`;
        message += `<b>ឈ្មោះ:</b> ${requestData.name} (${requestData.userId})\n`;
        message += `<b>ផ្នែក:</b> ${requestData.department}\n`;
        message += `<b>រយៈពេល:</b> ${requestData.duration}\n`;
        message += `<b>កាលបរិច្ឆេទ:</b> ${dateString}\n`;
        message += `<b>មូលហេតុ:</b> ${requestData.reason}\n\n`;
        message += `(សូមចូល Firestore ដើម្បីពិនិត្យ ID: \`${requestId}\`)`;
        await sendTelegramNotification(message);

        if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden');
        showCustomAlert('ជោគជ័យ!', 'សំណើរបស់អ្នកត្រូវបានផ្ញើដោយជោគជ័យ!', 'success');
        navigateTo('page-history');

    } catch (error) {
        console.error("Error submitting leave request:", error);
        let displayError = error.message;
        if (error.code?.includes('permission-denied')) displayError = 'Missing or insufficient permissions. សូមពិនិត្យ Firestore Rules។';
        if (leaveRequestErrorEl) {
            leaveRequestErrorEl.textContent = `Error: ${displayError}`;
            leaveRequestErrorEl.classList.remove('hidden');
        }
        if (leaveRequestLoadingEl) leaveRequestLoadingEl.classList.add('hidden');
        if (submitLeaveRequestBtn) submitLeaveRequestBtn.disabled = false;
    }
}

// --- Out Request Logic ---

function openOutForm(user) {
    const reqPhoto = document.getElementById('request-out-user-photo');
    const reqName = document.getElementById('request-out-user-name');
    const reqId = document.getElementById('request-out-user-id');
    const reqDept = document.getElementById('request-out-user-department');

    if (reqPhoto) reqPhoto.src = user.photo || 'https://placehold.co/60x60/e2e8f0/64748b?text=User';
    if (reqName) reqName.textContent = user.name;
    if (reqId) reqId.textContent = user.id;
    if (reqDept) reqDept.textContent = user.department || 'មិនមាន';

    if (outDurationSearchInput) outDurationSearchInput.value = '';
    if (outReasonSearchInput) outReasonSearchInput.value = '';
    if (outDateInput) outDateInput.value = getTodayString('dd/mm/yyyy');
    selectedOutDuration = null;
    selectedOutReason = null;
    if (outRequestErrorEl) outRequestErrorEl.classList.add('hidden');
    if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden');
    if (submitOutRequestBtn) submitOutRequestBtn.disabled = false;

    navigateTo('page-request-out');
}

async function submitOutRequest(user, authUser) {
    selectedOutDuration = outDurations.includes(outDurationSearchInput.value) ? outDurationSearchInput.value : null;
    selectedOutReason = outReasonSearchInput.value;

    if (!selectedOutDuration) {
        if (outRequestErrorEl) {
            outRequestErrorEl.textContent = 'សូមជ្រើសរើស "រយៈពេល" ឲ្យបានត្រឹមត្រូវ (ពីក្នុងបញ្ជី)។';
            outRequestErrorEl.classList.remove('hidden');
        }
        return;
    }
    if (!selectedOutReason || selectedOutReason.trim() === '') {
        if (outRequestErrorEl) {
            outRequestErrorEl.textContent = 'សូមបំពេញ "មូលហេតុ" ជាមុនសិន។';
            outRequestErrorEl.classList.remove('hidden');
        }
        return;
    }

    if (outRequestErrorEl) outRequestErrorEl.classList.add('hidden');
    if (outRequestLoadingEl) outRequestLoadingEl.classList.remove('hidden');
    if (submitOutRequestBtn) submitOutRequestBtn.disabled = true;

    try {
        const dateVal = outDateInput ? outDateInput.value : getTodayString('dd/mm/yyyy');
        const requestId = `out_${Date.now()}`;
        const requestData = {
            userId: user.id,
            name: user.name,
            department: user.department || 'N/A',
            photo: user.photo || null,
            duration: selectedOutDuration,
            reason: selectedOutReason.trim(),
            startDate: dateVal,
            endDate: dateVal,
            status: 'pending',
            requestedAt: serverTimestamp(),
            requestId: requestId,
            firestoreUserId: authUser.uid
        };

        if (!db || !outRequestsCollectionPath) throw new Error("Firestore DB or Out Collection Path is not initialized.");
        const requestRef = doc(db, outRequestsCollectionPath, requestId);
        await setDoc(requestRef, requestData);

        console.log("Firestore (out) write successful.");
        let message = `<b>🔔 សំណើសុំច្បាប់ចេញក្រៅ 🔔</b>\n\n`;
        message += `<b>ឈ្មោះ:</b> ${requestData.name} (${requestData.userId})\n`;
        message += `<b>ផ្នែក:</b> ${requestData.department}\n`;
        message += `<b>រយៈពេល:</b> ${requestData.duration}\n`;
        message += `<b>កាលបរិច្ឆេទ:</b> ${requestData.startDate}\n`;
        message += `<b>មូលហេតុ:</b> ${requestData.reason}\n\n`;
        message += `(សូមចូល Firestore ដើម្បីពិនិត្យ ID: \`${requestId}\`)`;
        await sendTelegramNotification(message);

        if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden');
        showCustomAlert('ជោគជ័យ!', 'សំណើរបស់អ្នកត្រូវបានផ្ញើដោយជោគជ័យ!', 'success');
        navigateTo('page-history');

    } catch (error) {
        console.error("Error submitting out request:", error);
        let displayError = error.message;
        if (error.code?.includes('permission-denied')) displayError = 'Missing or insufficient permissions. សូមពិនិត្យ Firestore Rules។';
        if (outRequestErrorEl) {
            outRequestErrorEl.textContent = `Error: ${displayError}`;
            outRequestErrorEl.classList.remove('hidden');
        }
        if (outRequestLoadingEl) outRequestLoadingEl.classList.add('hidden');
        if (submitOutRequestBtn) submitOutRequestBtn.disabled = false;
    }
}
