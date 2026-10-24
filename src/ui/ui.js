/**
 * 界面控制
 */
export class UI {
  constructor() {
    this.boot = document.getElementById('boot');
    this.bootBar = document.querySelector('.boot-bar i');
    this.bootStatus = document.getElementById('bootStatus');
    this.place = document.getElementById('place');
    this.placeTag = document.getElementById('placeTag');
    this.placeName = document.getElementById('placeName');
    this.placeDesc = document.getElementById('placeDesc');
    this.placeMeta = document.getElementById('placeMeta');
    this.dockList = document.getElementById('dockList');
    this.crosshair = document.getElementById('crosshair');
    this.stat = document.getElementById('stat');
    this.tour = document.getElementById('tour');
    this.tourStep = document.getElementById('tourStep');
    this.tourSub = document.getElementById('tourSub');
    this.tourName = document.getElementById('tourName');
    this.tourText = document.getElementById('tourText');
    this.tourPrev = document.getElementById('tourPrev');
    this.tourNext = document.getElementById('tourNext');
    this.tourExit = document.getElementById('tourExit');
    this.tools = document.getElementById('tools');
    this.handlers = {};
    this.activeId = null;

    this.tools.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const act = btn.dataset.act;
        if (this.handlers[act]) this.handlers[act](btn);
      });
    });
  }

  progress(p, label) {
    if (this.bootBar) this.bootBar.style.width = `${Math.round(p * 100)}%`;
    if (label && this.bootStatus) this.bootStatus.textContent = label;
  }

  ready() {
    this.boot?.classList.add('done');
    document.body.classList.add('ready');
    setTimeout(() => { if (this.boot) this.boot.style.display = 'none'; }, 1300);
  }

  on(act, fn) { this.handlers[act] = fn; }

  setDock(items, onSelect) {
    this.dockList.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'dock-item';
      b.dataset.id = it.id;
      b.innerHTML = `${it.name}<em>${it.tag}</em>`;
      b.addEventListener('click', () => onSelect(it));
      this.dockList.appendChild(b);
    }
  }

  setActive(id) {
    this.activeId = id;
    this.dockList.querySelectorAll('.dock-item').forEach((el) => {
      el.classList.toggle('on', el.dataset.id === id);
    });
  }

  showPlace(b) {
    if (!b) {
      this.place.classList.add('hidden');
      this.setActive(null);
      return;
    }
    this.placeTag.textContent = b.tag || '书院';
    this.placeName.textContent = b.name;
    this.placeDesc.textContent = b.info || '';
    this.placeMeta.innerHTML = (b.meta || [])
      .map(([k, v]) => `<li>${k}<b>${v}</b></li>`)
      .join('');
    this.place.classList.remove('hidden');
    this.setActive(b.id);
    // 滚动到可见
    const el = this.dockList.querySelector(`[data-id="${b.id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  setButton(act, text) {
    const b = this.tools.querySelector(`[data-act="${act}"]`);
    if (b) b.textContent = text;
  }

  bindTour(prev, next, exit) {
    this.tourPrev?.addEventListener('click', prev);
    this.tourNext?.addEventListener('click', next);
    this.tourExit?.addEventListener('click', exit);
  }

  showTour(item, idx, total) {
    if (!this.tour) return;
    this.place.classList.add('hidden');
    this.tour.classList.remove('hidden');
    this.tourStep.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    this.tourSub.textContent = item.sub || '';
    this.tourName.textContent = item.name;
    this.tourText.textContent = item.text || '';
    this.tourPrev.disabled = idx <= 0;
    this.tourNext.disabled = idx >= total - 1;
    this.tourNext.textContent = idx >= total - 1 ? '已到终点' : '下一站 →';
    this.tourText.scrollTop = 0;
    this.setActive(item.id);
  }

  hideTour() {
    this.tour?.classList.add('hidden');
  }

  setCrosshair(on) {
    this.crosshair.classList.toggle('hidden', !on);
  }

  setStat(text) {
    if (this.stat) this.stat.textContent = text;
  }
}
