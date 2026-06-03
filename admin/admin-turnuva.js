// ═══════════════════════════════════════
//  FIREBASE CONFIG — DOLDURULACAK
// ═══════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBIQjusSRbegCXwMBTJnZXWq9gn0sSvtc8",
  authDomain: "tarsus-turnuva.firebaseapp.com",
  projectId: "tarsus-turnuva",
  storageBucket: "tarsus-turnuva.firebasestorage.app",
  messagingSenderId: "570229008546",
  appId: "1:570229008546:web:e9eeac023c923a24654ffb"
};
const USE_FIREBASE = FIREBASE_CONFIG.apiKey !== "";

// ═══════════════════════════════════════
//  TAKIM VERİLERİ
// ═══════════════════════════════════════
const GRUPLAR = {
  'A': ['BEYLİCE','ÇİRİŞTEPE','İNKÖY','KARADİKEN','KÖSELERLİ','OLUKKOYAĞI','YEŞİLKUYU'],
  'B': ['AĞZIDELİK','ALİBEYLİ','GÜLEK','HACIHAMZALI','KARADİRLİK','KUZOLUK'],
  'C': ['ALİEFENDİOĞLU','EGEMEN','KIZILÇUKUR','SARIKOYAK','TOPAKLI','YANIKKIŞLA','YEŞİLTEPE'],
  'D': ['ATALAR','ÇAKIRLI','ÇAVDARLI FK','ÇAVUŞLU','KEFELİ','TAŞÇILI'],
  'E': ['AKARSU','CİNKÖY','GÖÇÜK','SARIKAVAK','SIRAKÖY','TAŞKUYU','TEPEKÖY'],
  'F': ['BOLATLI','DEDELER','KAKLIKTAŞI','KULAK','MEŞELİK','YENİCE'],
  'G': ['AKGEDİK','BÖĞRUEĞRİ','BOĞAZPINAR','EMİRLER','KADELLİ','KALEBURCU','KARAKÜTÜK'],
  'H': ['ALİFAKI','ARDIÇLI','BAHŞİŞ','DAMLAMA','KAYADİBİ','SAĞLIKLI','SEBİL FK']
};

// ═══════════════════════════════════════
//  STATE
// ═══════════════════════════════════════
let db = null, auth = null;
let takimlar = {};
let maclar = [];
let aktifHafta = 1;
let toplamHafta = 6;

// ═══════════════════════════════════════
//  INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (USE_FIREBASE) {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    auth = firebase.auth();
  } else {
    initMockMode();
  }
  lucide.createIcons();
});

function initMockMode() {
  // Mock login bypass
  document.getElementById('loginEmail').value = 'alperen@admin.com';
  document.getElementById('loginPass').value = '123456';

  // Init mock teams
  takimlar = {};
  Object.entries(GRUPLAR).forEach(([grup, adlar]) => {
    adlar.forEach(ad => {
      const id = generateId(ad);
      takimlar[id] = { id, ad, grup, o:0, g:0, b:0, m:0, ag:0, yg:0, av:0, p:0 };
    });
  });
  maclar = [];
}

function generateId(ad) {
  return ad.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9ğüşıöçĞÜŞİÖÇ_]/gi,'') + '_' + Math.random().toString(36).substr(2,4);
}

// ═══════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginErr');
  errEl.classList.add('hidden');

  if (USE_FIREBASE) {
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      showApp();
    } catch(e) {
      errEl.textContent = 'Hatalı e-posta veya şifre.';
      errEl.classList.remove('hidden');
    }
  } else {
    // Mock login
    if (email === 'alperen@admin.com' && pass === '123456') {
      showApp();
    } else {
      errEl.textContent = 'Mock giriş: alperen@admin.com / 123456';
      errEl.classList.remove('hidden');
    }
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginScreen').classList.contains('hidden')) doLogin();
});

function doLogout() {
  if (USE_FIREBASE) auth.signOut();
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userEmail').textContent = document.getElementById('loginEmail').value;

  if (USE_FIREBASE) {
    listenFirebase();
    checkAndSeedDatabase();
  }
  populateForm();
  renderStats();
  renderMacListesi();
}

