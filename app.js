//
// 🚀 FILE 7: app.js (The Conductor)
// នាំចូល (imports) ម៉ូឌុលទាំងអស់ និងគ្រប់គ្រង Auth/App State
//

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Config Import (File 1) ---
import { firebaseConfig, GVIZ_URL, setCollectionPaths } from './config.js';

// --- Utils Import (File 2) ---
import { initUtils, showCustomAlert } from './utils.js';

// --- UI Import (File 3) ---
import { loadHTMLModules, initUI, navigateTo, populateUserDropdown, populateAccountPage } from './ui.js';

// --- FaceScan Import (File 4) ---
import { initFaceScan, loadFaceApiModels, startFaceScan, clearUserReferenceDescriptor } from './faceScan.js';

// --- Forms Import (File 5) ---
import { initForms } from './forms.js';

// --- History Import (File 6) ---
import { initHistory, setupHistoryListeners, stopHistoryListeners } from './history.js';

// Enable Firestore debug logging
setLogLevel('debug');

// --- Global State & Element References ---
let db, auth, userId;
let allUsersData = [], currentUser = null, selectedUserId = null;

// --- DOM Element References ---
// These are only elements from index.html (Login Page / Modals)
// Elements from main_app.html/modals.html will be assigned AFTER loadHTMLModules()
let userSearchInput, userDropdown, userSearchError, scanFaceBtn, modelStatusEl,
    loginFormContainer, inAppWarning, dataLoadingIndicator, rememberMeCheckbox,
    loginPage, criticalErrorDisplay, mainAppContainer;


// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {

    // --- Assign elements from index.html (Login/Base) ---
    userSearchInput = document.getElementById('user-search');
    userDropdown = document.getElementById('user-dropdown');
    userSearchError = document.getElementById('user-search-error');
    scanFaceBtn = document.getElementById('scan-face-btn');
    modelStatusEl = document.getElementById('model-status');
    loginFormContainer = document.getElementById('login-form-container');
    inAppWarning = document.getElementById('in-app-warning');
    dataLoadingIndicator = document.getElementById('data-loading-indicator');
    rememberMeCheckbox = document.getElementById('remember-me');
    loginPage = document.getElementById('page-login');
    criticalErrorDisplay = document.getElementById('critical-error-display');
    
    // --- Firebase Initialization & Auth ---
    try {
        if (!firebaseConfig.projectId) throw new Error("projectId not provided in firebase.initializeApp.");
        console.log("Initializing Firebase with Config:", firebaseConfig);
        
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Determine collection paths
        const canvasAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        setCollectionPaths(canvasAppId);

        // --- Auth State Change Handler ---
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Firebase Auth state changed. User UID:", user.uid);
                userId = user.uid;
                
                // Check for in-app browser
                if (isClient()) {
                    console.log("Detected In-App Browser.");
                    if (inAppWarning) inAppWarning.classList.remove('hidden');
                    if (modelStatusEl) modelStatusEl.textContent = 'សូមបើកក្នុង Browser ពេញលេញ';
                    if (dataLoadingIndicator) dataLoadingIndicator.classList.add('hidden');
                } else {
                    console.log("Detected Full Browser.");
                    if (inAppWarning) inAppWarning.classList.add('hidden');
                    
                    // Start loading face models (don't need to wait)
                    if (typeof faceapi !== 'undefined') {
                        if (scanFaceBtn) scanFaceBtn.disabled = true;
                        loadFaceApiModels();
                    } else {
                        console.error("Face-API.js មិនអាចទាញយកបានត្រឹមត្រូវទេ។");
                        if (modelStatusEl) modelStatusEl.textContent = 'Error: មិនអាចទាញយក Library ស្កេនមុខបាន';
                    }

                    // Check for remembered user
                    const rememberedUser = localStorage.getItem('leaveAppUser');
                    if (rememberedUser) {
                        try {
                            const parsedUser = JSON.parse(rememberedUser);
                            if (parsedUser && parsedUser.id) {
                                console.log("Found remembered user:", parsedUser.id);
                                currentUser = parsedUser;
                                // Need to load HTML before we can show logged in state
                                // We'll do this inside showLoggedInState
                                showLoggedInState(parsedUser); 
                                return; // Skip normal flow
                            }
                        } catch (e){
                            localStorage.removeItem('leaveAppUser');
                        }
                    }

                    console.log("No remembered user found, starting normal app flow.");
                    initializeAppFlow();
                }
            } else {
                console.log("Firebase Auth: No user signed in. Attempting anonymous sign-in...");
                signInAnonymously(auth).catch(anonError => {
                    console.error("Error during automatic anonymous sign-in attempt:", anonError);
                    if (criticalErrorDisplay) {
                        criticalErrorDisplay.classList.remove('hidden');
                        criticalErrorDisplay.textContent = `Critical Error: មិនអាច Sign In បានទេ។ ${anonError.message}។ សូម Refresh ម្ដងទៀត។`;
                    }
                });
            }
        });

        console.log("Attempting initial Anonymous Sign-In...");
        await signInAnonymously(auth);
        console.log("Firebase Auth: Initial Anonymous Sign-In successful (or already signed in).");

    } catch (e) {
        console.error("Firebase Initialization/Auth Error:", e);
        if(criticalErrorDisplay) {
            criticalErrorDisplay.classList.remove('hidden');
            criticalErrorDisplay.textContent = `Critical Error: មិនអាចតភ្ជាប់ Firebase បានទេ។ ${e.message}។ សូម Refresh ម្ដងទៀត។`;
        }
        if(loginPage) loginPage.classList.add('hidden');
    }
}); // End of DOMContentLoaded

