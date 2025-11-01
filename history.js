//
// 🚀 FILE 6: history.js
// ផ្ទុកនូវ Logic សម្រាប់បង្ហាញប្រវត្តិ (Read), កែសម្រួល (Update), លុប (Delete),
// និងមុខងារបន្ថែម (Invoice, Return Scan)
//

import {
    leaveRequestsCollectionPath, outRequestsCollectionPath, leaveDurationItems,
    leaveReasonItems, outDurationItems, outReasonItems, singleDayLeaveDurations
} from './config.js';

import {
    formatFirestoreTimestamp, formatDbDateToInput, sendTelegramNotification,
    showCustomAlert, hideCustomAlert
} from './utils.js';

import { setupSearchableDropdown } from './ui.js';
import { startReturnConfirmation } from './faceScan.js';

import {
    getFirestore, doc, setDoc, updateDoc, deleteDoc, getDoc,
    collection, query, where, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Module-scoped variables ---
let db, getCurrentUserFn;
let historyUnsubscribe = null, outHistoryUnsubscribe = null;

// --- Elements ---
let historyContainerLeave, historyPlaceholderLeave, historyContainerOut, historyPlaceholderOut,
    editModal, editModalTitle, editForm, editRequestId, editDurationSearch, editDurationDropdown,
    editSingleDateContainer, editLeaveDateSingle, editDateRangeContainer, editLeaveDateStart,
    editLeaveDateEnd, editReasonSearch, editReasonDropdown, editErrorEl, editLoadingEl,
    submitEditBtn, cancelEditBtn,
    deleteModal, deleteConfirmBtn, cancelDeleteBtn, deleteRequestId, deleteCollectionType,
    invoiceModal, closeInvoiceModalBtn, invoiceModalTitle, invoiceContentWrapper, invoiceContent,
    invoiceUserName, invoiceUserId, invoiceUserDept, invoiceRequestType, invoiceDuration,
    invoiceDates, invoiceReason, invoiceStatus, invoiceApprover, invoiceDecisionTime,
    invoiceRequestId, invoiceReturnInfo, invoiceReturnStatus, invoiceReturnTime,
    shareInvoiceBtn, invoiceShareStatus;


/**
 * Initializes the History module with dependencies and elements.
 * @param {object} elements - An object containing references to all DOM elements.
 * @param {object} dbInstance - The initialized Firestore database instance.
 * @param {function} fnToGetUser - A function that returns the current user object.
 */
export function initHistory(elements, dbInstance, fnToGetUser) {
    // --- Assign Dependencies ---
    db = dbInstance;
    getCurrentUserFn = fnToGetUser;

    // --- Assign Elements ---
    historyContainerLeave = elements.historyContainerLeave;
    historyPlaceholderLeave = elements.historyPlaceholderLeave;
    historyContainerOut = elements.historyContainerOut;
    historyPlaceholderOut = elements.historyPlaceholderOut;
    
    // Edit Modal Elements
    editModal = elements.editModal;
    editModalTitle = elements.editModalTitle;
    editForm = elements.editForm;
    editRequestId = elements.editRequestId;
    editDurationSearch = elements.editDurationSearch;
    editDurationDropdown = elements.editDurationDropdown;
    editSingleDateContainer = elements.editSingleDateContainer;
    editLeaveDateSingle = elements.editLeaveDateSingle;
    editDateRangeContainer = elements.editDateRangeContainer;
    editLeaveDateStart = elements.editLeaveDateStart;
    editLeaveDateEnd = elements.editLeaveDateEnd;
    editReasonSearch = elements.editReasonSearch;
    editReasonDropdown = elements.editReasonDropdown;
    editErrorEl = elements.editErrorEl;
    editLoadingEl = elements.editLoadingEl;
    submitEditBtn = elements.submitEditBtn;
    cancelEditBtn = elements.cancelEditBtn;

    // Delete Modal Elements
    deleteModal = elements.deleteModal;
    deleteConfirmBtn = elements.deleteConfirmBtn;
    cancelDeleteBtn = elements.cancelDeleteBtn;
    deleteRequestId = elements.deleteRequestId;
    deleteCollectionType = elements.deleteCollectionType;

    // Invoice Modal Elements
    invoiceModal = elements.invoiceModal;
    closeInvoiceModalBtn = elements.closeInvoiceModalBtn;
    invoiceModalTitle = elements.invoiceModalTitle;
    invoiceContentWrapper = elements.invoiceContentWrapper;
    invoiceContent = elements.invoiceContent;
    invoiceUserName = elements.invoiceUserName;
    invoiceUserId = elements.invoiceUserId;
    invoiceUserDept = elements.invoiceUserDept;
    invoiceRequestType = elements.invoiceRequestType;
    invoiceDuration = elements.invoiceDuration;
    invoiceDates = elements.invoiceDates;
    invoiceReason = elements.invoiceReason;
    invoiceStatus = elements.invoiceStatus;
    invoiceApprover = elements.invoiceApprover;
    invoiceDecisionTime = elements.invoiceDecisionTime;
    invoiceRequestId = elements.invoiceRequestId;
    invoiceReturnInfo = elements.invoiceReturnInfo;
    invoiceReturnStatus = elements.invoiceReturnStatus;
    invoiceReturnTime = elements.invoiceReturnTime;
    shareInvoiceBtn = elements.shareInvoiceBtn;
    invoiceShareStatus = elements.invoiceShareStatus;

    // --- Attach Event Listeners ---

    // History Card Button Clicks (Event Delegation)
    if (historyContainerLeave) historyContainerLeave.addEventListener('click', handleHistoryTap);
    if (historyContainerOut) historyContainerOut.addEventListener('click', handleHistoryTap);

    // Edit Modal Buttons
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);
    if (submitEditBtn) submitEditBtn.addEventListener('click', submitEdit);
    
    // Delete Modal Buttons
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => {
        if (deleteModal) deleteModal.classList.add('hidden');
    });
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener('click', submitDelete);

    // Invoice Modal Buttons
    if (closeInvoiceModalBtn) closeInvoiceModalBtn.addEventListener('click', hideInvoiceModal);
    if (shareInvoiceBtn) shareInvoiceBtn.addEventListener('click', shareInvoiceAsImage);
}

