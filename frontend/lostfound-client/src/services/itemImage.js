import { apiUrl } from './apiUrl';

async function getAuthHeaders() {
  const token = localStorage.getItem('app_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getItemImages(itemId) {
  const res = await fetch(apiUrl(`/api/items/${itemId}/images`), {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch images');
  const images = await res.json();
  return images.map(image => ({ ...image, url: apiUrl(image.url || image.Url) }));
}

export async function uploadItemImages(itemId, files, onProgress) {
  // files: FileList or array
  const form = new FormData();
  for (const f of files) form.append('files', f);

  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Using fetch; progress needs xhr for per-file progress (optional).
  const res = await fetch(apiUrl(`/api/items/${itemId}/images`), {
    method: 'POST',
    headers,
    body: form
  });
  if (!res.ok) {
    let msg = 'Upload failed';
    try {
      const body = await res.json();
      if (body && body.error) msg = body.error;
      else if (body && body.message) msg = body.message;
    } catch (e) {
      try { msg = await res.text(); } catch { /* ignore */ }
    }
    throw new Error(msg || 'Upload failed');
  }
  const images = await res.json();
  return images.map(image => ({ ...image, url: apiUrl(image.url || image.Url) }));
}

export async function deleteItemImage(itemId, imageId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl(`/api/items/${itemId}/images/${imageId}`), {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Delete failed');
  return true;
}

export async function setItemPrimary(itemId, imageId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl(`/api/items/${itemId}/images/${imageId}/set-primary`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Set primary failed');
  return res.json();
}

// --- Temp upload helpers (upload files before the item exists) ---
export async function uploadTempImages(files) {
  const form = new FormData();
  for (const f of files) form.append('files', f);
  const token = localStorage.getItem('app_jwt');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const res = await fetch(apiUrl('/api/items/temp-images'), {
    method: 'POST',
    headers,
    body: form
  });
  if (!res.ok) {
    let msg = 'Temp upload failed';
    try { msg = (await res.json())?.message || msg; } catch { try { msg = await res.text(); } catch {} }
    throw new Error(msg);
  }
  const result = await res.json();
  return {
    ...result,
    files: (result.files || []).map(file => ({ ...file, url: apiUrl(file.url || file.Url) }))
  };
}

export async function attachTempToItem(itemId, tempId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl(`/api/items/${itemId}/images/attach-temp/${encodeURIComponent(tempId)}`), {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    let msg = 'Attach temp images failed';
    try { msg = (await res.json())?.message || msg; } catch { try { msg = await res.text(); } catch {} }
    throw new Error(msg);
  }
  const images = await res.json();
  return images.map(image => ({ ...image, url: apiUrl(image.url || image.Url) }));
}

export async function deleteTempUploads(tempId) {
  const token = localStorage.getItem('app_jwt');
  const res = await fetch(apiUrl(`/api/items/temp-images/${encodeURIComponent(tempId)}`), {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) throw new Error('Failed to delete temp uploads');
  return true;
}