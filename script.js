// ==========================================
// 1. Firebase Configuration & Utils
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAFhdaf6PrmlOCal_ebWk7ZKCu1aepJ8GY",
    authDomain: "stem-battle.firebaseapp.com",
    projectId: "stem-battle",
    storageBucket: "stem-battle.firebasestorage.app",
    messagingSenderId: "89780358864",
    appId: "1:89780358864:web:4e5c1d15b6bc818c5d18d5"
};

let db;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
} else {
    console.warn("Firebase is not connected yet! Running locally.");
}

function showToast(message, type="info") {
    const tc = document.getElementById('toast-container');
    if(!tc) return;
    const toast = document.createElement('div');
    
    let icon = '<i class="fas fa-info-circle"></i>';
    if(type === 'success') icon = '<i class="fas fa-check-circle"></i>';
    if(type === 'error') icon = '<i class="fas fa-exclamation-triangle"></i>';
    if(type === 'challenge') icon = '<i class="fas fa-crosshairs"></i>';

    toast.className = `toast ${type}`;
    toast.innerHTML = `${icon} <span>${message}</span>`;
    
    tc.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease-in reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, type === 'challenge' ? 8000 : 4000);
}

// ==========================================
// 2. Data Models, Time & Constants
// ==========================================
let currentUser = null;

function getEgyptBattleDate() {
    let now = new Date();
    now.setHours(now.getHours() - 2); 
    return now.toISOString().split('T')[0];
}

let todayStr = getEgyptBattleDate();
let currentDate = todayStr;

const masterTaskTypes = [
    { key: 'URT_Pieces', label: 'قطعة URT' },
    { key: 'URT_Full', label: 'امتحان URT كامل' },
    { key: 'TOC_Normal', label: 'شيت TOC (عادي)' },
    { key: 'TOC_Essay', label: 'شيت TOC (مقال)' },
    { key: 'Sessions', label: 'مذاكرة سيشن' },
    { key: 'Essay_Writing', label: 'تعبير / Essay' },
    { key: 'Vocab', label: 'حفظ كلمات (الكلمة = 2 نقطة)' }
];

const subjectsList = ['Arabic', 'English', 'German', 'French', 'Math', 'Mechanics', 'Physics', 'Chemistry', 'Biology', 'Geo'];

const finalsCurriculum = {
    'Arabic': {
        'النصوص': ['غربة وحنين', 'المساء', 'النسور', 'رثاء مي', 'من أنت يا نفس', 'أهواك يا وطني', 'الكنيسة نورت'],
        'الأدب (المدارس)': ['الواقعية', 'المهاجر', 'الرومانتيكية', 'الكلاسيكية', 'الديوان', 'أبولو'],
        'النحو': ['الوحدة الأولى', 'الوحدة الثانية', 'الوحدة الثالثة', 'الوحدة الرابعة', 'الوحدة الخامسة', 'الوحدة السادسة', 'الوحدة السابعة'],
        'البلاغة': ['مراجعة بلاغة شاملة']
    },
    'English': {
        'Vocab': ['Upstream Unit 1', 'Upstream Unit 2', 'Upstream Unit 4', 'Upstream Unit 7', 'Upstream Unit 8', 'Sec School U1', 'Sec School U2', 'Sec School U3', 'Sec School U4', 'Sec School U5', 'Sec School U6', 'Sec School U7', 'Sec School U8', 'Sec School U9', 'Sec School U10', 'Sec School U11', 'Sec School U12'],
        'Grammar': ['Upstream Unit 1', 'Upstream Unit 2', 'Upstream Unit 4', 'Upstream Unit 7', 'Upstream Unit 8', 'Sec School U1', 'Sec School U2', 'Sec School U3', 'Sec School U4', 'Sec School U5', 'Sec School U6', 'Sec School U7', 'Sec School U8', 'Sec School U9', 'Sec School U10', 'Sec School U11', 'Sec School U12']
    },
    'Languages': {
        'Grammar': ['Lektion/Unit 1', 'Lektion/Unit 2', 'Lektion/Unit 3', 'Lektion/Unit 4', 'Lektion/Unit 5', 'Lektion/Unit 6'],
        'Vocab': ['Lektion/Unit 1', 'Lektion/Unit 2', 'Lektion/Unit 3', 'Lektion/Unit 4', 'Lektion/Unit 5', 'Lektion/Unit 6']
    }
};

const defaultSubjects = {};
subjectsList.forEach(sub => {
    defaultSubjects[sub] = { URT_Pieces: 0, URT_Full: 0, TOC_Normal: 0, TOC_Essay: 0, Essay_Writing: 0, Sessions: 0, Expression: 0, Vocab: 0 };
});

const defaultSpiritual = {
    'صلاة الفجر': { done: false, delay: 0, type: 'fard' },
    'صلاة الصبح': { done: false, delay: 0, type: 'fard' },
    'صلاة الظهر': { done: false, delay: 0, type: 'fard' },
    'صلاة العصر': { done: false, delay: 0, type: 'fard' },
    'صلاة المغرب': { done: false, delay: 0, type: 'fard' },
    'صلاة العشاء': { done: false, delay: 0, type: 'fard' },
    'نافلة الظهر': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة الفجر': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة المغرب': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'نافلة العشاء': { done: false, delay: 0, rakat: 0, type: 'nafl' },
    'قيام الليل': { done: false, delay: 0, rakat: 0, type: 'qiyam' },
    'الورد (قرآن)': { done: false, delay: 0, type: 'wird' },
    'الحديث': { done: false, delay: 0, type: 'fard' }
};
let localData = {
    points: 0,
    subjects: JSON.parse(JSON.stringify(defaultSubjects)),
    spiritual: JSON.parse(JSON.stringify(defaultSpiritual)),
    dailySelection: [], 
    customTaskStates: {} 
};

let partnerData = { subjects: {}, customTaskStates: {} }; 
let sharedCustomTasks = []; 
let sharedExams = []; 
let sharedProjects = []; 
let activeExamData = null;

let materialsUnsubscribe = null;
let currentMaterialSubject = "";
const storage = firebase.storage(); 

let examTimerInterval = null;
let myFlashcards = [];
let dueFlashcards = [];
let currentStudyIndex = 0;
let activeFCQuiz = null;
let pomodoroInterval = null;
let pomodoroTimeLeft = 0;

let charts = { radar: null, bar: null, doughnut: null };
let unsubscribeShared = null; 
let unsubscribePartner = null; 
let unsubscribeCustom = null;
let unsubscribeExams = null;
let unsubscribeFlashcards = null;
let unsubscribeProjects = null;
let unsubscribePartnerStatus = null;
let unsubscribeMyChallenge = null;

// ==========================================
// 3. Login & Navigation
// ==========================================
function login(user) {
    currentUser = user;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('current-user-name').innerText = user.toUpperCase();
    
    const quoteEl = document.getElementById('quote-personal');
    if(user === 'Mamdouh') {
        quoteEl.innerText = "فَاسْتَجَابَ لَهُمْ رَبُّهُمْ";
    } else {
        quoteEl.innerText = "رَّبِّ أَدْخِلْنِي مُدْخَلَ صِدْقٍ وَأَخْرِجْنِي مُخْرَجَ صِدْقٍ";
    }

    let savedKey = localStorage.getItem('ai_api_key');
    if(savedKey) {
        document.getElementById('ai-api-key').value = savedKey;
        document.getElementById('api-key-section').classList.add('hidden');
        document.getElementById('exam-creator-section').classList.remove('hidden');
    }

    fetchData(todayStr);
    startChatEngine(); // تشغيل الشات تلقائياً مع الدخول
    showToast(`System Initialized. Welcome Commander ${user}!`, 'info');
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active', 'cyan-border', 'orange-border', 'magenta-border');
        b.style.borderBottom = "none";
    });

    document.getElementById(tabId).classList.remove('hidden');
    if(btnElement) btnElement.classList.add('active');
    
    if(tabId === 'view-dashboard' && btnElement) btnElement.classList.add('cyan-border');
    if(tabId === 'view-history' && btnElement) btnElement.classList.add('orange-border');
    if(tabId === 'view-exams' && btnElement) btnElement.classList.add('magenta-border');
    if(tabId === 'view-flashcards' && btnElement) btnElement.style.borderBottom = "3px solid var(--cyan)";
    if(tabId === 'view-lab' && btnElement) btnElement.style.borderBottom = "3px solid #00E5FF";
    if(tabId === 'view-kanban' && btnElement) btnElement.style.borderBottom = "3px solid #00E676";
    if(tabId === 'view-leaderboard') {
        if(btnElement) btnElement.classList.add('cyan-border');
        loadLeaderboard('today');
    }
}

// ==========================================
// 4. Firebase Data Fetching & Sync
// ==========================================
async function fetchData(dateStr) {
    if(!db) return renderUI();
    
    // Fetch Local Data
    const docRef = db.collection('users').doc(currentUser).collection('daily_records').doc(dateStr);
    const doc = await docRef.get();
    
if (doc.exists) {
        let dbData = doc.data();
        localData.points = dbData.points || 0;
        localData.subjects = { ...JSON.parse(JSON.stringify(defaultSubjects)), ...(dbData.subjects || {}) };
        
        // 🟢 المترجم السحري المُعدل (قاتل العفاريت القديمة) 🟢
        let fetchedSpiritual = dbData.spiritual || {};
        const keyMap = {
            'Fajr': 'صلاة الفجر', 'Sobh': 'صلاة الصبح', 'Dhuhr': 'صلاة الظهر',
            'Asr': 'صلاة العصر', 'Maghrib': 'صلاة المغرب', 'Isha': 'صلاة العشاء',
            'Wird': 'الورد (قرآن)', 'Hadith': 'الحديث'
        };
        
        Object.keys(keyMap).forEach(oldKey => {
            if (fetchedSpiritual[oldKey] !== undefined) {
                // لو الصلاة بالعربي لسه متسجلتش، انقل بتاعت الإنجليزي مكانها
                if (fetchedSpiritual[keyMap[oldKey]] === undefined) {
                    fetchedSpiritual[keyMap[oldKey]] = fetchedSpiritual[oldKey];
                }
                // امسح الإنجليزي عشان ميقرفناش ويمسح الجديد
                delete fetchedSpiritual[oldKey];
            }
        });

        localData.spiritual = { ...JSON.parse(JSON.stringify(defaultSpiritual)), ...fetchedSpiritual };
        localData.customTaskStates = dbData.customTaskStates || {};
    } else {
        localData.points = 0;
        localData.subjects = JSON.parse(JSON.stringify(defaultSubjects));
        localData.spiritual = JSON.parse(JSON.stringify(defaultSpiritual));
        localData.customTaskStates = {};
    }

    let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
    
    // Partner Daily Data
    if(unsubscribePartner) unsubscribePartner();
    unsubscribePartner = db.collection('users').doc(partnerUser).collection('daily_records').doc(dateStr).onSnapshot(pDoc => {
        if(pDoc.exists) partnerData = pDoc.data();
        else partnerData = { subjects: {}, customTaskStates: {} };
        renderSharedPoll(); 
        renderSharedCustomTasks();
    });

    // Partner Focus Status
    if(unsubscribePartnerStatus) unsubscribePartnerStatus();
    unsubscribePartnerStatus = db.collection('users').doc(partnerUser).onSnapshot(snap => {
        if(snap.exists) {
            let pStatus = snap.data().isFocusing;
            const banner = document.getElementById('partner-sync-banner');
            const bannerText = document.getElementById('sync-banner-text');
            if(banner && bannerText) {
                if(pStatus) {
                    bannerText.innerText = `${partnerUser} is in Deep Work Mode 🧠!`;
                    banner.classList.remove('hidden');
                } else {
                    banner.classList.add('hidden');
                }
            }
        }
    });

    // My Pending Challenges
    if(unsubscribeMyChallenge) unsubscribeMyChallenge();
    unsubscribeMyChallenge = db.collection('users').doc(currentUser).onSnapshot(snap => {
        if(snap.exists) {
            let data = snap.data();
            let descEl = document.getElementById('challenge-desc');
            let modal = document.getElementById('challenge-modal');
            if(data.pendingChallenge && descEl && modal) {
                descEl.innerText = `${partnerUser} challenged you to: ${data.pendingChallenge.examTitle}! 🥊`;
                modal.classList.remove('hidden');
                modal.dataset.examId = data.pendingChallenge.examId;
            }
        }
    });

    // Shared Polls
    if(unsubscribeShared) unsubscribeShared(); 
    unsubscribeShared = db.collection('shared_polls').doc(dateStr).onSnapshot((sharedDoc) => {
        if(sharedDoc.exists) localData.dailySelection = sharedDoc.data().tasks || [];
        else localData.dailySelection = [];
        renderSharedPoll();
        populateExamTaskDropdown(); 
    });

    // Shared Missions
    if(unsubscribeCustom) unsubscribeCustom();
    unsubscribeCustom = db.collection('shared_custom_tasks').doc(dateStr).onSnapshot((customDoc) => {
        if(customDoc.exists) sharedCustomTasks = customDoc.data().tasks || [];
        else sharedCustomTasks = [];
        renderSharedCustomTasks();
    });

    // Shared Exams
    if(unsubscribeExams) unsubscribeExams();
    unsubscribeExams = db.collection('shared_exams').orderBy('createdAt', 'desc').onSnapshot(snap => {
        sharedExams = [];
        snap.forEach(doc => sharedExams.push({id: doc.id, ...doc.data()}));
        renderExamsList();
    });

    // Neural Flashcards
    if(unsubscribeFlashcards) unsubscribeFlashcards();
    unsubscribeFlashcards = db.collection('users').doc(currentUser).collection('flashcards').onSnapshot(snap => {
        myFlashcards = [];
        snap.forEach(doc => myFlashcards.push({id: doc.id, ...doc.data()}));
        checkDueFlashcards();
    });

    // Kanban Projects
    if(unsubscribeProjects) unsubscribeProjects();
    unsubscribeProjects = db.collection('shared_projects').orderBy('createdAt', 'desc').onSnapshot(snap => {
        sharedProjects = [];
        snap.forEach(doc => sharedProjects.push({id: doc.id, ...doc.data()}));
        renderKanban();
    });

    // استماع لإشعارات الشات فقط
    db.collection('users').doc(currentUser).onSnapshot(snap => {
        if(snap.exists && snap.data().pendingChatAlert) {
            let alertData = snap.data().pendingChatAlert;
            showToast(`New msg from ${alertData.from}: ${alertData.msg}`, "info");
            db.collection('users').doc(currentUser).set({ pendingChatAlert: null }, { merge: true });
        }
    });

    renderUI();
}

