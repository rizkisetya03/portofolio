const API_URL = "https://script.google.com/macros/s/AKfycbzQwxupEhw5D2R9-xjuqIhA87cZ4nbHdaDWqYwZ370jDKEKrrUImpXnl7_iU4R1TM_i/exec";

document.addEventListener("DOMContentLoaded", function() {
  initThemeEngine();
  fetchPortfolioData();
});

// Helper untuk mengambil nilai pertama yang valid dari beberapa kemungkinan nama properti API
function getFirstDefinedValue(source, keys) {
  if (!source || typeof source !== 'object') return '';
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== null && value !== undefined && value !== '') return value;
    }
  }
  const lowerKeys = keys.map(k => k.toLowerCase());
  for (const actualKey in source) {
    if (lowerKeys.includes(actualKey.toLowerCase())) {
      const value = source[actualKey];
      if (value !== null && value !== undefined && value !== '') return value;
    }
  }
  return '';
}

// Helper untuk memformat URL gambar dari Google Drive agar bisa dirender sebagai thumbnail
function normalizeImageSource(source, fallback = '') {
  if (!source) return fallback;
  const value = String(source).trim();
  if (!value) return fallback;
  if (value.startsWith('data:image')) return value;
  const driveMatch = value.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9-_]+)/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?sz=w400&id=${driveMatch[1]}`;
  }
  return value;
}

// Helper fungsi untuk merender isi pop-up dokumen (mendukung PDF & banyak gambar)
function buildScrollableDocMarkup(rawSource, title) {
  if (!rawSource) return '';
  const value = String(rawSource).trim();

  // KASUS 1: Jika berupa PDF dari Google Drive
  if (value.includes('/file/d/') || value.includes('drive.google.com') && value.toLowerCase().includes('.pdf') || value.includes('?id=')) {
    const driveMatch = value.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9-_]+)/i);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      return `
        <div style="text-align: center;">
          <div class="scrollable-document-container" style="height: 70vh; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background-color: var(--bg-main); margin-bottom: 1rem;">
            <iframe src="${previewUrl}" style="width: 100%; height: 100%; border: none;" allow="autoplay"></iframe>
          </div>
          <a href="https://drive.google.com/uc?export=download&id=${fileId}" target="_blank" class="cosmic-btn" style="text-decoration: none; display: inline-block; padding: 10px 20px;">Buka Resolusi Penuh</a>
        </div>`;
    }
  }

  // KASUS 2: Jika berupa Gambar biasa / multi-gambar
  const imageLinks = value.split(/[\n,]+/).map(link => link.trim()).filter(link => link.length > 0);
  let imagesMarkup = '';
  imageLinks.forEach((link, imgIdx) => {
    let resolvedSrc = normalizeImageSource(link, '');
    if (resolvedSrc) {
      imagesMarkup += `
        <img src="${resolvedSrc}" 
             style="width: 100%; height: auto; display: block; border-radius: 6px; margin-bottom: 15px; border: 1px solid var(--border-color);" 
             alt="${title} - Halaman ${imgIdx + 1}">`;
    }
  });

  if (imagesMarkup) {
    return `
      <div style="text-align: center;">
        <div class="scrollable-document-container" style="max-height: 70vh; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; background-color: var(--bg-main); margin-bottom: 1rem;">
          ${imagesMarkup}
        </div>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Gunakan scroll di dalam kotak untuk melihat dokumen lengkap</span>
      </div>`;
  }

  return '';
}

// Menerapkan foto profil dari API ke elemen profil
function applyProfileImage(element, source) {
  if (!element) return;
  const resolved = normalizeImageSource(source, '');
  if (!resolved) {
    element.style.backgroundImage = '';
    return;
  }
  element.style.backgroundImage = `url('${resolved}')`;
  element.style.backgroundSize = 'cover';
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';
}

// Manajemen Penggantian Tema (Gelap/Terang)
function initThemeEngine() {
  const themeBtn = document.getElementById("theme-button");
  const themeIcon = document.getElementById("theme-icon");
  const htmlEl = document.documentElement;
  if (!themeBtn) return;

  const savedTheme = localStorage.getItem("portfolio-theme") || "light";
  htmlEl.setAttribute("data-theme", savedTheme);
  updateToggleIcon(savedTheme, themeIcon);

  themeBtn.addEventListener("click", function() {
    const currentTheme = htmlEl.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    htmlEl.setAttribute("data-theme", newTheme);
    localStorage.setItem("portfolio-theme", newTheme);
    updateToggleIcon(newTheme, themeIcon);
  });
}

function updateToggleIcon(theme, iconSvg) {
  if (!iconSvg) return;
  if (theme === "dark") {
    iconSvg.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
  } else {
    iconSvg.innerHTML = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`;
  }
}

