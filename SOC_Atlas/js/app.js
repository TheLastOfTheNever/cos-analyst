(()=>{const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];const store={get(k,d=null){try{let x=localStorage.getItem('socatlas:'+k);return x===null?d:JSON.parse(x)}catch{return d}},set(k,v){try{localStorage.setItem('socatlas:'+k,JSON.stringify(v))}catch{}}};window.SOC={$, $$,store,toast(msg){let old=$('.toast');if(old)old.remove();let el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)},mark(id,done){let a=store.get('completed',[]);a=done?[...new Set([...a,id])]:a.filter(x=>x!==id);store.set('completed',a);document.dispatchEvent(new CustomEvent('soc:progress'))},completed(){return store.get('completed',[])},esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}};let page=document.body.dataset.page||'';$$('.nav a').forEach(a=>{if(a.getAttribute('href')===page+'.html')a.classList.add('active')});let t=$('.mobile-toggle'),n=$('.nav');if(t&&n)t.onclick=()=>n.classList.toggle('open');if('IntersectionObserver'in window){let o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target)}}),{threshold:.08});$$('.reveal').forEach(e=>o.observe(e))}else $$('.reveal').forEach(e=>e.classList.add('visible'));function progress(){let done=SOC.completed(),all=new Set($$('[data-progress-id]').map(e=>e.dataset.progressId)),count=[...all].filter(x=>done.includes(x)).length,total=all.size||69,globalCount=done.length,pct=Math.min(100,Math.round(globalCount/total*100));$$('[data-progress-id]').forEach(e=>{if(e.type==='checkbox')e.checked=done.includes(e.dataset.progressId)});$$('[data-progress-count]').forEach(e=>e.textContent=(all.size?count:Math.min(globalCount,total))+'/'+total);$$('[data-progress-percent]').forEach(e=>e.textContent=pct+'%');$$('[data-progress-fill]').forEach(e=>e.style.width=pct+'%')}document.addEventListener('change',e=>{let el=e.target.closest('[data-progress-id]');if(el&&el.type==='checkbox')SOC.mark(el.dataset.progressId,el.checked)});document.addEventListener('soc:progress',progress);progress();let clock=$('[data-clock]');if(clock){const update=()=>clock.textContent=new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});update();setInterval(update,1000)}})();

