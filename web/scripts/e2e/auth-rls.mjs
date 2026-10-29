import { execSync } from 'node:child_process'
const URL='http://127.0.0.1:54321'
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SVC='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const sql=q=>execSync(`docker exec -i supabase_db_phool-ghar psql -U postgres -d postgres -At -c "${q.replace(/"/g,'\\"')}"`).toString().trim()
let pass=0,fail=0
const t=(name,ok,info='')=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+name+(ok?'':'  -> '+info))}
const j=async(path,{method='GET',key=ANON,token,body,headers={}}={})=>{const r=await fetch(URL+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token??key),'Content-Type':'application/json',...headers},body:body&&JSON.stringify(body)});let d;try{d=await r.json()}catch{d=null};return {s:r.status,d}}
const stamp=Date.now()
const mk=async(email,meta={})=>{const r=await j('/auth/v1/signup',{method:'POST',body:{email,password:'Passw0rd!x',data:meta}});return r}
// signup + auto profile
const cEmail=`cust${stamp}@t.test`
let r=await mk(cEmail,{full_name:'Test Cust',role:'admin'})
t('customer signup returns session',!!r.d?.access_token,JSON.stringify(r.d).slice(0,200))
const ctok=r.d?.access_token, cid=r.d?.user?.id
r=await j(`/rest/v1/profiles?id=eq.${cid}&select=role,full_name,email`,{token:ctok})
t('profile auto-created as customer despite role=admin metadata',r.d?.[0]?.role==='customer'&&r.d[0].full_name==='Test Cust',JSON.stringify(r.d))
// escalation
r=await j(`/rest/v1/profiles?id=eq.${cid}`,{method:'PATCH',token:ctok,body:{role:'admin'},headers:{Prefer:'return=representation'}})
const after=sql(`select role from profiles where id='${cid}'`)
t('customer cannot self-promote to admin',after==='customer',`status ${r.s} role now ${after}`)
r=await j(`/rest/v1/profiles?id=eq.${cid}`,{method:'PATCH',token:ctok,body:{permissions:['team']},headers:{Prefer:'return=representation'}})
t('customer cannot grant self permissions',sql(`select coalesce(array_length(permissions,1),0) from profiles where id='${cid}'`)==='0')
// public catalog
r=await j('/rest/v1/products?select=slug,price_paise&active=eq.true&limit=3',{})
t('anon can read active products',r.s===200&&r.d.length>0,JSON.stringify(r.d).slice(0,150))
r=await j('/rest/v1/rpc/check_pincode',{method:'POST',body:{p_pincode:'411045'}})
t('check_pincode works',r.s===200,JSON.stringify(r.d))
r=await j('/rest/v1/orders?select=id',{})
t('anon cannot read orders',r.s!==200||r.d.length===0,JSON.stringify(r.d))
// second customer isolation
const c2=await mk(`cust2${stamp}@t.test`,{full_name:'Other'}); const c2tok=c2.d?.access_token, c2id=c2.d?.user?.id
r=await j(`/rest/v1/profiles?id=eq.${cid}&select=id`,{token:c2tok})
t('customer cannot read another profile',r.d?.length===0,JSON.stringify(r.d))
// admin
const aEmail=`own${stamp}@t.test`
const ar=await mk(aEmail,{full_name:'Owner'}); const aid=ar.d?.user?.id
sql(`update profiles set role='admin' where id='${aid}'`)
const al=await j('/auth/v1/token?grant_type=password',{method:'POST',body:{email:aEmail,password:'Passw0rd!x'}}); const atok=al.d?.access_token
t('owner password login works',!!atok)
r=await j('/rest/v1/profiles?select=id,role&limit=50',{token:atok})
t('admin can list all profiles',r.s===200&&r.d.length>=3,JSON.stringify(r.d).slice(0,100))
r=await j('/rest/v1/profiles?select=id&limit=50',{token:ctok})
t('customer sees only own profile',r.d?.length===1,JSON.stringify(r.d))
// pricing
const slug=sql(`select slug from products where active limit 1`)
r=await j('/rest/v1/rpc/preview_pricing',{method:'POST',token:ctok,body:{p_payload:{lines:[{product_slug:slug,variant_key:'regular',qty:1,mode:'once'}],pincode:'411045'}}})
t('preview_pricing works for signed-in customer',r.s===200&&r.d?.total_paise>0,JSON.stringify(r.d).slice(0,200))
// order isolation / create_checkout direct call must be blocked
r=await j('/rest/v1/rpc/create_checkout',{method:'POST',token:ctok,body:{p_user:cid,p_payload:{},p_idem:'x'}})
t('customer cannot call create_checkout RPC directly (server-only)',r.s>=400,`status ${r.s} ${JSON.stringify(r.d).slice(0,120)}`)
r=await j('/rest/v1/rpc/mark_payment_captured',{method:'POST',token:ctok,body:{}})
t('customer cannot call mark_payment_captured',r.s>=400,`status ${r.s}`)
// functions reachable
r=await j('/functions/v1/health',{})
t('health function reachable',r.s===200||r.s===503,`status ${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
console.log(`\n${pass} passed, ${fail} failed`)
console.log(JSON.stringify({cid,aid,cEmail,aEmail}))
