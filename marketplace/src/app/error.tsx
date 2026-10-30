"use client";
import Link from 'next/link';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <main className="ws-error"><span className="brand-mark">↗</span><div className="eyebrow">Let’s try that again</div><h1>A small pause<br/>in your next step.</h1><p>We couldn’t load this page. Your work matters—please try again in a moment.</p><div><button className="button" onClick={reset}>Try again ↻</button><Link className="button secondary" href="/dashboard">Back to workspace</Link></div></main>;}