// --- History Real-time Listeners ---

/**
 * Sets up the real-time Firestore listeners for both request collections.
 * @param {string} currentEmployeeId - The ID of the logged-in user.
 */
export function setupHistoryListeners(currentEmployeeId) {
    console.log("Setting up history listeners for employee ID:", currentEmployeeId);
    stopHistoryListeners(); // Stop any previous listeners

    if (!db || !currentEmployeeId) return console.error("Firestore DB not initialized or Employee ID not set.");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startTimestamp = Timestamp.fromDate(startOfMonth);
    const endTimestamp = Timestamp.fromDate(endOfMonth);

    try {
        const leaveQuery = query(
            collection(db, leaveRequestsCollectionPath),
            where("userId", "==", currentEmployeeId),
            where("requestedAt", ">=", startTimestamp),
            where("requestedAt", "<", endTimestamp)
        );
        console.log("Querying Leave Requests for current month...");
        historyUnsubscribe = onSnapshot(leaveQuery, (snapshot) => {
            console.log(`Received LEAVE snapshot. Size: ${snapshot.size}`);
            renderHistoryList(snapshot, historyContainerLeave, historyPlaceholderLeave, 'leave');
        }, (error) => {
            console.error("Error listening to LEAVE history:", error);
            if (historyPlaceholderLeave) {
                historyPlaceholderLeave.innerHTML = `<p class="text-red-500">Error: មិនអាចទាញយកប្រវត្តិបានទេ ${error.code.includes('permission-denied') ? '(Permission Denied)' : (error.code.includes('requires an index') ? '(ត្រូវបង្កើត Index សូមមើល Console)' : '')}</p>`;
                historyPlaceholderLeave.classList.remove('hidden');
            }
        });
    } catch (e) {
        console.error("Failed to create LEAVE history query:", e);
        if (historyPlaceholderLeave) historyPlaceholderLeave.innerHTML = `<p class="text-red-500">Error: ${e.message}</p>`;
        historyPlaceholderLeave.classList.remove('hidden');
    }

    try {
        const outQuery = query(
            collection(db, outRequestsCollectionPath),
            where("userId", "==", currentEmployeeId),
            where("requestedAt", ">=", startTimestamp),
            where("requestedAt", "<", endTimestamp)
        );
        console.log("Querying Out Requests for current month...");
        outHistoryUnsubscribe = onSnapshot(outQuery, (snapshot) => {
            console.log(`Received OUT snapshot. Size: ${snapshot.size}`);
            renderHistoryList(snapshot, historyContainerOut, historyPlaceholderOut, 'out');
        }, (error) => {
            console.error("Error listening to OUT history:", error);
            if (historyPlaceholderOut) {
                historyPlaceholderOut.innerHTML = `<p class="text-red-500">Error: មិនអាចទាញយកប្រវត្តិបានទេ ${error.code.includes('permission-denied') ? '(Permission Denied)' : (error.code.includes('requires an index') ? '(ត្រូវបង្កើត Index សូមមើល Console)' : '')}</p>`;
                historyPlaceholderOut.classList.remove('hidden');
            }
        });
    } catch (e) {
        console.error("Failed to create OUT history query:", e);
        if (historyPlaceholderOut) historyPlaceholderOut.innerHTML = `<p class="text-red-500">Error: ${e.message}</p>`;
        historyPlaceholderOut.classList.remove('hidden');
    }
}

