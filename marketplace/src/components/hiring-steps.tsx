'use client';
import {useState,type ReactNode} from 'react';
export function HiringSteps({steps,initialStep=0}:{steps:{title:string;description:string;content:ReactNode}[];initialStep?:number}){
 const [current,setCurrent]=useState(initialStep);
 const move=(next:number)=>{setCurrent(next);document.getElementById('hiring-step-heading')?.focus();};
 return <section aria-label="Hiring steps"><nav aria-label="Application steps" className="filter-actions" style={{flexWrap:'wrap'}}>{steps.map((step,i)=><button key={step.title} type="button" className={`button ${i===current?'':'secondary'} small`} aria-current={i===current?'step':undefined} onClick={()=>move(i)}>{i+1}. {step.title}</button>)}</nav><h2 id="hiring-step-heading" tabIndex={-1} style={{marginTop:24}}>Step {current+1} of {steps.length}: {steps[current].title}</h2><p>{steps[current].description}</p>{steps.map((step,i)=><div key={step.title} hidden={i!==current}>{step.content}</div>)}<div className="filter-actions" style={{marginTop:24}}>{current>0&&<button type="button" className="button secondary" onClick={()=>move(current-1)}>← Back</button>}{current<steps.length-1&&<button type="button" className="button" onClick={()=>move(current+1)}>Next: {steps[current+1].title} →</button>}</div><p className="field-help">Next shows the next step. It does not hire anyone or send a message.</p></section>;
}
