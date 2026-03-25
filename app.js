import {
  auth,
  db,
  storage,
  googleProvider, // Tukar auth method
  signInWithPopup,   // Tukar auth method
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  addDoc,
  getDocs, // Import ini
  updateDoc, // Import ini
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch, // Import ini
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
const btnLoginGoogle = document.getElementById('btn-login-google'); // Ganti butang login
const btnLogout = document.getElementById('btn-logout');
const authMsg = document.getElementById('auth-msg');
const deleteOverlay = document.getElementById('delete-overlay'); // Ganti overlay padam

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
let currentItems = [];

// Dapatkan folder semasa dari hujung array
function getCurrentFolder() {
  return folderHistory[folderHistory.length - 1];
}

// ==========================================
// PENGURUSAN AKAUN (AUTH) - TUKAR KE GOOGLE
// ==========================================
btnLoginGoogle.addEventListener('click', async () => {
  try {
    authMsg.textContent = "Membuka tetingkap Google...";
    btnLoginGoogle.disabled = true;
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    authMsg.textContent = "Gagal log masuk: Domain tidak dibenarkan atau anda menutup tetingkap.";
    console.error(err);
    btnLoginGoogle.disabled = false;
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
    btnLoginGoogle.disabled = false;
    authMsg.textContent = '';
    loadItems();
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

// 1. Muat Item dari Firestore (Kekal asal)
function loadItems() {
  if (!currentUser) return;
  const currentFolder = getCurrentFolder();

  currentFolderName.textContent = currentFolder.name;
  if (folderHistory.length > 1) {
    btnBack.classList.remove('hidden');
  } else {
    btnBack.classList.add('hidden');
  }

  const itemsRef = collection(db, `users/${currentUser.uid}/drive_items`);
  const q = query(itemsRef, where("parentId", "==", currentFolder.id), orderBy("createdAt", "desc"));

  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(q, (snapshot) => {
    currentItems = [];
    snapshot.forEach(doc => {
      currentItems.push({ id: doc.id, ...doc.data() });
    });
    renderItems(currentItems);
  });
}

// 2. Render Paparan Item ke HTML (Tambah Butang Rename)
function renderItems(itemsToRender) {
  itemList.innerHTML = '';
  
  if (itemsToRender.length === 0) {
    itemList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--subtext); padding: 40px;">Folder ini kosong.</p>';
    return;
  }

  itemsToRender.forEach((data) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    // Toolbar Tindakan (Kumpulan butang di bucu)
    const cardToolbar = document.createElement('div');
    cardToolbar.style = "position: absolute; top: 8px; right: 8px; display: flex; gap: 4px;";

    // Butang Rename (✏️) - FUNGSI TAMBAHAN BARU
    const btnRename = document.createElement('button');
    btnRename.className = 'btn-delete'; // Boleh guna CSS btn-delete buat masa ni
    btnRename.innerHTML = '✏️';
    btnRename.title = 'Tukar Nama';
    btnRename.onclick = (e) => {
      e.stopPropagation(); // Halang folder/fail dari terbuka
      renameItem(data.id, data);
    };

    // Butang Padam (✕) - KINI MENYOKONG AUTO-DELETE
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete';
    btnDelete.innerHTML = '✕';
    btnDelete.title = 'Padam Item';
    btnDelete.onclick = (e) => {
      e.stopPropagation();
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
        searchInput.value = '';
        loadItems();
      };
    } else {
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

    cardToolbar.appendChild(btnRename); // Tambah butang rename ke toolbar
    cardToolbar.appendChild(btnDelete); // Tambah butang delete ke toolbar
    card.appendChild(cardToolbar);      // Tambah toolbar ke kad
    itemList.appendChild(card);
  });
}

// 3. Kembali ke Folder Sebelumnya (Kekal asal)
btnBack.onclick = () => {
  if (folderHistory.length > 1) {
    folderHistory.pop(); 
    searchInput.value = '';
    loadItems();         
  }
};

// 4. Cipta Folder Baru (Kekal asal)
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

// 5. Muat Naik Fail (Berbilang Fail bergiliran - Kekal asal)
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
          resolve(); 
        },
        async () => {
          const url = await getDownloadURL(storageRef);
          await addDoc(collection(db, `users/${currentUser.uid}/drive_items`), {
            name: file.name,
            type: 'file',
            ext: fileExt,
            mimeType: file.type,
            size: file.size,
            storagePath: storageRef.fullPath,
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

// 6. Padam Fail / Folder - SKRIP AUTO-DELETE KINI DISINI
async function deleteItem(docId, data) {
  const isFolder = data.type === 'folder';
  const confirmMsg = isFolder 
    ? `AWAS: Anda pasti mahu padam folder "${data.name}"?\nSistem akan mencari dan memadam semua sub-folder dan fail di dalamnya (di Firestore & Storage) secara automatik untuk mengosongkan storan Blaze.` 
    : `Padam fail "${data.name}"?`;

  if (!confirm(confirmMsg)) return;

  try {
    deleteOverlay.classList.remove('hidden'); // Tunjukkan overlay

    if (!isFolder) {
      // Jika Fail, padam Storage dan Firestore dokumen secara rata
      if (data.storagePath) {
        await deleteObject(ref(storage, data.storagePath));
      }
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId));
    } else {
      // JIKA FOLDER -> PANGGIL SKRIP RECURSIVE AUTO-DELETE
      console.log(`Memulakan sistem pemadaman automatik untuk folder: ${data.name}`);
      await deleteFolderRecursive(docId, currentUser.uid);
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId)); // Padam folder itu sendiri
      console.log(`Folder dipadam sepenuhnya.`);
    }

  } catch (err) {
    console.error("Ralat memadam item:", err);
    alert("Gagal memadam item atau sebahagian isinya. Sila semak konsol untuk maklumat lanjut.");
  } finally {
    deleteOverlay.classList.add('hidden'); // Sorokkan overlay
  }
}

