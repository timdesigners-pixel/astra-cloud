/** Requires @electric-sql/pglite (test-only). No production credentials or data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const modulePath = process.env.PGLITE_MODULE || '@electric-sql/pglite';
const { PGlite } = await import(modulePath);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema private; create schema extensions;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function private.alan_anahtari() returns text language sql as $$select 'synthetic-test-key'::text$$;
  create function extensions.hmac(text,text,text) returns bytea language sql as $$select decode(md5($1||$2||$3),'hex')$$;
  create table public.borclar(id uuid primary key default gen_random_uuid(), sahip_id uuid, ad text not null, tur text not null,
    anapara numeric check(anapara>=0), guncel_borc numeric, faiz_orani numeric, notlar text);
  create table public.icra_dosyalari(id uuid primary key default gen_random_uuid(), sahip_id uuid, dosya_no_hash text, icra_dairesi text, guncel_toplam_borc numeric);
  create table public.davalar(id uuid primary key default gen_random_uuid(), sahip_id uuid, dosya_no_hash text, mahkeme text, tur text);
  create table public.gelirler(id uuid primary key default gen_random_uuid(), sahip_id uuid, ad text, tur text, tutar numeric check(tutar>=0), gun smallint check(gun between 1 and 31), baslangic date, bitis date, notlar text);
  create table public.giderler(id uuid primary key default gen_random_uuid(), sahip_id uuid, ad text, tur text, tutar numeric check(tutar>=0), gun smallint check(gun between 1 and 31), notlar text);
  create table public.zihin_sayfalari(id uuid primary key default gen_random_uuid(), sahip_id uuid, baslik text, alan text, kategori text, icerik text, etiketler text[]);
  create table public.test_archive(owner_id uuid, app text, key text, value text, unique(owner_id,app,key));
  create function public.icra_kaydet(uuid,int,text,jsonb) returns jsonb language plpgsql as $$
  declare result_id uuid;
  begin insert into public.icra_dosyalari(sahip_id,dosya_no_hash,icra_dairesi,guncel_toplam_borc)
    values(auth.uid(),encode(extensions.hmac(upper(btrim($3)),private.alan_anahtari(),'sha256'),'hex'),$4->>'icra_dairesi',($4->>'guncel_toplam_borc')::numeric) returning id into result_id;
    return jsonb_build_object('id',result_id); end $$;
  create function public.dava_kaydet(uuid,int,text,text,jsonb) returns jsonb language plpgsql as $$
  declare result_id uuid;
  begin insert into public.davalar(sahip_id,dosya_no_hash,mahkeme,tur)
    values(auth.uid(),encode(extensions.hmac($3 || '|' || coalesce(nullif(btrim($5->>'mahkeme'),''),'') || '|' || upper(btrim($4)),private.alan_anahtari(),'sha256'),'hex'),$5->>'mahkeme',$3) returning id into result_id;
    return jsonb_build_object('id',result_id); end $$;
  create function public.uygulama_durumu_yaz(text,text,text) returns void language sql as $$
    insert into public.test_archive values(auth.uid(),$1,$2,$3) on conflict(owner_id,app,key) do nothing $$;
`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/0028_astra_os_aktarim.sql',import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/migrations/0029_astra_dava_kimligi.sql',import.meta.url),'utf8'));
const owner1='00000000-0000-4000-8000-000000000001',owner2='00000000-0000-4000-8000-000000000002';
await db.query('insert into auth.users values($1),($2)',[owner1,owner2]);
const owner = value => db.query("select set_config('request.jwt.claim.sub',$1,false)",[value]);
const call = async (packet,dry=true) => (await db.query('select public.astra_os_aktar($1::jsonb,$2) result',[JSON.stringify(packet),dry])).rows[0].result;
const packet={format:'astra-os-transfer',version:1,records:[{kind:'borc',key:'borc:test',data:{ad:'Sentetik borç',tur:'banka',anapara:1000,faiz_orani:12,asgari:100}}],library:[{kind:'youtube',id:'synthetic123',title:'Sentetik video',url:'https://youtube.com/watch?v=synthetic123',collections:['Test']}],archive:{source:'synthetic'}};
await assert.rejects(()=>call(packet),/oturum yok/);
await owner(owner1);
assert.equal((await call(packet)).yeni,2);
assert.equal((await db.query('select count(*)::int n from public.borclar')).rows[0].n,0);
assert.equal((await call(packet,false)).yeni,2);
assert.equal((await call(packet,false)).atlanacak,2);
await db.exec('update public.borclar set guncel_borc=900');
await call(packet,false);
assert.equal(Number((await db.query('select guncel_borc from public.borclar')).rows[0].guncel_borc),900);
const changed=structuredClone(packet);changed.records[0].data.anapara=2000;
changed.records.push({kind:'gider',key:'gider:new',data:{ad:'Sentetik gider',tur:'sabit',tutar:100}});
assert.equal((await call(changed)).cakisma,1);
await assert.rejects(()=>call(changed,false),/geri alındı/);
assert.equal((await db.query('select count(*)::int n from public.giderler')).rows[0].n,0);
await owner(owner2);
assert.equal((await call(packet,false)).yeni,2);
assert.equal((await db.query('select count(*)::int n from public.borclar')).rows[0].n,2);
// A pre-existing case must match the production RPC's composite hash, not only its number.
const legalPacket={format:'astra-os-transfer',version:1,records:[{kind:'dava',key:'dava:existing',data:{tur:'hukuk',mahkeme:'Sentetik Mahkeme',dosya_no:'2026/999'}}],library:[]};
await db.query('select public.dava_kaydet(null,null,$1,$2,$3::jsonb)',['hukuk','2026/999',JSON.stringify({mahkeme:'Sentetik Mahkeme'})]);
assert.equal((await call(legalPacket)).yeni,0);
assert.equal((await call(legalPacket)).atlanacak,1);
assert.equal((await call(legalPacket,false)).yeni,0);
assert.equal((await db.query('select count(*)::int n from public.davalar')).rows[0].n,1);
const invalid=structuredClone(packet);invalid.records.push(invalid.records[0]);
await assert.rejects(()=>call(invalid,false),/kimliği geçersiz/);
console.log('PASS: PostgreSQL import function, authentication, dry-run, atomic rollback, retry, preservation of live changes and owner isolation. Crypto and existing legal RPCs use synthetic stand-ins.');
if (process.env.ASTRA_PACKAGE) {
  const actual = JSON.parse(fs.readFileSync(process.env.ASTRA_PACKAGE,'utf8'));
  const preview = await call(actual);
  assert.equal(preview.cakisma,0);
  const applied = await call(actual,false);
  assert.equal(applied.yeni,actual.records.length+actual.library.length);
  const repeated = await call(actual,false);
  assert.equal(repeated.yeni,0);
  console.log('PASS: full repository package validated and applied in isolated PostgreSQL; retry created zero records.');
}
await db.close();