// ═══════════════════════════════════════
//  FIREBASE LISTENERS
// ═══════════════════════════════════════
function listenFirebase() {
  db.collection('ayarlar').doc('turnuva').onSnapshot(doc => {
    if (doc.exists) {
      aktifHafta = doc.data().aktifHafta || 1;
      toplamHafta = doc.data().toplamHafta || 6;
      document.getElementById('aktifHaftaLabel').textContent = aktifHafta;
    }
  });

  db.collection('takimlar').onSnapshot(snap => {
    takimlar = {};
    snap.forEach(d => { takimlar[d.id] = { id: d.id, ...d.data() }; });
    renderStats();
  });

  db.collection('maclar').orderBy('olusturmaTarihi','desc').onSnapshot(snap => {
    maclar = [];
    snap.forEach(d => { maclar.push({ id: d.id, ...d.data() }); });
    renderMacListesi();
    renderStats();
  });
}

// ═══════════════════════════════════════
//  FORM DOLDURMA
// ═══════════════════════════════════════
function populateForm() {
  // Hafta dropdown
  const haftaSel = document.getElementById('macHafta');
  haftaSel.innerHTML = '';
  for (let i = 1; i <= toplamHafta; i++) {
    haftaSel.innerHTML += `<option value="${i}">${i}. Hafta</option>`;
  }

  // Grup dropdown
  const grupSel = document.getElementById('macGrup');
  grupSel.innerHTML = Object.keys(GRUPLAR).map(g => `<option value="${g}">${g} Grubu</option>`).join('');

  // Filtre grup dropdown
  const filtrSel = document.getElementById('filtrGrup');
  filtrSel.innerHTML = '<option value="all">Tüm Gruplar</option>' +
    Object.keys(GRUPLAR).map(g => `<option value="${g}">${g} Grubu</option>`).join('');

  // Aktif hafta
  document.getElementById('aktifHaftaLabel').textContent = aktifHafta;

  grupSecildi();
}

function grupSecildi() {
  const grup = document.getElementById('macGrup').value;
  const takimAdlari = GRUPLAR[grup] || [];
  const evSel = document.getElementById('macEv');
  const depSel = document.getElementById('macDep');
  evSel.innerHTML = '<option value="">Takım Seç</option>' + takimAdlari.map(a => `<option value="${a}">${a}</option>`).join('');
  depSel.innerHTML = '<option value="">Takım Seç</option>' + takimAdlari.map(a => `<option value="${a}">${a}</option>`).join('');
}

// ═══════════════════════════════════════
//  MAÇ KAYDET
// ═══════════════════════════════════════
async function macKaydet() {
  const hafta = parseInt(document.getElementById('macHafta').value);
  const grup = document.getElementById('macGrup').value;
  const evAd = document.getElementById('macEv').value;
  const depAd = document.getElementById('macDep').value;
  const evSkor = parseInt(document.getElementById('macEvSkor').value) || 0;
  const depSkor = parseInt(document.getElementById('macDepSkor').value) || 0;
  const durum = document.getElementById('macDurum').value;

  if (!evAd || !depAd) return showToast('Takım seçiniz!','error');
  if (evAd === depAd && durum !== 'bay') return showToast('Aynı takım seçilemez!','error');

  const btn = document.getElementById('btnKaydet');
  btn.disabled = true; btn.textContent = '⏳ Kaydediliyor...';

  try {
    if (USE_FIREBASE) {
      await firebaseMacKaydet(hafta, grup, evAd, depAd, evSkor, depSkor, durum);
    } else {
      mockMacKaydet(hafta, grup, evAd, depAd, evSkor, depSkor, durum);
    }
    showToast('Maç başarıyla kaydedildi!','success');
    document.getElementById('macEvSkor').value = '0';
    document.getElementById('macDepSkor').value = '0';
  } catch(e) {
    showToast('Hata: ' + e.message,'error');
  }
  btn.disabled = false; btn.textContent = '💾 Maçı Kaydet';
}

