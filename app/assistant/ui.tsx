'use client';

import {useState} from 'react';
import {FlaskConical,LayoutDashboard,MessageSquare,Send} from 'lucide-react';

type Message={role:'user'|'assistant';content:string};
const examples=['Show unpaid invoices for this month.','What was Justin’s average order value this year?','Show payments and line items for INV-002826.'];
export default function AssistantChat({configured}:{configured:boolean}){
 const [messages,setMessages]=useState<Message[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function send(prompt=question){
  if(busy||(!prompt.trim()))return;
  setBusy(true);setNotice('');
  const next:Message[]=[...messages,{role:'user',content:prompt.trim()}];
  try{
   const response=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ask',messages:next.slice(-12)})});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error);
   setMessages([...next,{role:'assistant',content:result.answer}]);setQuestion('');
  }catch(e){setNotice(e instanceof Error?e.message:'The request failed.');}finally{setBusy(false);}
 }
 return <div className="shell">
  <aside><a className="brand" href="/"><span className="brandmark">d<span>·</span></span><span>Dizzle<span className="brand-sub">MANAGEMENT</span></span></a>
   <div className="nav-label">WORKSPACE</div>
   <a className="nav" href="/"><LayoutDashboard size={18}/>Profit calculator</a>
   <a className="nav" href="/samples"><FlaskConical size={18}/>Samples</a>
   <a className="nav active" aria-current="page" href="/assistant"><MessageSquare size={18}/>Zoho Assistant<span className="nav-dot"/></a>
  </aside>
  <main><header><div className="breadcrumb">Workspace <span>/</span> <b>Zoho Assistant</b></div><a className="page-link" href="/">← Profit calculator</a></header>
   <div className="content"><div className="page-title"><div className="eyebrow">DIZZLE WORKSPACE</div><h1>Zoho Assistant<span>.</span></h1><p>Ask about customers, invoices, payments, and sales.</p></div>
    <section className="assistant-panel">
     {!configured?<p>Zoho Assistant is awaiting setup. Contact your workspace administrator.</p>:<>
      <div className="assistant-toolbar"><span>Read-only Zoho access</span></div>
      {!messages.length&&<div className="assistant-examples">{examples.map(example=><button type="button" key={example} className="button secondary" disabled={busy} onClick={()=>void send(example)}>{example}</button>)}</div>}
      <div className="assistant-messages" aria-live="polite">{messages.map((m,i)=><div key={i} className={`assistant-message ${m.role}`}><strong>{m.role==='user'?'You':'Zoho Assistant'}</strong><p>{m.content}</p></div>)}{busy&&<p>Checking Zoho…</p>}</div>
      <form className="assistant-form" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="assistant-question">Ask a question</label><textarea id="assistant-question" rows={3} maxLength={3000} required placeholder="Ask about your Zoho records…" value={question} onChange={e=>setQuestion(e.target.value)}/><button className="button primary" disabled={busy||!question.trim()}><Send size={16}/>Send</button></form>
     </>}
     {notice&&<p className="notice" role="status">{notice}</p>}
    </section>
   </div>
  </main>
 </div>;
}
