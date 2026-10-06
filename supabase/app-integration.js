(function(){
  "use strict";

  const isKta=location.pathname.includes("monitoring-kta-tra");
  const appId=isKta?"kta-tra":"kmb";
  const localStateKey=isKta?"kta_tra_monitoring_v1":"kmb_monitoring_web_v1";
  const hadLocalBeforeCloud=!!localStorage.getItem(localStateKey);
  let cloudRole="viewer", cloudUser=null, cloudEditors=[], cloudUnsub=null, applyingRemote=false;

  window.accessMode=function(){return cloudRole||"viewer"};
  window.isEditorMode=function(){return cloudRole==="editor"};
  window.isViewerMode=function(){return cloudRole==="viewer"};
  window.isRestrictedMode=function(){return cloudRole!=="owner"};
  window.ownerOnly=function(){
    if(cloudRole==="owner")return true;
    alert("Pengaturan hanya dapat diakses Pemilik / Administrator.");
    if(typeof goDashboard==="function")goDashboard();
    return false;
  };
  window.editOnly=function(){
    if(cloudRole==="owner"||cloudRole==="editor")return true;
    alert("Akses Pelihat hanya dapat melihat data. Masuk menggunakan email Editor untuk mengubah data.");
    return false;
  };

  function roleLabel(){
    if(cloudRole==="owner")return "Pemilik";
    if(cloudRole==="editor")return "Editor";
    return "Pelihat";
  }

  function updateAuthUI(){
    const badge=document.getElementById("accessBadge");
    if(badge){badge.textContent=roleLabel();badge.className="access-badge role-"+cloudRole}
    const btn=document.getElementById("authBtn");
    if(btn){
      if(cloudUser){
        btn.textContent="Keluar";
        btn.onclick=cloudLogout;
        btn.title=(cloudUser.email||"")+" • "+roleLabel();
      }else{
        btn.textContent="Masuk untuk Edit";
        btn.onclick=openAuthModal;
        btn.title="Pemilik / Editor masuk di sini";
      }
    }
    const who=document.getElementById("authWho");
    if(who)who.textContent=cloudUser?.email||"";
  }

  window.applyAccessMode=function(){
    const settingsNav=document.querySelector('.nav[data-view="settings"]');
    if(settingsNav)settingsNav.style.display=cloudRole==="owner"?"":"none";
    document.body.classList.toggle("editor-mode",cloudRole==="editor");
    document.body.classList.toggle("viewer-mode",cloudRole==="viewer");
    const title=document.querySelector(".app-name");
    const base=isKta?"Monitoring Manpower KTA - TRA":"Monitoring Manpower KMB";
    if(title)title.textContent=base+(cloudRole==="editor"?" • EDITOR":cloudRole==="viewer"?" • PELIHAT":"");
    updateAuthUI();
    if(typeof applyReadOnlyUI==="function")applyReadOnlyUI();
  };

  window.getEditors=function(){return cloudEditors.map(x=>x.email||x)};
  window.getViewers=function(){return []};
  window.addViewer=function(){alert("Tidak perlu mendaftarkan Pelihat. Semua pengguna yang tidak terdaftar sebagai Editor otomatis menjadi Pelihat.")};
  window.removeViewer=function(){};

  async function refreshEditors(){
    if(!window.KMBCloud?.isOwner?.()){cloudEditors=[];return}
    try{cloudEditors=await window.KMBCloud.listEditors()}catch(e){console.error(e);cloudEditors=[]}
  }

  window.addEditor=async function(){
    if(!ownerOnly())return;
    const email=(prompt("Masukkan email Editor:")||"").trim().toLowerCase();
    if(!email)return;
    if(!/^\S+@\S+\.\S+$/.test(email)){alert("Format email tidak valid.");return}
    try{
      await window.KMBCloud.addEditor(email);
      await refreshEditors();
      if(typeof renderSettings==="function")renderSettings();
      alert(email+" sekarang terdaftar sebagai Editor.");
    }catch(e){alert("Gagal menambahkan Editor: "+(e.message||e))}
  };

  window.removeEditor=async function(i){
    if(!ownerOnly())return;
    const email=cloudEditors[i]?.email||cloudEditors[i];
    if(!email)return;
    if(!confirm("Hapus akses Editor "+email+"?"))return;
    try{
      await window.KMBCloud.removeEditor(email);
      await refreshEditors();
      if(typeof renderSettings==="function")renderSettings();
    }catch(e){alert("Gagal menghapus Editor: "+(e.message||e))}
  };

  window.openAuthModal=function(){
    const m=document.getElementById("authModal");if(!m)return;
    m.classList.add("show");
    const email=document.getElementById("authEmail");if(email)setTimeout(()=>email.focus(),30);
  };
  window.closeAuthModal=function(){document.getElementById("authModal")?.classList.remove("show")};

  window.cloudLoginPassword=async function(){
    const email=(document.getElementById("authEmail")?.value||"").trim().toLowerCase();
    const password=document.getElementById("authPassword")?.value||"";
    if(!email||!password){alert("Isi email dan password.");return}
    try{
      await window.KMBCloud.signInPassword(email,password);
      closeAuthModal();
    }catch(e){alert("Login gagal: "+(e.message||e))}
  };

  window.cloudSignupPassword=async function(){
    const email=(document.getElementById("authEmail")?.value||"").trim().toLowerCase();
    const password=document.getElementById("authPassword")?.value||"";
    if(!email||password.length<8){alert("Isi email dan password minimal 8 karakter.");return}
    try{
      const r=await window.KMBCloud.signUpPassword(email,password);
      if(r.session){
        closeAuthModal();
        alert("Akun berhasil dibuat dan sudah masuk.");
      }else{
        alert("Akun dibuat. Cek email untuk konfirmasi, lalu kembali ke web dan pilih Masuk.");
      }
    }catch(e){alert("Pendaftaran gagal: "+(e.message||e))}
  };

  window.cloudSendMagicLink=async function(){
    const email=(document.getElementById("authEmail")?.value||"").trim().toLowerCase();
    if(!email){alert("Isi email terlebih dahulu.");return}
    try{
      await window.KMBCloud.signIn(email);
      alert("Link masuk sudah dikirim ke "+email+".");
    }catch(e){alert("Gagal mengirim link: "+(e.message||e))}
  };

  window.cloudLogout=async function(){
    try{await window.KMBCloud.signOut()}catch(e){alert("Gagal keluar: "+(e.message||e))}
  };

  function hasRemoteData(row){
    const d=row?.data;
    return d&&typeof d==="object"&&!Array.isArray(d)&&Object.keys(d).length>0;
  }

  function persistRemoteLocally(next){
    applyingRemote=true;
    try{
      data=JSON.parse(JSON.stringify(next));
      if(isKta){
        if(typeof ensureCandidateData==="function")ensureCandidateData(data);
        if(typeof ensureKtaRuntime==="function")ensureKtaRuntime();
        if(typeof renumberKtaAll==="function")renumberKtaAll();
        if(typeof STORAGE_KEY!=="undefined")localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      }else{
        if(typeof normalizeAllMP==="function")normalizeAllMP();
        if(typeof ensureRuntimeData==="function")ensureRuntimeData();
        if(typeof renumberAll==="function")renumberAll();
        if(typeof KEY!=="undefined")localStorage.setItem(KEY,JSON.stringify(data));
      }
    }finally{applyingRemote=false}
  }

  function renderAll(){
    if(isKta){
      if(typeof renderDashboard==="function")renderDashboard();
      if(typeof renderMPP==="function")renderMPP();
      if(typeof renderMP==="function")renderMP();
      if(typeof renderUnits==="function")renderUnits();
      if(typeof renderSettings==="function")renderSettings();
    }else{
      if(typeof makeSiteViews==="function")makeSiteViews();
      if(typeof renderDashboard==="function")renderDashboard();
      if(typeof renderUnits==="function")renderUnits();
      if(typeof renderMP==="function")renderMP();
      if(typeof renderSettings==="function")renderSettings();
    }
    applyAccessMode();
  }

  async function syncFromCloud(){
    if(!window.KMBCloud)return;
    try{
      const row=await window.KMBCloud.loadState();
      const initialSeed=row?.updated_by==="initial-seed";
      if(hasRemoteData(row)){
        if(initialSeed&&hadLocalBeforeCloud&&window.KMBCloud.isOwner?.()){
          await window.KMBCloud.saveState(data);
        }else if(!(initialSeed&&hadLocalBeforeCloud&&cloudRole==="viewer")){
          persistRemoteLocally(row.data);
        }
      }else if(window.KMBCloud.isOwner?.()){
        await window.KMBCloud.saveState(data);
      }
    }catch(e){console.error("Cloud load failed",e)}
    renderAll();
  }

  const originalSave=window.saveData;
  if(typeof originalSave==="function"){
    window.saveData=function(){
      originalSave.apply(this,arguments);
      if(!applyingRemote&&window.KMBCloud?.canEdit?.()){
        window.KMBCloud.saveState(data).catch(e=>console.error("Cloud save failed",e));
      }
    };
  }

  async function init(){
    if(!window.KMBCloud){
      cloudRole="viewer";cloudUser=null;applyAccessMode();return;
    }
    try{
      await window.KMBCloud.init({
        appId,
        onRoleChange:async(role,user)=>{
          cloudRole=role||"viewer";cloudUser=user||null;
          await refreshEditors();
          applyAccessMode();
          await syncFromCloud();
          if(cloudUnsub){try{cloudUnsub()}catch(e){} cloudUnsub=null}
          cloudUnsub=window.KMBCloud.subscribe(next=>{
            if(next){persistRemoteLocally(next);renderAll()}
          });
        }
      });
      cloudRole=window.KMBCloud.role||"viewer";
      cloudUser=window.KMBCloud.user||null;
      await refreshEditors();
      await syncFromCloud();
      if(cloudUnsub){try{cloudUnsub()}catch(e){}}
      cloudUnsub=window.KMBCloud.subscribe(next=>{
        if(next){persistRemoteLocally(next);renderAll()}
      });
      applyAccessMode();
    }catch(e){
      console.error("Cloud init failed",e);
      cloudRole="viewer";cloudUser=null;applyAccessMode();
    }
  }

  document.addEventListener("DOMContentLoaded",()=>{
    const close=document.getElementById("closeAuthModal");if(close)close.onclick=closeAuthModal;
    init();
  });
})();