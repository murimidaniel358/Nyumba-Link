/* MyKejaLink shared data + page chrome. Listings are ILLUSTRATIVE demo data, not real prices. */
const favicon=document.createElement('link');favicon.rel='icon';favicon.type='image/svg+xml';favicon.href=new URL('favicon.svg',location.href).href;document.head.append(favicon);
const themeStorageKey='mykejalink-theme';
const systemThemePreference=matchMedia('(prefers-color-scheme: dark)');let userThemeOverride=false;
try{const savedTheme=localStorage.getItem(themeStorageKey);userThemeOverride=savedTheme==='dark'||savedTheme==='light';document.documentElement.dataset.theme=userThemeOverride?savedTheme:(systemThemePreference.matches?'dark':'light')}catch{document.documentElement.dataset.theme=systemThemePreference.matches?'dark':'light'}
systemThemePreference.addEventListener('change',event=>{if(userThemeOverride)return;document.documentElement.dataset.theme=event.matches?'dark':'light';if(typeof syncThemeToggle==='function')syncThemeToggle()});
const $=(s,e=document)=>e.querySelector(s),L=(a,f)=>a.map(f).join('');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const UNI=[],TYPES=['Hostel','Single room','Bedsitter','Studio apartment','Shared room','One bedroom','Other','Shared apartment'],O={uni:UNI,type:TYPES};
let activeAccountRole=null,activeAccountId=null;
const savedListingIds=new Set(),propertyRatingsById=new Map(),isUuid=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');
const localListingRatings=()=>{try{return JSON.parse(localStorage.nl_rate||'{}')}catch{return {}}};
const listingRatingFor=id=>isUuid(id)?propertyRatingsById.get(id)||0:localListingRatings()[id]||0;
const demoSavedIds=()=>{try{return new Set(JSON.parse(localStorage.getItem(`nl_saved_demo_listings_${activeAccountId}`)||'[]'))}catch{return new Set()}};
const syncSavedListingButtons=()=>{const demos=demoSavedIds();document.querySelectorAll('[data-save-listing]').forEach(button=>{const id=button.dataset.listingId,saved=savedListingIds.has(id)||demos.has(id);button.hidden=activeAccountRole!=='student';button.classList.toggle('is-saved',saved);button.innerHTML=saved?'<span class="save-heart" aria-hidden="true">♥</span><span>Saved · Remove</span>':'<span class="save-heart" aria-hidden="true">♡</span><span>Save listing</span>';button.setAttribute('aria-label',saved?'Remove from saved listings':'Save listing');button.setAttribute('aria-pressed',String(saved))})};
const syncRatingControls=()=>document.querySelectorAll('.rs').forEach(section=>{const card=section.closest('.card'),score=card?listingRatingFor(card.dataset.id):0;section.querySelectorAll('[data-r]').forEach(button=>{const value=Number(button.dataset.r);button.disabled=Boolean(score);button.classList.toggle('on',value<=score);button.setAttribute('aria-pressed',String(value===score))});const label=section.querySelector('small');if(label)label.textContent=score?`Your ${score}-star rating · one rating per listing`:'Current tenant? Rate this property'});
new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('[data-save-listing],.rs')||node.querySelector?.('[data-save-listing],.rs'))))){syncSavedListingButtons();syncRatingControls()}}).observe(document.body,{childList:true,subtree:true});
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
].map((a,i)=>({...Object.fromEntries(K.map((k,j)=>[k,a[j]])),n:i,hue:200+i*7,rate:+(3.7+((i*37)%13)/10).toFixed(1),rev:12+i*9,views:420+i*337}));
const pill=s=>`<span class="pill ${s=='Available'?'ok':s=='Limited rooms'?'warn':'bad'}">${s}</span>`;
const TC={'Hostel':'#7c3aed','Single room':'#0d9488','Bedsitter':'#d97706','Studio apartment':'#0891b2','Shared room':'#e11d48','One bedroom':'#2563eb','Other':'#64748b','Shared apartment':'#e11d48'};
const rate=p=>`<span class=stars>${'★'.repeat(Math.round(p.rate))}${'☆'.repeat(5-Math.round(p.rate))}</span> <b class=rn>${p.rate}</b> <small>(${p.rev} rating${p.rev===1?'':'s'})</small>`;
const card=p=>{const my=(JSON.parse(localStorage.nl_rate||'{}'))[p.id]||0;return `<div class=card data-id="${esc(p.id)}"><a class=cl href="property.html?id=${encodeURIComponent(p.id)}"><div class=im><img src="${esc(p.coverImageUrl||art(p.hue))}" alt=""><span class=loc>${esc(p.area)}</span><span class=ty style="background:${TC[p.type]}">${esc(p.type)}</span></div><div class=t><div class=row><h3>${esc(p.name)}</h3><b class=pr>${ksh(p.rent)}<small>/mo</small></b></div><p class=sub>${esc(p.uni)} · ${km(p.dist)}${p.type=='Shared apartment'?' · per person':''}</p><div>${rate(p)}</div><div class=who><span class=av style="background:${TC[p.type]}">${esc(p.adv[0])}</span>${esc(p.adv)}</div><div class=row>${pill(p.status)}<span class=views>${p.views.toLocaleString()} views</span></div></div></a><div class=listing-card-actions><button type=button class=save-listing-button data-save-listing data-listing-id="${esc(p.id)}" aria-pressed="false" hidden>Save listing</button></div><div class=rs><small>${my?'Your rating':'Current tenant? Rate this property'}</small><div>${[1,2,3,4,5].map(n=>`<button type=button data-r="${n}" class="${n<=my?'on':''}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}</div></div></div>`};
window.NL_DEMO_LISTINGS=D.map(listing=>({...listing}));window.NL_RENDER_LISTING_CARD=card;window.NL_SYNC_SAVED_LISTINGS=syncSavedListingButtons;
const NAV=[['index.html','Home'],['find.html','Find Accommodation'],['list.html','List Your Property'],['about.html','About Us']],pg=location.pathname.split('/').pop()||'index.html';
$('#hd').outerHTML=`<header><a class=logo href=index.html>MyKeja<span>Link</span></a><nav><div class=links id=lk>${L(NAV,x=>`<a href=${x[0]} class="${pg==x[0]?'on':''}">${x[1]}</a>`)}</div><button class="theme-toggle" id=themeToggle type=button aria-label="Switch to dark mode" aria-pressed=false title="Switch to dark mode"><span class=theme-toggle-icon aria-hidden=true>☾</span><span class=theme-toggle-label>Dark</span></button><a class="btn sm" id=authNav href=account.html>Login / Sign Up</a><button class=profile-trigger id=profileToggle type=button aria-expanded=false aria-controls=myProfilePanel hidden><span id=profileGreeting>Hi</span><span class=profile-avatar id=profileInitials>U</span></button><button class=bg id=bg type=button aria-label=Menu aria-expanded=false><span></span></button></nav></header><div class=profile-scrim id=profileScrim hidden></div><aside class=my-profile-panel id=myProfilePanel aria-hidden=true aria-labelledby=profileTitle inert><div class=profile-panel-head><div><p class=eyebrow>ACCOUNT</p><h2 id=profileTitle>My Profile</h2></div><button class=profile-close id=profileClose type=button aria-label="Close profile">×</button></div><div class=profile-card><span class=profile-avatar profile-avatar-large id=panelInitials>U</span><h3 id=profileName>User</h3><p id=profileEmail></p></div><button class="btn sm profile-dashboard" id=dashboardNav type=button hidden>Go to my dashboard</button><a class="btn sm profile-inbox" id=profileViewingRequestsNav href="viewing-requests.html" hidden>My viewing requests</a><a class="btn sm profile-inbox" id=profileInboxNav href="inbox.html" hidden>Admin inbox <span id=profileInboxUnread>0</span></a><button class="btn sm profile-logout" id=logoutNav type=button>Log out</button><div class=profile-account-actions id=profileAccountActions hidden><p>Deleting your account permanently removes your profile and associated MyKejaLink records.</p><button class="btn sm profile-delete-account" id=deleteAccountNav type=button>Delete my account</button></div></aside>`;
const authNav=$('#authNav'),profileToggle=$('#profileToggle'),dashboardNav=$('#dashboardNav'),logoutNav=$('#logoutNav'),deleteAccountNav=$('#deleteAccountNav'),profileInboxNav=$('#profileInboxNav'),profileViewingRequestsNav=$('#profileViewingRequestsNav'),profileAccountActions=$('#profileAccountActions'),profilePanel=$('#myProfilePanel'),profileScrim=$('#profileScrim');
const themeToggle=$('#themeToggle');
const syncThemeToggle=()=>{const dark=document.documentElement.dataset.theme==='dark';themeToggle.setAttribute('aria-pressed',String(dark));themeToggle.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');themeToggle.title=dark?'Switch to light mode':'Switch to dark mode';themeToggle.querySelector('.theme-toggle-icon').textContent=dark?'☀':'☾';themeToggle.querySelector('.theme-toggle-label').textContent=dark?'Light':'Dark'};
syncThemeToggle();
themeToggle.addEventListener('click',()=>{const nextTheme=document.documentElement.dataset.theme==='dark'?'light':'dark';userThemeOverride=true;document.documentElement.dataset.theme=nextTheme;try{localStorage.setItem(themeStorageKey,nextTheme)}catch{}syncThemeToggle()});
const closeProfile=()=>{profilePanel.classList.remove('open');profilePanel.setAttribute('aria-hidden','true');profilePanel.inert=true;profileToggle.setAttribute('aria-expanded','false');profileScrim.hidden=true};
const openProfile=()=>{profilePanel.classList.add('open');profilePanel.setAttribute('aria-hidden','false');profilePanel.inert=false;profileToggle.setAttribute('aria-expanded','true');profileScrim.hidden=false;$('#profileClose').focus()};
profileToggle.addEventListener('click',()=>profilePanel.classList.contains('open')?closeProfile():openProfile());
$('#profileClose').addEventListener('click',closeProfile);
profileScrim.addEventListener('click',closeProfile);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&profilePanel.classList.contains('open')){closeProfile();profileToggle.focus()}});
import('./supabase-client.js').then(async({supabase})=>{
  let profileLoadVersion=0;
  const updateAuthLink=async user=>{
    const version=++profileLoadVersion;
    if(!authNav)return;
    const fullName=user?.user_metadata?.full_name?.trim()||'';
    const name=fullName||user?.email||'';
    const initials=(fullName.split(/\s+/).filter(Boolean).length>1?fullName.split(/\s+/).filter(Boolean).map(part=>part[0]).slice(0,2).join(''):name.slice(0,2)).toUpperCase()||'U';
    authNav.style.display=user?'none':'';
    profileToggle.hidden=!user;
    dashboardNav.hidden=!user;
    $('#profileGreeting').textContent=name?`Hi, ${name.split(/[\s@]/)[0]}`:'Hi';
    $('#profileInitials').textContent=initials;
    $('#panelInitials').textContent=initials;
    $('#profileName').textContent=fullName||'My account';
    $('#profileEmail').textContent=user?.email||'';
    activeAccountId=user?.id||null;
    activeAccountRole=null;
    savedListingIds.clear();
    propertyRatingsById.clear();
    if(!user){closeProfile();syncSavedListingButtons();syncRatingControls();return}
    const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).maybeSingle();
    if(version!==profileLoadVersion)return;
    activeAccountRole=profile?.role||null;
    profileAccountActions.hidden=!['student','applicant','landlord','agent'].includes(activeAccountRole);
    profileInboxNav.hidden=!['student','applicant','landlord','agent'].includes(activeAccountRole);
    profileViewingRequestsNav.hidden=activeAccountRole!=='student';
    dashboardNav.textContent=activeAccountRole==='student'?'View saved listings':activeAccountRole==='applicant'?'View application inbox':'Go to my dashboard';
    if(activeAccountRole==='student'){
      const {data:savedRows,error}=await supabase.from('saved_listings').select('property_id').eq('student_id',user.id);
      if(!error&&(version===profileLoadVersion))savedRows?.forEach(row=>savedListingIds.add(row.property_id));
      const {data:ratings}=await supabase.from('property_ratings').select('property_id, rating').eq('student_id',user.id);
      if(version===profileLoadVersion)ratings?.forEach(row=>propertyRatingsById.set(row.property_id,Number(row.rating)));
    }
    if(!profileInboxNav.hidden){
      const {count}=await supabase.from('admin_messages').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null);
      if(version===profileLoadVersion)$('#profileInboxUnread').textContent=String(count||0);
    }
    syncSavedListingButtons();
    syncRatingControls();
  };
  const {data:{session}}=await supabase.auth.getSession();
  updateAuthLink(session?.user);
  supabase.auth.onAuthStateChange((_event,nextSession)=>updateAuthLink(nextSession?.user));
  dashboardNav.addEventListener('click',async()=>{
    dashboardNav.disabled=true;
    try{
      const {data:{session},error:sessionError}=await supabase.auth.getSession();
      if(sessionError)throw sessionError;
      if(!session){window.location.href='account.html?mode=login';return}
      const {data:profile,error}=await supabase.from('profiles').select('role,verification_status').eq('id',session.user.id).single();
      if(error||!profile)throw error||new Error('Could not load your account.');
      const destination=profile.role==='student'?'saved-listings.html':profile.role==='applicant'?'inbox.html':profile.role==='admin'?'admin-dashboard.html':profile.role==='landlord'?(profile.verification_status==='verified'?'landlord-dashboard.html':'account.html'):profile.role==='agent'?(profile.verification_status==='verified'?'agent-dashboard.html':'account.html'):'find.html';
      window.location.href=destination;
    }catch(error){
      dashboardNav.disabled=false;
      toast(error.message||'Could not open your dashboard. Please try again.');
    }
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-save-listing]');
    if(!button||activeAccountRole!=='student'||button.disabled)return;
    const propertyId=button.dataset.listingId,saved=savedListingIds.has(propertyId)||demoSavedIds().has(propertyId);
    button.disabled=true;
    try{
      if(isUuid(propertyId)){
        const result=saved
          ?await supabase.from('saved_listings').delete().eq('student_id',activeAccountId).eq('property_id',propertyId)
          :await supabase.from('saved_listings').insert({student_id:activeAccountId,property_id:propertyId});
        if(result.error)throw result.error;
        if(saved)savedListingIds.delete(propertyId);else savedListingIds.add(propertyId);
      }else{
        const key=`nl_saved_demo_listings_${activeAccountId}`,ids=demoSavedIds();
        if(saved)ids.delete(propertyId);else ids.add(propertyId);
        localStorage.setItem(key,JSON.stringify([...ids]));
      }
      syncSavedListingButtons();
      if(!saved){button.classList.remove('save-pop');void button.offsetWidth;button.classList.add('save-pop');window.setTimeout(()=>button.classList.remove('save-pop'),500)}
      window.dispatchEvent(new CustomEvent('mykejalink:saved-listings-changed'));
      toast(saved?'Listing removed from your saved listings.':'Listing saved for later.');
    }catch(error){toast(error.code==='42P01'?'Saved listings are not set up yet. Run supabase/saved_listings.sql.':error.message||'Could not update your saved listings.');}
    finally{button.disabled=false;}
  });
  document.addEventListener('click',async event=>{
    const button=event.target.closest('.rs button[data-r]');
    if(!button||button.disabled)return;
    const listingCard=button.closest('.card');
    const listingId=listingCard?.dataset.id;
    const rating=Number(button.dataset.r);
    if(!listingId||rating<1||rating>5)return;
    if(!confirm('Ratings are for people who currently live at this property. Do you currently live here?'))return;
    if(isUuid(listingId)){
      if(activeAccountRole!=='student'){
        toast('Log in with a student account to rate a live listing.');
        return;
      }
      if(propertyRatingsById.has(listingId)){
        toast('You have already rated this listing. Each student can rate it once.');
        syncRatingControls();
        return;
      }
      button.disabled=true;
      const {error}=await supabase.rpc('submit_property_rating',{p_property_id:listingId,p_rating:rating});
      if(error){
        button.disabled=false;
        toast(error.code==='42883'||error.code==='PGRST202'?'Listing ratings are not set up yet. Run supabase/property_ratings.sql in the Supabase SQL Editor.':error.code==='23505'?'You have already rated this listing. Each student can rate it once.':error.message||'Could not save your rating.');
        return;
      }
      propertyRatingsById.set(listingId,rating);
      const {data:summary}=await supabase.from('property_rating_summary').select('average_rating,rating_count').eq('property_id',listingId).maybeSingle();
      if(summary){
        const average=Number(summary.average_rating||0),count=Number(summary.rating_count||0);
        const display=listingCard.querySelector('.rn')?.parentElement;
        if(display)display.innerHTML=`<span class="stars">${'★'.repeat(Math.round(average))}${'☆'.repeat(5-Math.round(average))}</span> <b class="rn">${average}</b> <small>(${count} reviews)</small>`;
      }
      syncRatingControls();
      toast('Thanks! Your rating was saved and the listing owner was notified.');
      return;
    }
    const listing=D.find(item=>item.id===listingId);
    if(!listing)return;
    const ratings=RT();
    if(ratings[listingId]){toast('You have already rated this demo listing on this device.');return}
    ratings[listingId]=rating;
    localStorage.nl_rate=JSON.stringify(ratings);
    applyR();
    listingCard.outerHTML=card(listing);
    toast('Thanks! Your demo rating was saved on this device.');
  });
  const {data:universities,error:universityError}=await supabase.from('universities').select('name').eq('active',true).order('name');
  if(!universityError){
    const names=[...new Set((universities||[]).map(row=>String(row.name||'').trim()).filter(Boolean))];
    UNI.splice(0,UNI.length,...names);
    document.querySelectorAll('select[data-o="uni"]').forEach(select=>{
      while(select.options.length>1)select.remove(1);
      names.forEach(name=>select.add(new Option(name,name)));
    });
    const pins=document.getElementById('pins');
    if(pins)pins.innerHTML=L(UNI,u=>`<button type=button data-u="${esc(u)}">${esc(u)}</button>`);
    const institutionCards=document.getElementById('inst');
    if(institutionCards)institutionCards.innerHTML=L(UNI,u=>`<a class=cat href="find.html?uni=${encodeURIComponent(u)}"><b>${esc(u)}</b><small>${D.filter(p=>p.uni===u).length} listings</small></a>`);
  }
  logoutNav.addEventListener('click',async()=>{
    logoutNav.disabled=true;
    try{
      const {error}=await supabase.auth.signOut();
      if(error)throw error;
      localStorage.removeItem('nl_user');
      window.location.replace('index.html');
    }catch(error){
      logoutNav.disabled=false;
      toast('Could not log out. Please try again.');
    }
  });
  deleteAccountNav.addEventListener('click',async()=>{
    if(!['student','applicant','landlord','agent'].includes(activeAccountRole)||deleteAccountNav.disabled)return;
    const confirmation=prompt('This permanently deletes your account and associated listings, saved listings and verification records. Type DELETE to continue.');
    if(confirmation!=='DELETE')return;
    deleteAccountNav.disabled=true;
    deleteAccountNav.textContent='Deleting account…';
    try{
      const {error}=await supabase.rpc('delete_own_account');
      if(error)throw error;
      localStorage.removeItem('nl_user');
      savedListingIds.clear();
      activeAccountRole=null;
      activeAccountId=null;
      await supabase.auth.signOut({scope:'local'});
      window.location.replace('index.html?account=deleted');
    }catch(error){
      deleteAccountNav.disabled=false;
      deleteAccountNav.textContent='Delete my account';
      toast(error.code==='42883'||error.code==='PGRST202'?'Account deletion is not set up yet. Run supabase/delete_own_account.sql in the Supabase SQL Editor.':error.message||'Could not delete your account. Please try again.');
    }
  });
}).catch(()=>{});
const bg=$('#bg'),lk=$('#lk'),shut=()=>{lk.classList.remove('open');bg.classList.remove('open');bg.setAttribute('aria-expanded',false)};
bg.onclick=()=>{const o=lk.classList.toggle('open');bg.classList.toggle('open',o);bg.setAttribute('aria-expanded',o)};lk.onclick=e=>{if(e.target.closest('a'))shut()};addEventListener('resize',shut);
$('#ft').innerHTML='© MyKejaLink · <a href=contact.html>Contact &amp; support</a> · <a href=safety.html>Safety &amp; scam prevention</a>';
document.querySelectorAll('[data-home-nav]').forEach(button=>button.addEventListener('click',()=>window.location.assign('index.html')));
document.querySelectorAll('select[data-o]').forEach(s=>s.insertAdjacentHTML('beforeend',L(O[s.dataset.o],o=>`<option>${o}</option>`)));
/* Shared left filter sidebar (used by index.html and find.html) */
const SBH=`<h4>Search</h4><input name=area placeholder="Town or neighbourhood"><h4>Filters</h4><select name=uni data-o=uni><option value="">Any institution</option></select><select name=type data-o=type><option value="">Any type</option></select><div class=r2><input name=min type=number placeholder="Min rent"><input name=max type=number placeholder="Max rent"></div><select name=furn><option value="">Furnished or not</option><option value=1>Furnished</option><option value=0>Unfurnished</option></select><select name=rate><option value="">Any rating</option><option value=4>4★ and up</option><option value=4.5>4.5★ and up</option></select><select name=sort><option value=new>Recently added</option><option value=price>Price: low to high</option><option value=dist>Nearest to campus</option><option value=rate>Top rated</option></select><h4>Facilities</h4><div class=chips><label><input type=checkbox name=wifi> Wi-Fi</label><label><input type=checkbox name=water> Water</label><label><input type=checkbox name=sec> Security</label><label><input type=checkbox name=bills> Bills included</label><label><input type=checkbox name=now> Available now</label></div><button type=reset class="btn ghost">Clear filters</button><h4>Pinned institution</h4><div class=pins id=pins></div>`;
function mountSB(go){const f=$('#f');f.innerHTML=SBH;f.querySelectorAll('select[data-o]').forEach(s=>s.insertAdjacentHTML('beforeend',L(O[s.dataset.o],o=>`<option>${o}</option>`)));
$('#pins').innerHTML=L(UNI,u=>`<button type=button data-u="${esc(u)}">${esc(u)}</button>`);
$('#pins').onclick=e=>{const u=e.target.dataset.u;if(u){f.uni.value=f.uni.value==u?'':u;go()}};
for(const [k,v] of new URLSearchParams(location.search))if(f[k])f[k].value=v;
f.oninput=go;f.onreset=()=>setTimeout(go);return f}
function filt(f){const d=new FormData(f),g=k=>d.get(k),c=k=>d.has(k),a=(g('area')||'').toLowerCase(),s=g('sort');
document.querySelectorAll('#pins button').forEach(b=>b.classList.toggle('on',b.dataset.u==g('uni')));
return D.filter(p=>(!g('uni')||p.uni==g('uni'))&&(!a||(p.area+' '+p.name).toLowerCase().includes(a))&&(!g('min')||p.rent>=+g('min'))&&(!g('max')||p.rent<=+g('max'))&&(!g('type')||p.type==g('type'))&&(g('furn')===''||+g('furn')==p.furn)&&(!g('rate')||p.rate>=+g('rate'))&&(!c('wifi')||p.wifi)&&(!c('water')||p.water)&&(!c('sec')||p.sec)&&(!c('bills')||p.bills)&&(!c('now')||p.status!='Fully booked')).sort((x,y)=>s=='price'?x.rent-y.rent:s=='dist'?x.dist-y.dist:s=='rate'?y.rate-x.rate:x.n-y.n)}
 
/* Tenant star ratings (stored in this browser only: demo). Base demo values are kept in r0/n0. */
D.forEach(p=>{p.r0=p.rate;p.n0=p.rev});
const RT=localListingRatings;
const applyR=()=>{const m=RT();D.forEach(p=>{if(isUuid(p.id))return;const v=m[p.id];p.rate=v?+((p.r0*p.n0+v)/(p.n0+1)).toFixed(1):p.r0;p.rev=v?p.n0+1:p.n0})};applyR();
