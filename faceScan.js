//
// 🚀 FILE 4: faceScan.js
// ផ្ទុកនូវ Logic សម្រាប់ Face Scan (Login & Return) និង Geolocation
//

import { showCustomAlert } from './utils.js';
import { allowedAreaCoords, LOCATION_FAILURE_MESSAGE, outRequestsCollectionPath } from './config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Module-scoped variables ---
let db; // To be set by initFaceScan
let userReferenceDescriptor = null;
let faceScanInterval = null;
let currentReturnRequestId = null;

// --- Elements ---
let modelStatusEl, scanFaceBtn, faceScanModal, video, scanStatusEl, scanDebugEl, cancelScanBtn;
let returnScanModal, returnVideo, returnScanStatusEl, returnScanDebugEl, cancelReturnScanBtn;

// --- Callback ---
let onLoginScanSuccess = () => { console.error("onLoginScanSuccess callback not set!"); };


/**
 * Initializes the Face Scan module with necessary DOM elements and dependencies.
 * @param {object} elements - An object containing references to DOM elements.
 * @param {object} dbInstance - The initialized Firestore database instance.
 * @param {function} loginSuccessCallback - Function to call on successful login scan.
 */
export function initFaceScan(elements, dbInstance, loginSuccessCallback) {
    // Assign Elements
    modelStatusEl = elements.modelStatusEl;
    scanFaceBtn = elements.scanFaceBtn;
    faceScanModal = elements.faceScanModal;
    video = elements.video;
    scanStatusEl = elements.scanStatusEl;
    scanDebugEl = elements.scanDebugEl;
    cancelScanBtn = elements.cancelScanBtn;
    returnScanModal = elements.returnScanModal;
    returnVideo = elements.returnVideo;
    returnScanStatusEl = elements.returnScanStatusEl;
    returnScanDebugEl = elements.returnScanDebugEl;
    cancelReturnScanBtn = elements.cancelReturnScanBtn;

    // Assign DB and Callback
    db = dbInstance;
    onLoginScanSuccess = loginSuccessCallback;

    // Attach Event Listeners for modal cancel buttons
    if (cancelScanBtn) cancelScanBtn.addEventListener('click', () => {
        stopFaceScan();
        if (faceScanModal) faceScanModal.classList.add('hidden');
    });

    if (cancelReturnScanBtn) cancelReturnScanBtn.addEventListener('click', () => {
        stopReturnScan(true);
        if (returnScanModal) returnScanModal.classList.add('hidden');
    });
}

/**
 * Loads the face-api.js models.
 */
export async function loadFaceApiModels() {
    if (!modelStatusEl) return;
    try {
        console.log("Loading face-api models...");
        modelStatusEl.textContent = 'កំពុងទាញយក Model ស្កេនមុខ...';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights'),
        ]);
        modelStatusEl.textContent = 'Model ស្កេនមុខបានទាញយករួចរាល់';
        console.log("Face-api models loaded successfully.");
        // The main app.js will handle enabling the scanFaceBtn when a user is selected
    } catch (error) {
        console.error("Error ពេលទាញយក Model របស់ face-api:", error);
        modelStatusEl.textContent = 'Error: មិនអាចទាញយក Model បាន';
    }
}

/**
 * Clears the cached user face descriptor. Called on logout.
 */
export function clearUserReferenceDescriptor() {
    userReferenceDescriptor = null;
    console.log("Cached reference descriptor cleared.");
}

/**
 * Gets the face descriptor for a user, using cache if available.
 * @param {string} userPhotoUrl - The URL of the user's reference photo.
 * @returns {Promise<Float32Array>} - The face descriptor.
 */
