const API_URL = "https://script.google.com/macros/s/AKfycbxx5GLx9bf7lEMen2nRJuQ7MeZ8HQaPmbkPxRxaptQQS-OM_gCdrcXDT3QUvZiUtwMa/exec";

document.addEventListener("DOMContentLoaded", function() {
  initThemeEngine();
  fetchPortfolioData();
});

function getFirstDefinedValue(source, keys) {
  if (!source || typeof source !== 'object') return '';

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
  }

  const lowerKeys = keys.map(k => k.toLowerCase());
  for (const actualKey in source) {
    if (lowerKeys.includes(actualKey.toLowerCase())) {
      const value = source[actualKey];
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
  }

  return '';
}

function normalizeImageSource(source, fallback = '') {
  if (!source) return fallback;

  const value = String(source).trim();
  if (!value) return fallback;
  if (value.startsWith('data:image')) return value;

  const driveMatch = value.match(/(?:\/d\/|[?&]id=)([a-zA-Z0-9-_]+)/i);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    
    // OPTIMASI: sz=w400 (memperkecil ukuran gambar agar loading sangat cepat namun tetap tajam di kartu slide)
    return `https://drive.google.com/thumbnail?sz=w400&id=${fileId}`;
  }

  return value;
}

function applyProfileImage(element, source) {
  const resolved = normalizeImageSource(source, '');
  if (!resolved) {
    element.style.backgroundImage = '';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    element.style.backgroundRepeat = '';
    return;
  }

  element.style.backgroundImage = `url('${resolved}')`;
  element.style.backgroundSize = 'cover';
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';
}

