export async function api(path,options={}) {
  const headers={'x-demo-user':localStorage.getItem('lending-user')||'',...options.headers};
  if(options.body&&!(options.body instanceof FormData)){headers['Content-Type']='application/json';options.body=JSON.stringify(options.body);}
  const response=await fetch(`/api${path}`,{...options,headers});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error+(data.fields?.length?' Kiểm tra: '+data.fields.map(f=>f.field).join(', '):''));
  return data;
}
export async function downloadDocument(d){const response=await fetch(`/api/documents/${d.id}`,{headers:{'x-demo-user':localStorage.getItem('lending-user')}});if(!response.ok)throw new Error('Không thể tải tài liệu.');const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=d.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
