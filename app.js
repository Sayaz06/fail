import {
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "./firebase.js";

// ==========================================
// ELEMEN DOM
// ==========================================
// Halaman & Auth
const pageLogin = document.getElementById('page-login');
const pageHome = document.getElementById('page-home');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const authMsg = document.getElementById('auth-msg');

// Navigasi & Tindakan
const btnBack = document.getElementById('btn-back');
const currentFolderName = document.getElementById('current-folder-name');
const btnNewFolder = document.getElementById('btn-new-folder');
const btnUpload = document.getElementById('btn-upload');
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search');

// Progress Bar & Paparan
const uploadProgress = document.getElementById('upload-progress');
const uploadBar = document.getElementById('upload-bar');
const uploadLabel = document.getElementById('upload-label');
const itemList = document.getElementById('item-list');

// ==========================================
// STATE APLIKASI
// ==========================================
let currentUser = null;
let folderHistory = [{ id: 'root', name: 'Utama (Root)' }];
let unsubscribe = null;
let currentItems = []; // Simpan data semasa untuk carian

// Dapatkan folder semasa dari hujung array
function getCurrentFolder() {
  return folderHistory[folderHistory.length - 1];
}

// ==========================================
// PENGURUSAN AKAUN (AUTH)
// ==========================================
btnLogin.addEventListener('click', async () => {
  try {
    authMsg.textContent = "Sedang log masuk...";
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (err) {
    authMsg.textContent = "Gagal log masuk: Sila semak e-mel dan kata laluan.";
  }
});

btnRegister.addEventListener('click', async () => {
  try {
    authMsg.textContent = "Sedang mendaftar...";
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (err) {
    authMsg.textContent = "Gagal mendaftar: Kata laluan mesti 6+ aksara atau e-mel sudah wujud.";
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
});

// Pantau status log masuk
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    pageLogin.classList.add('hidden');
    pageHome.classList.remove('hidden');
    emailInput.value = '';
    passwordInput.value = '';
    authMsg.textContent = '';
    loadItems(); // Muat fail selepas log masuk
  } else {
    currentUser = null;
    pageLogin.classList.remove('hidden');
    pageHome.classList.add('hidden');
    if (unsubscribe) unsubscribe();
    itemList.innerHTML = '';
    folderHistory = [{ id: 'root', name: 'Utama (Root)' }]; // Reset sejarah
  }
});

// ==========================================
// PENGURUSAN FAIL & FOLDER
// ==========================================

// 1. Muat Item dari Firestore
function loadItems() {
  if (!currentUser) return;
  const currentFolder = getCurrentFolder();

  // Kemas kini UI Breadcrumb (Navigasi)
  currentFolderName.textContent = currentFolder.name;
  if (folderHistory.length > 1) {
    btnBack.classList.remove('hidden');
  } else {
    btnBack.classList.add('hidden');
  }

  // Tarik data dari koleksi peribadi pengguna
  const itemsRef = collection(db, `users/${currentUser.uid}/drive_items`);
  // Susun ikut masa dicipta supaya yang baru di bawah/atas
  const q = query(itemsRef, where("parentId", "==", currentFolder.id), orderBy("createdAt", "desc"));

  if (unsubscribe) unsubscribe(); // Hentikan pantaun folder lama

  unsubscribe = onSnapshot(q, (snapshot) => {
    currentItems = [];
    snapshot.forEach(doc => {
      currentItems.push({ id: doc.id, ...doc.data() });
    });
    renderItems(currentItems);
  });
}

// 2. Render Paparan Item ke HTML
function renderItems(itemsToRender) {
  itemList.innerHTML = '';
  
  if (itemsToRender.length === 0) {
    itemList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--subtext); padding: 40px;">Folder ini kosong.</p>';
    return;
  }

  itemsToRender.forEach((data) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    // Butang Padam (Silang Merah)
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete';
    btnDelete.innerHTML = '✕';
    btnDelete.title = 'Padam Item';
    btnDelete.onclick = (e) => {
      e.stopPropagation(); // Halang folder/fail dari terbuka bila klik padam
      deleteItem(data.id, data);
    };

    if (data.type === 'folder') {
      card.innerHTML = `
        <div class="item-icon" style="color: var(--folder);">📁</div>
        <div class="item-name">${escapeHtml(data.name)}</div>
        <div class="item-meta">Folder</div>
      `;
      card.onclick = () => {
        folderHistory.push({ id: data.id, name: data.name });
        searchInput.value = ''; // Reset carian bila masuk folder baru
        loadItems();
      };
    } else {
      // Jika Fail
      const sizeMB = (data.size / (1024 * 1024)).toFixed(2);
      let icon = '📄';
      if (data.mimeType && data.mimeType.startsWith('video/')) icon = '🎬';
      if (data.mimeType && data.mimeType.startsWith('image/')) icon = '🖼️';
      if (data.mimeType && data.mimeType.startsWith('audio/')) icon = '🎵';

      card.innerHTML = `
        <div class="item-icon" style="color: var(--file);">${icon}</div>
        <div class="item-name">${escapeHtml(data.name)}</div>
        <div class="item-meta">${data.ext.toUpperCase()} • ${sizeMB} MB</div>
      `;
      card.onclick = () => window.open(data.url, '_blank');
    }

    card.appendChild(btnDelete);
    itemList.appendChild(card);
  });
}