// ==========================================
// 1. ENGINE TEMA GELAP / TERANG (FORMAL)
// ==========================================
function initThemeEngine() {
  const themeBtn = document.getElementById("theme-button");
  const themeIcon = document.getElementById("theme-icon");
  const htmlEl = document.documentElement;

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
  if (theme === "dark") {
    iconSvg.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
  } else {
    iconSvg.innerHTML = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`;
  }
}

// ==========================================
// 2. AMBIL DATA SPREADSHEET
// ==========================================
function fetchPortfolioData() {
  fetch(API_URL)
    .then(response => {
      if (!response.ok) throw new Error("Network response error");
      return response.json();
    })
    .then(data => {
      if (data.error) {
        console.error("API Error:", data.error);
        return;
      }
      renderPortfolio(data);
    })
    .catch(error => {
      console.error("Fetch Error:", error);
      document.getElementById('about-desc').textContent = "Gagal mengambil sinkronisasi resume.";
      // Langsung matikan loading jika error agar tidak stuck
      const overlay = document.getElementById('loading-overlay');
      if(overlay) overlay.style.display = 'none';
    });
}

// ==========================================
// 3. RENDER DATA KE ANTARMUKA
// ==========================================
function renderPortfolio(data) {
  // Matikan Layar Loading SECEPAT MUNGKIN begitu data diterima (tidak menunggu gambar render selesai)
  const overlay = document.getElementById('loading-overlay');
  if(overlay) {
    overlay.style.opacity = 0;
    setTimeout(() => overlay.style.display = 'none', 150);
  }

  // Profil Dasar
  if (data.about.deskripsi) document.getElementById('about-desc').textContent = data.about.deskripsi;
  if (data.about.nama) document.getElementById('node-name').textContent = data.about.nama;

  const profilePhoto = getFirstDefinedValue(data.about, ['foto', 'fotoProfil', 'photo', 'photoUrl', 'gambar', 'image', 'avatar']);
  applyProfileImage(document.getElementById('node-photo'), profilePhoto);

  // Pendidikan
  let eduHtml = '';
  data.education.forEach(item => {
    eduHtml += `
      <div class="interactive-card">
        <div class="card-title" style="color: var(--accent);">${item.sekolah}</div>
        <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${item.jurusan || '-'} (${item.tahun})</div>
        <div class="card-text" style="margin-bottom: 0.75rem;">${item.keterangan || ''}</div>
        <span style="display:inline-block; background: var(--border-color); color: var(--text-main); padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">Nilai / IPK: ${item.nilai || '-'}</span>
      </div>`;
  });
  document.getElementById('edu-list').innerHTML = eduHtml || '<p class="card-meta">Tidak ada data pendidikan.</p>';

  // Pengalaman Kerja
  let expHtml = '';
  data.experience.forEach(item => {
    expHtml += `
      <div class="interactive-card">
        <div class="card-title">${item.jabatan}</div>
        <div class="card-subtitle">${item.instansi}</div>
        <div class="card-meta">📍 ${item.lokasi} | 🗓️ ${item.waktu}</div>
        <p class="card-text" style="margin-bottom: 0;">${item.deskripsi || item.deskrispi || ''}</p>
      </div>`;
  });
  document.getElementById('exp-list').innerHTML = expHtml || '<p class="card-meta">Tidak ada data pengalaman kerja.</p>';

  // Organisasi
  let orgHtml = '';
  data.organization.forEach(item => {
    orgHtml += `
      <div class="interactive-card">
        <div class="card-title">${item.jabatan}</div>
        <div style="font-weight:600; font-size:0.95rem; margin-bottom: 0.25rem;">${item.organisasi} [${item.tempat}]</div>
        <div class="card-meta">Periode: ${item.waktu}</div>
        <p class="card-text" style="margin-bottom: 0;">${item.deskripsi || ''}</p>
      </div>`;
  });
  document.getElementById('org-list').innerHTML = orgHtml || '<p class="card-meta">Tidak ada data organisasi.</p>';

  // Sertifikasi (GRID STATIS)
  let certHtml = '';
  data.certification.forEach((item, idx) => {
    certHtml += `
      <div class="interactive-card" data-idx="${idx}">
        <div class="card-title">${item.sertifikasi}</div>
        <div class="card-subtitle">${item.lembaga}</div>
        <div class="card-meta">Validitas / Periode: ${item.waktu}</div>
        <p class="card-text" style="margin-bottom: 1.25rem;">${item.deskripsi || ''}</p>
        <button class="cosmic-btn click-cert-trigger" style="max-width: 180px;">Lihat Dokumen</button>
      </div>`;
  });
  document.getElementById('cert-list').innerHTML = certHtml || '<p class="card-meta">Tidak ada data sertifikasi.</p>';

  // Penghargaan (SLIDESHOW)
  let awardHtml = '';
  data.awards.forEach((item, idx) => {
    let fallbackImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='30%' y='55%' fill='%2364748b' font-family='sans-serif' font-size='14'>Pratinjau Penghargaan</text></svg>";
    let rawImg = getFirstDefinedValue(item, ['gambar', 'Gambar', 'image', 'foto', 'banner', 'img', 'gambarUrl']);
    let banner = normalizeImageSource(rawImg, fallbackImg);

    let rawWaktu = String(item.waktu || '');
    let cleanDate = rawWaktu;
    if (rawWaktu.includes('T')) {
      let dateParts = rawWaktu.split('T')[0].split('-');
      if (dateParts.length === 3) {
        cleanDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      } else {
        cleanDate = rawWaktu.split('T')[0];
      }
    }

    awardHtml += `
      <div class="interactive-card" data-idx="${idx}">
        <img src="${banner}" class="card-banner" alt="Penghargaan">
        <div class="card-title">${item.penghargaan}</div>
        <div class="card-meta">🗓️ ${cleanDate} | 📍 ${item.tempat}</div>
        <p class="card-text">${item.deskripsi || ''}</p>
        <button class="cosmic-btn click-award-trigger">Lihat Penghargaan</button>
      </div>`;
  });
  document.getElementById('award-list').innerHTML = awardHtml || '<p class="card-meta">Tidak ada data penghargaan.</p>';

  // Proyek (SLIDESHOW)
  let projHtml = '';
  data.projects.forEach((item, idx) => {
    let fallbackImg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='200'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='35%' y='55%' fill='%2364748b' font-family='sans-serif' font-size='14'>No Image</text></svg>";
    let rawImg = getFirstDefinedValue(item, ['gambar', 'Gambar', 'image', 'foto', 'banner', 'img', 'gambarUrl']);
    let banner = normalizeImageSource(rawImg, fallbackImg);
    let shortDesc = item.deskripsi ? item.deskripsi.substring(0, 110) + '...' : '';

    projHtml += `
      <div class="interactive-card" data-idx="${idx}">
        <img src="${banner}" class="card-banner" alt="Proyek">
        <div class="card-title">${item.judul}</div>
        <p class="card-text">${shortDesc}</p>
        <button class="cosmic-btn click-project-trigger">Lihat Detail Proyek</button>
      </div>`;
  });
  document.getElementById('project-list').innerHTML = projHtml || '<p class="card-meta">Tidak ada data proyek.</p>';

  bindModalActions(data);
  initSliderControls('award-list', 'prev-award', 'next-award', true);
  initSliderControls('project-list', 'prev-project', 'next-project', true);
}

// ==========================================
// 4. LOGIKA POPUP MODAL
// ==========================================
function bindModalActions(allData) {
  document.querySelectorAll('.click-cert-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.certification[idx];
      openDynamicModal(item.sertifikasi, item.gambar);
    });
  });

  document.querySelectorAll('.click-award-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.awards[idx];
      openDynamicModal(item.penghargaan, item.gambar);
    });
  });

  document.querySelectorAll('.click-project-trigger').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = this.closest('.interactive-card').getAttribute('data-idx');
      const item = allData.projects[idx];
      
      let imageSrc = normalizeImageSource(getFirstDefinedValue(item, ['gambar', 'Gambar', 'image', 'foto', 'banner', 'img', 'gambarUrl']), '');
      
      let htmlContent = `
        <div style="text-align: left;">
          ${imageSrc ? `<img src="${imageSrc}" style="width:100%; max-height:280px; object-fit:cover; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">` : ''}
          <h3 style="font-size:1.3rem; margin-bottom:0.5rem; color: var(--text-main);">${item.judul}</h3>
          <p style="font-size:0.95rem; line-height:1.6; color: var(--text-muted); white-space: pre-line; margin-bottom:1.5rem;">${item.deskripsi || ''}</p>
      `;

      const projectLink = item.link ? String(item.link).trim() : '';
      if(projectLink) {
        htmlContent += `<a href="${projectLink}" target="_blank" class="cosmic-btn" style="text-decoration:none; display:inline-block;">Kunjungi Tautan Eksternal Proyek</a>`;
      } else {
        htmlContent += `
          <div style="background: var(--bg-main); border: 1px dashed var(--border-color); padding: 1rem; border-radius: 8px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
            🔒 Tautan proyek ini disembunyikan untuk melindungi privasi data sensitif atau sistem internal instansi.
          </div>`;
      }
      htmlContent += `</div>`;
      
      executeModalOpen(htmlContent);
    });
  });
}

function openDynamicModal(title, sourcePath) {
  const resolvedSource = normalizeImageSource(sourcePath, '');

  if (!resolvedSource) {
    executeModalOpen(`<h3>${title}</h3><p style="margin-top:1rem; color:var(--text-muted);">Berkas lampiran tidak tersedia.</p>`);
    return;
  }

  function getCleanDriveLinks(url) {
    let id = "";
    if (url.includes("drive.usercontent.google.com")) {
      const match = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      if (match) id = match[1];
    } else if (url.includes("drive.google.com/file/d/")) {
      id = url.split("/file/d/")[1].split("/")[0];
    } else if (url.includes("id=")) {
      id = url.split("id=")[1].split("&")[0];
    }
    
    if (id) {
      return {
        directImg: `https://drive.usercontent.google.com/download?id=${id}&export=view`,
        embedPreview: `https://drive.google.com/file/d/${id}/preview`
      };
    }
    return null;
  }

  const drive = getCleanDriveLinks(resolvedSource);
  const isDirectImg = resolvedSource.match(/\.(jpeg|jpg|gif|png|webp)/i) || resolvedSource.startsWith('data:image');

  let innerHTML = `<h3 style="margin-bottom:1.25rem;">${title}</h3>`;

  if (isDirectImg || (drive && !sourcePath.includes("spreadsheets"))) {
    const targetSrc = drive ? drive.directImg : resolvedSource;
    const embedSrc = drive ? drive.embedPreview : resolvedSource;
    
    innerHTML += `<img src="${targetSrc}" class="modal-image-preview" alt="${title}" id="modal-img-node" onerror="this.style.display='none'; document.getElementById('modal-iframe-box').style.display='block';">`;
    innerHTML += `
      <div id="modal-iframe-box" style="display:none; width:100%; height:48vh; margin-top:1rem; border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
        <iframe src="${embedSrc}" style="width:100%; height:100%; border:none;" allow="autoplay"></iframe>
      </div>
    `;
  } else {
    const iframeSrc = drive ? drive.embedPreview : resolvedSource;
    innerHTML += `
      <div style="width:100%; height:48vh; margin-top:1rem; border-radius:6px; overflow:hidden; border:1px solid var(--border-color);">
        <iframe src="${iframeSrc}" style="width:100%; height:100%; border:none;" allow="autoplay"></iframe>
      </div>
    `;
  }

  innerHTML += `<a href="${resolvedSource}" target="_blank" class="cosmic-btn" style="margin-top:1.25rem; text-decoration:none;">Buka Berkas Utama</a>`;
  executeModalOpen(innerHTML);
}

