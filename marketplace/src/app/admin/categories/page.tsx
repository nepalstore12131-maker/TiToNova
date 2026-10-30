import { PortalShell } from "@/components/portal-shell";
import { requireAdminContext } from "@/lib/supabase/admin";
import { saveCategory } from "./actions";
export const dynamic = "force-dynamic";
type Category = {id:string;name:string;sort_order:number;active:boolean};
function CategoryForm({category}:{category?:Category}) {
 const key=category?.id ?? "new";
 return <form action={saveCategory} className="auth-form">
   {category&&<input type="hidden" name="id" value={category.id}/>}
   <label htmlFor={`${key}-name`}>Category name</label><input id={`${key}-name`} name="name" required minLength={2} maxLength={80} defaultValue={category?.name} placeholder="e.g. Gardening"/>
   <label htmlFor={`${key}-order`}>Display order</label><input id={`${key}-order`} name="sort_order" type="number" required min={0} max={9999} defaultValue={category?.sort_order ?? 100}/>
   <label><input name="active" type="checkbox" defaultChecked={category?.active ?? true}/> Available for new posts</label>
   <button className="button" type="submit">{category?"Save category":"Add category"}</button>
 </form>;
}
export default async function CategoriesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {sessionClient}=await requireAdminContext();
 const [{data,error},params]=await Promise.all([sessionClient.from("job_categories").select("id,name,sort_order,active").order("sort_order").order("name"),searchParams]);
 return <PortalShell role="admin" activePath="/admin/categories"><div className="eyebrow">Marketplace settings</div><h1>Job categories</h1><p>Add categories for homes, personal tasks and businesses. Rename or disable choices for future posts. Existing job posts keep their original category and are never changed here.</p>
 {params.success==="saved"&&<div className="setup-alert">Category saved.</div>}
 {params.error&&<div className="form-alert" role="alert">{params.error==="duplicate"?"That category name already exists. Edit the existing category instead.":"Could not save. Check the name and display order, then try again."}</div>}
 {error?<div className="form-alert" role="alert">Categories could not be loaded. The category database update must be installed before editing.</div>:<><section className="dashboard-card"><h2>Add a category</h2><CategoryForm/></section><h2>Manage categories</h2><div className="portal-card-grid">{(data as Category[]).map(category=><section className="dashboard-card" key={category.id}><h3>{category.name}</h3><p>{category.active?"Active":"Disabled for new posts"}</p><CategoryForm category={category}/></section>)}</div></>}
 </PortalShell>;
}
