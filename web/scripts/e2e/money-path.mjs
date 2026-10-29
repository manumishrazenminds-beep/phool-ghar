import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
const URL='http://127.0.0.1:54321'
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const KS='local_fake_secret_for_tests', WS='local_fake_webhook_secret'
const sql=q=>execSync(`docker exec -i supabase_db_phool-ghar psql -U postgres -d postgres -At -c "${q.replace(/"/g,'\\"')}"`).toString().trim()
let pass=0,fail=0
const t=(n,ok,i='')=>{ok?pass++:fail++;console.log((ok?'PASS ':'FAIL ')+n+(ok?'':'  -> '+i))}
const call=async(path,{method='POST',token=ANON,body,headers={}}={})=>{const r=await fetch(URL+path,{method,headers:{apikey:ANON,Authorization:'Bearer '+token,'Content-Type':'application/json',...headers},body:body&&JSON.stringify(body)});const tx=await r.text();let d;try{d=JSON.parse(tx)}catch{d=tx};return {s:r.status,d,h:r.headers}}
const hm=(s,m)=>crypto.createHmac('sha256',s).update(m).digest('hex')
const rzp=(p,b)=>fetch('http://127.0.0.1:9099'+p,{method:'POST',body:JSON.stringify(b)})
const email=`pay${Date.now()}@t.test`
const su=await call('/auth/v1/signup',{body:{email,password:'Passw0rd!x',data:{full_name:'Pay Tester',phone:'9822012345'}}})
const tok=su.d.access_token, uid=su.d.user.id
const d=new Date(Date.now()+3*864e5).toISOString().slice(0,10)
const body=()=>({idempotency_key:'idem-'+crypto.randomUUID(),lines:[{product_slug:'red-rose-buds',variant_key:'regular',qty:1}],address:{recipient_name:'Pay Tester',recipient_phone:'9822012345',line1:'12 Test Road',city:'Pune',pincode:'411001'},date:d,slot_id:'morning'})
// 1. checkout
const b1=body()
let r=await call('/functions/v1/checkout-create',{token:tok,body:b1})
t('checkout-create 201 + razorpay order',r.s===201&&r.d?.data?.payment?.razorpay_order_id || r.s===201&&r.d?.payment?.razorpay_order_id,`${r.s} ${JSON.stringify(r.d).slice(0,300)}`)
const out=r.d?.data??r.d; const rzpOrder=out?.payment?.razorpay_order_id, orderId=out?.order_id, amount=out?.payment?.amount_paise
// 2. idempotent replay
r=await call('/functions/v1/checkout-create',{token:tok,body:b1})
t('same idempotency key replays same Razorpay order',(r.d?.data??r.d)?.payment?.razorpay_order_id===rzpOrder&&r.h.get('idempotent-replay')==='true',`${r.s} ${JSON.stringify(r.d).slice(0,200)}`)
t('order is placed + payment pending before capture',sql(`select payment_status from orders where id='${orderId}'`)!=='paid')
// 3. price tamper: client-sent price ignored
r=await call('/functions/v1/checkout-create',{token:tok,body:{...body(),lines:[{product_slug:'red-rose-buds',variant_key:'regular',qty:1,price_paise:1,unit_price_paise:1}]}})
t('client price fields cannot change the amount',(r.d?.data??r.d)?.payment?.amount_paise===amount,`${(r.d?.data??r.d)?.payment?.amount_paise} vs ${amount}`)
// 4. bad signature
const payId='pay_'+crypto.randomBytes(7).toString('hex')
await rzp('/__pay',{order_id:rzpOrder,payment_id:payId})
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:rzpOrder,razorpay_payment_id:payId,razorpay_signature:'0'.repeat(64)}})
t('forged signature rejected (400)',r.s===400,`${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
// 5. another user cannot verify my payment
const su2=await call('/auth/v1/signup',{body:{email:'o'+email,password:'Passw0rd!x'}})
r=await call('/functions/v1/payment-verify',{token:su2.d.access_token,body:{razorpay_order_id:rzpOrder,razorpay_payment_id:payId,razorpay_signature:hm(KS,`${rzpOrder}|${payId}`)}})
t("another user cannot verify someone else's payment (404)",r.s===404,`${r.s}`)
// 6. good verify
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:rzpOrder,razorpay_payment_id:payId,razorpay_signature:hm(KS,`${rzpOrder}|${payId}`)}})
t('valid payment verifies (200 captured)',r.s===200&&(r.d?.data??r.d)?.status==='captured',`${r.s} ${JSON.stringify(r.d).slice(0,250)}`)
t('order marked paid in DB',sql(`select payment_status from orders where id='${orderId}'`)==='paid',sql(`select payment_status,status from orders where id='${orderId}'`))
// 7. verify again = already
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:rzpOrder,razorpay_payment_id:payId,razorpay_signature:hm(KS,`${rzpOrder}|${payId}`)}})
t('re-verify is idempotent (already captured)',r.s===200&&(r.d?.data??r.d)?.already===true,`${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
// 8. webhook
const evt={event:'payment.captured',payload:{payment:{entity:{id:payId,order_id:rzpOrder,amount,currency:'INR',status:'captured',method:'upi'}}}}
const raw=JSON.stringify(evt)
r=await call('/functions/v1/razorpay-webhook',{body:undefined,headers:{'x-razorpay-signature':'bad','x-razorpay-event-id':'evt_bad'},token:ANON})
t('webhook without valid signature rejected',r.s===400||r.s===401,`${r.s}`)
let w=await fetch(URL+'/functions/v1/razorpay-webhook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':hm(WS,raw),'x-razorpay-event-id':'evt_'+payId,apikey:ANON},body:raw})
t('signed webhook accepted',w.status===200,`${w.status} ${await w.text()}`)
w=await fetch(URL+'/functions/v1/razorpay-webhook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':hm(WS,raw),'x-razorpay-event-id':'evt_'+payId,apikey:ANON},body:raw})
const wt=await w.text(); t('replayed webhook is a no-op duplicate',w.status===200&&/duplicate/.test(wt),`${w.status} ${wt}`)
t('exactly one captured payment row',sql(`select count(*) from payments where order_id='${orderId}' and status='captured'`)==='1')
// 9. amount mismatch
const o2=(await call('/functions/v1/checkout-create',{token:tok,body:body()})).d; const o2d=o2.data??o2
const p2='pay_'+crypto.randomBytes(7).toString('hex')
await rzp('/__pay',{order_id:o2d.payment.razorpay_order_id,payment_id:p2,amount:100})
r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:o2d.payment.razorpay_order_id,razorpay_payment_id:p2,razorpay_signature:hm(KS,`${o2d.payment.razorpay_order_id}|${p2}`)}})
t('amount mismatch blocked (409) and order NOT paid',r.s===409&&sql(`select payment_status from orders where id='${o2d.order_id}'`)!=='paid',`${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
// 10. unauthenticated
r=await call('/functions/v1/checkout-create',{body:body()})
t('checkout requires sign-in',r.s===401,`${r.s}`)
// 11. past date / cutoff
r=await call('/functions/v1/checkout-create',{token:tok,body:{...body(),date:'2020-01-01'}})
t('past delivery date rejected',r.s>=400&&r.s<500,`${r.s} ${JSON.stringify(r.d).slice(0,150)}`)
// 12. subscription
const sb={...body(),lines:[{product_slug:'red-rose-buds',variant_key:'regular',qty:1}],subscription:{plan_days:7,delivery_days:[0,1,2,3,4,5,6],start_date:d}}
r=await call('/functions/v1/checkout-create',{token:tok,body:sb}); const sd=r.d?.data??r.d
t('subscription checkout creates subscription + razorpay order',r.s===201&&!!sd?.subscription_id,`${r.s} ${JSON.stringify(r.d).slice(0,250)}`)
if(sd?.subscription_id){const sp='pay_'+crypto.randomBytes(7).toString('hex');await rzp('/__pay',{order_id:sd.payment.razorpay_order_id,payment_id:sp})
 r=await call('/functions/v1/payment-verify',{token:tok,body:{razorpay_order_id:sd.payment.razorpay_order_id,razorpay_payment_id:sp,razorpay_signature:hm(KS,`${sd.payment.razorpay_order_id}|${sp}`)}})
 t('subscription payment activates plan',sql(`select status from subscriptions where id='${sd.subscription_id}'`)==='active',sql(`select status from subscriptions where id='${sd.subscription_id}'`)+' '+r.s)}
// 13. scheduler
const sc=await call('/functions/v1/daily-scheduler',{headers:{'x-cron-secret':'local-cron-secret'}})
t('daily-scheduler rejects missing secret',(await call('/functions/v1/daily-scheduler')).s>=400)
console.log('scheduler with secret:',sc.s,JSON.stringify(sc.d).slice(0,200))
console.log(`\n${pass} passed, ${fail} failed`)
