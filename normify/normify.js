const FN = 'https://lxqtyfjglgjyjnnptnop.supabase.co/functions/v1/normify';
const file = document.getElementById('file'), go = document.getElementById('go'), status = document.getElementById('status');
const before = document.getElementById('before'), after = document.getElementById('after');
let dataUrl = '';

function resize(f, max = 1024) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That image could not be read.')); };
    img.src = url;
  });
}

file.addEventListener('change', async () => {
  const f = file.files[0]; if (!f) return;
  try {
    dataUrl = await resize(f);
    before.replaceChildren(Object.assign(new Image(), { src: dataUrl, alt: 'Your photo' }));
    after.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'your normie' }));
    go.disabled = false; status.textContent = '';
  } catch (e) { status.textContent = e.message; }
});

go.addEventListener('click', async () => {
  if (!dataUrl) return;
  go.disabled = true; status.textContent = 'normifying… this takes about 10 to 30 seconds';
  const t0 = performance.now();
  try {
    const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.url) throw new Error(out.error || 'Something went wrong.');
    after.replaceChildren(Object.assign(new Image(), { src: out.url, alt: 'Your Normie' }));
    status.textContent = `done in ${Math.round((performance.now() - t0) / 1000)}s`;
  } catch (e) { status.textContent = e.message; }
  finally { go.disabled = false; }
});
