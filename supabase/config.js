window.KMB_SUPABASE_CONFIG={
  url:"https://yoviojbfyvgpllxisjvy.supabase.co",
  publishableKey:"sb_publishable_I26enb2Kz8iF4WFdH8vixA_8kek-kM9"
};

// KMB live UI refresh: every successful local mutation immediately refreshes
// Dashboard, resume recruitment, jobsite tables, MP, units, and access UI.
(function(){
  const isKmb=location.pathname.includes("monitoring-manpower-kmb")||location.pathname.includes("monitoring-kmb");
  if(!isKmb)return;

  function refreshKmbViews(){
    try{
      if(typeof renderDashboard==="function")renderDashboard();
      if(typeof data!=="undefined"&&data?.sites&&typeof renderSite==="function"){
        Object.keys(data.sites).forEach(key=>{
          if(document.getElementById("table_"+id(key)))renderSite(key);
        });
      }
      if(typeof renderMP==="function"&&document.getElementById("mpTable"))renderMP();
      if(typeof renderUnits==="function"&&document.getElementById("unitTables"))renderUnits();
      if(typeof renderSettings==="function"&&document.getElementById("settingsContent"))renderSettings();
      if(typeof applyAccessMode==="function")applyAccessMode();
    }catch(err){console.error("KMB auto refresh failed",err)}
  }

  document.addEventListener("DOMContentLoaded",()=>{
    // app-integration.js has already wrapped saveData by this point.
    const currentSave=window.saveData;
    if(typeof currentSave==="function"&&!currentSave.__kmbAutoRefreshWrapped){
      const wrapped=function(){
        const result=currentSave.apply(this,arguments);
        refreshKmbViews();
        requestAnimationFrame(refreshKmbViews);
        setTimeout(refreshKmbViews,120);
        window.dispatchEvent(new CustomEvent("kmb:data-changed"));
        return result;
      };
      wrapped.__kmbAutoRefreshWrapped=true;
      window.saveData=wrapped;
    }

    // Fallback for modal save paths that may hold the original function binding.
    const saveBtn=document.getElementById("saveModal");
    if(saveBtn){
      saveBtn.addEventListener("click",()=>{
        setTimeout(refreshKmbViews,0);
        setTimeout(refreshKmbViews,120);
        setTimeout(refreshKmbViews,400);
      },true);
    }

    window.addEventListener("kmb:data-changed",refreshKmbViews);
  });
})();
