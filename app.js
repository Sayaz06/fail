import {
  auth,
  db,
  storage,
  googleProvider, 
  signInWithPopup,   
  onAuthStateChanged,
  signOut,
  collection,
  doc,
  addDoc,
  getDocs, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch, 
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "./firebase.js";

// ==========================================
// ELEMEN DOM
// ==========================================
const pageLogin = document.getElementById('page-login');
const pageHome = document.getElementById('page-home');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLogout = document.getElementById('btn-logout');
const authMsg = document.getElementById('auth-msg');
const deleteOverlay = document.getElementById('delete-overlay');

const btnBack = document.getElementById('btn-back');
const currentFolderName = document.getElementById('current-folder-name');
const btnNewFolder = document.getElementById('btn-new-folder');
const btnUpload = document.getElementById('btn-upload');
const btnPaste = document.getElementById('btn-paste'); 
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search');

// Elemen Multi-Select
const msToolbar = document.getElementById('multi-select-toolbar');
const msCount = document.getElementById('select-count');
const btnCutSelected = document.getElementById('btn-cut-selected');
const btnCancelSelect = document.getElementById('btn-cancel-select');

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

// State Cut, Paste & Multi-Select
let itemsToMove = []; 
let selectedItemIds = new Set();

function getCurrentFolder() {
  return folderHistory[folderHistory.length - 1];
}

// ==========================================
// PENGURUSAN AKAUN (AUTH)
// ==========================================
btnLoginGoogle.addEventListener('click', async () => {
  try {
    authMsg.textContent = "Membuka tetingkap Google...";
    btnLoginGoogle.disabled = true;
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    authMsg.textContent = "Gagal log masuk. Pastikan domain dibenarkan.";
    console.error(err);
    btnLoginGoogle.disabled = false;
  }
});

btnLogout.addEventListener('click', async () => {
  await signOut(auth);
});

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
    folderHistory = [{ id: 'root', name: 'Utama (Root)' }];
  }
});

// ==========================================
// PENGURUSAN FAIL & FOLDER
// ==========================================
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
    // Bersihkan pilihan jika item hilang/dipadam
    selectedItemIds = new Set([...selectedItemIds].filter(id => currentItems.some(i => i.id === id)));
    updateMultiSelectUI();
    renderItems(currentItems);
  });
}

// --- FUNGSI RENDER DIPERBAIKI ---
function renderItems(itemsToRender) {
  itemList.innerHTML = '';
  
  if (itemsToRender.length === 0) {
    itemList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--subtext); padding: 40px;">Folder ini kosong.</p>';
    return;
  }

  itemsToRender.forEach((data) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    if (selectedItemIds.has(data.id)) card.classList.add('selected');

    // 1. TULIS KANDUNGAN HTML KAD DAHULU
    if (data.type === 'folder') {
      card.innerHTML = `
        <div class="item-icon" style="color: var(--folder);">📁</div>
        <div class="item-name">${escapeHtml(data.name)}</div>
        <div class="item-meta">Folder</div>
      `;
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
    }

    // 2. CIPTA KOTAK SEMAK (CHECKBOX)
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'item-checkbox';
    checkbox.checked = selectedItemIds.has(data.id);
    checkbox.onchange = (e) => {
      if (e.target.checked) {
        selectedItemIds.add(data.id);
        card.classList.add('selected');
      } else {
        selectedItemIds.delete(data.id);
        card.classList.remove('selected');
      }
      updateMultiSelectUI();
    };

    // 3. CIPTA TOOLBAR TINDAKAN
    const cardToolbar = document.createElement('div');
    cardToolbar.className = 'card-actions-toolbar';

    // Butang Kongsi (Hanya Fail)
    if (data.type === 'file') {
      const btnShare = document.createElement('button');
      btnShare.className = 'btn-card-action share';
      btnShare.innerHTML = '🔗';
      btnShare.title = 'Kongsi Pautan';
      btnShare.onclick = async (e) => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: data.name, text: `Lihat fail ini: ${data.name}`, url: data.url
            });
          } catch (err) { console.log('Batal share'); }
        } else {
          navigator.clipboard.writeText(data.url);
          alert('Pautan disalin! Boleh paste di WhatsApp/Telegram.');
        }
      };
      cardToolbar.appendChild(btnShare);
    }

    // Butang Cut (Individu)
    const btnMove = document.createElement('button');
    btnMove.className = 'btn-card-action move';
    btnMove.innerHTML = '✂️';
    btnMove.title = 'Pindah (Cut)';
    btnMove.onclick = (e) => {
      itemsToMove = [data]; 
      selectedItemIds.clear();
      updateMultiSelectUI();
      renderItems(currentItems); 
      
      btnPaste.classList.remove('hidden');
      btnPaste.textContent = `📋 Tampal "${data.name}"`;
      alert(`Berjaya dipotong! Masuk ke destinasi dan klik butang Tampal.`);
    };
    cardToolbar.appendChild(btnMove);

    // Butang Rename
    const btnRename = document.createElement('button');
    btnRename.className = 'btn-card-action rename';
    btnRename.innerHTML = '✏️';
    btnRename.title = 'Tukar Nama';
    btnRename.onclick = (e) => {
      renameItem(data.id, data);
    };
    cardToolbar.appendChild(btnRename);

    // Butang Delete
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-card-action delete';
    btnDelete.innerHTML = '✕';
    btnDelete.title = 'Padam Item';
    btnDelete.onclick = (e) => {
      deleteItem(data.id, data);
    };
    cardToolbar.appendChild(btnDelete);

    // 4. LOGIK KLIK KAD (DIPERBAIKI)
    card.onclick = (e) => {
      // ABAIKAN klik jika pengguna klik pada kotak semak atau butang-butang toolbar
      if (e.target.tagName === 'INPUT' || e.target.closest('.card-actions-toolbar')) {
        return; 
      }
      
      if (data.type === 'folder') {
        folderHistory.push({ id: data.id, name: data.name });
        searchInput.value = '';
        loadItems();
      } else {
        window.open(data.url, '_blank');
      }
    };

    // 5. MASUKKAN ELEMEN KE DALAM KAD
    card.appendChild(checkbox);
    card.appendChild(cardToolbar);
    itemList.appendChild(card);
  });
}