// Guided tour across all learning pages. All content is client-side; no account is required.
(()=>{
  const {$,store}=window.SOC;
  const steps=[
    {page:'index.html',selector:'.hero h1',title:'Добро пожаловать в SOC Atlas',text:'Это учебная среда для пути к первой роли SOC Analyst. Экскурсия проведёт тебя по карте навыков, теории, инструментам и учебным расследованиям.'},
    {page:'index.html',selector:'.hero-panel',title:'Как выглядит смена SOC',text:'Здесь показана синтетическая телеметрия: события, сигналы и уровни серьёзности. В реальной работе аналитик проверяет не только сам алерт, но и контекст вокруг него.'},
    {page:'index.html',selector:'.stats-row',title:'Прогресс обучения',text:'Выполненные пункты сохраняются в этом браузере. Процент — ориентир по отмеченным темам, а не автоматическое подтверждение практического навыка.'},
    {page:'roadmap.html',selector:'.content-layout',title:'Карта навыков',text:'Двигайся по зависимостям: основы сетей и ОС → логи и SIEM → триаж и расследования → портфолио и трудоустройство. Не перескакивай через фундамент.'},
    {page:'roadmap.html',selector:'#curriculum',title:'Каждый этап объяснён',text:'Раскрывай модули, отмечай темы и выполняй практику. Переходи дальше, когда можешь объяснить тему своими словами и выполнить задание без пошаговой подсказки.'},
    {page:'academy.html',selector:'.content-layout',title:'Мышление аналитика',text:'Отделяй наблюдаемые факты от гипотез. Записывай, что известно, чего не хватает, что проверил и почему выбрал конкретное решение.'},
    {page:'tools.html',selector:'.tool-grid',title:'Интерактивные инструменты',text:'Здесь собраны учебные аналоги инструментов: анализ пакетов, Mini SIEM, endpoint timeline, анализ фишинга, конструктор детекций и разбор инцидента.'},
    {page:'lab-wireshark.html',selector:'.lab-layout',title:'Packet Explorer',text:'Выбирай пакет, применяй фильтр и раскрывай уровни протокола. Это синтетическая трасса для обучения, не настоящий захват сетевого трафика и не полноценный парсер PCAP.'},
    {page:'siem.html',selector:'#siem-query',title:'Mini SIEM',text:'Ищи события по полям, фильтруй по категории и серьёзности, открывай детали. Учись связывать время, пользователя, источник, действие и результат.'},
    {page:'endpoint.html',selector:'.lab-layout',title:'Endpoint-телеметрия',text:'Таймлайн помогает увидеть последовательность событий на конечном устройстве: процессы, учётные записи и подозрительную активность. Важно восстановить цепочку, а не судить по одному событию.'},
    {page:'phishing.html',selector:'.mail-layout',title:'Проверка фишинга',text:'Ищи несоответствия доменов, срочность, подозрительные ссылки и странные запросы. Один признак не всегда доказывает фишинг — оценивай комбинацию сигналов и контекст.'},
    {page:'cases.html',selector:'.content-layout',title:'Комната расследований',text:'Собери доказательства, оцени серьёзность, выбери следующий шаг и подготовь передачу старшему аналитику. Хороший handoff позволяет другому человеку продолжить работу без догадок.'},
    {page:'detection.html',selector:'.lab-layout',title:'От расследования к детекции',text:'Проверяй правило на учебных событиях и думай о пороге, временном окне, false positives и пропущенных случаях. Результат на маленьком наборе данных не доказывает эффективность в боевой среде.'},
    {page:'interview.html',selector:'.quiz-box',title:'Проверка готовности',text:'Тест и идеи проектов помогут найти пробелы. Для первой работы важнее уверенная практика, умение объяснить ход расследования, аккуратные заметки и базовые навыки, чем число пройденных курсов.'},
    {page:'index.html',selector:'.feature-band',title:'Теперь твой маршрут',text:'Начни с карты навыков, выполняй лабораторные задания и сохраняй результаты в портфолио. Демо безопасны и используют фиксированные синтетические данные.'}
  ];
  const key='guidedTour';let focus=null,dialog=null,resizeHandler=null;
  function pageName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
  function remove(){if(focus)focus.remove();if(dialog)dialog.remove();focus=null;dialog=null;if(resizeHandler)window.removeEventListener('resize',resizeHandler);document.querySelectorAll('[data-tour-active]').forEach(e=>e.removeAttribute('data-tour-active'))}
  function end(){remove();store.set(key,null);}
  function show(index){
    remove(); if(index<0||index>=steps.length){end();return}
    store.set(key,index); const step=steps[index];
    if(pageName()!==step.page){location.href=step.page+'?tour=1';return}
    let target=$(step.selector);
    if(!target){let next=index+1;show(next);return}
    target.scrollIntoView({behavior:'smooth',block:'center'});target.setAttribute('data-tour-active','');
    focus=document.createElement('div');focus.className='tour-focus';focus.setAttribute('aria-hidden','true');document.body.appendChild(focus);
    dialog=document.createElement('section');dialog.className='tour-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Экскурсия по сайту');
    dialog.innerHTML=`<div class="tour-kicker">SOC ATLAS · GUIDED TOUR</div><h3>${step.title}</h3><p>${step.text}</p><div class="tour-actions"><div class="left"><button class="tour-dismiss" data-tour-close>Завершить</button></div><span class="tour-counter">${String(index+1).padStart(2,'0')} / ${String(steps.length).padStart(2,'0')}</span><div class="right">${index?'<button class="btn small ghost" data-tour-prev>← Назад</button>':''}<button class="btn small primary" data-tour-next>${index===steps.length-1?'Завершить':'Далее →'}</button></div></div>`;
    document.body.appendChild(dialog);
    function position(){let r=target.getBoundingClientRect(),pad=5;focus.style.left=Math.max(5,r.left-pad)+'px';focus.style.top=Math.max(5,r.top-pad)+'px';focus.style.width=Math.min(window.innerWidth-10,r.width+pad*2)+'px';focus.style.height=Math.min(window.innerHeight-10,r.height+pad*2)+'px'}
    position();resizeHandler=position;window.addEventListener('resize',resizeHandler);
    dialog.querySelector('[data-tour-close]').onclick=end;
    dialog.querySelector('[data-tour-next]').onclick=()=>show(index+1);
    const prev=dialog.querySelector('[data-tour-prev]');if(prev)prev.onclick=()=>show(index-1);
  }
  const start=$('[data-tour-start]');if(start)start.addEventListener('click',()=>show(0));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&focus)end()});
  const saved=store.get(key,null);
  if(new URLSearchParams(location.search).has('tour')&&Number.isInteger(saved))show(saved);
  window.setTimeout(()=>{const orphan=document.querySelector('.tour-focus');if(orphan&&!document.querySelector('.tour-dialog'))orphan.remove();},1800); // socatlas-tour-safety
})();
