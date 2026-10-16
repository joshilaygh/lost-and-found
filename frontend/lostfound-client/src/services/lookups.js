import { apiUrl } from './apiUrl';

export async function listCategories() {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl('/api/categories'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listItemTypes() {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl('/api/item-types'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listStatuses() {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl('/api/statuses'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
