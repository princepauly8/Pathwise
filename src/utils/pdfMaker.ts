import { jsPDF } from 'jspdf';
import type {
  CrashRevisionPack,
  LearningModule,
  PreviousYearPaper,
  StudentProfile,
  SubjectPath,
} from '../types/study';

export interface PdfMakerOptions {
  includeFullNotes: boolean;
  includeShortNotes: boolean;
  includeShortcuts: boolean;
  includeWorkedExample: boolean;
  includeRevisionCards: boolean;
  includeRoadmapOverview: boolean;
}

export function generateStudyGuidePdf(params: {
  profile: StudentProfile;
  subjectPath: SubjectPath;
  module: LearningModule;
  options: PdfMakerOptions;
}): string {
  const { profile, subjectPath, module, options } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 52;
    }
  };

  const addSectionHeading = (title: string) => {
    ensureSpace(34);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const addBodyText = (text: string, indent = 0, boldPrefix?: string) => {
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const fullText = boldPrefix ? `${boldPrefix} ${text}` : text;
    const lines = doc.splitTextToSize(fullText, maxWidth - indent) as string[];
    ensureSpace(lines.length * 14 + 6);
    doc.setFont('helvetica', 'normal');
    for (const line of lines) {
      doc.text(line, margin + indent, y);
      y += 14;
    }
    y += 4;
  };

  // Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  doc.text(
    `PATHWISE STUDY GUIDE  |  ${profile.syllabus.toUpperCase()}  |  ${profile.classLevel.toUpperCase()}`,
    margin,
    y
  );
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(
    `${subjectPath.subject}: ${module.title}`,
    maxWidth
  ) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 22;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Prepared for ${profile.name}  ·  Stage: ${module.stage}  ·  Est. ${module.estimatedMinutes} min`,
    margin,
    y
  );
  y += 18;
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.5);
  y += 16;

  const lesson = module.lesson;

  if (options.includeFullNotes) {
    addSectionHeading('1. Detailed Study Notes');
    if (lesson) {
      addBodyText(lesson.summary, 0, 'Summary:');
      lesson.concepts.forEach((c, idx) => {
        ensureSpace(48);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(`${idx + 1}. ${c.heading}`, margin, y);
        y += 15;
        addBodyText(c.explanation, 8);
        if (c.formulaOrKeyRule) {
          doc.setFont('courier', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(3, 105, 161);
          const fLines = doc.splitTextToSize(`Formula / Rule: ${c.formulaOrKeyRule}`, maxWidth - 12) as string[];
          ensureSpace(fLines.length * 13 + 8);
          for (const fl of fLines) {
            doc.text(fl, margin + 8, y);
            y += 13;
          }
          y += 6;
        }
      });
    } else {
      addBodyText(module.whyItMatters);
      module.objectives.forEach((obj, idx) => addBodyText(`${idx + 1}. ${obj}`, 8));
    }

    if (module.studentNotes && module.studentNotes.trim()) {
      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('My Summary & Reflections', margin, y);
      y += 15;
      module.studentNotes
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .forEach((line) => addBodyText(line, 6));
    }
  }

  if (options.includeShortNotes) {
    addSectionHeading('2. Exam-Night Short Notes');
    const shortBullets =
      lesson?.shortNotes && lesson.shortNotes.length > 0
        ? lesson.shortNotes
        : module.concepts.map((c) => `Master key principle: ${c}`);
    shortBullets.forEach((bullet) => addBodyText(`• ${bullet}`, 6));
  }

  if (options.includeShortcuts) {
    addSectionHeading('3. Study Shortcuts & Memory Tricks');
    const shortcuts = lesson?.studyShortcuts ?? [];
    if (shortcuts.length > 0) {
      shortcuts.forEach((sc, idx) => {
        addBodyText(`${sc.trick} (Use when: ${sc.whenToUse})`, 6, `${idx + 1}. ${sc.title}:`);
      });
    } else {
      addBodyText(
        `Focus Strategy (${profile.syllabus}): ${subjectPath.focusStrategy}`,
        6
      );
    }
  }

  if (options.includeWorkedExample && lesson?.workedExample) {
    addSectionHeading('4. Worked Example Question');
    addBodyText(lesson.workedExample.prompt, 0, 'Problem:');
    lesson.workedExample.steps.forEach((step, idx) => {
      addBodyText(step, 8, `Step ${idx + 1}:`);
    });
    addBodyText(lesson.workedExample.takeaway, 0, 'Key Takeaway:');
  }

  if (options.includeRevisionCards) {
    addSectionHeading('5. Quick Revision Q&A');
    const cards =
      lesson?.revisionCards && lesson.revisionCards.length > 0
        ? lesson.revisionCards
        : module.objectives.map((o, idx) => ({
            id: `rev-${idx}`,
            front: `Check Objective ${idx + 1}`,
            back: o,
          }));
    cards.forEach((card, idx) => {
      addBodyText(`Q${idx + 1}: ${card.front}`, 4);
      addBodyText(`A: ${card.back}`, 12);
    });
  }

  if (options.includeRoadmapOverview) {
    addSectionHeading(`6. Full ${subjectPath.subject} Syllabus Roadmap`);
    subjectPath.modules.forEach((m) => {
      addBodyText(
        `${m.title} (${m.stage} · ${m.estimatedMinutes} min) — ${m.subtitle}`,
        4,
        `0${m.order}.`
      );
    });
  }

  const safeSlug = `${subjectPath.subject}-${module.title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const fileName = `pathwise-${safeSlug || 'study-guide'}.pdf`;

  doc.save(fileName);
  return fileName;
}

