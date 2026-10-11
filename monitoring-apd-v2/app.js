'use strict';
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
el('mobileMenu').onclick=()=>el('sidebar').classList.toggle('open');
el('authBtn').onclick=()=>user?logout():login();
el('refreshBtn').onclick=()=>loadAll();
el('modalClose').onclick=()=>closeModal();
el('modalBack').onclick=e=>{if(e.target===el('modalBack'))closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('input',e=>{
 if(e.target.id==='searchPerson'){
  const focus=e.target,at=focus.selectionStart;
  term=focus.value;render();const inp=el('searchPerson');
  if(inp){inp.focus();inp.setSelectionRange(at,at)}
 }
});
document.addEventListener('change',e=>{if(e.target.id==='filterSite'){siteFilter=e.target.value;render()}});
init();