/**
 * Stops the real-time Firestore listeners.
 */
export function stopHistoryListeners() {
    if (historyUnsubscribe) {
        historyUnsubscribe();
        historyUnsubscribe = null;
        console.log("Stopped LEAVE history listener.");
    }
    if (outHistoryUnsubscribe) {
        outHistoryUnsubscribe();
        outHistoryUnsubscribe = null;
        console.log("Stopped OUT history listener.");
    }
}

// --- History Rendering ---

function getSortPriority(status) {
    switch(status) {
        case 'pending': return 1;
        case 'editing': return 2;
        case 'approved': return 3;
        case 'rejected': return 4;
        default: return 5;
    }
}

function renderHistoryList(snapshot, container, placeholder, type) {
    if (!container || !placeholder) return;
    if (snapshot.empty) {
        placeholder.classList.remove('hidden');
        container.innerHTML = '';
    } else {
        placeholder.classList.add('hidden');
        container.innerHTML = ''; // Clear previous content
        const requests = [];
        snapshot.forEach(doc => requests.push(doc.data()));

        // Sort requests: by status priority, then by most recent
        requests.sort((a, b) => {
            const priorityA = getSortPriority(a.status);
            const priorityB = getSortPriority(b.status);
            if (priorityA !== priorityB) return priorityA - priorityB;
            const timeA = a.requestedAt?.toMillis() ?? 0;
            const timeB = b.requestedAt?.toMillis() ?? 0;
            return timeB - timeA; // Newest first
        });

        requests.forEach(request => container.innerHTML += renderHistoryCard(request, type));
    }
}

function renderHistoryCard(request, type) {
    if (!request || !request.requestId) return '';

    let statusColor, statusText, decisionInfo = '';
    switch(request.status) {
        case 'approved':
            statusColor = 'bg-green-100 text-green-800';
            statusText = 'បានយល់ព្រម';
            if (request.decisionAt) decisionInfo = `<p class="text-xs text-green-600 mt-1">នៅម៉ោង: ${formatFirestoreTimestamp(request.decisionAt, 'time')}</p>`;
            break;
        case 'rejected':
            statusColor = 'bg-red-100 text-red-800';
            statusText = 'បានបដិសេធ';
            if (request.decisionAt) decisionInfo = `<p class="text-xs text-red-600 mt-1">នៅម៉ោង: ${formatFirestoreTimestamp(request.decisionAt, 'time')}</p>`;
            break;
        case 'editing':
            statusColor = 'bg-blue-100 text-blue-800';
            statusText = 'កំពុងកែសម្រួល';
            break;
        default:
            statusColor = 'bg-yellow-100 text-yellow-800';
            statusText = 'កំពុងរង់ចាំ';
    }

    const dateString = (request.startDate === request.endDate)
        ? request.startDate
        : (request.startDate && request.endDate ? `${request.startDate} ដល់ ${request.endDate}` : 'N/A');

    const showActions = (request.status === 'pending' || request.status === 'editing');

    let returnInfo = '';
    let returnButton = '';
    if (type === 'out') {
        if (request.returnStatus === 'បានចូលមកវិញ') {
            returnInfo = `<p class="text-sm font-semibold text-green-700 mt-2">✔️ បានចូលមកវិញ: ${request.returnedAt || ''}</p>`;
        } else if (request.status === 'approved') {
            returnButton = `<button data-id="${request.requestId}" class="return-btn w-full mt-3 py-2 px-3 bg-green-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-green-700">បញ្ជាក់ចូលមកវិញ</button>`;
        }
    }

    let invoiceButton = '';
    if (request.status === 'approved') {
        invoiceButton = `<button data-id="${request.requestId}" data-type="${type}" class="invoice-btn mt-3 py-1.5 px-3 bg-indigo-100 text-indigo-700 rounded-md font-semibold text-xs shadow-sm hover:bg-indigo-200 w-full sm:w-auto">ពិនិត្យមើលវិក័យប័ត្រ</button>`;
    }

    return `
    <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-4">
        <div class="flex justify-between items-start">
            <span class="font-semibold text-gray-800">${request.duration || 'N/A'}</span>
            <span class="text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}">${statusText}</span>
        </div>
        <p class="text-sm text-gray-600 mt-1">${dateString}</p>
        <p class="text-sm text-gray-500 mt-1"><b>មូលហេតុ:</b> ${request.reason || 'មិនបានបញ្ជាក់'}</p>
        ${decisionInfo}
        ${returnInfo}
        <div class="mt-3 pt-3 border-t border-gray-100">
            <div class="flex flex-wrap justify-between items-center gap-2">
                <p class="text-xs text-gray-400">ID: ${request.requestId}</p>
                ${showActions ? `
                <div class="flex space-x-2">
                    <button data-id="${request.requestId}" data-type="${type}" class="edit-btn p-1 text-blue-600 hover:text-blue-800">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button data-id="${request.requestId}" data-type="${type}" class="delete-btn p-1 text-red-600 hover:text-red-800">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
                ` : ''}
                ${invoiceButton}
            </div>
            ${returnButton}
        </div>
    </div>`;
}