// Mengambil Data Utama Portofolio dari Web Service Apps Script
function fetchPortfolioData() {
  fetch(API_URL)
    .then(response => {
      if (!response.ok) throw new Error("Gagal memuat data portofolio.");
      return response.json();
    })
    .then(data => {
      if (data.error) return;
      renderPortfolio(data);
    })
    .catch(error => {
      console.error(error);
      const descEl = document.getElementById('about-desc');
      if (descEl) descEl.textContent = "Gagal mengambil sinkronisasi data resume dari database.";
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.style.display = 'none';
    });
}

// Merender Seluruh Bagian Portofolio ke Elemen HTML Masing-masing
function renderPortfolio(data) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = 0;
    setTimeout(() => overlay.style.display = 'none', 200);
  }

  // Bagian Header Profil (tentang)
  const aboutDescEl = document.getElementById('about-desc');
  const nodeNameEl = document.getElementById('node-name');
  const nodePhotoEl = document.getElementById('node-photo');

  if (data.about) {
    if (aboutDescEl && data.about.deskripsi) aboutDescEl.textContent = data.about.deskripsi;
    if (nodeNameEl && data.about.nama) nodeNameEl.textContent = data.about.nama;
    if (nodePhotoEl) applyProfileImage(nodePhotoEl, getFirstDefinedValue(data.about, ['foto', 'fotoProfil', 'photo']));
  }

  // Render Pendidikan
  let eduHtml = '';
  if (data.education) {
    data.education.forEach(item => {
      eduHtml += `
        <div class="interactive-card">
          <div class="card-title" style="color: var(--accent);">${item.sekolah || ''}</div>
          <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${item.jurusan || '-'} (${item.tahun || ''})</div>
          <div class="card-text text-preserve-enter" style="margin-bottom: 0.75rem;">${item.keterangan || ''}</div>
          <span class="badge-ipk">Nilai / IPK: ${item.nilai || '-'}</span>
        </div>`;
    });
  }
  const eduListEl = document.getElementById('edu-list');
  if (eduListEl) eduListEl.innerHTML = eduHtml || '<p class="card-meta">Tidak ada data pendidikan.</p>';

  // Render Pengalaman Kerja / Magang
  let expHtml = '';
  if (data.experience) {
    data.experience.forEach((item, idx) => {
      // Cek apakah ada file dokumen/gambar pendukung
      let docLink = getFirstDefinedValue(item, ['gambar', 'image', 'foto', 'file', 'File', 'dokumen', 'Dokumen']) || '';
      let actionBtn = '';
      
      if (docLink) {
        actionBtn = `
          <button class="cosmic-btn click-exp-doc-trigger" 
                  data-idx="${idx}" 
                  style="display: inline-flex; align-items: center; gap: 6px; width: auto; padding: 4px 10px; font-size: 0.8rem; margin-top: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
            Lihat Dokumen
          </button>
        `;
      }

      expHtml += `
        <div class="interactive-card">
          <div class="card-title">${item.jabatan || ''}</div>
          <div class="card-subtitle">${item.instansi || ''}</div>
          <div class="card-meta">📍 ${item.lokasi || ''} | 🗓️ ${item.waktu || ''}</div>
          <p class="card-text text-preserve-enter" style="margin-bottom: 0;">${item.deskripsi || item.deskrispi || ''}</p>
          ${actionBtn}
        </div>`;
    });
  }
  const expListEl = document.getElementById('exp-list');
  if (expListEl) expListEl.innerHTML = expHtml || '<p class="card-meta">Tidak ada data pengalaman kerja.</p>';

  // Render Pengalaman Organisasi
  let orgHtml = '';
  if (data.organization) {
    data.organization.forEach((item, idx) => {
      // Cek apakah ada file dokumen/gambar pendukung
      let docLink = getFirstDefinedValue(item, ['gambar', 'image', 'foto', 'file', 'File', 'dokumen', 'Dokumen']) || '';
      let actionBtn = '';
      
      if (docLink) {
        actionBtn = `
          <button class="cosmic-btn click-org-doc-trigger" 
                  data-idx="${idx}" 
                  style="display: inline-flex; align-items: center; gap: 6px; width: auto; padding: 4px 10px; font-size: 0.8rem; margin-top: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
            Lihat Dokumen
          </button>
        `;
      }

      orgHtml += `
        <div class="interactive-card">
          <div class="card-title">${item.jabatan || ''}</div>
          <div style="font-weight:600; font-size:0.95rem; margin-bottom: 0.25rem;">${item.organisasi || ''} [${item.tempat || ''}]</div>
          <div class="card-meta">Periode: ${item.waktu || ''}</div>
          <p class="card-text text-preserve-enter" style="margin-bottom: 0;">${item.deskripsi || ''}</p>
          ${actionBtn}
        </div>`;
    });
  }
  const orgListEl = document.getElementById('org-list');
  if (orgListEl) orgListEl.innerHTML = orgHtml || '<p class="card-meta">Tidak ada data organisasi.</p>';
  
  // Render Penghargaan & Pencapaian
  let awardHtml = '';
  const totalAwards = data.awards ? data.awards.length : 0;
  const countAwardEl = document.getElementById('count-award');
  if (countAwardEl) countAwardEl.textContent = totalAwards;

  if (data.awards) {
    data.awards.forEach((item, idx) => {
      let fallbackImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='30%' y='55%' fill='%2364748b' font-family='sans-serif' font-size='14'>Pratinjau Penghargaan</text></svg>";
      let banner = normalizeImageSource(getFirstDefinedValue(item, ['gambar', 'image', 'foto']), fallbackImg);
      
      let rawWaktu = item.waktu || '';
      let cleanWaktu = '';

      if (rawWaktu) {
        if (rawWaktu.includes('T')) {
          cleanWaktu = rawWaktu.split('T')[0];
        } else if (rawWaktu.includes(' ')) {
          const parts = rawWaktu.trim().split(' ');
          if (parts[parts.length - 1].includes(':')) {
            parts.pop();
          }
          cleanWaktu = parts.join(' ');
        } else {
          cleanWaktu = rawWaktu;
        }
      }

      awardHtml += `
        <div class="interactive-card" data-idx="${idx}">
          <img src="${banner}" class="card-banner" alt="Penghargaan">
          <div class="card-title">${item.penghargaan || ''}</div>
          <div class="card-meta">🗓️ ${cleanWaktu} | 📍 ${item.tempat || ''}</div>
          <p class="card-text text-preserve-enter">${item.deskripsi || ''}</p>
          <button class="cosmic-btn click-award-trigger">Lihat Penghargaan</button>
        </div>`;
    });
  }
  const awardListEl = document.getElementById('award-list');
  if (awardListEl) awardListEl.innerHTML = awardHtml || '<p class="card-meta">Tidak ada data penghargaan.</p>';

  // Pemisahan Proyek Berdasarkan Kolom Jenis (AK atau IT)
  let accountingHtml = '';
  let itHtml = '';
  let totalAccounting = 0;
  let totalIT = 0;

  if (data.projects) {
    data.projects.forEach((item, idx) => {
      let fallbackImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='35%' y='55%' fill='%2364748b' font-family='sans-serif' font-size='14'>No Image</text></svg>";
      let banner = normalizeImageSource(getFirstDefinedValue(item, ['gambar', 'image', 'foto']), fallbackImg);
      let shortDesc = item.deskripsi ? item.deskripsi.substring(0, 100) + '...' : '';

      const jenisKode = String(item.jenis || '').trim().toUpperCase();

      let cardMarkup = `
        <div class="interactive-card ${jenisKode === 'AK' ? 'card-accounting' : 'card-it'}" data-idx="${idx}">
          <img src="${banner}" class="card-banner" alt="Proyek">
          <div class="card-title">${item.judul || ''}</div>
          <p class="card-text text-preserve-enter">${shortDesc}</p>
          <button class="cosmic-btn click-project-trigger">Lihat Detail Proyek</button>
        </div>`;

      if (jenisKode === 'AK') {
        accountingHtml += cardMarkup;
        totalAccounting++;
      } else {
        itHtml += cardMarkup;
        totalIT++;
      }
    });
  }

  const countAccEl = document.getElementById('count-accounting');
  const countItEl = document.getElementById('count-it');
  if (countAccEl) countAccEl.textContent = totalAccounting;
  if (countItEl) countItEl.textContent = totalIT;

  const accProjectListEl = document.getElementById('accounting-project-list');
  const itProjectListEl = document.getElementById('it-project-list');
  if (accProjectListEl) accProjectListEl.innerHTML = accountingHtml || '<p class="card-meta">Tidak ada proyek akuntansi.</p>';
  if (itProjectListEl) itProjectListEl.innerHTML = itHtml || '<p class="card-meta">Tidak ada proyek IT.</p>';

  // Sertifikasi Kompetensi
  let certificationVerticalHtml = '';
  const totalCertifications = data.certification ? data.certification.length : 0;
  const countCertifEl = document.getElementById('count-certification');
  if (countCertifEl) countCertifEl.textContent = totalCertifications;

  if (data.certification && data.certification.length > 0) {
    data.certification.forEach((item, idx) => {
      let rawWaktu = item.waktu || '';
      let cleanWaktu = '';

      if (rawWaktu) {
        if (rawWaktu.includes('T')) {
          cleanWaktu = rawWaktu.split('T')[0];
        } else if (rawWaktu.includes(' ')) {
          const parts = rawWaktu.trim().split(' ');
          if (parts[parts.length - 1].includes(':')) {
            parts.pop();
          }
          cleanWaktu = parts.join(' ');
        } else {
          cleanWaktu = rawWaktu;
        }
      }

      certificationVerticalHtml += `
        <div class="interactive-card vertical-cert-row" data-idx="${idx}">
          <div class="vertical-cert-main">
            <div class="card-title" style="margin-bottom:0.25rem;">${item.sertifikasi || ''}</div>
            <div class="card-subtitle" style="color: var(--accent); font-weight:600;">${item.lembaga || ''}</div>
            <p class="card-text text-preserve-enter" style="margin-top:0.5rem; margin-bottom:0.75rem;">${item.deskripsi || ''}</p>
            <!-- Tombol Detail Sertifikasi -->
            <button class="cosmic-btn click-cert-trigger" style="display: inline-block; width: auto; padding: 6px 16px;">Lihat Dokumen</button>
          </div>
          <div class="vertical-cert-side">
            <span class="badge-ipk">🗓️ ${cleanWaktu || '-'}</span>
          </div>
        </div>`;
    });
  }
  const vertCertListEl = document.getElementById('vertical-certification-list');
  if (vertCertListEl) vertCertListEl.innerHTML = certificationVerticalHtml || '<p class="card-meta">Tidak ada data sertifikasi kompetensi.</p>';
  
  // Galeri Berkas Dokumen (dokument)
  let dokumenGalleryHtml = '';
  const dokumenSource = Array.isArray(data.dokument) ? data.dokument : [];
  const totalDokumen = dokumenSource.length;
  
  const countDokumenEl = document.getElementById('count-dokumen');
  if (countDokumenEl) countDokumenEl.textContent = totalDokumen;
  
  if (totalDokumen > 0) {
    dokumenSource.forEach((item, idx) => {
      let fallbackCertImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='32%' y='55%' fill='%2364748b' font-family='sans-serif' font-size='14'>Berkas Dokumen</text></svg>";
      let banner = normalizeImageSource(getFirstDefinedValue(item, ['Foto', 'foto', 'gambar', 'file', 'File']), fallbackCertImg);
      let judulDokumen = getFirstDefinedValue(item, ['Kegiatan', 'kegiatan', 'sertifikat', 'judul', 'Judul']) || 'Dokumen Berkas';
      let peranDokumen = getFirstDefinedValue(item, ['Peran', 'peran']) ? ` (${getFirstDefinedValue(item, ['Peran', 'peran'])})` : '';
      let waktuDokumen = getFirstDefinedValue(item, ['Waktu', 'waktu', 'tahun', 'Tahun']) || '-';
      
      dokumenGalleryHtml += `
        <div class="interactive-card card-sertifikat-gallery-item" data-idx="${idx}">
          <img src="${banner}" class="card-banner" alt="Berkas Dokumen">
          <div class="card-title">${judulDokumen}${peranDokumen}</div>
          <div class="card-meta">Waktu: ${waktuDokumen}</div>
          <button class="cosmic-btn click-cert-gallery-trigger" style="margin-top:0.75rem;">Pratinjau Dokumen</button>
        </div>`;
    });
  }
  
  const dokumenGalleryListEl = document.getElementById('dokumen-gallery-list');
  if (dokumenGalleryListEl) {
    dokumenGalleryListEl.innerHTML = dokumenGalleryHtml || '<p class="card-meta">Tidak ada berkas dokumen yang dapat ditampilkan.</p>';
  }

  // Bind modal dan inisialisasi slider
  bindModalActions(data, dokumenSource);
  
  initSliderControls('award-list', 'prev-award', 'next-award', true);
  initSliderControls('accounting-project-list', 'prev-accounting', 'next-accounting', true);
  initSliderControls('it-project-list', 'prev-it', 'next-it', true);
  
  if (totalDokumen > 0) {
    initSliderControls('dokumen-gallery-list', 'prev-doc', 'next-doc', true);  
  }
  
  if (typeof initScrollReveal === 'function') initScrollReveal();
}