// 3. Kembali ke Folder Sebelumnya
btnBack.onclick = () => {
  if (folderHistory.length > 1) {
    folderHistory.pop(); 
    searchInput.value = '';
    loadItems();         
  }
};

// 4. Cipta Folder Baru
btnNewFolder.onclick = async () => {
  const folderName = prompt("Masukkan nama folder baru:");
  if (!folderName || !folderName.trim()) return;
  
  const currentFolder = getCurrentFolder();
  await addDoc(collection(db, `users/${currentUser.uid}/drive_items`), {
    name: folderName.trim(),
    type: 'folder',
    parentId: currentFolder.id,
    createdAt: serverTimestamp()
  });
};

// 5. Muat Naik Fail (Berbilang Fail bergiliran)
btnUpload.onclick = () => fileInput.click();

fileInput.onchange = async (e) => {
  const files = e.target.files;
  if (!files.length) return;

  const currentFolder = getCurrentFolder();
  uploadProgress.classList.remove('hidden');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExt = file.name.split('.').pop();
    const fileId = crypto.randomUUID();
    const storageRef = ref(storage, `users/${currentUser.uid}/files/${fileId}.${fileExt}`);
    
    const task = uploadBytesResumable(storageRef, file);

    await new Promise((resolve, reject) => {
      task.on('state_changed', 
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          uploadBar.style.width = pct + '%';
          uploadLabel.textContent = `Muat naik (${i + 1}/${files.length}): ${pct}%`;
        },
        (error) => {
          alert(`Gagal memuat naik ${file.name}`);
          console.error(error);
          resolve(); // Teruskan ke fail seterusnya walaupun ralat
        },
        async () => {
          const url = await getDownloadURL(storageRef);
          await addDoc(collection(db, `users/${currentUser.uid}/drive_items`), {
            name: file.name,
            type: 'file',
            ext: fileExt,
            mimeType: file.type,
            size: file.size,
            storagePath: storageRef.fullPath, // Simpan path untuk mudah padam nanti
            parentId: currentFolder.id,
            url: url,
            createdAt: serverTimestamp()
          });
          resolve();
        }
      );
    });
  }

  uploadLabel.textContent = "Selesai!";
  setTimeout(() => {
    uploadProgress.classList.add('hidden');
    uploadBar.style.width = '0%';
    uploadLabel.textContent = 'Sedia...';
  }, 2000);

  fileInput.value = ''; // Reset input
};

// 6. Padam Fail / Folder
async function deleteItem(docId, data) {
  const confirmMsg = data.type === 'folder' 
    ? `AWAS: Anda pasti mahu padam folder "${data.name}"? (Pastikan ia kosong dahulu)` 
    : `Padam fail "${data.name}"?`;

  if (!confirm(confirmMsg)) return;

  try {
    // Jika ia adalah fail, padam dari Firebase Storage dahulu
    if (data.type === 'file' && data.storagePath) {
      const fileRef = ref(storage, data.storagePath);
      await deleteObject(fileRef);
    }
    
    // Padam dokumen dari Firestore
    await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId));
  } catch (err) {
    console.error("Ralat memadam item:", err);
    alert("Gagal memadam item. Sila cuba lagi.");
  }
}

// 7. Carian Fail Pintar (Real-time di folder semasa)
searchInput.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  if (!q) {
    renderItems(currentItems);
    return;
  }
  const filtered = currentItems.filter(item => 
    item.name.toLowerCase().includes(q)
  );
  renderItems(filtered);
});

// Utiliti: Keselamatan teks
function escapeHtml(s) { 
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); 
}
