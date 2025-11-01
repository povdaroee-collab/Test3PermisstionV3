//
// 🚀 FILE 3: ui.js
// ផ្ទុកនូវ Logic សម្រាប់គ្រប់គ្រង UI, Navigation, Dropdowns, និងការ Load HTML
//

// --- Module-scoped variables ---
let navButtons, bottomNav, mainContent, userPhotoEl, userNameEl, userIdEl, userGenderEl, userGroupEl, userDepartmentEl, historyTabLeave, historyTabOut, historyContainerLeave, historyContainerOut, historyContent, attendanceIframe;

// This array defines all possible page IDs
const pages = ['page-home', 'page-history', 'page-account', 'page-help', 'page-request-leave', 'page-request-out', 'page-daily-attendance'];

// --- NEW HTML Loader Function ---

/**
 * Loads main_app.html and modals.html into the DOM.
 * This MUST be called before assigning element references.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function loadHTMLModules() {
    try {
        const [appResponse, modalsResponse] = await Promise.all([
            fetch('main_app.html'),
            fetch('modals.html')
        ]);

        if (!appResponse.ok || !modalsResponse.ok) {
            throw new Error(`Failed to fetch HTML modules (App: ${appResponse.status}, Modals: ${modalsResponse.status})`);
        }

        // Inject the HTML content into the placeholder divs in index.html
        document.getElementById('app-wrapper').innerHTML = await appResponse.text();
        document.getElementById('modal-wrapper').innerHTML = await modalsResponse.text();

        console.log("main_app.html and modals.html loaded successfully.");
        return true; // Success
    } catch (error) {
        console.error("Error loading HTML modules:", error);
        const errorDisplay = document.getElementById('critical-error-display');
        if (errorDisplay) {
            errorDisplay.textContent = `Critical Error: មិនអាចផ្ទុកផ្នែកសំខាន់ៗរបស់កម្មវិធីបានទេ។ (${error.message})`;
            errorDisplay.classList.remove('hidden');
        }
        return false; // Failure
    }
}

// --- Initialization ---

/**
 * Initializes the UI module with necessary DOM elements.
 * This is called from app.js after elements are loaded.
 * @param {object} elements - An object containing references to DOM elements.
 */
export function initUI(elements, fnToGetUser) {
    // Assign module-scoped variables
    navButtons = elements.navButtons;
    bottomNav = elements.bottomNav;
    mainContent = elements.mainContent;
    userPhotoEl = elements.userPhotoEl;
    userNameEl = elements.userNameEl;
    userIdEl = elements.userIdEl;
    userGenderEl = elements.userGenderEl;
    userGroupEl = elements.userGroupEl;
    userDepartmentEl = elements.userDepartmentEl;
    historyTabLeave = elements.historyTabLeave;
    historyTabOut = elements.historyTabOut;
    historyContainerLeave = elements.historyContainerLeave;
    historyContainerOut = elements.historyContainerOut;
    historyContent = elements.historyContent;
    attendanceIframe = elements.attendanceIframe;

    // --- Attach UI Event Listeners ---

    // Bottom Navigation
    if (navButtons) {
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const pageToNavigate = button.dataset.page;
                if (pageToNavigate) navigateTo(pageToNavigate);
            });
        });
    }

    // History Page Tabs & Swipe
    if (historyTabLeave) historyTabLeave.addEventListener('click', () => showHistoryTab('leave'));
    if (historyTabOut) historyTabOut.addEventListener('click', () => showHistoryTab('out'));
    if (historyContent) {
        historyContent.addEventListener('touchstart', handleTouchStart, false);
        historyContent.addEventListener('touchmove', handleTouchMove, false);
        historyContent.addEventListener('touchend', handleTouchEnd, false);
    }

    if (elements.openDailyAttendanceBtn) {
        elements.openDailyAttendanceBtn.addEventListener('click', () => {
            const currentUser = fnToGetUser(); // យក User ដែលកំពុង Login
            
            if (!currentUser || !currentUser.id) {
                console.error("Cannot open attendance: user not found.");
                // អ្នកអាចបង្ហាញ Alert នៅទីនេះ បើចង់
                return; 
            }
            
            console.log("Opening Daily Attendance page for user:", currentUser.id);
            
            // បញ្ជូន User ID និង សញ្ញា embedded តាម URL parameter
            const attendanceBaseUrl = 'https://darotrb0-bit.github.io/MMKDailyattendance/';
            const userIdParam = `userId=${encodeURIComponent(currentUser.id)}`;
            const embeddedParam = `embedded=true`; // ◄◄ ប៉ារ៉ាម៉ែត្រថ្មី
            
            const urlWithParams = `${attendanceBaseUrl}?${userIdParam}&${embeddedParam}`;
            
            if (attendanceIframe) {
                attendanceIframe.src = urlWithParams;
                console.log("Loading iframe with URL:", urlWithParams);
            }
            navigateTo('page-daily-attendance');
        });
    }

    if (elements.closeAttendancePageBtn) {
        elements.closeAttendancePageBtn.addEventListener('click', () => {
            console.log("Closing Daily Attendance page...");
            if (attendanceIframe) {
                // IMPORTANT: Set src to blank to stop the camera
                attendanceIframe.src = 'about:blank';
            }
            navigateTo('page-home');
        });
    }
}

