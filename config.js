//
// 🚀 FILE 1: config.js
// ផ្ទុកនូវ Constants និង Configurations ទាំងអស់
//

// --- Hard-coded Firebase Config ---
export const firebaseConfig = {
    apiKey: "AIzaSyDjr_Ha2RxOWEumjEeSdluIW3JmyM76mVk",
    authDomain: "dipermisstion.firebaseapp.com",
    projectId: "dipermisstion",
    storageBucket: "dipermisstion.firebasestorage.app",
    messagingSenderId: "512999406057",
    appId: "1:512999406057:web:953a281ab9dde7a9a0f378",
    measurementId: "G-KDPHXZ7H4B"
};

// --- Google Sheet Config ---
export const SHEET_ID = '1_Kgl8UQXRsVATt_BOHYQjVWYKkRIBA12R-qnsBoSUzc';
export const SHEET_NAME = 'បញ្ជឺឈ្មោះរួម';
export const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_NAME)}&tq=${encodeURIComponent('SELECT E, L, AA, N, G, S WHERE E IS NOT NULL OFFSET 0')}`;

// --- Telegram Config ---
export const BOT_TOKEN = '8284240201:AAEDRGHDcuoQAhkWk7km6I-9csZNbReOPHw';
export const CHAT_ID = '1487065922';

// --- Location Config ---
export const allowedAreaCoords = [
    [11.417052769150015, 104.76508285291308],
    [11.417130005964497, 104.76457396198742],
    [11.413876386899489, 104.76320488118378],
    [11.41373800267192, 104.76361527709159]
];
export const LOCATION_FAILURE_MESSAGE = "ការបញ្ជាក់ចូលមកវិញ បរាជ័យ។ \n\nប្រហែលទូរស័ព្ទអ្នកមានបញ្ហា ការកំណត់បើ Live Location ដូច្នោះអ្នកមានជម្រើសមួយទៀតគឺអ្នកអាចទៅបញ្ជាក់ដោយផ្ទាល់នៅការិយាល័យអគារ B ជាមួយក្រុមការងារលោកគ្រូ ដារ៉ូ។";

// --- Collection Paths (will be set in app.js) ---
export let leaveRequestsCollectionPath;
export let outRequestsCollectionPath;

// --- Function to set collection paths ---
export function setCollectionPaths(canvasAppId) {
    leaveRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/leave_requests`;
    outRequestsCollectionPath = `/artifacts/${canvasAppId}/public/data/out_requests`;
    console.log("Using Firestore Leave Path:", leaveRequestsCollectionPath);
    console.log("Using Firestore Out Path:", outRequestsCollectionPath);
}

// --- Duration/Reason Constants ---
export const leaveDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយយប់", "មួយថ្ងៃ", "មួយថ្ងៃកន្លះ", "ពីរថ្ងៃ", "ពីរថ្ងៃកន្លះ", "បីថ្ងៃ", "បីថ្ងៃកន្លះ", "បួនថ្ងៃ", "បួនថ្ងៃកន្លះ", "ប្រាំថ្ងៃ", "ប្រាំថ្ងៃកន្លះ", "ប្រាំមួយថ្ងៃ", "ប្រាំមួយថ្ងៃកន្លះ", "ប្រាំពីរថ្ងៃ"];
export const leaveDurationItems = leaveDurations.map(d => ({ text: d, value: d }));
export const leaveReasons = ["ឈឺក្បាល", "ចុកពោះ", "គ្រុនក្ដៅ", "ផ្ដាសាយ"];
export const leaveReasonItems = leaveReasons.map(r => ({ text: r, value: r }));
export const singleDayLeaveDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយយប់", "មួយថ្ងៃ"];

export const outDurations = ["មួយព្រឹក", "មួយរសៀល", "មួយថ្ងៃ"];
export const outDurationItems = outDurations.map(d => ({ text: d, value: d }));
export const outReasons = ["ទៅផ្សារ", "ទៅកាត់សក់", "ទៅភ្នំពេញ", "ទៅពេទ្យ", "ទៅយកអីវ៉ាន់"];
export const outReasonItems = outReasons.map(r => ({ text: r, value: r }));

export const durationToDaysMap = {
    "មួយថ្ងៃកន្លះ": 1.5,
    "ពីរថ្ងៃ": 2,
    "ពីរថ្ងៃកន្លះ": 2.5,
    "បីថ្ងៃ": 3,
    "បីថ្ងៃកន្លះ": 3.5,
    "បួនថ្ងៃ": 4,
    "បួនថ្ងៃកន្លះ": 4.5,
    "ប្រាំថ្ងៃ": 5,
    "ប្រាំថ្ងៃកន្លះ": 5.5,
    "ប្រាំមួយថ្ងៃ": 6,
    "ប្រាំមួយថ្ងៃកន្លះ": 6.5,
    "ប្រាំពីរថ្ងៃ": 7
};
