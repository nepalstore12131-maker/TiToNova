import Link from 'next/link';
import type {FlowStep} from '@/lib/workflow';
import styles from './workflow.module.css';
const steps=['Application','Review','Agreement','Work','Completed'];
export function NextStep({flow,showLink=true,compact=false}:{flow:FlowStep;showLink?:boolean;compact?:boolean}){
 return <section className={`${styles.next} ${styles[flow.tone]} ${compact?styles.compact:''}`} aria-label="Your next step"><div className={styles.top}><span className={styles.badge}>{flow.label}</span><span className={styles.kicker}>{flow.tone==='waiting'?'Waiting for a response':flow.step===4?'Work history':'Your next step'}</span></div>{!compact&&<p>{flow.message}</p>}{showLink&&<Link className="button" href={flow.href}>{flow.action} →</Link>}{!compact&&flow.label!=='Cancelled'&&flow.label!=='Withdrawn'&&flow.label!=='Not selected'&&<ol className={styles.track} aria-label="Application to completion">{steps.map((label,i)=><li key={label} aria-current={i===flow.step?'step':undefined} className={i===flow.step?styles.current:i<flow.step?styles.done:undefined}><span aria-hidden="true">{i<flow.step?'✓':i+1}</span>{label}</li>)}</ol>}</section>;
}