// --- Reusable Searchable Dropdown Logic ---

export function setupSearchableDropdown(inputId, dropdownId, items, onSelectCallback, allowCustom = false) {
    const searchInput = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!searchInput || !dropdown) {
        console.error(`Dropdown elements not found: inputId=${inputId}, dropdownId=${dropdownId}`);
        return;
    }

    function populateDropdown(filter = '') {
        dropdown.innerHTML = '';
        const filteredItems = items.filter(item => item.text && item.text.toLowerCase().includes(filter.toLowerCase()));
        if (filteredItems.length === 0 && !allowCustom && inputId !== 'user-search') {
            dropdown.classList.add('hidden');
            return;
        }

        filteredItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.textContent = item.text;
            itemEl.dataset.value = item.value;
            itemEl.className = 'px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm';
            itemEl.addEventListener('mousedown', (e) => {
                e.preventDefault();
                searchInput.value = item.text;
                dropdown.classList.add('hidden');
                if (onSelectCallback) onSelectCallback(item.value);
                console.log(`Selected dropdown item: ${item.text} (value: ${item.value})`);
            });
            dropdown.appendChild(itemEl);
        });
        dropdown.classList.remove('hidden');
    }

    searchInput.addEventListener('input', () => {
        const currentValue = searchInput.value;
        populateDropdown(currentValue);
        const exactMatch = items.find(item => item.text === currentValue);
        const selection = exactMatch ? exactMatch.value : (allowCustom ? currentValue : null);
        if (onSelectCallback) onSelectCallback(selection);
    });

    searchInput.addEventListener('focus', () => {
        populateDropdown(searchInput.value);
    });

    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            dropdown.classList.add('hidden');
            const currentValue = searchInput.value;
            const validItem = items.find(item => item.text === currentValue);
            if (validItem) {
                if (onSelectCallback) onSelectCallback(validItem.value);
            } else if (allowCustom && currentValue.trim() !== '') {
                if (onSelectCallback) onSelectCallback(currentValue);
            } else if (inputId !== 'user-search') {
                console.log(`Invalid selection on ${inputId}: ${currentValue}`);
                if (onSelectCallback) onSelectCallback(null);
            }
        }, 150);
    });
}

export function populateUserDropdown(users, inputId, dropdownId, onSelectCallback) {
    const userItems = users.filter(user => user.id && user.name).map(user => ({
        text: `${user.id} - ${user.name}`,
        value: user.id
    }));
    setupSearchableDropdown(inputId, dropdownId, userItems, onSelectCallback, false);
}

// --- App Navigation & State Logic ---