async function firebaseMacKaydet(hafta, grup, evAd, depAd, evSkor, depSkor, durum) {
  const evTakim = Object.values(takimlar).find(t => t.ad === evAd && t.grup === grup);
  const depTakim = Object.values(takimlar).find(t => t.ad === depAd && t.grup === grup);
  if (!evTakim || !depTakim) throw new Error('Takımlar bulunamadı');

  const batch = db.batch();
  const inc = firebase.firestore.FieldValue.increment;

  // Maç dokümanı ekle
  const macRef = db.collection('maclar').doc();
  batch.set(macRef, {
    grup, hafta, evSahibiId: evTakim.id, evSahibiAd: evAd,
    deplasmanId: depTakim.id, deplasmanAd: depAd,
    evSahibiSkor: evSkor, deplasmanSkor: depSkor, durum: durum || 'oynandi',
    olusturmaTarihi: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Sadece maç oynanmışsa istatistikleri güncelle
  if (!durum || durum === 'oynandi') {
    const evRef = db.collection('takimlar').doc(evTakim.id);
    const depRef = db.collection('takimlar').doc(depTakim.id);
    const evUp = { o: inc(1), ag: inc(evSkor), yg: inc(depSkor), av: inc(evSkor - depSkor) };
    const depUp = { o: inc(1), ag: inc(depSkor), yg: inc(evSkor), av: inc(depSkor - evSkor) };

    if (evSkor > depSkor) { evUp.g = inc(1); evUp.p = inc(3); depUp.m = inc(1); }
    else if (evSkor < depSkor) { depUp.g = inc(1); depUp.p = inc(3); evUp.m = inc(1); }
    else { evUp.b = inc(1); evUp.p = inc(1); depUp.b = inc(1); depUp.p = inc(1); }

    batch.update(evRef, evUp);
    batch.update(depRef, depUp);
  }
  await batch.commit();
}

function mockMacKaydet(hafta, grup, evAd, depAd, evSkor, depSkor, durum) {
  const ev = Object.values(takimlar).find(t => t.ad === evAd);
  const dep = Object.values(takimlar).find(t => t.ad === depAd);
  if (!ev || !dep) throw new Error('Takım bulunamadı');

  const macId = 'mac_' + Date.now();
  const mac = { id: macId, grup, hafta, evSahibiId: ev.id, evSahibiAd: evAd, deplasmanId: dep.id, deplasmanAd: depAd, evSahibiSkor: evSkor, deplasmanSkor: depSkor, durum: durum || 'oynandi', olusturmaTarihi: new Date() };
  maclar.unshift(mac);

  if (!durum || durum === 'oynandi') {
    ev.o++; ev.ag += evSkor; ev.yg += depSkor; ev.av = ev.ag - ev.yg;
    dep.o++; dep.ag += depSkor; dep.yg += evSkor; dep.av = dep.ag - dep.yg;
    if (evSkor > depSkor) { ev.g++; ev.p += 3; dep.m++; }
    else if (evSkor < depSkor) { dep.g++; dep.p += 3; ev.m++; }
    else { ev.b++; ev.p += 1; dep.b++; dep.p += 1; }
  }

  renderMacListesi();
  renderStats();
}

// ═══════════════════════════════════════
//  MAÇ DÜZENLE
// ═══════════════════════════════════════
function openEditModal(macId) {
  const mac = maclar.find(m => m.id === macId);
  if (!mac) return;
  document.getElementById('editMacId').value = macId;
  document.getElementById('editEvSkor').value = mac.evSahibiSkor;
  document.getElementById('editDepSkor').value = mac.deplasmanSkor;
  document.getElementById('editEvLabel').textContent = mac.evSahibiAd;
  document.getElementById('editDepLabel').textContent = mac.deplasmanAd;
  document.getElementById('editMacDurum').value = mac.durum || 'oynandi';
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); }

async function macGuncelle() {
  const macId = document.getElementById('editMacId').value;
  const yeniEvSkor = parseInt(document.getElementById('editEvSkor').value) || 0;
  const yeniDepSkor = parseInt(document.getElementById('editDepSkor').value) || 0;
  const yeniDurum = document.getElementById('editMacDurum').value;
  const mac = maclar.find(m => m.id === macId);
  if (!mac) return;

  try {
    if (USE_FIREBASE) {
      await firebaseMacGuncelle(mac, yeniEvSkor, yeniDepSkor, yeniDurum);
    } else {
      mockMacGuncelle(mac, yeniEvSkor, yeniDepSkor, yeniDurum);
    }
    showToast('Maç güncellendi!','success');
    closeEditModal();
  } catch(e) { showToast('Hata: ' + e.message,'error'); }
}

async function firebaseMacGuncelle(mac, yeniEvSkor, yeniDepSkor, yeniDurum) {
  const batch = db.batch();
  const evRef = db.collection('takimlar').doc(mac.evSahibiId);
  const depRef = db.collection('takimlar').doc(mac.deplasmanId);

  // Delta hesaplayacağız (Yeni Değer - Eski Değer)
  let dEvO=0, dEvG=0, dEvB=0, dEvM=0, dEvAg=0, dEvYg=0, dEvP=0;
  let dDepO=0, dDepG=0, dDepB=0, dDepM=0, dDepAg=0, dDepYg=0, dDepP=0;

  // 1. Eski etkiyi çıkar
  if (!mac.durum || mac.durum === 'oynandi') {
    dEvO -= 1; dEvAg -= mac.evSahibiSkor; dEvYg -= mac.deplasmanSkor;
    dDepO -= 1; dDepAg -= mac.deplasmanSkor; dDepYg -= mac.evSahibiSkor;
    if (mac.evSahibiSkor > mac.deplasmanSkor) { dEvG -= 1; dEvP -= 3; dDepM -= 1; }
    else if (mac.evSahibiSkor < mac.deplasmanSkor) { dDepG -= 1; dDepP -= 3; dEvM -= 1; }
    else { dEvB -= 1; dEvP -= 1; dDepB -= 1; dDepP -= 1; }
  }

  // 2. Yeni etkiyi ekle
  if (yeniDurum === 'oynandi') {
    dEvO += 1; dEvAg += yeniEvSkor; dEvYg += yeniDepSkor;
    dDepO += 1; dDepAg += yeniDepSkor; dDepYg += yeniEvSkor;
    if (yeniEvSkor > yeniDepSkor) { dEvG += 1; dEvP += 3; dDepM += 1; }
    else if (yeniEvSkor < yeniDepSkor) { dDepG += 1; dDepP += 3; dEvM += 1; }
    else { dEvB += 1; dEvP += 1; dDepB += 1; dDepP += 1; }
  }

  const inc = firebase.firestore.FieldValue.increment;
  
  if (dEvO !== 0 || dEvAg !== 0 || dEvYg !== 0) {
    batch.update(evRef, {
      o: inc(dEvO), g: inc(dEvG), b: inc(dEvB), m: inc(dEvM),
      ag: inc(dEvAg), yg: inc(dEvYg), av: inc(dEvAg - dEvYg), p: inc(dEvP)
    });
  }
  if (dDepO !== 0 || dDepAg !== 0 || dDepYg !== 0) {
    batch.update(depRef, {
      o: inc(dDepO), g: inc(dDepG), b: inc(dDepB), m: inc(dDepM),
      ag: inc(dDepAg), yg: inc(dDepYg), av: inc(dDepAg - dDepYg), p: inc(dDepP)
    });
  }

  batch.update(db.collection('maclar').doc(mac.id), { evSahibiSkor: yeniEvSkor, deplasmanSkor: yeniDepSkor, durum: yeniDurum });
  await batch.commit();
}

function mockMacGuncelle(mac, yeniEvSkor, yeniDepSkor, yeniDurum) {
  const ev = Object.values(takimlar).find(t => t.ad === mac.evSahibiAd);
  const dep = Object.values(takimlar).find(t => t.ad === mac.deplasmanAd);
  if (!ev || !dep) return;

  // Eski etkiyi geri al
  if (!mac.durum || mac.durum === 'oynandi') {
    ev.o--; ev.ag -= mac.evSahibiSkor; ev.yg -= mac.deplasmanSkor;
    dep.o--; dep.ag -= mac.deplasmanSkor; dep.yg -= mac.evSahibiSkor;
    if (mac.evSahibiSkor > mac.deplasmanSkor) { ev.g--; ev.p -= 3; dep.m--; }
    else if (mac.evSahibiSkor < mac.deplasmanSkor) { dep.g--; dep.p -= 3; ev.m--; }
    else { ev.b--; ev.p -= 1; dep.b--; dep.p -= 1; }
  }

  // Yeni etkiyi uygula
  if (yeniDurum === 'oynandi') {
    ev.o++; ev.ag += yeniEvSkor; ev.yg += yeniDepSkor;
    dep.o++; dep.ag += yeniDepSkor; dep.yg += yeniEvSkor;
    if (yeniEvSkor > yeniDepSkor) { ev.g++; ev.p += 3; dep.m++; }
    else if (yeniEvSkor < yeniDepSkor) { dep.g++; dep.p += 3; ev.m++; }
    else { ev.b++; ev.p += 1; dep.b++; dep.p += 1; }
  }

  ev.av = ev.ag - ev.yg; dep.av = dep.ag - dep.yg;
  mac.evSahibiSkor = yeniEvSkor;
  mac.deplasmanSkor = yeniDepSkor;
  mac.durum = yeniDurum;
  renderMacListesi();
  renderStats();
}

// ═══════════════════════════════════════
//  MAÇ SİL
// ═══════════════════════════════════════
async function macSil(macId) {
  if (!confirm('Bu maçı silmek istediğinize emin misiniz?')) return;
  const mac = maclar.find(m => m.id === macId);
  if (!mac) return;

  try {
    if (USE_FIREBASE) {
      await firebaseMacSil(mac);
    } else {
      mockMacSil(mac);
    }
    showToast('Maç silindi!','success');
  } catch(e) { showToast('Hata: ' + e.message,'error'); }
}

async function firebaseMacSil(mac) {
  const batch = db.batch();
  if (!mac.durum || mac.durum === 'oynandi') {
    const inc = firebase.firestore.FieldValue.increment;
    const evRef = db.collection('takimlar').doc(mac.evSahibiId);
    const depRef = db.collection('takimlar').doc(mac.deplasmanId);

    const evUp = { o: inc(-1), ag: inc(-mac.evSahibiSkor), yg: inc(-mac.deplasmanSkor), av: inc(-(mac.evSahibiSkor - mac.deplasmanSkor)) };
    const depUp = { o: inc(-1), ag: inc(-mac.deplasmanSkor), yg: inc(-mac.evSahibiSkor), av: inc(-(mac.deplasmanSkor - mac.evSahibiSkor)) };
    if (mac.evSahibiSkor > mac.deplasmanSkor) { evUp.g = inc(-1); evUp.p = inc(-3); depUp.m = inc(-1); }
    else if (mac.evSahibiSkor < mac.deplasmanSkor) { depUp.g = inc(-1); depUp.p = inc(-3); evUp.m = inc(-1); }
    else { evUp.b = inc(-1); evUp.p = inc(-1); depUp.b = inc(-1); depUp.p = inc(-1); }

    batch.update(evRef, evUp);
    batch.update(depRef, depUp);
  }
  batch.delete(db.collection('maclar').doc(mac.id));
  await batch.commit();
}

function mockMacSil(mac) {
  const ev = Object.values(takimlar).find(t => t.ad === mac.evSahibiAd);
  const dep = Object.values(takimlar).find(t => t.ad === mac.deplasmanAd);
  if (ev && dep && (!mac.durum || mac.durum === 'oynandi')) {
    ev.o--; ev.ag -= mac.evSahibiSkor; ev.yg -= mac.deplasmanSkor;
    dep.o--; dep.ag -= mac.deplasmanSkor; dep.yg -= mac.evSahibiSkor;
    if (mac.evSahibiSkor > mac.deplasmanSkor) { ev.g--; ev.p -= 3; dep.m--; }
    else if (mac.evSahibiSkor < mac.deplasmanSkor) { dep.g--; dep.p -= 3; ev.m--; }
    else { ev.b--; ev.p -= 1; dep.b--; dep.p -= 1; }
    ev.av = ev.ag - ev.yg; dep.av = dep.ag - dep.yg;
  }
  maclar = maclar.filter(m => m.id !== mac.id);
  renderMacListesi();
  renderStats();
}

// ═══════════════════════════════════════
//  AKTİF HAFTA
// ═══════════════════════════════════════
async function aktifHaftaDegistir(delta) {
  const yeni = aktifHafta + delta;
  if (yeni < 1 || yeni > toplamHafta) return;
  aktifHafta = yeni;
  document.getElementById('aktifHaftaLabel').textContent = aktifHafta;

  if (USE_FIREBASE) {
    await db.collection('ayarlar').doc('turnuva').set({ aktifHafta: yeni, toplamHafta }, { merge: true });
  }
}

// ═══════════════════════════════════════
//  RENDER — STATS
// ═══════════════════════════════════════
function renderStats() {
  const toplam = Object.keys(takimlar).length;
  const macSayisi = maclar.length;
  const golSayisi = maclar.reduce((a, m) => a + (m.evSahibiSkor || 0) + (m.deplasmanSkor || 0), 0);
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card"><div class="stat-num">${toplam}</div><div class="stat-lbl">Takım</div></div>
    <div class="stat-card"><div class="stat-num">${macSayisi}</div><div class="stat-lbl">Maç</div></div>
    <div class="stat-card"><div class="stat-num">${golSayisi}</div><div class="stat-lbl">Gol</div></div>
    <div class="stat-card"><div class="stat-num">${aktifHafta}</div><div class="stat-lbl">Aktif Hafta</div></div>`;
}

// ═══════════════════════════════════════
//  RENDER — MAÇ LİSTESİ
// ═══════════════════════════════════════
function renderMacListesi() {
  const filtr = document.getElementById('filtrGrup').value;
  const filtered = filtr === 'all' ? maclar : maclar.filter(m => m.grup === filtr);
  const container = document.getElementById('macListesi');

  if (filtered.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">Henüz maç kaydı yok.</p>';
    return;
  }

  container.innerHTML = filtered.map((m, i) => `
    <div class="match-item fade-in" style="animation-delay:${i * 30}ms">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-xs text-emerald-400 font-bold flex-shrink-0">H${m.hafta}</span>
          <span class="text-xs text-slate-500 flex-shrink-0">${m.grup}</span>
          <span class="text-sm text-slate-300 truncate">
            <span class="${(!m.durum || m.durum === 'oynandi') && m.evSahibiSkor > m.deplasmanSkor ? 'font-bold text-white' : ''}">${m.evSahibiAd}</span>
            ${m.durum === 'iptal' ? '<span class="text-red-400 font-bold mx-2 text-[10px] px-1.5 py-0.5 border border-red-400/30 rounded bg-red-400/10">İPTAL</span>' : 
              m.durum === 'ertelendi' ? '<span class="text-amber-400 font-bold mx-2 text-[10px] px-1.5 py-0.5 border border-amber-400/30 rounded bg-amber-400/10">ERT.</span>' :
              `<span class="text-emerald-400 font-bold mx-1">${m.evSahibiSkor}-${m.deplasmanSkor}</span>`}
            <span class="${(!m.durum || m.durum === 'oynandi') && m.deplasmanSkor > m.evSahibiSkor ? 'font-bold text-white' : ''}">${m.deplasmanAd}</span>
          </span>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button onclick="openEditModal('${m.id}')" class="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors" title="Düzenle">✏️</button>
          <button onclick="macSil('${m.id}')" class="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Sil">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}

// ═══════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════
function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ═══════════════════════════════════════
//  İLK KURULUM (SEED)
// ═══════════════════════════════════════
async function checkAndSeedDatabase() {
  try {
    const snap = await db.collection('takimlar').limit(1).get();
    if (snap.empty) {
      showToast('İlk kurulum yapılıyor, 53 takım yükleniyor...', 'success');
      const batch = db.batch();
      
      // Ayarları oluştur
      batch.set(db.collection('ayarlar').doc('turnuva'), {
        aktifHafta: 1,
        toplamHafta: 6,
        turnuvaAdi: "Tarsus Köyler Arası Futbol Turnuvası"
      });

      // Takımları oluştur
      Object.entries(GRUPLAR).forEach(([grup, adlar]) => {
        adlar.forEach(ad => {
          const id = generateId(ad);
          const ref = db.collection('takimlar').doc(id);
          batch.set(ref, { id, ad, grup, o:0, g:0, b:0, m:0, ag:0, yg:0, av:0, p:0 });
        });
      });
      
      await batch.commit();
      showToast('Kurulum tamamlandı! Takımlar veritabanına eklendi.', 'success');
    }
  } catch (err) {
    console.error("Seed hatası:", err);
  }
}