// Memetakan Aksi Klik Kartu untuk Membuka Pop-up Detail Dinamis
function bindModalActions(allData, safeDocSource) {
  // Event handler klik dokumen Pengalaman Kerja (Menggunakan event.currentTarget secara aman)
  document.querySelectorAll('.click-exp-doc-trigger').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const idx = this.getAttribute('data-idx');
      if (idx === null || !allData.experience) return;
      
      const item = allData.experience[idx];
      if (!item) return;

      let docLink = getFirstDefinedValue(item, ['gambar', 'image', 'foto', 'file', 'File', 'dokumen', 'Dokumen']) || '';
      let htmlContent = buildScrollableDocMarkup(docLink, item.jabatan || 'Dokumen Pengalaman');
      
      if (htmlContent) {
        executeModalOpen(htmlContent);
      }
    });
  });

  // Event handler klik dokumen Organisasi (Menggunakan event.currentTarget secara aman)
  document.querySelectorAll('.click-org-doc-trigger').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const idx = this.getAttribute('data-idx');
      if (idx === null || !allData.organization) return;

      const item = allData.organization[idx];
      if (!item) return;

      let docLink = getFirstDefinedValue(item, ['gambar', 'image', 'foto', 'file', 'File', 'dokumen', 'Dokumen']) || '';
      let htmlContent = buildScrollableDocMarkup(docLink, item.jabatan || 'Dokumen Organisasi');
      
      if (htmlContent) {
        executeModalOpen(htmlContent);
      }
    });
  });

  // Modal Pop Up untuk Galeri Dokumen
  document.querySelectorAll('.click-cert-gallery-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = safeDocSource[idx];
      
      if (!item) return; 
      
      let imageSrc = normalizeImageSource(getFirstDefinedValue(item, ['Foto', 'foto', 'gambar', 'file', 'File']), '');
      let judulDokumen = getFirstDefinedValue(item, ['Kegiatan', 'kegiatan', 'judul', 'Judul']) || 'Dokumen Berkas';
      let peranDokumen = getFirstDefinedValue(item, ['Peran', 'peran']) ? `<p style="font-weight: 600; color: var(--accent); margin-top: -0.25rem;">Peran: ${getFirstDefinedValue(item, ['Peran', 'peran'])}</p>` : '';
      let deskripsiDokumen = getFirstDefinedValue(item, ['Deskripsi Singkat', 'deskripsi_singkat', 'deskripsi', 'Deskripsi']) || 'Lampiran berkas resmi hasil validasi.';
      
      let htmlContent = `
        <div style="text-align: left;">
          ${imageSrc ? `<img src="${imageSrc}" style="width:100%; max-height:350px; object-fit:contain; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">` : ''}
          <h3 style="font-size:1.3rem; margin-bottom:0.5rem; color: var(--text-main);">${judulDokumen}</h3>
          ${peranDokumen}
          <p style="font-size:0.95rem; color: var(--text-muted); margin-bottom:1rem; white-space: pre-wrap;">${deskripsiDokumen}</p>
          <a href="${imageSrc || '#'}" target="_blank" class="cosmic-btn" style="text-decoration:none; display:inline-block;">Buka Resolusi Penuh</a>
        </div>`;
      executeModalOpen(htmlContent);
    });
  });

  // Modal Detail Sertifikasi Kompetensi (Mendukung PDF Multi-halaman & Banyak Gambar)
  document.querySelectorAll('.click-cert-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.certification[idx];
      if (!item) return;

      // Ambil nilai mentah dari database (bisa berupa satu link, banyak link, atau PDF)
      let rawSource = getFirstDefinedValue(item, ['gambar', 'image', 'foto', 'file', 'File']) || '';
      let htmlContent = '';

      if (rawSource) {
        const value = String(rawSource).trim();

        // KASUS 1: Jika file adalah PDF dari Google Drive
        if (value.includes('/file/d/') || value.includes('drive.google.com') && value.toLowerCase().includes('.pdf') || value.includes('?id=')) {
          // Ekstrak ID File Drive
          const driveMatch = value.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9-_]+)/i);
          if (driveMatch && driveMatch[1]) {
            const fileId = driveMatch[1];
            const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            
            htmlContent = `
              <div style="text-align: center;">
                <div class="scrollable-document-container" style="height: 75vh; border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background-color: var(--bg-main); margin-bottom: 1rem;">
                  <iframe src="${previewUrl}" style="width: 100%; height: 100%; border: none;" allow="autoplay"></iframe>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 1rem;">
                  <a href="https://drive.google.com/uc?export=download&id=${fileId}" target="_blank" class="cosmic-btn" style="text-decoration: none; display: inline-block; padding: 10px 20px;">Buka Resolusi Penuh</a>
                </div>
              </div>
            `;
          }
        } 
        
        // KASUS 2: Jika berisi beberapa gambar (dipisahkan koma atau baris baru)
        if (!htmlContent) {
          const imageLinks = value.split(/[\n,]+/).map(link => link.trim()).filter(link => link.length > 0);
          
          let imagesMarkup = '';
          imageLinks.forEach((link, imgIdx) => {
            let resolvedSrc = normalizeImageSource(link, '');
            if (resolvedSrc) {
              imagesMarkup += `
                <img src="${resolvedSrc}" 
                     style="width: 100%; height: auto; display: block; border-radius: 6px; margin-bottom: 15px; border: 1px solid var(--border-color);" 
                     alt="${item.sertifikasi || 'Dokumen'} - Halaman ${imgIdx + 1}">
              `;
            }
          });

          if (imagesMarkup) {
            htmlContent = `
              <div style="text-align: center;">
                <div class="scrollable-document-container" style="max-height: 75vh; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; padding: 15px; background-color: var(--bg-main); margin-bottom: 1rem;">
                  ${imagesMarkup}
                </div>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 1rem;">
                  <span style="font-size: 0.85rem; color: var(--text-muted);">Gunakan scroll mouse/layar di dalam kotak untuk melihat halaman berikutnya</span>
                </div>
              </div>
            `;
          }
        }
      }

      // Fallback jika tidak ada dokumen yang terdeteksi
      if (!htmlContent) {
        htmlContent = `
          <div style="text-align: center; padding: 3rem 2rem; color: var(--text-muted);">
            <p style="margin-bottom: 1rem;">Dokumen sertifikat tidak ditemukan atau format tautan tidak didukung.</p>
            <a href="${rawSource}" target="_blank" class="cosmic-btn" style="text-decoration: none; display: inline-block;">Coba Buka Tautan Langsung</a>
          </div>
        `;
      }

      executeModalOpen(htmlContent);
    });
  });

  // Modal Detail Penghargaan
  document.querySelectorAll('.click-award-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.awards[idx];
      let imageSrc = normalizeImageSource(getFirstDefinedValue(item, ['gambar', 'image', 'foto']), '');
      
      let htmlContent = `
        <div style="text-align: left;">
          ${imageSrc ? `<img src="${imageSrc}" style="width:100%; max-height:280px; object-fit:cover; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">` : ''}
          <h3 style="font-size:1.3rem; margin-bottom:0.5rem; color: var(--text-main);">${item.penghargaan || ''}</h3>
          <p style="font-size:0.95rem; line-height:1.6; color: var(--text-muted); white-space: pre-wrap; margin-bottom:1.5rem;">${item.deskripsi || ''}</p>
        </div>`;
      executeModalOpen(htmlContent);
    });
  });

  // Modal Detail Deskripsi Proyek
  document.querySelectorAll('.click-project-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.projects[idx];
      let imageSrc = normalizeImageSource(getFirstDefinedValue(item, ['gambar', 'image', 'foto']), '');
      
      let htmlContent = `
        <div style="text-align: left;">
          ${imageSrc ? `<img src="${imageSrc}" style="width:100%; max-height:280px; object-fit:cover; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">` : ''}
          <h3 style="font-size:1.3rem; margin-bottom:0.5rem; color: var(--text-main);">${item.judul || ''}</h3>
          <p style="font-size:0.95rem; line-height:1.6; color: var(--text-muted); white-space: pre-wrap; margin-bottom:1.5rem;">${item.deskripsi || ''}</p>
      `;

      const projectLink = item.link ? String(item.link).trim() : '';
      if (projectLink) {
        htmlContent += `<a href="${projectLink}" target="_blank" class="cosmic-btn" style="text-decoration:none; display:inline-block;">Kunjungi Tautan Proyek</a>`;
      } else {
        htmlContent += `<div style="background: var(--bg-main); border: 1px dashed var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">🔒 Tautan internal sistem/aplikasi instansi terproteksi.</div>`;
      }
      htmlContent += `</div>`;
      executeModalOpen(htmlContent);
    });
  });
}

