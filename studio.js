/*
 * Studio module for STEM Battle OS.
 * Isolated from script.js to preserve the existing learning/chat/exam flows.
 * Shared Firestore data is best-effort; local backup is always kept.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'mortaqa_studio_projects_v1';
  const CATALOG_STORAGE_KEY = 'mortaqa_studio_material_catalog_v1';
  const DEFAULT_MATERIALS = [
    ['MQ sensor module','Sensors'],['MQ-2 gas sensor','Sensors'],['MQ-3 alcohol sensor','Sensors'],['MQ-7 carbon monoxide sensor','Sensors'],['MQ-135 air-quality sensor','Sensors'],['MQ-16 gas sensor','Sensors'],
    ['HC-SR04 ultrasonic sensor','Sensors'],['IR obstacle sensor','Sensors'],['PIR motion sensor','Sensors'],['MPU6050 IMU','Sensors'],['MAX30102 heart-rate / SpO₂ sensor','Sensors'],['FSR pressure sensor','Sensors'],['Load cell','Sensors'],['HX711 load-cell amplifier','Sensors'],['Flex sensor','Sensors'],['GSR sensor','Sensors'],['DS18B20 temperature sensor','Sensors'],['DHT22 temperature/humidity sensor','Sensors'],['MLX90614 non-contact temperature sensor','Sensors'],['GPS module','Sensors'],['RFID reader','Sensors'],['Sound sensor','Sensors'],['Flame sensor','Sensors'],['Soil-moisture sensor','Sensors'],
    ['Raspberry Pi Zero 2 W','Computing'],['Raspberry Pi 3 Model B+','Computing'],['Raspberry Pi 4 4GB','Computing'],['Raspberry Pi 5','Computing'],['Raspberry Pi power supply','Computing'],['MicroSD card','Computing'],['Raspberry Pi Camera Module','Computing'],['USB webcam','Computing'],['Microphone','Audio'],['Speaker','Audio'],['USB sound card','Audio'],['Power bank','Power'],['18650 battery','Power'],['Battery holder','Power'],['TP4056 charging module','Power'],['5V buck converter','Power'],['USB-C cable','Power'],['HDMI cable','Computing'],
    ['Arduino Uno','Controllers'],['ESP32 development board','Controllers'],['ESP8266 NodeMCU','Controllers'],['Breadboard','Electronics'],['Jumper wires M-M','Electronics'],['Jumper wires M-F','Electronics'],['Jumper wires F-F','Electronics'],['Resistor kit','Electronics'],['Capacitor kit','Electronics'],['LED assorted kit','Electronics'],['RGB LED','Electronics'],['NeoPixel / WS2812 LED strip','Electronics'],['Push button','Electronics'],['Buzzer','Electronics'],['Relay module','Electronics'],['MOSFET / transistor kit','Electronics'],['Diode kit','Electronics'],['Potentiometer','Electronics'],['Perfboard / prototype PCB','Electronics'],
    ['SG90 servo motor','Actuators'],['MG996R servo motor','Actuators'],['DC gear motor','Actuators'],['Stepper motor','Actuators'],['Motor driver L298N','Actuators'],['Motor driver TB6612FNG','Actuators'],['Mini air pump','Actuators'],['Solenoid valve','Actuators'],['Vibration motor','Actuators'],['Cooling fan','Actuators'],
    ['OLED 0.96 inch display','Displays'],['LCD 16x2 display','Displays'],['TFT display','Displays'],['Neoprene / fabric glove','Mechanical'],['Crutch / frame parts','Mechanical'],['3D-printed enclosure','Mechanical'],['Acrylic sheet','Mechanical'],['Screws and standoffs kit','Mechanical'],['Heat-shrink tubing','Mechanical'],['Soldering supplies','Tools'],['Double-sided tape / adhesive','Tools'],['USB hub','Computing'],['Mini speaker amplifier','Audio'],['Headphones','Audio'],['Custom PCB fabrication','Manufacturing'],['3D printing service','Manufacturing'],['Wires / hookup wire','Electronics'],['Connector kit','Electronics'],['Breadboard power module','Electronics']
  ].map(([name, category]) => ({ id: `std-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`, name, category, standard: true }));
  let materialCatalog = [];
  let editingMaterialId = null;
  let editingMaterialProjectId = null;
  let projects = [];
  let activeProjectId = null;
  let activeUser = null;
  let loadPromise = null;
  let financialChart = null;
  let lastPublicSnapshot = null;
  let firebaseReadable = false;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const nowISO = () => new Date().toISOString();
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const money = (n) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(n) || 0);
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  function readLocal() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  }
  function mergeCatalog(...lists) {
    const byName = new Map();
    lists.flat().forEach(item => {
      const name = String(item?.name || '').trim(); if (!name) return;
      const key = name.toLocaleLowerCase();
      if (!byName.has(key)) byName.set(key, { id: item.id || uid(), name, category: item.category || 'عام', standard: !!item.standard, createdAt: item.createdAt || '' });
      else if (!byName.get(key).standard && item.standard) byName.set(key, { ...byName.get(key), ...item, name });
    });
    return [...byName.values()].sort((a,b) => a.name.localeCompare(b.name, 'en'));
  }
  function writeCatalogLocal() { try { localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(materialCatalog)); } catch (error) { console.warn('[Studio] Material catalog local save failed', error); } }
  async function loadMaterialCatalog() {
    let local = []; try { const v = JSON.parse(localStorage.getItem(CATALOG_STORAGE_KEY) || '[]'); if (Array.isArray(v)) local = v; } catch (_) {}
    materialCatalog = mergeCatalog(DEFAULT_MATERIALS, local);
    if (typeof db !== 'undefined' && db && typeof firebase !== 'undefined') {
      try { const snap = await db.collection('studio_material_catalog').get(); materialCatalog = mergeCatalog(materialCatalog, snap.docs.map(d => ({ ...d.data(), id: d.id }))); } catch (error) { console.warn('[Studio] Shared material catalog unavailable; local catalog retained.', error); }
    }
    writeCatalogLocal();
  }
  async function saveCatalogItem(item) {
    const name = String(item?.name || '').trim(); if (!name) return false;
    const existing = materialCatalog.find(x => x.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) { studioToast('المادة موجودة بالفعل في القائمة المشتركة.', 'info'); return false; }
    const record = { id: uid(), name, category: String(item.category || 'Custom').trim() || 'Custom', standard: false, createdAt: nowISO() };
    materialCatalog = mergeCatalog(materialCatalog, [record]); writeCatalogLocal(); renderStudioGlobalPanel();
    if (typeof db !== 'undefined' && db && typeof firebase !== 'undefined') {
      try { await db.collection('studio_material_catalog').doc(record.id).set(record, { merge: true }); } catch (error) { console.warn('[Studio] Material catalog cloud sync unavailable.', error); }
    }
    studioToast('اتضافت المادة لقائمة المواد لاستخدامها في المشاريع القادمة.', 'success'); return true;
  }
  function writeLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
    catch (error) { studioToast('تعذر حفظ النسخة المحلية: ' + error.message, 'error'); }
  }
  function studioToast(message, type) {
    if (typeof showToast === 'function') showToast(message, type || 'info');
    else console.log(`[Studio] ${message}`);
  }
  function labelStatus(status) {
    return ({ planning:'قيد التخطيط', active:'جارٍ التنفيذ', review:'مراجعة واختبار', delivered:'تم التسليم', paused:'متوقف مؤقتًا' })[status] || 'قيد التخطيط';
  }
  function stepStatusLabel(status) {
    return ({ planned:'لم تبدأ', active:'جارٍ التنفيذ', done:'مكتملة', blocked:'متوقفة' })[status] || 'لم تبدأ';
  }
  function projectStats(project) {
    const materials = (project.materials || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const tx = project.ledger || [];
    const received = tx.filter(x => x.type === 'received').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const expenses = tx.filter(x => x.type === 'expense').reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const contract = Number(project.contractValue) || 0;
    const due = Math.max(0, contract - received);
    const paid = Math.max(0, received);
    return { materials, received: paid, expenses, contract, due, expectedMargin: contract - materials - expenses, stepsDone: (project.timeline || []).filter(s => s.status === 'done').length, stepsTotal: (project.timeline || []).length };
  }
  function generatedTimeline(start, due) {
    const names = [
      ['تثبيت فكرة المشروع والنطاق', 'اعتماد المشكلة والحل والمخرجات المطلوبة.'],
      ['بحث المواد والموردين', 'حصر القطع، الكميات، الأسعار وروابط الشراء.'],
      ['التصميم والتقسيم إلى مهام', 'رسم المخطط وتوزيع المسؤوليات على أعضاء الفريق.'],
      ['التجميع والتنفيذ', 'شراء وتجهيز المواد وبناء النسخة العملية.'],
      ['البرمجة والدمج', 'دمج المكونات والبرمجيات والاتصال بين الوحدات.'],
      ['الاختبار والتحسين', 'اختبارات وظيفية وتسجيل الأخطاء وإصلاحها.'],
      ['التوثيق والتصوير', 'تجهيز الصور والفيديو والتقرير النهائي.'],
      ['التسليم والعرض النهائي', 'مراجعة معايير التسليم وإغلاق الملاحظات.']
    ];
    const begin = start ? new Date(`${start}T12:00:00`) : new Date();
    const finish = due ? new Date(`${due}T12:00:00`) : new Date(begin.getTime() + 28 * 86400000);
    let duration = Math.max(1, Math.round((finish - begin) / 86400000));
    return names.map((pair, index) => {
      const stepDate = new Date(begin.getTime() + Math.round(duration * (index + 1) / names.length) * 86400000);
      return { id: uid(), title: pair[0], description: pair[1], owner: 'Unknown', dueDate: stepDate.toISOString().slice(0, 10), status: 'planned', completedAt: null, notes: '' };
    });
  }
  function normalizeProject(p) {
    const project = { ...p };
    project.materials = Array.isArray(project.materials) ? project.materials : [];
    project.meetings = Array.isArray(project.meetings) ? project.meetings : [];
    project.members = Array.isArray(project.members) ? project.members : (String(project.teamMembers || '').trim() && !['Unknown','unknown','-'].includes(String(project.teamMembers).trim()) ? String(project.teamMembers).split(/[،,;\n]+/).map(name => name.trim()).filter(Boolean).map(name => ({ id: uid(), name, phone: '', role: 'عضو فريق' })) : []);
    project.deliveryMode = project.deliveryMode || 'full';
    if (project.meetingDate === 'Unknown') project.meetingDate = '';
    if (project.meetingLink === 'Unknown') project.meetingLink = '';
    if (project.whatsappLink === 'Unknown') project.whatsappLink = '';
    project.teamScope = project.teamScope || 'Unknown';
    project.schoolScope = project.schoolScope || 'Unknown';
    project.timeline = Array.isArray(project.timeline) ? project.timeline : [];
    project.ledger = Array.isArray(project.ledger) ? project.ledger : [];
    project.media = Array.isArray(project.media) ? project.media : [];
    project.aiChatHistory = Array.isArray(project.aiChatHistory) ? project.aiChatHistory : [];
    project.tasks = Array.isArray(project.tasks) ? project.tasks : [];
    project.status = project.status || 'planning';
    project.school = project.school || 'Unknown';
    project.createdBy = project.createdBy || 'Unknown';
    project.updatedAt = project.updatedAt || project.createdAt || nowISO();
    return project;
  }

  async function loadProjects() {
    await loadMaterialCatalog();
    const local = readLocal().map(normalizeProject);
    projects = local.slice();
    firebaseReadable = false;
    if (typeof db !== 'undefined' && db && typeof firebase !== 'undefined') {
      try {
        const snap = await db.collection('studio_projects').get();
        const remote = snap.docs.map(doc => normalizeProject({ ...doc.data(), id: doc.id }));
        const byId = new Map(remote.map(p => [p.id, p]));
        local.forEach(p => {
          const remoteVersion = byId.get(p.id);
          if (!remoteVersion || String(p.updatedAt || '') > String(remoteVersion.updatedAt || '')) byId.set(p.id, p);
        });
        projects = Array.from(byId.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        firebaseReadable = true;
        writeLocal();
      } catch (error) {
        // The source project may not allow new collections under current Firestore rules.
        console.warn('[Studio] Firestore read unavailable; preserving local data.', error);
      }
    }
    if (!activeProjectId && projects.length) activeProjectId = projects[0].id;
    if (activeProjectId && !projects.some(p => p.id === activeProjectId)) activeProjectId = projects[0]?.id || null;
    renderStudio();
  }

  async function persistProject(project, quiet) {
    project.updatedAt = nowISO();
    if (!project.createdAt) project.createdAt = project.updatedAt;
    if (!project.createdBy || project.createdBy === 'Unknown') project.createdBy = activeUser || 'Unknown';
    const index = projects.findIndex(p => p.id === project.id);
    if (index >= 0) projects[index] = normalizeProject(project); else projects.unshift(normalizeProject(project));
    activeProjectId = project.id;
    writeLocal();
    renderStudio();
    if (typeof db !== 'undefined' && db && typeof firebase !== 'undefined') {
      try {
        const payload = { ...project };
        await db.collection('studio_projects').doc(project.id).set(payload, { merge: true });
        firebaseReadable = true;
        if (!quiet) studioToast('تم حفظ المشروع ومزامنته مع Firestore.', 'success');
        const statusEl = $('studio-sync-status');
        if (statusEl) statusEl.textContent = 'متصل • Firestore sync';
        return true;
      } catch (error) {
        console.warn('[Studio] Firestore write unavailable; local copy retained.', error);
        if (!quiet) studioToast('اتحفظت نسخة على هذا الجهاز، لكن مزامنة الفريق تحتاج ضبط صلاحيات Firestore: ' + (error.code || error.message), 'error');
        const statusEl = $('studio-sync-status');
        if (statusEl) statusEl.textContent = 'حفظ محلي • المزامنة تحتاج صلاحيات';
        return false;
      }
    }
    if (!quiet) studioToast('تم الحفظ على هذا الجهاز. أضف Firebase للنسخ المتزامنة بين أعضاء الفريق.', 'info');
    return false;
  }

  function renderStudio() {
    const list = $('studio-project-list');
    if (!list) return;
    const kpis = $('studio-kpis');
    const active = projects.find(p => p.id === activeProjectId) || null;
    const all = projects.map(projectStats);
    const totalContract = all.reduce((s, x) => s + x.contract, 0);
    const totalReceived = all.reduce((s, x) => s + x.received, 0);
    const totalDue = all.reduce((s, x) => s + x.due, 0);
    const openProjects = projects.filter(p => p.status !== 'delivered').length;
    if (kpis) kpis.innerHTML = `
      <article class="studio-kpi kpi-a"><span>المشاريع الحالية</span><strong>${openProjects}</strong><small>${projects.length} مشروع مسجل</small></article>
      <article class="studio-kpi kpi-b"><span>قيمة التعاقدات</span><strong>${money(totalContract)}</strong><small>قيمة المشاريع المسجلة</small></article>
      <article class="studio-kpi kpi-c"><span>تم تحصيله</span><strong>${money(totalReceived)}</strong><small>إجمالي الدفعات المستلمة</small></article>
      <article class="studio-kpi kpi-d"><span>متبقي للتحصيل</span><strong>${money(totalDue)}</strong><small>مبالغ متوقعة من العملاء</small></article>`;
    ensureStudioGlobalPanel();
    renderStudioGlobalPanel();
    list.innerHTML = projects.length ? projects.map(p => {
      const s = projectStats(p);
      const selected = p.id === activeProjectId ? ' selected' : '';
      return `<button type="button" class="studio-project-card${selected}" onclick="selectStudioProject('${esc(p.id)}')">
        <span class="studio-project-card-top"><span class="studio-project-icon"><i class="fas fa-microchip"></i></span><span class="studio-status status-${esc(p.status)}">${esc(labelStatus(p.status))}</span></span>
        <strong>${esc(p.name || 'مشروع بدون اسم')}</strong><span class="studio-project-school">${esc(p.school || 'Unknown')} • ${esc(p.teamNumber || 'Team ID: Unknown')}</span>
        <span class="studio-project-card-bottom"><span><i class="far fa-calendar"></i> ${esc(p.deadline || 'موعد غير محدد')}</span><span>${s.stepsDone}/${s.stepsTotal} خطوات</span></span>
      </button>`;
    }).join('') : `<div class="studio-empty-small"><i class="fas fa-folder-open"></i><strong>لسه مفيش مشاريع</strong><span>ابدأ بمشروع واحد، وكل ملفاته وخطته وميزانيته هتتجمع هنا.</span></div>`;
    const detail = $('studio-project-detail');
    const empty = $('studio-empty-state');
    if (active) {
      if (empty) empty.classList.add('hidden');
      if (detail) { detail.classList.remove('hidden'); renderProjectDetail(active, detail); }
    } else {
      if (detail) { detail.classList.add('hidden'); detail.innerHTML = ''; }
      if (empty) empty.classList.remove('hidden');
    }
    const status = $('studio-sync-status');
    if (status && !status.textContent) status.textContent = firebaseReadable ? 'متصل • Firestore sync' : 'حفظ محلي متاح';
  }

  function ensureStudioGlobalPanel() {
    const kpis = $('studio-kpis');
    if (kpis && !$('studio-global-ops')) kpis.insertAdjacentHTML('afterend', '<div id="studio-global-ops" class="studio-global-ops"></div>');
  }
  function isFutureMeeting(value) { const date = new Date(String(value || '')); return !!value && value !== 'Unknown' && !Number.isNaN(date.getTime()) && date.getTime() >= Date.now(); }
  function projectMeetings(project) {
    const meetings = (project.meetings || []).map(m => ({ ...m, projectId: project.id, projectName: project.name || 'مشروع بدون اسم' }));
    if (project.meetingDate && project.meetingDate !== 'Unknown' && !meetings.some(m => String(m.dateTime || '') === String(project.meetingDate || ''))) {
      meetings.push({ id: `legacy-${project.id}`, projectId: project.id, projectName: project.name || 'مشروع بدون اسم', title: 'اجتماع المشروع', dateTime: project.meetingDate, link: project.meetingLink || '', notes: 'موعد الاجتماع القادم المسجل في بيانات المشروع', legacy: true });
    }
    return meetings;
  }
  function materialSummary() {
    const items = new Map();
    projects.forEach(project => (project.materials || []).forEach(item => {
      const name = String(item.name || 'مادة بدون اسم').trim(); const key = name.toLocaleLowerCase();
      const row = items.get(key) || { name, quantity: 0, ordered: 0, bought: 0, received: 0, estimatedCost: 0, projects: new Set(), lines: 0 };
      const qty = Number(item.quantity) || 0; row.quantity += qty; row.estimatedCost += qty * (Number(item.unitPrice) || 0); row.projects.add(project.id); row.lines += 1;
      if (['ordered','bought','received'].includes(item.status)) row.ordered += qty;
      if (['bought','received'].includes(item.status)) row.bought += qty;
      if (item.status === 'received') row.received += qty;
      items.set(key, row);
    }));
    return [...items.values()].map(row => ({ ...row, projectsCount: row.projects.size, remainingToOrder: Math.max(0, row.quantity-row.ordered), remainingToReceive: Math.max(0, row.quantity-row.received) })).sort((a,b) => b.quantity-a.quantity || a.name.localeCompare(b.name));
  }
  function renderStudioGlobalPanel() {
    const root = $('studio-global-ops'); if (!root) return;
    const meetings = projects.flatMap(projectMeetings).filter(m => m.dateTime && m.dateTime !== 'Unknown')
      .sort((a,b) => String(a.dateTime).localeCompare(String(b.dateTime)));
    const catalogOptions = materialCatalog.map(item => `<option value="${esc(item.name)}">${esc(item.category || 'عام')}</option>`).join('');
    const summary = materialSummary();
    const totalQty = summary.reduce((sum, x) => sum + x.quantity, 0);
    const totalCost = summary.reduce((sum, x) => sum + x.estimatedCost, 0);
    const totalUpcoming = meetings.filter(m => isFutureMeeting(m.dateTime)).length;
    root.innerHTML = `
      <datalist id="studio-material-catalog">${catalogOptions}</datalist>
      <section class="studio-global-panel">
        <div class="studio-section-heading"><div><span class="eyebrow">TEAM CALENDAR</span><h3>مواعيد الاجتماعات لكل المشاريع</h3></div><span class="studio-status status-active">${totalUpcoming} قادم / مجدول</span></div>
        <div class="studio-global-meetings">${meetings.length ? meetings.map(m => `<article class="studio-global-meeting"><span class="studio-global-meeting-icon"><i class="fas fa-video"></i></span><div class="studio-global-meeting-main"><strong>${esc(m.title || 'اجتماع المشروع')}</strong><small>${esc(m.projectName)} • ${esc(String(m.dateTime).replace('T',' '))}</small></div><div class="studio-global-meeting-actions">${m.link ? `<a class="studio-btn tiny primary" href="${esc(m.link)}" target="_blank" rel="noopener">فتح الاجتماع</a>` : '<span class="studio-status">الرابط غير مضاف</span>'}<button type="button" class="studio-btn tiny" onclick="selectStudioProject('${esc(m.projectId)}')">فتح المشروع</button></div></article>`).join('') : '<div class="studio-empty-small">لا توجد اجتماعات مجدولة بعد. افتح أي مشروع وأضف موعد الاجتماع ورابطه.</div>'}</div>
      </section>
      <section class="studio-global-panel">
        <div class="studio-section-heading"><div><span class="eyebrow">GLOBAL BILL OF MATERIALS</span><h3>المواد المطلوبة مجمعة من كل الفرق</h3><p class="muted-mini">تجميع مشتريات المشاريع المسجلة؛ هذا ليس مخزونًا فعليًا بالمخزن. الكمية المستلمة مبنية على حالة كل بند.</p></div><div class="studio-row-actions"><span class="studio-status">${summary.length} نوع مادة</span><button type="button" class="studio-btn small" onclick="exportStudioMaterialsCSV()"><i class="fas fa-file-csv"></i> كشف مجمع CSV</button><button type="button" class="studio-btn small" onclick="exportStudioMaterialsByProjectCSV()"><i class="fas fa-list"></i> كل بند حسب الفريق</button><button type="button" class="studio-btn small" onclick="printStudioMaterialsReport()"><i class="fas fa-print"></i> طباعة</button></div></div>
        <div class="studio-inventory-kpis"><article><small>أنواع المواد</small><strong>${summary.length}</strong></article><article><small>إجمالي الكميات المطلوبة</small><strong>${Number(totalQty.toFixed(2))}</strong></article><article><small>التكلفة المقدرة المسجلة</small><strong>${money(totalCost)}</strong></article><article><small>أسماء في دليل القطع</small><strong>${materialCatalog.length}</strong></article></div>
        <div class="studio-table-wrap"><table class="studio-table studio-inventory-table"><thead><tr><th>المادة</th><th>الكمية المطلوبة</th><th>تم طلبها</th><th>متبقي للطلب</th><th>تم شراؤها</th><th>تم استلامها</th><th>متبقي للاستلام</th><th>عدد المشاريع</th><th>إجمالي التكلفة المقدرة</th></tr></thead><tbody>${summary.map(item => `<tr><td><strong>${esc(item.name)}</strong><small>${item.lines} بند شراء منفصل</small></td><td>${Number(item.quantity.toFixed(2))}</td><td>${Number(item.ordered.toFixed(2))}</td><td>${Number(item.remainingToOrder.toFixed(2))}</td><td>${Number(item.bought.toFixed(2))}</td><td>${Number(item.received.toFixed(2))}</td><td>${Number(item.remainingToReceive.toFixed(2))}</td><td>${item.projectsCount}</td><td><strong>${money(item.estimatedCost)}</strong></td></tr>`).join('') || '<tr><td colspan="9" class="empty-cell">ستظهر المواد هنا تلقائيًا عند إضافتها لأي مشروع.</td></tr>'}</tbody></table></div>
        <form class="studio-catalog-add" onsubmit="return addStudioCatalogItem(event)"><div><strong>إضافة مادة إلى الدليل الدائم</strong><small>اكتب أي مكوّن جديد ليظهر في قائمة الاختيار عند إنشاء طلب مادة لأي مشروع.</small></div><input name="name" list="studio-material-catalog" placeholder="مثال: MQ-16 / Raspberry Pi 5 / Jumper wires" required><input name="category" placeholder="التصنيف: Sensors / Power / ..."><button type="submit" class="studio-btn primary"><i class="fas fa-plus"></i> إضافة للقائمة</button></form>
        <p class="muted-mini studio-catalog-note">الدليل يحتوي أسماء شائعة للحساسات والـRaspberry Pi والإلكترونيات والموتورات والتوصيلات والصوت والطاقة. الأسعار لا تُفترض تلقائيًا؛ أدخل سعر الشراء الفعلي لكل مشروع.</p>
      </section>`;
  }
  function addStudioCatalogItem(event) {
    if (event) event.preventDefault(); const form = event?.currentTarget; if (!form) return false;
    const fd = new FormData(form); const name = String(fd.get('name') || '').trim(); const category = String(fd.get('category') || 'Custom').trim() || 'Custom';
    if (!name) return false;
    saveCatalogItem({ name, category }).then(ok => { if (ok) { const root = $('studio-global-ops'); if (root) { const nameInput = root.querySelector('.studio-catalog-add input[name="name"]'); if (nameInput) nameInput.value = ''; const catInput = root.querySelector('.studio-catalog-add input[name="category"]'); if (catInput) catInput.value = ''; } } });
    return false;
  }
  function addCurrentMaterialNameToCatalog() {
    const form = document.querySelector('#studio-material-form'); const name = String(form?.elements.namedItem('name')?.value || '').trim();
    if (!name) return studioToast('اكتب اسم المادة في الخانة أولًا.', 'info');
    saveCatalogItem({ name, category: 'Custom' });
  }
  function addAnotherStudioMaterial() {
    const form = $('studio-material-form'); if (!form) return;
    const name = form.elements.namedItem('name'); if (name) { name.focus(); name.select?.(); }
    studioToast('اكتب المادة التالية وسعرها وكميتها، ثم اضغط إضافة مادة.', 'info');
  }
  function exportStudioMaterialsCSV() {
    const summary = materialSummary();
    const rows = [['Material','Requested quantity','Ordered quantity','Remaining to order','Purchased quantity','Received quantity','Remaining to receive','Projects','Estimated total EGP'], ...summary.map(x => [x.name,x.quantity,x.ordered,x.remainingToOrder,x.bought,x.received,x.remainingToReceive,x.projectsCount,x.estimatedCost])];
    const csv = '\ufeff' + rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download=`studio-materials-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function exportStudioMaterialsByProjectCSV() {
    const rows = [['Project','School','Team ID','Material','Quantity','Unit price EGP','Line total EGP','Status','Supplier / shop','Purchase link','Internal note']];
    projects.forEach(project => (project.materials||[]).forEach(item => rows.push([project.name||'Unknown',project.school||'Unknown',project.teamNumber||'Unknown',item.name||'Unknown',Number(item.quantity)||0,Number(item.unitPrice)||0,(Number(item.quantity)||0)*(Number(item.unitPrice)||0),({planned:'Planned',ordered:'Ordered',bought:'Bought',received:'Received'})[item.status]||item.status||'Planned',item.supplier||'Unknown',item.link||'',item.note||''])));
    const csv='\ufeff'+rows.map(row=>row.map(cell=>`"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})); const a=document.createElement('a'); a.href=url; a.download=`studio-materials-by-project-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function printStudioMaterialsReport() {
    const rows = materialSummary(); const html = `<div class="public-project-report"><div class="public-report-hero"><h1>كشف المواد المجمع</h1><p>تاريخ التقرير: ${esc(todayISO())}</p></div><section class="public-report-section"><table class="studio-table"><thead><tr><th>المادة</th><th>المطلوب</th><th>تم طلبه</th><th>متبقي للطلب</th><th>تم شراؤه</th><th>تم استلامه</th><th>متبقي للاستلام</th><th>المشاريع</th><th>التكلفة المقدرة</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.quantity}</td><td>${x.ordered}</td><td>${x.remainingToOrder}</td><td>${x.bought}</td><td>${x.received}</td><td>${x.remainingToReceive}</td><td>${x.projectsCount}</td><td>${money(x.estimatedCost)}</td></tr>`).join('')}</tbody></table></section></div>`;
    const win = window.open('', '_blank'); if (!win) return studioToast('اسمح بالنوافذ المنبثقة لطباعة التقرير.', 'error');
    win.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>كشف المواد المجمع</title><link rel="stylesheet" href="${location.origin}${location.pathname.replace(/[^/]*$/,'')}upgrade.css"><style>body{background:#07111f;color:#eaf2ff;padding:24px;font-family:Tajawal,sans-serif}@media print{body{padding:0}.studio-table{min-width:0}}</style><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script></body></html>`); win.document.close();
  }

  function renderProjectDetail(p, root) {
    const s = projectStats(p);
    const timelinePct = s.stepsTotal ? Math.round(s.stepsDone * 100 / s.stepsTotal) : 0;
    if (editingMaterialProjectId && editingMaterialProjectId !== p.id) { editingMaterialId = null; editingMaterialProjectId = null; }
    const editingMaterial = editingMaterialId ? (p.materials || []).find(m => m.id === editingMaterialId) : null;
    root.innerHTML = `
      <div class="studio-detail-header">
        <div><div class="eyebrow">PROJECT CONTROL ROOM / ${esc(p.teamNumber || 'TEAM: UNKNOWN')}</div><h2>${esc(p.name || 'مشروع بدون اسم')}</h2><p>${esc(p.description || 'أضف وصف المشروع والنتيجة المستهدفة.')}</p></div>
        <div class="studio-detail-actions"><select id="studio-status" class="input-dark" aria-label="حالة المشروع">${[['planning','قيد التخطيط'],['active','جارٍ التنفيذ'],['review','مراجعة واختبار'],['delivered','تم التسليم'],['paused','متوقف مؤقتًا']].map(([v,l])=>`<option value="${v}" ${p.status===v?'selected':''}>${l}</option>`).join('')}</select><button class="studio-btn primary" type="button" onclick="saveStudioDetails()"><i class="fas fa-save"></i> حفظ التعديلات</button></div>
      </div>
      <div class="studio-progress-line"><span style="width:${timelinePct}%"></span></div><div class="studio-progress-caption"><span>تقدم التنفيذ</span><strong>${timelinePct}% • ${s.stepsDone} من ${s.stepsTotal} خطوات</strong></div>
      <form id="studio-edit-form" class="studio-section-card" onsubmit="return saveStudioDetails(event)">
        <div class="studio-section-heading"><div><span class="eyebrow">PROJECT BRIEF</span><h3>بيانات المشروع</h3></div><span class="muted-mini">الخانات الناقصة تتسجل Unknown بدل ما توقف إنشاء المشروع</span></div>
        <div class="studio-form-grid">
          ${field('name','اسم المشروع',p.name,'text')}${field('school','المدرسة / الجامعة',p.school,'text')}${field('clientName','العميل / الجهة',p.clientName,'text')}${field('teamNumber','رقم الفريق',p.teamNumber,'text')}
          ${field('teamMembers','أعضاء الفريق',p.teamMembers,'text','ممدوح، سما، ...')}${field('projectType','نوع المشروع',p.projectType,'text','Biomedical / Robotics / AI / ...')}${field('startDate','تاريخ البداية',p.startDate,'date')}${field('deadline','موعد التسليم النهائي',p.deadline,'date')}
          ${field('meetingDate','موعد الاجتماع القادم',p.meetingDate,'datetime-local')}${field('meetingLink','رابط الاجتماع',p.meetingLink,'url')}${field('whatsappLink','رابط جروب واتساب',p.whatsappLink,'url')}${field('contractValue','السعر الإجمالي المتفق عليه مع العميل (جنيه)',p.contractValue,'number')}
          <label class="studio-field"><span>طريقة تنفيذ المشروع</span><select id="studio-field-deliveryMode"><option value="full" ${p.deliveryMode==='full'?'selected':''}>مشروع كامل من الفريق</option><option value="mentoring" ${p.deliveryMode==='mentoring'?'selected':''}>Mentoring / إرشاد فقط</option><option value="hybrid" ${p.deliveryMode==='hybrid'?'selected':''}>مشترك: جزء من الفريق وجزء في المدرسة</option></select></label>
          ${field('teamScope','المطلوب تنفيذه من فريقنا',p.teamScope,'text','التصميم، البرمجة، التجميع...')}${field('schoolScope','المطلوب من المدرسة / الطالب',p.schoolScope,'text','اختبارات، عرض، تجميع نهائي...')}
          <label class="studio-field span-2"><span>فكرة المشروع والوصف</span><textarea id="studio-field-description" rows="3">${esc(p.description)}</textarea></label>
          <label class="studio-field span-2"><span>المشكلة التي يحلها المشروع</span><textarea id="studio-field-problem" rows="2">${esc(p.problem || '')}</textarea></label>
          <label class="studio-field span-2"><span>المخرجات ومعايير النجاح</span><textarea id="studio-field-deliverables" rows="2">${esc(p.deliverables || '')}</textarea></label>
          <label class="studio-field span-2"><span>ملاحظات داخلية للفريق</span><textarea id="studio-field-internalNotes" rows="2">${esc(p.internalNotes || '')}</textarea></label>
        </div>
        <div class="studio-inline-actions"><button type="submit" class="studio-btn primary"><i class="fas fa-save"></i> حفظ البيانات</button><button type="button" class="studio-btn" onclick="generateStudioTimeline()"><i class="fas fa-magic"></i> توليد / تحديث الخريطة</button></div>
      </form>

      <section class="studio-section-card studio-members-card">
        <div class="studio-section-heading"><div><span class="eyebrow">TEAM DIRECTORY</span><h3>أعضاء الفريق وبيانات التواصل</h3><p class="muted-mini">هذه البيانات داخلية ولا تظهر في رابط العميل.</p></div><span class="studio-status">${(p.members||[]).length} أعضاء</span></div>
        <div class="studio-member-list">${(p.members||[]).length ? p.members.map(m => `<article class="studio-member-row"><span class="studio-member-avatar"><i class="fas fa-user"></i></span><div class="studio-member-main"><strong>${esc(m.name||'Unknown')}</strong><small>${esc(m.role||'عضو فريق')} • ${esc(m.phone||'رقم غير مضاف')}</small></div><div class="studio-member-actions">${m.phone ? `<a class="studio-btn tiny" href="tel:${esc(m.phone)}">اتصال</a>` : ''}<button type="button" class="studio-btn tiny" onclick="editStudioMember('${esc(m.id)}')">تعديل</button><button type="button" class="icon-button danger" aria-label="حذف العضو" onclick="removeStudioMember('${esc(m.id)}')"><i class="fas fa-trash"></i></button></div></article>`).join('') : '<div class="studio-empty-small">أضف كل عضو باسمه ورقم هاتفه ودوره بدل كتابة الأسماء في خانة واحدة فقط.</div>'}</div>
        <form class="studio-add-row studio-member-form" onsubmit="return addStudioMember(event)"><input name="name" placeholder="اسم العضو" required><input name="phone" type="tel" placeholder="رقم الهاتف"><input name="role" placeholder="الدور: برمجة / Hardware / قائد فريق"><button class="studio-btn primary" type="submit"><i class="fas fa-user-plus"></i> إضافة عضو</button></form>
      </section>

      <section class="studio-section-card studio-meetings-card">
        <div class="studio-section-heading"><div><span class="eyebrow">MEETINGS & CALENDAR</span><h3>مواعيد واجتماعات هذا المشروع</h3><p class="muted-mini">كل موعد تضيفه يظهر في جدول الاجتماعات العام أعلى الاستوديو ويمكن إظهاره في تقرير العميل.</p></div><span class="studio-status status-active">${projectMeetings(p).length} مواعيد</span></div>
        <div class="studio-meeting-list">${projectMeetings(p).sort((a,b)=>String(a.dateTime||'').localeCompare(String(b.dateTime||''))).map(m => `<article class="studio-meeting-row"><span class="studio-global-meeting-icon"><i class="fas fa-calendar-check"></i></span><div class="studio-global-meeting-main"><strong>${esc(m.title||'اجتماع المشروع')}</strong><small>${esc(String(m.dateTime||'موعد غير محدد').replace('T',' '))}${m.notes?` • ${esc(m.notes)}`:''}</small></div><div class="studio-global-meeting-actions">${m.link?`<a class="studio-btn tiny primary" href="${esc(m.link)}" target="_blank" rel="noopener">فتح الرابط</a>`:''}${!m.legacy?`<button type="button" class="studio-btn tiny" onclick="editStudioMeeting('${esc(m.id)}')">تعديل</button><button type="button" class="icon-button danger" onclick="removeStudioMeeting('${esc(m.id)}')" aria-label="حذف الاجتماع"><i class="fas fa-trash"></i></button>`:'<span class="studio-status">موعد سابق في بيانات المشروع</span>'}</div></article>`).join('')||'<div class="studio-empty-small">لم تتم إضافة اجتماعات بعد.</div>'}</div>
        <form class="studio-add-row studio-meeting-form" onsubmit="return addStudioMeeting(event)"><input name="title" placeholder="عنوان الاجتماع" required><input name="dateTime" type="datetime-local" required><input name="link" type="url" placeholder="لينك Meet / Zoom / Teams"><input name="notes" placeholder="ملاحظات / جدول الأعمال"><button class="studio-btn primary" type="submit"><i class="fas fa-plus"></i> إضافة اجتماع</button></form>
      </section>

      <section class="studio-section-card" id="studio-export-card">
        <div class="studio-section-heading"><div><span class="eyebrow">ROADMAP</span><h3>الخريطة الزمنية وخطوات التنفيذ</h3></div><div class="studio-row-actions"><button type="button" class="studio-btn small" onclick="printStudioReport()"><i class="fas fa-print"></i> طباعة / PDF</button><button type="button" class="studio-btn small" onclick="exportStudioTimelinePNG()"><i class="fas fa-image"></i> تنزيل كصورة</button></div></div>
        <div class="studio-roadmap-meta"><span><i class="far fa-calendar"></i> ${esc(p.startDate || 'Start: Unknown')}</span><i class="fas fa-arrow-left"></i><span><i class="far fa-flag"></i> ${esc(p.deadline || 'Deadline: Unknown')}</span></div>
        <div class="studio-timeline">${(p.timeline || []).length ? p.timeline.map((step, index) => `<article class="studio-timeline-step step-${esc(step.status)}"><div class="studio-step-rail"><span>${index+1}</span></div><div class="studio-step-content"><div class="studio-step-title"><div><h4>${esc(step.title)}</h4><p>${esc(step.description || '')}</p></div><span class="studio-status status-${esc(step.status)}">${esc(stepStatusLabel(step.status))}</span></div><div class="studio-step-meta"><span><i class="far fa-calendar"></i> ${esc(step.dueDate || 'Unknown date')}</span><span><i class="fas fa-user"></i> ${esc(step.owner || 'Unknown')}</span>${step.completedAt?`<span><i class="fas fa-check-circle"></i> تم ${esc(step.completedAt.slice(0,10))}</span>`:''}</div><div class="studio-step-actions"><button type="button" class="studio-btn tiny" onclick="updateStudioStep('${esc(step.id)}','active')">بدء</button><button type="button" class="studio-btn tiny success" onclick="updateStudioStep('${esc(step.id)}','done')">تمت</button><button type="button" class="studio-btn tiny danger" onclick="updateStudioStep('${esc(step.id)}','blocked')">عائق</button><button type="button" class="studio-btn tiny ghost" onclick="editStudioStep('${esc(step.id)}')">تعديل الموعد / المسؤول</button></div></div></article>`).join('') : '<div class="studio-empty-small">اضغط «توليد الخريطة» لإنشاء خطوات أولية قابلة للتعديل.</div>'}</div>
        <form class="studio-add-row" onsubmit="return addStudioStep(event)"><input name="title" placeholder="خطوة جديدة في المشروع" required><input name="dueDate" type="date"><input name="owner" placeholder="المسؤول"><button class="studio-btn primary" type="submit"><i class="fas fa-plus"></i> إضافة خطوة</button></form>
      </section>

      <section class="studio-section-card studio-task-manager"><div class="studio-section-heading"><div><span class="eyebrow">TEAM TASKS</span><h3>توزيع المهام ومتابعة التنفيذ</h3></div><span class="studio-status status-active">${(p.tasks||[]).filter(t=>t.status==='done').length}/${(p.tasks||[]).length} مكتملة</span></div><p class="muted-mini">الخريطة الزمنية للمراحل الكبيرة؛ هنا تُقسم الشغل إلى مهام صغيرة بمسؤول وأولوية وموعد نهائي.</p><form class="studio-add-row studio-task-form" onsubmit="return addStudioTask(event)"><input name="title" placeholder="المهمة المطلوبة" required><input name="owner" placeholder="المسؤول"><input name="dueDate" type="date"><select name="priority"><option value="medium">أولوية متوسطة</option><option value="high">عاجلة</option><option value="low">منخفضة</option></select><button class="studio-btn primary" type="submit"><i class="fas fa-plus"></i> إضافة مهمة</button></form><div class="studio-task-list">${(p.tasks||[]).length?(p.tasks||[]).map(t=>`<article class="studio-task-row task-${esc(t.status||'todo')}"><span class="studio-task-check">${t.status==='done'?'✓':t.status==='active'?'…':'○'}</span><div class="studio-task-main"><strong>${esc(t.title||'مهمة بدون اسم')}</strong><small>${esc(t.owner||'Unknown')} • ${esc(t.dueDate||'موعد غير محدد')}</small></div><span class="studio-priority priority-${esc(t.priority||'medium')}">${({high:'عاجلة',medium:'متوسطة',low:'منخفضة'})[t.priority]||'متوسطة'}</span><div class="studio-task-actions"><button type="button" class="studio-btn tiny" onclick="updateStudioTask('${esc(t.id)}','active')">قيد التنفيذ</button><button type="button" class="studio-btn tiny success" onclick="updateStudioTask('${esc(t.id)}','done')">تمت</button><button type="button" class="icon-button danger" aria-label="حذف المهمة" onclick="removeStudioTask('${esc(t.id)}')"><i class="fas fa-trash"></i></button></div></article>`).join(''):'<div class="studio-empty-small">أضف مهامًا مستقلة، أو ولّد قائمة أولية من مراحل الـTimeline.</div>'}</div><div class="studio-inline-actions"><button type="button" class="studio-btn" onclick="generateStudioTasksFromTimeline()"><i class="fas fa-list-check"></i> تحويل المراحل إلى مهام</button></div></section>

      <section class="studio-section-card"><div class="studio-section-heading"><div><span class="eyebrow">BOM / MATERIALS</span><h3>قائمة المواد والتكلفة</h3></div><strong class="studio-total-pill">الإجمالي: ${money(s.materials)}</strong></div>
        <div class="studio-table-wrap"><table class="studio-table"><thead><tr><th>المادة / القطعة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th><th>المورد / الرابط</th><th>الحالة</th><th></th></tr></thead><tbody>${(p.materials||[]).length?(p.materials||[]).map(m=>`<tr><td><strong>${esc(m.name)}</strong>${m.note?`<small>${esc(m.note)}</small>`:''}</td><td>${Number(m.quantity)||0}</td><td>${money(m.unitPrice)}</td><td><strong>${money((Number(m.quantity)||0)*(Number(m.unitPrice)||0))}</strong></td><td>${m.link?`<a href="${esc(m.link)}" target="_blank" rel="noopener">فتح الرابط <i class="fas fa-external-link-alt"></i></a>`:esc(m.supplier||'Unknown')}</td><td><span class="studio-status status-${esc(m.status||'planned')}">${esc(({planned:'مطلوبة',ordered:'تم الطلب',bought:'تم الشراء',received:'تم الاستلام'})[m.status]||'مطلوبة')}</span></td><td><div class="studio-row-actions"><button type="button" class="studio-btn tiny" onclick="editStudioMaterial('${esc(m.id)}')"><i class="fas fa-pen"></i> تعديل</button><button type="button" class="icon-button danger" aria-label="حذف المادة" onclick="removeStudioMaterial('${esc(m.id)}')"><i class="fas fa-trash"></i></button></div></td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">لسه مفيش مواد مضافة للمشروع.</td></tr>'}</tbody></table></div>
        <form id="studio-material-form" class="studio-add-row materials-add" onsubmit="return addStudioMaterial(event)"><input type="hidden" name="editingId" value="${esc(editingMaterial?.id||'')}"><input name="name" list="studio-material-catalog" value="${esc(editingMaterial?.name||'')}" placeholder="اسم المادة / اختر من الدليل أو اكتب جديدة" required><input name="quantity" type="number" min="0.01" step="any" value="${editingMaterial?esc(editingMaterial.quantity):''}" placeholder="الكمية" required><input name="unitPrice" type="number" min="0" step="0.01" value="${editingMaterial?esc(editingMaterial.unitPrice):''}" placeholder="سعر الوحدة (جنيه)" required><input name="supplier" value="${esc(editingMaterial?.supplier||'')}" placeholder="المورد / المكان - داخلي"><input name="link" type="url" value="${esc(editingMaterial?.link||'')}" placeholder="رابط الشراء (داخلي)"><select name="status"><option value="planned" ${!editingMaterial||editingMaterial.status==='planned'?'selected':''}>مطلوبة</option><option value="ordered" ${editingMaterial?.status==='ordered'?'selected':''}>تم الطلب</option><option value="bought" ${editingMaterial?.status==='bought'?'selected':''}>تم الشراء</option><option value="received" ${editingMaterial?.status==='received'?'selected':''}>تم الاستلام</option></select><input name="note" value="${esc(editingMaterial?.note||'')}" placeholder="ملاحظات داخلية"><button type="submit" class="studio-btn primary"><i class="fas ${editingMaterial?'fa-save':'fa-plus'}"></i> ${editingMaterial?'حفظ التعديل':'إضافة مادة'}</button>${editingMaterial?`<button type="button" class="studio-btn" onclick="cancelEditStudioMaterial()">إلغاء التعديل</button>`:''}</form>
        <div class="studio-inline-actions studio-material-secondary-actions"><button type="button" class="studio-btn" onclick="addAnotherStudioMaterial()"><i class="fas fa-plus-circle"></i> إضافة مادة أخرى</button><button type="button" class="studio-btn" onclick="addCurrentMaterialNameToCatalog()"><i class="fas fa-bookmark"></i> حفظ الاسم في دليل المواد</button></div>
      </section>

      <section class="studio-finance-grid"><div class="studio-section-card"><div class="studio-section-heading"><div><span class="eyebrow">FINANCE TRACKER</span><h3>الدفعات والحسابات</h3></div></div><div class="studio-money-list"><div><span>قيمة المشروع</span><strong>${money(s.contract)}</strong></div><div><span>تم تحصيله</span><strong class="positive-money">${money(s.received)}</strong></div><div><span>متبقي من العميل</span><strong class="negative-money">${money(s.due)}</strong></div><div><span>تكلفة المواد المقدرة</span><strong>${money(s.materials)}</strong></div><div><span>مصروفات أخرى مسجلة</span><strong>${money(s.expenses)}</strong></div><div><span>هامش متوقع قبل المصروفات غير المسجلة</span><strong>${money(s.expectedMargin)}</strong></div></div><form class="studio-ledger-form" onsubmit="return addStudioLedger(event)"><select name="type"><option value="received">دفعة مستلمة من العميل</option><option value="expense">مصروف مشروع</option></select><input name="amount" type="number" min="0.01" step="0.01" placeholder="المبلغ بالجنيه" required><input name="date" type="date" value="${todayISO()}" required><input name="note" placeholder="الوصف / طريقة الدفع" required><button class="studio-btn primary" type="submit">تسجيل الحركة</button></form><div class="studio-ledger-list">${(p.ledger||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(tx=>`<div class="studio-ledger-row"><span class="ledger-icon ${tx.type==='received'?'received':'expense'}"><i class="fas ${tx.type==='received'?'fa-arrow-down':'fa-arrow-up'}"></i></span><div><strong>${esc(tx.note)}</strong><small>${esc(tx.date||'Unknown')} • ${tx.type==='received'?'تحصيل':'مصروف'}</small></div><strong class="${tx.type==='received'?'positive-money':'negative-money'}">${tx.type==='received'?'+':'−'}${money(tx.amount)}</strong><button type="button" class="studio-btn tiny" onclick="editStudioLedger('${esc(tx.id)}')">تعديل</button><button type="button" class="icon-button danger" onclick="removeStudioLedger('${esc(tx.id)}')"><i class="fas fa-times"></i></button></div>`).join('')||'<p class="muted-mini">سجّل كل دفعة أو مصروف هنا حتى يفضل الحساب دقيق.</p>'}</div></div><div class="studio-section-card studio-chart-card"><div class="studio-section-heading"><div><span class="eyebrow">PROJECT ECONOMICS</span><h3>ملخص مالي بصري</h3></div></div><div class="studio-chart-wrap"><canvas id="studio-financial-chart"></canvas></div><p class="muted-mini">الهامش المتوقع تقديرٌ من البيانات المدخلة وليس كشف حساب محاسبي.</p></div></section>

      <section class="studio-section-card"><div class="studio-section-heading"><div><span class="eyebrow">TEAM WORKSPACE</span><h3>الفريق والاجتماعات</h3></div></div><div class="studio-link-grid">${linkCard('رابط الاجتماع',p.meetingLink,'fa-video',p.meetingDate||'لم يحدد موعد')}${linkCard('جروب واتساب',p.whatsappLink,'fa-users',p.teamNumber||'رقم الفريق غير محدد')}</div></section>

      <section class="studio-section-card"><div class="studio-section-heading"><div><span class="eyebrow">EVIDENCE & DELIVERABLES</span><h3>صور وفيديوهات وملفات العمل</h3></div></div><form class="studio-add-row media-add" onsubmit="return addStudioMediaLink(event)"><input name="title" placeholder="اسم الصورة / الفيديو / التقرير" required><input name="url" type="url" placeholder="رابط الملف أو الفيديو" required><select name="kind"><option value="image">صورة</option><option value="video">فيديو</option><option value="document">تقرير / ملف</option><option value="link">رابط آخر</option></select><button class="studio-btn primary" type="submit">إضافة رابط</button></form><div class="studio-upload-row"><input id="studio-media-file" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx" multiple><button type="button" class="studio-btn" onclick="uploadStudioMedia()"><i class="fas fa-cloud-upload-alt"></i> رفع إلى Firebase Storage</button><span class="muted-mini">رفع الملفات يحتاج صلاحيات Storage. الروابط تظل متاحة كبديل.</span></div><div class="studio-media-grid">${(p.media||[]).map(m=>`<article class="studio-media-card"><span class="studio-media-icon"><i class="fas ${m.kind==='video'?'fa-film':m.kind==='image'?'fa-image':m.kind==='document'?'fa-file-alt':'fa-link'}"></i></span><div><strong>${esc(m.title)}</strong><small>${esc(m.kind||'link')} • ${esc(m.addedAt||'')}</small><a href="${esc(m.url)}" target="_blank" rel="noopener">فتح الملف <i class="fas fa-external-link-alt"></i></a></div><button class="icon-button danger" type="button" onclick="removeStudioMedia('${esc(m.id)}')"><i class="fas fa-trash"></i></button></article>`).join('')||'<div class="studio-empty-small">أضف روابط أو ارفع أدلة التنفيذ هنا.</div>'}</div></section>

      <section class="studio-section-card studio-share-card"><div class="studio-section-heading"><div><span class="eyebrow">CLIENT VIEW</span><h3>صفحة متابعة العميل / المدرسة</h3></div><span class="studio-status status-active">قراءة فقط</span></div><p class="muted-mini">الرابط يعرض نسخة ثابتة من بيانات المشروع والخريطة وقت إنشائه. بعد أي تعديل اضغط إنشاء رابط محدث. لا يفتح بقية الموقع.</p><label class="studio-check-line"><input id="studio-share-finances" type="checkbox" checked><span>إظهار سعر المشروع والمدفوع والمتبقي وأسعار مواده (بدون المصروفات الداخلية)</span></label><label class="studio-check-line"><input id="studio-share-team-links" type="checkbox" checked><span>إظهار رابط الاجتماع وجروب واتساب</span></label><div class="studio-inline-actions"><button class="studio-btn primary" type="button" onclick="createStudioShareLink()"><i class="fas fa-share-alt"></i> إنشاء / تحديث رابط المتابعة</button><button class="studio-btn" type="button" onclick="copyStudioShareLink()"><i class="fas fa-copy"></i> نسخ آخر رابط</button><button class="studio-btn danger" type="button" onclick="deleteStudioProject()"><i class="fas fa-archive"></i> حذف المشروع</button></div><textarea id="studio-share-url" class="input-dark studio-share-url" rows="2" readonly placeholder="رابط المتابعة هيظهر هنا بعد إنشائه"></textarea><div id="studio-share-preview" class="studio-public-preview hidden"></div></section>

      <section class="studio-section-card studio-ai-card"><div class="studio-section-heading"><div><span class="eyebrow">PROJECT-AWARE AI</span><h3><i class="fas fa-sparkles"></i> مساعد جروب المشروع</h3></div><span class="studio-status status-active">مرتبط ببيانات المشروع</span></div><p class="muted-mini">يساعد في مراجعة الفكرة، اقتراح مواد بديلة، توزيع المهام، تحليل المخاطر، وتحديث الخطة. سيُرسل ملخص المشروع وسؤالك إلى مزود الذكاء الاصطناعي عند الطلب.</p><div id="studio-ai-chat" class="studio-ai-chat">${(p.aiChatHistory||[]).slice(-8).map(m=>`<div class="studio-ai-message ${m.role==='assistant'?'assistant':'user'}"><small>${m.role==='assistant'?'مساعد المشروع':'الفريق'}</small><div>${esc(m.content).replace(/\n/g,'<br>')}</div></div>`).join('')||'<div class="studio-empty-small">اسأل المساعد عن أي تفصيلة في المشروع الحالي.</div>'}</div><form class="studio-ai-input" onsubmit="return askStudioAI(event)"><textarea name="question" rows="2" placeholder="مثال: راجع المواد وحدد القطع الناقصة والمخاطر قبل التسليم…" required></textarea><button type="submit" class="studio-btn primary"><i class="fas fa-paper-plane"></i> اسأل AI</button></form><div class="studio-ai-shortcuts"><button type="button" class="studio-btn tiny" onclick="askStudioAIPreset('راجع فكرة المشروع وحدد نقاط القوة والضعف والمخاطر والافتراضات الناقصة.')">تحليل الفكرة</button><button type="button" class="studio-btn tiny" onclick="askStudioAIPreset('راجع قائمة المواد والكميات والتكاليف وحدد النواقص والتكرارات والمخاطر. لا تخترع أسعارًا؛ علّم أي سعر غير موجود بأنه Unknown.')">مراجعة المواد</button><button type="button" class="studio-btn tiny" onclick="askStudioAIPreset('أعد تخطيط الجدول الزمني حسب موعد التسليم الحالي، ووزّع المهام على الأدوار الموجودة، واذكر أي موعد أو معلومة ناقصة كـ Unknown.')">تحسين Timeline</button><button type="button" class="studio-btn tiny" onclick="askStudioAIPreset('اكتب رسالة احترافية جاهزة لإرسال تحديث تقدم المشروع للجروب، بناءً على الخطوات المكتملة والمتبقية والموعد النهائي.')">رسالة للجروب</button></div></section>
    `;
    drawFinancialChart(p, s);
  }

  function field(id, label, value, type, placeholder) {
    const safeType = ['text','date','datetime-local','url','number','email'].includes(type) ? type : 'text';
    return `<label class="studio-field"><span>${esc(label)}</span><input id="studio-field-${esc(id)}" type="${safeType}" value="${esc(value ?? '')}" ${placeholder?`placeholder="${esc(placeholder)}"`:''} ${safeType==='number'?'min="0" step="0.01"':''}></label>`;
  }
  function linkCard(title, url, icon, caption) {
    return `<article class="studio-link-card"><span class="studio-link-icon"><i class="fas ${icon}"></i></span><div><span>${esc(title)}</span><strong>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">فتح الرابط <i class="fas fa-external-link-alt"></i></a>`:'غير مضاف بعد'}</strong><small>${esc(caption)}</small></div></article>`;
  }
  function drawFinancialChart(p, s) {
    const canvas = $('studio-financial-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (financialChart) financialChart.destroy();
    financialChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: ['تم تحصيله', 'متبقي للتحصيل', 'تكلفة المواد', 'مصروفات أخرى'], datasets: [{ data: [s.received, s.due, s.materials, s.expenses], backgroundColor: ['#6ee7c7','#a59bff','#ffbd75','#fb8296'], borderWidth: 0, hoverOffset: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { color: '#b7c5d8', usePointStyle: true, padding: 16 } } } }
    });
  }

  function createStudioProject(event) {
    if (event) event.preventDefault();
    const form = $('studio-create-form');
    if (!form) return false;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { studioToast('اكتب اسم المشروع الأول.', 'error'); return false; }
    const startDate = String(fd.get('startDate') || todayISO());
    const deadline = String(fd.get('deadline') || '');
    const project = normalizeProject({
      id: uid(), name, school: String(fd.get('school') || '').trim() || 'Unknown', clientName: String(fd.get('clientName')||'').trim()||'Unknown',
      teamNumber: String(fd.get('teamNumber')||'').trim()||'Unknown', teamMembers: String(fd.get('teamMembers')||'').trim()||'Unknown', members: String(fd.get('teamMembers')||'').split(/[،,;\n]+/).map(name=>name.trim()).filter(Boolean).map(name=>({id:uid(),name,phone:'',role:'عضو فريق'})),
      projectType: String(fd.get('projectType')||'').trim()||'Unknown', description: String(fd.get('description')||'').trim()||'Unknown', problem: String(fd.get('problem')||'').trim()||'Unknown',
      deliverables: String(fd.get('deliverables')||'').trim()||'Unknown', status: 'planning', startDate, deadline, meetingDate: '', meetingLink: '', whatsappLink: '',
      contractValue: Number(fd.get('contractValue'))||0, deliveryMode: String(fd.get('deliveryMode')||'full'), teamScope: String(fd.get('teamScope')||'Unknown').trim()||'Unknown', schoolScope: String(fd.get('schoolScope')||'Unknown').trim()||'Unknown', meetings: [], materials: [], timeline: generatedTimeline(startDate, deadline), ledger: [], media: [], aiChatHistory: [], tasks: [], createdBy: activeUser || 'Unknown', createdAt: nowISO(), updatedAt: nowISO()
    });
    if (Number(fd.get('paidAmount')) > 0) project.ledger.push({ id: uid(), type: 'received', amount: Number(fd.get('paidAmount')), date: todayISO(), note: 'دفعة افتتاحية عند تسجيل المشروع' });
    persistProject(project, false);
    form.reset();
    const panel = $('studio-create-panel'); if (panel) panel.classList.add('hidden');
    return false;
  }

  function selectStudioProject(id) { activeProjectId = id; renderStudio(); }
  function getActive() { return projects.find(p => p.id === activeProjectId) || null; }

  async function saveStudioDetails(event) {
    if (event) event.preventDefault();
    const p = getActive(); if (!p) return false;
    ['name','school','clientName','teamNumber','teamMembers','projectType','startDate','deadline','meetingDate','meetingLink','whatsappLink','contractValue','teamScope','schoolScope'].forEach(key => {
      const el = $(`studio-field-${key}`); if (!el) return;
      if (key === 'contractValue') p[key] = Number(el.value)||0;
      else if (['startDate','deadline','meetingDate','meetingLink','whatsappLink'].includes(key)) p[key] = el.value.trim();
      else p[key] = el.value.trim() || (key === 'name' ? 'مشروع بدون اسم' : 'Unknown');
    });
    const deliveryMode = $('studio-field-deliveryMode'); if (deliveryMode) p.deliveryMode = deliveryMode.value;
    ['description','problem','deliverables','internalNotes'].forEach(key => { const el = $(`studio-field-${key}`); if (el) p[key] = el.value.trim() || 'Unknown'; });
    const status = $('studio-status'); if (status) p.status = status.value;
    return persistProject(p, false).then(() => false);
  }
  function generateStudioTimeline() {
    const p = getActive(); if (!p) return;
    if (p.timeline && p.timeline.some(s => s.status === 'done') && !confirm('سيتم إعادة توزيع المواعيد مع الإبقاء على الخطوات المكتملة قدر الإمكان. متابعة؟')) return;
    const old = new Map((p.timeline||[]).map(s => [s.title, s]));
    p.timeline = generatedTimeline(p.startDate || todayISO(), p.deadline || '');
    p.timeline = p.timeline.map(s => { const prev=old.get(s.title); return prev ? {...s,...prev,dueDate:prev.dueDate||s.dueDate} : s; });
    persistProject(p, false);
  }
  function addStudioStep(event) {
    event.preventDefault(); const p=getActive(); if(!p) return false;
    const fd=new FormData(event.currentTarget); const title=String(fd.get('title')||'').trim(); if(!title) return false;
    p.timeline.push({id:uid(),title,description:'Unknown',owner:String(fd.get('owner')||'').trim()||'Unknown',dueDate:String(fd.get('dueDate')||'')||'Unknown',status:'planned',completedAt:null,notes:''});
    persistProject(p,false); return false;
  }
  function updateStudioStep(id,status) {
    const p=getActive(); if(!p) return;
    const step=p.timeline.find(s=>s.id===id); if(!step) return;
    const wasDone=step.status==='done'; step.status=status; step.completedAt=status==='done'?(step.completedAt||nowISO()):null;
    persistProject(p,false);
    if (status==='done' && !wasDone) studioToast('تم تحديث خطوة الخريطة الزمنية إلى مكتملة.', 'success');
  }
  function editStudioStep(id) {
    const p=getActive(); if(!p) return; const step=p.timeline.find(s=>s.id===id); if(!step) return;
    const title=prompt('اسم الخطوة:',step.title); if(title===null) return;
    const due=prompt('موعد الخطوة YYYY-MM-DD:',step.dueDate||''); if(due===null) return;
    const owner=prompt('المسؤول:',step.owner||'Unknown'); if(owner===null) return;
    step.title=title.trim()||step.title; step.dueDate=due.trim()||'Unknown'; step.owner=owner.trim()||'Unknown'; persistProject(p,false);
  }
  function addStudioTask(event) {
    event.preventDefault(); const p=getActive(); if(!p) return false; const fd=new FormData(event.currentTarget);
    const title=String(fd.get('title')||'').trim(); if(!title) return false;
    p.tasks.push({id:uid(),title,owner:String(fd.get('owner')||'').trim()||'Unknown',dueDate:String(fd.get('dueDate')||'')||'Unknown',priority:String(fd.get('priority')||'medium'),status:'todo',createdAt:nowISO(),completedAt:null});
    persistProject(p,false); return false;
  }
  function updateStudioTask(id,status) {
    const p=getActive(); if(!p) return; const task=(p.tasks||[]).find(x=>x.id===id); if(!task) return;
    task.status=status; task.completedAt=status==='done'?(task.completedAt||nowISO()):null; persistProject(p,false);
  }
  function removeStudioTask(id) {
    const p=getActive(); if(!p || !confirm('حذف المهمة من المشروع؟')) return; p.tasks=(p.tasks||[]).filter(x=>x.id!==id); persistProject(p,false);
  }
  function generateStudioTasksFromTimeline() {
    const p=getActive(); if(!p) return; if((p.tasks||[]).length && !confirm('توجد مهام حالية. هل تريد إضافة مراحل الخريطة كمهمات إضافية؟')) return;
    const existing=new Set((p.tasks||[]).map(t=>t.title));
    (p.timeline||[]).forEach(step=>{ if(!existing.has(step.title)) p.tasks.push({id:uid(),title:step.title,owner:step.owner||'Unknown',dueDate:step.dueDate||'Unknown',priority:'medium',status:step.status==='done'?'done':step.status==='active'?'active':'todo',createdAt:nowISO(),completedAt:step.completedAt||null}); });
    persistProject(p,false); studioToast('تم إنشاء قائمة مهام أولية من مراحل الخريطة. راجع المسؤول والمواعيد.', 'success');
  }

  function addStudioMember(event) {
    if (event) event.preventDefault(); const p=getActive(); if(!p) return false;
    const form=event?.currentTarget; const fd=new FormData(form); const name=String(fd.get('name')||'').trim(); if(!name) return false;
    p.members=Array.isArray(p.members)?p.members:[]; p.members.push({id:uid(),name,phone:String(fd.get('phone')||'').trim(),role:String(fd.get('role')||'').trim()||'عضو فريق',createdAt:nowISO()});
    p.teamMembers=p.members.map(m=>m.name).filter(Boolean).join('، ')||'Unknown'; persistProject(p,false); return false;
  }
  function editStudioMember(id) {
    const p=getActive(); if(!p) return; const member=(p.members||[]).find(m=>m.id===id); if(!member) return;
    const name=prompt('اسم عضو الفريق:',member.name||''); if(name===null) return;
    const phone=prompt('رقم الهاتف:',member.phone||''); if(phone===null) return;
    const role=prompt('دور العضو:',member.role||'عضو فريق'); if(role===null) return;
    member.name=name.trim()||member.name; member.phone=phone.trim(); member.role=role.trim()||'عضو فريق'; p.teamMembers=(p.members||[]).map(m=>m.name).filter(Boolean).join('، ')||'Unknown'; persistProject(p,false);
  }
  function removeStudioMember(id) {
    const p=getActive(); if(!p || !confirm('حذف بيانات عضو الفريق من هذا المشروع؟')) return;
    p.members=(p.members||[]).filter(m=>m.id!==id); p.teamMembers=p.members.map(m=>m.name).filter(Boolean).join('، ')||'Unknown'; persistProject(p,false);
  }
  function addStudioMeeting(event) {
    if(event) event.preventDefault(); const p=getActive(); if(!p) return false; const fd=new FormData(event.currentTarget);
    const title=String(fd.get('title')||'').trim(); const dateTime=String(fd.get('dateTime')||'').trim(); if(!title||!dateTime) return false;
    const meeting={id:uid(),title,dateTime,link:String(fd.get('link')||'').trim(),notes:String(fd.get('notes')||'').trim(),createdAt:nowISO(),status:'scheduled'};
    p.meetings=Array.isArray(p.meetings)?p.meetings:[]; p.meetings.push(meeting); p.meetings.sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)));
    const upcoming=p.meetings.find(m=>isFutureMeeting(m.dateTime)) || p.meetings[0];
    if(upcoming) { p.meetingDate=upcoming.dateTime; p.meetingLink=upcoming.link||p.meetingLink||''; }
    persistProject(p,false); return false;
  }
  function editStudioMeeting(id) {
    const p=getActive(); if(!p) return; const meeting=(p.meetings||[]).find(m=>m.id===id); if(!meeting) return;
    const title=prompt('عنوان الاجتماع:',meeting.title||''); if(title===null) return;
    const dateTime=prompt('موعد الاجتماع المحلي (YYYY-MM-DDTHH:MM):',meeting.dateTime||''); if(dateTime===null) return;
    const link=prompt('رابط الاجتماع:',meeting.link||''); if(link===null) return;
    const notes=prompt('ملاحظات الاجتماع:',meeting.notes||''); if(notes===null) return;
    Object.assign(meeting,{title:title.trim()||meeting.title,dateTime:dateTime.trim()||meeting.dateTime,link:link.trim(),notes:notes.trim()});
    p.meetings.sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)));
    const upcoming=p.meetings.find(m=>isFutureMeeting(m.dateTime)) || p.meetings[0];
    if(upcoming) { p.meetingDate=upcoming.dateTime; p.meetingLink=upcoming.link||''; }
    persistProject(p,false);
  }
  function removeStudioMeeting(id) {
    const p=getActive(); if(!p || !confirm('حذف موعد الاجتماع من المشروع؟')) return;
    p.meetings=(p.meetings||[]).filter(m=>m.id!==id);
    const upcoming=p.meetings.slice().sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime))).find(m=>isFutureMeeting(m.dateTime));
    p.meetingDate=upcoming?.dateTime||''; p.meetingLink=upcoming?.link||''; persistProject(p,false);
  }

  function addStudioMaterial(event) {
    if(event) event.preventDefault(); const p=getActive(); if(!p) return false; const form=event?.currentTarget; const fd=new FormData(form);
    const name=String(fd.get('name')||'').trim(); const quantity=Number(fd.get('quantity')); const unitPrice=Number(fd.get('unitPrice'));
    if(!name) { studioToast('اكتب اسم المادة.', 'error'); return false; }
    if(!Number.isFinite(quantity)||quantity<=0) { studioToast('الكمية لازم تكون أكبر من صفر.', 'error'); return false; }
    if(!Number.isFinite(unitPrice)||unitPrice<0) { studioToast('اكتب سعر الوحدة أو 0 لو السعر لم يتحدد بعد.', 'error'); return false; }
    const item={name,quantity,unitPrice,supplier:String(fd.get('supplier')||'').trim()||'Unknown',link:String(fd.get('link')||'').trim(),status:String(fd.get('status')||'planned'),note:String(fd.get('note')||'').trim()};
    const editId=String(fd.get('editingId')||editingMaterialId||'');
    if(editId) {
      const existing=(p.materials||[]).find(m=>m.id===editId); if(!existing) { studioToast('المادة المراد تعديلها لم تعد موجودة.', 'error'); return false; }
      Object.assign(existing,item, {updatedAt:nowISO()}); editingMaterialId=null; editingMaterialProjectId=null;
      persistProject(p,false); studioToast('تم تحديث المادة والكميات والأسعار.', 'success'); return false;
    }
    p.materials=p.materials||[]; p.materials.push({id:uid(),...item,createdAt:nowISO()});
    editingMaterialId=null; editingMaterialProjectId=null; persistProject(p,false); return false;
  }
  function editStudioMaterial(id) {
    const p=getActive(); if(!p) return; if(!(p.materials||[]).some(m=>m.id===id)) return;
    editingMaterialId=id; editingMaterialProjectId=p.id; renderStudio();
    const form=$('studio-material-form'); form?.scrollIntoView({behavior:'smooth',block:'center'}); form?.elements.namedItem('name')?.focus();
  }
  function cancelEditStudioMaterial() { editingMaterialId=null; editingMaterialProjectId=null; renderStudio(); }
  function removeStudioMaterial(id) { const p=getActive(); if(!p || !confirm('حذف بند المادة من هذه القائمة؟')) return; p.materials=p.materials.filter(x=>x.id!==id); if(editingMaterialId===id){editingMaterialId=null;editingMaterialProjectId=null;} persistProject(p,false); }
  function addStudioLedger(event) {
    event.preventDefault(); const p=getActive(); if(!p) return false; const fd=new FormData(event.currentTarget);
    p.ledger.push({id:uid(),type:String(fd.get('type')||'expense'),amount:Number(fd.get('amount'))||0,date:String(fd.get('date')||todayISO()),note:String(fd.get('note')||'').trim()||'Unknown'});
    persistProject(p,false); return false;
  }
  function editStudioLedger(id) {
    const p=getActive(); if(!p) return; const tx=(p.ledger||[]).find(x=>x.id===id); if(!tx) return;
    const type=prompt('نوع الحركة: received للتحصيل أو expense للمصروف',tx.type||'received'); if(type===null) return;
    const amount=prompt('المبلغ بالجنيه:',String(tx.amount??0)); if(amount===null) return;
    const date=prompt('التاريخ YYYY-MM-DD:',tx.date||todayISO()); if(date===null) return;
    const note=prompt('الوصف / طريقة الدفع:',tx.note||''); if(note===null) return;
    const parsed=Number(amount); if(!Number.isFinite(parsed)||parsed<0){studioToast('المبلغ غير صحيح.', 'error');return;}
    tx.type=type.trim()==='expense'?'expense':'received'; tx.amount=parsed; tx.date=date.trim()||todayISO(); tx.note=note.trim()||'Unknown'; persistProject(p,false);
  }
  function removeStudioLedger(id) { const p=getActive(); if(!p || !confirm('حذف حركة الحساب المحددة؟')) return; p.ledger=p.ledger.filter(x=>x.id!==id); persistProject(p,false); }
  function addStudioMediaLink(event) {
    event.preventDefault(); const p=getActive(); if(!p) return false; const fd=new FormData(event.currentTarget);
    p.media.push({id:uid(),title:String(fd.get('title')||'').trim(),url:String(fd.get('url')||'').trim(),kind:String(fd.get('kind')||'link'),addedAt:todayISO()}); persistProject(p,false); return false;
  }
  function removeStudioMedia(id) { const p=getActive(); if(!p || !confirm('إزالة الرابط من قائمة المشروع؟')) return; p.media=p.media.filter(x=>x.id!==id); persistProject(p,false); }
  async function uploadStudioMedia() {
    const p=getActive(), input=$('studio-media-file'); if(!p||!input||!input.files.length) return studioToast('اختار ملفًا أو أكثر أولًا.', 'info');
    if(typeof storage==='undefined' || !storage) return studioToast('Firebase Storage غير متصل. استخدم رابط الملف كبديل.', 'error');
    const files=Array.from(input.files); let success=0;
    for(const file of files) {
      try {
        const safeName=file.name.replace(/[^\w.\-\u0600-\u06FF]+/g,'_');
        const path=`studio_media/${p.id}/${Date.now()}_${safeName}`;
        const ref=storage.ref(path); await ref.put(file); const url=await ref.getDownloadURL();
        p.media.push({id:uid(),title:file.name,url,kind:file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':'document',addedAt:todayISO(),storagePath:path,size:file.size}); success++;
      } catch(error) { console.warn(error); studioToast(`فشل رفع ${file.name}: ${error.code||error.message}`, 'error'); }
    }
    if(success) { input.value=''; await persistProject(p,false); studioToast(`تم رفع ${success} ملف/ملفات.`, 'success'); }
  }

  function makeSnapshot(p, includeFinances, includeLinks) {
    const s=projectStats(p);
    const timeline=(p.timeline||[]).map(x=>({title:x.title,description:x.description||'',owner:x.owner||'Unknown',dueDate:x.dueDate||'Unknown',status:x.status,statusLabel:stepStatusLabel(x.status),completedAt:x.completedAt||null}));
    const done=timeline.filter(x=>x.status==='done').length;
    const current=timeline.find(x=>x.status==='active') || timeline.find(x=>x.status!=='done') || timeline[timeline.length-1] || null;
    const nextMeeting=projectMeetings(p).filter(m=>isFutureMeeting(m.dateTime)).sort((a,b)=>String(a.dateTime).localeCompare(String(b.dateTime)))[0] || null;
    const snapshot={
      kind:'studio-project-snapshot',version:2,publishedAt:nowISO(),name:p.name||'Unknown',school:p.school||'Unknown',clientName:p.clientName||'Unknown',teamNumber:p.teamNumber||'Unknown',projectType:p.projectType||'Unknown',
      description:p.description||'Unknown',problem:p.problem||'Unknown',deliverables:p.deliverables||'Unknown',status:p.status||'planning',statusLabel:labelStatus(p.status),startDate:p.startDate||'Unknown',deadline:p.deadline||'Unknown',
      deliveryMode:({full:'مشروع كامل ينفذه الفريق',mentoring:'Mentoring / إرشاد ومراجعة',hybrid:'تنفيذ مشترك بين الفريق والمدرسة'})[p.deliveryMode]||'Unknown',teamScope:p.teamScope||'Unknown',schoolScope:p.schoolScope||'Unknown',
      progressPct:timeline.length?Math.round(done*100/timeline.length):0,currentStep:current?.title||'لم يبدأ التنفيذ بعد',currentStepStatus:current?.statusLabel||'لم تبدأ',meetingDate:nextMeeting?.dateTime||p.meetingDate||'Unknown',
      timeline,tasks:(p.tasks||[]).map(t=>({title:t.title||'Unknown',dueDate:t.dueDate||'Unknown',priority:t.priority||'medium',status:t.status||'todo',completedAt:t.completedAt||null})),
      materials:(p.materials||[]).map(m=>({name:m.name,quantity:m.quantity,...(includeFinances?{unitPrice:Number(m.unitPrice)||0,total:(Number(m.quantity)||0)*(Number(m.unitPrice)||0)}:{}),status:m.status||'planned'})),
      media:(p.media||[]).map(m=>({title:m.title,url:m.url,kind:m.kind})),includeFinances:!!includeFinances,includeLinks:!!includeLinks
    };
    // The client snapshot intentionally excludes internal expenses, supplier links, phone numbers,
    // internal notes and the private transaction ledger. It publishes only agreed price, receipts,
    // balance and itemized project materials where the sharing toggle is enabled.
    if(includeFinances) snapshot.finances={contract:s.contract,received:s.received,due:s.due,materials:s.materials};
    if(includeLinks) snapshot.links={meetingLink:nextMeeting?.link||p.meetingLink||'',whatsappLink:p.whatsappLink||''};
    return snapshot;
  }
  function encodeSnapshot(snapshot) { return btoa(unescape(encodeURIComponent(JSON.stringify(snapshot)))); }
  function createStudioShareLink() {
    const p=getActive(); if(!p) return; const includeFinances=$('studio-share-finances')?.checked!==false; const includeLinks=$('studio-share-team-links')?.checked!==false;
    const snapshot=makeSnapshot(p,includeFinances,includeLinks); lastPublicSnapshot=snapshot;
    const reportUrl = new URL('project-report.html', location.href); reportUrl.search = ''; reportUrl.hash = '';
    const link=`${reportUrl.href}#studio-share=${encodeURIComponent(encodeSnapshot(snapshot))}`;
    const field=$('studio-share-url'); if(field) field.value=link;
    const preview=$('studio-share-preview'); if(preview) {preview.classList.remove('hidden'); preview.innerHTML=publicMarkup(snapshot,true);}
    studioToast('تم إنشاء رابط متابعة مستقل للقراءة فقط. الرابط لقطة ثابتة؛ حدّثه بعد تغيير الخطة أو الحساب.', 'success');
  }
  async function copyStudioShareLink() {
    const text=$('studio-share-url')?.value||''; if(!text) return studioToast('أنشئ رابط المتابعة أولًا.', 'info');
    try { if(navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text); else { const e=$('studio-share-url'); e.focus(); e.select(); document.execCommand('copy'); } studioToast('تم نسخ رابط المتابعة.', 'success'); }
    catch (_) { studioToast('الرابط ظاهر في المربع؛ انسخه يدويًا.', 'info'); }
  }
  function publicMarkup(s, compact) {
    const finance=s.includeFinances && s.finances ? `<section class="public-finance-grid"><article><span>قيمة المشروع المتفق عليها</span><strong>${money(s.finances.contract)}</strong></article><article><span>تم استلامه من العميل</span><strong class="positive-money">${money(s.finances.received)}</strong></article><article><span>المتبقي على العميل</span><strong class="negative-money">${money(s.finances.due)}</strong></article><article><span>إجمالي المواد المدرجة</span><strong>${money(s.finances.materials)}</strong></article></section>`:'';
    const tasks=`<section class="public-report-section"><h2>مهام التنفيذ والمتابعة</h2><div class="public-roadmap">${(s.tasks||[]).map((t,i)=>`<article class="public-roadmap-step"><span class="public-step-number">${i+1}</span><div><strong>${esc(t.title)}</strong><small>${esc(t.dueDate)} • ${esc(({todo:'لم تبدأ',active:'قيد التنفيذ',done:'مكتملة'})[t.status]||t.status)} • أولوية ${esc(({high:'عاجلة',medium:'متوسطة',low:'منخفضة'})[t.priority]||'متوسطة')}</small></div><span class="public-step-state ${t.status==='done'?'done':t.status==='active'?'active':'planned'}">${t.status==='done'?'✓':t.status==='active'?'…':'○'}</span></article>`).join('')||'<p>لم تضاف مهام فرعية حتى الآن.</p>'}</div></section>`;
    const links=s.includeLinks && s.links ? `<div class="public-link-row">${s.links.meetingLink?`<a href="${esc(s.links.meetingLink)}" target="_blank" rel="noopener"><i class="fas fa-video"></i> فتح الاجتماع</a>`:''}${s.links.whatsappLink?`<a href="${esc(s.links.whatsappLink)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> جروب المشروع</a>`:''}</div>`:'';
    const modeInfo=`<section class="public-report-section"><h2>طريقة التنفيذ وتقسيم المسؤوليات</h2><div class="public-scope-grid"><article><small>نمط المشروع</small><strong>${esc(s.deliveryMode||'Unknown')}</strong></article><article><small>على فريق التنفيذ</small><p>${esc(s.teamScope||'Unknown')}</p></article><article><small>على المدرسة / الطالب / المرشد</small><p>${esc(s.schoolScope||'Unknown')}</p></article></div></section>`;
    const itemHeaders=s.includeFinances?'<th>سعر الوحدة</th><th>الإجمالي</th>':'';
    const items=(s.materials||[]).map(m=>`<tr><td><strong>${esc(m.name)}</strong></td><td>${Number(m.quantity)||0}</td>${s.includeFinances?`<td>${money(m.unitPrice)}</td><td>${money(m.total)}</td>`:''}<td>${esc(({planned:'مطلوبة',ordered:'تم الطلب',bought:'تم الشراء',received:'تم الاستلام'})[m.status]||m.status)}</td></tr>`).join('');
    return `<div class="public-project-report ${compact?'is-compact':''}"><div class="public-brandline"><span class="public-brandmark">SB</span><span>STEM BATTLE OS <small>PROJECT PROGRESS REPORT</small></span><span class="public-report-date">تحديث ${esc((s.publishedAt||'').slice(0,10)||'Unknown')}</span></div><div class="public-report-hero"><span class="eyebrow">PROJECT • ${esc(s.teamNumber||'TEAM UNKNOWN')}</span><h1>${esc(s.name)}</h1><p>${esc(s.description)}</p><div class="public-meta-grid"><div><small>الجهة / المدرسة</small><strong>${esc(s.school)}</strong></div><div><small>العميل / الفريق</small><strong>${esc(s.clientName||s.teamNumber||'Unknown')}</strong></div><div><small>نوع المشروع</small><strong>${esc(s.projectType||'Unknown')}</strong></div><div><small>بداية المشروع</small><strong>${esc(s.startDate)}</strong></div><div><small>التسليم النهائي</small><strong>${esc(s.deadline)}</strong></div><div><small>الحالة</small><strong>${esc(s.statusLabel||s.status)}</strong></div>${s.meetingDate&&s.meetingDate!=='Unknown'?`<div><small>الاجتماع القادم</small><strong>${esc(String(s.meetingDate).replace('T',' '))}</strong></div>`:''}</div></div><section class="public-report-section public-current-stage"><div class="public-current-stage-heading"><div><span class="eyebrow">CURRENT STATUS</span><h2>المرحلة الحالية: ${esc(s.currentStep||'Unknown')}</h2><p>الحالة: ${esc(s.currentStepStatus||'Unknown')}</p></div><strong>${Number(s.progressPct)||0}%</strong></div><div class="public-progress-track"><span style="width:${Math.max(0,Math.min(100,Number(s.progressPct)||0))}%"></span></div><small>تم إنجاز ${Number((s.timeline||[]).filter(x=>x.status==='done').length)} من ${Number((s.timeline||[]).length)} مراحل الخريطة الزمنية.</small></section><section class="public-report-section"><h2>المشكلة والحل المستهدف</h2><p>${esc(s.problem||'Unknown')}</p><h3>المخرجات ومعايير التسليم</h3><p>${esc(s.deliverables||'Unknown')}</p></section>${modeInfo}<section class="public-report-section"><h2>الخريطة الزمنية للمشروع</h2><div class="public-roadmap">${(s.timeline||[]).map((step,i)=>`<article class="public-roadmap-step"><span class="public-step-number">${i+1}</span><div><strong>${esc(step.title)}</strong><p>${esc(step.description)}</p><small>${esc(step.dueDate)} • ${esc(step.owner)} • ${esc(step.statusLabel||step.status)}</small></div><span class="public-step-state ${step.status==='done'?'done':step.status==='active'?'active':'planned'}">${step.status==='done'?'✓':step.status==='active'?'…':'○'}</span></article>`).join('')||'<p>لا توجد خطوات في الخريطة بعد.</p>'}</div></section>${tasks}<section class="public-report-section"><h2>المواد المطلوبة للمشروع</h2><div class="studio-table-wrap"><table class="studio-table"><thead><tr><th>المادة / القطعة</th><th>الكمية</th>${itemHeaders}<th>حالة التجهيز</th></tr></thead><tbody>${items||`<tr><td colspan="${s.includeFinances?5:3}" class="empty-cell">سيتم تحديث قائمة المواد عند اعتمادها.</td></tr>`}</tbody></table></div></section>${finance}<section class="public-report-section"><h2>صور وفيديوهات ومرفقات المشروع</h2><div class="public-media-grid">${(s.media||[]).map(m=>`<a href="${esc(m.url)}" target="_blank" rel="noopener"><i class="fas ${m.kind==='image'?'fa-image':m.kind==='video'?'fa-film':'fa-file-alt'}"></i> ${esc(m.title)}</a>`).join('')||'<span>سيتم إضافة أدلة التنفيذ والصور أثناء تقدم المشروع.</span>'}</div></section>${links}<footer class="public-report-footer">صفحة متابعة مستقلة للقراءة فقط. لا تعرض هواتف الفريق أو الموردين أو المصروفات الداخلية أو أرصدة المشاريع الأخرى. آخر نسخة منشورة: ${esc((s.publishedAt||'').replace('T',' ').slice(0,16))}</footer></div>`;
  }
  function printStudioReport() {
    const p=getActive(); if(!p) return; const snapshot=makeSnapshot(p,true,true); const win=window.open('','_blank');
    if(!win) return studioToast('المتصفح منع نافذة الطباعة؛ اسمح بالنوافذ المنبثقة للموقع ثم جرّب مرة أخرى.', 'error');
    try { win.opener = null; } catch (_) {}
    win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>تقرير ${esc(p.name)}</title><link rel="stylesheet" href="${location.origin}${location.pathname.replace(/[^/]*$/,'')}upgrade.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"><style>body{background:#07111f!important;padding:24px!important}.public-project-report{max-width:1100px;margin:auto;box-shadow:none!important}@media print{body{padding:0!important}.public-project-report{max-width:none!important}}</style></head><body>${publicMarkup(snapshot,false)}<script>window.onload=function(){setTimeout(function(){window.print()},350)};<\/script></body></html>`);
    win.document.close();
  }
  async function exportStudioTimelinePNG() {
    const p=getActive(); if(!p) return;
    if(typeof html2canvas!=='function') return studioToast('مكتبة تصدير الصورة لم تُحمّل. استخدم طباعة / PDF كبديل.', 'error');
    const snap=makeSnapshot(p,true,true); let mount=$('studio-export-temp');
    if(!mount) { mount=document.createElement('div'); mount.id='studio-export-temp'; mount.style.cssText='position:fixed;left:-20000px;top:0;width:1100px;background:#07111f;z-index:-1'; document.body.appendChild(mount); }
    mount.innerHTML=publicMarkup(snap,false);
    try { const canvas=await html2canvas(mount.firstElementChild,{backgroundColor:'#07111f',scale:2,useCORS:true}); const link=document.createElement('a'); link.download=`${(p.name||'project').replace(/[^\w\u0600-\u06FF-]+/g,'_')}-timeline.png`; link.href=canvas.toDataURL('image/png'); link.click(); studioToast('تم تجهيز صورة التقرير.', 'success'); }
    catch(error) { studioToast('تعذر تصدير الصورة: '+error.message, 'error'); }
  }
  async function askStudioAI(event) {
    if(event) event.preventDefault(); const form=event?.currentTarget; const question=String(new FormData(form).get('question')||'').trim(); if(!question) return false;
    const p=getActive(); if(!p) return false;
    const apiKey=localStorage.getItem('ai_api_key'); if(!apiKey) return studioToast('احفظ مفتاح AI من قسم الامتحانات أولًا.', 'error'), false;
    p.aiChatHistory=p.aiChatHistory||[]; p.aiChatHistory.push({role:'user',content:question,at:nowISO()}); await persistProject(p,true); renderStudio();
    const answer=await callStudioAI(p,question);
    p.aiChatHistory.push({role:'assistant',content:answer,at:nowISO()}); await persistProject(p,true); renderStudio();
    const box=$('studio-ai-chat'); if(box) box.scrollTop=box.scrollHeight;
    return false;
  }
  async function askStudioAIPreset(question) {
    const p=getActive(); if(!p) return; const apiKey=localStorage.getItem('ai_api_key'); if(!apiKey) return studioToast('احفظ مفتاح AI من قسم الامتحانات أولًا.', 'error');
    p.aiChatHistory=p.aiChatHistory||[]; p.aiChatHistory.push({role:'user',content:question,at:nowISO()}); await persistProject(p,true); renderStudio();
    const answer=await callStudioAI(p,question); p.aiChatHistory.push({role:'assistant',content:answer,at:nowISO()}); await persistProject(p,true); renderStudio();
  }
  async function callStudioAI(p, question) {
    const apiKey=localStorage.getItem('ai_api_key'); const select=$('ai-model-select'); const model=select?.value && !String(select.value).startsWith('llama') ? select.value : 'openai/gpt-oss-120b';
    const s=projectStats(p);
    const context={name:p.name,school:p.school,client:p.clientName,projectType:p.projectType,description:p.description,problem:p.problem,deliverables:p.deliverables,status:labelStatus(p.status),startDate:p.startDate,deadline:p.deadline,materials:p.materials,timeline:p.timeline,tasks:p.tasks,ledger:p.ledger,finance:{contract:s.contract,received:s.received,due:s.due,materialsCost:s.materials,otherExpenses:s.expenses,expectedMargin:s.expectedMargin},team:{members:(p.members||[]).map(m=>({name:m.name,role:m.role})),teamNames:p.teamMembers,teamNumber:p.teamNumber,meetingDate:p.meetingDate,meetings:p.meetings||[]},delivery:{mode:p.deliveryMode,teamScope:p.teamScope,schoolScope:p.schoolScope}};
    const messages=[{role:'system',content:'You are the project operations assistant for a student engineering/science team. Respond in clear Egyptian Arabic unless the user requests otherwise. Be practical and precise. Treat absent values as Unknown; never invent prices, dates, or materials. Flag safety risks, dependencies, budget gaps, deadline risks, and assumptions. When proposing a timeline, distinguish known data from suggestions. Do not claim you actually updated the database; provide suggested changes unless the user explicitly applies them.'}];
    (p.aiChatHistory||[]).slice(-8).forEach(m=>messages.push({role:m.role==='assistant'?'assistant':'user',content:m.content}));
    messages.push({role:'user',content:`Project context (JSON; use it as the source of truth):\n${JSON.stringify(context)}\n\nTeam question/action request: ${question}`});
    try {
      const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model, messages, temperature:0.35, max_tokens:2500})});
      const data=await response.json(); if(!response.ok || data.error) throw new Error(data.error?.message||`HTTP ${response.status}`);
      return data.choices?.[0]?.message?.content || 'لم يصل رد من المساعد.';
    } catch(error) { return `تعذر الاتصال بمساعد AI: ${error.message}\n\nتأكد من صلاحية مفتاح Groq ومن اختيار نموذج مدعوم. لم يتم تعديل البيانات تلقائيًا.`; }
  }
  function deleteStudioProject() {
    const p=getActive(); if(!p || !confirm(`هل تريد حذف مشروع «${p.name}» من Studio؟ لن يتأثر قسم المشاريع القديم أو سجلات المستخدمين.`)) return;
    projects=projects.filter(x=>x.id!==p.id); activeProjectId=projects[0]?.id||null; writeLocal();
    if(typeof db!=='undefined'&&db) db.collection('studio_projects').doc(p.id).delete().catch(error=>console.warn('[Studio] Remote project delete unavailable',error));
    renderStudio(); studioToast('تم حذف سجل المشروع من Studio.', 'info');
  }

  function openCreatePanel() { $('studio-create-panel')?.classList.toggle('hidden'); }
  function renderPublicShare() {
    const prefix='#studio-share='; if(!location.hash.startsWith(prefix)) return false;
    const root=$('public-studio-share'); if(!root) return false;
    try {
      const raw=decodeURIComponent(location.hash.slice(prefix.length)); const snapshot=JSON.parse(decodeURIComponent(escape(atob(raw))));
      if(snapshot.kind!=='studio-project-snapshot') throw new Error('Invalid shared project');
      $('login-screen')?.classList.add('hidden'); $('app-screen')?.classList.add('hidden'); root.classList.remove('hidden'); root.innerHTML=`<div class="public-share-shell"><div class="public-share-top"><span class="public-brandmark">SB</span><div><strong>STEM BATTLE OS</strong><small>PROJECT VIEW ONLY</small></div><button class="studio-btn small" onclick="window.print()"><i class="fas fa-print"></i> طباعة / PDF</button></div>${publicMarkup(snapshot,false)}<p class="public-security-note">هذه صفحة مستقلة تعرض نسخة من التقرير وقت إنشاء الرابط. لا تمنح أي صلاحية للدخول إلى بقية الموقع.</p></div>`;
      document.title=`متابعة المشروع | ${snapshot.name||'Studio'}`; return true;
    } catch(error) { root?.classList.remove('hidden'); if(root) root.innerHTML='<div class="public-share-shell"><h2>الرابط غير صالح أو بياناته غير مكتملة</h2><p>اطلب من فريق المشروع إنشاء رابط جديد.</p></div>'; $('login-screen')?.classList.add('hidden'); return true; }
  }

  function ensureStudioCreateFields() {
    const form=$('studio-create-form'); if(!form || form.querySelector('[name="deliveryMode"]')) return;
    const projectType=form.querySelector('[name="projectType"]')?.closest('label'); if(!projectType) return;
    projectType.insertAdjacentHTML('afterend', `<label class="studio-field"><span>طريقة التنفيذ</span><select name="deliveryMode"><option value="full">مشروع كامل من الفريق</option><option value="mentoring">Mentoring / إرشاد فقط</option><option value="hybrid">مشترك مع المدرسة</option></select></label><label class="studio-field"><span>المطلوب من فريقنا</span><input name="teamScope" placeholder="تصميم، تجميع، برمجة..."></label><label class="studio-field"><span>المطلوب من المدرسة / الطالب</span><input name="schoolScope" placeholder="اختبارات، عرض، جزء من التنفيذ..."></label>`);
  }
  function initStudioModule(user) {
    ensureStudioCreateFields();
    activeUser=user||activeUser||(typeof currentUser!=='undefined'?currentUser:null)||'Unknown';
    if(loadPromise) return loadPromise;
    loadPromise=loadProjects().finally(()=>{loadPromise=null;});
    return loadPromise;
  }

  window.initStudioModule=initStudioModule;
  window.createStudioProject=createStudioProject;
  window.openStudioCreatePanel=openCreatePanel;
  window.selectStudioProject=selectStudioProject;
  window.saveStudioDetails=saveStudioDetails;
  window.generateStudioTimeline=generateStudioTimeline;
  window.addStudioStep=addStudioStep;
  window.updateStudioStep=updateStudioStep;
  window.editStudioStep=editStudioStep;
  window.addStudioTask=addStudioTask;
  window.updateStudioTask=updateStudioTask;
  window.removeStudioTask=removeStudioTask;
  window.generateStudioTasksFromTimeline=generateStudioTasksFromTimeline;
  window.addStudioMaterial=addStudioMaterial;
  window.editStudioMaterial=editStudioMaterial;
  window.cancelEditStudioMaterial=cancelEditStudioMaterial;
  window.addAnotherStudioMaterial=addAnotherStudioMaterial;
  window.addCurrentMaterialNameToCatalog=addCurrentMaterialNameToCatalog;
  window.addStudioCatalogItem=addStudioCatalogItem;
  window.exportStudioMaterialsCSV=exportStudioMaterialsCSV;
  window.exportStudioMaterialsByProjectCSV=exportStudioMaterialsByProjectCSV;
  window.printStudioMaterialsReport=printStudioMaterialsReport;
  window.removeStudioMaterial=removeStudioMaterial;
  window.addStudioMember=addStudioMember;
  window.editStudioMember=editStudioMember;
  window.removeStudioMember=removeStudioMember;
  window.addStudioMeeting=addStudioMeeting;
  window.editStudioMeeting=editStudioMeeting;
  window.removeStudioMeeting=removeStudioMeeting;
  window.addStudioLedger=addStudioLedger;
  window.editStudioLedger=editStudioLedger;
  window.removeStudioLedger=removeStudioLedger;
  window.addStudioMediaLink=addStudioMediaLink;
  window.removeStudioMedia=removeStudioMedia;
  window.uploadStudioMedia=uploadStudioMedia;
  window.createStudioShareLink=createStudioShareLink;
  window.copyStudioShareLink=copyStudioShareLink;
  window.printStudioReport=printStudioReport;
  window.exportStudioTimelinePNG=exportStudioTimelinePNG;
  window.askStudioAI=askStudioAI;
  window.askStudioAIPreset=askStudioAIPreset;
  window.deleteStudioProject=deleteStudioProject;

  document.addEventListener('DOMContentLoaded', function () {
    if (renderPublicShare()) return;
    ensureStudioCreateFields();
    const panel=$('studio-create-panel'); if(panel) panel.classList.add('hidden');
  });
})();