export function generateCrashRevisionPdf(pack: CrashRevisionPack, studentName: string): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 52;
    }
  };

  const addHeading = (heading: string) => {
    ensureSpace(34);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(heading, margin, y);
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;
  };

  const addLines = (text: string, indent = 0, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
    ensureSpace(lines.length * 14 + 6);
    for (const line of lines) {
      doc.text(line, margin + indent, y);
      y += 14;
    }
    y += 3;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  doc.text(
    `PATHWISE EXAM CRASH REVISION  |  ${pack.syllabus.toUpperCase()}  |  ${pack.classLevel.toUpperCase()}  |  ${pack.timeBudgetMinutes} MIN`,
    margin,
    y
  );
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(pack.title, maxWidth) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 20;
  }
  addLines(`Prepared for ${studentName} · Subject: ${pack.subject} · Strategy: ${pack.examStrategy}`);

  addHeading('1. High-Yield Exam Topics');
  pack.highYieldTopics.forEach((t, idx) => {
    addLines(`${idx + 1}. ${t.topic} [${t.weightage}]`, 0, true);
    t.keyPoints.forEach((kp) => addLines(`• ${kp}`, 10));
    addLines(`Exam cue: ${t.examTrigger}`, 10);
  });

  addHeading('2. Formula & Key-Fact Cheat Sheet');
  pack.formulaCheatSheet.forEach((f, idx) => {
    addLines(`${idx + 1}. ${f.label}: ${f.expression}`, 0, true);
    addLines(`Memory tip: ${f.quickMemoryTip}`, 10);
  });

  addHeading('3. Common Exam Traps to Avoid');
  pack.commonMistakes.forEach((m, idx) => {
    addLines(`${idx + 1}. Trap: ${m.trap}`, 0, true);
    addLines(`Fix: ${m.fix}`, 10);
  });

  addHeading('4. Rapid-Fire Exam Questions & Marking Points');
  pack.rapidFireQuestions.forEach((q, idx) => {
    addLines(`Q${idx + 1} (${q.marks}M): ${q.question}`, 0, true);
    addLines(`Answer: ${q.answerKey}`, 10);
    q.markingPoints.forEach((mp) => addLines(`• ${mp}`, 16));
  });

  const safeSlug = `crash-${pack.subject}-${pack.timeBudgetMinutes}m`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const fileName = `pathwise-${safeSlug || 'crash-revision'}.pdf`;
  doc.save(fileName);
  return fileName;
}

export function generatePreviousYearPaperPdf(
  paper: PreviousYearPaper,
  studentName: string,
  options?: { includeMarkingScheme?: boolean }
): string {
  const includeMarkingScheme = options?.includeMarkingScheme ?? false;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 52;
    }
  };

  const addLines = (
    text: string,
    opts?: { indent?: number; bold?: boolean; fontSize?: number; color?: [number, number, number] }
  ) => {
    const indent = opts?.indent ?? 0;
    const fontSize = opts?.fontSize ?? 10;
    const color = opts?.color ?? [51, 65, 85];
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth - indent) as string[];
    const lineHeight = Math.round(fontSize * 1.4);
    ensureSpace(lines.length * lineHeight + 6);
    for (const line of lines) {
      doc.text(line, margin + indent, y);
      y += lineHeight;
    }
    y += 4;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(2, 132, 199);
  doc.text(
    `PATHWISE PRACTICE PAPER  |  ${paper.syllabus.toUpperCase()}  |  ${paper.classLevel.toUpperCase()}  |  ${paper.year.toUpperCase()}`,
    margin,
    y
  );
  y += 22;

  addLines(paper.title, { bold: true, fontSize: 16, color: [15, 23, 42] });
  addLines(
    `Subject: ${paper.subject}  ·  Max Marks: ${paper.maxMarks}  ·  Duration: ${paper.durationMinutes} min  ·  Student: ${studentName}`,
    { fontSize: 9.5, color: [100, 116, 139] }
  );

  if (paper.patternNote) {
    addLines(paper.patternNote, { fontSize: 9.5, color: [71, 85, 105] });
  }

  y += 4;
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.5);
  y += 18;

  paper.questions.forEach((item) => {
    ensureSpace(64);
    addLines(
      `${item.number}  ·  ${item.section}  [${item.marks} ${item.marks === 1 ? 'Mark' : 'Marks'}]${
        item.conceptTested ? `  ·  ${item.conceptTested}` : ''
      }`,
      { bold: true, fontSize: 9.5, color: [2, 132, 199] }
    );
    addLines(item.question, { fontSize: 10.5, color: [15, 23, 42] });
    if (item.similarTo) {
      addLines(`Pattern note: ${item.similarTo}`, { indent: 6, fontSize: 9, color: [100, 116, 139] });
    }
    if (includeMarkingScheme && item.markingScheme) {
      addLines(`Official Marking Scheme: ${item.markingScheme}`, {
        indent: 8,
        fontSize: 9.5,
        color: [5, 150, 105],
      });
    }
    y += 8;
  });

  const slug = `${paper.basedOnYear ? `similar-${paper.basedOnYear}` : 'pyq'}-${paper.subject}${
    includeMarkingScheme ? '-with-solutions' : ''
  }`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
  const fileName = `pathwise-${slug || 'question-paper'}.pdf`;
  doc.save(fileName);
  return fileName;
}