/**
 * Checks if the app is running in an in-app browser (WebView).
 */
function isClient() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return (
        (ua.indexOf('FBAN') > -1) || (ua.indexOf('FBAV') > -1) ||
        (ua.indexOf('Twitter') > -1) || (ua.indexOf('Telegram') > -1) ||
        (ua.indexOf('WebView') > -1) || (ua.indexOf('wv') > -1)
    );
}

/**
 * Loads all HTML, assigns all elements, initializes all modules.
 * This MUST be called before any UI interaction.
 * @returns {Promise<boolean>} - True if setup was successful, false otherwise.
 */
async function setupApplicationModules() {
    // 1. Load main_app.html and modals.html
    const htmlLoaded = await loadHTMLModules();
    if (!htmlLoaded) {
        console.error("Halting app setup due to HTML load failure.");
        return false;
    }

    // 2. Now that HTML is loaded, gather ALL element references
    const elements = {
        // index.html elements
        userSearchInput, userDropdown, userSearchError, scanFaceBtn, modelStatusEl,
        loginFormContainer, inAppWarning, dataLoadingIndicator, rememberMeCheckbox,
        loginPage, criticalErrorDisplay,
        customAlertModal: document.getElementById('custom-alert-modal'),
        customAlertTitle: document.getElementById('custom-alert-title'),
        customAlertMessage: document.getElementById('custom-alert-message'),
        customAlertOkBtn: document.getElementById('custom-alert-ok-btn'),
        customAlertIconWarning: document.getElementById('custom-alert-icon-warning'),
        customAlertIconSuccess: document.getElementById('custom-alert-icon-success'),
        faceScanModal: document.getElementById('face-scan-modal'),
        video: document.getElementById('video'),
        scanStatusEl: document.getElementById('scan-status'),
        scanDebugEl: document.getElementById('scan-debug'),
        cancelScanBtn: document.getElementById('cancel-scan-btn'),

        // main_app.html elements
        mainAppContainer: document.getElementById('main-app-container'),
        homeUserName: document.getElementById('home-user-name'),
        bottomNav: document.getElementById('bottom-navigation'),
        userPhotoEl: document.getElementById('user-photo'),
        userNameEl: document.getElementById('user-name'),
        userIdEl: document.getElementById('user-id'),
        userGenderEl: document.getElementById('user-gender'),
        userGroupEl: document.getElementById('user-group'),
        userDepartmentEl: document.getElementById('user-department'),
        logoutBtn: document.getElementById('logout-btn'),
        navButtons: document.querySelectorAll('.nav-btn'),
        mainContent: document.getElementById('main-content'),
        historyTabLeave: document.getElementById('history-tab-leave'),
        historyTabOut: document.getElementById('history-tab-out'),
        historyContainerLeave: document.getElementById('history-container-leave'),
        historyContainerOut: document.getElementById('history-container-out'),
        historyPlaceholderLeave: document.getElementById('history-placeholder-leave'),
        historyPlaceholderOut: document.getElementById('history-placeholder-out'),
        historyContent: document.getElementById('history-content'),
        openDailyAttendanceBtn: document.getElementById('open-daily-attendance-btn'),
        attendancePage: document.getElementById('page-daily-attendance'),
        closeAttendancePageBtn: document.getElementById('close-attendance-page-btn'),
        attendanceIframe: document.getElementById('attendance-iframe'),

        // Form elements (Leave)
        requestLeavePage: document.getElementById('page-request-leave'),
        openLeaveRequestBtn: document.getElementById('open-leave-request-btn'),
        cancelLeaveRequestBtn: document.getElementById('cancel-leave-request-btn'),
        submitLeaveRequestBtn: document.getElementById('submit-leave-request-btn'),
        leaveDurationSearchInput: document.getElementById('leave-duration-search'),
        leaveDurationDropdownEl: document.getElementById('leave-duration-dropdown'),
        leaveSingleDateContainer: document.getElementById('leave-single-date-container'),
        leaveDateRangeContainer: document.getElementById('leave-date-range-container'),
        leaveSingleDateInput: document.getElementById('leave-date-single'),
        leaveStartDateInput: document.getElementById('leave-date-start'),
        leaveEndDateInput: document.getElementById('leave-date-end'),
        leaveRequestErrorEl: document.getElementById('leave-request-error'),
        leaveRequestLoadingEl: document.getElementById('leave-request-loading'),
        leaveReasonSearchInput: document.getElementById('leave-reason-search'),
        leaveReasonDropdownEl: document.getElementById('leave-reason-dropdown'),
        
        // Form elements (Out)
        openOutRequestBtn: document.getElementById('open-out-request-btn'),
        requestOutPage: document.getElementById('page-request-out'),
        cancelOutRequestBtn: document.getElementById('cancel-out-request-btn'),
        submitOutRequestBtn: document.getElementById('submit-out-request-btn'),
        outRequestErrorEl: document.getElementById('out-request-error'),
        outRequestLoadingEl: document.getElementById('out-request-loading'),
        outDurationSearchInput: document.getElementById('out-duration-search'),
        outDurationDropdownEl: document.getElementById('out-duration-dropdown'),
        outReasonSearchInput: document.getElementById('out-reason-search'),
        outReasonDropdownEl: document.getElementById('out-reason-dropdown'),
        outDateInput: document.getElementById('out-date-single'),
        
        // modals.html elements
        returnScanModal: document.getElementById('return-scan-modal'),
        returnVideo: document.getElementById('return-video'),
        returnScanStatusEl: document.getElementById('return-scan-status'),
        returnScanDebugEl: document.getElementById('return-scan-debug'),
        cancelReturnScanBtn: document.getElementById('cancel-return-scan-btn'),
        
        editModal: document.getElementById('edit-modal'),
        editModalTitle: document.getElementById('edit-modal-title'),
        editForm: document.getElementById('edit-form'),
        editRequestId: document.getElementById('edit-request-id'),
        editDurationSearch: document.getElementById('edit-duration-search'),
        editDurationDropdown: document.getElementById('edit-duration-dropdown'),
        editSingleDateContainer: document.getElementById('edit-single-date-container'),
        editLeaveDateSingle: document.getElementById('edit-leave-date-single'),
        editDateRangeContainer: document.getElementById('edit-date-range-container'),
        editLeaveDateStart: document.getElementById('edit-leave-date-start'),
        editLeaveDateEnd: document.getElementById('edit-leave-date-end'),
        editReasonSearch: document.getElementById('edit-reason-search'),
        editReasonDropdown: document.getElementById('edit-reason-dropdown'),
        editErrorEl: document.getElementById('edit-error'),
        editLoadingEl: document.getElementById('edit-loading'),
        submitEditBtn: document.getElementById('submit-edit-btn'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        
        deleteModal: document.getElementById('delete-modal'),
        deleteConfirmBtn: document.getElementById('delete-confirm-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
        deleteRequestId: document.getElementById('delete-request-id'),
        deleteCollectionType: document.getElementById('delete-collection-type'),
        
        invoiceModal: document.getElementById('invoice-modal'),
        closeInvoiceModalBtn: document.getElementById('close-invoice-modal-btn'),
        invoiceModalTitle: document.getElementById('invoice-modal-title'),
        invoiceContentWrapper: document.getElementById('invoice-content-wrapper'),
        invoiceContent: document.getElementById('invoice-content'),
        invoiceUserName: document.getElementById('invoice-user-name'),
        invoiceUserId: document.getElementById('invoice-user-id'),
        invoiceUserDept: document.getElementById('invoice-user-dept'),
        invoiceRequestType: document.getElementById('invoice-request-type'),
        invoiceDuration: document.getElementById('invoice-duration'),
        invoiceDates: document.getElementById('invoice-dates'),
        invoiceReason: document.getElementById('invoice-reason'),
        invoiceStatus: document.getElementById('invoice-status'),
        invoiceApprover: document.getElementById('invoice-approver'),
        invoiceDecisionTime: document.getElementById('invoice-decision-time'),
        invoiceRequestId: document.getElementById('invoice-request-id'),
        invoiceReturnInfo: document.getElementById('invoice-return-info'),
        invoiceReturnStatus: document.getElementById('invoice-return-status'),
        invoiceReturnTime: document.getElementById('invoice-return-time'),
        shareInvoiceBtn: document.getElementById('share-invoice-btn'),
        invoiceShareStatus: document.getElementById('invoice-share-status'),
    };
    
    // Assign mainAppContainer for global use
    mainAppContainer = elements.mainAppContainer; 

    // 3. Initialize all modules
    initUtils(elements);
    initUI(elements);
    initFaceScan(elements, db, () => loginUser(selectedUserId)); // Pass login callback
    initForms(elements, db, auth, () => currentUser); // Pass function to get current user
    initHistory(elements, db, () => currentUser); // Pass function to get current user

    // 4. Attach Listeners for Login Page elements
    setupSearchableDropdown('user-search', 'user-dropdown', [], (id) => {
        selectedUserId = id;
        if (scanFaceBtn) scanFaceBtn.disabled = (id === null || !modelStatusEl || modelStatusEl.textContent !== 'Model ស្កេនមុខបានទាញយករួចរាល់');
        console.log("Selected User ID:", selectedUserId);
    });

    if (scanFaceBtn) scanFaceBtn.addEventListener('click', () => {
        if (!selectedUserId) {
            showCustomAlert("Error", "សូមជ្រើសរើសអត្តលេខរបស់អ្នកជាមុនសិន");
            return;
        }
        const user = allUsersData.find(u => u.id === selectedUserId);
        startFaceScan(user);
    });

    // 5. Attach Listener for Logout button (must be done here after elements are found)
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }

    return true; // Setup complete
}


// --- Main App Logic ---
let isAppSetup = false;

/**
 * Starts the app flow for a non-remembered user.
 */
async function initializeAppFlow() {
    console.log("initializeAppFlow called.");

    // Ensure modules are set up
    if (!isAppSetup) {
        const setupSuccess = await setupApplicationModules();
        if (!setupSuccess) return; // Stop if setup failed
        isAppSetup = true;
    }

    console.log("Fetching users for initial login...");
    if (dataLoadingIndicator) dataLoadingIndicator.classList.remove('hidden');
    fetchUsers();
}

/**
 * Fetches the user list from Google Sheets.
 */
async function fetchUsers() {
    console.log("Fetching users from Google Sheet...");
    try {
        const response = await fetch(GVIZ_URL);
        if (!response.ok) throw new Error(`Google Sheet fetch failed: ${response.status}`);
        
        const text = await response.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/s);
        if (!match || !match[1]) throw new Error("ទម្រង់ការឆ្លើយតបពី Google Sheet មិនត្រឹមត្រូវ");

        const json = JSON.parse(match[1]);
        if (json.table && json.table.rows && json.table.rows.length > 0) {
            allUsersData = json.table.rows.map(row => ({
                id: row.c?.[0]?.v ?? null,
                name: row.c?.[1]?.v ?? null,
                photo: row.c?.[2]?.v ?? null,
                gender: row.c?.[3]?.v ?? null,
                group: row.c?.[4]?.v ?? null,
                department: row.c?.[5]?.v ?? null
            }));
            console.log(`Fetched ${allUsersData.length} users.`);
            
            // Populate the login dropdown
            populateUserDropdown(allUsersData, 'user-search', 'user-dropdown', (id) => {
                selectedUserId = id;
                if (scanFaceBtn) scanFaceBtn.disabled = (id === null || !modelStatusEl || modelStatusEl.textContent !== 'Model ស្កេនមុខបានទាញយករួចរាល់');
                console.log("Selected User ID:", selectedUserId);
            });

            if (dataLoadingIndicator) dataLoadingIndicator.classList.add('hidden');
            if (loginFormContainer) loginFormContainer.classList.remove('hidden');
        } else {
            throw new Error("រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់");
        }
    } catch (error) {
        console.error("Error ពេលទាញយកទិន្នន័យ Google Sheet:", error);
        if (dataLoadingIndicator) {
            dataLoadingIndicator.innerHTML = `<p class="text-red-600 font-semibold">Error: មិនអាចទាញយកទិន្នន័យបាន</p><p class="text-gray-600 text-sm mt-1">សូមពិនិត្យអ៊ីនធឺណិត និង Refresh ម្ដងទៀត។</p>`;
            dataLoadingIndicator.classList.remove('hidden');
        }
    }
}

