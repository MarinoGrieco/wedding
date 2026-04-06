// =============================================
// DATABASE OPERATIONS (Firestore)
// =============================================

const DB = {

  // --- Wedding Info ---
  async getWeddingInfo() {
    const doc = await db.collection('config').doc('wedding').get();
    if (doc.exists) return doc.data();
    const defaults = {
      spouse1_name: 'Nome Sposo',
      spouse2_name: 'Nome Sposa',
      ceremony_date: '2026-09-15',
      ceremony_time: '16:00',
      ceremony_location: 'Chiesa di San Marco',
      ceremony_address: 'Via Roma 1, Milano',
      reception_location: 'Villa dei Fiori',
      reception_address: 'Via dei Giardini 10, Milano',
      reception_time: '19:00',
      dress_code: 'Elegante',
      notes: 'Vi aspettiamo con gioia!'
    };
    await db.collection('config').doc('wedding').set(defaults);
    return defaults;
  },

  async updateWeddingInfo(data) {
    await db.collection('config').doc('wedding').set(data, { merge: true });
  },

  // --- Admin ---
  async getAdminPassword() {
    const doc = await db.collection('config').doc('admin').get();
    if (doc.exists) return doc.data().password;
    await db.collection('config').doc('admin').set({ password: 'sposi2026' });
    return 'sposi2026';
  },

  async updateAdminPassword(pwd) {
    await db.collection('config').doc('admin').set({ password: pwd });
  },

  // --- Guests ---
  async getGuestByCode(code) {
    const snap = await db.collection('guests')
      .where('invitation_code', '==', code.toUpperCase().trim())
      .limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  async getAllGuests() {
    const snap = await db.collection('guests').orderBy('family_name').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async addGuest(familyName, maxGuests, invitationCode) {
    return await db.collection('guests').add({
      family_name: familyName,
      max_guests: maxGuests,
      invitation_code: invitationCode.toUpperCase().trim(),
      status: 'pending',
      rsvp_date: null
    });
  },

  async updateGuest(guestId, data) {
    await db.collection('guests').doc(guestId).update(data);
  },

  async deleteGuest(guestId) {
    const parts = await db.collection('guests').doc(guestId)
      .collection('participants').get();
    const batch = db.batch();
    parts.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('guests').doc(guestId));
    await batch.commit();
  },

  // --- Participants ---
  async getParticipants(guestId) {
    const snap = await db.collection('guests').doc(guestId)
      .collection('participants').orderBy('full_name').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  async saveParticipants(guestId, participants) {
    const existing = await db.collection('guests').doc(guestId)
      .collection('participants').get();
    const batch = db.batch();
    existing.docs.forEach(doc => batch.delete(doc.ref));
    participants.forEach(p => {
      const ref = db.collection('guests').doc(guestId)
        .collection('participants').doc();
      batch.set(ref, {
        full_name: p.full_name,
        is_child: p.is_child || false,
        intolerances: p.intolerances || ''
      });
    });
    await batch.commit();
  },

  async getAllParticipants() {
    const guests = await this.getAllGuests();
    const result = {};
    for (const guest of guests) {
      result[guest.id] = await this.getParticipants(guest.id);
    }
    return result;
  }
};