// --- Event Handler for History Card Clicks ---

function handleHistoryTap(event) {
    const invoiceBtn = event.target.closest('.invoice-btn');
    const returnBtn = event.target.closest('.return-btn');
    const editBtn = event.target.closest('.edit-btn');
    const deleteBtn = event.target.closest('.delete-btn');

    if (invoiceBtn) {
        event.preventDefault();
        openInvoiceModal(invoiceBtn.dataset.id, invoiceBtn.dataset.type);
    } else if (returnBtn) {
        event.preventDefault();
        const currentUser = getCurrentUserFn();
        if(currentUser) {
            startReturnConfirmation(returnBtn.dataset.id, currentUser);
        } else {
            showCustomAlert("Error", "មិនអាចបញ្ជាក់អ្នកប្រើប្រាស់បានទេ។ សូម Login ម្ដងទៀត។");
        }
    } else if (editBtn) {
        event.preventDefault();
        openEditModal(editBtn.dataset.id, editBtn.dataset.type);
    } else if (deleteBtn) {
        event.preventDefault();
        openDeleteModal(deleteBtn.dataset.id, deleteBtn.dataset.type);
    }
}

// --- Edit Modal Logic ---

async function openEditModal(requestId, type) {
    if (!db || !requestId || !type) return;
    const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath;
    if (!collectionPath) return;

    if (editLoadingEl) editLoadingEl.classList.remove('hidden');
    if (editErrorEl) editErrorEl.classList.add('hidden');
    if (editModal) editModal.classList.remove('hidden');

    try {
        const requestRef = doc(db, collectionPath, requestId);
        await updateDoc(requestRef, { status: 'editing' });
        console.log("Request status set to 'editing'");
        
        const docSnap = await getDoc(requestRef);
        if (!docSnap.exists()) throw new Error("Document not found");
        const data = docSnap.data();

        if (editModalTitle) editModalTitle.textContent = (type === 'leave') ? "កែសម្រួលច្បាប់ឈប់" : "កែសម្រួលច្បាប់ចេញក្រៅ";
        if (editRequestId) editRequestId.value = requestId;
        if (editReasonSearch) editReasonSearch.value = data.reason || '';
        if (editDurationSearch) editDurationSearch.value = data.duration;

        // Re-setup dropdowns for the edit modal
        setupSearchableDropdown('edit-duration-search', 'edit-duration-dropdown', (type === 'leave' ? leaveDurationItems : outDurationItems), () => {}, false);
        setupSearchableDropdown('edit-reason-search', 'edit-reason-dropdown', (type === 'leave' ? leaveReasonItems : outReasonItems), () => {}, true);

        // Hide/Show correct date fields
        if (type === 'leave') {
            if (singleDayLeaveDurations.includes(data.duration)) {
                if (editSingleDateContainer) editSingleDateContainer.classList.remove('hidden');
                if (editDateRangeContainer) editDateRangeContainer.classList.add('hidden');
                if (editLeaveDateSingle) editLeaveDateSingle.value = data.startDate;
            } else {
                if (editSingleDateContainer) editSingleDateContainer.classList.add('hidden');
                if (editDateRangeContainer) editDateRangeContainer.classList.remove('hidden');
                if (editLeaveDateStart) editLeaveDateStart.value = formatDbDateToInput(data.startDate);
                if (editLeaveDateEnd) editLeaveDateEnd.value = formatDbDateToInput(data.endDate);
            }
        } else { // type === 'out'
            if (editSingleDateContainer) editSingleDateContainer.classList.remove('hidden');
            if (editDateRangeContainer) editDateRangeContainer.classList.add('hidden');
            if (editLeaveDateSingle) editLeaveDateSingle.value = data.startDate;
        }

        if (editLoadingEl) editLoadingEl.classList.add('hidden');
    } catch (e) {
        console.error("Error opening edit modal:", e);
        if (editLoadingEl) editLoadingEl.classList.add('hidden');
        if (editErrorEl) {
            editErrorEl.textContent = `Error: ${e.message}`;
            editErrorEl.classList.remove('hidden');
        }
    }
}

