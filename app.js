const PR=[{no:"101",barang:"Kunci ring pas ukurang 10",jobsite:"KTA - TRA",qty:"10 PCS",status:"CLOSE",priority:"NORMAL",month:"September 2026"}];
function render(){
 const period=document.querySelector("#period").value,site=document.querySelector("#site").value,status=document.querySelector("#status").value,priority=document.querySelector("#priority").value,q=document.querySelector("#q").value.toLowerCase();
 const d=PR.filter(x=>(period==="Semua periode"||x.month===period)&&(site==="Semua jobsite"||x.jobsite===site)&&(status==="Semua status"||x.status===status)&&(priority==="Semua prioritas"||x.priority===priority)&&(!q||Object.values(x).join(" ").toLowerCase().includes(q)));
 document.querySelector("#total").textContent=d.length;
 document.querySelector("#opened").textContent=d.filter(x=>x.status==="OPEN").length;
 document.querySelector("#closed").textContent=d.filter(x=>x.status==="CLOSE").length;
 document.querySelector("#rate").textContent=(d.length?Math.round(d.filter(x=>x.status==="CLOSE").length/d.length*100):0)+"%";
 document.querySelector("#tbody").innerHTML=d.map(x=>"<tr><td>#"+x.no+"</td><td>"+x.barang+"</td><td>"+x.jobsite+"</td><td>"+x.qty+"</td><td>"+x.status+"</td></tr>").join("");
}
document.querySelectorAll("select,#q").forEach(x=>x.addEventListener("input",render));render();