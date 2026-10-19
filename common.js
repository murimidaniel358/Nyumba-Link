/* Nyumba Link shared data + page chrome. Listings are ILLUSTRATIVE demo data, not real prices. */
const $=(s,e=document)=>e.querySelector(s),L=(a,f)=>a.map(f).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const UNI=['Kenyatta University','JKUAT','University of Nairobi','Egerton University'],TYPES=['Hostel','Single room','Bedsitter','Shared apartment'],O={uni:UNI,type:TYPES};
const ksh=n=>'KSh '+n.toLocaleString(),km=m=>m<1000?m+' m':(m/1000)+' km',PH='254700000000';
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='on';setTimeout(()=>t.className='',2600)};
const art=h=>'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 260'><defs><linearGradient id='g' x2='0' y2='1'><stop offset='0' stop-color='hsl(${h},85%,82%)'/><stop offset='1' stop-color='#fff'/></linearGradient><pattern id='w' width='24' height='28' patternUnits='userSpaceOnUse'><rect x='6' y='7' width='12' height='14' fill='hsl(200,90%,90%)'/></pattern></defs><rect width='400' height='260' fill='url(#g)'/><circle cx='330' cy='50' r='22' fill='#fff' opacity='.8'/><rect x='110' y='70' width='170' height='160' fill='hsl(222,75%,${40+h%20}%)'/><rect x='110' y='70' width='170' height='160' fill='url(#w)'/><rect x='178' y='185' width='34' height='45' fill='#fff'/><rect y='228' width='400' height='32' fill='hsl(215,60%,92%)'/></svg>`);
const K='id name type rent dep uni area dist furn wifi water sec bills status conf adv'.split(' ');
const D=[['student-hostel-juja','Student Hostel A','Hostel',4500,4500,'JKUAT','Juja',400,0,1,1,1,0,'Available','2026-10-16','Mary W.'],
['bedsitter-kahawa','Bedsitter B','Bedsitter',7000,7000,'Kenyatta University','Kahawa Wendani',1000,1,1,1,1,0,'Available','2026-10-15','Peter K.'],
['shared-apartment-kahawa','Shared Apartment C','Shared apartment',6000,6000,'Kenyatta University','Kahawa Sukari',800,1,1,1,0,1,'Limited rooms','2026-10-12','Grace N.'],
['single-room-juja','Single Room near Gate C','Single room',5500,5500,'JKUAT','Juja',600,0,0,1,1,0,'Available','2026-10-10','Joseph M.'],
['hostel-njoro','Njoro Student Lodge','Hostel',3800,3000,'Egerton University','Njoro',300,0,1,1,1,0,'Limited rooms','2026-10-14','Agnes C.'],
['bedsitter-njoro','Njoro Bedsitter','Bedsitter',6500,6500,'Egerton University','Njoro',1500,1,0,1,0,0,'Fully booked','2026-10-01','Samuel T.'],
['hostel-kilimani','Kilimani Study Hostel','Hostel',9000,9000,'University of Nairobi','Kilimani',2500,1,1,1,1,1,'Available','2026-10-17','Esther A.'],
['shared-apartment-parklands','Parklands Shared Flat','Shared apartment',8000,8000,'University of Nairobi','Parklands',1800,1,1,1,1,0,'Available','2026-08-30','Daniel O.']
].map((a,i)=>({...Object.fromEntries(K.map((k,j)=>[k,a[j]])),n:i,hue:200+i*7}));
const pill=s=>`<span class="pill ${s=='Available'?'ok':s=='Limited rooms'?'warn':'bad'}">${s}</span>`;
const card=p=>`<a class=card href="property.html?id=${p.id}"><span class=tag>${p.type}</span><div class=im><img src="${art(p.hue)}" alt=""></div><div class=t><h3>${esc(p.name)}</h3><p>${esc(p.area)} · ${esc(p.uni)}</p><p>${km(p.dist)} from campus</p><b>${ksh(p.rent)}<small> /month${p.type=='Shared apartment'?' per person':''}</small></b>${pill(p.status)}</div></a>`;
const NAV=[['index.html','Home'],['find.html','Find Accommodation'],['list.html','List Your Property'],['about.html','About Us']],pg=location.pathname.split('/').pop()||'index.html',U=JSON.parse(localStorage.nl_user||'null');
$('#hd').outerHTML=`<header><a class=logo href=index.html>Nyumba<span> Link</span></a><nav>${L(NAV,x=>`<a href=${x[0]} class="${pg==x[0]?'on':''}">${x[1]}</a>`)}<a class="btn sm" href=account.html>${U?'Hi, '+esc(U.name.split(' ')[0]):'Login / Sign Up'}</a></nav></header>`;
$('#ft').innerHTML='© Nyumba Link · <a href=contact.html>Contact &amp; support</a> · <a href=safety.html>Safety &amp; scam prevention</a><br><small>Demo listings are illustrative, not verified market prices.</small>';
document.querySelectorAll('select[data-o]').forEach(s=>s.insertAdjacentHTML('beforeend',L(O[s.dataset.o],o=>`<option>${o}</option>`)));