function executeModalOpen(contentHtml) {
  const modal = document.getElementById('global-portfolio-modal');
  const body = document.getElementById('modal-body-content');
  body.innerHTML = contentHtml;
  modal.classList.add('modal-open');
  document.body.style.overflow = 'hidden';
}

function closePortfolioModal() {
  const modal = document.getElementById('global-portfolio-modal');
  modal.classList.remove('modal-open');
  document.body.style.overflow = '';
}

document.getElementById('close-modal-trigger').addEventListener('click', closePortfolioModal);
document.getElementById('global-portfolio-modal').addEventListener('click', function(e) {
  if (e.target === this) closePortfolioModal();
});

// ==========================================
// 5. AUTO-PLAY CAROUSEL ENGINE (GERAK TERUS)
// ==========================================
function initSliderControls(wrapperId, prevId, nextId, autoPlay = false) {
  let currentIndex = 0;
  const listWrapper = document.getElementById(wrapperId);
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  let autoPlayTimer = null;

  function moveSlider() {
    const w = window.innerWidth;
    const cards = listWrapper.querySelectorAll('.interactive-card');
    if(cards.length === 0) return;

    let cardsPerView = 1;
    let step = 100;

    if (w >= 900) {
      cardsPerView = 3;
      step = 33.333;
    } else if (w >= 600) {
      cardsPerView = 2;
      step = 50;
    }

    let maxSlides = cards.length - cardsPerView;
    if (maxSlides < 0) maxSlides = 0;
    
    // Looping mulus kembali ke awal jika melewati batas maksimal slide
    if (currentIndex > maxSlides) {
      currentIndex = 0;
    }
    if (currentIndex < 0) {
      currentIndex = maxSlides;
    }

    const translateAmount = currentIndex * step;
    listWrapper.style.transform = `translateX(-${translateAmount}%)`;
  }

  function handleNext() {
    const w = window.innerWidth;
    const cards = listWrapper.querySelectorAll('.interactive-card');
    let cardsPerView = w >= 900 ? 3 : (w >= 600 ? 2 : 1);
    let maxSlides = cards.length - cardsPerView;
    if (maxSlides < 0) maxSlides = 0;

    currentIndex = (currentIndex >= maxSlides) ? 0 : currentIndex + 1;
    moveSlider();
  }

  function handlePrev() {
    const w = window.innerWidth;
    const cards = listWrapper.querySelectorAll('.interactive-card');
    let cardsPerView = w >= 900 ? 3 : (w >= 600 ? 2 : 1);
    let maxSlides = cards.length - cardsPerView;
    if (maxSlides < 0) maxSlides = 0;

    currentIndex = (currentIndex <= 0) ? maxSlides : currentIndex - 1;
    moveSlider();
  }

  function startAutoPlay() {
    if (autoPlay && !autoPlayTimer) {
      // Kecepatan slide otomatis (bergerak tiap 3.5 detik untuk kenyamanan membaca)
      autoPlayTimer = setInterval(handleNext, 3500); 
    }
  }

  function resetAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
      startAutoPlay();
    }
  }

  nextBtn.addEventListener('click', () => {
    handleNext();
    resetAutoPlay();
  });

  prevBtn.addEventListener('click', () => {
    handlePrev();
    resetAutoPlay();
  });

  window.addEventListener('resize', moveSlider);
  startAutoPlay();
}