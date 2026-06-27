# Supabase Storage 設計書 — Freediving Japan

> 最終更新：2026-06-28

---

## 1. 概要

ユーザー写真・インストラクター写真を管理する Supabase Storage の設計。  
`avatars` バケット（パブリック）を使用。

---

## 2. バケット設定

| 項目 | 値 |
|---|---|
| バケット名 | `avatars` |
| 公開設定 | **パブリック**（URL 直アクセス可） |
| ファイルサイズ上限 | 5MB（フロントで制限） |
| 対応形式 | `jpg`, `jpeg`, `png`, `webp`, `gif` |

---

## 3. ファイルパス規則

| 用途 | パス | 保存先 |
|---|---|---|
| マイページのユーザー写真 | `{user_id}/mypage.{ext}` | `auth.users.user_metadata.avatar_url` |
| インストラクター写真 | `{user_id}/instructor.{ext}` | `instructors.photo_url` |

**例：**
```
avatars/abc123.../mypage.jpg       → マイページアバター
avatars/abc123.../instructor.png   → プロダッシュボードのプロフィール写真
```

---

## 4. アップロード処理

### マイページ（mypage.html）

```js
async function handleAvatarFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { /* エラー */ return; }

  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${_currentUser.id}/mypage.${ext}`;

  const { error } = await _sb.storage
    .from('avatars')
    .upload(path, file, { upsert: true }); // 上書き許可

  if (!error) {
    const { data } = _sb.storage.from('avatars').getPublicUrl(path);
    _newAvatarUrl = data.publicUrl;
  }
}

// 保存時: auth.updateUser({ data: { avatar_url: _newAvatarUrl } })
```

### プロダッシュボード（pro/index.html）

```js
async function handleInstructorPhotoFile(input) {
  const file = input.files[0];
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/instructor.${ext}`;

  const { error } = await _sb.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (!error) {
    const { data } = _sb.storage.from('avatars').getPublicUrl(path);
    _newInstructorPhotoUrl = data.publicUrl;
  }
}

// 保存時: instructors.photo_url を UPDATE
```

---

## 5. RLS ポリシー（storage.objects）

```sql
-- SELECT: 誰でも閲覧可（パブリックバケット）
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- INSERT/UPDATE: 本人のみ（パスの先頭が自分の user_id）
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

-- DELETE: 本人のみ
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );
```

---

## 6. 公開 URL 取得

```js
const { data } = _sb.storage.from('avatars').getPublicUrl(path);
// → data.publicUrl = 'https://bbhqvbpsuccbdcnhnobm.supabase.co/storage/v1/object/public/avatars/{path}'
```

---

## 7. フロントでの表示

```js
// mypage.html でのアバター表示（優先順位）
const avatarUrl = meta.avatar_url || meta.picture || null;
// ・avatar_url: Storage にアップロードした写真（メール登録・マイページ変更）
// ・picture: Google OAuth で取得した Google アカウント写真
// ・null: イニシャル（名前の先頭2文字）をアバターとして表示
```

---

## 8. 既知の制限・将来対応

| 項目 | 内容 |
|---|---|
| 画像リサイズ | フロントでの圧縮なし（アップロードサイズ上限5MBで制御） |
| CDN キャッシュ | Supabase 組み込みの CDN を利用 |
| リスティング画像 | `listings.gallery_urls` は外部 URL（Storage 未使用）。将来的に Storage に移行予定 |
| 古い写真の削除 | `upsert: true` で同じパスに上書きするため自動的に古い写真は置き換わる |
