import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import itemMatches from '../services/itemMatches';
import { listItems } from '../services/items';
import { getItemImages } from '../services/itemImage';
import { apiUrl } from '../services/apiUrl';

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function searchItemsForMatch(query, expectedType) {
  const normalizedQuery = query.trim();
  const numericQuery = /^\d+$/.test(normalizedQuery);
  const result = await listItems({
    q: '',
    page: 1,
    pageSize: 200,
  });
  const items = Array.isArray(result?.items) ? result.items : [];

  const matchingItems = items
    .filter(item => {
      const itemTypeId = Number(item.typeId ?? item.TypeId);
      const itemTypeName = String(item.typeName ?? item.TypeName ?? '').toLowerCase();
      const matchesType = itemTypeId === expectedType.id || itemTypeName === expectedType.name;
      if (!matchesType) return false;
      if (numericQuery) return Number(item.id ?? item.Id) === Number(normalizedQuery);
      const itemName = String(item.name ?? item.Name ?? '').toLowerCase();
      return itemName.includes(normalizedQuery.toLowerCase());
    })
    .slice(0, 5);

  return Promise.all(matchingItems.map(async item => {
    const existingImage = item.primaryImageUrl ?? item.PrimaryImageUrl
      ?? item.primaryImage?.url ?? item.primaryImage?.Url;
    if (existingImage) return { ...item, suggestionImageUrl: apiUrl(existingImage) };

    try {
      const images = await getItemImages(item.id ?? item.Id);
      const primary = images.find(image => image.isPrimary ?? image.IsPrimary) ?? images[0];
      return { ...item, suggestionImageUrl: primary?.url ?? primary?.Url ?? null };
    } catch (error) {
      console.error(`Failed to load images for item ${item.id ?? item.Id}`, error);
      return { ...item, suggestionImageUrl: null };
    }
  }));
}

export default function MatchCreate() {
  const [lostQuery, setLostQuery] = useState('');
  const [foundQuery, setFoundQuery] = useState('');
  const debLost = useDebounced(lostQuery, 250);
  const debFound = useDebounced(foundQuery, 250);

  const [lostSuggestions, setLostSuggestions] = useState([]);
  const [foundSuggestions, setFoundSuggestions] = useState([]);
  const [lostIndex, setLostIndex] = useState(-1);
  const [foundIndex, setFoundIndex] = useState(-1);
  const [lostItem, setLostItem] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [score, setScore] = useState(80);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const lostRef = useRef();
  const foundRef = useRef();

  useEffect(() => {
    let active = true;
    async function s() {
      if (!debLost) { setLostSuggestions([]); return; }
      try {
        const suggestions = await searchItemsForMatch(debLost, { id: 1, name: 'lost' });
        if (!active) return;
        setLostSuggestions(suggestions);
        setLostIndex(-1);
      } catch (err) { console.error(err); }
    }
    s();
    return () => { active = false; };
  }, [debLost]);

  useEffect(() => {
    let active = true;
    async function s() {
      if (!debFound) { setFoundSuggestions([]); return; }
      try {
        const suggestions = await searchItemsForMatch(debFound, { id: 2, name: 'found' });
        if (!active) return;
        setFoundSuggestions(suggestions);
        setFoundIndex(-1);
      } catch (err) { console.error(err); }
    }
    s();
    return () => { active = false; };
  }, [debFound]);

  function pickLost(item) {
    setLostItem(item);
    setLostQuery(item.id + ' — ' + item.name);
    setLostSuggestions([]);
    setLostIndex(-1);
  }

  function pickFound(item) {
    setFoundItem(item);
    setFoundQuery(item.id + ' — ' + item.name);
    setFoundSuggestions([]);
    setFoundIndex(-1);
  }

  function onLostKeyDown(e) {
    if (!lostSuggestions || lostSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLostIndex(i => (i + 1) % lostSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLostIndex(i => (i <= 0 ? lostSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (lostIndex >= 0 && lostIndex < lostSuggestions.length) {
        e.preventDefault();
        pickLost(lostSuggestions[lostIndex]);
      }
    } else if (e.key === 'Escape') {
      setLostSuggestions([]);
      setLostIndex(-1);
    }
  }

  function onFoundKeyDown(e) {
    if (!foundSuggestions || foundSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFoundIndex(i => (i + 1) % foundSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFoundIndex(i => (i <= 0 ? foundSuggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (foundIndex >= 0 && foundIndex < foundSuggestions.length) {
        e.preventDefault();
        pickFound(foundSuggestions[foundIndex]);
      }
    } else if (e.key === 'Escape') {
      setFoundSuggestions([]);
      setFoundIndex(-1);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!lostItem || !foundItem) return alert('Select both items from suggestions');
    if (lostItem.id === foundItem.id) return alert('Items must be different');
    setLoading(true);
    try {
      await itemMatches.createItemMatch({ lostItemId: Number(lostItem.id), foundItemId: Number(foundItem.id), score: Number(score) });
      navigate('/matches');
    } catch (err) {
      console.error(err);
      alert('Failed to create match');
    } finally { setLoading(false); }
  }

  return (
    <div className="card">
      <h3>Create Item Match</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
        <label>Lost Item</label>
        <div style={{ position: 'relative' }}>
          <input ref={lostRef} value={lostQuery} onChange={e => { setLostQuery(e.target.value); setLostItem(null); }} onKeyDown={onLostKeyDown} placeholder="Search items by name or id" />
          {lostSuggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, background: 'var(--card)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', zIndex: 60 }}>
              {lostSuggestions.map((it, idx) => (
                <div key={it.id} onMouseEnter={() => setLostIndex(idx)} onMouseLeave={() => setLostIndex(-1)} style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', background: lostIndex === idx ? '#eef2ff' : 'transparent' }} onClick={() => pickLost(it)}>
                  {it.suggestionImageUrl
                    ? <img src={apiUrl(it.suggestionImageUrl)} alt="pri" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 48, height: 36, background: '#f3f4f6', borderRadius: 6 }} />}
                  <div>{it.id} — {it.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>Found Item</label>
        <div style={{ position: 'relative' }}>
          <input ref={foundRef} value={foundQuery} onChange={e => { setFoundQuery(e.target.value); setFoundItem(null); }} onKeyDown={onFoundKeyDown} placeholder="Search items by name or id" />
          {foundSuggestions.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, background: 'var(--card)', boxShadow: '0 6px 18px rgba(0,0,0,0.06)', zIndex: 60 }}>
              {foundSuggestions.map((it, idx) => (
                <div key={it.id} onMouseEnter={() => setFoundIndex(idx)} onMouseLeave={() => setFoundIndex(-1)} style={{ padding: 8, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', background: foundIndex === idx ? '#eef2ff' : 'transparent' }} onClick={() => pickFound(it)}>
                  {it.suggestionImageUrl
                    ? <img src={apiUrl(it.suggestionImageUrl)} alt="pri" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                    : <div style={{ width: 48, height: 36, background: '#f3f4f6', borderRadius: 6 }} />}
                  <div>{it.id} — {it.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <label>Score</label>
        <input type="number" value={score} onChange={e => setScore(e.target.value)} min={0} max={100} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create'}</button>
          <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