btnBack.onclick = () => {
  if (folderHistory.length > 1) {
    folderHistory.pop(); 
    searchInput.value = '';
    loadItems();         
  }
};

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
        (error) => { resolve(); },
        async () => {
          const url = await getDownloadURL(storageRef);
          await addDoc(collection(db, `users/${currentUser.uid}/drive_items`), {
            name: file.name, type: 'file', ext: fileExt, mimeType: file.type,
            size: file.size, storagePath: storageRef.fullPath,
            parentId: currentFolder.id, url: url, createdAt: serverTimestamp()
          });
          resolve();
        }
      );
    });
  }

  uploadLabel.textContent = "Selesai!";
  setTimeout(() => {
    uploadProgress.classList.add('hidden');
    uploadBar.style.width = '0%'; uploadLabel.textContent = 'Sedia...';
  }, 2000);
  fileInput.value = '';
};

// ==========================================
// FUNGSI MULTI-SELECT & CUT/PASTE PUKAL
// ==========================================
function updateMultiSelectUI() {
  const count = selectedItemIds.size;
  if (count > 0) {
    msToolbar.classList.remove('hidden');
    msCount.textContent = `${count} item dipilih`;
  } else {
    msToolbar.classList.add('hidden');
  }
}

btnCancelSelect.onclick = () => {
  selectedItemIds.clear();
  updateMultiSelectUI();
  renderItems(currentItems);
};

// Butang Cut Pukal di Menu Bawah
btnCutSelected.onclick = () => {
  itemsToMove = currentItems.filter(i => selectedItemIds.has(i.id));
  selectedItemIds.clear();
  updateMultiSelectUI();
  renderItems(currentItems);
  
  btnPaste.classList.remove('hidden');
  btnPaste.textContent = `📋 Tampal (${itemsToMove.length} Item)`;
  alert(`Berjaya memotong ${itemsToMove.length} item! Masuk destinasi dan klik Tampal.`);
};

// Butang Tampal Logik Pukal (Batch Paste)
btnPaste.addEventListener('click', async () => {
  if (itemsToMove.length === 0) return;
  const currentFolder = getCurrentFolder();

  // Tapis fail yang tak boleh dipindah
  const validItems = itemsToMove.filter(item => 
    item.id !== currentFolder.id && item.parentId !== currentFolder.id
  );

  if (validItems.length === 0) {
    alert("Item tidak sah atau sudah berada di dalam folder ini.");
    itemsToMove = [];
    btnPaste.classList.add('hidden');
    return;
  }

  try {
    const batch = writeBatch(db);
    validItems.forEach(item => {
      const docRef = doc(db, `users/${currentUser.uid}/drive_items`, item.id);
      batch.update(docRef, { parentId: currentFolder.id });
    });
    await batch.commit(); // Jalankan kemas kini pukal
    console.log(`Berjaya dipindah.`);
  } catch (err) {
    alert("Gagal memindahkan fail.");
  } finally {
    itemsToMove = [];
    btnPaste.classList.add('hidden');
  }
});

// ==========================================
// FUNGSI LAIN (Delete, Rename, Search)
// ==========================================
async function deleteItem(docId, data) {
  const isFolder = data.type === 'folder';
  const msg = isFolder ? `AWAS: Anda pasti mahu padam folder "${data.name}" dan isinya?` : `Padam fail "${data.name}"?`;
  if (!confirm(msg)) return;

  try {
    deleteOverlay.classList.remove('hidden'); 
    if (!isFolder) {
      if (data.storagePath) await deleteObject(ref(storage, data.storagePath));
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId));
    } else {
      await deleteFolderRecursive(docId, currentUser.uid);
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId)); 
    }
  } catch (err) {} finally { deleteOverlay.classList.add('hidden'); }
}

async function deleteFolderRecursive(itemId, userId) {
  const q = query(collection(db, `users/${userId}/drive_items`), where("parentId", "==", itemId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  for (let docSnap of snapshot.docs) {
    const childData = docSnap.data();
    if (childData.type === 'file' && childData.storagePath) {
      try { await deleteObject(ref(storage, childData.storagePath)); } catch (e) {}
    } else if (childData.type === 'folder') {
      await deleteFolderRecursive(docSnap.id, userId); 
    }
    batch.delete(docSnap.ref);
  }
  await batch.commit();
}

async function renameItem(docId, data) {
  const newName = prompt(`Nama baru untuk "${data.name}":`, data.name);
  if (!newName || !newName.trim() || newName.trim() === data.name) return;
  try {
    await updateDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId), { name: newName.trim() });
  } catch (err) { alert("Gagal menukar nama."); }
}

searchInput.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  renderItems(!q ? currentItems : currentItems.filter(item => item.name.toLowerCase().includes(q)));
});

function escapeHtml(s) { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
