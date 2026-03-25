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
const btnPaste = document.getElementById('btn-paste'); // DOM Baru
const fileInput = document.getElementById('file-input');
const searchInput = document.getElementById('search');

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
let itemToMove = null; // State Baru untuk Cut & Paste

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
    authMsg.textContent = "Gagal log masuk: Domain tidak dibenarkan atau tetingkap ditutup.";
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
    renderItems(currentItems);
  });
}

function renderItems(itemsToRender) {
  itemList.innerHTML = '';
  
  if (itemsToRender.length === 0) {
    itemList.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--subtext); padding: 40px;">Folder ini kosong.</p>';
    return;
  }

  itemsToRender.forEach((data) => {
    const card = document.createElement('div');
    card.className = 'item-card';

    const cardToolbar = document.createElement('div');
    cardToolbar.className = 'card-actions-toolbar';

    // Butang Cut (Pindah)
    const btnMove = document.createElement('button');
    btnMove.className = 'btn-card-action move';
    btnMove.innerHTML = '✂️';
    btnMove.title = 'Pindah Item (Cut)';
    btnMove.onclick = (e) => {
      e.stopPropagation();
      itemToMove = data;
      btnPaste.classList.remove('hidden');
      btnPaste.textContent = `📋 Tampal "${data.name}"`;
      alert(`Berjaya dipotong! Masuk ke mana-mana folder dan klik butang Tampal di atas.`);
    };

    // Butang Rename
    const btnRename = document.createElement('button');
    btnRename.className = 'btn-card-action rename';
    btnRename.innerHTML = '✏️';
    btnRename.title = 'Tukar Nama';
    btnRename.onclick = (e) => {
      e.stopPropagation();
      renameItem(data.id, data);
    };

    // Butang Delete
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-card-action delete';
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

    // Susun butang: Cut -> Rename -> Delete
    cardToolbar.appendChild(btnMove);
    cardToolbar.appendChild(btnRename); 
    cardToolbar.appendChild(btnDelete); 
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

  fileInput.value = '';
};

async function deleteItem(docId, data) {
  const isFolder = data.type === 'folder';
  const confirmMsg = isFolder 
    ? `AWAS: Anda pasti mahu padam folder "${data.name}"?\nSistem akan memadam semua sub-folder dan fail di dalamnya (Firestore & Storage) secara automatik.` 
    : `Padam fail "${data.name}"?`;

  if (!confirm(confirmMsg)) return;

  try {
    deleteOverlay.classList.remove('hidden'); 

    if (!isFolder) {
      if (data.storagePath) {
        await deleteObject(ref(storage, data.storagePath));
      }
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId));
    } else {
      await deleteFolderRecursive(docId, currentUser.uid);
      await deleteDoc(doc(db, `users/${currentUser.uid}/drive_items`, docId)); 
    }

  } catch (err) {
    console.error("Ralat memadam item:", err);
    alert("Gagal memadam item. Sila semak konsol.");
  } finally {
    deleteOverlay.classList.add('hidden'); 
  }
}

async function deleteFolderRecursive(itemId, userId) {
  const itemsRef = collection(db, `users/${userId}/drive_items`);
  const q = query(itemsRef, where("parentId", "==", itemId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);

  for (let docSnap of snapshot.docs) {
    const childData = docSnap.data();
    const childId = docSnap.id;

    if (childData.type === 'file') {
      if (childData.storagePath) {
        try {
          await deleteObject(ref(storage, childData.storagePath));
        } catch (e) {
          console.warn(`Gagal padam fail fizikal: ${childData.storagePath}`);
        }
      }
      batch.delete(docSnap.ref);

    } else if (childData.type === 'folder') {
      await deleteFolderRecursive(childId, userId); 
      batch.delete(docSnap.ref);
    }
  }

  await batch.commit();
}

async function renameItem(docId, data) {
  const currentName = data.name;
  const newName = prompt(`Masukkan nama baru untuk "${currentName}":`, currentName);
  
  if (!newName || !newName.trim() || newName.trim() === currentName) {
    return;
  }

  try {
    const newNameTrimmed = newName.trim();
    const docRef = doc(db, `users/${currentUser.uid}/drive_items`, docId);
    await updateDoc(docRef, {
      name: newNameTrimmed
    });
  } catch (err) {
    console.error("Ralat tukar nama:", err);
    alert("Gagal menukar nama.");
  }
}

// ==========================================
// FUNGSI ALIH FAIL (CUT & PASTE)
// ==========================================
btnPaste.addEventListener('click', async () => {
  if (!itemToMove) return;
  
  const currentFolder = getCurrentFolder();

  // Halang masuk ke folder sendiri
  if (itemToMove.id === currentFolder.id) {
    alert("Ralat: Tidak boleh pindahkan folder ke dalam dirinya sendiri.");
    return;
  }

  // Halang jika fail sudah ada di destinasi
  if (itemToMove.parentId === currentFolder.id) {
    alert("Item sudah berada di dalam folder ini.");
    itemToMove = null;
    btnPaste.classList.add('hidden');
    return;
  }

  try {
    const docRef = doc(db, `users/${currentUser.uid}/drive_items`, itemToMove.id);
    await updateDoc(docRef, {
      parentId: currentFolder.id
    });
    
    console.log(`Berjaya dipindahkan ke: ${currentFolder.name}`);
  } catch (err) {
    console.error("Gagal pindah fail:", err);
    alert("Gagal memindahkan fail.");
  } finally {
    itemToMove = null;
    btnPaste.classList.add('hidden');
  }
});

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

function escapeHtml(s) { 
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); 
}
