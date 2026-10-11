/*
 * Academic, language, Quran/Hadith and reading tracker.
 * Imported curriculum records come from curriculum-data.js, generated from the uploaded DOCX files.
 */
(function () {
  'use strict';
  const DATA = () => window.MORTAQTA_CURRICULUM || window.MORTAQA_CURRICULUM || {};
  const MULTIPLIER = 3.25;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const moneyless = (v) => new Intl.NumberFormat('en-US').format(Number(v)||0);
  const newId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `log-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const STORAGE_PREFIX = 'mortaqa_academy_progress_v1_';
  const activityMeta = {
    attendance:{label:'حضور',icon:'fa-user-check',base:40}, lesson:{label:'مذاكرة المحتوى',icon:'fa-book-open',base:100}, video:{label:'مشاهدة فيديو',icon:'fa-play-circle',base:300}, summary:{label:'ملخص / نوتس',icon:'fa-pen',base:100}, quiz:{label:'اختبار / تطبيق',icon:'fa-clipboard-check',base:250}, practical:{label:'عملي / Lab',icon:'fa-flask',base:300}, speaking:{label:'Speaking',icon:'fa-microphone',base:350}, writing:{label:'Writing',icon:'fa-pen-nib',base:300}, listening:{label:'Listening',icon:'fa-headphones',base:300}, reading:{label:'Reading',icon:'fa-book-reader',base:100}, vocabulary:{label:'Vocabulary',icon:'fa-language',base:150}, review:{label:'مراجعة',icon:'fa-repeat',base:200}
  };
  const languagePointBase = [500,750,1000,1300];
  const languageWeights = {listening:0.8,reading:1,vocabulary:0.5,writing:1.1,speaking:1.2,review:0.5};
  let area='secondary';
  let activeUser='Unknown';
  let progress={completed:{},awarded:{},points:0,languageLogs:[],quranRecords:[],hadithRecords:{},readingLogs:[],assignedBooks:[],customNotes:[]};
  let selectedCourseId=null;
  let selectedLanguageId='english';
  let selectedBookId=null;
  let selectedBookCategory='all';
  let sharedPickerSessionMode=false;
  const sharedPickerSelections=Object.create(null);
  let selectedSurahNo=1;
  let quranFilter='';
  let cachedSecondary=[];
  let academicLoadedFor=null;
  let aiBusy=false;

  function defaultProgress() { return {completed:{},awarded:{},points:0,languageLogs:[],quranRecords:[],hadithRecords:{},readingLogs:[],assignedBooks:[],customNotes:[]}; }
  function toast(message,type='info') { if(typeof showToast==='function') showToast(message,type); else console.log(message); }
  function keyForUser(user) { return STORAGE_PREFIX + (user || 'Unknown'); }
  function mergeProgress(source) {
    const next=defaultProgress(); const src=source||{};
    next.completed={...(src.completed||{})}; next.awarded={...(src.awarded||{})}; next.points=Number(src.points)||0;
    next.languageLogs=Array.isArray(src.languageLogs)?src.languageLogs:[]; next.quranRecords=Array.isArray(src.quranRecords)?src.quranRecords:[];
    next.hadithRecords=src.hadithRecords&&typeof src.hadithRecords==='object'?src.hadithRecords:{}; next.readingLogs=Array.isArray(src.readingLogs)?src.readingLogs:[];
    next.assignedBooks=Array.isArray(src.assignedBooks)?src.assignedBooks:[]; next.customNotes=Array.isArray(src.customNotes)?src.customNotes:[];
    return next;
  }
  function saveLocalProgress() {
    try { localStorage.setItem(keyForUser(activeUser),JSON.stringify(progress)); }
    catch (error) { toast('تعذر حفظ تقدم التعلم محليًا: '+error.message,'error'); }
  }
  async function persistProgress() {
    saveLocalProgress();
    if(typeof db!=='undefined' && db && activeUser && activeUser!=='Unknown') {
      try {
        await db.collection('users').doc(activeUser).collection('academic_progress').doc('tracker').set({completed:progress.completed,awarded:progress.awarded,points:progress.points,languageLogs:progress.languageLogs,quranRecords:progress.quranRecords,hadithRecords:progress.hadithRecords,readingLogs:progress.readingLogs,assignedBooks:progress.assignedBooks,customNotes:progress.customNotes,updatedAt:new Date().toISOString()},{merge:true});
      } catch (error) { console.warn('[Academy] Firestore sync unavailable; local progress retained.',error); }
    }
  }
  async function loadProgressForUser(user) {
    activeUser=user||'Unknown';
    let local=defaultProgress();
    try { local=mergeProgress(JSON.parse(localStorage.getItem(keyForUser(activeUser))||'{}')); } catch (_) {}
    progress=local;
    if(typeof db!=='undefined' && db && activeUser!=='Unknown') {
      try {
        const doc=await db.collection('users').doc(activeUser).collection('academic_progress').doc('tracker').get();
        if(doc.exists) {
          const remote=mergeProgress(doc.data());
          progress=mergeProgress({
            completed:{...local.completed,...remote.completed}, awarded:{...local.awarded,...remote.awarded}, points:Math.max(local.points,remote.points),
            languageLogs:mergeById(local.languageLogs,remote.languageLogs), quranRecords:mergeById(local.quranRecords,remote.quranRecords),
            hadithRecords:{...local.hadithRecords,...remote.hadithRecords}, readingLogs:mergeById(local.readingLogs,remote.readingLogs),
            assignedBooks:mergeById(local.assignedBooks,remote.assignedBooks),customNotes:mergeById(local.customNotes,remote.customNotes)
          });
          saveLocalProgress();
        }
      } catch (error) { console.warn('[Academy] Read from Firestore failed; using local progress.',error); }
    }
    const ledgerTotal = Object.values(progress.awarded || {}).reduce((sum, award) => sum + Math.max(0, Number(award && award.points) || 0), 0);
    progress.points = Math.max(Number(progress.points) || 0, ledgerTotal);
    saveLocalProgress();
  }
  function mergeById(a,b) {
    const map=new Map(); [...(a||[]),...(b||[])].forEach(item=>{ if(item && item.id) {const existing=map.get(item.id); if(!existing || String(item.updatedAt||item.date||'')>String(existing.updatedAt||existing.date||'')) map.set(item.id,item);} });
    return Array.from(map.values());
  }
  function awardDirectPoints(points,awardKey,title) {
    const value=Math.max(0,Math.round(Number(points)||0));
    if(!awardKey || progress.awarded[awardKey]) return 0;
    progress.awarded[awardKey]={points:value,title:title||'Academic task',date:new Date().toISOString()};
    progress.points += value;
    if(typeof localData!=='undefined' && localData) {
      localData.points=(Number(localData.points)||0)+value;
      const header=$('header-score'); if(header) header.innerText=localData.points;
      if(typeof saveToDB==='function') Promise.resolve(saveToDB()).catch(error=>console.warn('[Academy] Core points sync failed',error));
    }
    return value;
  }
  function awardTask(basePoints,awardKey,title) { return awardDirectPoints(Math.round((Number(basePoints)||0)*MULTIPLIER),awardKey,title); }
  function completeTask(key,basePoints,title) {
    if(progress.completed[key]) { toast('المهمة مكتملة بالفعل.','info'); return; }
    progress.completed[key]=true;
    const awarded=awardTask(basePoints,key,title);
    persistProgress();
    toast(awarded?`تم تسجيل ${title} وإضافة ${moneyless(awarded)} نقطة.`:'تم تسجيل المهمة.', 'success');
    renderAcademic();
  }
  function getTaskPoints(task) { return (activityMeta[task]||activityMeta.lesson).base; }

  function secondaryCourses() {
    if(cachedSecondary.length) return cachedSecondary;
    const curriculum=typeof finalsCurriculum!=='undefined'?finalsCurriculum:{};
    const courses=[];
    const makeCourse=(subject,units,extras={})=>courses.push({
      id:'secondary-'+String(subject).toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      university:'منهج تالتة ثانوي',faculty:'Secondary',stage:'الصف الثالث الثانوي',term:'منهج تالتة ثانوي • من قوائم الموقع الحالية',
      name:subject,nameAr:extras.nameAr||subject,category:'Secondary',source:extras.source||'بيانات المنهج/المهام الموجودة في script.js',
      chapters:Object.entries(units||{}).map(([unit,lessons],index)=>({week:String(index+1),title:unit,content:Array.isArray(lessons)?lessons.join(' • '):String(lessons),tracking:'تابع إنجاز كل نشاط من Shared Tasks؛ تفاصيل المحتوى الإضافي يمكن استكمالها من ملفات المنهج الأصلية.',tasks:['lesson','video','summary','quiz'],lessons:Array.isArray(lessons)?lessons.map(x=>String(x)):[String(lessons)]}))
    });
    Object.entries(curriculum).forEach(([subject,units])=>{
      if(subject==='Languages') return;
      makeCourse(subject,units,{nameAr:subject==='Arabic'?'العربي':subject});
    });
    const generalLanguages=curriculum.Languages||{};
    makeCourse('German',generalLanguages,{nameAr:'الألماني',source:'قائمة الوحدات والمهام اللغوية الحالية بالموقع'});
    makeCourse('French',generalLanguages,{nameAr:'الفرنساوي',source:'قائمة الوحدات والمهام اللغوية الحالية بالموقع'});
    const courseLabels={Math:'الرياضيات',Mechanics:'الميكانيكا',Physics:'الفيزياء',Chemistry:'الكيمياء',Biology:'الأحياء',Geo:'الجغرافيا'};
    const genericTerms=['Sec 3 Term 1','Sec 3 Term 2','Grade 10 (URT)','Grade 11 (URT)'];
    Object.entries(courseLabels).forEach(([subject,nameAr])=>{
      if(subject==='Physics') {
        makeCourse(subject,Object.fromEntries(Array.from({length:14},(_,i)=>[`LO ${i+1}`,[`LO ${i+1}`]])),{nameAr,source:'قائمة LO 1–14 كما تظهر في محدد مهام الفيزياء الحالي؛ أسماء الدروس التفصيلية غير متاحة في هذا المصدر.'});
      } else if(subject==='Chemistry') {
        makeCourse(subject,Object.fromEntries(Array.from({length:4},(_,i)=>[`Module ${i+1}`,[`Module ${i+1}`]])),{nameAr,source:'قائمة Modules 1–4 كما تظهر في محدد مهام الكيمياء الحالي؛ تفاصيل الدروس غير متاحة في هذا المصدر.'});
      } else {
        makeCourse(subject,Object.fromEntries(genericTerms.map(term=>[term,[term]])),{nameAr,source:'التقسيم مأخوذ من مجموعات المهام الموجودة حاليًا، وليس تفريغًا رسميًا كاملًا للمنهج.'});
      }
    });
    cachedSecondary=courses;
    return cachedSecondary;
  }
  function allCourses() { return [...secondaryCourses(),...(DATA().academicCourses||[])]; }
  function findCourse(id) { return allCourses().find(c=>c.id===id)||null; }
  function courseCompletedCount(course) {
    let total=0,done=0;
    (course.chapters||[]).forEach((ch,i)=>{
      const lessons=ch.lessons&&ch.lessons.length?ch.lessons:[ch.title||`Lesson ${i+1}`];
      lessons.forEach((lesson,j)=>{
        const activityKeyBase=course.id+'::'+i+'::'+j;
        const taskTypes=Array.from(new Set(['attendance',...(course.id.startsWith('secondary-')?['lesson','video','summary','quiz']:(ch.tasks||['lesson','video','summary','quiz']))]));
        taskTypes.forEach(task=>{total++; if(progress.completed[activityKeyBase+'::'+task]) done++;});
      });
    });
    return {total,done,percent:total?Math.round(done*100/total):0};
  }
  function taskLabel(task) { return (activityMeta[task]||{label:task,icon:'fa-check'}).label; }
  function taskIsQueued(id) { return !!(window.isAcademyTaskQueued && window.isAcademyTaskQueued(id)); }
  function taskButtonState(id) {
    if (progress.completed[id]) return {done:true,queued:false,label:'تم الإنجاز',icon:'fa-check-circle',className:'done'};
    if (taskIsQueued(id)) return {done:false,queued:true,label:'في Shared Tasks',icon:'fa-list-check',className:'queued'};
    return {done:false,queued:false,label:'إضافة إلى Shared Tasks',icon:'fa-plus',className:''};
  }
  function queueAcademyTask(meta, quiet=false) {
    if (!meta || !meta.id) return false;
    if (progress.completed[meta.id]) { if(!quiet) toast('المهمة مكتملة بالفعل؛ لا يمكن احتسابها مرة أخرى.','info'); return false; }
    if (taskIsQueued(meta.id)) { if(!quiet) toast('المهمة موجودة بالفعل في Shared Tasks.','info'); return false; }
    if (typeof window.addAcademyTaskToSharedPoll !== 'function') { toast('قائمة Shared Tasks غير جاهزة. أعد فتح النافذة وحاول مرة أخرى.','error'); return false; }
    const added=window.addAcademyTaskToSharedPoll(meta);
    if (added) renderAcademic();
    return !!added;
  }
  function queueCourseActivity(courseId,chapterIndex,lessonIndex,task) {
    const course=findCourse(courseId); if(!course) return false;
    const chapter=course.chapters[chapterIndex]; const lesson=chapter?.lessons?.[lessonIndex] || chapter?.title || `Lesson ${lessonIndex+1}`;
    const id=`${courseId}::${chapterIndex}::${lessonIndex}::${task}`;
    return queueAcademyTask({id,label:`${course.name}: ${lesson} (${taskLabel(task)})`,basePoints:getTaskPoints(task),kind:'course',courseId,chapterIndex,lessonIndex,activity:task});
  }
  function queueLanguageActivity(langId,levelIndex,task) {
    const lang=(DATA().languages||[]).find(x=>x.id===langId); if(!lang) return false;
    const level=lang.track[levelIndex]||lang.track[0]; const base=(languagePointBase[levelIndex]||1300)*(languageWeights[task]||1);
    const id=`lang-level::${langId}::${levelIndex}::${task}`;
    return queueAcademyTask({id,label:`${lang.name} ${level.level}: ${taskLabel(task)}`,basePoints:base,kind:'language-level',languageId:langId,levelIndex,activity:task});
  }
  function requeueAcademyRecord(kind, recordId) {
    if (!recordId) return false;
    let meta = null;
    if (kind === 'language-session') {
      const log = progress.languageLogs.find(x => x.id === recordId);
      if (log) meta = {id:`language-session::${log.id}`,label:`${log.language}: ${log.title} (${log.minutes} دقيقة · ${log.wordCount} كلمة)`,basePoints:log.basePoints,kind:'language-session',recordId:log.id,languageId:log.languageId,levelIndex:log.levelIndex,activity:log.type};
    } else if (kind === 'quran-record') {
      const record = progress.quranRecords.find(x => x.id === recordId);
      if (record) meta = {id:`quran-record::${record.id}`,label:`القرآن: ${record.surahName} · الآيات ${record.ayahStart}-${record.ayahEnd} · ${record.kindLabel}`,basePoints:record.basePoints,kind:'quran-record',recordId:record.id};
    } else if (kind === 'reading-pages') {
      const log = progress.readingLogs.find(x => x.id === recordId);
      if (log) meta = {id:`reading-pages::${log.id}`,label:`قراءة: ${log.title} · الصفحات ${log.pageStart}-${log.pageEnd} (${log.pages} صفحة)`,basePoints:log.basePoints,kind:'reading-pages',recordId:log.id};
    }
    if (!meta) return false;
    if (progress.completed[meta.id]) return toast('المهمة مكتملة بالفعل.','info'), false;
    return queueAcademyTask(meta);
  }
  function completeQueuedAcademyTask(meta) {
    if(!meta || !meta.id) return false;
    if(progress.completed[meta.id]) return true;
    progress.completed[meta.id]=true;
    const points=awardTask(Number(meta.basePoints)||0,meta.id,meta.label||'Academy task');
    if(meta.kind==='language-session') {
      const log=progress.languageLogs.find(x=>x.id===meta.recordId); if(log){log.completed=true;log.status='completed';log.points=points;log.updatedAt=new Date().toISOString();}
    } else if(meta.kind==='quran-record') {
      const record=progress.quranRecords.find(x=>x.id===meta.recordId); if(record){record.completed=true;record.status='completed';record.points=points;if(record.kind==='weekly-recitation') record.lastWeekRecited=true;record.updatedAt=new Date().toISOString();}
    } else if(meta.kind==='reading-pages') {
      const log=progress.readingLogs.find(x=>x.id===meta.recordId); if(log){log.completed=true;log.status='completed';log.points=points;log.updatedAt=new Date().toISOString();}
    } else if(meta.kind==='hadith-memorization') {
      const key=String(meta.hadithNo||''); const existing=progress.hadithRecords[key]||{};
      progress.hadithRecords[key]={...existing,memorized:true,pendingMemorization:false,grade:existing.grade||'A',date:new Date().toISOString(),points,updatedAt:new Date().toISOString()};
    } else if(meta.kind==='hadith-review') {
      const key=String(meta.hadithNo||''); const existing=progress.hadithRecords[key]||{};
      progress.hadithRecords[key]={...existing,lastWeekRecited:true,reviewPending:false,reviewCompleted:true,reviewPoints:points,weekReviewedAt:new Date().toISOString()};
    }
    persistProgress(); renderAcademic();
    toast(points?`تم إكمال المهمة وإضافة ${moneyless(points)} نقطة إلى رصيدك.`:'تم تسجيل إكمال المهمة.','success');
    return true;
  }
  window.isAcademyTaskCompleted = id => !!progress.completed[id];
  window.completeAcademySharedTask = completeQueuedAcademyTask;
  window.requeueAcademyRecord = requeueAcademyRecord;
  window.queueAcademyTask = queueAcademyTask;
  window.queueAcademyCourseActivity = queueCourseActivity;
  window.queueAcademyLanguageActivity = queueLanguageActivity;
  function renderAcademic() {
    const root=$('academy-content'); if(!root) return;
    const overview=$('academy-kpis');
    const doneTasks=Object.keys(progress.completed).length; const totalEarned=progress.points||0;
    const langSessions=progress.languageLogs.length; const pages=progress.readingLogs.reduce((s,x)=>s+(Number(x.pages)||0),0);
    if(overview) overview.innerHTML=`<article class="academy-kpi kpi-a"><span>مهام مكتملة</span><strong>${doneTasks}</strong><small>من كل المسارات</small></article><article class="academy-kpi kpi-b"><span>نقاط التعلم</span><strong>${moneyless(totalEarned)}</strong><small>المضاعف الحالي ×${MULTIPLIER}</small></article><article class="academy-kpi kpi-c"><span>جلسات اللغات</span><strong>${langSessions}</strong><small>استماع وقراءة وكتابة ومحادثة</small></article><article class="academy-kpi kpi-d"><span>صفحات قراءة مسجلة</span><strong>${moneyless(pages)}</strong><small>عدد الصفحات في سجلات الجلسات</small></article>`;
    if(area==='secondary') return renderCourseCatalog(root,'secondary');
    if(area==='engineering') return renderCourseCatalog(root,'engineering');
    if(area==='medicine') return renderCourseCatalog(root,'medicine');
    if(area==='course') return renderCourseDetail(root);
    if(area==='languages') return renderLanguages(root);
    if(area==='language-detail') return renderLanguageDetail(root);
    if(area==='quran') return renderQuran(root);
    if(area==='reading') return renderReading(root);
    if(area==='reading-detail') return renderReadingDetail(root);
    if(area==='academy-ai') return renderAcademyAI(root);
    root.innerHTML='<div class="studio-empty-small">اختر مسارًا تعليميًا من الأعلى.</div>';
  }
  function renderCourseCatalog(root,kind) {
    let courses=[];
    if(kind==='secondary') courses=secondaryCourses();
    else if(kind==='engineering') courses=(DATA().academicCourses||[]).filter(c=>c.faculty==='Engineering');
    else if(kind==='medicine') courses=(DATA().academicCourses||[]).filter(c=>c.faculty==='Medicine & Surgery');
    const title=kind==='secondary'?'منهج تالتة ثانوي':kind==='engineering'?'Engineering · EUI':'Medicine · MNU';
    root.innerHTML=`<div class="academy-area-heading"><div><span class="eyebrow">LEARNING TRACKS</span><h2>${title}</h2><p>${kind==='medicine'?'Foundation 1 • Year 1 • 2026–2027. المسار مأخوذ من مستند المنهج المرفق.':'افتح المادة ثم تابع كل chapter / lesson والأنشطة المستقلة.'}</p></div><span class="studio-status status-active">تقدم محفوظ</span></div><div class="academy-course-grid">${courses.map(course=>{
      const stats=courseCompletedCount(course); return `<button class="academy-course-card" type="button" onclick="openAcademyCourse('${esc(course.id)}')"><span class="academy-course-top"><span class="academy-course-icon"><i class="fas ${course.faculty==='Medicine & Surgery'?'fa-heartbeat':course.category==='Chemistry'?'fa-flask':course.category==='Programming'?'fa-code':course.category==='Mathematics'?'fa-square-root-alt':'fa-graduation-cap'}"></i></span><span class="studio-status status-active">${stats.percent}%</span></span><strong>${esc(course.name)}</strong><span class="academy-course-subtitle">${esc(course.nameAr||course.category||'')}</span><p>${esc(course.university||'')}</p><div class="academy-progress-track"><span style="width:${stats.percent}%"></span></div><div class="academy-course-foot"><span>${(course.chapters||[]).length} Chapters / Weeks</span><span>${stats.done}/${stats.total} مهام</span></div></button>`;
    }).join('')}</div>${kind==='engineering'?'<p class="academy-source-note">تنبيه بيانات: المستند يصف بعض المقررات الإضافية بأنها مراجع/خطة مقترحة وفق NARS، وليس كلّها جدولًا رسميًا مصدّقًا من الجامعة؛ تحقّق من اللائحة قبل الاعتماد النهائي.</p>':''}${kind==='medicine'?'<p class="academy-source-note">الخطة المرجعية المرفقة تعرض Foundation 1 ومصفوفة الأسابيع، لكن أسماء المحاضرات التفصيلية غير متوفرة لكل رقم Lec/Prac؛ لم تُخترع أسماء محاضرات غير موجودة في الملف.</p>':''}`;
  }
  function openAcademyCourse(id) { selectedCourseId=id; area='course'; setAreaButtons(); renderAcademic(); }
  function renderCourseDetail(root) {
    const course=findCourse(selectedCourseId); if(!course) { area='secondary'; return renderCourseCatalog(root,'secondary'); }
    const stats=courseCompletedCount(course);
    root.innerHTML=`<div class="academy-area-heading"><div><button class="studio-btn small" onclick="switchAcademicArea('${course.faculty==='Medicine & Surgery'?'medicine':course.faculty==='Engineering'?'engineering':'secondary'}')"><i class="fas fa-arrow-right"></i> رجوع للمواد</button><span class="eyebrow">${esc(course.university||'ACADEMY')}</span><h2>${esc(course.name)}</h2><p>${esc(course.term||course.stage||'')}</p></div><div class="academy-detail-progress"><strong>${stats.percent}%</strong><span>مكتمل</span></div></div><div class="academy-course-metadata"><span><small>الكلية / المسار</small><strong>${esc(course.faculty||'Unknown')}</strong></span><span><small>المرحلة</small><strong>${esc(course.stage||'Unknown')}</strong></span><span><small>الكود</small><strong>${esc(course.code||'Unknown')}</strong></span><span><small>الساعات / الرصيد</small><strong>${esc(course.credits||'Unknown')}</strong></span></div><div class="academy-chapter-list">${(course.chapters||[]).map((ch,i)=>{
      const lessons=ch.lessons&&ch.lessons.length?ch.lessons:[ch.title||`Lesson ${i+1}`];
      return `<details class="academy-chapter" ${i===0?'open':''}><summary><span class="academy-chapter-number">${esc(ch.week||String(i+1))}</span><span class="academy-chapter-title"><strong>${esc(ch.title||`Chapter ${i+1}`)}</strong><small>${esc(ch.content||'')}</small></span><span class="chapter-chevron"><i class="fas fa-chevron-down"></i></span></summary><div class="academy-chapter-body">${ch.outcomes?`<p class="academy-source-line"><strong>Learning outcomes:</strong> ${esc(ch.outcomes)}</p>`:''}${ch.tracking?`<p class="academy-source-line"><strong>Tracking:</strong> ${esc(ch.tracking)}</p>`:''}${lessons.map((lesson,j)=>{
        const tasks=Array.from(new Set(['attendance',...(course.id.startsWith('secondary-')?['lesson','video','summary','quiz']:(ch.tasks||['lesson','video','summary','quiz']))]));
        return `<article class="academy-lesson-row"><div class="academy-lesson-title"><span><i class="fas fa-bookmark"></i></span><div><strong>${esc(lesson)}</strong>${lessons.length>1?`<small>${esc(ch.title||'')}</small>`:''}</div></div><div class="academy-task-pills">${tasks.map(task=>{const k=`${course.id}::${i}::${j}::${task}`;const state=taskButtonState(k);return `<button type="button" class="academy-task-pill ${state.className}" ${state.done||state.queued?'disabled':''} onclick="queueAcademyCourseActivity('${esc(course.id)}',${i},${j},'${esc(task)}')"><i class="fas ${state.icon}"></i><span>${esc(state.label)} · ${esc(taskLabel(task))}</span><small>+${moneyless(Math.round(getTaskPoints(task)*MULTIPLIER))}</small></button>`}).join('')}</div></article>`;
      }).join('')}</div></details>`;
    }).join('')}</div><section class="academy-source-note"><strong>قاعدة النقاط:</strong> النقاط الأساسية للنشاط × 3.25، وتُضاف مرة واحدة لكل task ID حتى لا تُحتسب بالنقر المتكرر. النقاط الأكاديمية تُضاف إلى رصيد اليوم المستخدم في Leaderboard.</section>`;
  }
  function completeAcademicTask(courseId,chapterIndex,lessonIndex,task) {
    // Backward-compatible name: this now queues the task instead of granting points here.
    return queueCourseActivity(courseId,chapterIndex,lessonIndex,task);
  }

  function switchAreaButtons() { setAreaButtons(); renderAcademic(); }
  function setAreaButtons() {
    document.querySelectorAll('[data-academy-area]').forEach(btn=>btn.classList.toggle('active',btn.dataset.academyArea===area || (area==='course'&&btn.dataset.academyArea===(findCourse(selectedCourseId)?.faculty==='Medicine & Surgery'?'medicine':findCourse(selectedCourseId)?.faculty==='Engineering'?'engineering':'secondary')) || (area==='language-detail'&&btn.dataset.academyArea==='languages') || (area==='reading-detail'&&btn.dataset.academyArea==='reading')));
  }

  function renderLanguages(root) {
    const langs=DATA().languages||[];
    root.innerHTML=`<div class="academy-area-heading"><div><span class="eyebrow">LANGUAGE GYM</span><h2>اللغات الأربع</h2><p>Listening · Reading · Vocabulary · Writing · Speaking — مع وقت الجلسة ومستوى الصعوبة وعدد الكلمات.</p></div><span class="studio-status status-active">×${MULTIPLIER} points</span></div><div class="academy-language-grid">${langs.map(lang=>`<button class="academy-language-card" onclick="openLanguageTrack('${esc(lang.id)}')"><span class="language-card-mark">${({english:'EN',german:'DE',french:'FR',chinese:'中'})[lang.id]||'L'}</span><div><strong>${esc(lang.name)}</strong><span>${esc(lang.nameAr)}</span><small>${lang.track.length} مستويات / مقاطع</small></div><i class="fas fa-arrow-left"></i></button>`).join('')}</div><div class="academy-source-note">المستويات والمفردات والقنوات المرشحة والقواعد مأخوذة من ملف منهجية مهام الموقع. أسماء القنوات تظهر كترشيحات نصية لأن المستند لا يحتوي على روابط فيديو محددة.</div>`;
  }
  function openLanguageTrack(id) { selectedLanguageId=id; area='language-detail'; setAreaButtons(); renderAcademic(); }
  function currentLanguage() { return (DATA().languages||[]).find(l=>l.id===selectedLanguageId)||(DATA().languages||[])[0]; }
  function renderLanguageDetail(root) {
    const lang=currentLanguage(); if(!lang){root.innerHTML='لا توجد بيانات لغات.';return;}
    const levels=lang.track||[];
    const levelActivities=['listening','reading','vocabulary','writing','speaking','review'];
    const indexOfLang=(DATA().languages||[]).findIndex(x=>x.id===lang.id);
    root.innerHTML=`<div class="academy-area-heading"><div><button class="studio-btn small" onclick="switchAcademicArea('languages')"><i class="fas fa-arrow-right"></i> رجوع للغات</button><span class="eyebrow">LANGUAGE TRACK</span><h2>${esc(lang.name)} · ${esc(lang.nameAr)}</h2><p>لكل مستوى: المهارات الخمس + مراجعة. اختَر مستوى الصعوبة المناسب.</p></div></div><div class="academy-level-grid">${levels.map((lvl,i)=>`<article class="academy-level-card"><div class="academy-level-head"><span class="level-index">0${i+1}</span><div><strong>${esc(lvl.level)}</strong><small>نقاط المهمة الأساسية: ${languagePointBase[i]||1300} × ${MULTIPLIER}</small></div></div><div class="academy-level-copy"><p><b>المفردات:</b> ${esc(lvl.vocabulary)}</p><p><b>التركيز النحوي:</b> ${esc(lvl.grammar)}</p><p><b>ترشيح للاستماع/الفيديو:</b> ${esc(lvl.recommendedMedia)}</p></div><div class="academy-level-actions">${levelActivities.map(task=>{const k=`lang-level::${lang.id}::${i}::${task}`;const state=taskButtonState(k);const base=(languagePointBase[i]||1300)*(languageWeights[task]||1);return `<button class="academy-task-pill ${state.className}" ${state.done||state.queued?'disabled':''} onclick="queueAcademyLanguageActivity('${esc(lang.id)}',${i},'${task}')"><i class="fas ${state.icon}"></i><span>${esc(state.label)} · ${esc(taskLabel(task))}</span><small>+${moneyless(Math.round(base*MULTIPLIER))}</small></button>`}).join('')}</div></article>`).join('')}</div><section class="academy-section-block"><div class="academy-area-heading compact"><div><span class="eyebrow">PRACTICE SESSION</span><h3>تسجيل جلسة لغة</h3><p>اكتب أو الصق النص، أو استخدم الإملاء الصوتي إن كان المتصفح يدعمه. ده ليس اختبار نطق صوتي تلقائي؛ الـAI يراجع النص الناتج.</p></div></div><form id="language-session-form" class="academy-practice-form" onsubmit="return saveLanguageSession(event)"><label><span>نوع التدريب</span><select name="type"><option value="listening">Listening</option><option value="reading">Reading</option><option value="vocabulary">Vocabulary</option><option value="writing">Writing</option><option value="speaking">Speaking / transcript</option></select></label><label><span>المستوى</span><select name="level">${levels.map((l,i)=>`<option value="${i}">${esc(l.level)}</option>`).join('')}</select></label><label><span>المدة بالدقائق</span><input name="minutes" type="number" min="1" max="600" value="30" required></label><label class="span-2"><span>عنوان القطعة / المهمة</span><input name="title" placeholder="عنوان النص أو الفيديو"></label><label class="span-2"><span>النص / المفردات / ملخص الاستماع</span><textarea id="language-practice-text" name="content" rows="5" placeholder="اكتب ما قرأته أو كتبته أو نصّ المحادثة بعد الإملاء الصوتي…" oninput="updateLanguageWordCount()"></textarea><div class="academy-text-stats"><span>عدد الكلمات: <strong id="language-word-count">0</strong></span><span>عدد الأحرف: <strong id="language-char-count">0</strong></span></div></label><div class="academy-inline-actions span-2"><button type="button" class="studio-btn" onclick="startLanguageSpeechCapture()"><i class="fas fa-microphone"></i> إملاء صوتي</button><button type="button" class="studio-btn" onclick="coachLanguageText()"><i class="fas fa-sparkles"></i> مراجعة النص بالـAI</button><button type="submit" class="studio-btn primary"><i class="fas fa-save"></i> حفظ الجلسة وإضافتها إلى Shared Tasks</button></div></form><div id="language-ai-feedback" class="academy-ai-feedback hidden"></div></section><section class="academy-section-block"><div class="academy-area-heading compact"><div><span class="eyebrow">RECENT SESSIONS</span><h3>سجل جلسات ${esc(lang.name)}</h3></div></div><div class="academy-logs-list">${progress.languageLogs.filter(log=>log.languageId===lang.id).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,20).map(log=>`<article><span class="academy-log-icon"><i class="fas ${(activityMeta[log.type]||activityMeta.reading).icon}"></i></span><div><strong>${esc(log.title||taskLabel(log.type))}</strong><small>${esc(log.date.slice(0,10))} • ${esc(log.levelLabel)} • ${log.minutes} دقيقة • ${log.wordCount} كلمة • ${log.completed?'مكتملة':'بانتظار Shared Tasks'}</small></div><strong>${log.completed?'+'+moneyless(log.points)+' pts':'متوقع '+moneyless(log.points)+' pts'}</strong>${!log.completed && !taskIsQueued('language-session::'+log.id)?`<button class="studio-btn tiny" onclick="requeueAcademyRecord('language-session','${esc(log.id)}')">إعادة إلى Shared Tasks</button>`:''}</article>`).join('')||'<div class="studio-empty-small">لا توجد جلسات مسجلة بعد.</div>'}</div></section>`;
    updateLanguageWordCount();
  }
  function completeLanguageTask(langId,levelIndex,task) {
    // Backward-compatible name: assignment happens here; points wait for dashboard completion.
    return queueLanguageActivity(langId,levelIndex,task);
  }
  function updateLanguageWordCount() {
    const text=$('language-practice-text')?.value||''; const lang=currentLanguage();
    const words=lang?.id==='chinese' ? (text.replace(/\s/g,'').length) : (text.trim()?text.trim().split(/\s+/u).length:0);
    if($('language-word-count')) $('language-word-count').textContent=moneyless(words);
    if($('language-char-count')) $('language-char-count').textContent=moneyless(text.length);
  }
  function saveLanguageSession(event) {
    event.preventDefault(); const form=event.currentTarget; const fd=new FormData(form); const lang=currentLanguage();
    const type=String(fd.get('type')||'reading'); const levelIndex=Number(fd.get('level'))||0; const level=lang.track[levelIndex]||lang.track[0];
    const content=String(fd.get('content')||'').trim(); const minutes=Number(fd.get('minutes'))||1; const words=lang.id==='chinese'?content.replace(/\s/g,'').length:(content?content.split(/\s+/u).length:0);
    const base=(languagePointBase[levelIndex]||500)*(languageWeights[type]||1); const points=Math.round(base*MULTIPLIER); const id=newId();
    const log={id,languageId:lang.id,language:lang.name,type,levelIndex,levelLabel:level.level,title:String(fd.get('title')||'').trim()||taskLabel(type),minutes,wordCount:words,charCount:content.length,content:content.slice(0,4000),basePoints:base,points,status:'pending',date:new Date().toISOString()};
    progress.languageLogs.push(log); persistProgress();
    queueAcademyTask({id:`language-session::${id}`,label:`${lang.name}: ${log.title} (${minutes} دقيقة · ${words} كلمة)`,basePoints:base,kind:'language-session',recordId:id,languageId:lang.id,levelIndex,activity:type});
    renderAcademic(); toast(`تم حفظ الجلسة وإضافتها إلى Shared Tasks. ستُضاف ${moneyless(points)} نقطة بعد تعليمها كمكتملة من الشاشة الرئيسية.`, 'success'); return false;
  }
  function startLanguageSpeechCapture() {
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition) return toast('الإملاء الصوتي غير مدعوم في هذا المتصفح. يمكنك كتابة النص أو استخدام متصفح يدعمه.','info');
    const recognition=new Recognition(); const lang=currentLanguage(); recognition.lang=({english:'en-US',german:'de-DE',french:'fr-FR',chinese:'zh-CN'})[lang.id]||'en-US'; recognition.interimResults=false; recognition.continuous=true;
    recognition.onresult=(event)=>{let result=''; for(let i=event.resultIndex;i<event.results.length;i++) result+=event.results[i][0].transcript+' '; const text=$('language-practice-text'); if(text) {text.value=(text.value+' '+result).trim();updateLanguageWordCount();}};
    recognition.onerror=(event)=>toast('الإملاء الصوتي: '+event.error,'error'); recognition.start(); toast('بدأ الإملاء الصوتي. أوقفه من مؤشر المتصفح عند الانتهاء.','info');
  }
  async function coachLanguageText() {
    const lang=currentLanguage(); const text=$('language-practice-text')?.value.trim()||''; if(!text) return toast('اكتب أو أمْلِ النص أولًا.','info');
    const level=$('language-session-form')?.querySelector('[name="level"]'); const l=lang.track[Number(level?.value)||0];
    const result=await callAcademyAI(`راجع النص التالي لمتعلم لغة ${lang.name} على المستوى ${l.level}. قيّم القواعد والمفردات والوضوح، صحح الأخطاء مع شرح موجز، اقترح نسخة طبيعية محسنة، وأعطني ثلاث تدريبات قابلة للتطبيق. لا تخترع أن هذا تقييم نطق صوتي؛ النص فقط هو المتاح.\n\nالنص:\n${text}`,'Language Coach');
    const box=$('language-ai-feedback'); if(box){box.textContent=result;box.classList.remove('hidden');}
  }

  function renderQuran(root) {
    const data=DATA(),surahs=data.surahs||[],hadiths=data.hadiths||[];
    const selected=surahs.find(s=>Number(s.number)===Number(selectedSurahNo))||surahs[0];
    const records=progress.quranRecords.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const hadithList=hadiths.filter(h=>!quranFilter || (String(h.number).includes(quranFilter)||h.text.includes(quranFilter))).slice(0,100);
    root.innerHTML=`<div class="academy-area-heading"><div><span class="eyebrow">QURAN & SUNNAH</span><h2>حفظ القرآن والحديث والتسميع</h2><p>اختَر السورة ونطاق الآيات، سجل اللوح أو المراجعة الأسبوعية، وحدد درجة التسميع.</p></div><span class="studio-status status-active">كل سورة وحديث مهمة مستقلة</span></div><section class="academy-section-block"><div class="academy-area-heading compact"><div><h3>تسجيل حفظ / مراجعة القرآن</h3><p>عدد الآيات ونطاقها محفوظان في السجل. النقاط ×3.25 ولا تُضاف إلا بعد إكمال المهمة من Shared Tasks.</p></div></div><form id="quran-record-form" class="academy-practice-form" onsubmit="return addQuranRecord(event)"><label><span>السورة</span><select name="surahNumber" id="quran-surah-select" onchange="changeQuranSurah(this.value)">${surahs.map(s=>`<option value="${s.number}" ${Number(s.number)===Number(selected?.number)?'selected':''}>${s.number}. ${esc(s.name)} (${s.ayahs} آية)</option>`).join('')}</select></label><label><span>من آية</span><input name="ayahStart" type="number" min="1" max="${selected?.ayahs||286}" value="1" required></label><label><span>إلى آية</span><input name="ayahEnd" type="number" min="1" max="${selected?.ayahs||286}" value="${Math.min(5,Number(selected?.ayahs)||5)}" required></label><label><span>العملية</span><select name="kind"><option value="memorization">حفظ جديد</option><option value="review">مراجعة محفوظ</option><option value="weekly-recitation">تسميع آخر الأسبوع</option></select></label><label><span>حجم المهمة</span><select name="base"><option value="500">مقطع قصير / حديث قصير (500)</option><option value="750">نصف صفحة تقريبًا (750)</option><option value="1000" selected>صفحة / مهمة متوسطة (1000)</option><option value="1300">مقطع كثيف (1300)</option><option value="1600">مستوى متقدم (1600)</option></select></label><label><span>درجة التسميع</span><select name="grade"><option>A</option><option>B</option><option>C</option><option>D</option><option>Needs review</option></select></label><label><span>عدد الألواح / الصفحات</span><input name="pages" type="number" min="0.25" step="0.25" value="1" required></label><label class="academy-checkbox-field"><input type="checkbox" name="lastWeekRecited"><span>تم التسميع / المراجعة في آخر الأسبوع</span></label><label class="span-2"><span>ملاحظات الحفظ</span><textarea name="notes" rows="2" placeholder="الأخطاء المتكررة، الآيات الصعبة، موعد المراجعة التالي..."></textarea></label><div class="academy-inline-actions span-2"><button type="submit" class="studio-btn primary"><i class="fas fa-check-circle"></i> حفظ السجل وإضافته إلى Shared Tasks</button></div></form><div class="academy-source-note">عدد السور المستورد: ${surahs.length}. عدد الأحاديث المستوردة: ${hadiths.length}. بيانات أسماء السور وعدد الآيات والصفحات وأحاديث الملف محفوظة كما وردت في المستند.</div></section><section class="academy-section-block"><div class="academy-area-heading compact"><div><h3>سجل الحفظ والتسميع</h3></div></div><div class="academy-logs-list">${records.slice(0,30).map(r=>`<article><span class="academy-log-icon"><i class="fas fa-quran"></i></span><div><strong>${esc(r.surahName)} • ${r.ayahStart}-${r.ayahEnd}</strong><small>${esc(r.date.slice(0,10))} • ${esc(r.kindLabel)} • ${r.pages} لوح/صفحة • آخر الأسبوع: ${r.lastWeekRecited?'نعم':'لا'} • الدرجة ${esc(r.grade)} • ${r.completed?'مكتمل':'بانتظار Shared Tasks'}</small></div><strong>${r.completed?'+'+moneyless(r.points)+' pts':'متوقع '+moneyless(r.points)+' pts'}</strong>${!r.completed && !taskIsQueued('quran-record::'+r.id)?`<button class="studio-btn tiny" onclick="requeueAcademyRecord('quran-record','${esc(r.id)}')">إعادة إلى Shared Tasks</button>`:''}</article>`).join('')||'<div class="studio-empty-small">لم يتم تسجيل حفظ حتى الآن.</div>'}</div></section><section class="academy-section-block"><div class="academy-area-heading compact"><div><span class="eyebrow">HADITH COLLECTION</span><h3>مئة حديث للتسجيل والحفظ</h3><p>يمكن البحث، وتسجيل الحفظ ومراجعة آخر الأسبوع لكل حديث مرة واحدة في النقاط.</p></div><span class="studio-status status-active">${hadiths.length} أحاديث</span></div><input class="input-dark academy-search" placeholder="ابحث في رقم الحديث أو متنه" value="${esc(quranFilter)}" oninput="filterHadiths(this.value)"><div class="academy-hadith-list">${hadithList.map(h=>{const state=progress.hadithRecords[String(h.number)]||{};return `<article class="academy-hadith-card"><div class="hadith-card-heading"><span>#${h.number}</span><strong>${state.memorized?'تم الحفظ':taskIsQueued('hadith::'+h.number)?'مضاف إلى Shared Tasks':'حديث مستقل'}</strong></div><p>${esc(h.text)}</p><div class="hadith-card-actions"><label><input type="checkbox" ${state.lastWeekRecited?'checked':''} onchange="markHadithWeek('${h.number}',this.checked)"> تمت المراجعة آخر الأسبوع</label><button class="studio-btn tiny ${state.memorized?'success':''}" ${state.memorized||taskIsQueued('hadith::'+h.number)?'disabled':''} onclick="memorizeHadith('${h.number}')">${state.memorized?'تم الحفظ':taskIsQueued('hadith::'+h.number)?'مضاف إلى Shared Tasks':'إضافة حفظ إلى Shared Tasks'}</button></div></article>`}).join('')||'<p>لا توجد نتائج مطابقة.</p>'}</div></section>`;
  }
  function changeQuranSurah(no) { selectedSurahNo=Number(no)||1; renderAcademic(); }
  function addQuranRecord(event) {
    event.preventDefault(); const fd=new FormData(event.currentTarget); const surah=(DATA().surahs||[]).find(s=>Number(s.number)===Number(fd.get('surahNumber'))); if(!surah) return false;
    const start=Number(fd.get('ayahStart')),end=Number(fd.get('ayahEnd')); if(start<1||end<start||end>Number(surah.ayahs)) return toast(`نطاق الآيات يجب أن يكون من 1 إلى ${surah.ayahs}، وبداية النطاق قبل نهايته.`,'error'),false;
    const kind=String(fd.get('kind')); const pages=Number(fd.get('pages'))||1; let base=Number(fd.get('base'))||1000;
    if(kind==='review') base=base*0.6; if(kind==='weekly-recitation') base=base*0.8;
    const rawBase=base*pages; const points=Math.round(rawBase*MULTIPLIER); const id=newId(); const kindLabel=({memorization:'حفظ جديد',review:'مراجعة محفوظ','weekly-recitation':'تسميع آخر الأسبوع'})[kind]||kind;
    const record={id,surahNumber:surah.number,surahName:surah.name,ayahStart:start,ayahEnd:end,kind,kindLabel,pages,grade:String(fd.get('grade')||'B'),lastWeekRecited:fd.get('lastWeekRecited')==='on',notes:String(fd.get('notes')||'').trim(),basePoints:rawBase,points,status:'pending',date:new Date().toISOString()};
    progress.quranRecords.push(record); persistProgress();
    queueAcademyTask({id:'quran-record::'+id,label:`القرآن: ${surah.name} · الآيات ${start}-${end} · ${kindLabel}`,basePoints:rawBase,kind:'quran-record',recordId:id});
    renderAcademic(); toast(`تم حفظ سجل ${surah.name} وإضافته إلى Shared Tasks. ستُضاف ${moneyless(points)} نقطة بعد تعليم المهمة كمكتملة من الشاشة الرئيسية.`, 'success'); return false;
  }
  function filterHadiths(v) { quranFilter=String(v||''); renderAcademic(); const input=$('academy-content')?.querySelector('.academy-search'); if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);} }
  function memorizeHadith(no) {
    const key=String(no); const existing=progress.hadithRecords[key]||{}; if(existing.memorized) return toast('تم تسجيل الحديث سابقًا.','info');
    const hadith=(DATA().hadiths||[]).find(h=>String(h.number)===key); if(!hadith) return;
    progress.hadithRecords[key]={...existing,pendingMemorization:true,grade:existing.grade||'A',lastWeekRecited:!!existing.lastWeekRecited};
    persistProgress(); queueAcademyTask({id:'hadith::'+key,label:`الحديث ${key}: ${hadith.text.slice(0,90)}`,basePoints:500,kind:'hadith-memorization',hadithNo:key});
    renderAcademic(); toast('تمت إضافة حفظ الحديث إلى Shared Tasks؛ لا تُضاف النقاط إلا بعد تعليمه كمكتمل من الشاشة الرئيسية.','success');
  }
  function markHadithWeek(no,checked) {
    const key=String(no); const existing=progress.hadithRecords[key]||{};
    if(!checked && progress.completed['hadith-review::'+key]) { toast('مراجعة الأسبوع مكتملة بالفعل ولا يمكن سحب نقاطها.','info'); return renderAcademic(); }
    progress.hadithRecords[key]={...existing,lastWeekRecited:!!checked,reviewPending:!!checked,weekReviewedAt:checked?new Date().toISOString():null};
    if(checked) queueAcademyTask({id:'hadith-review::'+key,label:`مراجعة الحديث ${key} · تسميع آخر الأسبوع`,basePoints:250,kind:'hadith-review',hadithNo:key});
    else if(window.removeAcademyTaskFromSharedPoll) window.removeAcademyTaskFromSharedPoll('hadith-review::'+key);
    persistProgress(); renderAcademic();
  }

  function renderReading(root) {
    const books=DATA().books||[]; const categories=[['all','كل الكتب'],['science','العلوم'],['fiction','الخيال والمغامرات'],['culture','الثقافة والفلسفة'],['islamic','الفكر الإسلامي والروحانيات']];
    const visible=books.filter(b=>selectedBookCategory==='all'||b.category===selectedBookCategory);
    const sessions=progress.readingLogs.length; const totalPages=progress.readingLogs.reduce((s,x)=>s+(Number(x.pages)||0),0);
    root.innerHTML=`<div class="academy-area-heading"><div><span class="eyebrow">READING LIBRARY</span><h2>مكتبة القراءة التحليلية</h2><p>القائمة المنتقاة في الملف: 30 كتابًا ضمن أربعة محاور، مع إسناد صفحات وقياس التقدم.</p></div><span class="studio-status status-active">${books.length} كتاب</span></div><div class="reading-summary-strip"><span><i class="fas fa-book-reader"></i> ${sessions} جلسة</span><span><i class="fas fa-file-alt"></i> ${totalPages} صفحة مسجلة</span><span><i class="fas fa-coins"></i> ${Math.round(totalPages*100*MULTIPLIER).toLocaleString()} نقطة نظرية</span></div><div class="academy-filter-pills">${categories.map(([id,label])=>`<button class="academy-filter-pill ${selectedBookCategory===id?'active':''}" onclick="filterBookCategory('${id}')">${label}</button>`).join('')}</div><div class="academy-book-grid">${visible.map(book=>{const assigned=progress.assignedBooks.some(x=>x.bookId===book.id);return `<article class="academy-book-card"><span class="book-category-tag">${esc(book.categoryAr)}</span><h3>${esc(book.title)}</h3><p class="book-author">${esc(book.author)}</p><p class="book-language">${esc(book.language)}</p><p class="book-rationale">${esc(book.rationale)}</p><div class="academy-book-actions"><button class="studio-btn tiny ${assigned?'success':''}" ${assigned?'disabled':''} onclick="assignReadingBook('${esc(book.id)}')"><i class="fas ${assigned?'fa-check':'fa-bookmark'}"></i> ${assigned?'تم الإسناد':'Assign / اقرأ'}</button><button class="studio-btn tiny" onclick="openReadingBook('${esc(book.id)}')">فتح السجل</button></div></article>`}).join('')}</div><div class="academy-source-note">عدد صفحات كل كتاب غير محدد في المستند، لذلك تسجّل الصفحات التي قرأتها بنفسك بدل اختراع إجمالي صفحات غير موثق. النقاط لكل صفحة = 100 × 3.25 = 325.</div>`;
  }
  function filterBookCategory(cat) { selectedBookCategory=cat; area='reading'; setAreaButtons(); renderAcademic(); }
  function assignReadingBook(id) {
    const book=(DATA().books||[]).find(x=>x.id===id); if(!book) return;
    if(progress.assignedBooks.some(x=>x.bookId===id)) return toast('الكتاب مسند بالفعل في قائمتك.','info');
    progress.assignedBooks.push({id:newId(),bookId:id,title:book.title,assignedAt:new Date().toISOString(),status:'assigned'}); selectedBookId=id; persistProgress(); toast(`تم إسناد «${book.title}» إلى قائمتك.`, 'success'); renderAcademic();
  }
  function openReadingBook(id) { selectedBookId=id; area='reading-detail'; setAreaButtons(); renderAcademic(); }
  function renderReadingDetail(root) {
    const book=(DATA().books||[]).find(x=>x.id===selectedBookId); if(!book) {area='reading';return renderReading(root);}
    const logs=progress.readingLogs.filter(x=>x.bookId===book.id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const pages=logs.reduce((s,x)=>s+(Number(x.pages)||0),0);
    root.innerHTML=`<div class="academy-area-heading"><div><button class="studio-btn small" onclick="switchAcademicArea('reading')"><i class="fas fa-arrow-right"></i> رجوع للمكتبة</button><span class="eyebrow">READING ASSIGNMENT</span><h2>${esc(book.title)}</h2><p>${esc(book.author)} • ${esc(book.language)} • ${esc(book.categoryAr)}</p></div><div class="academy-detail-progress"><strong>${pages}</strong><span>صفحة مسجلة</span></div></div><div class="academy-book-context"><p>${esc(book.rationale)}</p><small>أضف صفحات البداية والنهاية. لا يتم افتراض طول الكتاب الكامل.</small></div><form class="academy-practice-form" onsubmit="return logReadingPages(event)"><label><span>من صفحة</span><input name="pageStart" type="number" min="1" required value="1"></label><label><span>إلى صفحة</span><input name="pageEnd" type="number" min="1" required value="10"></label><label><span>طريقة القراءة</span><select name="method"><option value="analytical">تحليلية</option><option value="skimming">تفحصية / سريعة</option><option value="syntopical">تركيبية / مقارنة كتب</option><option value="basic">قراءة أساسية</option></select></label><label><span>مدة الجلسة بالدقائق</span><input name="minutes" type="number" min="1" value="25" required></label><label class="span-2"><span>ملخص / ملاحظات القراءة (مهم لاختبار AI)</span><textarea name="notes" id="reading-notes" rows="5" placeholder="اكتب أهم الأفكار، الأدلة، الأسئلة والنقاط التي تريد مراجعتها…"></textarea></label><div class="academy-inline-actions span-2"><button type="submit" class="studio-btn primary"><i class="fas fa-check"></i> حفظ القراءة وإضافتها إلى Shared Tasks</button><button type="button" class="studio-btn" onclick="generateReadingTest()"><i class="fas fa-brain"></i> Generate AI Test من ملاحظاتي</button><button type="button" class="studio-btn" onclick="coachReadingNotes()"><i class="fas fa-lightbulb"></i> تحليل ملاحظاتي</button></div></form><div id="reading-ai-output" class="academy-ai-feedback hidden"></div><div id="reading-ai-actions" class="academy-inline-actions hidden"><button class="studio-btn primary" onclick="sendReadingToExamEngine()"><i class="fas fa-arrow-right"></i> إرسال إلى AI Exam Engine</button></div><section class="academy-section-block"><div class="academy-area-heading compact"><div><h3>سجل جلسات الكتاب</h3></div></div><div class="academy-logs-list">${logs.map(l=>`<article><span class="academy-log-icon"><i class="fas fa-book-reader"></i></span><div><strong>صفحات ${l.pageStart}–${l.pageEnd}</strong><small>${l.date.slice(0,10)} • ${l.minutes} دقيقة • ${esc(l.methodLabel)} • ${l.pages} صفحة</small><p>${esc(l.notes||'بدون ملاحظات')}</p></div><strong>${l.completed?'+'+moneyless(l.points)+' pts':'متوقع '+moneyless(l.points)+' pts'}</strong>${!l.completed && !taskIsQueued('reading-pages::'+l.id)?`<button class="studio-btn tiny" onclick="requeueAcademyRecord('reading-pages','${esc(l.id)}')">إعادة إلى Shared Tasks</button>`:''}</article>`).join('')||'<div class="studio-empty-small">لا توجد جلسات مسجلة لهذا الكتاب بعد.</div>'}</div></section>`;
  }
  function logReadingPages(event) {
    event.preventDefault();const fd=new FormData(event.currentTarget);const book=(DATA().books||[]).find(x=>x.id===selectedBookId);if(!book)return false;
    const start=Number(fd.get('pageStart')),end=Number(fd.get('pageEnd')); if(start<1||end<start)return toast('راجع نطاق الصفحات؛ صفحة النهاية يجب أن تكون مساوية للبداية أو أكبر.','error'),false;
    const pages=end-start+1,basePoints=pages*100,points=Math.round(basePoints*MULTIPLIER),method=String(fd.get('method')||'analytical'),methodLabel=({analytical:'تحليلية',skimming:'تفحصية / سريعة',syntopical:'تركيبية / مقارنة كتب',basic:'قراءة أساسية'})[method]||method,id=newId();
    const log={id,bookId:book.id,title:book.title,pageStart:start,pageEnd:end,pages,minutes:Number(fd.get('minutes'))||25,method,methodLabel,notes:String(fd.get('notes')||'').trim().slice(0,4000),basePoints,points,status:'pending',date:new Date().toISOString()};
    progress.readingLogs.push(log);persistProgress();queueAcademyTask({id:'reading-pages::'+id,label:`قراءة: ${book.title} · الصفحات ${start}-${end} (${pages} صفحة)`,basePoints,kind:'reading-pages',recordId:id});renderAcademic();toast(`تم تسجيل ${pages} صفحة وإضافتها إلى Shared Tasks. ستُضاف ${moneyless(points)} نقطة بعد تعليمها كمكتملة من الشاشة الرئيسية.`, 'success');return false;
  }

  async function generateReadingTest() {
    const book=(DATA().books||[]).find(x=>x.id===selectedBookId);if(!book)return;const notes=$('reading-notes')?.value.trim()||'';if(notes.length<50)return toast('اكتب ملاحظات أو ملخصًا من القراءة لا يقل عن 50 حرفًا حتى يكون الاختبار مبنيًا عليها.','info');
    const prompt=`Create a 6-question reading comprehension test in Arabic based ONLY on the reader's notes below. Do not invent details about the full book. Include 4 MCQs and 2 short-answer questions, provide an answer key at the end, and clearly say the quiz evaluates these notes rather than the original book.\nBook: ${book.title} — ${book.author}\nDocument synopsis: ${book.rationale}\nReading notes:\n${notes}`;
    const answer=await callAcademyAI(prompt,'Reading Test');const output=$('reading-ai-output');if(output){output.textContent=answer;output.classList.remove('hidden');}const actions=$('reading-ai-actions');if(actions)actions.classList.remove('hidden');
  }
  async function coachReadingNotes() {
    const book=(DATA().books||[]).find(x=>x.id===selectedBookId);if(!book)return;const notes=$('reading-notes')?.value.trim()||'';if(!notes)return toast('اكتب ملاحظات القراءة أولًا.','info');
    const answer=await callAcademyAI(`حلل ملاحظات القارئ عن كتاب «${book.title}». قيّم وضوح الفكرة المركزية، الأدلة، الأسئلة المفتوحة، التحيزات المحتملة، وما ينقص الملخص. اقترح 5 أسئلة تحليلية دون اختراع تفاصيل غير موجودة في الملاحظات.\nوصف الكتاب من ملف الترشيحات: ${book.rationale}\nالملاحظات:\n${notes}`,'Reading Coach');const output=$('reading-ai-output');if(output){output.textContent=answer;output.classList.remove('hidden');}
  }
  function sendReadingToExamEngine() {
    const output=$('reading-ai-output');if(!output?.textContent)return toast('ولّد اختبارًا أولًا.','info');const target=$('exam-raw-text');if(target)target.value='Create an exam from the following AI-generated reading quiz. Preserve each question and answer key; improve formatting only.\n\n'+output.textContent;
    const examsBtn=document.querySelector('[onclick*="view-exams"]');if(typeof switchTab==='function')switchTab('view-exams',examsBtn);if(typeof toggleExamCreator==='function')$('exam-creator-section')?.classList.remove('hidden');toast('تم إرسال محتوى الاختبار إلى AI Exam Engine؛ راجعه قبل التوليد.', 'success');
  }

  function renderAcademyAI(root) {
    root.innerHTML=`<div class="academy-area-heading"><div><span class="eyebrow">ACADEMY ASSISTANT</span><h2>مساعد الدراسة والمواد</h2><p>اسأل عن الخطوة التالية، تنظيم جلسة، أو تحليل بيانات تقدمك. الإجابة لا تغيّر بياناتك تلقائيًا.</p></div></div><form class="academy-ai-prompt" onsubmit="return askAcademyAI(event)"><textarea name="question" rows="4" placeholder="مثلًا: حلل تقدمي في Anatomy واقترح خطة الأسبوع القادم…" required></textarea><button class="studio-btn primary" type="submit">اسأل المساعد</button></form><div class="academy-ai-feedback" id="academy-ai-output"></div><div class="academy-source-note">المساعد يستخدم مفتاح AI المحفوظ حاليًا في الموقع. لا ترسل معلومات سرية أو بيانات شخصية للطلاب.</div>`;
  }
  async function askAcademyAI(event) {
    event.preventDefault();const question=String(new FormData(event.currentTarget).get('question')||'').trim();if(!question)return false;
    const output=$('academy-ai-output');if(output){output.textContent='جارٍ التحليل…';output.classList.remove('hidden');}
    const completed=Object.keys(progress.completed).length;const recentLang=progress.languageLogs.slice(-8);const quran=progress.quranRecords.slice(-8);const reads=progress.readingLogs.slice(-8);
    const answer=await callAcademyAI(`أجب اعتمادًا على البيانات التالية، واذكر بوضوح أي بيانات غير متاحة. المستخدم: ${activeUser}. عدد المهام المكتملة: ${completed}. نقاط الأكاديمية: ${progress.points}. جلسات اللغة الأخيرة: ${JSON.stringify(recentLang)}. سجلات القرآن: ${JSON.stringify(quran)}. سجلات القراءة: ${JSON.stringify(reads)}. سؤال المستخدم: ${question}`,'Academy Assistant');if(output)output.textContent=answer;return false;
  }
  async function callAcademyAI(prompt, purpose) {
    const apiKey=localStorage.getItem('ai_api_key');if(!apiKey){toast('احفظ مفتاح AI من قسم الامتحانات أولًا.','error');return 'لم يتم الاتصال: مفتاح AI غير محفوظ.';}
    if(aiBusy)return 'هناك طلب AI آخر قيد التنفيذ؛ حاول مرة أخرى بعد اكتماله.';aiBusy=true;
    const modelEl=$('ai-model-select');const model=modelEl?.value&&!String(modelEl.value).startsWith('llama')?modelEl.value:'openai/gpt-oss-120b';
    try {const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model,messages:[{role:'system',content:`You are a careful academic assistant for an Egyptian learner. Purpose: ${purpose}. Respond in clear Arabic or preserve the language requested. Use supplied file-derived content as the source of truth; distinguish suggestions from source facts. Never fabricate course material, links, test scores or book passages. For medical/scientific content, flag uncertainty and recommend checking course materials.`},{role:'user',content:prompt}],temperature:0.25,max_tokens:2500})});const data=await response.json();if(!response.ok||data.error)throw new Error(data.error?.message||`HTTP ${response.status}`);return data.choices?.[0]?.message?.content||'لم يصل رد من النموذج.';
    } catch(error){toast('تعذر الاتصال بالذكاء الاصطناعي: '+error.message,'error');return `تعذر الاتصال بالـAI: ${error.message}. تأكد من المفتاح والنموذج والاتصال.`;}finally{aiBusy=false;}
  }

  // Shared-task picker mirrors Academy categories and uses the same task IDs / award ledger.
  function openAcademySharedPicker() { renderSharedPickerHome(); }
  function pickerContainer() { return $('master-task-selector'); }
  function pickerBackButton(label='رجوع للأقسام') { return `<button type="button" class="studio-btn small" onclick="renderAcademySharedPickerHome()"><i class="fas fa-arrow-right"></i> ${label}</button>`; }
  function renderSharedPickerHome() {
    const root=pickerContainer(); if(!root) return;
    const groups=[
      ['secondary','تالتة ثانوي'],
      ['languages','اللغات الأربع'],
      ['ai','منهج AI'],
      ['medicine','طب · MNU'],
      ['engineering','مناهج الجامعات'],
      ['quran','القرآن والحديث'],
      ['reading','القراءة والكتب'],
      ['legacy','المواد والمهام التقليدية']
    ];
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl">
      <h4 class="shared-picker-title">اختَر المسار / Select Target</h4>
      <p class="shared-picker-hint">افتح المسار، ثم المادة، ثم الفصل والدرس. المهمة لا تمنح نقاطًا إلا بعد تأشيرها كمكتملة من Shared Daily Poll.</p>
      <div class="shared-picker-subject-grid">${groups.map(([id,title])=>`<button type="button" class="shared-picker-primary" onclick="renderAcademySharedPicker('${id}')">${title}</button>`).join('')}</div>
    </div>`;
  }
  function renderSharedPickerCourseList(kind) {
    const root=pickerContainer(); if(!root) return;
    let courses=[]; let title='';
    if(kind==='secondary'){courses=secondaryCourses();title='تالتة ثانوي';}
    else if(kind==='medicine'){courses=(DATA().academicCourses||[]).filter(c=>c.faculty==='Medicine & Surgery');title='طب · MNU';}
    else if(kind==='engineering'){courses=(DATA().academicCourses||[]).filter(c=>c.faculty==='Engineering');title='مناهج الجامعات';}
    else if(kind==='ai'){courses=allCourses();title='منهج AI';}
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl">
      <div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPickerHome()">← الأقسام</button><h4 class="shared-picker-title">${esc(title)} · اختَر المادة</h4><p class="shared-picker-hint">اضغط اسم المادة لعرض الـ Chapters والـ Lessons والأنشطة الخاصة بها.</p></div>
      <div class="shared-picker-subject-grid">${courses.map(c=>`<button type="button" class="shared-picker-primary" onclick="renderAcademySharedPickerCourse('${esc(c.id)}','${kind}')"><strong>${esc(c.nameAr||c.name)}</strong><small>${esc(c.name)} · ${(c.chapters||[]).length} Chapters</small></button>`).join('')||'<p class="shared-picker-empty">لا توجد مواد في هذا المسار داخل البيانات المتاحة.</p>'}</div>
    </div>`;
  }
  function renderSharedPickerCourse(courseId, kind='secondary') {
    const root=pickerContainer(),course=findCourse(courseId); if(!root||!course) return renderSharedPickerHome();
    const chapters=course.chapters||[];
    const activityNames={attendance:'حضور',lesson:'مذاكرة المحتوى',video:'مشاهدة فيديو',summary:'ملخص / Notes',quiz:'اختبار / تطبيق',practical:'عملي / Lab'};
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl">
      <div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPicker('${kind}')">← رجوع للمواد</button><h4 class="shared-picker-title">${esc(course.nameAr||course.name)}</h4><p class="shared-picker-hint">${esc(course.university||'')} · ${esc(course.term||course.stage||'')}<br>اختَر الدرس، حدّد نوع النشاط، ثم اضغط Assign.</p></div>
      <div class="shared-picker-session-toggle"><label for="shared-picker-session-mode"><span>ذاكرتها من سيشن؟</span><input id="shared-picker-session-mode" type="checkbox" ${sharedPickerSessionMode?'checked':''} onchange="setSharedPickerSessionMode(this.checked)"></label></div>
      <div class="shared-picker-chapters">${chapters.map((ch,i)=>{
        const lessons=ch.lessons&&ch.lessons.length?ch.lessons:[ch.title||`Lesson ${i+1}`];
        return `<details class="shared-picker-chapter" ${i===0?'open':''}><summary><span class="shared-picker-chapter-number">${esc(ch.week||String(i+1))}</span><span><strong>${esc(ch.title||`Chapter ${i+1}`)}</strong><small>${esc(ch.content||'')}</small></span><i class="fas fa-chevron-down"></i></summary>
          <div class="shared-picker-chapter-body">${lessons.map((lesson,j)=>{
            const lessonKey=`${course.id}::${i}::${j}`;
            const tasks=kind==='ai'?['ai-summary','ai-exam','ai-flashcards']:Array.from(new Set(['attendance',...(course.id.startsWith('secondary-')?['lesson','video','summary','quiz']:(ch.tasks||['lesson','video','summary','quiz']))]));
            const defaultTask=sharedPickerSelections[lessonKey]||'';
            const options=tasks.map(task=>{
              const normal=task==='ai-summary'?'summary':task==='ai-exam'?'quiz':task==='ai-flashcards'?'summary':task;
              const id=kind==='ai'?`ai-study::${course.id}::${i}::${j}::${task}`:`${course.id}::${i}::${j}::${task}`;
              const base=kind==='ai'?(task==='ai-exam'?300:task==='ai-flashcards'?200:100):getTaskPoints(normal);
              const state=taskButtonState(id);
              const label=kind==='ai'?({ 'ai-summary':'AI Summary','ai-exam':'AI Exam','ai-flashcards':'AI Flashcards'}[task]):(activityNames[task]||taskLabel(task));
              return `<button type="button" class="shared-picker-activity ${defaultTask===task?'active':''} ${state.done?'done':''} ${state.queued?'queued':''}" data-picker-task="${task}" ${state.done||state.queued?'disabled':''} onclick="selectSharedPickerActivity('${lessonKey}','${task}')"><span>${esc(label)}</span><small>+${moneyless(Math.round(base*MULTIPLIER))}</small></button>`;
            }).join('');
            const selected=tasks.includes(defaultTask);
            const selectedId=defaultTask?(kind==='ai'?`ai-study::${course.id}::${i}::${j}::${defaultTask}`:`${course.id}::${i}::${j}::${defaultTask}`):'';
            const selectedState=selectedId?taskButtonState(selectedId):null;
            const assignLabel=selectedState?.done?'مكتملة بالفعل':selectedState?.queued?'مضافة إلى Shared Tasks':'Assign إلى Shared Tasks';
            return `<article class="shared-picker-lesson-card" data-picker-lesson-key="${esc(lessonKey)}"><div class="shared-picker-lesson-title"><span class="shared-picker-lesson-mark"><i class="fas fa-book-open"></i></span><strong>${esc(lesson)}</strong></div><div class="shared-picker-activity-options">${options}</div><div class="shared-picker-assign-row"><small data-session-hint>${sharedPickerSessionMode?'نوع المذاكرة: من سيشن':'نوع المذاكرة: ذاتي'}</small><button type="button" class="shared-picker-assign" data-assign-button ${!selected||selectedState?.done||selectedState?.queued?'disabled':''} onclick="assignSelectedSharedPickerActivity('${lessonKey}','${esc(course.id)}',${i},${j},'${kind}')">${assignLabel}</button></div></article>`;
          }).join('')}</div></details>`;
      }).join('')}</div>
    </div>`;
  }
  function setSharedPickerSessionMode(value) {
    sharedPickerSessionMode=!!value;
    document.querySelectorAll('#master-task-selector .shared-picker-assign-row small[data-session-hint]').forEach(el=>{el.textContent=sharedPickerSessionMode?'نوع المذاكرة: من سيشن':'نوع المذاكرة: ذاتي';});
  }
  function selectSharedPickerActivity(lessonKey, task) {
    sharedPickerSelections[lessonKey]=task;
    const cards=Array.from(document.querySelectorAll('#master-task-selector .shared-picker-lesson-card'));
    const card=cards.find(el=>el.dataset.pickerLessonKey===lessonKey);
    if(!card) return;
    card.querySelectorAll('.shared-picker-activity').forEach(btn=>btn.classList.toggle('active',btn.dataset.pickerTask===task));
    const assign=card.querySelector('[data-assign-button]'); if(assign){assign.disabled=false;assign.textContent='Assign إلى Shared Tasks';}
  }
  function assignSelectedSharedPickerActivity(lessonKey, courseId, chapterIndex, lessonIndex, kind='secondary') {
    const task=sharedPickerSelections[lessonKey]; if(!task) return toast('اختَر نوع النشاط أولًا ثم اضغط Assign.','info');
    const course=findCourse(courseId); if(!course) return false;
    const chapter=course.chapters?.[chapterIndex]; const lesson=chapter?.lessons?.[lessonIndex]||chapter?.title||`Lesson ${lessonIndex+1}`;
    const normal=task==='ai-summary'?'summary':task==='ai-exam'?'quiz':task==='ai-flashcards'?'summary':task;
    const id=kind==='ai'?`ai-study::${course.id}::${chapterIndex}::${lessonIndex}::${task}`:`${course.id}::${chapterIndex}::${lessonIndex}::${task}`;
    const base=kind==='ai'?(task==='ai-exam'?300:task==='ai-flashcards'?200:100):getTaskPoints(normal);
    const taskLabelText=kind==='ai'?({ 'ai-summary':'AI Summary','ai-exam':'AI Exam','ai-flashcards':'AI Flashcards'}[task]):(activityMeta[task]?.label||task);
    const sessionText=sharedPickerSessionMode?' · تمت المذاكرة من سيشن':' · مذاكرة ذاتية';
    const label=kind==='ai'?`${taskLabelText}: ${course.name} · ${lesson}${sessionText}`:`${course.name}: ${lesson} (${taskLabelText}${sharedPickerSessionMode?' · Session':' · Self'})`;
    const added=queueAcademyTask({id,label,basePoints:base,kind:kind==='ai'?'ai-study':'course',courseId,chapterIndex,lessonIndex,activity:normal,sessionMode:sharedPickerSessionMode});
    if(added) renderSharedPickerCourse(courseId,kind);
    return !!added;
  }
  function queuePickerTask(id,labelEncoded,basePoints,kind,courseId,chapterIndex,lessonIndex,activity,pickerKind) {
    const label=decodeURIComponent(String(labelEncoded||'')); const course=findCourse(courseId); let resolvedLabel=label;
    if(kind==='course' && course) { const ch=course.chapters[chapterIndex]; const lesson=ch?.lessons?.[lessonIndex]||ch?.title||`Lesson ${lessonIndex+1}`; resolvedLabel=`${course.name}: ${lesson} (${taskLabel(activity)})`; }
    const added=queueAcademyTask({id,label:resolvedLabel,basePoints,kind,courseId,chapterIndex,lessonIndex,activity});
    if(added && course) renderSharedPickerCourse(courseId,pickerKind||'secondary');
    return added;
  }
  function renderSharedPickerLanguages() {
    const root=pickerContainer(),langs=DATA().languages||[]; if(!root)return;
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPickerHome()">← الأقسام</button><h4 class="shared-picker-title">اللغات / Select Language</h4><p class="shared-picker-hint">اختَر اللغة، ثم المستوى، ثم نوع التدريب واضغط Assign.</p></div><div class="shared-picker-subject-grid">${langs.map(l=>`<button type="button" class="shared-picker-primary" onclick="renderAcademySharedPickerLanguage('${esc(l.id)}')">${esc(l.name)}<small>${esc(l.nameAr)}</small></button>`).join('')}</div></div>`;
  }
  function renderSharedPickerLanguage(langId) {
    const root=pickerContainer(),lang=(DATA().languages||[]).find(l=>l.id===langId); if(!root||!lang)return renderSharedPickerLanguages();
    const types=['listening','reading','vocabulary','writing','speaking','review'];
    const names={listening:'Listening',reading:'Reading',vocabulary:'Vocabulary',writing:'Writing',speaking:'Speaking',review:'مراجعة'};
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPicker('languages')">← رجوع للغات</button><h4 class="shared-picker-title">${esc(lang.name)} · ${esc(lang.nameAr)}</h4><p class="shared-picker-hint">اختَر مهارة لكل مستوى ثم اضغط Assign. الإكمال يتم من Shared Daily Poll.</p></div>
      <div class="shared-picker-session-toggle"><label for="shared-picker-session-mode"><span>تدربت من سيشن؟</span><input id="shared-picker-session-mode" type="checkbox" ${sharedPickerSessionMode?'checked':''} onchange="setSharedPickerSessionMode(this.checked)"></label></div>
      <div class="shared-picker-chapters">${lang.track.map((lvl,i)=>`<details class="shared-picker-chapter" ${i===0?'open':''}><summary><span class="shared-picker-chapter-number">${i+1}</span><span><strong>${esc(lvl.level)}</strong><small>${esc(lvl.vocabulary||'')} · ${esc(lvl.grammar||'')}</small></span><i class="fas fa-chevron-down"></i></summary><div class="shared-picker-chapter-body">${types.map(task=>{const id=`lang-level::${lang.id}::${i}::${task}`;const base=(languagePointBase[i]||1300)*(languageWeights[task]||1);const state=taskButtonState(id);return `<article class="shared-picker-lesson-card"><div class="shared-picker-lesson-title"><span class="shared-picker-lesson-mark"><i class="fas fa-language"></i></span><strong>${esc(lvl.level)} · ${names[task]}</strong></div><div class="shared-picker-assign-row"><small>+${moneyless(Math.round(base*MULTIPLIER))} نقطة عند الإكمال</small><button type="button" class="shared-picker-assign" ${state.done||state.queued?'disabled':''} onclick="assignSharedPickerLanguageActivity('${esc(lang.id)}',${i},'${task}')">${state.done?'مكتملة بالفعل':state.queued?'مضافة إلى Shared Tasks':'Assign إلى Shared Tasks'}</button></div></article>`}).join('')}</div></details>`).join('')}</div></div>`;
  }
  function assignSharedPickerLanguageActivity(langId, levelIndex, task) {
    const lang=(DATA().languages||[]).find(l=>l.id===langId); if(!lang)return false;
    const level=lang.track[levelIndex]||lang.track[0]; const base=(languagePointBase[levelIndex]||1300)*(languageWeights[task]||1); const id=`lang-level::${lang.id}::${levelIndex}::${task}`;
    const label=`${lang.name} ${level.level}: ${taskLabel(task)}${sharedPickerSessionMode?' · Session':' · Self'}`;
    const added=queueAcademyTask({id,label,basePoints:base,kind:'language-level',languageId:lang.id,levelIndex,activity:task,sessionMode:sharedPickerSessionMode});
    if(added) renderSharedPickerLanguage(langId);
    return !!added;
  }
  function renderSharedPickerQuran() {
    const root=pickerContainer(),data=DATA(),surahs=data.surahs||[],hadiths=data.hadiths||[]; if(!root)return;
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPickerHome()">← الأقسام</button><h4 class="shared-picker-title">القرآن والحديث</h4><p class="shared-picker-hint">حدّد السورة ونطاق الآيات أو اختر حديثًا ثم Assign. النقاط لا تُمنح إلا من قائمة المهام الرئيسية.</p></div>
      <form class="shared-picker-form" onsubmit="return queueQuranTaskFromPicker(event)"><label><span>السورة</span><select name="surahNumber">${surahs.map(x=>`<option value="${x.number}">${x.number}. ${esc(x.name)} (${x.ayahs} آية)</option>`).join('')}</select></label><label><span>نوع المهمة</span><select name="kind"><option value="memorization">حفظ جديد</option><option value="review">مراجعة محفوظ</option><option value="weekly-recitation">تسميع آخر الأسبوع</option></select></label><label><span>من آية</span><input name="ayahStart" type="number" min="1" value="1" required></label><label><span>إلى آية</span><input name="ayahEnd" type="number" min="1" value="5" required></label><label><span>النقاط الأساسية قبل ×3.25</span><select name="base"><option value="500">500 · مهمة قصيرة</option><option value="750">750 · نصف صفحة تقريبًا</option><option value="1000" selected>1000 · صفحة / متوسطة</option><option value="1300">1300 · كثيفة</option><option value="1600">1600 · متقدمة</option></select></label><label><span>عدد الألواح / الصفحات</span><input name="pages" type="number" min="0.25" step="0.25" value="1" required></label><button class="shared-picker-assign span-2" type="submit">Assign حفظ / تسميع إلى Shared Tasks</button></form>
      <h5 class="shared-picker-section-title">أحاديث للحفظ</h5><input class="input-dark academy-search" placeholder="ابحث برقم الحديث أو المتن" oninput="filterSharedPickerHadith(this.value)"><div id="shared-picker-hadith-list" class="shared-picker-hadith-list">${hadiths.slice(0,100).map(h=>{const state=taskButtonState('hadith::'+h.number);return `<article class="shared-picker-hadith-row"><p><b>#${h.number}</b> · ${esc(h.text)}</p><button type="button" class="selector-item-btn ${state.queued?'queued':''} ${state.done?'done':''}" ${state.queued||state.done?'disabled':''} onclick="queueSharedHadith('${h.number}')">${state.done?'مكتمل':state.queued?'مضاف إلى Shared Tasks':'+ Assign حفظ الحديث'} · ${moneyless(Math.round(500*MULTIPLIER))} نقطة عند الإكمال</button></article>`}).join('')}</div></div>`;
  }
  function queueQuranTaskFromPicker(event) {
    event.preventDefault(); const fd=new FormData(event.currentTarget); const surah=(DATA().surahs||[]).find(x=>Number(x.number)===Number(fd.get('surahNumber'))); if(!surah)return false;
    const start=Number(fd.get('ayahStart')),end=Number(fd.get('ayahEnd')),pages=Number(fd.get('pages'))||1; let base=Number(fd.get('base'))||1000; const kind=String(fd.get('kind')||'memorization');
    if(start<1||end<start||end>Number(surah.ayahs)) return toast(`نطاق الآيات يجب أن يكون من 1 إلى ${surah.ayahs}.`,'error'),false;
    if(kind==='review')base*=.6; if(kind==='weekly-recitation')base*=.8; const id=newId(); const kindLabel=({memorization:'حفظ جديد',review:'مراجعة محفوظ','weekly-recitation':'تسميع آخر الأسبوع'})[kind]||kind; const rawBase=base*pages; const points=Math.round(rawBase*MULTIPLIER);
    progress.quranRecords.push({id,surahNumber:surah.number,surahName:surah.name,ayahStart:start,ayahEnd:end,kind,kindLabel,pages,grade:'Pending',lastWeekRecited:false,notes:'',basePoints:rawBase,points,status:'pending',date:new Date().toISOString()}); persistProgress();
    queueAcademyTask({id:'quran-record::'+id,label:`القرآن: ${surah.name} · الآيات ${start}-${end} · ${kindLabel}`,basePoints:rawBase,kind:'quran-record',recordId:id});
    toast(`تمت الإضافة. النقاط المتوقعة بعد الإكمال: ${moneyless(points)}.`,'success'); renderSharedPickerQuran(); return false;
  }
  function queueSharedHadith(no) {
    const key=String(no),hadith=(DATA().hadiths||[]).find(x=>String(x.number)===key); if(!hadith)return;
    const existing=progress.hadithRecords[key]||{}; if(existing.memorized)return toast('الحديث مكتمل بالفعل.','info');
    progress.hadithRecords[key]={...existing,pendingMemorization:true}; persistProgress();
    const added=queueAcademyTask({id:'hadith::'+key,label:`الحديث ${key}: ${hadith.text.slice(0,90)}`,basePoints:500,kind:'hadith-memorization',hadithNo:key});
    if(added) renderSharedPickerQuran();
  }
  function filterSharedPickerHadith(q) {
    const term=String(q||'').toLowerCase(),container=$('shared-picker-hadith-list'); if(!container)return;
    const list=(DATA().hadiths||[]).filter(h=>!term||String(h.number).includes(term)||String(h.text).toLowerCase().includes(term));
    container.innerHTML=list.map(h=>{const state=taskButtonState('hadith::'+h.number);return `<article class="shared-picker-hadith-row"><p><b>#${h.number}</b> · ${esc(h.text)}</p><button type="button" class="selector-item-btn ${state.queued?'queued':''} ${state.done?'done':''}" ${state.queued||state.done?'disabled':''} onclick="queueSharedHadith('${h.number}')">${state.done?'مكتمل':state.queued?'مضاف إلى Shared Tasks':'+ Assign حفظ الحديث'} · ${moneyless(Math.round(500*MULTIPLIER))} نقطة عند الإكمال</button></article>`}).join('')||'<p class="shared-picker-empty">لا توجد نتائج.</p>';
  }
  function renderSharedPickerReading() {
    const root=pickerContainer(),books=DATA().books||[]; if(!root)return;
    const cats=[['all','كل الكتب'],['science','العلوم'],['fiction','الخيال والمغامرات'],['culture','الثقافة والفلسفة'],['islamic','الفكر الإسلامي والروحانيات']];
    const visible=books.filter(b=>selectedBookCategory==='all'||b.category===selectedBookCategory);
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPickerHome()">← الأقسام</button><h4 class="shared-picker-title">القراءة والكتب</h4><p class="shared-picker-hint">اختر تصنيفًا ثم الكتاب، وحدد صفحات القراءة واضغط Assign.</p></div><div class="shared-picker-filter-grid">${cats.map(([id,label])=>`<button type="button" class="shared-picker-filter ${selectedBookCategory===id?'active':''}" onclick="filterSharedPickerBooks('${id}')">${label}</button>`).join('')}</div><div id="shared-picker-books" class="shared-picker-subject-grid">${visible.map(b=>`<button type="button" class="shared-picker-primary" onclick="openSharedPickerBook('${esc(b.id)}')"><strong>${esc(b.title)}</strong><small>${esc(b.author)} · ${esc(b.categoryAr)}</small></button>`).join('')}</div></div>`;
  }
  function filterSharedPickerBooks(category) {
    selectedBookCategory=category;
    const root=pickerContainer(); if(!root)return;
    const books=(DATA().books||[]).filter(b=>category==='all'||b.category===category);
    const grid=$('shared-picker-books'); if(grid)grid.innerHTML=books.map(b=>`<button type="button" class="shared-picker-primary" onclick="openSharedPickerBook('${esc(b.id)}')"><strong>${esc(b.title)}</strong><small>${esc(b.author)} · ${esc(b.categoryAr)}</small></button>`).join('')||'<p class="shared-picker-empty">لا توجد كتب في هذا التصنيف.</p>';
    root.querySelectorAll('.shared-picker-filter').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick')?.includes(`'${category}'`)));
  }
  function openSharedPickerBook(bookId) {
    const book=(DATA().books||[]).find(x=>x.id===bookId); const root=pickerContainer(); if(!book||!root)return;
    selectedBookId=bookId;
    root.innerHTML=`<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPicker('reading')">← رجوع للكتب</button><h4 class="shared-picker-title">${esc(book.title)}</h4><p class="shared-picker-hint">${esc(book.author)} · ${esc(book.categoryAr)}<br>${esc(book.rationale||'')}</p></div><form class="shared-picker-form" onsubmit="return queueSharedPickerReading(event,'${esc(book.id)}')"><label><span>من صفحة</span><input type="number" name="pageStart" min="1" value="1" required></label><label><span>إلى صفحة</span><input type="number" name="pageEnd" min="1" value="10" required></label><label class="span-2"><span>مدة القراءة بالدقائق</span><input type="number" name="minutes" min="1" max="600" value="25" required></label><label class="span-2"><span>ملاحظات / ملخص (اختياري)</span><textarea name="notes" rows="3" placeholder="اكتب ما قرأته أو أهم الأفكار..."></textarea></label><button class="shared-picker-assign span-2" type="submit">Assign صفحات القراءة إلى Shared Tasks</button></form></div>`;
  }
  function queueSharedPickerReading(event, bookId) {
    event.preventDefault(); const book=(DATA().books||[]).find(x=>x.id===bookId); if(!book)return false;
    const fd=new FormData(event.currentTarget); const start=Number(fd.get('pageStart')),end=Number(fd.get('pageEnd'));
    if(start<1||end<start)return toast('راجع نطاق الصفحات.', 'error'),false;
    const pages=end-start+1,basePoints=pages*100,points=Math.round(basePoints*MULTIPLIER),id=newId();
    const log={id,bookId:book.id,title:book.title,pageStart:start,pageEnd:end,pages,minutes:Number(fd.get('minutes'))||25,method:'analytical',methodLabel:'تحليلية',notes:String(fd.get('notes')||'').trim().slice(0,4000),basePoints,points,status:'pending',completed:false,date:new Date().toISOString()};
    progress.readingLogs.push(log); persistProgress();
    const added=queueAcademyTask({id:`reading-pages::${id}`,label:`قراءة: ${book.title} · الصفحات ${start}-${end} (${pages} صفحة)`,basePoints,kind:'reading-pages',recordId:id});
    if(added) { toast(`تم إسناد ${pages} صفحة. النقاط المتوقعة ${moneyless(points)} بعد الإكمال من الشاشة الرئيسية.`,'success'); renderSharedPickerReading(); }
    return false;
  }
  function renderAcademySharedPicker(kind) {
    if(!kind || kind==='home') return renderSharedPickerHome();
    if(kind==='languages') return renderSharedPickerLanguages();
    if(kind==='quran') return renderSharedPickerQuran();
    if(kind==='reading') return renderSharedPickerReading();
    if(kind==='legacy') { const root=pickerContainer(); if(!root)return; root.innerHTML='<div class="shared-picker-legacy" dir="rtl"><div class="shared-picker-page-head"><button type="button" class="shared-picker-back" onclick="renderAcademySharedPickerHome()">← الأقسام</button><h4 class="shared-picker-title">المواد والمهام التقليدية</h4></div><div id="legacy-subjects" class="shared-picker-subject-grid"></div><div id="adv-menu-area" class="mt-20"></div></div>'; const box=$('legacy-subjects'); subjectsList.forEach(sub=>{const btn=document.createElement('button');btn.className='shared-picker-primary';btn.textContent=({Arabic:'Arabic',English:'English',German:'German',French:'French',Math:'Math',Mechanics:'Mechanics',Physics:'Physics',Chemistry:'Chemistry',Biology:'Biology',Geo:'Geo'})[sub]||sub;btn.onclick=()=>renderAdvancedMenu(sub);box.appendChild(btn);}); return; }
    return renderSharedPickerCourseList(kind);
  }
  function renderAcademySharedPickerHome() { renderSharedPickerHome(); }

  function switchAcademicArea(next) { area=next; selectedCourseId=null; setAreaButtons(); renderAcademic(); }
  function initAcademicModule(user) {
    const resolved=user||(typeof currentUser!=='undefined'?currentUser:null)||'Unknown';
    if(academicLoadedFor===resolved) {renderAcademic();return Promise.resolve();}
    academicLoadedFor=resolved;
    return loadProgressForUser(resolved).then(()=>{
      area='secondary';
      // Refresh points once local/remote Academy ledger data is loaded.
      if (typeof calculatePoints === 'function') calculatePoints();
      setAreaButtons();
      renderAcademic();
    });
  }

  // Separate Academy point ledger, merged by the legacy score calculator.
  window.getAcademicPointsForDate = function(dateStr) {
    return Object.values(progress.awarded || {}).reduce((sum, award) => {
      if (!award || !award.date || String(award.date).slice(0,10) !== String(dateStr)) return sum;
      return sum + Math.max(0, Number(award.points) || 0);
    }, 0);
  };

  window.initAcademicModule=initAcademicModule;
  window.switchAcademicArea=switchAcademicArea;
  window.openAcademyCourse=openAcademyCourse;
  window.completeAcademicTask=completeAcademicTask;
  window.queueAcademyCourseActivity=queueCourseActivity;
  window.queueAcademyLanguageActivity=queueLanguageActivity;
  window.openLanguageTrack=openLanguageTrack;
  window.openAcademySharedPicker=openAcademySharedPicker;
  window.renderAcademySharedPicker=renderAcademySharedPicker;
  window.renderAcademySharedPickerHome=renderAcademySharedPickerHome;
  window.renderAcademySharedPickerCourse=renderSharedPickerCourse;
  window.selectSharedPickerActivity=selectSharedPickerActivity;
  window.assignSelectedSharedPickerActivity=assignSelectedSharedPickerActivity;
  window.setSharedPickerSessionMode=setSharedPickerSessionMode;
  window.assignSharedPickerLanguageActivity=assignSharedPickerLanguageActivity;
  window.queueSharedPickerReading=queueSharedPickerReading;
  window.renderAcademySharedPickerLanguage=renderSharedPickerLanguage;
  window.queueAcademyPickerTask=queuePickerTask;
  window.queueQuranTaskFromPicker=queueQuranTaskFromPicker;
  window.queueSharedHadith=queueSharedHadith;
  window.filterSharedPickerHadith=filterSharedPickerHadith;
  window.filterSharedPickerBooks=filterSharedPickerBooks;
  window.openSharedPickerBook=openSharedPickerBook;
  window.removeAcademyTaskFromSharedPoll = id => {
    if(window.isAcademyTaskCompleted && window.isAcademyTaskCompleted(id)) return false;
    const list=localData && Array.isArray(localData.dailySelection)?localData.dailySelection:[];
    const idx=list.findIndex(t=>t.academyTask && t.academyTask.id===id);
    if(idx>=0) { list.splice(idx,1); if(window.saveSharedPollTasks) window.saveSharedPollTasks(); }
    return idx>=0;
  };
  window.completeLanguageTask=completeLanguageTask;
  window.updateLanguageWordCount=updateLanguageWordCount;
  window.saveLanguageSession=saveLanguageSession;
  window.startLanguageSpeechCapture=startLanguageSpeechCapture;
  window.coachLanguageText=coachLanguageText;
  window.changeQuranSurah=changeQuranSurah;
  window.addQuranRecord=addQuranRecord;
  window.filterHadiths=filterHadiths;
  window.memorizeHadith=memorizeHadith;
  window.markHadithWeek=markHadithWeek;
  window.filterBookCategory=filterBookCategory;
  window.assignReadingBook=assignReadingBook;
  window.openReadingBook=openReadingBook;
  window.logReadingPages=logReadingPages;
  window.generateReadingTest=generateReadingTest;
  window.coachReadingNotes=coachReadingNotes;
  window.sendReadingToExamEngine=sendReadingToExamEngine;
  window.askAcademyAI=askAcademyAI;

  document.addEventListener('DOMContentLoaded',()=>{ if(!location.hash.startsWith('#studio-share=')) { if(typeof currentUser!=='undefined'&&currentUser)initAcademicModule(currentUser); } });
})();
