import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
const URL='http://127.0.0.1:54321'
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const KS='local_fake_secret_for_tests'
const sql=q=>execSync(`docker exec -i supabase_db_phool-ghar psql -U postgres -d postgres -At -c "${q.replace(/"/g,'\\"')}"`).toString().trim()
let pass=0,fail=0
const t=(n,ok,i='')=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+n+(ok?'':'  -> '+i))}
const call=async(path,{method='POST',token=ANON,body,headers={}}={})=>{const r=await fetch(URL+path,{method,headers:{apikey:ANON,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body&&JSON.stringify(body)});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d=tx};return {s:r.status,d}}
const hm=(s,m)=>crypto.createHmac('sha256',s).update(m).digest('hex')
const rzp=(p,b)=>fetch('http://127.0.0.1:9099'+p,{method:'POST',body:JSON.stringify(b)})
const email=`fx${Date.now()}@t.test`
const su=await call('/auth/v1/signup',{body:{email,password:'Passw0rd!x',data:{full_name:'Fix Tester',phone:'9822012345'}}})
const tok=su.d.access_token, uid=su.d.user.id
// coupon contract: field is `valid`
const code=sql(`select code from coupons where active limit 1`)
let r=await call('/rest/v1/rpc/apply_coupon_preview',{token:tok,body:{p_code:code,p_subtotal_paise:100000,p_kind:'one_time'}})
t('apply_coupon_preview returns `valid` + discount (frontend now reads it)',r.d&&typeof r.d.valid==='boolean',JSON.stringify(r.d))
// addresses: new default flow (insert non-default, then switch default) works with an existing default
const mkAddr=async(label,isDef)=>call('/rest/v1/addresses',{token:tok,headers:{Prefer:'return=representation'},body:{user_id:uid,label,recipient_name:'Fix T',recipient_phone:'9822012345',line1:'1 Test Rd',city:'Pune',pincode:'411001',is_default:isDef}})
const a1=await mkAddr('Home',false); const id1=a1.d?.[0]?.id
await call(`/rest/v1/addresses?id=eq.${id1}`,{method:'PATCH',token:tok,body:{is_default:true}})
const a2=await mkAddr('Office',false); const id2=a2.d?.[0]?.id
t('second address saved while a default exists',!!id2,JSON.stringify(a2.d).slice(0,160))
await call(`/rest/v1/addresses?user_id=eq.${uid}&id=neq.${id2}`,{method:'PATCH',token:tok,body:{is_default:false}})
r=await call(`/rest/v1/addresses?id=eq.${id2}`,{method:'PATCH',token:tok,body:{is_default:true}})
t('default switches cleanly (unset others, then set)',sql(`select count(*) from addresses where user_id='${uid}' and is_default`)==='1'&&sql(`select is_default from addresses where id='${id2}'`)==='t')
r=await mkAddr('Home',true); r.s>=400 ? t('direct is_default insert while default exists is rejected (why client no longer does it)',true) : t('index present',false,'insert allowed')
// staff reads: admin querying with user filter only gets own rows (client side), RLS still lets admin see all
// payments: create + pay, then duplicate-payment refund must not flip the order
const d=new Date(Date.now()+3*864e5).toISOString().slice(0,10)
const body={idempotency_key:'idem-'+crypto.randomUUID(),lines:[{product_slug:'red-rose-buds',variant_key:'regular',qty:1}],address:{recipient_name:'Fix Tester',recipient_phone:'9822012345',line1:'12 Test Road',city:'Pune',pincode:'411001'},date:d,slot_id:'morning'}
r=await call('/functions/v1/checkout-create',{token:tok,body}); const o=r.d.data??r.d
const pay='pay_'+crypto.randomBytes(7).toString('hex'); await rzp('/__pay',{order_id:o.payment.razorpay_order_id,payment_id:pay})
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:o.payment.razorpay_order_id,razorpay_payment_id:pay,razorpay_signature:hm(KS,`${o.payment.razorpay_order_id}|${pay}`)}})
t('payment verified',r.s===200,JSON.stringify(r.d).slice(0,150))
const pid=sql(`select id from payments where order_id='${o.order_id}' and status='captured'`)
const amt=sql(`select amount_paise from payments where id='${pid}'`)
sql(`insert into payments (order_id,user_id,provider,provider_order_id,provider_payment_id,amount_paise,status) values ('${o.order_id}','${uid}','razorpay','order_dup${Date.now()}','pay_dup${Date.now()}',${amt},'captured')`)
const dup=sql(`select id from payments where order_id='${o.order_id}' and id<>'${pid}'`)
sql(`insert into refunds (payment_id,order_id,amount_paise,reason,status) values ('${dup}','${o.order_id}',${amt},'duplicate_payment','pending')`)
sql(`select mark_refund('${dup}',${amt},'rfnd_dup${Date.now()}','processed')`)
t('duplicate-charge refund leaves the order paid',sql(`select payment_status from orders where id='${o.order_id}'`)==='paid',sql(`select payment_status from orders where id='${o.order_id}'`))
// 202 processing: authorized but not captured
const body2={...body,idempotency_key:'idem-'+crypto.randomUUID()}
r=await call('/functions/v1/checkout-create',{token:tok,body:body2}); const o2=r.d.data??r.d
const p2='pay_'+crypto.randomBytes(7).toString('hex'); await rzp('/__pay',{order_id:o2.payment.razorpay_order_id,payment_id:p2,status:'authorized'})
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:o2.payment.razorpay_order_id,razorpay_payment_id:p2,razorpay_signature:hm(KS,`${o2.payment.razorpay_order_id}|${p2}`)}})
t('authorized-not-captured returns 202 processing (client keeps the cart)',r.s===202&&(r.d.data??r.d).status==='processing',`${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
t('order stays unpaid while processing',sql(`select payment_status from orders where id='${o2.order_id}'`)!=='paid')
// notifications: one in-app row per event
await call('/functions/v1/notify-dispatch',{headers:{'x-cron-secret':'local-cron-secret'}})
const dup2=sql(`select count(*) from (select data->>'order_id' o,type,count(*) c from notifications where user_id='${uid}' group by 1,2 having count(*)>1) x`)
t('no duplicated in-app notifications for the same order event',dup2==='0',`dupes: ${dup2} — ${sql(`select type,title from notifications where user_id='${uid}'`)}`)
console.log(`\n${pass} passed, ${fail} failed`)
