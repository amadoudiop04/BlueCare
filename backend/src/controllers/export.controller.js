import { pdfReportService } from '../services/pdfReport.service.js'

/**
 * Export PDF du rapport de progression.
 *
 * Les en-tetes sont poses avant le rendu : une fois le premier octet du PDF
 * écrit, il est trop tard pour annoncer le nom du fichier.
 */
export async function exportProgressReport(req, res) {
  const { data, filename } = await pdfReportService.prepareProgressReport(
    req.params.childId,
    req.query,
    req.user,
  )

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  // Un rapport nominatif n'a rien a faire dans un cache partage.
  res.setHeader('Cache-Control', 'private, no-store')

  pdfReportService.render(data, res)
}