async function saveToDB() {
    calculatePoints();
    if(!db) return;
    const docRef = db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate);
    await docRef.set({
        points: localData.points,
        subjects: localData.subjects,
        spiritual: localData.spiritual,
        customTaskStates: localData.customTaskStates
    }, { merge: true });
}

function calculatePoints() {
    let total = 0;
    for (const [sub, tasks] of Object.entries(localData.subjects)) {
        
        for (const [taskKey, count] of Object.entries(tasks)) {
            if(count === 0) continue;

            // 🧪 حساب المهام العلمية المنفصلة للـ URT
            if (taskKey.startsWith('SciStd_')) {
                if (taskKey === 'SciStd_URT_Full') total += count * 500;
                else if (taskKey === 'SciStd_URT_Piece') total += count * 50;
                else if (taskKey === 'SciStd_Session_URT') total += count * 50;
            }
            // 🧪 حساب باقي المهام العلمية المدمجة (TOC / Sessions)
            else if (taskKey.startsWith('Sci_')) {
                let parts = taskKey.split('_'); 
                let mode = parts[2];
                if (mode && mode.includes('Session')) total += count * 50; // سيشن TOC أو شرح = 50
                else if (mode === 'SelfTOC') total += count * 1; // TOC عادي
            }
            // 📖 حساب نقاط اللغة العربية الأساسية
            else if (taskKey.startsWith('Arb_')) {
                if(taskKey.includes('URTFull')) total += count * 1000;
                else if(taskKey.includes('URTPiece')) total += count * 100;
                else if(taskKey.includes('TOCNormal')) total += count * 2;
                else if(taskKey.includes('Expression')) total += count * 50;
            }
            // 💬 حساب نقاط اللغات (انجلش ولغات) الأساسية
            else if (taskKey.startsWith('Lang_')) {
                if(taskKey.includes('URTFull')) total += count * 1000;
                else if(taskKey.includes('URTPiece')) total += count * 100;
                else if(taskKey.includes('TOCNormal')) total += count * 2;
                else if(taskKey.includes('Essay')) total += count * 50;
                else if(taskKey.includes('Vocab')) total += count * 2; 
            }
            // ⚙️ المهام المتقدمة (المنهج العربي واللغات)
            else if (taskKey.startsWith('Adv_')) {
                let parts = taskKey.split('_'); 
                let subj = parts[1];
                let cat = parts[2];
                let mode = parts[4]; 

                if (subj === 'Arabic') {
                    if (cat === 'النصوص') total += count * (mode === 'Session' ? 70 : 200);
                    else if (cat === 'الأدب (المدارس)') total += count * (mode === 'Session' ? 100 : 350);
                    else if (cat === 'النحو') total += count * (mode === 'Session' ? 100 : 120);
                    else if (cat === 'البلاغة') total += count * 300;
                } else if (subj === 'English' || subj === 'German' || subj === 'French') {
                    if (mode === 'Session') total += count * 400;
                    else if (cat === 'Grammar') total += count * 150;
                    else if (cat === 'Vocab') total += count * 350; 
                }
            }
        }
    }
    
    // 🕌 نقاط الروحانيات والنوافل والقيام 
    for (const [key, data] of Object.entries(localData.spiritual)) {
        if (data.done) {
            let base = 25; 
            if (data.type === 'wird') base = 200; 
            else if (key === 'الحديث') base = 40;
            else if (data.type === 'nafl') base = (data.rakat || 0) * 15; 
            else if (data.type === 'qiyam') base = (data.rakat || 0) * 100; 

            if (data.delay === 0) total += base;
            else if (data.delay === 1) total += Math.floor(base * 0.7);
            else if (data.delay === 2) total += Math.floor(base * 0.5);
            else if (data.delay === 3) total += Math.floor(base * 0.4);
        }
    }
    
    sharedCustomTasks.forEach(ct => {
        if(localData.customTaskStates[ct.id]) total += parseInt(ct.points);
    });

    localData.points = total;
    if(currentDate === todayStr) {
        let el = document.getElementById('header-score');
        if(el) el.innerText = total;
    }
}

// ==========================================
// 4.5 POMODORO SYNC ENGINE
// ==========================================
function startPomodoro() {
    let mins = document.getElementById('pomo-minutes').value;
    if(!mins || mins <= 0) return showToast("Enter a valid time.", "error");

    pomodoroTimeLeft = parseInt(mins) * 60;
    document.getElementById('pomo-setup').classList.add('hidden');
    document.getElementById('pomo-running').classList.remove('hidden');
    
    if(db) db.collection('users').doc(currentUser).set({ isFocusing: true }, { merge: true });
    showToast("Deep Work Mode Activated. Let's go!", "success");

    pomodoroInterval = setInterval(() => {
        let m = Math.floor(pomodoroTimeLeft / 60);
        let s = pomodoroTimeLeft % 60;
        document.getElementById('pomo-timer-display').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        if(pomodoroTimeLeft <= 0) stopPomodoro(true);
        pomodoroTimeLeft--;
    }, 1000);
}

function stopPomodoro(finished = false) {
    clearInterval(pomodoroInterval);
    document.getElementById('pomo-running').classList.add('hidden');
    document.getElementById('pomo-setup').classList.remove('hidden');
    
    if(db) db.collection('users').doc(currentUser).set({ isFocusing: false }, { merge: true });
    
    if(finished) {
        showToast("Session Finished! You earned 50 Points.", "success");
        localData.points += 50;
        saveToDB();
    } else {
        showToast("Session aborted.", "info");
    }
}

// ==========================================
// 5. Shared Poll Logic
// ==========================================
function openSelectorModal() {
    const container = document.getElementById('master-task-selector');
    container.innerHTML = '<h4 class="text-center text-cyan mb-10">اختر المادة / Select Subject</h4><div id="subject-btns" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;"></div><div id="adv-menu-area" class="mt-20"></div>';

    const btnsArea = document.getElementById('subject-btns');
    subjectsList.forEach(sub => {
        let btn = document.createElement('button');
        btn.className = 'btn-primary-small';
        btn.innerText = sub;
        btn.onclick = () => renderAdvancedMenu(sub);
        btnsArea.appendChild(btn);
    });
    document.getElementById('selector-modal').classList.remove('hidden');
}

// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
// 🟢 دالة مساعدة لجمع المهام العلمية
window.addScientificTask = function(subject) {
    const modeSelect = document.getElementById('sci-mode-select');
    const mode = modeSelect.value;
    const modeLabel = modeSelect.options[modeSelect.selectedIndex].text;
    
    const checkboxes = document.querySelectorAll('#sci-topics-area input:checked');
    let selectedTopics = Array.from(checkboxes).map(cb => cb.value).join(' + ');
    
    if(!selectedTopics) return showToast('Please select at least one Target (or General Revision)!', 'error'); 

    const key = `Sci_${subject}_${mode}_${selectedTopics.replace(/\s/g,'')}`;
    const label = `${subject} | ${modeLabel} [${selectedTopics}]`;
    addToSharedPoll(subject, key, label);
};

function renderAdvancedMenu(subject) {
    const area = document.getElementById('adv-menu-area');
    area.innerHTML = `<h4 class="text-orange mb-10 border-top pt-10 text-center">${subject} Menu</h4>`;

    // 🟢 مصنع الزراير السحرية (بيخلي أي زرار ينور أخضر)
    const createMagicButton = (text, onClickCallback) => {
        let btn = document.createElement('button');
        btn.className = 'selector-item-btn';
        btn.style.margin = '3px';
        btn.innerText = text;
        btn.onclick = function() {
            onClickCallback();
            this.style.background = 'var(--success)';
            this.style.color = '#000';
            this.innerText = '✔ ' + text.replace('+ ', '');
            this.disabled = true;
        };
        return btn;
    };

    // ==========================================
    // 🧪 1. نظام المواد العلمية
    // ==========================================
    if (['Physics', 'Chemistry', 'Math', 'Mechanics', 'Biology', 'Geo'].includes(subject)) {
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; direction: ltr;">
                <h5 class="text-cyan mb-10">1. Select Mode (Study & TOC Only):</h5>
                <select id="sci-mode-select" class="input-dark w-100 mb-15" style="padding:8px; font-size:14px;">
                    <option value="StudySession">Study Session (50 pts)</option>
                    <option value="SolveSessionTOC">Solve Session TOC (50 pts)</option>
                    <option value="SelfTOC">Solve TOC (Self)</option>
                </select>

                <h5 class="text-cyan mb-10">2. Select Targets (Multi-select allowed):</h5>
                <div id="sci-topics-area" style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:5px;">
                </div>
                <button class="btn-primary w-100" onclick="addScientificTask('${subject}')">Add ${subject} Task</button>
            </div>
            
            <h5 class="text-warning mt-20 mb-10 text-center">${subject} URT Tasks</h5>
            <div id="sci-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:ltr;"></div>
        `;
        
        const topicsArea = document.getElementById('sci-topics-area');
        topicsArea.innerHTML += `<label style="color:#ffcc00; cursor:pointer; font-weight:bold; margin-right: 15px;"><input type="checkbox" value="General Revision"> General Revision</label>`;
        
        if (subject === 'Physics') {
            for(let i=1; i<=14; i++) topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="LO ${i}"> LO ${i}</label>`;
        } else if (subject === 'Chemistry') {
            for(let i=1; i<=4; i++) topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="Mod ${i}"> Module ${i}</label>`;
        } else {
            ['Sec 3 Term 1', 'Sec 3 Term 2', 'Grade 10 (URT)', 'Grade 11 (URT)'].forEach(t => {
                topicsArea.innerHTML += `<label style="color:#fff; cursor:pointer;"><input type="checkbox" value="${t}"> ${t}</label>`;
            });
        }

        const stdArea = document.getElementById('sci-standard-area');
        [
            {k: 'SciStd_URT_Piece', txt: '+ URT Piece', lbl: `${subject} - URT Piece (Self)`},
            {k: 'SciStd_URT_Full', txt: '+ Full URT Exam', lbl: `${subject} - Full URT Exam (Self)`},
            {k: 'SciStd_Session_URT', txt: '+ Solve Session URT', lbl: `${subject} - Solve Session URT`}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll(subject, task.k, task.lbl)));
        });
    } 
    // ==========================================
    // 📖 2. نظام اللغة العربية
    // ==========================================
    else if (subject === 'Arabic') {
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: right; direction: rtl;">
                <label style="display:flex; align-items:center; justify-content:center; cursor:pointer; color:#E040FB; font-weight:bold; font-size: 16px;">
                    <input type="checkbox" id="is-session-check" style="margin-left:10px; transform:scale(1.5);">
                    ذاكرتها من سيشن؟
                </label>
            </div>
            <div id="arabic-dynamic-area"></div>
            <h5 class="text-warning mt-20 mb-10 text-center">المهام الأساسية (عربي)</h5>
            <div id="arb-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:rtl;"></div>
        `;

        let dynamicArea = document.getElementById('arabic-dynamic-area');
        let cur = finalsCurriculum['Arabic'];
        for (const [category, lessons] of Object.entries(cur)) {
            let catDiv = document.createElement('div');
            catDiv.style.marginBottom = '15px';
            catDiv.style.direction = 'rtl';
            catDiv.style.textAlign = 'right';
            catDiv.innerHTML = `<strong class="text-cyan" style="display:block; margin-bottom:8px;">${category}</strong>`;
            lessons.forEach(les => {
                catDiv.appendChild(createMagicButton(`+ ${les}`, () => {
                    let isSession = document.getElementById('is-session-check') ? document.getElementById('is-session-check').checked : false;
                    addToSharedPoll('Arabic', `Adv_Arabic_${category}_${les}_${isSession?'Session':'Self'}`, `عربي | ${category}: ${les} (${isSession?'سيشن':'مذاكرة'})`);
                }));
            });
            dynamicArea.appendChild(catDiv);
        }

        const stdArea = document.getElementById('arb-standard-area');
        [
            {k: 'Arb_URTPiece', txt: '+ حل قطعة URT', lbl: 'عربي - قطعة URT'},
            {k: 'Arb_URTFull', txt: '+ حل امتحان URT كامل', lbl: 'عربي - امتحان URT كامل'},
            {k: 'Arb_TOCNormal', txt: '+ شيت TOC', lbl: 'عربي - شيت TOC'},
            {k: 'Arb_Expression', txt: '+ موضوع تعبير', lbl: 'عربي - موضوع تعبير'}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll('Arabic', task.k, task.lbl)));
        });
    } 
    // ==========================================
    // 💬 3. نظام اللغات (English / German / French)
    // ==========================================
    else {
        let isEng = subject === 'English';
        let cur = isEng ? finalsCurriculum['English'] : finalsCurriculum['Languages'];
        
        area.innerHTML += `
            <div style="background: rgba(0,0,0,0.5); padding: 15px; border-radius: 8px; margin-bottom: 15px; text-align: left; direction: ltr;">
                <label style="display:flex; align-items:center; justify-content:center; cursor:pointer; color:#E040FB; font-weight:bold; font-size: 16px;">
                    <input type="checkbox" id="is-session-check" style="margin-right:10px; transform:scale(1.5);">
                    Studied with a Session?
                </label>
            </div>
            <div id="languages-dynamic-area"></div>
            <h5 class="text-warning mt-20 mb-10 text-center">${subject} Standard Tasks</h5>
            <div id="lang-standard-area" style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; direction:ltr;"></div>
        `;

        let dynamicArea = document.getElementById('languages-dynamic-area');
        for (const [category, lessons] of Object.entries(cur)) {
            let catDiv = document.createElement('div');
            catDiv.style.marginBottom = '15px';
            catDiv.style.direction = 'ltr';
            catDiv.innerHTML = `<strong class="text-cyan" style="display:block; margin-bottom:8px;">${category}</strong>`;
            lessons.forEach(les => {
                catDiv.appendChild(createMagicButton(`+ ${les}`, () => {
                    let isSession = document.getElementById('is-session-check') ? document.getElementById('is-session-check').checked : false;
                    addToSharedPoll(subject, `Adv_${subject}_${category}_${les}_${isSession?'Session':'Self'}`, `${subject} | ${category}: ${les} (${isSession?'Session':'Self'})`);
                }));
            });
            dynamicArea.appendChild(catDiv);
        }

        const stdArea = document.getElementById('lang-standard-area');
        [
            {k: 'Lang_URTPiece', txt: '+ URT Piece', lbl: `${subject} - URT Piece`},
            {k: 'Lang_URTFull', txt: '+ Full URT Exam', lbl: `${subject} - Full URT Exam`},
            {k: 'Lang_TOCNormal', txt: '+ TOC Sheet', lbl: `${subject} - TOC Sheet`},
            {k: 'Lang_Essay', txt: '+ Essay Writing', lbl: `${subject} - Essay Writing`},
            {k: 'Lang_Vocab', txt: '+ Memorize Words', lbl: `${subject} - Memorize Words (2 Pts/Word)`}
        ].forEach(task => {
            stdArea.appendChild(createMagicButton(task.txt, () => addToSharedPoll(subject, task.k, task.lbl)));
        });
    }
}
function closeSelectorModal() { document.getElementById('selector-modal').classList.add('hidden'); }