async function getReferenceDescriptor(userPhotoUrl) {
    if (userReferenceDescriptor) {
        console.log("Using cached reference descriptor.");
        return userReferenceDescriptor;
    }
    if (!userPhotoUrl) throw new Error("Missing user photo URL");

    console.log("Fetching and computing new reference descriptor...");
    let referenceImage;
    try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = userPhotoUrl;
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (err) => reject(new Error('Failed to fetch (មិនអាចទាញយករូបថតយោងបាន)។ សូមប្រាកដថា Link រូបថតត្រឹមត្រូវ។'));
        });
        referenceImage = img;
    } catch (fetchError) {
        throw fetchError;
    }

    let referenceDetection;
    try {
        const options = new faceapi.TinyFaceDetectorOptions();
        referenceDetection = await faceapi.detectSingleFace(referenceImage, options).withFaceLandmarks(true).withFaceDescriptor();
        if (!referenceDetection) throw new Error('រកមិនឃើញមុខនៅក្នុងរូបថតយោង');
    } catch (descriptorError) {
        console.error("Descriptor Error:", descriptorError);
        throw new Error('មិនអាចវិភាគមុខពីរូបថតយោងបានទេ (រូបថតអាចមិនច្បាស់)។');
    }

    userReferenceDescriptor = referenceDetection.descriptor;
    return userReferenceDescriptor;
}

/**
 * Starts the face scan process for logging in.
 * @param {object} user - The selected user object from allUsersData.
 */
export async function startFaceScan(user) {
    console.log("startFaceScan called.");
    if (!user || !user.photo) {
        showCustomAlert("Error", "មិនអាចទាញយករូបថតយោងរបស់អ្នកបានទេ។ សូមទាក់ទង IT Support។");
        return;
    }

    if (faceScanModal) faceScanModal.classList.remove('hidden');
    if (scanStatusEl) scanStatusEl.textContent = 'កំពុងព្យាយាមបើកកាមេរ៉ា...';

    try {
        if (scanStatusEl) scanStatusEl.textContent = 'កំពុងវិភាគរូបថតយោង...';
        const referenceDescriptor = await getReferenceDescriptor(user.photo);

        if (scanStatusEl) scanStatusEl.textContent = 'កំពុងស្នើសុំបើកកាមេរ៉ា...';
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (video) video.srcObject = stream;
        if (scanStatusEl) scanStatusEl.textContent = 'សូមដាក់មុខរបស់អ្នកឲ្យចំកាមេរ៉ា';

        if (faceScanInterval) clearInterval(faceScanInterval);
        faceScanInterval = setInterval(async () => {
            if (!video || video.readyState < 3) return;
            const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptor();
            if (detections) {
                if (scanStatusEl) scanStatusEl.textContent = 'រកឃើញផ្ទៃមុខ! កំពុងផ្ទៀងផ្ទាត់...';
                const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
                const similarity = (1 - distance).toFixed(2);
                const threshold = 0.55;
                if (scanDebugEl) scanDebugEl.textContent = `ភាពស្រដៀងគ្នា: ${similarity} (ត្រូវតែ > ${1-threshold})`;

                if (distance < threshold) {
                    if (scanStatusEl) scanStatusEl.textContent = 'ផ្ទៀងផ្ទាត់ជោគជ័យ!';
                    stopFaceScan();
                    
                    // Call the success callback for app.js to handle login
                    onLoginScanSuccess(); 
                    
                    setTimeout(() => {
                        if (faceScanModal) faceScanModal.classList.add('hidden');
                    }, 1000);
                } else {
                    if (scanStatusEl) scanStatusEl.textContent = 'មុខមិនត្រឹមត្រូវ... សូមព្យាយាមម្តងទៀត';
                }
            } else {
                if (scanStatusEl) scanStatusEl.textContent = 'រកមិនឃើញផ្ទៃមុខ...';
                if (scanDebugEl) scanDebugEl.textContent = '';
            }
        }, 500);
    } catch (error) {
        console.error("Error during face scan process:", error);
        if (scanStatusEl) scanStatusEl.textContent = `Error: ${error.message}`;
        stopFaceScan();
        setTimeout(() => {
            if (faceScanModal) faceScanModal.classList.add('hidden');
            showCustomAlert("បញ្ហាស្កេនមុខ", `មានបញ្ហា៖\n${error.message}\nសូមប្រាកដថាអ្នកបានអនុញ្ញាតឲ្យប្រើកាមេរ៉ា។`);
        }, 1500);
    }
}

/**
 * Stops the (login) face scan video feed and interval.
 */
