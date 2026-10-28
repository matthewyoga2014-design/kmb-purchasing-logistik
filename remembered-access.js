/* Restore only previously verified, revocable access links on this browser. */
(function(){
  'use strict';
  const KEY='kmb-shared-access-v1', LAST='kmb-portal-last-shared-link';
  const SEGMENTS={
    'manpower-kta-tra':'kta-tra','manpower-bupr':'bupr-ampah',
    'manpower-mbj':'mbj','manpower-kmb':'kmb',
    'monitoring-apd-kmb':'apd','monitoring-unit':'unit-monitoring','notulensi':'notulensi','rekrutmen':'rekrutmen'
  };
  const parts=location.pathname.split('/').filter(Boolean);
  const app=parts.map(s=>SEGMENTS[s]).find(Boolean);
  const valid=t=>typeof t==='string'&&/^[a-f0-9]{48}$/.test(t);
  function remembered(){
    try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){return{}}
  }
  function hasIdentitySession(){
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(key!=='kta-web-auth'&&!/^sb-[a-z0-9]+-auth-token$/.test(key||''))continue;
        const raw=localStorage.getItem(key);
        const obj=raw&&JSON.parse(raw);
        if(obj&&(obj.access_token||(obj.currentSession&&obj.currentSession.access_token)))return true;
      }
    }catch(e){}
    return false;
  }
  function remember(appId,token,role){
    if(!Object.values(SEGMENTS).includes(appId)||!valid(token)||!['editor','viewer'].includes(role))return;
    try{
      const mapped=remembered();
      mapped[appId]={token,role};
      localStorage.setItem(KEY,JSON.stringify(mapped));
      localStorage.setItem(LAST,Object.values(mapped).filter(v=>v&&valid(v.token)).map(v=>v.token).join('.'));
    }catch(e){}
  }
  window.KMBRememberedAccess={remember};
  if(!app||hasIdentitySession())return;
  const url=new URL(location.href);
  if(url.searchParams.has('share')||url.searchParams.has('i')||url.searchParams.has('k'))return;
  const item=remembered()[app];
  if(!item||!valid(item.token))return;
  url.searchParams.set('share',item.token);
  location.replace(url.href);
})();