function addToSharedPoll(subject, key, label) {
    const exists = localData.dailySelection.find(t => t.subject === subject && t.key === key);
    if (!exists) {
        if(!localData.subjects[subject][key]) localData.subjects[subject][key] = 0; 
        
        localData.dailySelection.push({ subject: subject, key: key, label: label });
        if(db) {
            const sharedTasks = localData.dailySelection.map(t => ({subject: t.subject, key: t.key, label: t.label}));
            db.collection('shared_polls').doc(currentDate).set({ tasks: sharedTasks }, { merge: true });
        }
        renderSharedPoll();
        populateExamTaskDropdown();
        showToast(`Added ${label} to poll`, 'success');
    }
}

function toggleSharedPoll(index) {
    const task = localData.dailySelection[index];
    let currentVal = localData.subjects[task.subject][task.key];
    
    if(task.key === 'Vocab' && currentVal === 0) {
        let num = prompt("How many words did you memorize?", "25");
        if(num !== null && !isNaN(num) && num > 0) {
            localData.subjects[task.subject][task.key] = parseInt(num);
        } else { return; }
    } else {
        if (currentVal === 0) localData.subjects[task.subject][task.key] = 1; 
        else localData.subjects[task.subject][task.key] = 0; 
    }
    saveToDB(); 
    renderSharedPoll();
    renderSubjects();
}

function renderSharedPoll() {
    const container = document.getElementById('my-poll-list');
    if (localData.dailySelection.length === 0) {
        container.innerHTML = `<p class="text-muted text-center p-15">No shared tasks selected yet.</p>`;
        return;
    }
    container.innerHTML = '';
    localData.dailySelection.forEach((task, index) => {
        let myQuantity = localData.subjects[task.subject] ? localData.subjects[task.subject][task.key] || 0 : 0;
        let isDone = myQuantity > 0;
        let partnerQuantity = partnerData.subjects && partnerData.subjects[task.subject] ? partnerData.subjects[task.subject][task.key] || 0 : 0;
        let partnerDone = partnerQuantity > 0;
        let mDone = currentUser === 'Mamdouh' ? isDone : partnerDone;
        let sDone = currentUser === 'Sama' ? isDone : partnerDone;

        container.innerHTML += `
            <div class="poll-item-row ${isDone ? 'is-done' : ''}" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <div class="poll-checkbox" onclick="toggleSharedPoll(${index})" style="margin-right:15px; font-size:20px;">
                    ${isDone ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="far fa-circle text-muted"></i>'}
                </div>
                <div class="poll-text" onclick="toggleSharedPoll(${index})" style="flex-grow:1;">
                    <span class="poll-label" style="font-weight:bold; ${isDone ? 'text-decoration:line-through; opacity:0.5;' : ''}">${task.label} ${isDone && task.key==='Vocab' ? `(${myQuantity} words)` : ''}</span>
                </div>
                <div class="poll-indicators" style="display:flex; gap:5px;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${mDone ? 'rgba(0, 229, 255, 0.2)' : '#222'}; color: ${mDone ? '#00E5FF' : '#555'}; border: 1px solid ${mDone ? '#00E5FF' : '#111'}">M</span>
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${sDone ? 'rgba(255, 61, 0, 0.2)' : '#222'}; color: ${sDone ? '#FF3D00' : '#555'}; border: 1px solid ${sDone ? '#FF3D00' : '#111'}">S</span>
                </div>
            </div>`;
    });
}

// ==========================================
// 6. Shared Personal Custom Tasks 
// ==========================================
function openCustomTaskModal() { document.getElementById('custom-task-modal').classList.remove('hidden'); }
function closeCustomTaskModal() { document.getElementById('custom-task-modal').classList.add('hidden'); }

function createCustomTask() {
    let name = document.getElementById('custom-task-name').value;
    let pts = document.getElementById('custom-task-points').value;
    if(name && pts && db) {
        let newTask = { id: Date.now().toString(), label: name, points: parseInt(pts) };
        db.collection('shared_custom_tasks').doc(currentDate).set({
            tasks: firebase.firestore.FieldValue.arrayUnion(newTask)
        }, { merge: true });
        
        document.getElementById('custom-task-name').value = '';
        document.getElementById('custom-task-points').value = '';
        closeCustomTaskModal();
        showToast('Mission created successfully', 'success');
    }
}

function toggleSharedCustomTask(taskId) {
    localData.customTaskStates[taskId] = !localData.customTaskStates[taskId];
    saveToDB();
    renderSharedCustomTasks();
}

function renderSharedCustomTasks() {
    const container = document.getElementById('custom-tasks-list');
    if (sharedCustomTasks.length === 0) {
        container.innerHTML = `<p class="text-muted text-center p-15">No shared missions. Create one above!</p>`;
        return;
    }
    container.innerHTML = '';
    sharedCustomTasks.forEach((task) => {
        let isDone = !!localData.customTaskStates[task.id];
        let partnerDone = partnerData.customTaskStates ? !!partnerData.customTaskStates[task.id] : false;
        
        let mDone = currentUser === 'Mamdouh' ? isDone : partnerDone;
        let sDone = currentUser === 'Sama' ? isDone : partnerDone;

        container.innerHTML += `
            <div class="poll-item-row ${isDone ? 'is-done' : ''}" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                <div class="poll-checkbox" onclick="toggleSharedCustomTask('${task.id}')" style="margin-right:15px; font-size:20px;">
                    ${isDone ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="far fa-circle text-muted"></i>'}
                </div>
                <div class="poll-text" onclick="toggleSharedCustomTask('${task.id}')" style="flex-grow:1;">
                    <span class="poll-label" style="font-weight:bold; color:var(--success); ${isDone ? 'text-decoration:line-through; opacity:0.5;' : ''}">${task.label}</span>
                    <span style="font-size:12px; color:var(--text-muted); margin-left:10px;">(+${task.points} pts)</span>
                </div>
                <div class="poll-indicators" style="display:flex; gap:5px;">
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${mDone ? 'rgba(0, 229, 255, 0.2)' : '#222'}; color: ${mDone ? '#00E5FF' : '#555'}; border: 1px solid ${mDone ? '#00E5FF' : '#111'}">M</span>
                    <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${sDone ? 'rgba(255, 61, 0, 0.2)' : '#222'}; color: ${sDone ? '#FF3D00' : '#555'}; border: 1px solid ${sDone ? '#FF3D00' : '#111'}">S</span>
                </div>
            </div>`;
    });
}

// ==========================================
// 6.5. KANBAN PROJECTS TRACKER 
// ==========================================
function openProjectModal() { document.getElementById('project-modal').classList.remove('hidden'); }
function closeProjectModal() { document.getElementById('project-modal').classList.add('hidden'); }

async function createProject() {
    const title = document.getElementById('project-title').value;
    const desc = document.getElementById('project-desc').value;
    if(!title || !db) return showToast("Project title required", "error");

    await db.collection('shared_projects').add({
        title: title, desc: desc, status: 'todo', createdBy: currentUser,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), pointsAwarded: false 
    });

    document.getElementById('project-title').value = '';
    document.getElementById('project-desc').value = '';
    closeProjectModal();
    showToast("Project added to Kanban!", "success");
}

async function moveProject(id, newStatus, currentPointsAwarded) {
    if(!db) return;
    let updates = { status: newStatus };
    if(newStatus === 'done' && !currentPointsAwarded) {
        localData.points += 500;
        await db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points }, { merge: true });
        updates.pointsAwarded = true;
        document.getElementById('header-score').innerText = localData.points;
        showToast("Massive Action! +500 Points Awarded! 🎉", "success");
    }
    await db.collection('shared_projects').doc(id).update(updates);
}

async function deleteProject(id) {
    if(confirm("Delete this project from Kanban?")) {
        await db.collection('shared_projects').doc(id).delete();
        showToast("Project removed.", "info");
    }
}

function renderKanban() {
    const todoList = document.getElementById('kb-list-todo');
    const progList = document.getElementById('kb-list-progress');
    const doneList = document.getElementById('kb-list-done');
    if(!todoList) return; 

    todoList.innerHTML = ''; progList.innerHTML = ''; doneList.innerHTML = '';
    if(typeof sharedProjects === 'undefined') return;

    sharedProjects.forEach(proj => {
        let actions = '';
        if (proj.status === 'todo') {
            actions = `<button class="btn-primary-small bg-orange" style="font-size:10px; padding:3px;" onclick="moveProject('${proj.id}', 'progress', ${proj.pointsAwarded})">Start</button>`;
        } else if (proj.status === 'progress') {
            actions = `<button class="btn-primary-small bg-success" style="font-size:10px; padding:3px;" onclick="moveProject('${proj.id}', 'done', ${proj.pointsAwarded})">Done!</button>`;
        }
        let delBtn = `<button class="delete-exam-btn" style="padding:0; font-size:12px;" onclick="deleteProject('${proj.id}')"><i class="fas fa-trash"></i></button>`;

        let html = `
            <div class="kanban-card">
                <div style="display:flex; justify-content:space-between;">
                    <strong class="text-cyan">${proj.title}</strong>
                    ${delBtn}
                </div>
                <span class="text-muted">${proj.desc}</span>
                <div class="kanban-actions">${actions}</div>
            </div>
        `;
        if (proj.status === 'todo') todoList.innerHTML += html;
        else if (proj.status === 'progress') progList.innerHTML += html;
        else if (proj.status === 'done') doneList.innerHTML += html;
    });
}

// ==========================================
// 7. AI LAB PIPELINE (VISION & ROUTING)
// ==========================================
let labCurrentText = "";

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function analyzeInLab() {
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Save Groq API Key in Exams tab first.", "error");
    
    let rawText = document.getElementById('lab-raw-text').value;
    const fileInput = document.getElementById('lab-image-input');
    const file = fileInput ? fileInput.files[0] : null;

    if(!rawText && !file) return showToast("Provide text or a file to analyze.", "error");

    document.getElementById('btn-lab-explain').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    document.getElementById('btn-lab-explain').disabled = true;
    document.getElementById('lab-result-container').classList.add('hidden');

    try {
        let messagesContent = [];
        let modelToUse = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

        if (file) {
            if (file.type === "application/pdf") {
                showToast("Extracting text from PDF...", "info");
                rawText = await extractTextFromPDF(file);
                
                if(rawText.length > 5000) {
                     showToast("PDF is very long. Analyzing the first part.", "info");
                     rawText = rawText.substring(0, 5000) + "... [Text truncated]";
                }
                
                messagesContent = `Explain and summarize the key concepts from this text extracted from a PDF: "${rawText}"`;
            } 
            else if (file.type.startsWith("image/")) {
                modelToUse = 'llama-3.2-90b-vision-preview'; 
                const base64Image = await convertFileToBase64(file);
                let textPrompt = rawText ? rawText : "Explain this image in detail, extract key concepts, and structure it with bullet points.";
                
                messagesContent = [
                  { type: "text", text: textPrompt },
                  { type: "image_url", image_url: { url: base64Image } }
                ];
            } else {
                throw new Error("Unsupported file type. Please upload a PDF or an image.");
            }
        } else {
             messagesContent = `Explain this concept in a highly structured, simple, and engaging way. Break it down using bullet points: "${rawText}"`;
        }

        let requestBody = {
            model: modelToUse,
            messages: [
                { role: "system", content: "You are an elite tutor. Explain everything in EXTREME detail. Provide comprehensive breakdowns, examples, and deep analysis. Do not summarize. Write long, detailed responses formatted with bullet points and bold text." },
                { role: "user", content: messagesContent }
            ],
            temperature: 0.6, 
            max_tokens: 8000 
        };
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let aiOutput = data.choices[0].message.content;
        labCurrentText = aiOutput; 
        
        let formattedHTML = aiOutput;
        if(typeof marked !== 'undefined') {
             formattedHTML = marked.parse(aiOutput);
        }
        
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        const explanationDiv = document.getElementById('lab-explanation-text');
        explanationDiv.innerHTML = formattedHTML;
        
        if (window.MathJax) {
            MathJax.typesetPromise([explanationDiv]).catch((err) => console.log('MathJax error: ', err));
        }

        document.getElementById('lab-result-container').classList.remove('hidden');
        showToast("Analysis Complete! 🔬", "success");

    } catch(err) {
        showToast("Lab Error: " + err.message, "error");
        console.error(err);
    } finally {
        document.getElementById('btn-lab-explain').innerHTML = '<i class="fas fa-magic"></i> Analyze & Explain';
        document.getElementById('btn-lab-explain').disabled = false;
    }
}