async function cancelEdit() {
    const requestId = editRequestId.value;
    const type = (editModalTitle.textContent.includes("ឈប់")) ? 'leave' : 'out';
    const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath;

    if (requestId && collectionPath) {
        try {
            const requestRef = doc(db, collectionPath, requestId);
            await updateDoc(requestRef, { status: 'pending' });
            console.log("Edit cancelled, status reverted to 'pending'");
        } catch (e) {
            console.error("Error reverting status on edit cancel:", e);
        }
    }
    if (editModal) editModal.classList.add('hidden');
}

async function submitEdit() {
    const requestId = editRequestId.value;
    const type = (editModalTitle.textContent.includes("ឈប់")) ? 'leave' : 'out';
    const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath;
    const newReason = editReasonSearch.value;

    if (!requestId || !collectionPath || !newReason || newReason.trim() === '') {
        if(editErrorEl) {
            editErrorEl.textContent = "មូលហេតុមិនអាចទទេបានទេ។";
            editErrorEl.classList.remove('hidden');
        }
        return;
    }

    if (editLoadingEl) editLoadingEl.classList.remove('hidden');
    if (editErrorEl) editErrorEl.classList.add('hidden');

    try {
        const requestRef = doc(db, collectionPath, requestId);
        await updateDoc(requestRef, {
            reason: newReason.trim(),
            status: 'pending',
            requestedAt: serverTimestamp() // Update timestamp to make it "new"
        });

        console.log("Edit submitted, status set to 'pending'");
        let message = `<b>🔔 សំណើត្រូវបានកែសម្រួល 🔔</b>\n\n`;
        message += `<b>ID:</b> \`${requestId}\`\n`;
        message += `<b>មូលហេតុថ្មី:</b> ${newReason.trim()}\n\n`;
        message += `(សំណើនេះ ឥឡូវនេះ ស្ថិតក្នុងស្ថានភាព \'pending\' ឡើងវិញ)`;
        await sendTelegramNotification(message);

        if (editLoadingEl) editLoadingEl.classList.add('hidden');
        if (editModal) editModal.classList.add('hidden');
    } catch (e) {
        console.error("Error submitting edit:", e);
        if (editLoadingEl) editLoadingEl.classList.add('hidden');
        if (editErrorEl) {
            editErrorEl.textContent = `Error: ${e.message}`;
            editErrorEl.classList.remove('hidden');
        }
    }
}

// --- Delete Modal Logic ---

function openDeleteModal(requestId, type) {
    if (deleteRequestId) deleteRequestId.value = requestId;
    if (deleteCollectionType) deleteCollectionType.value = type;
    if (deleteModal) deleteModal.classList.remove('hidden');
}