// 7. SKRIP RECURSIVE AUTO-DELETE (Powerful)
// Ia mencari semua anak, sub-anak, sub-sub-anak (sedalam mana pun) secara Recursive
async function deleteFolderRecursive(itemId, userId) {
  const itemsRef = collection(db, `users/${userId}/drive_items`);
  // Cari semua dokumen yang parentId-nya ialah folder ini
  const q = query(itemsRef, where("parentId", "==", itemId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return; // Tiada isi, teruskan

  console.log(`Menjumpai ${snapshot.size} fail/folder di dalam folder ID: ${itemId}`);

  // Gunakan writeBatch untuk memadam ratusan dokumen Firestore serentak dengan Efficient
  const batch = writeBatch(db);

  for (let docSnap of snapshot.docs) {
    const childData = docSnap.data();
    const childId = docSnap.id;

    if (childData.type === 'file') {
      // Padam fail dari Storage
      if (childData.storagePath) {
        try {
          console.log(`Memadam fail dari Storage: ${childData.name}`);
          await deleteObject(ref(storage, childData.storagePath));
        } catch (e) {
          console.warn(`Gagal padam fail di Storage (mungkin dah dipadam manual): ${childData.storagePath}`);
        }
      }
      // Tambah fail untuk dipadam dari Firestore batch
      batch.delete(docSnap.ref);

    } else if (childData.type === 'folder') {
      // JIKA SUB-FOLDER -> PANGGIL SEMULA SKRIP INI (RECURSION)
      console.log(`Sub-folder dijumpai: "${childData.name}". Masuk ke dalam secara recursive...`);
      await deleteFolderRecursive(childId, userId); // Masuk ke tahap lebih dalam
      // Selepas sub-folder kosong, tambah dokumen Firestore sub-folder itu sendiri ke batch padam
      batch.delete(docSnap.ref);
    }
  }

  // Laksanakan semua pemadaman Firestore dokumen yang telah dikumpul dalam batch ini
  await batch.commit();
  console.log(`Pemadaman batch Firestore dokumen untuk folder ID: ${itemId} selesai.`);
}

// 8. Tukar Nama Fail / Folder (FUNGSI TAMBAHAN BARU)
async function renameItem(docId, data) {
  const currentName = data.name;
  const newName = prompt(`Masukkan nama baru untuk "${currentName}":`, currentName);
  
  if (!newName || !newName.trim() || newName.trim() === currentName) {
    return; // Tiada penukaran nama atau batal
  }

  try {
    const newNameTrimmed = newName.trim();
    
    // Kemas kini nama fail di Firestore
    const docRef = doc(db, `users/${currentUser.uid}/drive_items`, docId);
    await updateDoc(docRef, {
      name: newNameTrimmed
    });
    
    console.log(`Item berjaya ditukar nama ke "${newNameTrimmed}"`);
  } catch (err) {
    console.error("Ralat tukar nama item:", err);
    alert("Gagal menukar nama item. Sila cuba lagi.");
  }
}

// 9. Carian Fail Pintar (Real-time di folder semasa)
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