async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                
                const numPages = Math.min(pdf.numPages, 5); 
                
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + "\n";
                }
                resolve(fullText);
            } catch (err) {
                reject(err);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function routeLabToExam() {
    switchTab('view-exams', document.querySelectorAll('.nav-item')[2]);
    document.getElementById('exam-creator-section').classList.remove('hidden');
    document.getElementById('exam-raw-text').value = "Create a comprehensive multiple-choice exam based entirely on this study material:\n\n" + labCurrentText;
    document.getElementById('exam-title-input').value = "Lab Concept Exam";
    showToast("Initializing Exam Pipeline...", "info");
    generateExamWithAI(); 
}

function routeLabToCards() {
    switchTab('view-flashcards', document.querySelectorAll('.nav-item')[3]);
    document.getElementById('fc-creator-section').classList.remove('hidden');
    document.getElementById('fc-raw-text').value = labCurrentText;
    document.getElementById('fc-count-input').value = "5";
    showToast("Extracting Neural Flashcards...", "info");
    generateFlashcardsWithAI(); 
}

// ==========================================
// 8. AI EXAM ENGINE & PVP CHALLENGES
// ==========================================
function populateExamTaskDropdown() {
    const sel = document.getElementById('exam-linked-task');
    if(!sel) return;
    sel.innerHTML = '<option value="">🔗 Optional: Link to a Daily Task...</option>';
    localData.dailySelection.forEach(task => {
        sel.innerHTML += `<option value="${task.subject}|${task.key}">${task.label}</option>`;
    });
}

function saveApiKey() {
    const key = document.getElementById('ai-api-key').value;
    if(key) {
        localStorage.setItem('ai_api_key', key);
        document.getElementById('api-key-section').classList.add('hidden');
        document.getElementById('exam-creator-section').classList.remove('hidden');
        showToast('Groq AI Core Connected Successfully!', 'success');
    }
}

function changeApiKey() {
    localStorage.removeItem('ai_api_key');
    document.getElementById('ai-api-key').value = '';
    document.getElementById('exam-creator-section').classList.add('hidden');
    document.getElementById('api-key-section').classList.remove('hidden');
}

function toggleExamCreator() { document.getElementById('exam-creator-section').classList.toggle('hidden'); }

function backToExams() {
    clearInterval(examTimerInterval);
    document.getElementById('active-exam-container').classList.add('hidden');
    document.getElementById('available-exams-list').classList.remove('hidden');
    document.getElementById('exam-timer-display').classList.add('hidden');
    activeExamData = null;
}

async function deleteExam(examId, event) {
    event.stopPropagation();
    if(confirm("Are you sure you want to permanently delete this exam? No points will be deducted.")) {
        await db.collection('shared_exams').doc(examId).delete();
        showToast("Exam Deleted", "info");
    }
}

function retakeExam() {
    if(!activeExamData || !activeExamData.results || !activeExamData.results[currentUser]) return;
    if(confirm("Retaking the exam will deduct your previous points from your total. Proceed?")) {
        let earnedPoints = activeExamData.results[currentUser].points;
        localData.points -= earnedPoints;
        let updatedResults = { ...activeExamData.results };
        delete updatedResults[currentUser];
        db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points }, { merge: true });
        db.collection('shared_exams').doc(activeExamData.id).set({ results: updatedResults }, { merge: true }).then(() => {
            document.getElementById('header-score').innerText = localData.points;
            activeExamData.results = updatedResults;
            startExam(activeExamData.id); 
            showToast("Ready for Retake!", "info");
        });
    }
}

function sendChallenge(examId, examTitle, event) {
    event.stopPropagation();
    let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
    if(db) {
        db.collection('users').doc(partnerUser).set({
            pendingChallenge: { examId: examId, examTitle: examTitle, from: currentUser, timestamp: Date.now() }
        }, { merge: true });
        showToast(`Challenge sent to ${partnerUser}! Waiting for acceptance... ⚔️`, 'info');
    }
}

function acceptChallenge() {
    let modal = document.getElementById('challenge-modal');
    if(!modal) return;
    let examId = modal.dataset.examId;
    modal.classList.add('hidden');
    if(db) db.collection('users').doc(currentUser).set({ pendingChallenge: null }, { merge: true });
    
    let navItems = document.querySelectorAll('.nav-item');
    if(navItems.length > 2) switchTab('view-exams', navItems[2]);
    startExam(examId);
    showToast("Battle Started! 🥊", "success");
}

function ignoreChallenge() {
    let modal = document.getElementById('challenge-modal');
    if(modal) modal.classList.add('hidden');
    if(db) db.collection('users').doc(currentUser).set({ pendingChallenge: null }, { merge: true });
}

async function generateExamWithAI() {
    const apiKey = localStorage.getItem('ai_api_key');
    const title = document.getElementById('exam-title-input').value;
    const rawText = document.getElementById('exam-raw-text').value;
    const timeLimitInput = document.getElementById('exam-timer-input').value;
    const timeLimit = timeLimitInput ? parseInt(timeLimitInput) : 0;
    
    const linkedTaskSelect = document.getElementById('exam-linked-task');
    const linkedTaskVal = linkedTaskSelect.value;
    const linkedTaskText = linkedTaskSelect.options[linkedTaskSelect.selectedIndex] ? linkedTaskSelect.options[linkedTaskSelect.selectedIndex].text : "";
    
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    if(!apiKey) return showToast("Please enter and save Groq API Key first.", "error");
    if(!title || !rawText) return showToast("Please enter exam title and text.", "error");

    document.getElementById('ai-loading-text').classList.remove('hidden');
    document.getElementById('btn-generate-exam').disabled = true;

    const isURT = linkedTaskText.toUpperCase().includes("URT");
    let systemPrompt = "";

    if (isURT) {
        systemPrompt = `You are an expert AI exam generator. The user will provide a reading passage followed by questions.
        YOUR TASK: Separate the pure reading passage from the questions.
        Format MUST be exactly a JSON object with two keys:
        {"passage": "Only the pure reading text here without any questions or options", "questions": [{"q": "Question string", "opts": ["Option 1", "Option 2", "Option 3", "Option 4"], "ans": 0}]}
        'ans' is the 0-based index of the correct option.
        CRITICAL RULES FOR MATH: 
        1. You MUST double-escape all backslashes in LaTeX (e.g., write \\\\frac instead of \\frac).
        2. You MUST wrap ALL math formulas, variables, and symbols in $ for inline math or $$ for display math.
        3. DO NOT wrap the output in markdown code blocks. Output ONLY raw valid JSON.`;
    } 
    else {
        systemPrompt = `You are an expert AI exam generator and parser. Based on the text provided by the user, generate a multiple-choice exam. 
        Format MUST be exactly a JSON array: [{"q": "Question string", "opts": ["A", "B", "C", "D"], "ans": 0}]. 'ans' is the 0-based index of the correct option.
        CRITICAL RULES FOR MATH: 
        1. You MUST double-escape all backslashes in LaTeX (e.g., write \\\\frac instead of \\frac).
        2. You MUST wrap ALL math formulas, variables, and symbols in $ for inline math or $$ for display math.
        3. DO NOT wrap the output in markdown code blocks. Output ONLY raw valid JSON.`;
    }
    
    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: rawText }], temperature: 0.1 })
        });
        
        const data = await response.json();
        if (data.error) {
            if(data.error.message.includes('API key') || data.error.message.includes('Unauthorized')) changeApiKey();
            throw new Error(data.error.message);
        }

        let rawOutput = data.choices[0].message.content;
        rawOutput = rawOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        let aiOutput = rawOutput;
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            aiOutput = jsonMatch[0];
        }
        
        let parsedData;
        try { 
            parsedData = JSON.parse(aiOutput); 
        } 
        catch (parseError) { 
            throw new Error("AI format error. The AI did not follow strict JSON formatting."); 
        }

        let questionsArray = [];
        let cleanPassage = rawText;

        if (Array.isArray(parsedData)) {
            questionsArray = parsedData;
        } else if (parsedData && parsedData.questions && Array.isArray(parsedData.questions)) {
            questionsArray = parsedData.questions;
            if (parsedData.passage) cleanPassage = parsedData.passage;
        }

        if(db && questionsArray.length > 0) {
            await db.collection('shared_exams').add({
                title: title, 
                questions: questionsArray, 
                createdBy: currentUser, 
                timeLimit: timeLimit,
                linkedTask: linkedTaskVal, 
                isURT: isURT, 
                savedPassage: cleanPassage, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
                results: {} 
            });
            document.getElementById('exam-title-input').value = '';
            document.getElementById('exam-raw-text').value = '';
            document.getElementById('exam-timer-input').value = '';
            toggleExamCreator();
            showToast("Exam generated successfully!", "success");
        }
    } catch(err) {
        showToast("AI Processing Failed: " + err.message, "error");
    } finally {
        document.getElementById('ai-loading-text').classList.add('hidden');
        document.getElementById('btn-generate-exam').disabled = false;
    }
}

function renderExamsList() {
    const list = document.getElementById('available-exams-list');
    if(!list) return;
    list.innerHTML = '';
    sharedExams.forEach(exam => {
        let mRes = exam.results && exam.results['Mamdouh'] ? `<span class="text-cyan">M: ${exam.results['Mamdouh'].correct}✅ ${exam.results['Mamdouh'].wrong}❌</span>` : `<span class="text-muted">M: ⏳</span>`;
        let sRes = exam.results && exam.results['Sama'] ? `<span class="text-orange">S: ${exam.results['Sama'].correct}✅ ${exam.results['Sama'].wrong}❌</span>` : `<span class="text-muted">S: ⏳</span>`;

        let isTaken = exam.results && exam.results[currentUser];
        let btnClass = isTaken ? "bg-cyan" : "bg-success";
        let btnText = isTaken ? "Review" : "Take";
        let timeLabel = exam.timeLimit ? ` • ⏱️ ${exam.timeLimit}m` : '';
        let linkLabel = exam.linkedTask ? ` • 🔗 Linked` : '';

        let challengeBtn = !isTaken ? `<button class="btn-primary-small bg-orange" style="margin-left:5px; padding:5px 10px;" onclick="sendChallenge('${exam.id}', '${exam.title.replace(/'/g, "\\'")}', event)" title="Challenge Partner"><i class="fas fa-crosshairs"></i></button>` : '';

        list.innerHTML += `
            <div class="card-glass exam-card" onclick="startExam('${exam.id}')">
                <div style="flex-grow: 1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h4 class="text-white">${exam.title}</h4>
                        <button class="delete-exam-btn" onclick="deleteExam('${exam.id}', event)"><i class="fas fa-trash"></i></button>
                    </div>
                    <span class="text-muted" style="font-size:12px;">${exam.questions.length} Qs${timeLabel}${linkLabel} • By ${exam.createdBy}</span>
                    <div class="exam-stats">
                        ${mRes} | ${sRes}
                    </div>
                </div>
                <div style="display:flex; align-items:center;">
                    <button class="btn-primary-small ${btnClass}" style="margin-left:15px; min-width:60px;">${btnText}</button>
                    ${challengeBtn}
                </div>
            </div>
        `;
    });
    if (typeof loadCompletedExamsForAI === 'function') {
        loadCompletedExamsForAI();
    }
}

