(()=>{
 const {$,$$,esc,toast}=SOC;
 const $rows=$('#packet-rows'),$filter=$('#packet-filter'),$detail=$('#packet-detail');
 if(!$rows||!window.SOC_PACKET_TEMPLATES)return;
 const templates=window.SOC_PACKET_TEMPLATES;
 const roles={
  '10.10.5.24':{name:'Рабочая станция WS-24',role:'Учебный клиент пользователя',zone:'Внутренняя сеть лаборатории'},
  '10.10.5.31':{name:'Рабочая станция WS-31',role:'Второй учебный клиент',zone:'Внутренняя сеть лаборатории'},
  '10.10.5.42':{name:'Рабочая станция WS-42',role:'Третий учебный клиент',zone:'Внутренняя сеть лаборатории'},
  '10.10.5.1':{name:'DNS-RESOLVER-01',role:'Учебный DNS-резолвер',zone:'Внутренняя сеть лаборатории'},
  '10.10.5.80':{name:'WEB-TRAINING-01',role:'Учебный веб-сервер',zone:'Внутренняя сеть лаборатории'},
  '10.10.5.99':{name:'CLIENT-TEST-99',role:'Условный источник аномального поведения',zone:'Внутренняя сеть лаборатории'},
  '198.51.100.77':{name:'TEST-NET-2 endpoint',role:'Условный внешний узел в сценарии',zone:'Документационный IPv4-диапазон'},
  '203.0.113.15':{name:'TEST-NET-3 endpoint',role:'Демонстрационный адрес из документационного диапазона',zone:'Документационный IPv4-диапазон'},
  '192.0.2.44':{name:'TEST-NET-1 endpoint',role:'Демонстрационный адрес из документационного диапазона',zone:'Документационный IPv4-диапазон'}
 };
 let packets=[],selectedNo=null,captured=false,timer=null,nextNo=1,blockedIps=new Set(),lastAdded=null,seconds=0,scenarioIndex=0;
 const ipPool=['10.10.5.24','10.10.5.31','10.10.5.42','10.10.5.99'];
 const extPool=['198.51.100.77','203.0.113.15','192.0.2.44'];
 const pad=n=>String(n).padStart(2,'0');
 const safe=(s)=>esc(String(s??''));
 function formatTime(n){return (n/1000).toFixed(3).padStart(7,'0')}
 function makeLayers(p){
  const ip=`Source: ${p.src}\nDestination: ${p.dst}\nTTL: ${p.ttl||64}`;
  const eth=[['Ethernet II',`Source MAC: ${p.srcMac||'02:00:00:00:00:24'}\nDestination MAC: ${p.dstMac||'02:00:00:00:00:80'}\nType: IPv4 (0x0800)`],['Internet Protocol Version 4',`${ip}\nProtocol: ${p.kind==='dns'||p.kind==='dns-answer'||p.kind==='udp'?'UDP (17)':'TCP (6)'}`]];
  if(p.kind==='dns'||p.kind==='dns-answer')return [['Frame '+p.no+': '+p.len+' bytes',`Frame length: ${p.len} bytes\nCapture source: synthetic packet generator`],...eth,['User Datagram Protocol',`Source Port: ${p.sport}\nDestination Port: ${p.dport}\nLength: ${Math.max(8,p.len-34)}`],['Domain Name System',`${p.info}\nNote: this is a synthetic lab name and response.`]];
  if(p.kind==='udp')return [['Frame '+p.no+': '+p.len+' bytes',`Frame length: ${p.len} bytes`],...eth,['User Datagram Protocol',`Source Port: ${p.sport}\nDestination Port: ${p.dport}\nLength: ${p.len-34}`],['Payload',`Synthetic UDP sample. No real user content is collected.`]];
  let flags=p.flags==='syn'?'SYN':p.flags==='synack'?'SYN, ACK':p.flags==='ack'?'ACK':p.kind==='tls'||p.kind==='tls-data'?'PSH, ACK':'ACK';
  const base=[['Frame '+p.no+': '+p.len+' bytes',`Frame length: ${p.len} bytes\nCapture source: synthetic packet generator`],...eth,['Transmission Control Protocol',`Source Port: ${p.sport}\nDestination Port: ${p.dport}\nFlags: ${flags}\nCalculated stream: ${Math.floor((p.no-1)/3)}\nNote: sequence values are illustrative.`]];
  if(p.kind==='tls'||p.kind==='tls-data')base.push(['Transport Layer Security',`${p.info}\nPayload: encrypted application data or handshake metadata.\nDecryption keys are not present in this lab.`]);
  if(p.kind==='http')base.push(['Hypertext Transfer Protocol',`Request: GET /training/status HTTP/1.1\nHost: portal.training.local\nThis is a sanitized teaching example; no credentials or personal data.`]);
  return base;
 }
 function createPacket(template,when){
  const p=JSON.parse(JSON.stringify(template));
  p.no=nextNo++;p.time=formatTime(when);p.blocked=blockedIps.has(p.src)||blockedIps.has(p.dst);p.when=when;
  p.layers=makeLayers(p);return p;
 }
 function generatedPacket(){
  scenarioIndex++;
  let t=templates[(scenarioIndex-1)%templates.length];
  // Change client and documentation-range endpoints to teach that each frame has its own endpoints.
  let c=ipPool[(scenarioIndex-1)%ipPool.length], ext=extPool[(Math.floor((scenarioIndex-1)/3))%extPool.length];
  t=JSON.parse(JSON.stringify(t));
  if(['dns','syn','tls','tls-data','ack'].includes(t.kind))t.src=c;
  if(t.kind==='dns' )t.dst='10.10.5.1';
  if(t.kind==='dns-answer'){t.src='10.10.5.1';t.dst=ipPool[(scenarioIndex-1)%ipPool.length]}
  if(['syn','synack','ack','tls','tls-data'].includes(t.kind)){t.src=t.kind==='synack'?'10.10.5.80':c;t.dst=t.kind==='synack'?c:(scenarioIndex%4===0?ext:'10.10.5.80');if(t.kind==='syn'||t.kind==='ack'||t.kind==='tls'||t.kind==='tls-data')t.suspicious=(t.dst===ext&&t.kind==='syn')||false;}
  if(t.kind==='http'){t.src=c;t.dst='10.10.5.80'}
  if(t.kind==='udp'){t.src=c;t.dst=ext}
  if(t.kind==='dns-answer'&&t.dst===c)t.info='Standard query response A '+ext;
  if(t.kind==='syn'&&t.suspicious)t.info=`${t.sport} → ${t.dport} [SYN] · repeated synthetic attempt`;
  if(t.dst==='198.51.100.77'||t.src==='198.51.100.77')t.suspicious=true;
  const p=createPacket(t,seconds);seconds+=Math.floor(18+Math.random()*160);return p;
 }
 function addInitial(){
  packets=[];nextNo=1;seconds=0;scenarioIndex=0;
  for(let i=0;i<12;i++){packets.push(generatedPacket())}
  lastAdded=packets[packets.length-1].no;
 }
 function matches(p,raw){
  let f=raw.trim().toLowerCase();if(!f)return true;
  if(f==='dns')return p.proto.toLowerCase()==='dns';
  if(f==='http')return p.proto.toLowerCase()==='http';
  if(f==='tls')return p.proto.toLowerCase()==='tls';
  if(f==='tcp')return p.proto.toLowerCase()==='tcp';
  if(f==='udp')return p.proto.toLowerCase()==='udp';
  if(f.includes('tcp.port')&&f.includes('443'))return p.proto==='TCP'&&(p.sport===443||p.dport===443)||p.proto==='TLS';
  if(f.includes('tcp.flags.syn'))return p.flags==='syn'||p.flags==='synack';
  let m=f.match(/ip\.addr\s*(?:==|eq)\s*([\d.]+)/);if(m)return p.src===m[1]||p.dst===m[1];
  m=f.match(/ip\.src\s*(?:==|eq)\s*([\d.]+)/);if(m)return p.src===m[1];
  m=f.match(/ip\.dst\s*(?:==|eq)\s*([\d.]+)/);if(m)return p.dst===m[1];
  m=f.match(/tcp\.port\s*(?:==|eq)\s*(\d+)/);if(m)return p.proto==='TCP'&&(p.sport===+m[1]||p.dport===+m[1]);
  if(f==='suspicious')return !!p.suspicious;
  return (p.info+' '+p.proto+' '+p.src+' '+p.dst).toLowerCase().includes(f);
 }
 function activePackets(){return packets.filter(p=>matches(p,$filter.value))}
 function render(){
  const visible=activePackets();$('#packet-count').textContent=visible.length;$('#packet-total').textContent=packets.length;$('#metric-displayed').textContent=visible.length;
  $('#metric-dns').textContent=packets.filter(p=>p.proto==='DNS').length;$('#metric-tls').textContent=packets.filter(p=>p.proto==='TLS').length;$('#metric-syn').textContent=packets.filter(p=>p.flags==='syn').length;
  const unique=new Set(packets.flatMap(p=>[p.src,p.dst]));$('#metric-ips').textContent=unique.size;
  if(!visible.length){$rows.innerHTML=`<tr><td colspan="7" class="empty-state">Нет пакетов, подходящих под фильтр. Попробуй dns или очисти фильтр.</td></tr>`;$detail.innerHTML='<div class="empty-state">Нет выбранного пакета.</div>';renderGraph();return;}
  if(!visible.some(p=>p.no===selectedNo))selectedNo=visible[visible.length-1].no;
  $rows.innerHTML=visible.slice().reverse().map(p=>`<tr data-no="${p.no}" class="${p.no===selectedNo?'selected ':''}${p.no===lastAdded?'new-packet ':''}${p.blocked?'blocked-row':''}"><td class="packet-id">${p.no}</td><td class="mono-cell">${safe(p.time)}</td><td class="mono-cell">${safe(p.src)}</td><td class="mono-cell">${safe(p.dst)}</td><td><span class="table-badge ${p.suspicious?'badge-alert':p.proto==='DNS'?'badge-warn':p.proto==='TLS'?'badge-ok':'badge-info'}">${safe(p.proto)}</span></td><td class="mono-cell">${p.len}</td><td>${safe(p.info)}${p.blocked?' <b class="text-red">[LAB BLOCK]</b>':''}</td></tr>`).join('');
  renderDetail(visible.find(p=>p.no===selectedNo));renderGraph();
 }
 function renderDetail(p){
  if(!p){$detail.innerHTML='<div class="empty-state">Выбери пакет.</div>';return}
  let note=p.summary;
  let flags=p.flags?`<span class="endpoint-chip">TCP ${p.flags.toUpperCase()}</span>`:'';
  $detail.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:13px"><strong style="font-size:16px">Frame ${p.no} · ${safe(p.proto)}</strong><span class="pill">${p.len} байт · ${safe(p.time)} s</span></div><div class="endpoint-chip">${safe(p.src)}:${p.sport}</div><span>→</span><div class="endpoint-chip">${safe(p.dst)}:${p.dport}</div>${flags}<div class="divider"></div>${p.layers.map((l,i)=>`<details class="packet-layer" ${i===0?'open':''}><summary>${safe(l[0])}</summary><div class="layer-body">${safe(l[1]).replace(/\n/g,'<br>')}</div></details>`).join('')}<div class="lesson-note"><span>i</span><p><b>Что это значит:</b> ${safe(note)}${p.blocked?' Адрес помечен заблокированным в этой симуляции; реальная система не затронута.':''}</p></div><div class="decision-row"><button class="btn small" data-ipinspect="${safe(p.src)}">Исследовать источник</button><button class="btn small" data-ipinspect="${safe(p.dst)}">Исследовать назначение</button><button class="btn small" data-trace="${safe(p.src)}">История адреса</button></div>`;
 }
 function ipDescription(ip){return roles[ip]||{name:'Адрес не включён в учебный набор',role:'Симулятор не выполняет live WHOIS или внешнюю атрибуцию',zone:'Неизвестно в рамках этого набора'};}
 function renderGraph(){
  const svg=$('#connection-svg'),list=$('#connection-list');if(!svg||!list)return;
  const known=Object.keys(roles),current=packets;
  const countMap=new Map();current.forEach(p=>{let key=p.src+'|'+p.dst;let v=countMap.get(key)||{src:p.src,dst:p.dst,count:0,proto:new Set(),alert:false};v.count++;v.proto.add(p.proto);v.alert=v.alert||p.suspicious;countMap.set(key,v)});
  const edges=[...countMap.values()].sort((a,b)=>b.count-a.count).slice(0,14);
  if(!edges.length){svg.innerHTML='<text x="400" y="210" text-anchor="middle" fill="#667780" font-size="17">Запусти захват, чтобы построить схему</text>';list.innerHTML='<div class="empty-state">Пока нет потоков.</div>';return}
  const activeIps=new Set(edges.flatMap(e=>[e.src,e.dst]));
  const coords={'10.10.5.24':[120,82],'10.10.5.31':[120,210],'10.10.5.42':[120,338],'10.10.5.99':[400,348],'10.10.5.1':[395,72],'10.10.5.80':[410,205],'198.51.100.77':[680,85],'203.0.113.15':[680,208],'192.0.2.44':[680,337]};
  let svgHtml='<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#81929b"/></marker></defs>';
  edges.forEach(e=>{if(!coords[e.src]||!coords[e.dst])return;let [x1,y1]=coords[e.src],[x2,y2]=coords[e.dst];svgHtml+=`<line class="edge ${e.alert?'alert':''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${Math.min(4,1+e.count*.35)}" marker-end="url(#arrowhead)" opacity=".8"><title>${safe(e.src)} → ${safe(e.dst)} · ${e.count} пакетов</title></line>`});
  activeIps.forEach(ip=>{let pos=coords[ip];if(!pos)return;let [x,y]=pos,meta=ipDescription(ip),cl=ip.startsWith('198.')||ip.startsWith('203.')||ip.startsWith('192.')?'external':ip==='10.10.5.80'||ip==='10.10.5.1'?'server':'';svgHtml+=`<g class="node ${cl}" data-ip="${ip}" tabindex="0" role="button" aria-label="Фильтр по ${ip}"><circle cx="${x}" cy="${y}" r="26"></circle><text x="${x}" y="${y+4}">IP</text><text class="node-name" x="${x}" y="${y+45}">${ip}</text><title>${safe(meta.name)} — нажми, чтобы фильтровать</title></g>`});
  svg.innerHTML=svgHtml;
  list.innerHTML=edges.slice(0,8).map(e=>`<div class="conn-item"><button type="button" data-conn-ip="${safe(e.src)}">${safe(e.src)} → ${safe(e.dst)}</button><small>${e.count} пак. · ${[...e.proto].join(', ')}${e.alert?' · сценарий для проверки':''}</small></div>`).join('');
 }
 function commandPrint(text,cls=''){const out=$('#console-output');if(!out)return;const line=document.createElement('div');line.className='terminal-line '+cls;line.textContent=text;out.appendChild(line);while(out.children.length>80)out.removeChild(out.firstChild);out.scrollTop=out.scrollHeight;}
 function commandEcho(cmd){commandPrint('analyst@lab:~$ '+cmd,'info')}
 function startCapture(){if(captured&&timer)return;captured=true;$('#capture-status').textContent='ЗАХВАТ ИДЁТ · DEMO';$('#capture-led').classList.add('running');$('#capture-start').disabled=true;$('#capture-stop').disabled=false;$('#capture-start').textContent='▶ Захват идёт';if(!packets.length)addInitial();render();if(!timer)timer=setInterval(()=>{if(!captured)return;const p=generatedPacket();p.blocked=blockedIps.has(p.src)||blockedIps.has(p.dst);packets.push(p);if(packets.length>140)packets.shift();lastAdded=p.no;if(!selectedNo)selectedNo=p.no;render()},1200);}
 function stopCapture(){captured=false;if(timer){clearInterval(timer);timer=null}$('#capture-status').textContent='ПАУЗА';$('#capture-led').classList.remove('running');$('#capture-start').disabled=false;$('#capture-start').textContent='▶ Продолжить';$('#capture-stop').disabled=true;}
 function resetCapture(){stopCapture();packets=[];nextNo=1;seconds=0;scenarioIndex=0;selectedNo=null;lastAdded=null;blockedIps.clear();$filter.value='';$('#capture-status').textContent='ГОТОВ К ЗАПУСКУ';$('#capture-start').textContent='▶ Начать учебный захват';$('#console-status').textContent='LAB MODE';render();}
 function filterBy(value){$filter.value=value;render()}
 function whois(ip){let known=roles[ip];if(known)return `${ip}\nНазвание в учебном стенде: ${known.name}\nРоль: ${known.role}\nЗона: ${known.zone}\nПримечание: это метка синтетического сценария, не атрибуция реального владельца.`;if(/^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(ip))return `${ip} входит в документационные диапазоны TEST-NET. В реальной сети это не информация о владельце; здесь внешнее обращение не выполняется.`;return `Для ${ip} данных в синтетическом наборе нет. Эта лаборатория не отправляет WHOIS/DNS-запросы и не определяет владельца произвольного IP.`}
 function traceIp(ip){const found=packets.filter(p=>p.src===ip||p.dst===ip).slice(-12);if(!found.length)return `Адрес ${ip} не встречался в текущем захвате. Запусти захват или попробуй другой IP.`;return `Последние события для ${ip}:\n`+found.map(p=>`#${p.no} ${p.time}s ${p.src} → ${p.dst} · ${p.proto} · ${p.info}`).join('\n')}
 function startTrafficDemo(mode){
  const many=mode==='ddos';const sources=many?['198.51.100.20','198.51.100.21','203.0.113.31','203.0.113.32','192.0.2.40','192.0.2.41','198.51.100.77']:['198.51.100.77'];
  $('#traffic-sources').innerHTML=sources.map(ip=>`<span class="traffic-source">${ip} · DEMO</span>`).join('');
  const load=many?94:73,avail=many?7:24;
  $('#traffic-load-fill').style.width=load+'%';$('#traffic-load-value').textContent=load+' / 100';$('#traffic-availability-fill').style.width=avail+'%';$('#traffic-availability-value').textContent=avail+'%';$('#traffic-normal-fill').style.width='24%';$('#traffic-normal-value').textContent='24 / 100';
  $('#traffic-outcome').textContent=many?'DDoS (учебная модель): нагрузка распределена по множеству источников. Обычные запросы конкурируют за общие ресурсы, поэтому доступность падает. В реальной реакции нужны наблюдение за несколькими метриками и защита на подходящем уровне. Ни один пакет в интернет не отправлен.':'DoS (учебная модель): один источник создаёт избыточную нагрузку на условный сервис. Если ресурс ограничен, нормальным пользователям становится труднее получить ответ. В реальности проверяют, какой ресурс исчерпан и совпадает ли всплеск с бизнес-событиями. Ни один пакет в интернет не отправлен.';
 }
 function command(cmd){let c=cmd.trim();if(!c)return;commandEcho(c);let parts=c.split(/\s+/),verb=parts[0].toLowerCase(),arg=parts.slice(1).join(' '),out='';
  if(c.toLowerCase()==='clear'){$('#console-output').innerHTML='';return}
  if(c.toLowerCase()==='help'){out='Доступные команды:\nhelp                         справка\ncapture start | stop | list  управление учебным потоком\nfilter <expression>          применить фильтр к таблице\nconnections                  показать пары узлов\nip <IPv4>                    сведения об узле стенда\nwhois <IPv4>                 учебная справка, без внешнего запроса\ntrace <IPv4>                 история пакетов с адресом\nblock <IPv4>                 пометить синтетический IP в песочнице\nstats                        сводка набора\ndos demo | ddos demo          безопасная анимация концепции\nclear                        очистить историю консоли\n';commandPrint(out,'success');return}
  if(verb==='capture'){
   if(arg==='start'){startCapture();commandPrint('Учебный поток запущен. Генератор использует только предопределённые демонстрационные адреса.','success')}
   else if(arg==='stop'){stopCapture();commandPrint('Учебный захват поставлен на паузу.','success')}
   else if(arg==='list'){commandPrint(packets.length?packets.slice(-12).map(p=>`#${p.no} ${p.src} → ${p.dst} ${p.proto} ${p.info}`).join('\n'):'Захват пуст. Используй capture start.','info')}
   else commandPrint('Формат: capture start | capture stop | capture list','error');return;
  }
  if(verb==='filter'){if(!arg||arg==='clear'){filterBy('');commandPrint('Фильтр очищен.','success')}else{filterBy(arg);commandPrint(`Применён учебный фильтр: ${arg}. Совпадений: ${activePackets().length}.`,`success`)}return}
  if(verb==='connections'){const sum=[...new Set(packets.map(p=>p.src+' → '+p.dst))];commandPrint(sum.length?sum.slice(0,25).join('\n'):'Нет соединений. Запусти capture start.','info');$('#connection-theory').scrollIntoView({behavior:'smooth',block:'start'});return}
  if(verb==='ip'||verb==='whois'){
   if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(arg)){commandPrint('Укажи IPv4, например: ip 10.10.5.24','error');return}
   const ip=arg;commandPrint(verb==='whois'?whois(ip):`${ip}\n${whois(ip)}\nПакетов с этим адресом: ${packets.filter(p=>p.src===ip||p.dst===ip).length}\nПротоколы: ${[...new Set(packets.filter(p=>p.src===ip||p.dst===ip).map(p=>p.proto))].join(', ')||'пока нет наблюдений'}\nПроверка: смотри направление, повторы и временные интервалы.`,'info');return;
  }
  if(verb==='trace') {if(!arg){commandPrint('Формат: trace 198.51.100.77','error');return}commandPrint(traceIp(arg),'info');return;}
  if(verb==='block'){
   if(!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(arg)){commandPrint('Формат: block <IP из учебного набора>.','error');return}
   const known=packets.some(p=>p.src===arg||p.dst===arg)||roles[arg];if(!known){commandPrint('Адрес не встречается в учебном наборе. Для безопасности стенд не имитирует блокировку произвольного IP.','error');return;}
   blockedIps.add(arg);packets.forEach(p=>{if(p.src===arg||p.dst===arg)p.blocked=true});render();commandPrint(`LAB ONLY: ${arg} отмечен как заблокированный в этой симуляции. Настройки ОС, роутера и реальной сети не менялись.`,'success');return;
  }
  if(verb==='stats'){const ips=new Set(packets.flatMap(p=>[p.src,p.dst]));commandPrint(`Пакетов: ${packets.length}\nУникальных IP в учебном наборе: ${ips.size}\nDNS: ${packets.filter(p=>p.proto==='DNS').length}\nTLS: ${packets.filter(p=>p.proto==='TLS').length}\nSYN без ACK: ${packets.filter(p=>p.flags==='syn').length}\nПомеченные в симуляции blocked: ${blockedIps.size}`,'info');return;}
  if(verb==='dos'&&arg==='demo'){startTrafficDemo('dos');commandPrint('Запущена только визуальная модель DoS. Сетевые пакеты не отправлялись.','success');$('#dos-ddos').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(verb==='ddos'&&arg==='demo'){startTrafficDemo('ddos');commandPrint('Запущена только визуальная модель DDoS. Сетевые пакеты не отправлялись.','success');$('#dos-ddos').scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(verb==='explain'){const explanation={ip:'IP отвечает на вопрос: какие сетевые адреса указаны в заголовке пакета.',tcp:'TCP обеспечивает упорядоченный поток байтов, подтверждения и повторную передачу.',udp:'UDP передаёт отдельные датаграммы; доставка и порядок не гарантируются транспортным протоколом.',dns:'DNS помогает сопоставить доменные имена с IP-адресами и другими записями.',tls:'TLS шифрует канал между сторонами и защищает конфиденциальность содержимого при корректной настройке.',http:'HTTP описывает запросы и ответы веб-приложения; без TLS содержимое может быть доступно наблюдателю пути.'};commandPrint(explanation[arg.toLowerCase()]||'Попробуй explain ip, explain tcp, explain udp, explain dns, explain tls или explain http.','info');return;}
  commandPrint('Неизвестная команда. Введи help.','error');
 }
 $('#capture-start').addEventListener('click',startCapture);$('#capture-stop').addEventListener('click',stopCapture);$('#capture-reset').addEventListener('click',resetCapture);
 $('#filter-apply').addEventListener('click',render);$('#filter-clear').addEventListener('click',()=>filterBy(''));$filter.addEventListener('keydown',e=>{if(e.key==='Enter')render()});
 $$('[data-pfilter]').forEach(b=>b.addEventListener('click',()=>filterBy(b.dataset.pfilter)));
 $rows.addEventListener('click',e=>{const tr=e.target.closest('[data-no]');if(tr){selectedNo=Number(tr.dataset.no);render()}});
 $detail.addEventListener('click',e=>{let ipBtn=e.target.closest('[data-ipinspect]');let traceBtn=e.target.closest('[data-trace]');if(ipBtn){$('#console-input').value='ip '+ipBtn.dataset.ipinspect;command($('#console-input').value);$('#console-input').value='';$('#console-input').focus()}if(traceBtn){$('#console-input').value='trace '+traceBtn.dataset.trace;command($('#console-input').value);$('#console-input').value='';$('#console-input').focus()}});
 $('#connection-svg').addEventListener('click',e=>{const n=e.target.closest('[data-ip]');if(n){filterBy('ip.addr == '+n.dataset.ip);$('#packet-filter').scrollIntoView({behavior:'smooth',block:'center'})}});
 $('#connection-svg').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const n=e.target.closest('[data-ip]');if(n){e.preventDefault();filterBy('ip.addr == '+n.dataset.ip)}}});
 $('#connection-list').addEventListener('click',e=>{const b=e.target.closest('[data-conn-ip]');if(b)filterBy('ip.addr == '+b.dataset.connIp)});
 $('#console-form').addEventListener('submit',e=>{e.preventDefault();const input=$('#console-input');const c=input.value;input.value='';command(c)});
 $$('.terminal-suggestions [data-command]').forEach(b=>b.addEventListener('click',()=>command(b.dataset.command)));
 $('#dos-start-one').addEventListener('click',()=>startTrafficDemo('dos'));$('#dos-start-many').addEventListener('click',()=>startTrafficDemo('ddos'));$('#dos-reset').addEventListener('click',()=>{$('#traffic-sources').innerHTML='<span class="endpoint-chip">Обычные клиенты · 3</span>';$('#traffic-load-fill').style.width='0%';$('#traffic-load-value').textContent='0 / 100';$('#traffic-availability-fill').style.width='96%';$('#traffic-availability-value').textContent='96%';$('#traffic-outcome').textContent='Пока всё штатно: сервис обслуживает обычные запросы. Запусти одну из демонстраций, чтобы сравнить концепции.'});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&timer)stopCapture()});
 render();
})();
