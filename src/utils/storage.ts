import type { StudentProfile } from '../types/study';

const PROFILES_KEY = 'pathwise_student_profiles_v1';
const ACTIVE_ID_KEY = 'pathwise_active_student_id_v1';

export function loadStudentProfiles(): StudentProfile[] {
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStudentProfiles(profiles: StudentProfile[]): void {
  try {
    const compact = profiles.map((p) => ({
      ...p,
      tutorHistory: Object.fromEntries(
        Object.entries(p.tutorHistory ?? {}).map(([subject, msgs]) => [
          subject,
          (msgs ?? []).map(({ imagePreviewUrl: _omit, ...rest }) => rest),
        ])
      ),
    }));
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(compact));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function loadActiveStudentId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function saveActiveStudentId(id: string | null): void {
  try {
    if (id) {
      window.localStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      window.localStorage.removeItem(ACTIVE_ID_KEY);
    }
  } catch {
    // Ignore storage errors gracefully
  }
}