function startExam(examId) {
    clearInterval(examTimerInterval); 
    activeExamData = sharedExams.find(e => e.id === examId);
    if(!activeExamData) return;

    document.getElementById('api-key-section').classList.add('hidden');
    document.getElementById('exam-creator-section').classList.add('hidden');
    document.getElementById('available-exams-list').classList.add('hidden');
    
    const container = document.getElementById('active-exam-container');
    container.classList.remove('hidden');
    document.getElementById('active-exam-title').innerText = activeExamData.title;

    const passageBox = document.getElementById('urt-passage-display');
    const passageContent = document.getElementById('urt-text-content');

    if (activeExamData.isURT) {
        const savedPassage = activeExamData.savedPassage || activeExamData.rawText; 
        if (savedPassage && savedPassage.trim().length > 10) {
            if(passageContent) passageContent.innerHTML = marked.parse(savedPassage); 
            if(passageBox) passageBox.classList.remove('hidden');
        } else {
            if(passageBox) passageBox.classList.add('hidden');
        }
    } else {
        if(passageBox) passageBox.classList.add('hidden');
    }

    const qaArea = document.getElementById('exam-questions-area');
    qaArea.innerHTML = '';
    const banner = document.getElementById('exam-result-banner');

    let isTaken = activeExamData.results && activeExamData.results[currentUser];
    let myAnswers = isTaken ? activeExamData.results[currentUser].answers : [];

    if (isTaken) {
        let res = activeExamData.results[currentUser];
        banner.innerHTML = `<h3 class="text-success mb-10">Exam Completed!</h3><p>Correct: ${res.correct} ✅ | Wrong: ${res.wrong} ❌</p><p class="text-cyan mt-10" style="font-weight:bold; font-size:18px;">Earned: +${res.points} Points</p>`;
        banner.classList.remove('hidden');
        document.getElementById('exam-timer-display').classList.add('hidden');
    } else {
        banner.classList.add('hidden');
        if (activeExamData.timeLimit > 0) {
            let timeLeft = activeExamData.timeLimit * 60;
            document.getElementById('exam-timer-display').classList.remove('hidden');
            examTimerInterval = setInterval(() => {
                let m = Math.floor(timeLeft / 60);
                let s = timeLeft % 60;
                document.getElementById('exam-timer-display').innerText = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
                if(timeLeft <= 0) {
                    clearInterval(examTimerInterval);
                    showToast("Time is up! Auto-submitting exam.", "info");
                    submitExam();
                }
                timeLeft--;
            }, 1000);
        } else {
            document.getElementById('exam-timer-display').classList.add('hidden');
        }
    }

    const formatAwesome = (text, isInline) => {
        if (!text) return "";
        let mathBlocks = [];
        let safeText = text.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => { mathBlocks.push(`$$${p1}$$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => { mathBlocks.push(`$${p1}$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\$\$([\s\S]*?)\$\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                           .replace(/\$([\s\S]*?)\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; });

        let formatted = typeof marked !== 'undefined' ? (isInline ? marked.parseInline(safeText) : marked.parse(safeText)) : safeText;
        formatted = formatted.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formatted = formatted.replace(`@@MATH_BLOCK_${index}@@`, block);
        });
        return formatted;
    };

    activeExamData.questions.forEach((qObj, qIndex) => {
        let optsHtml = '';
        let isWrongAnswer = false;

        qObj.opts.forEach((opt, optIndex) => {
            let extraClass = '';
            let isChecked = '';
            
            if (isTaken) {
                let ansInt = parseInt(qObj.ans);
                let myAnsInt = parseInt(myAnswers[qIndex]);
                if (optIndex === ansInt) { extraClass = 'opt-correct'; } 
                if (optIndex === myAnsInt && myAnsInt !== ansInt) { extraClass = 'opt-wrong'; isWrongAnswer = true; }
                if (optIndex === myAnsInt) { isChecked = 'checked'; }
            }
            
            let formattedOptText = formatAwesome(opt, true);

            optsHtml += `
                <label class="option-label text-white ${extraClass}" style="font-size: 15px; display: block; margin-bottom: 10px; padding: 12px 15px; background: rgba(255,255,255,0.04); border-radius: 8px; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.05);">
                    <input type="radio" name="q_${qIndex}" value="${optIndex}" ${isChecked} ${isTaken ? 'disabled' : ''} style="margin-right: 12px; transform: scale(1.1);">
                    <span style="display: inline-block; vertical-align: middle;">${formattedOptText}</span>
                </label>
            `;
        });

        let explainBtnHtml = isTaken ? `<button id="explain-btn-${qIndex}" class="btn-primary-small" style="background: rgba(0, 229, 255, 0.1); color: var(--cyan); border: 1px solid var(--cyan); font-weight:bold; border-radius:6px; padding:6px 15px; transition: 0.3s;" onclick="explainAnswer(${qIndex})"><i class="fas fa-magic"></i> Explain</button>` : '';
        let makeCardBtnHtml = (isTaken && isWrongAnswer) ? 
            `<button id="make-card-btn-${qIndex}" class="btn-primary-small mt-10" style="background:#673AB7; font-size:12px; padding: 6px 15px; border-radius:6px;" onclick="convertWrongToCard(${qIndex})"><i class="fas fa-plus"></i> Flashcard</button>` : '';

        let formattedQuestion = formatAwesome(qObj.q, false);

        qaArea.innerHTML += `
            <div class="question-block" style="padding: 20px; background: rgba(0, 229, 255, 0.02); border: 1px solid rgba(0, 229, 255, 0.1); border-left: 4px solid var(--cyan); border-radius: 10px; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <div class="question-text" style="font-size: 16px; color: #fff; line-height: 1.7; margin-bottom: 20px;">
                    <span class="text-cyan" style="font-weight: 900; font-size: 18px; margin-right: 8px;">Q${qIndex + 1}.</span> 
                    <div style="display:inline-block; vertical-align:top; width:90%;">${formattedQuestion}</div>
                </div>
                
                <div style="padding-left: 5px;">
                    ${optsHtml}
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    ${makeCardBtnHtml}
                    ${explainBtnHtml}
                </div>
                <div id="explain-box-${qIndex}" style="clear:both;"></div>
            </div>
        `;
    });

    const submitBtn = document.getElementById('submit-exam-btn');
    const retakeBtn = document.getElementById('retake-exam-btn');
    if (isTaken) {
        submitBtn.classList.add('hidden');
        retakeBtn.classList.remove('hidden');
    } else {
        submitBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
    }

    if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('active-exam-container')]).catch((err) => console.log('MathJax Error:', err));
    }
}

async function convertWrongToCard(qIndex) {
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const qObj = activeExamData.questions[qIndex];
    const btn = document.getElementById(`make-card-btn-${qIndex}`);
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting...';
    btn.disabled = true;

    let ansInt = parseInt(qObj.ans);
    let correctAnsText = qObj.opts[ansInt];

    const prompt = `Extract the core educational concept or term from this question: "${qObj.q}" where the correct answer is "${correctAnsText}". Create a concise flashcard. Format strictly as JSON: {"front": "Concept/Term", "back": "Concise definition"}. No markdown.`;
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.1 })
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        let aiOutput = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        let cardData = JSON.parse(aiOutput);

        await db.collection('users').doc(currentUser).collection('flashcards').add({
            front: cardData.front, back: cardData.back, nextReview: Date.now()
        });
        showToast('Smart Flashcard Created!', 'success');
        btn.innerHTML = '<i class="fas fa-check"></i> Saved';
    } catch(err) {
        showToast("Card Gen Error", "error");
        btn.innerHTML = '<i class="fas fa-plus"></i> Save to Cards';
        btn.disabled = false;
    }
}

function submitExam() {
    if(!activeExamData) return;
    clearInterval(examTimerInterval); 
    
    let correctCount = 0; let wrongCount = 0; let userAnswers = [];

    activeExamData.questions.forEach((qObj, qIndex) => {
        const selected = document.querySelector(`input[name="q_${qIndex}"]:checked`);
        let ansIndex = selected ? parseInt(selected.value) : -1;
        userAnswers.push(ansIndex);
        if(ansIndex === parseInt(qObj.ans)) correctCount++; else wrongCount++;
    });

    let earnedPoints = (correctCount * 3) + (wrongCount * 1);
    localData.points += earnedPoints;
    
    if (activeExamData.linkedTask) {
        let parts = activeExamData.linkedTask.split('|');
        if(parts.length === 2 && localData.subjects[parts[0]] && localData.subjects[parts[0]][parts[1]] !== undefined) {
            localData.subjects[parts[0]][parts[1]] += 1;
            showToast(`Linked Task (${parts[0]} ${parts[1].replace('_',' ')}) done!`, 'success');
        }
    }

    if(!activeExamData.results) activeExamData.results = {};
    activeExamData.results[currentUser] = { correct: correctCount, wrong: wrongCount, points: earnedPoints, answers: userAnswers };

    if(db) {
        db.collection('users').doc(currentUser).collection('daily_records').doc(currentDate).set({ points: localData.points, subjects: localData.subjects }, { merge: true });
        db.collection('shared_exams').doc(activeExamData.id).set({ results: { [currentUser]: activeExamData.results[currentUser] } }, { merge: true });
    }
    
    document.getElementById('header-score').innerText = localData.points;
    renderSubjects(); renderSharedPoll(); startExam(activeExamData.id); 
    showToast(`Submitted! +${earnedPoints} Points`, 'success');
}

async function explainAnswer(qIndex) {
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Save Groq API Key to use this.", "error");
    
    const qObj = activeExamData.questions[qIndex];
    const btn = document.getElementById(`explain-btn-${qIndex}`);
    const div = document.getElementById(`explain-box-${qIndex}`);
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';
    btn.disabled = true;

    let ansInt = parseInt(qObj.ans);
    let correctAnsText = qObj.opts[ansInt] || "Unknown";
    const prompt = `Question: "${qObj.q}". Options: A)${qObj.opts[0]}, B)${qObj.opts[1]}, C)${qObj.opts[2]}, D)${qObj.opts[3]}. The correct answer is **${correctAnsText}**. 
    Explain in absolute maximum detail why this is the correct answer. Break down the reasoning step-by-step, explain why the other options are wrong, and give examples if necessary. Take your time and write a comprehensive explanation.`;
    
    const requestBody = {
        model: 'llama-3.3-70b-versatile', 
        messages: [
            { role: "system", content: "You are an elite tutor. Explain everything in EXTREME detail. Provide comprehensive breakdowns, examples, and deep analysis. Do not summarize. Write long, detailed responses formatted with bullet points and bold text. IMPORTANT: Wrap ALL math equations, variables, and formulas in $ for inline math and $$ for display math." },
            { role: "user", content: prompt }
        ], 
        temperature: 0.6,
        max_tokens: 8000
    };

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        
        let rawExplanation = data.choices[0].message.content;
        
        let mathBlocks = [];
        let safeText = rawExplanation;

        safeText = safeText.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => {
            mathBlocks.push(`$$${p1}$$`);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => {
            mathBlocks.push(`$${p1}$`);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\$\$([\s\S]*?)\$\$/g, (m) => {
            mathBlocks.push(m);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });
        safeText = safeText.replace(/\$([\s\S]*?)\$/g, (m) => {
            mathBlocks.push(m);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });

        let formattedHTML = safeText;
        if(typeof marked !== 'undefined') {
            formattedHTML = marked.parse(safeText);
        }
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formattedHTML = formattedHTML.replace(`@@MATH_BLOCK_${index}@@`, block);
        });

        div.innerHTML = `<div style="margin-top:10px; padding:15px; background:rgba(0, 230, 118, 0.1); border-left:3px solid var(--success); font-size:15px; color:#fff; line-height: 1.8; border-radius: 0 8px 8px 0;">
            <div style="margin-bottom: 15px; font-size: 16px;">🤖 <b class="text-success">AI Tutor Analysis:</b></div>
            ${formattedHTML}
        </div>`;
        btn.classList.add('hidden');
        
        if (window.MathJax) {
            MathJax.typesetPromise([div]).catch((err) => console.log('MathJax Error:', err));
        }

    } catch(err) {
        showToast("Error: " + err.message, "error");
        btn.innerHTML = '<i class="fas fa-magic"></i> Explain Answer';
        btn.disabled = false;
    }
}
// ==========================================
// 9. FLASHCARDS SYSTEM 
// ==========================================
function toggleFlashcardCreator() { document.getElementById('fc-creator-section').classList.toggle('hidden'); }
function backToFCDashboard() {
    document.getElementById('active-fc-container').classList.add('hidden');
    document.getElementById('fc-quiz-container').classList.add('hidden');
    document.getElementById('fc-all-container').classList.add('hidden');
    document.getElementById('fc-dashboard').classList.remove('hidden');
    checkDueFlashcards();
}

async function generateFlashcardsWithAI() {
    const apiKey = localStorage.getItem('ai_api_key');
    const rawText = document.getElementById('fc-raw-text').value;
    const count = document.getElementById('fc-count-input').value || "5";
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    if(!apiKey) return showToast("Save Groq API Key first.", "error");
    if(!rawText) return showToast("Paste text to extract cards.", "error");

    document.getElementById('fc-loading-text').classList.remove('hidden');
    document.getElementById('btn-generate-fc').disabled = true;

    const systemPrompt = `You are a strict JSON parsing API. Extract exactly ${count} key concepts, rules, or questions from the user's text. Format MUST be exactly a JSON array: [{"front": "Question or Term", "back": "Concise Answer or Definition"}]. Keep 'back' concise. Output ONLY raw JSON without markdown.`;

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: rawText }], temperature: 0.1 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        let cardsArray = JSON.parse(data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());

        if(db && cardsArray.length > 0) {
            let batch = db.batch();
            cardsArray.forEach(card => {
                let newRef = db.collection('users').doc(currentUser).collection('flashcards').doc();
                batch.set(newRef, { front: card.front, back: card.back, nextReview: Date.now() });
            });
            await batch.commit();
            document.getElementById('fc-raw-text').value = ''; document.getElementById('fc-count-input').value = '';
            toggleFlashcardCreator(); showToast(`${cardsArray.length} Cards saved!`, 'success');
        }
    } catch(err) {
        showToast("Card Gen Failed: " + err.message, "error");
    } finally {
        document.getElementById('fc-loading-text').classList.add('hidden'); document.getElementById('btn-generate-fc').disabled = false;
    }
}

function checkDueFlashcards() {
    let now = Date.now();
    dueFlashcards = myFlashcards.filter(c => !c.nextReview || c.nextReview <= now);
    document.getElementById('fc-queue-count').innerText = dueFlashcards.length;
    if(dueFlashcards.length > 0) {
        document.getElementById('btn-start-study').classList.remove('hidden');
        document.getElementById('btn-fc-quiz').classList.remove('hidden');
    } else {
        document.getElementById('btn-start-study').classList.add('hidden');
        if(myFlashcards.length < 4) document.getElementById('btn-fc-quiz').classList.add('hidden'); 
    }
}

