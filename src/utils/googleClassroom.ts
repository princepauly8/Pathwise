import type { TopicReminderItem } from '../types/study';

const CLASSROOM_API_BASE = 'https://classroom.googleapis.com/v1';

export interface ClassroomDate {
  year: number;
  month: number;
  day: number;
}

export interface ClassroomTimeOfDay {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

export interface ClassroomMaterialAttachment {
  driveFile?: {
    driveFile?: {
      id?: string;
      title?: string;
      alternateLink?: string;
      thumbnailUrl?: string;
    };
  };
  youtubeVideo?: {
    id?: string;
    title?: string;
    alternateLink?: string;
    thumbnailUrl?: string;
  };
  link?: {
    url?: string;
    title?: string;
    thumbnailUrl?: string;
  };
  form?: {
    formUrl?: string;
    title?: string;
    thumbnailUrl?: string;
  };
}

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  creationTime?: string;
  updateTime?: string;
  enrollmentCode?: string;
  courseState?: 'ACTIVE' | 'ARCHIVED' | 'PROVISIONED' | 'DECLINED' | 'SUSPENDED';
  alternateLink?: string;
}

export interface ClassroomCourseWork {
  courseId: string;
  id: string;
  title: string;
  description?: string;
  materials?: ClassroomMaterialAttachment[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  dueDate?: ClassroomDate;
  dueTime?: ClassroomTimeOfDay;
  maxPoints?: number;
  workType?: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
  topicId?: string;
}

export interface ClassroomStudentSubmission {
  courseId: string;
  courseWorkId: string;
  id: string;
  userId?: string;
  state?: 'NEW' | 'CREATED' | 'TURNED_IN' | 'RETURNED' | 'RECLAIMED_BY_STUDENT';
  late?: boolean;
  assignedGrade?: number;
  draftGrade?: number;
  alternateLink?: string;
  updateTime?: string;
}

export interface ClassroomAnnouncement {
  courseId: string;
  id: string;
  text: string;
  materials?: ClassroomMaterialAttachment[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  creatorUserId?: string;
}

export interface ClassroomCourseWorkMaterial {
  courseId: string;
  id: string;
  title: string;
  description?: string;
  materials?: ClassroomMaterialAttachment[];
  state?: 'PUBLISHED' | 'DRAFT' | 'DELETED';
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  topicId?: string;
}

export interface ClassroomTopic {
  courseId: string;
  topicId: string;
  name: string;
  updateTime?: string;
}

export interface ClassroomUserProfile {
  id?: string;
  name?: {
    givenName?: string;
    familyName?: string;
    fullName?: string;
  };
  emailAddress?: string;
  photoUrl?: string;
}

export interface ClassroomPerson {
  courseId: string;
  userId: string;
  profile?: ClassroomUserProfile;
}

export interface NormalizedAttachment {
  kind: 'drive' | 'youtube' | 'link' | 'form';
  title: string;
  url: string;
}

export class ClassroomApiError extends Error {
  status: number;
  isAuthError: boolean;
  isPermissionDenied: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ClassroomApiError';
    this.status = status;
    this.isAuthError = status === 401;
    this.isPermissionDenied = status === 403;
  }
}

async function classroomFetch<T>(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${CLASSROOM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const apiErr = (data as { error?: { message?: string; status?: string } } | null)?.error;
    let message = apiErr?.message || `Google Classroom request failed (HTTP ${response.status}).`;
    if (response.status === 401) {
      message = 'Your Google Classroom session expired. Please sign in with Google again.';
    } else if (response.status === 403 && message.toLowerCase().includes('insufficient')) {
      message =
        'Additional Google Classroom permission is needed for this action. Sign in with Google again and grant access.';
    }
    throw new ClassroomApiError(message, response.status);
  }

  return (data ?? {}) as T;
}

// --- Read APIs ---

export async function listCourses(accessToken: string): Promise<ClassroomCourse[]> {
  const data = await classroomFetch<{ courses?: ClassroomCourse[] }>(
    accessToken,
    '/courses?courseStates=ACTIVE&courseStates=PROVISIONED&courseStates=ARCHIVED&pageSize=30'
  );
  return Array.isArray(data.courses) ? data.courses : [];
}

export async function listCourseWork(
  accessToken: string,
  courseId: string
): Promise<ClassroomCourseWork[]> {
  const data = await classroomFetch<{ courseWork?: ClassroomCourseWork[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork?pageSize=30&orderBy=updateTime%20desc`
  );
  return Array.isArray(data.courseWork) ? data.courseWork : [];
}

export async function listMySubmissions(
  accessToken: string,
  courseId: string
): Promise<ClassroomStudentSubmission[]> {
  const data = await classroomFetch<{ studentSubmissions?: ClassroomStudentSubmission[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork/-/studentSubmissions?userId=me&pageSize=50`
  );
  return Array.isArray(data.studentSubmissions) ? data.studentSubmissions : [];
}

export async function listAnnouncements(
  accessToken: string,
  courseId: string
): Promise<ClassroomAnnouncement[]> {
  const data = await classroomFetch<{ announcements?: ClassroomAnnouncement[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/announcements?pageSize=25&orderBy=updateTime%20desc`
  );
  return Array.isArray(data.announcements) ? data.announcements : [];
}

export async function listCourseWorkMaterials(
  accessToken: string,
  courseId: string
): Promise<ClassroomCourseWorkMaterial[]> {
  const data = await classroomFetch<{ courseWorkMaterial?: ClassroomCourseWorkMaterial[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?pageSize=30&orderBy=updateTime%20desc`
  );
  return Array.isArray(data.courseWorkMaterial) ? data.courseWorkMaterial : [];
}

export async function listTopics(
  accessToken: string,
  courseId: string
): Promise<ClassroomTopic[]> {
  const data = await classroomFetch<{ topic?: ClassroomTopic[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/topics?pageSize=30`
  );
  return Array.isArray(data.topic) ? data.topic : [];
}

export async function listTeachers(
  accessToken: string,
  courseId: string
): Promise<ClassroomPerson[]> {
  const data = await classroomFetch<{ teachers?: ClassroomPerson[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/teachers?pageSize=20`
  );
  return Array.isArray(data.teachers) ? data.teachers : [];
}

export async function listStudents(
  accessToken: string,
  courseId: string
): Promise<ClassroomPerson[]> {
  const data = await classroomFetch<{ students?: ClassroomPerson[] }>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/students?pageSize=50`
  );
  return Array.isArray(data.students) ? data.students : [];
}

// --- Mutating / Destructive APIs (Caller MUST present explicit user confirmation dialog first) ---

export async function createCourse(
  accessToken: string,
  input: { name: string; section?: string; room?: string; descriptionHeading?: string }
): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>(accessToken, '/courses', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      section: input.section?.trim() || undefined,
      room: input.room?.trim() || undefined,
      descriptionHeading: input.descriptionHeading?.trim() || undefined,
      ownerId: 'me',
      courseState: 'PROVISIONED',
    }),
  });
}

export async function archiveCourse(
  accessToken: string,
  courseId: string
): Promise<ClassroomCourse> {
  return classroomFetch<ClassroomCourse>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}?updateMask=courseState`,
    {
      method: 'PATCH',
      body: JSON.stringify({ courseState: 'ARCHIVED' }),
    }
  );
}

export async function deleteCourse(accessToken: string, courseId: string): Promise<void> {
  await classroomFetch(accessToken, `/courses/${encodeURIComponent(courseId)}`, {
    method: 'DELETE',
  });
}

export async function createAnnouncement(
  accessToken: string,
  courseId: string,
  text: string
): Promise<ClassroomAnnouncement> {
  return classroomFetch<ClassroomAnnouncement>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/announcements`,
    {
      method: 'POST',
      body: JSON.stringify({
        text: text.trim(),
        state: 'PUBLISHED',
      }),
    }
  );
}

export async function deleteAnnouncement(
  accessToken: string,
  courseId: string,
  announcementId: string
): Promise<void> {
  await classroomFetch(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' }
  );
}

export async function createCourseWork(
  accessToken: string,
  courseId: string,
  input: {
    title: string;
    description?: string;
    maxPoints?: number;
    dueDateStr?: string; // YYYY-MM-DD
    topicId?: string;
  }
): Promise<ClassroomCourseWork> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
  };
  if (typeof input.maxPoints === 'number' && !Number.isNaN(input.maxPoints) && input.maxPoints >= 0) {
    payload.maxPoints = input.maxPoints;
  }
  if (input.topicId) {
    payload.topicId = input.topicId;
  }
  if (input.dueDateStr && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDateStr)) {
    const [y, m, d] = input.dueDateStr.split('-').map(Number);
    payload.dueDate = { year: y, month: m, day: d };
    payload.dueTime = { hours: 23, minutes: 59 };
  }

  return classroomFetch<ClassroomCourseWork>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCourseWork(
  accessToken: string,
  courseId: string,
  workId: string
): Promise<void> {
  await classroomFetch(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWork/${encodeURIComponent(workId)}`,
    { method: 'DELETE' }
  );
}

export async function createTopic(
  accessToken: string,
  courseId: string,
  name: string
): Promise<ClassroomTopic> {
  return classroomFetch<ClassroomTopic>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/topics`,
    {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    }
  );
}

export async function createCourseWorkMaterial(
  accessToken: string,
  courseId: string,
  input: {
    title: string;
    description?: string;
    linkUrl?: string;
    topicId?: string;
  }
): Promise<ClassroomCourseWorkMaterial> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    state: 'PUBLISHED',
  };
  if (input.topicId) {
    payload.topicId = input.topicId;
  }
  if (input.linkUrl?.trim()) {
    payload.materials = [{ link: { url: input.linkUrl.trim() } }];
  }
  return classroomFetch<ClassroomCourseWorkMaterial>(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCourseWorkMaterial(
  accessToken: string,
  courseId: string,
  materialId: string
): Promise<void> {
  await classroomFetch(
    accessToken,
    `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials/${encodeURIComponent(materialId)}`,
    { method: 'DELETE' }
  );
}

// --- Pure Helpers ---

export function formatClassroomDueDate(
  dueDate?: ClassroomDate,
  dueTime?: ClassroomTimeOfDay
): { label: string; iso: string | null; isPast: boolean } {
  if (!dueDate || !dueDate.year || !dueDate.month || !dueDate.day) {
    return { label: 'No due date', iso: null, isPast: false };
  }
  const hours = dueTime?.hours ?? 23;
  const minutes = dueTime?.minutes ?? 59;
  const dt = new Date(Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, hours, minutes));
  if (Number.isNaN(dt.getTime())) {
    return { label: 'No due date', iso: null, isPast: false };
  }
  const label = dt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return {
    label: `Due ${label}`,
    iso: dt.toISOString(),
    isPast: dt.getTime() < Date.now(),
  };
}

export function getSubmissionStatusMeta(
  submission?: ClassroomStudentSubmission,
  maxPoints?: number
): { label: string; tone: 'emerald' | 'sky' | 'amber' | 'slate' } {
  if (!submission) {
    return { label: 'Assigned', tone: 'slate' };
  }
  if (typeof submission.assignedGrade === 'number') {
    const score =
      typeof maxPoints === 'number' && maxPoints > 0
        ? `${submission.assignedGrade}/${maxPoints}`
        : `${submission.assignedGrade} pts`;
    return { label: `Graded · ${score}`, tone: 'emerald' };
  }
  if (submission.state === 'TURNED_IN') {
    return { label: submission.late ? 'Turned in (Late)' : 'Turned in', tone: 'emerald' };
  }
  if (submission.state === 'RETURNED') {
    return { label: 'Returned', tone: 'sky' };
  }
  if (submission.late) {
    return { label: 'Missing / Late', tone: 'amber' };
  }
  return { label: 'Assigned', tone: 'slate' };
}

export function extractMaterialAttachments(
  materials?: ClassroomMaterialAttachment[]
): NormalizedAttachment[] {
  if (!Array.isArray(materials)) return [];
  const results: NormalizedAttachment[] = [];
  for (const item of materials) {
    if (item.driveFile?.driveFile?.alternateLink) {
      results.push({
        kind: 'drive',
        title: item.driveFile.driveFile.title || 'Google Drive File',
        url: item.driveFile.driveFile.alternateLink,
      });
    } else if (item.youtubeVideo?.alternateLink) {
      results.push({
        kind: 'youtube',
        title: item.youtubeVideo.title || 'YouTube Video',
        url: item.youtubeVideo.alternateLink,
      });
    } else if (item.link?.url) {
      results.push({
        kind: 'link',
        title: item.link.title || item.link.url,
        url: item.link.url,
      });
    } else if (item.form?.formUrl) {
      results.push({
        kind: 'form',
        title: item.form.title || 'Google Form',
        url: item.form.formUrl,
      });
    }
  }
  return results;
}

export function buildReminderFromCourseWork(
  courseName: string,
  work: ClassroomCourseWork
): TopicReminderItem {
  const due = formatClassroomDueDate(work.dueDate, work.dueTime);
  const fallbackDueIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `gcr-${work.courseId}-${work.id}`,
    subject: courseName.trim().slice(0, 60) || 'Google Classroom',
    topicTitle: work.title.trim().slice(0, 110) || 'Classroom Assignment',
    dueAt: due.iso ?? fallbackDueIso,
    note: `Google Classroom (${courseName})${work.maxPoints ? ` · ${work.maxPoints} pts` : ''}`,
    completed: false,
  };
}
