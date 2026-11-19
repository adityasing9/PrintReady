import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PrintPreset, SavedShop, UserProfile, VaultDocument, VaultFolder } from '../domain/types';

/**
 * Persists authenticated user profile to /users/{uid} adhering strictly to firestore.rules schema.
 */
export async function syncUserProfileToFirestore(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(
      doc(db, 'users', profile.uid),
      {
        uid: profile.uid,
        displayName: profile.displayName.slice(0, 100),
        email: profile.email.slice(0, 160),
        phone: (profile.phone || '').slice(0, 32),
        role: profile.role === 'admin' ? 'customer' : profile.role,
        preferredLanguage: profile.preferredLanguage.slice(0, 16),
        theme: profile.theme,
        subscriptionPlan: profile.subscriptionPlan,
        loyaltyPoints: Math.max(0, Math.floor(profile.loyaltyPoints)),
        storageUsedBytes: 0,
        aiEnabled: profile.aiEnabled,
        cloudBackupEnabled: profile.cloudBackupEnabled,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveFolderToFirestore(uid: string, folder: VaultFolder): Promise<void> {
  const path = `users/${uid}/folders/${folder.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'folders', folder.id), {
      ownerId: uid,
      name: folder.name.slice(0, 80),
      category: folder.category.slice(0, 40),
      color: folder.color.slice(0, 24),
      parentId: folder.parentId || '',
      isFavourite: folder.isFavourite,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDocumentToFirestore(uid: string, docItem: VaultDocument): Promise<void> {
  const path = `users/${uid}/documents/${docItem.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'documents', docItem.id), {
      ownerId: uid,
      name: docItem.name.slice(0, 160),
      mimeType: docItem.mimeType.slice(0, 120),
      extension: docItem.extension.slice(0, 16),
      sizeBytes: Math.min(52428800, Math.max(0, Math.floor(docItem.sizeBytes))),
      pageCount: Math.min(2000, Math.max(1, Math.floor(docItem.pageCount))),
      folderId: docItem.folderId || '',
      category: docItem.category.slice(0, 40),
      tags: docItem.tags.slice(0, 15).map((t) => t.slice(0, 32)),
      ocrText: (docItem.ocrText || '').slice(0, 10000),
      summary: (docItem.summary || '').slice(0, 1000),
      checksum: (docItem.checksum || '').slice(0, 128),
      expiryDate: (docItem.expiryDate || '').slice(0, 32),
      version: Math.max(1, Math.floor(docItem.version)),
      isFavourite: docItem.isFavourite,
      isTrashed: docItem.isTrashed,
      syncStatus: 'synced',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocumentInFirestore(
  uid: string,
  docId: string,
  patch: Partial<VaultDocument>
): Promise<void> {
  const path = `users/${uid}/documents/${docId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (patch.name !== undefined) clean.name = patch.name.slice(0, 160);
    if (patch.folderId !== undefined) clean.folderId = patch.folderId || '';
    if (patch.category !== undefined) clean.category = patch.category.slice(0, 40);
    if (patch.tags !== undefined) clean.tags = patch.tags.slice(0, 15).map((t) => t.slice(0, 32));
    if (patch.ocrText !== undefined) clean.ocrText = patch.ocrText.slice(0, 10000);
    if (patch.summary !== undefined) clean.summary = patch.summary.slice(0, 1000);
    if (patch.expiryDate !== undefined) clean.expiryDate = patch.expiryDate.slice(0, 32);
    if (patch.version !== undefined) clean.version = Math.max(1, Math.floor(patch.version));
    if (patch.isFavourite !== undefined) clean.isFavourite = patch.isFavourite;
    if (patch.isTrashed !== undefined) clean.isTrashed = patch.isTrashed;
    if (patch.syncStatus !== undefined) clean.syncStatus = patch.syncStatus;
    await updateDoc(doc(db, 'users', uid, 'documents', docId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocumentFromFirestore(uid: string, docId: string): Promise<void> {
  const path = `users/${uid}/documents/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'documents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePresetToFirestore(uid: string, preset: PrintPreset): Promise<void> {
  const path = `users/${uid}/printPresets/${preset.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'printPresets', preset.id), {
      ownerId: uid,
      name: preset.name.slice(0, 64),
      paperSize: preset.settings.paperSize,
      colorMode: preset.settings.colorMode,
      sides: preset.settings.sides,
      orientation: preset.settings.orientation,
      copies: Math.min(500, Math.max(1, Math.floor(preset.settings.copies))),
      pagesPerSheet: preset.settings.pagesPerSheet,
      binding: preset.settings.binding,
      isFavourite: preset.isFavourite,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveSavedShopToFirestore(uid: string, shop: SavedShop): Promise<void> {
  const path = `users/${uid}/savedShops/${shop.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'savedShops', shop.id), {
      ownerId: uid,
      shopName: shop.shopName.slice(0, 120),
      registeredShopId: (shop.registeredShopId || '').slice(0, 128),
      phone: (shop.phone || '').slice(0, 32),
      whatsapp: (shop.whatsapp || '').slice(0, 32),
      email: (shop.email || '').slice(0, 160),
      address: (shop.address || '').slice(0, 240),
      group: shop.group.slice(0, 40),
      preferredContact: shop.preferredContact,
      notes: (shop.notes || '').slice(0, 500),
      isFavourite: shop.isFavourite,
      isDefault: shop.isDefault,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function loadUserVaultFromFirestore(uid: string): Promise<{
  folders: VaultFolder[];
  documents: VaultDocument[];
}> {
  const folderPath = `users/${uid}/folders`;
  const docPath = `users/${uid}/documents`;
  try {
    const [folderSnap, docSnap] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'folders')),
      getDocs(collection(db, 'users', uid, 'documents')),
    ]);

    const folders: VaultFolder[] = folderSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || 'Untitled'),
        category: String(data.category || 'Other'),
        color: String(data.color || '#4338CA'),
        parentId: data.parentId ? String(data.parentId) : null,
        isFavourite: Boolean(data.isFavourite),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
    });

    const documents: VaultDocument[] = docSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || 'Untitled'),
        mimeType: String(data.mimeType || 'application/pdf'),
        extension: String(data.extension || 'pdf'),
        sizeBytes: Number(data.sizeBytes || 0),
        pageCount: Number(data.pageCount || 1),
        folderId: data.folderId ? String(data.folderId) : null,
        category: String(data.category || 'Other'),
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        ocrText: String(data.ocrText || ''),
        summary: String(data.summary || ''),
        checksum: String(data.checksum || ''),
        expiryDate: data.expiryDate ? String(data.expiryDate) : undefined,
        version: Number(data.version || 1),
        isFavourite: Boolean(data.isFavourite),
        isTrashed: Boolean(data.isTrashed),
        syncStatus: 'synced',
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
    });

    return { folders, documents };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${folderPath} | ${docPath}`);
  }
}
