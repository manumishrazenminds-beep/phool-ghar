import http from 'node:http'
const orders=new Map(), pays=new Map()
http.createServer((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{
 const send=(c,o)=>{res.writeHead(c,{'content-type':'application/json'});res.end(JSON.stringify(o))}
 const u=req.url
 if(req.method==='POST'&&u==='/v1/orders'){const j=JSON.parse(b);const id='order_'+Math.random().toString(36).slice(2,16).padEnd(14,'x');const o={id,amount:j.amount,currency:j.currency??'INR',receipt:j.receipt,status:'created',notes:j.notes};orders.set(id,o);return send(200,o)}
 let m=u.match(/^\/v1\/payments\/(pay_\w+)$/)
 if(m&&req.method==='GET'){const p=pays.get(m[1]);return p?send(200,p):send(404,{error:{code:'BAD_REQUEST_ERROR',description:'not found'}})}
 if(req.method==='POST'&&u==='/__pay'){const j=JSON.parse(b);const o=orders.get(j.order_id);pays.set(j.payment_id,{id:j.payment_id,order_id:j.order_id,amount:j.amount??o.amount,currency:'INR',status:j.status??'captured',method:'upi',captured:true});return send(200,{ok:true})}
 m=u.match(/^\/v1\/payments\/(pay_\w+)\/refund$/)
 if(m&&req.method==='POST'){const j=JSON.parse(b);return send(200,{id:'rfnd_'+Math.random().toString(36).slice(2,14),payment_id:m[1],amount:j.amount,status:'processed'})}
 send(404,{error:{description:'unhandled '+u}})})}).listen(9099,'0.0.0.0',()=>console.log('fake rzp on 9099'))