function stopFaceScan() {
    if (faceScanInterval) clearInterval(faceScanInterval);
    faceScanInterval = null;
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

// --- RETURN CONFIRMATION LOGIC ---

/**
 * Starts the face scan and location check process for confirming return.
 * @param {string} requestId - The ID of the "out" request.
 * @param {object} currentUser - The currently logged-in user object.
 */
export async function startReturnConfirmation(requestId, currentUser) {
    console.log("startReturnConfirmation called for:", requestId);
    if (!currentUser || !currentUser.photo) {
        showCustomAlert("Error", "មិនអាចទាញយករូបថតយោងរបស់អ្នកបានទេ។");
        return;
    }
    currentReturnRequestId = requestId;

    if (returnScanModal) returnScanModal.classList.remove('hidden');
    if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងព្យាយាមបើកកាមេរ៉ា...';
    if (returnScanDebugEl) returnScanDebugEl.textContent = '';

    try {
        if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងវិភាគរូបថតយោង...';
        const referenceDescriptor = await getReferenceDescriptor(currentUser.photo);

        if (returnScanStatusEl) returnScanStatusEl.textContent = 'កំពុងស្នើសុំបើកកាមេរ៉ា...';
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        if (returnVideo) returnVideo.srcObject = stream;
        if (returnScanStatusEl) returnScanStatusEl.textContent = 'សូមដាក់មុខរបស់អ្នកឲ្យចំកាមេរ៉ា';

        if (faceScanInterval) clearInterval(faceScanInterval);
        faceScanInterval = setInterval(async () => {
            if (!returnVideo || returnVideo.readyState < 3) return;
            const detections = await faceapi.detectSingleFace(returnVideo, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptor();
            if (detections) {
                if (returnScanStatusEl) returnScanStatusEl.textContent = 'រកឃើញផ្ទៃមុខ! កំពុងផ្ទៀងផ្ទាត់...';
                const distance = faceapi.euclideanDistance(referenceDescriptor, detections.descriptor);
                const similarity = (1 - distance).toFixed(2);
                const threshold = 0.55;
                if (returnScanDebugEl) returnScanDebugEl.textContent = `ភាពស្រដៀងគ្នា: ${similarity} (ត្រូវតែ > ${1-threshold})`;

                if (distance < threshold) {
                    if (returnScanStatusEl) returnScanStatusEl.textContent = 'ផ្ទៀងផ្ទាត់មុខ ជោគជ័យ!';
                    stopReturnScan(false); // Don't clear request ID yet
                    handleReturnFaceScanSuccess();
                } else {
                    if (returnScanStatusEl) returnScanStatusEl.textContent = 'មុខមិនត្រឹមត្រូវ... សូមព្យាយាមម្តងទៀត';
                }
            } else {
                if (returnScanStatusEl) returnScanStatusEl.textContent = 'រកមិនឃើញផ្ទៃមុខ...';
                if (returnScanDebugEl) returnScanDebugEl.textContent = '';
            }
        }, 500);
    } catch (error) {
        console.error("Error during return scan process:", error);
        if (returnScanStatusEl) returnScanStatusEl.textContent = `Error: ${error.message}`;
        stopReturnScan(true); // Clear request ID on error
        setTimeout(() => {
            if (returnScanModal) returnScanModal.classList.add('hidden');
            showCustomAlert("បញ្ហាស្កេនមុខ", `មានបញ្ហា៖\n${error.message}\nសូមប្រាកដថាអ្នកបានអនុញ្ញាតឲ្យប្រើកាមេរ៉ា។`);
        }, 1500);
    }
}

/**
 * Stops the (return) face scan video feed and interval.
 * @param {boolean} [clearId=true] - Whether to clear the currentReturnRequestId.
 */
function stopReturnScan(clearId = true) {
    if (faceScanInterval) clearInterval(faceScanInterval);
    faceScanInterval = null;
    if (returnVideo && returnVideo.srcObject) {
        returnVideo.srcObject.getTracks().forEach(track => track.stop());
        returnVideo.srcObject = null;
    }
    if (clearId) currentReturnRequestId = null;
}

/**
 * Called after successful return face scan to start geolocation check.
 */
function handleReturnFaceScanSuccess() {
    if (returnScanStatusEl) returnScanStatusEl.textContent = 'ស្កេនមុខជោគជ័យ!\nកំពុងស្នើសុំទីតាំង...';
    if (returnScanDebugEl) returnScanDebugEl.textContent = 'សូមអនុញ្ញាតឲ្យប្រើ Location';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            onLocationSuccess,
            onLocationError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        console.error("Geolocation is not supported.");
        showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE);
        if (returnScanModal) returnScanModal.classList.add('hidden');
        currentReturnRequestId = null;
    }
}

