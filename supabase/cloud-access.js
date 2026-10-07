/* One-link Supabase access layer for Monitoring Manpower KMB + KTA-TRA.
   This file is intentionally not loaded by the live apps until a Supabase project
   URL + publishable key have been provisioned. */
(function(global){
  "use strict";

  const SENSITIVE_FIELDS=new Set([
    "NIP (KARYAWAN)","NIK KTP","NO.KK","NO. NPWP","Nomor HP","Whatsapp",
    "Alamat Domisili","Alamat Lengkap","No Rekening","Nama Bank","Nama Pemilik Rekening",
    "Nomor BPJS Kesehatan","Nomor BPJS Ketenagakerjaan","Nama Ibu","Pendidikan Terakhir Ibu",
    "Pekerjaan Ibu","Nama Ayah","Pendidikan Terakhir Ayah","Pekerjaan Ayah",
    "Saudara Kandung (1)","Jenis Kelamin (1)","Tanggal Lahir (1)",
    "Saudara Kandung (2)","Jenis Kelamin (2)","Tanggal Lahir (2)",
    "Saudara Kandung (3)","Jenis Kelamin (3)","Tanggal Lahir (3)",
    "Saudara Kandung (4)","Jenis Kelamin (4)","Tanggal Lahir (4)",
    "Nama Emergency","Hubungan","Nomor Telepon","Whatsapp Emergency"
  ]);

  const clone=v=>JSON.parse(JSON.stringify(v??{}));
  const cleanRecord=row=>{
    const out={};
    Object.entries(row||{}).forEach(([k,v])=>{if(!SENSITIVE_FIELDS.has(k))out[k]=v});
    return out;
  };
  function deepSanitize(value){
    if(Array.isArray(value))return value.map(deepSanitize);
    if(value&&typeof value==="object"){
      const out={};
      Object.entries(value).forEach(([k,v])=>{
        if(!SENSITIVE_FIELDS.has(k))out[k]=deepSanitize(v);
      });
      return out;
    }
    return value;
  }
  function sanitizeState(state){
    return deepSanitize(clone(state));
  }

  let sb=null, appId="", role="viewer", session=null, opts={};

  async function init(options){
    opts=options||{};
    appId=opts.appId;
    const cfg=global.KMB_SUPABASE_CONFIG;
    if(!cfg?.url||!cfg?.publishableKey||!global.supabase?.createClient){
      return {enabled:false,role:"viewer",reason:"missing-config"};
    }
    sb=global.supabase.createClient(cfg.url,cfg.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    const {data:{session:s}}=await sb.auth.getSession();
    session=s;
    await refreshRole();
    if(opts.onRoleChange)opts.onRoleChange(role,session?.user||null);
    sb.auth.onAuthStateChange(async (_event,next)=>{
      session=next;
      await refreshRole();
      if(opts.onRoleChange)opts.onRoleChange(role,session?.user||null);
    });
    return {enabled:true,role,user:session?.user||null};
  }

  async function refreshRole(){
    if(!sb||!session){role="viewer";return role}
    const email=String(session.user?.email||"").trim().toLowerCase();
    if(!email){role="viewer";return role}
    const {data,error}=await sb.from("app_access_roles").select("role").eq("app_id",appId).eq("email",email).maybeSingle();
    role=error?"viewer":(data?.role||"viewer");
    return role;
  }

  function canEdit(){return role==="owner"||role==="editor"}
  function isOwner(){return role==="owner"}

  async function signIn(email){
    if(!sb)throw new Error("Supabase belum dikonfigurasi.");
    const redirectTo=location.origin+location.pathname;
    const {error}=await sb.auth.signInWithOtp({
      email:String(email||"").trim().toLowerCase(),
      options:{emailRedirectTo:redirectTo,shouldCreateUser:true}
    });
    if(error)throw error;
    return true;
  }

  async function signInPassword(email,password){
    if(!sb)throw new Error("Supabase belum dikonfigurasi.");
    const {data,error}=await sb.auth.signInWithPassword({
      email:String(email||"").trim().toLowerCase(),
      password:String(password||"")
    });
    if(error)throw error;
    session=data.session;
    await refreshRole();
    if(opts.onRoleChange)opts.onRoleChange(role,session?.user||null);
    return {role,user:session?.user||null};
  }

  async function signUpPassword(email,password){
    if(!sb)throw new Error("Supabase belum dikonfigurasi.");
    const {data,error}=await sb.auth.signUp({
      email:String(email||"").trim().toLowerCase(),
      password:String(password||"")
    });
    if(error)throw error;
    session=data.session;
    if(session){
      await refreshRole();
      if(opts.onRoleChange)opts.onRoleChange(role,session?.user||null);
    }
    return {session,user:data.user||null};
  }

  async function signOut(){
    if(!sb)return;
    const {error}=await sb.auth.signOut();
    if(error)throw error;
    role="viewer";session=null;
    if(opts.onRoleChange)opts.onRoleChange(role,null);
  }

  async function loadState(){
    if(!sb)return null;
    const table=canEdit()?"app_state_private":"app_state_public";
    const {data,error}=await sb.from(table).select("data,updated_at,updated_by").eq("app_id",appId).maybeSingle();
    if(error)throw error;
    return data;
  }

  async function saveState(state){
    if(!sb||!canEdit())throw new Error("Akses hanya lihat.");
    const email=session?.user?.email||null;
    const full={app_id:appId,data:clone(state),updated_at:new Date().toISOString(),updated_by:email};
    const pub={app_id:appId,data:sanitizeState(state),updated_at:new Date().toISOString(),updated_by:email};
    const [a,b]=await Promise.all([
      sb.from("app_state_private").upsert(full,{onConflict:"app_id"}),
      sb.from("app_state_public").upsert(pub,{onConflict:"app_id"})
    ]);
    if(a.error)throw a.error;
    if(b.error)throw b.error;
    return true;
  }

  async function listEditors(){
    if(!sb||!isOwner())return [];
    const {data,error}=await sb.from("app_access_roles").select("email,role,created_at,updated_at").eq("app_id",appId).eq("role","editor").order("email");
    if(error)throw error;
    return data||[];
  }

  async function addEditor(email){
    if(!sb||!isOwner())throw new Error("Hanya Pemilik yang dapat mengatur Editor.");
    const clean=String(email||"").trim().toLowerCase();
    const {error}=await sb.from("app_access_roles").upsert({app_id:appId,email:clean,role:"editor",updated_at:new Date().toISOString()},{onConflict:"app_id,email"});
    if(error)throw error;
  }

  async function removeEditor(email){
    if(!sb||!isOwner())throw new Error("Hanya Pemilik yang dapat mengatur Editor.");
    const {error}=await sb.from("app_access_roles").delete().eq("app_id",appId).eq("email",String(email||"").trim().toLowerCase()).eq("role","editor");
    if(error)throw error;
  }

  function subscribe(onChange){
    if(!sb)return ()=>{};
    const table=canEdit()?"app_state_private":"app_state_public";
    const channel=sb.channel("state-"+appId+"-"+table)
      .on("postgres_changes",{event:"*",schema:"public",table,filter:"app_id=eq."+appId},payload=>{
        const next=payload.new?.data;
        if(next&&onChange)onChange(next,payload);
      }).subscribe();
    return ()=>sb.removeChannel(channel);
  }

  global.KMBCloud={init,refreshRole,canEdit,isOwner,signIn,signInPassword,signUpPassword,signOut,loadState,saveState,listEditors,addEditor,removeEditor,subscribe,sanitizeState,get role(){return role},get user(){return session?.user||null}};
})(window);
