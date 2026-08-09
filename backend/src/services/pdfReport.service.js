import PDFDocument from 'pdfkit'

import { DISABILITY_TYPES, GOAL_DOMAINS, GOAL_STATUSES, MOODS } from '../constants/domain.js'
import { attendanceModel } from '../models/attendance.model.js'
import { childModel } from '../models/child.model.js'
import { summarizeAttendance } from '../utils/attendanceAlerts.js'
import { ageInYears, formatFrench } from '../utils/dates.js'
import { progressService } from './progress.service.js'

/**
 * Rapport de progression au format PDF, destine aux familles et aux
 * partenaires (MDPH, ecole, medecin).
 *
 * Le document est ecrit directement dans la reponse HTTP : rien n'est stocke
 * sur le disque, donc rien a nettoyer ni a proteger apres coup.
 *
 * Ce rapport sort du centre : il ne contient aucune note interne, aucun nom
 * d autre enfant, et pas de donnee medicale detaillee.
 */

const COLORS = {
  ink: '#1e293b',
  muted: '#64748b',
  rule: '#cbd5e1',
  accent: '#1d4ed8',
  track: '#e2e8f0',
}

const MARGIN = 50
const CONTENT_WIDTH = 595.28 - MARGIN * 2 // A4 en points, moins les marges

const label = (dictionary, key, fallback = 'Non renseigne') => dictionary[key] ?? fallback

function heading(doc, text) {
  if (doc.y > 700) doc.addPage()

  doc.moveDown(0.8)
  doc.fillColor(COLORS.accent).fontSize(13).font('Helvetica-Bold').text(text)
  doc
    .moveTo(MARGIN, doc.y + 2)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y + 2)
    .strokeColor(COLORS.rule)
    .lineWidth(0.5)
    .stroke()
  doc.moveDown(0.6)
  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
}

function keyValue(doc, key, value) {
  doc.font('Helvetica-Bold').fillColor(COLORS.muted).fontSize(9).text(`${key} `, { continued: true })
  doc.font('Helvetica').fillColor(COLORS.ink).fontSize(10).text(String(value ?? '-'))
}

/** Barre de progression : un taux se lit plus vite qu il ne se compte. */
function progressBar(doc, percent) {
  const width = 180
  const height = 8
  const x = doc.x
  const y = doc.y

  doc.roundedRect(x, y, width, height, 4).fillColor(COLORS.track).fill()
  if (percent > 0) {
    doc
      .roundedRect(x, y, Math.max(4, (width * percent) / 100), height, 4)
      .fillColor(COLORS.accent)
      .fill()
  }

  doc
    .fillColor(COLORS.ink)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`${percent} %`, x + width + 8, y - 1)

  doc.fillColor(COLORS.ink).font('Helvetica').fontSize(10)
  doc.y = y + height + 8
  doc.x = MARGIN
}

/** Courbe d evolution mensuelle, dessinee a la main : aucune dependance graphique. */
function sparkline(doc, monthly) {
  const points = monthly.filter((entry) => entry.average !== null)
  if (points.length < 2) return

  const width = CONTENT_WIDTH
  const height = 60
  const x = MARGIN
  const y = doc.y

  doc.rect(x, y, width, height).fillColor('#f8fafc').fill()

  const step = width / (monthly.length - 1)
  const scaleY = (value) => y + height - (value / 100) * height

  doc.strokeColor(COLORS.accent).lineWidth(1.5)
  let started = false

  monthly.forEach((entry, index) => {
    if (entry.average === null) return

    const pointX = x + index * step
    const pointY = scaleY(entry.average)

    if (!started) {
      doc.moveTo(pointX, pointY)
      started = true
    } else {
      doc.lineTo(pointX, pointY)
    }
  })
  doc.stroke()

  doc.fontSize(7).fillColor(COLORS.muted)
  monthly.forEach((entry, index) => {
    doc.text(entry.month.slice(5), x + index * step - 8, y + height + 3, { width: 20 })
  })

  doc.fillColor(COLORS.ink).fontSize(10)
  doc.y = y + height + 16
  doc.x = MARGIN
}

