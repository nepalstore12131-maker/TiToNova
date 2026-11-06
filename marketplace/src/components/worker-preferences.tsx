"use client";
import { useState } from "react";

export function WorkerPreferences({ categories, interests = [], modes = [] }: {
  categories: string[]; interests?: string[]; modes?: string[];
}) {
  const [chosen, setChosen] = useState(interests);
  const [arrangements, setArrangements] = useState(modes);
  function choices(name: string, options: [string,string][], selected: string[], change: (v:string[])=>void) {
    return options.map(([value,label], index) => <label key={value} style={{display:"inline-flex",gap:6,alignItems:"center",margin:"4px 12px 4px 0"}}>
      <input type="checkbox" style={{width:"auto"}} name={name} value={value} checked={selected.includes(value)}
        required={index === 0 && selected.length === 0}
        onChange={event => change(event.target.checked ? [...selected,value] : selected.filter(item => item !== value))}/>{label}</label>);
  }
  return <><fieldset className="preference-options"><legend>Work interests · choose one or more</legend>
    {choices("interests", categories.map(c=>[c,c]),chosen,setChosen)}</fieldset>
    <fieldset className="preference-options"><legend>Where would you like to work?</legend>
    {choices("work_modes",[["remote","Remote"],["onsite","On site"],["hybrid","Hybrid"]],arrangements,setArrangements)}</fieldset></>;
}

export function SignupRole({initial,categories}:{initial:string;categories:string[]}) {
  const [role,setRole]=useState(initial);
  return <><label htmlFor="account_type">I’m joining as</label><select id="account_type" name="account_type" value={role} onChange={e=>setRole(e.target.value)}>
    <option value="freelancer">Worker / job seeker</option><option value="employer">Hiring — individual or business</option></select>
    {role==="freelancer" && <><label htmlFor="bio">Short introduction</label><textarea name="bio" id="bio" required maxLength={3000} placeholder="What work do you enjoy doing?"/>
    <WorkerPreferences categories={categories}/></>}</>;
}