function startStudyingFlashcards() {
    if(dueFlashcards.length === 0) return showToast("No cards due!", "info");
    currentStudyIndex = 0;
    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('active-fc-container').classList.remove('hidden');
    showCurrentFlashcard();
}

function showCurrentFlashcard() {
    let card = dueFlashcards[currentStudyIndex];
    document.getElementById('active-fc-card').classList.remove('is-flipped');
    document.getElementById('fc-front-text').innerText = card.front;
    document.getElementById('fc-back-text').innerText = card.back;
    document.getElementById('fc-study-controls').classList.add('hidden');
}

function flipActiveCard() {
    let cardEl = document.getElementById('active-fc-card');
    if(!cardEl.classList.contains('is-flipped')) {
        cardEl.classList.add('is-flipped');
        document.getElementById('fc-study-controls').classList.remove('hidden');
    }
}

async function markCard(isCorrect) {
    let card = dueFlashcards[currentStudyIndex];
    let nextTime = isCorrect ? Date.now() + (2*24*60*60*1000) : Date.now() + (3*60*60*1000);
    showToast(isCorrect ? "See you in 2 Days." : "Review in 3 Hours.", isCorrect ? "success" : "error");

    if(db) await db.collection('users').doc(currentUser).collection('flashcards').doc(card.id).update({ nextReview: nextTime });

    currentStudyIndex++;
    if (currentStudyIndex < dueFlashcards.length) showCurrentFlashcard();
    else { backToFCDashboard(); showToast("Session Complete!", "success"); }
}

function viewAllFlashcards() {
    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('fc-all-container').classList.remove('hidden');
    const grid = document.getElementById('fc-all-grid');
    grid.innerHTML = '';
    if(myFlashcards.length === 0) { grid.innerHTML = '<p class="text-muted w-100">No cards yet.</p>'; return; }
    myFlashcards.forEach(c => {
        grid.innerHTML += `<div class="fc-mini-card"><strong class="text-cyan">${c.front}</strong><hr style="border-color: rgba(255,255,255,0.1); margin: 5px 0;"><span class="text-white">${c.back}</span></div>`;
    });
}

async function generateQuizFromCards() {
    if(myFlashcards.length < 4) return showToast("Need at least 4 flashcards.", "error");
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Save Groq API Key first.", "error");

    document.getElementById('fc-dashboard').classList.add('hidden');
    document.getElementById('fc-quiz-container').classList.remove('hidden');
    const qaArea = document.getElementById('fc-quiz-area');
    qaArea.innerHTML = '<p class="text-center text-cyan"><i class="fas fa-spinner fa-spin"></i> Generating custom quiz...</p>';
    document.getElementById('submit-fc-quiz-btn').classList.add('hidden');

    let sample = myFlashcards.sort(() => 0.5 - Math.random()).slice(0, 10);
    let cardsData = JSON.stringify(sample.map(c => ({ id: c.id, concept: c.front, meaning: c.back })));

    const prompt = `Create a 4-option multiple-choice quiz based ONLY on these flashcards: ${cardsData}. Formulate a question where the correct answer is the meaning. Invent 3 wrong options. Format MUST be a JSON array: [{"id": "the_card_id", "q": "Question", "opts": ["A", "B", "C", "D"], "ans": 0}]. Output ONLY raw JSON.`;
    const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.2 })
        });
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);

        activeFCQuiz = JSON.parse(data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim());

        qaArea.innerHTML = '';
        activeFCQuiz.forEach((qObj, qIndex) => {
            let optsHtml = '';
            qObj.opts.forEach((opt, optIndex) => {
                optsHtml += `<label class="option-label text-white"><input type="radio" name="fcq_${qIndex}" value="${optIndex}">${opt}</label>`;
            });
            qaArea.innerHTML += `<div class="question-block"><p class="question-text">${qIndex + 1}. ${qObj.q}</p>${optsHtml}</div>`;
        });
        document.getElementById('submit-fc-quiz-btn').classList.remove('hidden');
    } catch (err) { qaArea.innerHTML = `<p class="text-danger text-center">Quiz Failed: ${err.message}</p>`; }
}

async function submitFCQuiz() {
    if(!activeFCQuiz) return;
    let correct = 0; let batch = db.batch(); let now = Date.now();
    activeFCQuiz.forEach((qObj, qIndex) => {
        const selected = document.querySelector(`input[name="fcq_${qIndex}"]:checked`);
        let isRight = selected && parseInt(selected.value) === qObj.ans;
        let nextTime = isRight ? now + (2*24*60*60*1000) : now + (3*60*60*1000);
        if(isRight) correct++;
        if(qObj.id) batch.update(db.collection('users').doc(currentUser).collection('flashcards').doc(qObj.id), { nextReview: nextTime });
    });
    await batch.commit();
    showToast(`Quiz Complete! Scored ${correct}/${activeFCQuiz.length}. Spacing Updated.`, 'success');
    backToFCDashboard();
}

// ==========================================
// 10. Subjects Override & Sub-renders
// ==========================================
function renderUI() { renderSpiritual(); renderSubjects(); renderSharedPoll(); renderSharedCustomTasks(); calculatePoints(); }

function updateSub(sub, key, change) {
    if (localData.subjects[sub][key] + change >= 0) {
        localData.subjects[sub][key] += change;
        saveToDB(); renderSubjects(); renderSharedPoll(); 
    }
}
function manualSetSub(sub, key) {
    let val = prompt(`Amount for ${sub} ${key.replace('_', ' ')}:`, localData.subjects[sub][key]);
    if(val !== null && !isNaN(val) && val >= 0) { localData.subjects[sub][key] = parseInt(val); saveToDB(); renderSubjects(); renderSharedPoll(); }
}
function renderSubjects() {
    const container = document.getElementById('subjects-container'); container.innerHTML = '';
    let activeSubjects = {};
    localData.dailySelection.forEach(task => {
        let val = localData.subjects[task.subject][task.key];
        if (val > 0) { if (!activeSubjects[task.subject]) activeSubjects[task.subject] = {}; activeSubjects[task.subject][task.key] = val; }
    });
    if(Object.keys(activeSubjects).length === 0) return container.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: span 2; margin-top:20px;">Complete a task from Daily Poll to unlock.</p>`;
    for (const [sub, tasks] of Object.entries(activeSubjects)) {
        let html = `<div class="card-glass subject-card"><h4 class="text-cyan mb-10">${sub}</h4>`;
        for (const [key, val] of Object.entries(tasks)) {
            html += `<div class="counter-row"><span>${key.replace('_', ' ')}</span><div class="controls"><button onclick="updateSub('${sub}', '${key}', -1)">-</button><span class="val" onclick="manualSetSub('${sub}', '${key}')">${val}</span><button onclick="updateSub('${sub}', '${key}', 1)">+</button></div></div>`;
        }
        container.innerHTML += html + `</div>`;
    }
}
function toggleSpiritual(key) { localData.spiritual[key].done = !localData.spiritual[key].done; saveToDB(); renderSpiritual(); }
function setDelay(key, delay) { localData.spiritual[key].delay = delay; saveToDB(); renderSpiritual(); }
function setRakat(key, val) { localData.spiritual[key].rakat = parseInt(val) || 0; saveToDB(); }

function renderSpiritual() {
    const container = document.getElementById('spiritual-container'); 
    if(!container) return;
    container.innerHTML = '';
    
    for (const [key, data] of Object.entries(localData.spiritual)) {
        let rakatHtml = '';
        if ((data.type === 'nafl' || data.type === 'qiyam') && data.done) {
            let ptsPerRakah = data.type === 'qiyam' ? 100 : 15; // تحديد سعر الركعة
            rakatHtml = `<div style="margin-top: 10px; text-align: right;"><input type="number" placeholder="عدد الركعات؟" value="${data.rakat || ''}" class="input-dark" style="width: 100px; padding: 5px; font-size:14px; text-align:center;" onchange="setRakat('${key}', this.value)"> <span style="font-size:12px; color:var(--success); font-weight:bold;">الركعة بـ ${ptsPerRakah} نقطة!</span></div>`;
        }

        container.innerHTML += `
            <div class="card-glass spirit-item" style="direction: rtl; text-align: right;">
                <div class="spirit-top" style="display:flex; justify-content:flex-start; align-items:center; gap: 12px;">
                    <input type="checkbox" ${data.done ? 'checked' : ''} onchange="toggleSpiritual('${key}')" style="transform: scale(1.3);">
                    <span style="flex-grow:1; font-size: 16px; font-weight: bold; ${data.done ? 'text-decoration:line-through; opacity:0.5;' : ''}">${key}</span>
                </div>
                ${rakatHtml}
                ${data.done && (!key.includes('الورد') && !key.includes('الحديث')) ? `
                <div class="delay-options" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;">
                    <button class="delay-btn ${data.delay===0?'active':''}" onclick="setDelay('${key}',0)">في وقتها</button>
                    <button class="delay-btn ${data.delay===1?'active':''}" onclick="setDelay('${key}',1)">تأخير 1س</button>
                    <button class="delay-btn ${data.delay===2?'active':''}" onclick="setDelay('${key}',2)">تأخير 2س</button>
                    <button class="delay-btn ${data.delay===3?'active':''}" onclick="setDelay('${key}',3)">أكثر</button>
                </div>` : ''}
            </div>`;
    }
}

// ضيف السطرين دول تحتها عشان نافذة الخصم تفتح وتقفل:
function openPenaltyModal() { document.getElementById('penalty-modal').classList.remove('hidden'); }
function closePenaltyModal() { document.getElementById('penalty-modal').classList.add('hidden'); }

// ==========================================
// 11. Analytics, Leaderboard & AI MENTOR
// ==========================================
function loadHistoryDate() { const dateVal = document.getElementById('history-date').value; if(dateVal) { currentDate = dateVal; fetchData(dateVal); } }

async function loadLeaderboard(filter) {
    if(!db) return;
    let mamdouhTotal = 0; let samaTotal = 0; let startDateStr = todayStr;
    if (filter === 'week') { const d = new Date(); d.setDate(d.getDate() - 7); startDateStr = d.toISOString().split('T')[0]; } 
    else if (filter === 'month') { const d = new Date(); d.setDate(d.getDate() - 30); startDateStr = d.toISOString().split('T')[0]; }

    async function fetchTotalPointsForUser(userName) {
        let sum = 0;
        if (filter === 'today') {
            let doc = await db.collection('users').doc(userName).collection('daily_records').doc(todayStr).get();
            if(doc.exists) sum = doc.data().points || 0;
        } else {
            let snapshot = await db.collection('users').doc(userName).collection('daily_records').where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).where(firebase.firestore.FieldPath.documentId(), '<=', todayStr).get();
            snapshot.forEach(doc => { sum += doc.data().points || 0; });
        }
        return sum;
    }
    mamdouhTotal = await fetchTotalPointsForUser('Mamdouh'); samaTotal = await fetchTotalPointsForUser('Sama');
    document.getElementById('lb-mamdouh-score').innerText = mamdouhTotal; document.getElementById('lb-sama-score').innerText = samaTotal;
    let max = Math.max(mamdouhTotal, samaTotal, 1);
    document.getElementById('bar-mamdouh').style.height = `${(mamdouhTotal/max)*150}px`; document.getElementById('bar-sama').style.height = `${(samaTotal/max)*150}px`;
    drawCharts(mamdouhTotal, samaTotal);
}
function setLeaderboardFilter(filter, btn) { document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); loadLeaderboard(filter); }