function executeModalOpen(contentHtml) {
  const modal = document.getElementById('global-portfolio-modal');
  const body = document.getElementById('modal-body-content');
  if (body) body.innerHTML = contentHtml;
  if (modal) modal.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closePortfolioModal() {
  const modal = document.getElementById('global-portfolio-modal');
  if (modal) modal.classList.remove('modal-open');
  document.body.style.overflow = '';
}

if (document.getElementById('close-modal-trigger')) {
  document.getElementById('close-modal-trigger').addEventListener('click', closePortfolioModal);
}
const globalModal = document.getElementById('global-portfolio-modal');
if (globalModal) {
  globalModal.addEventListener('click', function(e) {
    if (e.target === this) closePortfolioModal();
  });
}

// Controller Independent Slider Horizontal (Carousel)
function initSliderControls(wrapperId, prevId, nextId, autoPlay = false) {
  let currentIndex = 0;
  const listWrapper = document.getElementById(wrapperId);
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  let autoPlayTimer = null;

  if (!listWrapper || !prevBtn || !nextBtn) return;

  function moveSlider() {
    const w = window.innerWidth;
    const cards = listWrapper.querySelectorAll('.interactive-card');
    if (cards.length === 0) return;

    let cardsPerView = w >= 900 ? 3 : (w >= 600 ? 2 : 1);
    let step = w >= 900 ? 33.333 : (w >= 600 ? 50 : 100);
    let maxSlides = cards.length - cardsPerView;
    if (maxSlides < 0) maxSlides = 0;
    
    if (currentIndex > maxSlides) currentIndex = 0;
    listWrapper.style.transform = `translateX(-${currentIndex * step}%)`;
  }

  nextBtn.addEventListener('click', () => {
    const cards = listWrapper.querySelectorAll('.interactive-card');
    let cardsPerView = window.innerWidth >= 900 ? 3 : (window.innerWidth >= 600 ? 2 : 1);
    let maxSlides = cards.length - cardsPerView;
    currentIndex = (currentIndex >= maxSlides) ? 0 : currentIndex + 1;
    moveSlider();
    if (autoPlayTimer) clearInterval(autoPlayTimer);
  });

  prevBtn.addEventListener('click', () => {
    const cards = listWrapper.querySelectorAll('.interactive-card');
    let cardsPerView = window.innerWidth >= 900 ? 3 : (window.innerWidth >= 600 ? 2 : 1);
    let maxSlides = cards.length - cardsPerView;
    currentIndex = (currentIndex <= 0) ? maxSlides : currentIndex - 1;
    moveSlider();
    if (autoPlayTimer) clearInterval(autoPlayTimer);
  });

  window.addEventListener('resize', moveSlider);
  
  if (autoPlay) {
    autoPlayTimer = setInterval(() => {
      const cards = listWrapper.querySelectorAll('.interactive-card');
      let cardsPerView = window.innerWidth >= 900 ? 3 : (window.innerWidth >= 600 ? 2 : 1);
      let maxSlides = cards.length - cardsPerView;
      currentIndex = (currentIndex >= maxSlides) ? 0 : currentIndex + 1;
      moveSlider();
    }, 5000);
  }
}

function startLiveClock() {
  function updateClock() {
    const clockTextElement = document.getElementById('clock-text');
    if (!clockTextElement) return;
    const now = new Date();
    const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    clockTextElement.textContent = `${now.toLocaleDateString('id-ID', optionsDate)} | ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

startLiveClock();