/**
 * Geolocation success callback. Checks if user is within the allowed area.
 * @param {object} position - The geolocation position object.
 */
async function onLocationSuccess(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    console.log(`Location found: ${userLat}, ${userLng}`);

    if (returnScanStatusEl) returnScanStatusEl.textContent = 'បានទីតាំង! កំពុងពិនិត្យ...';
    if (returnScanDebugEl) returnScanDebugEl.textContent = `Lat: ${userLat.toFixed(6)}, Lng: ${userLng.toFixed(6)}`;

    const isInside = isPointInPolygon([userLat, userLng], allowedAreaCoords);

    if (isInside) {
        console.log("User is INSIDE.");
        if (returnScanStatusEl) returnScanStatusEl.textContent = 'ទីតាំងត្រឹមត្រូវ! កំពុងរក្សាទុក...';
        await updateReturnStatusInFirestore();
    } else {
        console.log("User is OUTSIDE.");
        if (returnScanStatusEl) returnScanStatusEl.textContent = 'ទីតាំងមិនត្រឹមត្រូវ។';
        showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE);
        if (returnScanModal) returnScanModal.classList.add('hidden');
        currentReturnRequestId = null;
    }
}

/**
 * Geolocation error callback.
 * @param {object} error - The geolocation error object.
 */
function onLocationError(error) {
    console.error(`Geolocation Error (${error.code}): ${error.message}`);
    if (returnScanStatusEl) returnScanStatusEl.textContent = 'មិនអាចទាញយកទីតាំងបានទេ។';
    showCustomAlert("បញ្ហាទីតាំង", LOCATION_FAILURE_MESSAGE);
    if (returnScanModal) returnScanModal.classList.add('hidden');
    currentReturnRequestId = null;
}

/**
 * Updates the Firestore document with the return status.
 */
async function updateReturnStatusInFirestore() {
    if (!currentReturnRequestId) {
        console.error("Cannot update return status: No request ID");
        return;
    }
    if (!db || !outRequestsCollectionPath) {
        console.error("Cannot update return status: DB or Collection Path not set.");
        return;
    }

    try {
        const docRef = doc(db, outRequestsCollectionPath, currentReturnRequestId);
        const now = new Date();
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const returnedAtString = `${time} ${date}`;

        await updateDoc(docRef, {
            returnStatus: "បានចូលមកវិញ",
            returnedAt: returnedAtString
        });

        console.log("Return status updated successfully.");
        showCustomAlert("ជោគជ័យ!", "បញ្ជាក់ការចូលមកវិញ បានជោគជ័យ!", "success");
    } catch (e) {
        console.error("Error updating Firestore return status:", e);
        showCustomAlert("Error", `មានបញ្ហាពេលរក្សាទុក: ${e.message}`);
    } finally {
        if (returnScanModal) returnScanModal.classList.add('hidden');
        currentReturnRequestId = null;
    }
}

/**
 * Helper function to check if a point is inside a polygon.
 * @param {number[]} point - [latitude, longitude]
 * @param {number[][]} polygon - Array of [lat, lng] points
 * @returns {boolean}
 */
function isPointInPolygon(point, polygon) {
    const [lat, lng] = point;
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [lat_i, lng_i] = polygon[i];
        const [lat_j, lng_j] = polygon[j];
        const intersect = ((lng_i > lng) !== (lng_j > lng)) && (lat < (lat_j - lat_i) * (lng - lng_i) / (lng_j - lng_i) + lat_i);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}
