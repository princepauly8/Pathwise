# Pathwise Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: A `/students/{userId}` document contains private PII (`email`, `name`, academic profile) and may ONLY be read, created, updated, or deleted by the verified user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`. Listing `/students` is strictly denied.
2. **Master Gate Relational Integrity**: Every `/students/{userId}/subjectPaths/{subjectKey}` and `/students/{userId}/tutorThreads/{subjectKey}` write requires that the parent `/students/{userId}` document exists and that `data.uid == request.auth.uid == userId`.
3. **Zero Privilege Escalation / Zero Shadow Fields**: Every `create` enforces `hasAll` + `hasOnly` against the exact blueprint schema; every `update` begins with `isValid[Entity](incoming())`, locks immutable identity/creation fields (`uid`, `email`, `createdAt`, `subjectKey`), and uses named actions with `affectedKeys().hasOnly(...)`.
4. **Temporal & Volumetric Integrity**: `createdAt` and `updatedAt` must strictly equal `request.time`. All strings, IDs, and arrays enforce explicit upper/lower bounds (`subjects` 1..8, `modules` 1..8, `messages` 0..40).

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Be Denied)
1. **Unauthenticated Read (`GET /students/user-a`)**: `auth = null` -> DENIED.
2. **Cross-User PII Read (`GET /students/user-b` as `user-a`)**: `auth.uid = 'user-a'` -> DENIED.
3. **User Directory Enumeration (`LIST /students`)**: `auth.uid = 'user-a'` -> DENIED (`allow list: if false`).
4. **Unverified Email Write (`CREATE /students/user-a`)**: `auth.token.email_verified = false` -> DENIED.
5. **Identity Spoofing on Create (`CREATE /students/user-a` with `uid: 'user-b'`)**: `data.uid != auth.uid` -> DENIED.
6. **Email Spoofing on Create (`CREATE /students/user-a` with `email: 'victim@example.com'`)**: `data.email != auth.token.email` -> DENIED.
7. **Shadow Field / Self-Assigned Admin Role (`CREATE /students/user-a` with `role: 'admin'` or `isAdmin: true`)**: rejected by `hasOnly(...)` -> DENIED.
8. **Client-Forged Timestamp (`CREATE /students/user-a` with `createdAt: 2020-01-01`)**: `data.createdAt != request.time` -> DENIED.
9. **Immutable Field Tampering (`UPDATE /students/user-a` changing `createdAt` or `email` or `uid`)**: rejected by immutability & `affectedKeys().hasOnly(...)` -> DENIED.
10. **Denial-of-Wallet Oversized Payload (`CREATE /students/user-a` with `name` of 5000 chars or 25 `subjects`)**: rejected by `.size()` bounds -> DENIED.
11. **Path ID Poisoning (`CREATE /students/user-a/subjectPaths/bad$id!space`)**: rejected by `isValidId(subjectKey)` -> DENIED.
12. **Orphaned Subcollection Write (`CREATE /students/user-a/subjectPaths/math` when `/students/user-a` does not exist)**: rejected by Master Gate `exists(/databases/$(database)/documents/students/$(userId))` -> DENIED.
