// =============================================
// WEDDING APP — Elegant Interactive Edition
// =============================================

const App = {
  // State
  currentPage: 'home',
  currentGuest: null,
  participants: [],
  rsvpStatus: 'confirmed',
  adminLoggedIn: false,
  adminTab: 'dashboard',
  weddingInfo: null,
  envelopeOpened: false,

  // ==================
  // INITIALIZATION
  // ==================
  async init() {
    if (!this.isConfigured()) {
      document.getElementById('envelope-overlay').classList.add('hidden');
      document.getElementById('app').classList.remove('app-hidden');
      document.getElementById('app').classList.add('app-visible');
      this.renderSetup();
      return;
    }

    // Setup envelope
    this.setupEnvelope();


    // Load data
    try {
      this.weddingInfo = await DB.getWeddingInfo();
    } catch (e) {
      console.error('Errore caricamento:', e);
    }

    // Setup routing and events
    window.addEventListener('hashchange', () => this.route());
    const app = document.getElementById('app');
    app.addEventListener('click', (e) => this.handleClick(e));
    app.addEventListener('submit', (e) => this.handleSubmit(e));
    app.addEventListener('change', (e) => this.handleChange(e));
  },

  isConfigured() {
    return typeof firebaseConfig !== 'undefined' &&
      firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';
  },

  // ==================
  // ENVELOPE
  // ==================
  setupEnvelope() {
    const overlay = document.getElementById('envelope-overlay');
    const envelope = document.getElementById('envelope');

    overlay.addEventListener('click', () => {
      if (this.envelopeOpened) return;
      this.envelopeOpened = true;

      // Open envelope
      envelope.classList.add('opened');

      // After letter rises, fade out overlay and show app
      setTimeout(() => {
        overlay.classList.add('hidden');
        const app = document.getElementById('app');
        app.classList.remove('app-hidden');
        app.classList.add('app-visible');
        this.route();

        // Setup scroll reveal
        setTimeout(() => this.setupScrollReveal(), 300);
      }, 1400);
    });
  },



  // ==================
  // SCROLL REVEAL
  // ==================
  setupScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.reveal, .section-title').forEach(el => observer.observe(el));
    this._scrollObserver = observer;
  },

  refreshScrollReveal() {
    setTimeout(() => {
      if (this._scrollObserver) {
        document.querySelectorAll('.reveal, .section-title').forEach(el => {
          this._scrollObserver.observe(el);
        });
      } else {
        this.setupScrollReveal();
      }
    }, 100);
  },

  // ==================
  // ROUTING
  // ==================
  route() {
    const hash = window.location.hash.slice(1) || '/';
    if (hash === '/' || hash === '/home') { this.currentPage = 'home'; this.renderHome(); }
    else if (hash === '/rsvp') { this.currentPage = 'code'; this.renderCodeEntry(); }
    else if (hash === '/rsvp/form') {
      if (!this.currentGuest) { window.location.hash = '/rsvp'; return; }
      this.currentPage = 'rsvp'; this.renderRSVPForm();
    }
    else if (hash === '/rsvp/done') { this.currentPage = 'confirmation'; this.renderConfirmation(); }
    else if (hash === '/admin') {
      this.currentPage = this.adminLoggedIn ? 'admin' : 'admin-login';
      this.adminLoggedIn ? this.renderAdmin() : this.renderAdminLogin();
    }
    else { window.location.hash = '/'; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  navigate(hash) { window.location.hash = hash; },

  // ==================
  // EVENT HANDLERS
  // ==================
  handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.preventDefault();
    const action = btn.dataset.action;
    const value = btn.dataset.value;
    switch (action) {
      case 'navigate': this.navigate(value); break;
      case 'add-participant': this.addParticipant(); break;
      case 'remove-participant': this.removeParticipant(parseInt(value)); break;
      case 'admin-tab': this.adminTab = value; this.renderAdmin(); break;
      case 'copy-code':
        navigator.clipboard.writeText(value).catch(() => {});
        this.showToast('Codice copiato!'); break;
      case 'delete-guest': this.deleteGuest(value); break;
      case 'export-csv': this.exportCSV(); break;
      case 'generate-qr': this.generateQR(); break;
      case 'download-qr': this.downloadQR(); break;
      case 'logout-admin': this.adminLoggedIn = false; this.navigate('/'); break;
      case 'toggle-participants': this.toggleParticipants(value); break;
    }
  },

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.dataset.form;
    switch (name) {
      case 'code-entry': await this.verifyCode(form); break;
      case 'rsvp': await this.submitRSVP(form); break;
      case 'admin-login': await this.adminLogin(form); break;
      case 'add-guest': await this.addGuest(form); break;
      case 'wedding-settings': await this.saveSettings(form); break;
      case 'admin-password': await this.saveAdminPassword(form); break;
    }
  },

  handleChange(e) {
    if (e.target.name === 'rsvp_status') {
      this.syncParticipants();
      this.rsvpStatus = e.target.value;
      this.renderRSVPForm();
    }
  },

  // ==================
  // RSVP LOGIC
  // ==================
  syncParticipants() {
    const form = document.querySelector('[data-form="rsvp"]');
    if (!form) return;
    this.participants = this.participants.map((p, i) => ({
      full_name: form.querySelector(`[name="name_${i}"]`)?.value || p.full_name,
      is_child: form.querySelector(`[name="child_${i}"]`)?.checked || false,
      intolerances: form.querySelector(`[name="intol_${i}"]`)?.value || p.intolerances,
    }));
  },

  addParticipant() {
    if (this.participants.length >= this.currentGuest.max_guests) {
      this.showToast(`Massimo ${this.currentGuest.max_guests} partecipanti`);
      return;
    }
    this.syncParticipants();
    this.participants.push({ full_name: '', is_child: false, intolerances: '' });
    this.renderRSVPForm();
  },

  removeParticipant(index) {
    this.syncParticipants();
    this.participants.splice(index, 1);
    this.renderRSVPForm();
  },

  async verifyCode(form) {
    const code = form.querySelector('[name="code"]').value;
    if (!code.trim()) { this.showToast('Inserisci il codice invito'); return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Verifica in corso...';
    try {
      const guest = await DB.getGuestByCode(code);
      if (!guest) {
        this.showToast('Codice non valido');
        btn.disabled = false; btn.textContent = 'Verifica';
        return;
      }
      this.currentGuest = guest;
      const existingParts = await DB.getParticipants(guest.id);
      if (existingParts.length > 0) {
        this.participants = existingParts.map(p => ({
          full_name: p.full_name, is_child: p.is_child, intolerances: p.intolerances
        }));
        this.rsvpStatus = guest.status === 'declined' ? 'declined' : 'confirmed';
      } else {
        this.participants = [{ full_name: '', is_child: false, intolerances: '' }];
        this.rsvpStatus = 'confirmed';
      }
      this.navigate('/rsvp/form');
    } catch (e) {
      console.error(e);
      this.showToast('Errore di connessione');
      btn.disabled = false; btn.textContent = 'Verifica';
    }
  },

  async submitRSVP(form) {
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Invio in corso...';
    try {
      if (this.rsvpStatus === 'confirmed') {
        this.syncParticipants();
        if (this.participants.some(p => !p.full_name.trim())) {
          this.showToast('Inserisci il nome di tutti i partecipanti');
          btn.disabled = false; btn.textContent = 'Invia Risposta';
          return;
        }
        await DB.saveParticipants(this.currentGuest.id, this.participants);
        await DB.updateGuest(this.currentGuest.id, { status: 'confirmed', rsvp_date: new Date().toISOString() });
      } else {
        await DB.saveParticipants(this.currentGuest.id, []);
        await DB.updateGuest(this.currentGuest.id, { status: 'declined', rsvp_date: new Date().toISOString() });
      }
      this.navigate('/rsvp/done');
    } catch (e) {
      console.error(e);
      this.showToast('Errore durante il salvataggio');
      btn.disabled = false; btn.textContent = 'Invia Risposta';
    }
  },

  // ==================
  // ADMIN LOGIC
  // ==================
  async adminLogin(form) {
    const pwd = form.querySelector('[name="password"]').value;
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const adminPwd = await DB.getAdminPassword();
      if (pwd === adminPwd) { this.adminLoggedIn = true; this.navigate('/admin'); }
      else { this.showToast('Password errata'); btn.disabled = false; }
    } catch (e) {
      console.error(e); this.showToast('Errore di connessione'); btn.disabled = false;
    }
  },

  async addGuest(form) {
    const name = form.querySelector('[name="family_name"]').value.trim();
    const max = parseInt(form.querySelector('[name="max_guests"]').value) || 2;
    const code = form.querySelector('[name="code"]').value.trim().toUpperCase();
    if (!name || !code) { this.showToast('Compila tutti i campi'); return; }
    try {
      const existing = await DB.getGuestByCode(code);
      if (existing) { this.showToast('Codice già in uso'); return; }
      await DB.addGuest(name, max, code);
      this.showToast('Invitato aggiunto!');
      this.renderAdmin();
    } catch (e) { console.error(e); this.showToast('Errore durante il salvataggio'); }
  },

  async deleteGuest(guestId) {
    if (!confirm('Sei sicuro di voler eliminare questo invitato?')) return;
    try {
      await DB.deleteGuest(guestId);
      this.showToast('Invitato eliminato');
      this.renderAdmin();
    } catch (e) { console.error(e); this.showToast('Errore durante l\'eliminazione'); }
  },

  async saveSettings(form) {
    const data = {};
    ['spouse1_name','spouse2_name','ceremony_date','ceremony_time','ceremony_location',
     'ceremony_address','reception_location','reception_address','reception_time',
     'dress_code','notes'].forEach(key => {
      const el = form.querySelector(`[name="${key}"]`);
      if (el) data[key] = el.value;
    });
    try {
      await DB.updateWeddingInfo(data);
      this.weddingInfo = data;
      this.showToast('Impostazioni salvate!');
    } catch (e) { console.error(e); this.showToast('Errore durante il salvataggio'); }
  },

  async saveAdminPassword(form) {
    const pwd = form.querySelector('[name="new_password"]').value;
    if (!pwd || pwd.length < 4) { this.showToast('La password deve avere almeno 4 caratteri'); return; }
    try {
      await DB.updateAdminPassword(pwd);
      this.showToast('Password aggiornata!');
    } catch (e) { console.error(e); this.showToast('Errore'); }
  },

  async exportCSV() {
    try {
      const guests = await DB.getAllGuests();
      const allParts = await DB.getAllParticipants();
      let csv = 'Famiglia,Codice,Max Ospiti,Stato,Data RSVP,Partecipante,Bambino,Intolleranze\n';
      for (const g of guests) {
        const parts = allParts[g.id] || [];
        if (parts.length === 0) {
          csv += `"${g.family_name}","${g.invitation_code}",${g.max_guests},"${g.status}","${g.rsvp_date || ''}","","",""\n`;
        } else {
          for (const p of parts) {
            csv += `"${g.family_name}","${g.invitation_code}",${g.max_guests},"${g.status}","${g.rsvp_date || ''}","${p.full_name}","${p.is_child ? 'Sì' : 'No'}","${p.intolerances}"\n`;
          }
        }
      }
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'invitati_matrimonio.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      this.showToast('CSV scaricato!');
    } catch (e) { console.error(e); this.showToast('Errore esportazione'); }
  },

  generateQR() {
    const url = document.querySelector('[name="site_url"]')?.value || window.location.href.split('#')[0];
    const container = document.getElementById('qr-output');
    if (!container) return;
    container.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      QRCode.toCanvas(canvas, url, { width: 280, margin: 2, color: { dark: '#5c1a2a', light: '#ffffff' } }, (err) => {
        if (err) console.error(err);
      });
    }
  },

  downloadQR() {
    const canvas = document.querySelector('#qr-output canvas');
    if (!canvas) { this.showToast('Genera prima il QR'); return; }
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'qr_matrimonio.png';
    a.click();
    this.showToast('QR scaricato!');
  },

  toggleParticipants(guestId) {
    const el = document.getElementById(`parts-${guestId}`);
    if (el) el.classList.toggle('hidden');
  },

  // ==================
  // PAGE RENDERERS
  // ==================

  renderSetup() {
    document.getElementById('app').innerHTML = `
      <div class="page">
        <div class="setup-message">
          <div style="font-size:3rem;margin-bottom:16px;">⚙️</div>
          <h2>Configurazione Necessaria</h2>
          <p class="text-muted mt-2">Apri il file <strong>js/config.js</strong> e inserisci le tue credenziali Firebase.</p>
          <code>const firebaseConfig = {
  apiKey: "la-tua-api-key",
  authDomain: "progetto.firebaseapp.com",
  projectId: "il-tuo-project-id",
  ...
};</code>
        </div>
      </div>`;
  },

  async renderHome() {
    const info = this.weddingInfo || await DB.getWeddingInfo();
    this.weddingInfo = info;
    const dateObj = info.ceremony_date ? new Date(info.ceremony_date + 'T00:00:00') : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';

    // Countdown
    let countdownHtml = '';
    if (dateObj) {
      const now = new Date();
      const diff = dateObj.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        countdownHtml = `
          <div class="hero-countdown">
            <div class="countdown-item"><span class="countdown-number">${days}</span><span class="countdown-label">giorni</span></div>
            <div class="countdown-item"><span class="countdown-number">${hours}</span><span class="countdown-label">ore</span></div>
            <div class="countdown-item"><span class="countdown-number">${mins}</span><span class="countdown-label">minuti</span></div>
          </div>`;
      }
    }

    document.getElementById('app').innerHTML = `
      <div class="page">
        <div class="hero">
          <p class="hero-ornament">✦ Siete invitati ✦</p>
          <h1>${this.esc(info.spouse1_name)} <span class="ampersand">&</span> ${this.esc(info.spouse2_name)}</h1>
          <p class="hero-date">${dateStr}</p>
          ${countdownHtml}
          <div class="hero-divider"></div>
        </div>

        <div class="section-title">
          <span class="icon">⛪</span>
          <h2>La Cerimonia</h2>
          <p class="subtitle">Rito Religioso</p>
        </div>

        <div class="card reveal">
          <div class="info-row">
            <span class="info-icon">📅</span>
            <div class="info-content">
              <h4>Data e Ora</h4>
              <p>${dateStr} alle ${this.esc(info.ceremony_time)}</p>
            </div>
          </div>
          <div class="info-row">
            <span class="info-icon">📍</span>
            <div class="info-content">
              <h4>${this.esc(info.ceremony_location)}</h4>
              <p class="text-muted text-small">${this.esc(info.ceremony_address)}</p>
            </div>
          </div>
        </div>

        <div class="section-title">
          <span class="icon">🥂</span>
          <h2>Il Ricevimento</h2>
          <p class="subtitle">Festeggiamo insieme</p>
        </div>

        <div class="card reveal">
          <div class="info-row">
            <span class="info-icon">🕐</span>
            <div class="info-content">
              <h4>Ora</h4>
              <p>A partire dalle ${this.esc(info.reception_time)}</p>
            </div>
          </div>
          <div class="info-row">
            <span class="info-icon">📍</span>
            <div class="info-content">
              <h4>${this.esc(info.reception_location)}</h4>
              <p class="text-muted text-small">${this.esc(info.reception_address)}</p>
            </div>
          </div>
        </div>

        ${info.dress_code ? `
        <div class="card card-elegant reveal">
          <span style="font-size:1.8rem;display:block;margin-bottom:8px;">👔</span>
          <h3 style="margin-bottom:4px;">Dress Code</h3>
          <p class="text-muted">${this.esc(info.dress_code)}</p>
        </div>` : ''}

        ${info.notes ? `
        <div class="card card-elegant reveal">
          <p style="font-family:var(--font-heading);font-size:1.15rem;font-style:italic;color:var(--text-medium);line-height:1.6;margin:0;">
            "${this.esc(info.notes)}"
          </p>
        </div>` : ''}

        <div class="divider"><span>💍</span></div>

        <div class="reveal">
          <button class="btn btn-primary btn-block" data-action="navigate" data-value="/rsvp" style="font-size:1.05rem;padding:18px;">
            💌 Conferma Partecipazione
          </button>
        </div>

        <div class="footer">
          <a href="#" data-action="navigate" data-value="/admin">🔐 Area Sposi</a>
        </div>
      </div>`;

    this.refreshScrollReveal();
  },

  renderCodeEntry() {
    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" data-action="navigate" data-value="/">← Torna alla home</button>
        <div class="text-center mb-3">
          <span style="font-size:3rem;display:block;margin-bottom:12px;">💌</span>
          <h2 style="font-family:var(--font-heading);font-size:1.8rem;font-weight:400;">Conferma Partecipazione</h2>
          <p class="text-muted mt-1">Inserisci il codice presente sul tuo invito</p>
        </div>
        <div class="card">
          <form data-form="code-entry">
            <div class="form-group">
              <label class="form-label">Codice Invito</label>
              <input type="text" name="code" class="form-input" placeholder="Es: ROSSI1"
                     autocomplete="off" autocapitalize="characters"
                     style="text-transform:uppercase;text-align:center;font-size:1.2rem;letter-spacing:3px;">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Verifica</button>
          </form>
        </div>
      </div>`;
  },

  renderRSVPForm() {
    const guest = this.currentGuest;
    if (!guest) return;
    const cards = this.participants.map((p, i) => `
      <div class="participant-card">
        <div class="participant-header">
          <span class="participant-number">Partecipante ${i + 1}</span>
          ${this.participants.length > 1 ? `<button type="button" class="btn btn-sm btn-danger-outline" data-action="remove-participant" data-value="${i}">✕</button>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Nome e Cognome</label>
          <input type="text" name="name_${i}" class="form-input" value="${this.esc(p.full_name)}" placeholder="Nome Cognome">
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" name="child_${i}" ${p.is_child ? 'checked' : ''}>
            <span>Bambino/a (sotto i 12 anni)</span>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">Intolleranze / Allergie</label>
          <textarea name="intol_${i}" class="form-textarea" placeholder="Es: celiaco, lattosio..." rows="2">${this.esc(p.intolerances)}</textarea>
        </div>
      </div>`).join('');

    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" data-action="navigate" data-value="/rsvp">← Cambia codice</button>
        <div class="text-center mb-3">
          <h2 style="font-family:var(--font-heading);font-size:1.8rem;font-weight:400;">Famiglia ${this.esc(guest.family_name)}</h2>
          <p class="text-muted">Fino a ${guest.max_guests} partecipant${guest.max_guests === 1 ? 'e' : 'i'}</p>
        </div>
        <form data-form="rsvp">
          <div class="card mb-2">
            <label class="form-label mb-1">Parteciperete al matrimonio?</label>
            <div class="radio-group">
              <div class="radio-option">
                <input type="radio" name="rsvp_status" id="status-yes" value="confirmed" ${this.rsvpStatus === 'confirmed' ? 'checked' : ''}>
                <label for="status-yes">✅ Sì, ci saremo!</label>
              </div>
              <div class="radio-option">
                <input type="radio" name="rsvp_status" id="status-no" value="declined" ${this.rsvpStatus === 'declined' ? 'checked' : ''}>
                <label for="status-no">😔 No, purtroppo</label>
              </div>
            </div>
          </div>

          ${this.rsvpStatus === 'confirmed' ? `
            ${cards}
            ${this.participants.length < guest.max_guests ? `
              <button type="button" class="btn btn-secondary btn-block mb-2" data-action="add-participant">
                ➕ Aggiungi Partecipante
              </button>` : ''}
          ` : `
            <div class="card card-elegant">
              <p style="font-size:1.5rem;margin-bottom:8px;">😔</p>
              <p class="text-muted" style="margin:0;font-style:italic;">Ci dispiace che non possiate venire!</p>
            </div>
          `}

          <button type="submit" class="btn btn-primary btn-block mt-2" style="font-size:1.05rem;padding:16px;">
            Invia Risposta
          </button>
        </form>
      </div>`;
  },

  renderConfirmation() {
    const ok = this.rsvpStatus === 'confirmed';
    document.getElementById('app').innerHTML = `
      <div class="page">
        <div class="text-center" style="padding-top:40px;">
          <span style="font-size:4rem;display:block;margin-bottom:16px;">${ok ? '🎉' : '💌'}</span>
          <h2 style="font-family:var(--font-heading);font-size:2rem;font-weight:400;">${ok ? 'Grazie per la conferma!' : 'Risposta registrata'}</h2>
          <p class="text-muted mt-2" style="font-style:italic;">${ok
            ? 'Non vediamo l\'ora di festeggiare con voi!'
            : 'Ci dispiace che non possiate esserci. Vi penseremo!'}</p>
          ${ok && this.participants.length > 0 ? `
            <div class="card mt-3 text-left">
              <h3 class="mb-1">Riepilogo</h3>
              ${this.participants.map(p => `
                <div style="padding:10px 0;border-bottom:1px solid var(--border-light);">
                  <strong>${this.esc(p.full_name)}</strong>
                  ${p.is_child ? ' <span class="badge badge-neutral" style="background:var(--cream);color:var(--text-medium);">Bambino</span>' : ''}
                  ${p.intolerances ? `<br><span class="text-small text-muted">⚠️ ${this.esc(p.intolerances)}</span>` : ''}
                </div>`).join('')}
            </div>` : ''}
          <button class="btn btn-primary btn-block mt-3" data-action="navigate" data-value="/">
            🏠 Torna alla Home
          </button>
        </div>
      </div>`;
  },

  renderAdminLogin() {
    document.getElementById('app').innerHTML = `
      <div class="page">
        <button class="back-btn" data-action="navigate" data-value="/">← Torna alla home</button>
        <div class="text-center mb-3">
          <span style="font-size:3rem;display:block;margin-bottom:12px;">🔐</span>
          <h2 style="font-family:var(--font-heading);font-size:1.8rem;font-weight:400;">Area Sposi</h2>
          <p class="text-muted">Inserisci la password per accedere</p>
        </div>
        <div class="card">
          <form data-form="admin-login">
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" name="password" class="form-input" placeholder="Password">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Accedi</button>
          </form>
        </div>
      </div>`;
  },

  async renderAdmin() {
    if (!this.adminLoggedIn) { this.renderAdminLogin(); return; }
    let content = '<div class="loading-screen"><div class="spinner"></div></div>';
    const tabs = [
      { id: 'dashboard', icon: '📊', label: 'Home' },
      { id: 'guests', icon: '👥', label: 'Invitati' },
      { id: 'settings', icon: '⚙️', label: 'Info' },
      { id: 'qr', icon: '📱', label: 'QR' }
    ];
    const navHtml = tabs.map(t => `
      <button class="nav-item ${this.adminTab === t.id ? 'active' : ''}" data-action="admin-tab" data-value="${t.id}">
        <span class="nav-item-icon">${t.icon}</span>${t.label}
      </button>`).join('');

    document.getElementById('app').innerHTML = `
      <div class="admin-layout">
        <div class="page-wide">
          <div class="flex-between mb-2">
            <h2 style="font-family:var(--font-heading);font-weight:400;">Area Sposi</h2>
            <button class="btn btn-sm btn-outline" data-action="logout-admin">Esci</button>
          </div>
          <div id="admin-content">${content}</div>
        </div>
        <nav class="bottom-nav">${navHtml}</nav>
      </div>`;

    const target = document.getElementById('admin-content');
    try {
      switch (this.adminTab) {
        case 'dashboard': target.innerHTML = await this.renderAdminDashboard(); break;
        case 'guests': target.innerHTML = await this.renderAdminGuests(); break;
        case 'settings': target.innerHTML = await this.renderAdminSettings(); break;
        case 'qr': target.innerHTML = this.renderAdminQR(); setTimeout(() => this.generateQR(), 100); break;
      }
    } catch (e) {
      console.error(e);
      target.innerHTML = '<div class="card"><p>Errore nel caricamento dei dati</p></div>';
    }
  },

  async renderAdminDashboard() {
    const guests = await DB.getAllGuests();
    const allParts = await DB.getAllParticipants();
    let confirmed = 0, declined = 0, pending = 0, totalParts = 0, children = 0;
    const intolerances = [];
    for (const g of guests) {
      if (g.status === 'confirmed') confirmed++;
      else if (g.status === 'declined') declined++;
      else pending++;
      const parts = allParts[g.id] || [];
      totalParts += parts.length;
      for (const p of parts) {
        if (p.is_child) children++;
        if (p.intolerances?.trim()) intolerances.push({ name: p.full_name, text: p.intolerances });
      }
    }
    return `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number">${guests.length}</div><div class="stat-label">Famiglie</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--success)">${confirmed}</div><div class="stat-label">Confermate</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--danger)">${declined}</div><div class="stat-label">Declinate</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--warning)">${pending}</div><div class="stat-label">In Attesa</div></div>
        <div class="stat-card"><div class="stat-number">${totalParts}</div><div class="stat-label">Persone</div></div>
        <div class="stat-card"><div class="stat-number">${children}</div><div class="stat-label">Bambini</div></div>
      </div>
      ${intolerances.length > 0 ? `
        <div class="card">
          <h3 class="mb-2">⚠️ Intolleranze Alimentari</h3>
          ${intolerances.map(i => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border-light);">
              <strong>${this.esc(i.name)}</strong><br>
              <span class="text-small text-muted">${this.esc(i.text)}</span>
            </div>`).join('')}
        </div>` : '<div class="card card-elegant"><p class="text-muted" style="margin:0;">Nessuna intolleranza segnalata</p></div>'}`;
  },

  async renderAdminGuests() {
    const guests = await DB.getAllGuests();
    const allParts = await DB.getAllParticipants();
    const items = guests.map(g => {
      const parts = allParts[g.id] || [];
      const badge = g.status === 'confirmed' ? 'badge-success' : g.status === 'declined' ? 'badge-danger' : 'badge-warning';
      const label = g.status === 'confirmed' ? 'Confermato' : g.status === 'declined' ? 'Declinato' : 'In attesa';
      return `
        <div class="guest-item">
          <div class="guest-header">
            <span class="guest-name">${this.esc(g.family_name)}</span>
            <span class="badge ${badge}">${label}</span>
          </div>
          <div class="guest-meta">
            <span class="guest-code" data-action="copy-code" data-value="${this.esc(g.invitation_code)}">📋 ${this.esc(g.invitation_code)}</span>
            <span>👥 Max: ${g.max_guests}</span>
            <button class="btn btn-sm btn-danger-outline" data-action="delete-guest" data-value="${g.id}" style="margin-left:auto;font-size:0.75rem;">🗑️</button>
          </div>
          ${parts.length > 0 ? `
            <div style="margin-top:10px;">
              <button class="btn btn-sm btn-outline" data-action="toggle-participants" data-value="${g.id}" style="font-size:0.8rem;">
                👥 ${parts.length} partecipant${parts.length === 1 ? 'e' : 'i'}
              </button>
              <div id="parts-${g.id}" class="guest-participants hidden">
                ${parts.map(p => `
                  <li>${this.esc(p.full_name)}${p.is_child ? ' 👶' : ''}${p.intolerances ? ` <span class="intolerance-tag">${this.esc(p.intolerances)}</span>` : ''}</li>`).join('')}
              </div>
            </div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <h3 class="mb-2">➕ Aggiungi Invitato</h3>
        <form data-form="add-guest">
          <div class="form-group">
            <label class="form-label">Cognome Famiglia</label>
            <input type="text" name="family_name" class="form-input" placeholder="Es: Rossi" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Max Ospiti</label>
              <input type="number" name="max_guests" class="form-input" value="2" min="1" max="20">
            </div>
            <div class="form-group">
              <label class="form-label">Codice Invito</label>
              <input type="text" name="code" class="form-input" placeholder="Es: ROSSI1" style="text-transform:uppercase;" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Aggiungi</button>
        </form>
      </div>
      <div class="flex-between mb-2">
        <h3>📋 Invitati (${guests.length})</h3>
        <button class="btn btn-sm btn-outline" data-action="export-csv">📥 CSV</button>
      </div>
      ${items || '<div class="card card-elegant"><p class="text-muted" style="margin:0;">Nessun invitato ancora</p></div>'}`;
  },

  async renderAdminSettings() {
    const info = this.weddingInfo || await DB.getWeddingInfo();
    return `
      <div class="card">
        <h3 class="mb-2">💒 Informazioni Matrimonio</h3>
        <form data-form="wedding-settings">
          <div class="form-row">
            <div class="form-group"><label class="form-label">Nome Sposo</label><input type="text" name="spouse1_name" class="form-input" value="${this.esc(info.spouse1_name)}"></div>
            <div class="form-group"><label class="form-label">Nome Sposa</label><input type="text" name="spouse2_name" class="form-input" value="${this.esc(info.spouse2_name)}"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Data Cerimonia</label><input type="date" name="ceremony_date" class="form-input" value="${info.ceremony_date || ''}"></div>
            <div class="form-group"><label class="form-label">Ora Cerimonia</label><input type="time" name="ceremony_time" class="form-input" value="${info.ceremony_time || ''}"></div>
          </div>
          <div class="form-group"><label class="form-label">Luogo Cerimonia</label><input type="text" name="ceremony_location" class="form-input" value="${this.esc(info.ceremony_location)}"></div>
          <div class="form-group"><label class="form-label">Indirizzo Cerimonia</label><input type="text" name="ceremony_address" class="form-input" value="${this.esc(info.ceremony_address)}"></div>
          <div class="form-group"><label class="form-label">Luogo Ricevimento</label><input type="text" name="reception_location" class="form-input" value="${this.esc(info.reception_location)}"></div>
          <div class="form-group"><label class="form-label">Indirizzo Ricevimento</label><input type="text" name="reception_address" class="form-input" value="${this.esc(info.reception_address)}"></div>
          <div class="form-group"><label class="form-label">Ora Ricevimento</label><input type="time" name="reception_time" class="form-input" value="${info.reception_time || ''}"></div>
          <div class="form-group"><label class="form-label">Dress Code</label><input type="text" name="dress_code" class="form-input" value="${this.esc(info.dress_code)}"></div>
          <div class="form-group"><label class="form-label">Note per gli invitati</label><textarea name="notes" class="form-textarea">${this.esc(info.notes)}</textarea></div>
          <button type="submit" class="btn btn-primary btn-block">💾 Salva Modifiche</button>
        </form>
      </div>
      <div class="card">
        <h3 class="mb-2">🔑 Password Admin</h3>
        <form data-form="admin-password">
          <div class="form-group"><label class="form-label">Nuova Password</label><input type="text" name="new_password" class="form-input" placeholder="Min 4 caratteri"></div>
          <button type="submit" class="btn btn-secondary btn-block">Aggiorna Password</button>
        </form>
      </div>`;
  },

  renderAdminQR() {
    const baseUrl = window.location.href.split('#')[0];
    return `
      <div class="card">
        <h3 class="mb-2 text-center">📱 QR Code del Sito</h3>
        <p class="text-muted text-center text-small mb-2">Genera il QR code da stampare sui tuoi inviti</p>
        <div class="form-group">
          <label class="form-label">URL del sito</label>
          <input type="url" name="site_url" class="form-input" value="${baseUrl}">
        </div>
        <button class="btn btn-primary btn-block mb-2" data-action="generate-qr">🔄 Genera QR</button>
        <div id="qr-output" class="qr-container"></div>
        <button class="btn btn-secondary btn-block mt-2" data-action="download-qr">📥 Scarica QR</button>
      </div>`;
  },

  // ==================
  // UTILITIES
  // ==================
  esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