function drawCharts(mPts, sPts) {
    if (charts.radar) charts.radar.destroy();
    charts.radar = new Chart(document.getElementById('radarChart').getContext('2d'), { type: 'radar', data: { labels: ['URT', 'TOC', 'Sessions', 'Spiritual', 'Vocab/Exams'], datasets: [{ label: 'Mamdouh', data: [mPts*0.4, mPts*0.2, mPts*0.2, mPts*0.1, mPts*0.1], borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.2)' }, { label: 'Sama', data: [sPts*0.3, sPts*0.3, sPts*0.2, sPts*0.1, sPts*0.1], borderColor: '#FF3D00', backgroundColor: 'rgba(255, 61, 0, 0.2)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins:{legend:{display:false}}, scales: { r: { grid: { color: '#333' }, pointLabels: { color: '#8A94A6', font:{size:10} } } } } });
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(document.getElementById('barChart').getContext('2d'), { type: 'bar', data: { labels: ['Total Score'], datasets: [{ label: 'Mamdouh', data: [mPts], backgroundColor: '#00E5FF', borderRadius: 5 }, { label: 'Sama', data: [sPts], backgroundColor: '#FF3D00', borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: '#333' }, beginAtZero: true }, x: { grid: { display: false } } } } });
    let myUrt = 0, myToc = 0, mySpirit = 0, myCustom = 0;
    for (const [sub, tasks] of Object.entries(localData.subjects)) { myUrt += (tasks.URT_Pieces * 50) + (tasks.URT_Full * 300); myToc += (tasks.TOC_Normal * 2) + (tasks.TOC_Essay * 3); }
    for (const data of Object.values(localData.spiritual)) { if(data.done) mySpirit += 25; }
    sharedCustomTasks.forEach(ct => { if(localData.customTaskStates[ct.id]) myCustom += ct.points; });
    if (charts.doughnut) charts.doughnut.destroy();
    charts.doughnut = new Chart(document.getElementById('doughnutChart').getContext('2d'), { type: 'doughnut', data: { labels: ['URT', 'TOC', 'Spiritual', 'Missions & Exams'], datasets: [{ data: [myUrt, myToc, mySpirit, myCustom], backgroundColor: ['#FF1744', '#00E676', '#FF3D00', '#E040FB'], borderWidth: 0, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff', font:{size:10} } } } } });
}

// ==========================================
// 🔴 نظام العقوبات والخصم 
// ==========================================
function applyPenalty(amount, reason) {
    if(confirm(`هل أنت متأكد من خصم ${amount} نقطة بسبب: ${reason}؟`)) {
        localData.points -= amount;
        saveToDB();
        document.getElementById('header-score').innerText = localData.points;
        showToast(`تم خصم ${amount} نقطة! السبب: ${reason}`, 'error');
    }
}

function applyCustomPenalty() {
    let reason = document.getElementById('custom-penalty-reason').value || "خصم مخصص";
    let amount = parseInt(document.getElementById('custom-penalty-amount').value);
    if(!amount || amount <= 0) return showToast("أدخل عدد نقاط صحيح للخصم!", "info");
    applyPenalty(amount, reason);
    document.getElementById('custom-penalty-reason').value = '';
    document.getElementById('custom-penalty-amount').value = '';
}

// ==========================================
// 🧠 المحلل الخارق (AI MENTOR - FULL MONTH ANALYSIS)
// ==========================================
async function generateMentorReport() {
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const btn = document.getElementById('btn-mentor-report');
    const out = document.getElementById('mentor-report-output');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing Full Month Data...'; 
    btn.disabled = true; 
    out.classList.add('hidden');

    try {
        // 1. سحب بيانات آخر 30 يوم من الداتابيز ليك ولشريكك
        let d = new Date();
        d.setDate(d.getDate() - 30);
        let startDateStr = d.toISOString().split('T')[0];

        let mySnapshot = await db.collection('users').doc(currentUser).collection('daily_records')
            .where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).get();
        
        let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
        let pSnapshot = await db.collection('users').doc(partnerUser).collection('daily_records')
            .where(firebase.firestore.FieldPath.documentId(), '>=', startDateStr).get();

        // 2. تجميع وتحليل البيانات بتاعتك
        let myTotalPts = 0; let myTotalUrt = 0; let myTotalSessions = 0; let myTotalTOC = 0;
        mySnapshot.forEach(doc => {
            let data = doc.data();
            myTotalPts += data.points || 0;
            if(data.subjects) {
                Object.values(data.subjects).forEach(tasks => {
                    myTotalUrt += (tasks.URT_Full || 0) + (tasks.URT_Pieces || 0);
                    myTotalTOC += (tasks.TOC_Normal || 0) + (tasks.TOC_Essay || 0);
                    Object.keys(tasks).forEach(k => {
                        if(k.includes('Session')) myTotalSessions += tasks[k];
                    });
                });
            }
        });

        // تجميع نقاط الشريك
        let pTotalPts = 0;
        pSnapshot.forEach(doc => { pTotalPts += doc.data().points || 0; });

        let examsTaken = typeof sharedExams !== 'undefined' ? sharedExams.filter(e => e.results && e.results[currentUser]).length : 0;
        let flashcardsCount = typeof myFlashcards !== 'undefined' ? myFlashcards.length : 0;

        // 3. تجهيز الداتا المرعبة للذكاء الاصطناعي
        let statsSummary = `
        Student: ${currentUser}
        Total Points (Last 30 Days): ${myTotalPts}
        Partner (${partnerUser}) Total Points: ${pTotalPts}
        Total URTs Solved: ${myTotalUrt}
        Total Study Sessions Watched: ${myTotalSessions}
        Total TOCs Solved: ${myTotalTOC}
        Total AI Exams Taken: ${examsTaken}
        Flashcards Created: ${flashcardsCount}
        `;

        const prompt = `Act as an elite, strict, but highly motivational STEM AI Mentor for ${currentUser} (a high school student in Egypt preparing for finals). 
        Analyze this comprehensive 30-day data: 
        ${statsSummary}
        
        YOUR MISSION:
        1. Give a deep, detailed analysis of their performance over the month (do not just repeat the numbers, analyze what they mean).
        2. Compare them fiercely but constructively with their partner (${partnerUser}). If they are losing, wake them up. If winning, tell them to crush it more.
        3. Point out exactly what they are doing well (e.g., URTs, Sessions) and what they might be neglecting.
        4. Give a strict, bulleted action plan for the next week.
        
        Respond in a mix of professional Arabic and motivational English. Use bullet points and bold text. Do NOT be brief; give a full, detailed, and powerful report.`;

        const selectedModel = document.getElementById('ai-model-select') ? document.getElementById('ai-model-select').value : 'llama-3.3-70b-versatile';

        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, 
            body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content: prompt }], temperature: 0.5 }) 
        });
        
        const data = await response.json();
        if(data.error) throw new Error(data.error.message);
        
        out.innerHTML = data.choices[0].message.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan">$1</strong>').replace(/\n/g, '<br>');
        out.classList.remove('hidden'); 
        showToast("Deep Mentor Report Generated!", "success");

    } catch(err) { 
        showToast("Mentor Error: " + err.message, "error"); 
    } finally { 
        btn.innerHTML = 'Generate Deep Report'; 
        btn.disabled = false; 
    }
}

// ==========================================
// 13. TEAM CHAT SYSTEM (V2 Bulletproof)
// ==========================================
const sendSound = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3'); 
const receiveSound = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');

let replyContext = null; 

function setReply(msgId, text, sender) {
    replyContext = { id: msgId, text: text, sender: sender };
    let banner = document.getElementById('chat-reply-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'chat-reply-banner';
        banner.style.cssText = "background: rgba(0,229,255,0.1); padding: 8px 15px; border-left: 3px solid var(--cyan); border-radius: 8px 8px 0 0; font-size: 12px; color: #fff; display: flex; justify-content: space-between; align-items: center; margin-bottom: -10px; z-index: 10;";
        const inputArea = document.querySelector('.chat-input-area');
        inputArea.parentNode.insertBefore(banner, inputArea);
    }
    banner.innerHTML = `<span><i class="fas fa-reply text-cyan"></i> Replying to <b>${sender}</b>: ${text.substring(0,30)}...</span> 
                        <button onclick="cancelReply()" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 16px;"><i class="fas fa-times"></i></button>`;
    document.getElementById('chat-input').focus();
}

function cancelReply() {
    replyContext = null;
    let banner = document.getElementById('chat-reply-banner');
    if(banner) banner.remove();
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    if(!input) return;
    const text = input.value.trim();
    if(!text) return;
    
    input.value = ''; 
    
    let payload = {
        text: text,
        sender: currentUser,
        timestamp: Date.now()
    };

    if (replyContext) {
        payload.replyTo = replyContext;
        cancelReply();
    }
    
    if(db) {
        sendSound.play().catch(e => console.log("Audio blocked by browser, but message will send.")); 
        try {
            await db.collection('team_chat').add(payload);
            let partnerUser = currentUser === 'Mamdouh' ? 'Sama' : 'Mamdouh';
            db.collection('users').doc(partnerUser).set({
                pendingChatAlert: { from: currentUser, msg: text.substring(0,20)+"...", time: Date.now() }
            }, { merge: true });
        } catch(err) {
            console.error("Error sending message:", err);
            showToast("Failed to send message.", "error");
        }
    }
}

document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'chat-input') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
});

async function addReaction(docId, emoji) {
    let updateData = {};
    updateData[`reactions.${currentUser}`] = emoji;
    await db.collection('team_chat').doc(docId).set(updateData, { merge: true });
}

async function deleteMessage(docId) {
    if(confirm("Are you sure you want to delete this message?")) {
        await db.collection('team_chat').doc(docId).delete();
    }
}

let isChatInitialLoad = true;
let chatUnsubscribeFinal = null; 

function startChatEngine() {
    if(!db) return;
    
    // 🟢 قفل أي مستمع قديم عشان نمنع التكرار (Memory Leak)
    if(window.chatUnsubscribeFinal) {
        window.chatUnsubscribeFinal(); 
    }

    const chatArea = document.getElementById('chat-messages-area');
    if(!chatArea) return;
    
    // 🟢 نمسح الشاشة مرة واحدة بس في البداية
    chatArea.innerHTML = '';
    isChatInitialLoad = true;

    window.chatUnsubscribeFinal = db.collection('team_chat')
        .orderBy('timestamp', 'asc')
        .limit(100) // تقدر تقللها لـ 50 لو حابب توفر أكتر
        .onSnapshot(snapshot => {
            
            // 🟢 التعامل مع التغييرات "فقط" مش تحميل كل الرسايل
            snapshot.docChanges().forEach(change => {
                const data = change.doc.data();
                const docId = change.doc.id;
                const isSent = data.sender === currentUser;
                
                // 1. لو رسالة جديدة انضافت
                if (change.type === 'added') {
                    if (!isChatInitialLoad && !isSent) {
                        receiveSound.play().catch(e=>{});
                    }
                    
                    let reactionsHtml = '';
                    if(data.reactions) {
                        let emojis = Object.values(data.reactions).join(' ');
                        if(emojis) reactionsHtml = `<div class="reactions-box" style="font-size:14px; margin-top:5px; background:rgba(0,0,0,0.5); display:inline-block; padding:3px 10px; border-radius:15px; border: 1px solid rgba(255,255,255,0.1); cursor:default;">${emojis}</div>`;
                    }

                    let replyHtml = '';
                    if (data.replyTo) {
                        replyHtml = `<div style="font-size: 11px; background: rgba(0,0,0,0.3); padding: 8px; border-left: 3px solid ${isSent ? '#000' : 'var(--cyan)'}; border-radius: 4px; margin-bottom: 8px; opacity: 0.8;">
                            <b style="color: ${isSent ? '#333' : 'var(--cyan)'};">${data.replyTo.sender}</b><br>
                            ${data.replyTo.text.substring(0, 50)}...
                        </div>`;
                    }

                    let safeText = data.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').substring(0, 50);
                    let actionsHtml = `<div class="msg-actions" style="display:none; font-size: 14px; margin-top: 5px; gap:12px; background: rgba(0,0,0,0.4); padding: 5px 15px; border-radius: 20px;">
                        <span style="cursor:pointer; transition: 0.2s;" title="Reply" onclick="setReply('${docId}', '${safeText}', '${data.sender}')">↩️</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Love" onclick="addReaction('${docId}', '❤️')">❤️</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Fire" onclick="addReaction('${docId}', '🔥')">🔥</span>
                        <span style="cursor:pointer; transition: 0.2s;" title="Rocket" onclick="addReaction('${docId}', '🚀')">🚀</span>
                        ${isSent ? `<span style="cursor:pointer; color:var(--danger);" title="Delete" onclick="deleteMessage('${docId}')">🗑️</span>` : ''}
                    </div>`;

                    // 🟢 إضافة الرسالة الجديدة في آخر الشات بدون مسح القديم
                    let msgDiv = document.createElement('div');
                    msgDiv.id = `msg-${docId}`;
                    msgDiv.className = "message-wrapper";
                    msgDiv.style.cssText = `display:flex; flex-direction:column; align-items: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;`;
                    msgDiv.onmouseenter = function() { this.querySelector('.msg-actions').style.display='flex'; };
                    msgDiv.onmouseleave = function() { this.querySelector('.msg-actions').style.display='none'; };
                    
                    msgDiv.innerHTML = `
                        <div class="message-bubble ${isSent ? 'message-sent' : 'message-received'}" style="position: relative; min-width: 100px;">
                            ${replyHtml}
                            <div style="font-size:15px; font-weight: 500;">${data.text}</div>
                            ${reactionsHtml || '<div class="reactions-container"></div>'}
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            ${isSent ? actionsHtml : ''}
                            <span class="message-meta" style="font-size:10px; color:var(--text-muted);">${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            ${!isSent ? actionsHtml : ''}
                        </div>
                    `;
                    chatArea.appendChild(msgDiv);
                    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
                } 
                
                // 2. لو رسالة اتعدلت (مثلاً أخدت رياكشن)
                else if (change.type === 'modified') {
                    let msgDiv = document.getElementById(`msg-${docId}`);
                    if(msgDiv && data.reactions) {
                        let emojis = Object.values(data.reactions).join(' ');
                        let reactionsContainer = msgDiv.querySelector('.reactions-container') || msgDiv.querySelector('.reactions-box');
                        if (reactionsContainer) {
                            reactionsContainer.outerHTML = emojis ? `<div class="reactions-box" style="font-size:14px; margin-top:5px; background:rgba(0,0,0,0.5); display:inline-block; padding:3px 10px; border-radius:15px; border: 1px solid rgba(255,255,255,0.1); cursor:default;">${emojis}</div>` : '<div class="reactions-container"></div>';
                        }
                    }
                }

                // 3. لو رسالة اتمسحت
                else if (change.type === 'removed') {
                    let msgDiv = document.getElementById(`msg-${docId}`);
                    if(msgDiv) msgDiv.remove();
                }
            });
            
            isChatInitialLoad = false;
        });
}
// ==========================================
// 14. MATERIALS VAULT
// ==========================================
function openFolder(subjectName) {
    currentMaterialSubject = subjectName;
    document.getElementById('materials-folders').classList.add('hidden');
    document.getElementById('materials-files-view').classList.remove('hidden');
    document.getElementById('current-folder-title').innerHTML = `<i class="fas fa-folder-open"></i> ${subjectName} Vault`;
    
    loadFilesForSubject();
}

function backToFolders() {
    document.getElementById('materials-files-view').classList.add('hidden');
    document.getElementById('materials-folders').classList.remove('hidden');
    currentMaterialSubject = "";
}