/**
 * Logs in the user after a successful face scan.
 * @param {string} userIdToLogin - The ID of the user to log in.
 */
function loginUser(userIdToLogin) {
    const user = allUsersData.find(u => u.id === userIdToLogin);
    if (!user) {
        showCustomAlert("Login Error", "មានបញ្ហា Login: រកមិនឃើញទិន្នន័យអ្នកប្រើប្រាស់");
        return;
    }
    
    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
        localStorage.setItem('leaveAppUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('leaveAppUser');
    }
    
    showLoggedInState(user);
}

/**
 * Logs out the current user and returns to the login screen.
 */
function logout() {
    currentUser = null;
    clearUserReferenceDescriptor(); // From faceScan.js
    localStorage.removeItem('leaveAppUser');
    
    if (loginPage) loginPage.classList.remove('hidden');
    if (mainAppContainer) mainAppContainer.classList.add('hidden');
    
    // Clear user info on Account page (elements are already stored in ui.js)
    populateAccountPage(null); 
    
    if (userSearchInput) userSearchInput.value = '';
    selectedUserId = null;
    if (scanFaceBtn) scanFaceBtn.disabled = true;

    stopHistoryListeners(); // From history.js
    
    // Re-sign in anonymously for the login page
    signInAnonymously(auth).catch(err => console.error("Error signing in anonymously after logout:", err));
}

/**
 * Sets up the UI for a logged-in user.
 * @param {object} user - The user object.
 */
async function showLoggedInState(user) {
    // Ensure modules are set up (especially for "Remember Me" flow)
    if (!isAppSetup) {
        const setupSuccess = await setupApplicationModules();
        if (!setupSuccess) return; // Stop if setup failed
        isAppSetup = true;
    }

    currentUser = user;
    
    populateAccountPage(user); // From ui.js
    
    const homeUserName = document.getElementById('home-user-name');
    if (homeUserName) homeUserName.textContent = user.name || '...';
    
    if (loginPage) loginPage.classList.add('hidden');
    if (mainAppContainer) mainAppContainer.classList.remove('hidden');
    if (criticalErrorDisplay) criticalErrorDisplay.classList.add('hidden');
    
    navigateTo('page-home'); // From ui.js
    setupHistoryListeners(user.id); // From history.js

    // Pre-cache descriptor in the background (optional)
    /*
    if (user.photo) {
        // We don't import getReferenceDescriptor, so this is disabled for now
        // getReferenceDescriptor(user.photo).catch(err => console.error("Failed to pre-cache descriptor:", err));
    }
    */
}