async function submitDelete() {
    const requestId = deleteRequestId.value;
    const type = deleteCollectionType.value;
    const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath;

    if (!db || !requestId || !collectionPath) {
        console.error("Cannot delete: Missing info");
        return showCustomAlert("Error", "មិនអាចលុបបានទេ។");
    }
    console.log("Attempting to delete doc:", requestId, "from:", collectionPath);
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'កំពុងលុប...';

    try {
        const requestRef = doc(db, collectionPath, requestId);
        await deleteDoc(requestRef);
        console.log("Document successfully deleted!");
        if (deleteModal) deleteModal.classList.add('hidden');
    } catch (e) {
        console.error("Error deleting document:", e);
        showCustomAlert("Error", `មិនអាចលុបបានទេ។ ${e.message}`);
    } finally {
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.textContent = 'យល់ព្រមលុប';
    }
}

// --- Invoice Modal Logic ---

function hideInvoiceModal() {
    if (invoiceModal) invoiceModal.classList.add('hidden');
    if (invoiceShareStatus) invoiceShareStatus.textContent = '';
    if (shareInvoiceBtn) shareInvoiceBtn.disabled = false;
}

async function openInvoiceModal(requestId, type) {
    console.log(`--- Attempting to open invoice for ${type} request ID: ${requestId} ---`);
    if (!db || !requestId || !type) {
        return showCustomAlert("Error", "មិនអាចបើកវិក័យប័ត្របានទេ (Missing ID or Type)");
    }
    const collectionPath = (type === 'leave') ? leaveRequestsCollectionPath : outRequestsCollectionPath;
    if (!collectionPath) {
        return showCustomAlert("Error", "មិនអាចបើកវិក័យប័ត្របានទេ (Invalid Collection Path)");
    }
    if (!invoiceModal) {
        console.error("Invoice modal element not found!");
        return;
    }

    invoiceModal.classList.remove('hidden');
    
    // Reset fields to loading state
    if(invoiceUserName) invoiceUserName.textContent='កំពុងទាញយក...';
    if(invoiceUserId) invoiceUserId.textContent='...';
    if(invoiceUserDept) invoiceUserDept.textContent='...';
    if(invoiceRequestType) invoiceRequestType.textContent='...';
    if(invoiceDuration) invoiceDuration.textContent='...';
    if(invoiceDates) invoiceDates.textContent='...';
    if(invoiceReason) invoiceReason.textContent='...';
    if(invoiceApprover) invoiceApprover.textContent='...';
    if(invoiceDecisionTime) invoiceDecisionTime.textContent='...';
    if(invoiceRequestId) invoiceRequestId.textContent='...';
    if(invoiceReturnInfo) invoiceReturnInfo.classList.add('hidden');
    if(shareInvoiceBtn) shareInvoiceBtn.disabled = true;

    try {
        const docRef = doc(db, collectionPath, requestId);
        console.log("Fetching Firestore doc:", docRef.path);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
            throw new Error("រកមិនឃើញសំណើរនេះទេ។");
        }
        console.log("Firestore doc found.");
        const data = docSnap.data();

        const requestTypeText = (type === 'leave') ? 'ច្បាប់ឈប់សម្រាក' : 'ច្បាប់ចេញក្រៅ';
        const decisionTimeText = formatFirestoreTimestamp(data.decisionAt || data.requestedAt);
        const dateRangeText = (data.startDate === data.endDate) ? data.startDate : `${data.startDate} ដល់ ${data.endDate}`;

        if(invoiceModalTitle) invoiceModalTitle.textContent = `វិក័យប័ត្រ - ${requestTypeText}`;
        if(invoiceUserName) invoiceUserName.textContent = data.name || 'N/A';
        if(invoiceUserId) invoiceUserId.textContent = data.userId || 'N/A';
        if(invoiceUserDept) invoiceUserDept.textContent = data.department || 'N/A';
        if(invoiceRequestType) invoiceRequestType.textContent = requestTypeText;
        if(invoiceDuration) invoiceDuration.textContent = data.duration || 'N/A';
        if(invoiceDates) invoiceDates.textContent = dateRangeText;
        if(invoiceReason) invoiceReason.textContent = data.reason || 'N/A';
        if(invoiceApprover) invoiceApprover.textContent = "លោកគ្រូ ពៅ ដារ៉ូ"; // Hardcoded
        if(invoiceDecisionTime) invoiceDecisionTime.textContent = decisionTimeText;
        if(invoiceRequestId) invoiceRequestId.textContent = data.requestId || requestId;

        // Show return info only for 'out' requests that are returned
        if (type === 'out' && data.returnStatus === 'បានចូលមកវិញ') {
            if (invoiceReturnStatus) invoiceReturnStatus.textContent = data.returnStatus;
            if (invoiceReturnTime) invoiceReturnTime.textContent = data.returnedAt || 'N/A';
            if (invoiceReturnInfo) invoiceReturnInfo.classList.remove('hidden');
        } else {
            if (invoiceReturnInfo) invoiceReturnInfo.classList.add('hidden');
        }

        if(shareInvoiceBtn) {
            shareInvoiceBtn.dataset.requestId = data.requestId || requestId;
            shareInvoiceBtn.dataset.userName = data.name || 'User';
            shareInvoiceBtn.dataset.requestType = requestTypeText;
            shareInvoiceBtn.disabled = false;
        }
        console.log("Invoice modal populated.");

    } catch (error) {
        console.error("Error opening/populating invoice modal:", error);
        hideInvoiceModal();
        showCustomAlert("Error", `មិនអាចផ្ទុកទិន្នន័យវិក័យប័ត្របានទេ: ${error.message}`);
    }
}

