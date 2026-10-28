-- Daftarkan app "rekrutmen" (Web Monitoring Rekrutmen) ke sistem undangan & izin portal.
create or replace function public.kta_app_ok(p_app text)
 returns boolean language sql immutable set search_path to 'public' as $function$
  select p_app in ('kta-tra','bupr-ampah','mbj','kmb','apd','unit-monitoring','notulensi','rekrutmen');
$function$;

create or replace function public.kta_my_apps()
 returns table(app_id text, role text) language sql stable security definer set search_path to 'public' as $function$
  select x.a, public.kta_member_role(x.a) from unnest(array['kta-tra','bupr-ampah','mbj','kmb','apd','unit-monitoring','notulensi','rekrutmen']) x(a)
  where public.kta_member_role(x.a) <> '';
$function$;