function loadFilesForSubject() {
    if(!db) return;
    if(materialsUnsubscribe) materialsUnsubscribe();
    
    materialsUnsubscribe = db.collection('shared_materials')
                             .where('subject', '==', currentMaterialSubject)
                             .onSnapshot(snap => {
        const area = document.getElementById('files-list-area');
        if(!area) return;
        area.innerHTML = '';
        
        if(snap.empty) {
            area.innerHTML = `<p class="text-muted text-center mt-20">No files here yet. Upload some!</p>`;
            return;
        }

        let filesArray = [];
        snap.forEach(doc => {
            let data = doc.data();
            data.id = doc.id; 
            filesArray.push(data);
        });
        filesArray.sort((a, b) => b.timestamp - a.timestamp);

        filesArray.forEach(fileData => {
            let dateStr = new Date(fileData.timestamp).toLocaleDateString();
            
            let iconClass = 'fa-file-alt text-cyan';
            if(fileData.url.toLowerCase().includes('.pdf')) iconClass = 'fa-file-pdf text-danger';
            if(fileData.url.toLowerCase().includes('.jpg') || fileData.url.toLowerCase().includes('.png')) iconClass = 'fa-image text-success';
            
            area.innerHTML += `
                <div class="file-item">
                    <div class="file-item-name">
                        <strong style="font-size: 14px;"><i class="fas ${iconClass}"></i> ${fileData.fileName}</strong><br>
                        <span class="file-item-meta" style="font-size: 11px;">Uploaded by <b>${fileData.uploadedBy}</b> on ${dateStr}</span>
                    </div>
                    <button id="btn-down-${fileData.id}" class="btn-primary-small bg-cyan" style="padding: 6px 15px; color: black; font-weight: bold; border-radius: 6px; min-width: 115px;" onclick="downloadMaterial('${fileData.url}', '${fileData.fileName}', 'btn-down-${fileData.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
        });
    });
}

async function uploadMaterial() {
    const fileInput = document.getElementById('file-upload-input');
    const file = fileInput.files[0];
    const btn = document.getElementById('btn-upload-file');
    
    if(!file) return showToast("Please select a file first.", "error");
    if(!currentMaterialSubject) return showToast("Error: No subject selected.", "error");

    let fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Preparing to upload ${fileSizeMB} MB...`;

    const cloudName = "dtedxyodg"; 
    const uploadPreset = "stem_materials"; 
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    let startTime = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            let progress = ((e.loaded / e.total) * 100).toFixed(1);
            let elapsedTime = (Date.now() - startTime) / 1000;
            let speed = e.loaded / elapsedTime;
            let remainingBytes = e.total - e.loaded;
            let estimatedTimeSec = remainingBytes / speed;

            let timeText = "";
            if (!isFinite(estimatedTimeSec) || estimatedTimeSec < 0) {
                timeText = "Calculating...";
            } else if(estimatedTimeSec > 60) {
                timeText = (estimatedTimeSec / 60).toFixed(1) + " Min";
            } else if (estimatedTimeSec > 1) {
                timeText = Math.ceil(estimatedTimeSec) + " Sec";
            } else {
                timeText = "Almost done...";
            }

            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${progress}% of ${fileSizeMB}MB (Time: ${timeText})`;
        }
    };

    xhr.onload = async function() {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            const downloadURL = response.secure_url;

            if(db) {
                await db.collection('shared_materials').add({
                    fileName: file.name,
                    url: downloadURL,
                    subject: currentMaterialSubject,
                    uploadedBy: currentUser,
                    timestamp: Date.now()
                });
            }

            showToast("File Uploaded Successfully!", "success");
            fileInput.value = '';
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
            btn.disabled = false;
        } else {
            showToast("Upload failed from server.", "error");
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
            btn.disabled = false;
        }
    };

    xhr.onerror = function() {
        showToast("Network Error!", "error");
        btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Upload File';
        btn.disabled = false;
    };

    xhr.send(formData);
}

function downloadMaterial(url, fileName, btnId) {
    const btn = document.getElementById(btnId);
    if(!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 0%`;

    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob'; 

    xhr.onprogress = function(e) {
        if (e.lengthComputable) {
            let progress = ((e.loaded / e.total) * 100).toFixed(0);
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${progress}%`;
        } else {
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Loading...`;
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const blob = xhr.response;
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = fileName; 
            document.body.appendChild(link);
            link.click(); 
            document.body.removeChild(link);
            window.URL.revokeObjectURL(link.href);

            btn.innerHTML = `<i class="fas fa-check"></i> Done`;
            btn.classList.replace('bg-cyan', 'bg-success');
            
            setTimeout(() => {
                btn.innerHTML = `<i class="fas fa-download"></i> Download`;
                btn.classList.replace('bg-success', 'bg-cyan');
                btn.disabled = false;
            }, 3000);
        } else {
            window.open(url, '_blank');
            btn.innerHTML = `<i class="fas fa-download"></i> Download`;
            btn.disabled = false;
        }
    };

    xhr.onerror = function() {
        window.open(url, '_blank');
        btn.innerHTML = `<i class="fas fa-download"></i> Download`;
        btn.disabled = false;
    };

    xhr.send();
}

// ==========================================
// 15. SUPER AI ANALYZER
// ==========================================
function loadCompletedExamsForAI() {
    const select = document.getElementById('super-ai-exam-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Choose a completed exam to analyze --</option>';
    
    const completedExams = sharedExams.filter(exam => exam.results && exam.results[currentUser]);
    
    if (completedExams.length === 0) {
        select.innerHTML = '<option value="">No completed exams found yet.</option>';
        return;
    }

    completedExams.forEach(exam => {
        let res = exam.results[currentUser];
        select.innerHTML += `<option value="${exam.id}">${exam.title} (Score: ${res.correct}/${exam.questions.length})</option>`;
    });
}

async function runSuperAnalysis() {
    const apiKey = localStorage.getItem('ai_api_key');
    if(!apiKey) return showToast("Please save Groq API Key first.", "error");

    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId) return showToast("Please select an exam.", "error");

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];

    const btn = document.getElementById('btn-run-analysis');
    const resultBox = document.getElementById('super-analysis-result');
    const contentDiv = document.getElementById('super-ai-content');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Brainstorming Analysis...';
    btn.disabled = true;
    resultBox.classList.add('hidden');

    let diagnosticData = `Exam Title: ${examData.title}\n`;
    diagnosticData += `Student Score: ${userResult.correct} correct, ${userResult.wrong} wrong out of ${examData.questions.length}.\n\n`;
    diagnosticData += `--- Detailed Performance ---\n`;

    examData.questions.forEach((q, index) => {
        let correctAnsText = q.opts[q.ans];
        let userAnsInt = userResult.answers[index];
        let userAnsText = userAnsInt !== null ? q.opts[userAnsInt] : "Skipped";
        let status = (userAnsInt === parseInt(q.ans)) ? "✅ CORRECT" : "❌ WRONG";

        diagnosticData += `Q${index + 1}: ${q.q}\n`;
        diagnosticData += `Correct Answer: ${correctAnsText}\n`;
        diagnosticData += `Student Answer: ${userAnsText} (${status})\n\n`;
    });

    const systemPrompt = `You are an elite academic diagnostician. The user is a STEM student in Egypt. Mix clear English with natural Egyptian Arabic.
    
    YOUR EXCLUSIVE MISSION:
    1. 🎯 Quick Overview: Briefly encourage the student based on their score.
    2. 🧠 THE AUTOPSY (Crucial): Focus ONLY on the WRONG answers. Iterate through EVERY single wrong question one by one.
       For EACH wrong question, strictly provide:
       - Question number & brief recap.
       - The Exact Concept/Law/Grammar Rule needed to solve it (Explain it perfectly).
       - The Formula or Definition clearly stated.
       - Why their specific wrong answer was incorrect.
    
    CRITICAL MATH RULES:
    - Double-escape all backslashes (e.g., \\\\frac).
    - Wrap ALL math in $ for inline and $$ for display math.`;

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ 
                model: 'llama-3.3-70b-versatile', 
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: diagnosticData }], 
                temperature: 0.4,
                max_tokens: 6000
            })
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawExplanation = data.choices[0].message.content;
        let mathBlocks = [];
        let safeText = rawExplanation.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => { mathBlocks.push(`$$${p1}$$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => { mathBlocks.push(`$${p1}$`); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\$\$([\s\S]*?)\$\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; })
                                     .replace(/\$([\s\S]*?)\$/g, (m) => { mathBlocks.push(m); return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`; });

        let formattedHTML = typeof marked !== 'undefined' ? marked.parse(safeText) : safeText;
        formattedHTML = formattedHTML.replace(/<strong>(.*?)<\/strong>/g, '<strong class="text-cyan">$1</strong>');
        
        mathBlocks.forEach((block, index) => {
            formattedHTML = formattedHTML.replace(`@@MATH_BLOCK_${index}@@`, block);
        });

        contentDiv.innerHTML = formattedHTML;
        resultBox.classList.remove('hidden');

        if (window.MathJax) MathJax.typesetPromise([contentDiv]);

    } catch(err) {
        showToast("Analysis Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-microchip"></i> Run Deep Analysis';
        btn.disabled = false;
    }
}

async function generateCloneExam() {
    const apiKey = localStorage.getItem('ai_api_key');
    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId || !apiKey) return showToast("Select an exam and save API key.", "error");

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];
    const btn = document.getElementById('btn-clone-exam');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cloning...';
    btn.disabled = true;

    let promptData = `Original Exam Title: ${examData.title}\n`;
    examData.questions.forEach((q, i) => {
        let status = userResult.answers[i] === parseInt(q.ans) ? "Correct" : "Wrong";
        promptData += `Q${i+1} (${status}): ${q.q}\nOptions: ${JSON.stringify(q.opts)}\nCorrect Ans Index: ${q.ans}\n\n`;
    });

    const systemPrompt = `You are an elite AI exam cloner. Create a NEW exam based on the provided one.
    - Generate EXACTLY the same number of questions.
    - Test the EXACT SAME concepts, but change the numbers, names, and scenarios completely.
    - Pay special attention to questions marked "Wrong" and make sure to thoroughly test those weak concepts again.
    - Format MUST be exactly a JSON array: [{"q": "Question", "opts": ["A", "B", "C", "D"], "ans": 0}].
    CRITICAL MATH RULES: Double-escape backslashes (\\\\frac) and wrap math in $ or $$. DO NOT wrap in markdown. Output ONLY raw JSON.`;

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: "system", content: systemPrompt }, { role: "user", content: promptData }], temperature: 0.3 })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        let rawOutput = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        let parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : rawOutput);
        let questionsArray = Array.isArray(parsedData) ? parsedData : parsedData.questions;

        if(db && questionsArray.length > 0) {
            await db.collection('shared_exams').add({
                title: "[Remix] " + examData.title,
                questions: questionsArray,
                createdBy: currentUser,
                timeLimit: examData.timeLimit,
                linkedTask: examData.linkedTask,
                isURT: examData.isURT,
                savedPassage: examData.savedPassage,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                results: {}
            });
            showToast("Clone Exam Ready! Go to Exams Tab.", "success");
        }
    } catch(err) {
        showToast("Cloning Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-clone"></i> Generate Similar Exam';
        btn.disabled = false;
    }
}

async function saveWeaknessesAsCards() {
    const apiKey = localStorage.getItem('ai_api_key');
    const examId = document.getElementById('super-ai-exam-select').value;
    if(!examId || !apiKey) return;

    const examData = sharedExams.find(e => e.id === examId);
    const userResult = examData.results[currentUser];
    const btn = document.getElementById('btn-weakness-cards');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Extracting Cards...';
    btn.disabled = true;

    let wrongData = "";
    examData.questions.forEach((q, i) => {
        if (userResult.answers[i] !== parseInt(q.ans)) {
            wrongData += `Concept of Question: ${q.q}\nCorrect Answer was: ${q.opts[q.ans]}\n\n`;
        }
    });

    if(!wrongData) {
        showToast("No wrong answers to extract! You are perfect. 🌟", "success");
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Save Weaknesses as Cards';
        btn.disabled = false;
        return;
    }

    const systemPrompt = `You are a flashcard generator. Look at these missed questions.
    Identify the core formula, vocabulary word, or scientific rule required for each.
    Generate a flashcard for EACH wrong concept.
    Format MUST be exactly a JSON array: [{"q": "Name of Formula/Concept/Word", "a": "The formula itself or definition"}].
    CRITICAL MATH RULES: Double-escape backslashes (\\\\frac) and wrap math in $ or $$. DO NOT wrap in markdown. Output ONLY raw JSON.`;

    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: "system", content: systemPrompt }, { role: "user", content: wrongData }], temperature: 0.1 })
        });
        const data = await response.json();
        
        let rawOutput = data.choices[0].message.content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawOutput.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        let cardsArray = JSON.parse(jsonMatch ? jsonMatch[0] : rawOutput);

        if(db && cardsArray.length > 0) {
            let batch = db.batch();
            cardsArray.forEach(card => {
                let refMamdouh = db.collection('flashcards').doc();
                batch.set(refMamdouh, {
                    front: card.q, back: card.a, createdBy: "Mamdouh",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    nextReview: new Date().toISOString(), interval: 1, easeFactor: 2.5
                });
                
                let refSama = db.collection('flashcards').doc();
                batch.set(refSama, {
                    front: card.q, back: card.a, createdBy: "Sama",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    nextReview: new Date().toISOString(), interval: 1, easeFactor: 2.5
                });
            });
            await batch.commit();
            showToast(`${cardsArray.length} Cards added to BOTH your decks! 🚀`, "success");
        }
    } catch(err) {
        showToast("Extraction Failed: " + err.message, "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-layer-group"></i> Save Weaknesses as Cards';
        btn.disabled = false;
    }
}