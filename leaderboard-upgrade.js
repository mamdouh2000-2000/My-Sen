/* Extra leaderboard analytics; does not replace the original charts or point ledger. */
(function () {
  'use strict';
  let trendChart = null;
  let lastSeriesPayload = null;
  let aiBusy = false;
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function localDateString(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  async function dailyPoints(name, day) {
    if (typeof db === 'undefined' || !db) return 0;
    try { const doc=await db.collection('users').doc(name).collection('daily_records').doc(day).get(); return doc.exists ? (Number(doc.data().points)||0) : 0; }
    catch (error) { console.warn('[Leaderboard] daily point lookup failed',error); return 0; }
  }
  async function renderLeaderboardUpgrade(filter, mamdouhTotal, samaTotal) {
    const gap=Math.abs((Number(mamdouhTotal)||0)-(Number(samaTotal)||0));
    const winner=(Number(mamdouhTotal)||0)===(Number(samaTotal)||0)?'تعادل':((Number(mamdouhTotal)||0)>(Number(samaTotal)||0)?'ممدوح':'سما');
    const gapEl=$('lb-gap-value'),caption=$('lb-gap-caption'),leader=$('lb-leader-name'),leaderCaption=$('lb-leader-streak'),average=$('lb-daily-average');
    if(gapEl) gapEl.textContent=gap.toLocaleString();
    if(caption) caption.textContent=filter==='today'?'فرق اليوم':filter==='week'?'فرق آخر 7 أيام':'فرق آخر 30 يومًا';
    if(leader) leader.textContent=winner;
    if(leaderCaption) leaderCaption.textContent=winner==='تعادل'?'النقاط متساوية في الفترة':'المتصدر حسب النقاط في الفترة المختارة';
    const end=(typeof todayStr!=='undefined'&&todayStr)?new Date(`${todayStr}T12:00:00`):new Date();
    const days=[]; for(let i=6;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);days.push(localDateString(d));}
    const [mSeries,sSeries]=await Promise.all([
      Promise.all(days.map(d=>dailyPoints('Mamdouh',d))),
      Promise.all(days.map(d=>dailyPoints('Sama',d)))
    ]);
    const sum=[...mSeries,...sSeries].reduce((s,n)=>s+n,0);
    if(average) average.textContent=Math.round(sum/7).toLocaleString();
    lastSeriesPayload = { filter, days, mamdouh: mSeries, sama: sSeries };
    const canvas=$('leaderboardTrendChart');
    if(canvas && typeof Chart!=='undefined') {
      if(trendChart) trendChart.destroy();
      trendChart=new Chart(canvas.getContext('2d'),{
        type:'line',
        data:{labels:days.map(d=>d.slice(5)),datasets:[
          {label:'ممدوح',data:mSeries,borderColor:'#71edcd',backgroundColor:'rgba(113,237,205,.12)',fill:true,tension:.35,borderWidth:2,pointRadius:3,pointBackgroundColor:'#71edcd'},
          {label:'سما',data:sSeries,borderColor:'#a69aff',backgroundColor:'rgba(166,154,255,.08)',fill:true,tension:.35,borderWidth:2,pointRadius:3,pointBackgroundColor:'#a69aff'}
        ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#a8b7cb',usePointStyle:true,boxWidth:7,font:{size:10}}},tooltip:{callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${Number(ctx.raw||0).toLocaleString()} نقطة`}}},scales:{x:{grid:{display:false},ticks:{color:'#8396ae',font:{size:9}}},y:{beginAtZero:true,grid:{color:'rgba(143,168,205,.11)'},ticks:{color:'#8396ae',font:{size:9}}}}}
      });
    }
  }
  async function generateLeaderboardAIInsights() {
    const box=$('leaderboard-ai-insights'); if(!box) return;
    const key=localStorage.getItem('ai_api_key');
    if(!key) { if(typeof showToast==='function') showToast('احفظ مفتاح AI من قسم الامتحانات أولًا.','error'); box.classList.remove('hidden'); box.textContent='يلزم حفظ مفتاح AI في الإعدادات الحالية حتى يمكن توليد التحليل.'; return; }
    if(aiBusy) return;
    if(!lastSeriesPayload) { box.classList.remove('hidden'); box.textContent='افتح لوحة Leaderboard وانتظر تحميل الأرقام أولًا.'; return; }
    aiBusy=true; box.classList.remove('hidden'); box.textContent='يتم تحليل السجل اليومي…';
    const modelEl=$('ai-model-select'); const model=modelEl?.value && !String(modelEl.value).startsWith('llama') ? modelEl.value : 'openai/gpt-oss-120b';
    const payload={period:'آخر 7 أيام',dates:lastSeriesPayload.days,mamdouh:lastSeriesPayload.mamdouh,sama:lastSeriesPayload.sama,periodFilter:lastSeriesPayload.filter};
    try {
      const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:'system',content:'أنت محلل أداء تعليمي متزن. حلل فقط الأرقام المقدمة. لا تستنتج قدرة أو كسلًا أو حالة نفسية. اذكر ما تدعمه البيانات فقط، وضّح أن عينة أسبوع واحد محدودة، ثم اقترح 3 خطوات عادلة قابلة للقياس لكل شخص. أجب بالعربية المصرية المهنية وباختصار منظم.'},{role:'user',content:`هذه نقاط يومية فعلية من سجلات المنصة لآخر 7 أيام:
${JSON.stringify(payload)}
اعرض: (1) الاتجاه الظاهر لكل شخص، (2) الأيام الأعلى والأقل حسب البيانات، (3) ثلاث توصيات للممدوح وثلاث لسما، (4) ما لا يمكن استنتاجه من هذه البيانات.`}],temperature:0.2,max_tokens:1600})});
      const data=await response.json(); if(!response.ok||data.error) throw new Error(data.error?.message||`HTTP ${response.status}`);
      const answer=data.choices?.[0]?.message?.content||'لم يصل تحليل من النموذج.';
      box.innerHTML=`<div class="leaderboard-ai-result"><div class="eyebrow">AI PERFORMANCE REVIEW • أرقام آخر 7 أيام</div><div>${esc(answer).replace(/\n/g,'<br>')}</div></div>`;
    } catch(error) { box.textContent=`تعذر توليد التحليل: ${error.message}. تأكد من صلاحية مفتاح AI والنموذج والاتصال.`; }
    finally { aiBusy=false; }
  }
  window.renderLeaderboardUpgrade=renderLeaderboardUpgrade;
  window.generateLeaderboardAIInsights=generateLeaderboardAIInsights;
})();
