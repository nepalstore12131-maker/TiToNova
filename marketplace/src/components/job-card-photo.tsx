"use client";
import {useState} from 'react';
import Link from 'next/link';
export function JobCardPhoto({src,href,title}:{src?:string;href:string;title:string}){
 const [failedSrc,setFailedSrc]=useState<string>();
 if(!src||failedSrc===src)return null;
 return <Link className="job-card-photo" href={href} aria-label={`View ${title}`}><img src={src} alt={`Photo for ${title}`} width={640} height={360} loading="lazy" decoding="async" onError={()=>setFailedSrc(src)}/></Link>;
}