export function populateAccountPage(user) {
    if (!user) return;
    if (userPhotoEl && user.photo) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = user.photo;
        img.onload = () => userPhotoEl.src = img.src;
        img.onerror = () => userPhotoEl.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=គ្មានរូប';
    } else if (userPhotoEl) {
        userPhotoEl.src = 'https://placehold.co/100x100/e2e8f0/64748b?text=User';
    }
    if (userNameEl) userNameEl.textContent = user.name || 'មិនមាន';
    if (userIdEl) userIdEl.textContent = user.id || 'មិនមាន';
    if (userGenderEl) userGenderEl.textContent = user.gender || 'មិនមាន';
    if (userGroupEl) userGroupEl.textContent = user.group || 'មិនមាន';
    if (userDepartmentEl) userDepartmentEl.textContent = user.department || 'មិនមាន';
}

export function navigateTo(pageId) {
    console.log("Navigating to page:", pageId);
    pages.forEach(page => {
        const pageEl = document.getElementById(page);
        if (pageEl) pageEl.classList.add('hidden');
    });

    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.remove('hidden');

    if (bottomNav) {
        if (pageId === 'page-request-leave' || pageId === 'page-request-out' || pageId === 'page-daily-attendance') {
            bottomNav.classList.add('hidden');
        } else {
            bottomNav.classList.remove('hidden');
        }
    }

    if (navButtons) {
        navButtons.forEach(btn => {
            if (btn.dataset.page === pageId) {
                btn.classList.add('text-blue-600');
                btn.classList.remove('text-gray-500');
            } else {
                btn.classList.add('text-gray-500');
                btn.classList.remove('text-blue-600');
            }
        });
    }

    if (mainContent) mainContent.scrollTop = 0;
    if (pageId === 'page-history') showHistoryTab('leave');
}

// --- History Page Tabs & Swipe ---
let currentHistoryTab = 'leave';
let touchstartX = 0, touchendX = 0, isSwiping = false;

function showHistoryTab(tabName, fromSwipe = false) {
    if (tabName === currentHistoryTab && !fromSwipe) return;
    console.log(`Switching history tab to: ${tabName}`);
    currentHistoryTab = tabName;

    if (tabName === 'leave') {
        if (historyTabLeave) historyTabLeave.classList.add('border-blue-600', 'text-blue-600');
        if (historyTabLeave) historyTabLeave.classList.remove('border-transparent', 'text-gray-500');
        if (historyTabOut) historyTabOut.classList.add('border-transparent', 'text-gray-500');
        if (historyTabOut) historyTabOut.classList.remove('border-blue-600', 'text-blue-600');
        if (historyContainerLeave) historyContainerLeave.classList.remove('hidden');
        if (historyContainerOut) historyContainerOut.classList.add('hidden');
    } else {
        if (historyTabLeave) historyTabLeave.classList.remove('border-blue-600', 'text-blue-600');
        if (historyTabLeave) historyTabLeave.classList.add('border-transparent', 'text-gray-500');
        if (historyTabOut) historyTabOut.classList.add('border-blue-600', 'text-blue-600');
        if (historyTabOut) historyTabOut.classList.remove('border-transparent', 'text-gray-500');
        if (historyContainerLeave) historyContainerLeave.classList.add('hidden');
        if (historyContainerOut) historyContainerOut.classList.remove('hidden');
    }
    if (historyContent) historyContent.scrollTop = 0;
}

function handleTouchStart(evt) {
    const firstTouch = evt.touches[0];
    touchstartX = firstTouch.clientX;
    isSwiping = true;
}
function handleTouchMove(evt) {
    if (!isSwiping) return;
    const touch = evt.touches[0];
    touchendX = touch.clientX;
}
function handleTouchEnd(evt) {
    if (!isSwiping) return;
    isSwiping = false;
    const threshold = 50;
    const swipedDistance = touchendX - touchstartX;
    if (Math.abs(swipedDistance) > threshold) {
        if (swipedDistance < 0) {
            console.log("Swiped Left");
            showHistoryTab('out', true);
        } else {
            console.log("Swiped Right");
            showHistoryTab('leave', true);
        }
    } else {
        console.log("Swipe distance too short or vertical scroll.");
    }
    touchstartX = 0;
    touchendX = 0;
}
