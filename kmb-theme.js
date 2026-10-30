/* Tema bersama KMB Monitoring.
   1) Header: elemen setelah judul dipindah ke dalam pita biru tua di kanan
      (node dipindah apa adanya, jadi tombol & fungsinya tetap bekerja).
   2) Footer pita di bawah halaman. */
(function(){
  function slab(){
    document.querySelectorAll("header.top").forEach(function(h){
      if(h.querySelector(":scope > .kt-slab")) return;
      var kids=Array.prototype.slice.call(h.children);
      var idx=-1;
      kids.forEach(function(e,i){ if(idx<0 && e.matches(".brand,.bn,.ttl")) idx=i; });
      if(idx<0) return;
      var rest=kids.slice(idx+1).filter(function(e){ return !e.matches("script,style,template"); });
      if(!rest.length) return;
      var s=document.createElement("div"); s.className="kt-slab";
      h.insertBefore(s,rest[0]);
      rest.forEach(function(e){ s.appendChild(e); });
      h.classList.add("kt-hd");
    });
  }
  function addFoot(){
    if(document.querySelector(".kmb-foot")) return;
    var main=document.querySelector("main");
    var f=document.createElement("footer");
    f.className="kmb-foot";
    var t=document.createElement("span");
    t.textContent=(document.title||"Monitoring").split(" - ")[0];
    var b=document.createElement("span");
    b.innerHTML="Monitoring &middot; <b>PT KMB</b>";
    f.appendChild(t); f.appendChild(b);
    if(main&&main.parentNode) main.parentNode.insertBefore(f,main.nextSibling); else document.body.appendChild(f);
  }
  function run(){ try{ slab(); }catch(e){} try{ addFoot(); }catch(e){} }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",run); else run();
})();
