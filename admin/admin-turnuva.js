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
let cezalar = [];
let aktifHafta = 1;
let toplamHafta = 6;
let _seedRunning = false;
let _cleanupDone = false;

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
  return ad.toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_]/gi,'');
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

async function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('userEmail').textContent = document.getElementById('loginEmail').value;

  if (USE_FIREBASE) {
    // ÖNCE seed ve temizlik, SONRA listener — race condition önlenir
    await checkAndSeedDatabase();
    await seedIkinciHaftaCezalar();
    listenFirebase();
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

  db.collection('cezalar').orderBy('olusturmaTarihi','desc').onSnapshot(snap => {
    cezalar = [];
    snap.forEach(d => { cezalar.push({ id: d.id, ...d.data() }); });
    renderCezaListesi();
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
  cezaTakimlariDoldur();
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
    
    // Otomatik BAY kontrolü için kısa bir gecikme ile çağırıyoruz (Snapshot için)
    setTimeout(() => {
      eksikBaylariTamamla(false);
    }, 500);
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
//  OTOMATİK BAY KONTROLÜ
// ═══════════════════════════════════════
async function eksikBaylariTamamla(isManualClick = true) {
  let eklenenBaySayisi = 0;
  
  if (isManualClick) {
    const btn = document.querySelector('button[onclick="eksikBaylariTamamla(true)"]');
    if (btn) btn.innerHTML = '<i data-lucide="loader" class="w-3 h-3 text-amber-400 animate-spin"></i> <span class="hidden sm:inline">Taranıyor...</span>';
  }

  for (const [grup, takimAdlari] of Object.entries(GRUPLAR)) {
    if (takimAdlari.length !== 7) continue; // Sadece 7 takımlı gruplar

    for (let h = 1; h <= toplamHafta; h++) {
      const haftaninMaclari = maclar.filter(m => m.grup === grup && m.hafta === h);
      const bayVarMi = haftaninMaclari.some(m => m.durum === 'bay');
      
      if (!bayVarMi) {
        const normalMaclar = haftaninMaclari.filter(m => m.durum !== 'bay' && m.durum !== 'iptal');
        
        // 3 normal maç girilmişse (6 takım oynadı), 1 takım boşta (BAY)
        if (normalMaclar.length === 3) {
          const oynayanTakimlar = new Set();
          normalMaclar.forEach(m => {
            oynayanTakimlar.add(m.evSahibiAd);
            oynayanTakimlar.add(m.deplasmanAd);
          });
          
          const bayTakimAd = takimAdlari.find(t => !oynayanTakimlar.has(t));
          
          if (bayTakimAd) {
            try {
              if (USE_FIREBASE) {
                await firebaseMacKaydet(h, grup, bayTakimAd, bayTakimAd, 0, 0, 'bay');
              } else {
                mockMacKaydet(h, grup, bayTakimAd, bayTakimAd, 0, 0, 'bay');
              }
              eklenenBaySayisi++;
            } catch (err) {
              console.error("BAY ekleme hatası:", err);
            }
          }
        }
      }
    }
  }

  if (isManualClick) {
    const btn = document.querySelector('button[onclick="eksikBaylariTamamla(true)"]');
    if (btn) {
      btn.innerHTML = '<i data-lucide="zap" class="w-3 h-3 text-amber-400"></i> <span class="hidden sm:inline">Eksik BAY\'ları Tamamla</span>';
      lucide.createIcons();
    }
    
    if (eklenenBaySayisi > 0) {
      showToast(`${eklenenBaySayisi} adet eksik BAY durumu otomatik eklendi!`, 'success');
    } else {
      showToast('Eksik BAY durumu bulunamadı. Her şey tamam!', 'success');
    }
  }
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
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex-shrink-0">${m.hafta}. Hafta</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">${m.grup} Grubu</span>
          <span class="text-sm text-slate-300 truncate">
            <span class="${(!m.durum || m.durum === 'oynandi') && m.evSahibiSkor > m.deplasmanSkor ? 'font-bold text-white' : ''}">${m.evSahibiAd}</span>
            ${m.durum === 'iptal' ? '<span class="text-red-400 font-bold mx-2 text-[10px] px-1.5 py-0.5 border border-red-400/30 rounded bg-red-400/10">İPTAL</span>' : 
              m.durum === 'ertelendi' ? '<span class="text-amber-400 font-bold mx-2 text-[10px] px-1.5 py-0.5 border border-amber-400/30 rounded bg-amber-400/10">ERT.</span>' :
              m.durum === 'bay' ? '<span class="text-indigo-400 font-bold mx-2 text-[10px] px-1.5 py-0.5 border border-indigo-400/30 rounded bg-indigo-400/10">BAY GEÇTİ</span>' :
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
  // Çift çalışma kilidi — aynı anda birden fazla seed çalışmasını engeller
  if (_seedRunning) return;
  _seedRunning = true;

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

      // Takımları oluştur — deterministik ID ile
      Object.entries(GRUPLAR).forEach(([grup, adlar]) => {
        adlar.forEach(ad => {
          const id = generateId(ad);
          const ref = db.collection('takimlar').doc(id);
          batch.set(ref, { id, ad, grup, o:0, g:0, b:0, m:0, ag:0, yg:0, av:0, p:0 });
        });
      });
      
      await batch.commit();
      showToast('Kurulum tamamlandı!', 'success');
    } else {
      // Veritabanı boş değil — kopya takımları temizle (tek seferlik)
      await cleanupDuplicateTeams();
    }

    // 1. Hafta Cezalılarını Ekle (Eğer boşsa)
    const cezaSnap = await db.collection('cezalar').limit(1).get();
    if (cezaSnap.empty) {
      const ilkHaftaCezalar = [
        { takim: 'OLUKKOYAĞI', isim: 'BATUHAN ŞAHİN', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 1, grup: 'A' },
        { takim: 'YEŞİLTEPE', isim: 'MEHMET CAN DAĞ', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 1, grup: 'C' },
        { takim: 'AKARSU', isim: 'CUMALİ GÜÇLÜ', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 1, grup: 'E' },
        { takim: 'AKARSU', isim: 'AHMET ELMACI', gorev: 'YÖNETİCİ', ceza: '2 MAÇ', hafta: 1, grup: 'E' },
        { takim: 'MEŞELİK', isim: 'ADNAN KUTLU', gorev: 'ANTRENÖR', ceza: '2 MAÇ', hafta: 1, grup: 'F' },
        { takim: 'BOĞAZPINAR', isim: 'MEHMET ŞEN', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 1, grup: 'G' },
        { takim: 'SEBİL FK', isim: 'OĞUZHAN SARIKAVAK', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 1, grup: 'H' },
        { takim: 'ALİFAKI', isim: 'CANER KAYA', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 1, grup: 'H' },
        { takim: 'KULAK', isim: 'CİHAN TATAR', gorev: 'ANTRENÖR', ceza: '2 MAÇ', hafta: 1, grup: 'F' }
      ];
      const batch2 = db.batch();
      ilkHaftaCezalar.forEach(c => {
        const ref = db.collection('cezalar').doc();
        batch2.set(ref, { ...c, olusturmaTarihi: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch2.commit();
      console.log('1. Hafta cezaları yüklendi.');
    }
  } catch (err) {
    console.error("Seed hatası:", err);
  } finally {
    _seedRunning = false;
  }
}

// ═══════════════════════════════════════
//  KOPYA TAKIM TEMİZLEME (TEK SEFERLİK)
// ═══════════════════════════════════════
async function cleanupDuplicateTeams() {
  if (_cleanupDone) return;
  _cleanupDone = true;

  try {
    const allSnap = await db.collection('takimlar').get();
    const tümTakimlar = [];
    allSnap.forEach(doc => {
      tümTakimlar.push({ docId: doc.id, ...doc.data() });
    });

    // Takım adı + grup bazında grupla
    const grouped = {};
    tümTakimlar.forEach(t => {
      const key = t.ad + '|' + t.grup;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });

    // Kopyaları bul
    const silinecekler = [];
    const idGuncellemeleri = {}; // eskiId -> yeniId eşleşmesi

    for (const [key, copies] of Object.entries(grouped)) {
      if (copies.length <= 1) continue;

      // En çok maç oynamış olanı tut (o değeri en yüksek)
      copies.sort((a, b) => (b.o || 0) - (a.o || 0));
      const tutulan = copies[0];
      const yeniId = generateId(tutulan.ad);

      for (let i = 1; i < copies.length; i++) {
        const kopya = copies[i];
        silinecekler.push(kopya.docId);
        idGuncellemeleri[kopya.docId] = tutulan.docId;
      }

      // Tutulan takımın ID'si deterministik değilse güncelle
      if (tutulan.docId !== yeniId) {
        idGuncellemeleri[tutulan.docId] = yeniId;
      }
    }

    if (silinecekler.length === 0) {
      console.log('Kopya takım bulunamadı, temiz.');
      return;
    }

    console.log(`${silinecekler.length} kopya takım bulundu, temizleniyor...`);
    showToast(`${silinecekler.length} kopya takım tespit edildi, temizleniyor...`, 'success');

    // Maçlardaki eski ID referanslarını güncelle
    const macSnap = await db.collection('maclar').get();
    const macGuncelBatch = db.batch();
    let macGuncelSayisi = 0;

    macSnap.forEach(doc => {
      const mac = doc.data();
      let guncelle = {};
      let degisti = false;

      if (idGuncellemeleri[mac.evSahibiId]) {
        guncelle.evSahibiId = idGuncellemeleri[mac.evSahibiId];
        degisti = true;
      }
      if (idGuncellemeleri[mac.deplasmanId]) {
        guncelle.deplasmanId = idGuncellemeleri[mac.deplasmanId];
        degisti = true;
      }

      if (degisti) {
        macGuncelBatch.update(db.collection('maclar').doc(doc.id), guncelle);
        macGuncelSayisi++;
      }
    });

    if (macGuncelSayisi > 0) {
      await macGuncelBatch.commit();
      console.log(`${macGuncelSayisi} maç referansı güncellendi.`);
    }

    // Tutulanların ID'si değişecekse: yeni doküman oluştur, eskisini sil
    const idMigrateBatch = db.batch();
    let migreSayisi = 0;

    for (const t of tümTakimlar) {
      const yeniId = generateId(t.ad);
      if (t.docId !== yeniId && !silinecekler.includes(t.docId)) {
        // Bu tutulan bir takım ama ID'si eski format — yeni ID ile taşı
        const { docId, ...data } = t;
        data.id = yeniId;
        idMigrateBatch.set(db.collection('takimlar').doc(yeniId), data);
        idMigrateBatch.delete(db.collection('takimlar').doc(docId));
        migreSayisi++;
      }
    }

    if (migreSayisi > 0) {
      await idMigrateBatch.commit();
      console.log(`${migreSayisi} takım ID'si yeni formata taşındı.`);
    }

    // Kopyaları sil (Firestore batch max 500 işlem)
    for (let i = 0; i < silinecekler.length; i += 400) {
      const silBatch = db.batch();
      const dilim = silinecekler.slice(i, i + 400);
      dilim.forEach(id => {
        silBatch.delete(db.collection('takimlar').doc(id));
      });
      await silBatch.commit();
    }

    console.log('Temizlik tamamlandı!');
    showToast(`Temizlik tamamlandı! ${silinecekler.length} kopya silindi.`, 'success');
  } catch (err) {
    console.error('Temizlik hatası:', err);
    showToast('Temizlik sırasında hata: ' + err.message, 'error');
  }
}

async function seedIkinciHaftaCezalar() {
  try {
    const cezaSnap = await db.collection('cezalar').where('hafta', '==', 2).limit(1).get();
    if (cezaSnap.empty) {
      const ikinciHaftaCezalar = [
        { takim: 'GÖÇÜK', isim: 'İLKEM EKER', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'E' },
        { takim: 'GÖÇÜK', isim: 'MURAT AYDIN', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'E' },
        { takim: 'TAŞKUYU', isim: 'SERKAN ÇETİN', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'E' },
        { takim: 'ALİBEYLİ', isim: 'BUĞRA BULUT', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'B' },
        { takim: 'ALİBEYLİ', isim: 'MEHMET ELVAN', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'B' },
        { takim: 'İNKÖY', isim: 'MERTCAN SIVACI', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'İNKÖY', isim: 'SİNAN KARABACAK', gorev: 'YÖNETİCİ', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'MEŞELİK', isim: 'FURKAN İNCİK', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'F' },
        { takim: 'KULAK', isim: 'ALİ CAN', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'F' },
        { takim: 'OLUKKOYAĞI', isim: 'SADULLAH KESEN', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'OLUKKOYAĞI', isim: 'UĞUR SAĞIR', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'EMİRLER', isim: 'ERMAN ŞAHİN', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'G' },
        { takim: 'KARADİKEN', isim: 'AHMET SARI', gorev: 'ANTRENÖR', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'KÖSELERLİ', isim: 'MAHMUT ŞENATEŞ', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'KÖSELERLİ', isim: 'BERAT AKDOĞAN', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'KARADİKEN', isim: 'YİĞİT ÖZDEMİR', gorev: 'SPORCU', ceza: '2 MAÇ', hafta: 2, grup: 'A' },
        { takim: 'ÇAVUŞLU', isim: 'HÜSEYİN ÖZYAŞAMIŞ', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'D' },
        { takim: 'YENİCE', isim: 'MUSTAFA ARSLANTAY', gorev: 'SPORCU', ceza: '1 MAÇ', hafta: 2, grup: 'F' },
        { takim: 'YENİCE', isim: 'AHMET KURT', gorev: 'ANTRENÖR', ceza: '2 MAÇ', hafta: 2, grup: 'F' }
      ];
      const batch = db.batch();
      ikinciHaftaCezalar.forEach(c => {
        const ref = db.collection('cezalar').doc();
        batch.set(ref, { ...c, olusturmaTarihi: firebase.firestore.FieldValue.serverTimestamp() });
      });
      await batch.commit();
      console.log('2. Hafta cezaları yüklendi.');
      showToast('2. Hafta disiplin cezaları otomatik yüklendi!', 'success');
    }
  } catch (err) {
    console.error("2. Hafta Seed hatası:", err);
  }
}

// ═══════════════════════════════════════
//  DİSİPLİN (CEZALAR) İŞLEMLERİ
// ═══════════════════════════════════════
function cezaTakimlariDoldur() {
  const grup = document.getElementById('cezaGrup').value;
  const takimAdlari = GRUPLAR[grup] || [];
  const sec = document.getElementById('cezaTakim');
  sec.innerHTML = '<option value="">Takım Seç</option>' + takimAdlari.map(a => `<option value="${a}">${a}</option>`).join('');
}

async function cezaEkle() {
  const hafta = parseInt(document.getElementById('cezaHafta').value) || 1;
  const grup = document.getElementById('cezaGrup').value;
  const takim = document.getElementById('cezaTakim').value;
  const isim = document.getElementById('cezaOyuncu').value.trim().toUpperCase();
  const gorev = document.getElementById('cezaGorev').value;
  const cezaMiktar = document.getElementById('cezaMiktar').value.trim().toUpperCase();

  if (!takim || !isim || !cezaMiktar) return showToast('Lütfen takım, oyuncu adı ve ceza miktarını girin!','error');

  try {
    if (USE_FIREBASE) {
      await db.collection('cezalar').add({
        hafta, grup, takim, isim, gorev, ceza: cezaMiktar,
        olusturmaTarihi: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      cezalar.push({ id: 'mock_'+Date.now(), hafta, grup, takim, isim, gorev, ceza: cezaMiktar });
      renderCezaListesi();
    }
    showToast('Cezalı oyuncu eklendi!','success');
    document.getElementById('cezaOyuncu').value = '';
    document.getElementById('cezaMiktar').value = '';
  } catch(e) {
    showToast('Hata: ' + e.message,'error');
  }
}

async function cezaSil(id) {
  if (!confirm('Bu cezayı listeden silmek istediğinize emin misiniz?')) return;
  try {
    if (USE_FIREBASE) {
      await db.collection('cezalar').doc(id).delete();
    } else {
      cezalar = cezalar.filter(c => c.id !== id);
      renderCezaListesi();
    }
    showToast('Ceza silindi.','success');
  } catch(e) {
    showToast('Hata: ' + e.message,'error');
  }
}

function renderCezaListesi() {
  const container = document.getElementById('cezaListesi');
  if (!container) return;
  if (cezalar.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">Henüz kayıtlı disiplin cezası yok.</p>';
    return;
  }
  container.innerHTML = cezalar.map((c, i) => `
    <div class="match-item fade-in" style="animation-delay:${i * 20}ms">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 flex-shrink-0">${c.hafta}. Hafta</span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 flex-shrink-0">${c.takim}</span>
          <span class="text-sm font-bold text-white truncate">${c.isim} <span class="text-xs font-normal text-slate-400">(${c.gorev})</span></span>
          <span class="text-xs font-bold text-red-400 ml-auto bg-red-900/40 px-2 py-0.5 rounded">${c.ceza}</span>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button onclick="cezaSil('${c.id}')" class="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors" title="Sil">🗑️</button>
        </div>
      </div>
    </div>`).join('');
}
