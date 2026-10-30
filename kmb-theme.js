/* Tema bersama KMB Monitoring: menambahkan footer pita di setiap portal. */
(function(){
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
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",addFoot); else addFoot();
})();