export const pdfReportService = {
  /**
   * Rassemble les donnees du rapport et le nom du fichier.
   *
   * Separe du rendu parce que le controller doit poser ses en-tetes HTTP
   * (dont le nom de fichier) AVANT que le moindre octet de PDF ne parte.
   */
  async prepareProgressReport(childId, query, user) {
    const progress = await progressService.getChildProgress(childId, query, user)

    const attendance = await attendanceModel.findMany({
      childId,
      from: progress.period.from,
      to: progress.period.to,
    })
    const fullChild = await childModel.findById(childId)

    const { child, period } = progress
    const slug = `${child.lastName}-${child.firstName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[-]/g, '') // retire les accents du nom de fichier
      .replace(/[^a-z0-9]+/g, '-')

    return {
      data: { ...progress, fullChild, attendanceSummary: summarizeAttendance(attendance) },
      filename: `progression-${slug}-${period.to}.pdf`,
    }
  },

  /** Ecrit le PDF dans le flux fourni (la reponse HTTP). */
  render(reportData, stream) {
    const { child, period, goals, mood, summary, fullChild, attendanceSummary } = reportData

    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true })
    doc.pipe(stream)

    // --- En-tete -----------------------------------------------------------
    doc.fillColor(COLORS.accent).fontSize(20).font('Helvetica-Bold').text('Centre Papillon Bleu')
    doc
      .fillColor(COLORS.muted)
      .fontSize(11)
      .font('Helvetica')
      .text('Rapport de progression pedagogique')
    doc.moveDown(1)

    doc.fillColor(COLORS.ink).fontSize(16).font('Helvetica-Bold')
    doc.text(`${child.firstName} ${child.lastName}`)
    doc.moveDown(0.4)

    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
    doc.text(
      `Periode du ${formatFrench(period.from)} au ${formatFrench(period.to)} ` +
        `(${period.months} mois) - edite le ${formatFrench(new Date().toISOString().slice(0, 10))}`,
    )

    // --- Identite ----------------------------------------------------------
    heading(doc, "L enfant")
    keyValue(doc, 'Groupe', child.group)
    if (fullChild) {
      keyValue(doc, 'Age', `${ageInYears(fullChild.birthDate)} ans`)
      keyValue(
        doc,
        'Accompagnement',
        label(DISABILITY_TYPES, fullChild.disability?.type),
      )
      if (fullChild.disability?.supportPlan) {
        keyValue(doc, 'Plan', fullChild.disability.supportPlan)
      }
    }

    // --- Synthese ----------------------------------------------------------
    heading(doc, 'Synthese de la periode')
    keyValue(doc, 'Objectifs suivis', summary.goals)
    keyValue(
      doc,
      'Avancement moyen',
      summary.averageProgress === null ? 'Non evalue' : `${summary.averageProgress} %`,
    )
    keyValue(doc, 'Seances realisees', summary.sessionsCompleted)
    keyValue(doc, 'Comptes-rendus', summary.reports)
    keyValue(
      doc,
      'Presence',
      attendanceSummary.recorded === 0
        ? 'Aucune journee enregistree'
        : `${Math.round((1 - attendanceSummary.absenceRate) * 100)} % ` +
            `(${attendanceSummary.present + attendanceSummary.late} jours sur ${attendanceSummary.recorded})`,
    )

    if (mood.trend.current !== null) {
      const lastMood = mood.points.at(-1)
      keyValue(doc, 'Humeur en fin de periode', label(MOODS, lastMood.mood))
    }

    // --- Objectifs ---------------------------------------------------------
    heading(doc, 'Objectifs pedagogiques')

    if (goals.length === 0) {
      doc.fillColor(COLORS.muted).text('Aucun objectif defini sur la periode.')
    }

    for (const entry of goals) {
      if (doc.y > 640) doc.addPage()

      doc.moveDown(0.5)
      doc.fillColor(COLORS.ink).fontSize(11).font('Helvetica-Bold').text(entry.goal.title)
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(COLORS.muted)
        .text(
          `${label(GOAL_DOMAINS, entry.goal.domain)} - ${label(GOAL_STATUSES, entry.goal.status)}` +
            (entry.goal.targetDate ? ` - echeance ${formatFrench(entry.goal.targetDate)}` : ''),
        )
      doc.moveDown(0.4)
      doc.fillColor(COLORS.ink).fontSize(10)

      progressBar(doc, entry.goal.progress ?? 0)

      if (entry.trend.delta !== null && entry.points.length > 1) {
        const sign = entry.trend.delta >= 0 ? '+' : ''
        doc
          .fontSize(9)
          .fillColor(COLORS.muted)
          .text(
            `Evolution sur la periode : ${sign}${entry.trend.delta} points ` +
              `(${entry.trend.start} % -> ${entry.trend.current} %), ` +
              `${entry.sessionsWorked} seances de travail.`,
          )
        doc.moveDown(0.3)
        sparkline(doc, entry.monthly)
      } else if (entry.points.length === 0) {
        doc.fontSize(9).fillColor(COLORS.muted).text('Pas encore evalue en seance sur la periode.')
      }

      const lastComment = [...entry.points].reverse().find((point) => point.comment)
      if (lastComment) {
        doc
          .fontSize(9)
          .fillColor(COLORS.ink)
          .text(`Derniere observation (${formatFrench(lastComment.date)}) : ${lastComment.comment}`, {
            width: CONTENT_WIDTH,
          })
      }

      doc.fillColor(COLORS.ink).fontSize(10)
    }

    // --- Pied de page ------------------------------------------------------
    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index)
      doc
        .fontSize(7)
        .fillColor(COLORS.muted)
        .text(
          'Document confidentiel - Centre Papillon Bleu. ' +
            'A ne pas diffuser en dehors des destinataires prevus.',
          MARGIN,
          792 - MARGIN + 10,
          { width: CONTENT_WIDTH, align: 'center' },
        )
      doc.text(`Page ${index + 1} / ${range.count}`, MARGIN, 792 - MARGIN + 20, {
        width: CONTENT_WIDTH,
        align: 'center',
      })
    }

    doc.end()
  },
}