async function shareInvoiceAsImage() {
    if (!invoiceContent || typeof html2canvas === 'undefined' || !shareInvoiceBtn) {
        showCustomAlert("Error", "មុខងារ Share មិនទាន់រួចរាល់ ឬ Library បាត់។");
        return;
    }

    if(invoiceShareStatus) invoiceShareStatus.textContent = 'កំពុងបង្កើតរូបភាព...';
    shareInvoiceBtn.disabled = true;

    try {
        if(invoiceContentWrapper) invoiceContentWrapper.scrollTop = 0; // Scroll to top
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait for render

        const canvas = await html2canvas(invoiceContent, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                throw new Error("មិនអាចបង្កើតរូបភាព Blob បានទេ។");
            }
            if(invoiceShareStatus) invoiceShareStatus.textContent = 'កំពុងព្យាយាម Share...';

            if (navigator.share && navigator.canShare) {
                const fileName = `Invoice_${shareInvoiceBtn.dataset.requestId || 'details'}.png`;
                const file = new File([blob], fileName, { type: blob.type });
                const shareData = {
                    files: [file],
                    title: `វិក័យប័ត្រសុំច្បាប់ (${shareInvoiceBtn.dataset.requestType || ''})`,
                    text: `វិក័យប័ត្រសុំច្បាប់សម្រាប់ ${shareInvoiceBtn.dataset.userName || ''} (ID: ${shareInvoiceBtn.dataset.requestId || ''})`,
                };

                if (navigator.canShare(shareData)) {
                    try {
                        await navigator.share(shareData);
                        console.log('Invoice shared successfully via Web Share API');
                        if(invoiceShareStatus) invoiceShareStatus.textContent = 'Share ជោគជ័យ!';
                    } catch (err) {
                        console.error('Web Share API error:', err);
                        if(invoiceShareStatus) invoiceShareStatus.textContent = 'Share ត្រូវបានបោះបង់។';
                        if (err.name !== 'AbortError') {
                            showCustomAlert("Share Error", "មិនអាច Share បានតាម Web Share API។ សូមព្យាយាមម្តងទៀត។");
                        }
                    }
                } else {
                    console.warn('Web Share API cannot share this data.');
                    if(invoiceShareStatus) invoiceShareStatus.textContent = 'មិនអាច Share file បាន។';
                    showCustomAlert("Share Error", "Browser នេះមិនគាំទ្រការ Share file ទេ។ សូមធ្វើការ Screenshot ដោយដៃ។");
                }
            } else {
                console.warn('Web Share API not supported.');
                if(invoiceShareStatus) invoiceShareStatus.textContent = 'Web Share មិនដំណើរការ។';
                showCustomAlert("សូម Screenshot", "Browser នេះមិនគាំទ្រ Web Share API ទេ។ សូមធ្វើការ Screenshot វិក័យប័ត្រនេះដោយដៃ រួច Share ទៅ Telegram។");
            }
            shareInvoiceBtn.disabled = false;
        }, 'image/png');

    } catch (error) {
        console.error("Error generating or sharing invoice image:", error);
        if(invoiceShareStatus) invoiceShareStatus.textContent = 'Error!';
        showCustomAlert("Error", `មានបញ្ហាក្នុងការបង្កើត ឬ Share រូបភាព: ${error.message}`);
        shareInvoiceBtn.disabled = false;
    }
}
