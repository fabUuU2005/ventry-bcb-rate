import { writeFile } from 'node:fs/promises'

const source = 'https://www.bcb.gob.bo/librerias/indicadores/otras/ultimo.php'
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const clean = (value) => value.replace(/<[^>]*>/g, ' ').replace(/&(?:oacute;|#243;)/gi, 'ó').replace(/\s+/g, ' ').trim()
const boliviaDay = (now) => new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)

const response = await fetch(source, { headers: { Accept: 'text/html', 'User-Agent': 'VentryBCBRateUpdater/1.0' }, signal: AbortSignal.timeout(20000) })
if (!response.ok) throw new Error(`El BCB respondió ${response.status}`)
const html = await response.text()
if (html.length > 1024 * 1024) throw new Error('Respuesta del BCB demasiado grande')

const dateMatch = clean(html).match(/TABLA DE COTIZACIONES DEL (\d{1,2}) DE ([A-ZÁÉÍÓÚ]+) DE (\d{4})/i)
const officialTable = html.match(/<div\b[^>]*>\s*Cotizaci(?:&oacute;|ó)n Oficial[\s\S]*?<\/table>/i)?.[0]
const usdMatch = officialTable?.match(/<tr\b[^>]*>\s*<td[^>]*>\s*ESTADOS UNIDOS\s*<\/td>[\s\S]*?<td[^>]*>\s*USD\s*<\/td>\s*<td[^>]*>\s*(\d{1,4}[,.]\d{2,6})\s*<\/td>\s*<\/tr>/i)
if (!dateMatch || !usdMatch) throw new Error('No se encontró el TCO USD oficial del BCB')
const [, day, rawMonth, year] = dateMatch
const month = months.indexOf(rawMonth.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()) + 1
const date = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
const rate = Number(usdMatch[1].replace(',', '.'))
const now = new Date()
if (!month || !Number.isFinite(rate) || rate <= 0 || date !== boliviaDay(now)) throw new Error('La cotización no corresponde al día de Bolivia')

await writeFile('rate.json', `${JSON.stringify({ rate, date, source, checkedAt: now.toISOString() }, null, 2)}\n`)
