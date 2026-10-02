import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  IMAGE_BASE, imageUrls, searchImages, matchesText, cleanUrls, exercisePayload, stationPayload, nameTaken,
  referencesTo, countUsage, usageLabel, deletionBlock, noteChips,
} from '../src/utils/catalog.ts'

const INDEX = [
  { id: 'Front_Squat_Clean_Grip', name: 'Front Squat (Clean Grip)', images: ['Front_Squat_Clean_Grip/0.jpg', 'Front_Squat_Clean_Grip/1.jpg'] },
  { id: 'Front_Squats_With_Two_Kettlebells', name: 'Front Squats With Two Kettlebells', images: ['Front_Squats_With_Two_Kettlebells/0.jpg'] },
  { id: 'Barbell_Squat', name: 'Barbell Squat', images: ['Barbell_Squat/0.jpg', 'Barbell_Squat/1.jpg'] },
  { id: 'Squat_Jerk', name: 'Squat Jerk', images: [] },
  { id: 'Developpe', name: 'Développé Couché', images: ['Developpe/0.jpg'] },
  { id: 'Farmers_Walk', name: 'Farmer\'s Walk', images: ['Farmers_Walk/0.jpg'] },
  { id: 'Pullups', name: 'Pullups', images: ['Pullups/0.jpg'] },
  { id: 'Squat_with_Bands', name: 'Squat with Bands', images: ['Squat_with_Bands/0.jpg'] },
]

// ── photos ───────────────────────────────────────────────────────────────────
test('imageUrls donne les adresses complètes des photos d\'un mouvement', () => {
  assert.deepEqual(imageUrls(INDEX[0]!), [`${IMAGE_BASE}exercises/Front_Squat_Clean_Grip/0.jpg`, `${IMAGE_BASE}exercises/Front_Squat_Clean_Grip/1.jpg`])
})
test('searchImages retrouve un mouvement par tous les mots saisis, sans casse ni accent ni ponctuation', () => {
  assert.deepEqual(searchImages(INDEX, 'front squat').map(e => e.id), ['Front_Squat_Clean_Grip', 'Front_Squats_With_Two_Kettlebells'])
  assert.deepEqual(searchImages(INDEX, 'SQUAT front').map(e => e.id), ['Front_Squat_Clean_Grip', 'Front_Squats_With_Two_Kettlebells'])
  assert.deepEqual(searchImages(INDEX, 'developpe').map(e => e.id), ['Developpe'])
  assert.deepEqual(searchImages(INDEX, 'farmers walk').map(e => e.id), ['Farmers_Walk'])
  assert.deepEqual(searchImages(INDEX, 'Pull-up').map(e => e.id), ['Pullups'])
})
test('searchImages met en tête les noms les plus courts, donc les mouvements de base, et écarte les mouvements sans photo', () => {
  // « Squat with Bands » commence par la recherche mais passe après « Barbell Squat », plus court
  assert.deepEqual(searchImages(INDEX, 'squat').map(e => e.id), ['Barbell_Squat', 'Squat_with_Bands', 'Front_Squat_Clean_Grip', 'Front_Squats_With_Two_Kettlebells'])
  assert.deepEqual(searchImages(INDEX, 'squat', 1).map(e => e.id), ['Barbell_Squat'])
})
test('searchImages ne renvoie rien pour une recherche vide ou trop courte', () => {
  assert.deepEqual(searchImages(INDEX, ''), [])
  assert.deepEqual(searchImages(INDEX, ' s '), [])
  assert.deepEqual(searchImages(INDEX, 'burpee'), [])
})
test('matchesText filtre une liste par nom, sans casse ni accent', () => {
  assert.equal(matchesText('Développé Couché Haltères', 'developpe'), true)
  assert.equal(matchesText('Pull-up', 'PULL UP'), true)
  assert.equal(matchesText('Squat', ''), true)
  assert.equal(matchesText('Squat', 'fente'), false)
})
test('cleanUrls garde les adresses web, sans doublon ni espace', () => {
  assert.deepEqual(cleanUrls([' https://a.test/0.jpg ', '', 'https://a.test/0.jpg', 'ftp://x', 'http://b.test/1.jpg', 'texte']), ['https://a.test/0.jpg', 'http://b.test/1.jpg'])
})

// ── contenu envoyé à Directus ────────────────────────────────────────────────
test('exercisePayload nettoie la saisie : champ vide → null, photos → liste ou null', () => {
  assert.deepEqual(
    exercisePayload({ name: '  Front Squat ', category: 'lower_body', equipment: '', notes: ' Alternative : squat arrière. ', image_urls: [' https://a.test/0.jpg ', ''] }),
    { name: 'Front Squat', category: 'lower_body', equipment: null, notes: 'Alternative : squat arrière.', image_urls: ['https://a.test/0.jpg'] },
  )
  assert.equal(exercisePayload({ name: 'X', category: '', equipment: '', notes: '', image_urls: [] }).image_urls, null)
})
test('stationPayload garde le type de mesure et le caractère officiel', () => {
  assert.deepEqual(
    stationPayload({ name: ' Sled Push ', measurement_type: 'distance', default_unit: ' m ', is_hyrox_official: true, notes: '', image_urls: [] }),
    { name: 'Sled Push', measurement_type: 'distance', default_unit: 'm', is_hyrox_official: true, notes: null, image_urls: null },
  )
})
test('nameTaken repère un nom déjà pris, sans casse ni accent, sauf pour l\'entrée elle-même', () => {
  const entries = [{ id: 1, name: 'Squat' }, { id: 2, name: 'Développé Couché' }, { id: 3, name: 'Pull-up' }]
  assert.equal(nameTaken(entries, ' squat ', null), true)
  assert.equal(nameTaken(entries, 'developpe couche', null), true)
  assert.equal(nameTaken(entries, 'Pull up', null), true)
  assert.equal(nameTaken(entries, 'Squat', 1), false)
  assert.equal(nameTaken(entries, 'Front Squat', null), false)
  assert.equal(nameTaken(entries, '', null), false)
})

// ── utilisations ─────────────────────────────────────────────────────────────
const RELATIONS = [
  { collection: 'block_strength_exercises', field: 'exercise_id', related_collection: 'exercise_catalog' },
  { collection: 'set_logs', field: 'exercise_id', related_collection: 'exercise_catalog' },
  { collection: 'block_circuit_stations', field: 'station_id', related_collection: 'station_catalog' },
  { collection: 'weeks', field: 'plan_id', related_collection: 'plans' },
  { collection: 'session_blocks', field: 'item', related_collection: null },
]
test('referencesTo liste les champs qui pointent vers un catalogue', () => {
  assert.deepEqual(referencesTo(RELATIONS, 'exercise_catalog'), [
    { collection: 'block_strength_exercises', field: 'exercise_id' },
    { collection: 'set_logs', field: 'exercise_id' },
  ])
  assert.deepEqual(referencesTo(RELATIONS, 'station_catalog'), [{ collection: 'block_circuit_stations', field: 'station_id' }])
  assert.deepEqual(referencesTo(RELATIONS, 'inconnu'), [])
})
test('countUsage additionne les décomptes : séances des plans d\'un côté, saisies d\'athlètes de l\'autre', () => {
  const usage = countUsage([
    { collection: 'block_circuit_stations', field: 'station_id', rows: [{ station_id: 1, count: '29' }, { station_id: 2, count: '11' }] },
    { collection: 'block_mini_race_stations', field: 'station_id', rows: [{ station_id: 1, count: 4 }, { station_id: null, count: '2' }] },
    { collection: 'station_logs', field: 'station_id', rows: [{ station_id: 2, count: '7' }, { station_id: 9, count: '1' }] },
  ])
  assert.deepEqual(usage, { 1: { planned: 33, logged: 0 }, 2: { planned: 11, logged: 7 }, 9: { planned: 0, logged: 1 } })
  assert.deepEqual(countUsage([]), {})
})
test('usageLabel résume l\'utilisation d\'une entrée', () => {
  assert.equal(usageLabel({ planned: 25, logged: 120 }), '25 fois')
  assert.equal(usageLabel({ planned: 1, logged: 0 }), '1 fois')
  assert.equal(usageLabel({ planned: 0, logged: 3 }), 'Historique seul')
  assert.equal(usageLabel({ planned: 0, logged: 0 }), 'Jamais')
  assert.equal(usageLabel(null), '—')
})
test('deletionBlock n\'autorise la suppression que d\'une entrée qui ne sert nulle part', () => {
  assert.equal(deletionBlock({ planned: 0, logged: 0 }), null)
  assert.match(deletionBlock({ planned: 25, logged: 120 })!, /^25 utilisations dans les plans/)
  assert.match(deletionBlock({ planned: 1, logged: 0 })!, /^1 utilisation dans les plans/)
  assert.match(deletionBlock({ planned: 0, logged: 3 })!, /^3 saisies d'athlètes/)
  assert.match(deletionBlock({ planned: 0, logged: 1 })!, /^1 saisie d'athlète\b/)
  assert.match(deletionBlock(null)!, /inconnues/) // décompte indisponible : on ne supprime pas
})

// ── notes en pastilles ───────────────────────────────────────────────────────
test('noteChips découpe une note sur « · »', () => {
  assert.deepEqual(noteChips('6-8 reps · RIR 2'), ['6-8 reps', 'RIR 2'])
  assert.deepEqual(noteChips(' par jambe '), ['par jambe'])
  assert.deepEqual(noteChips(null), [])
  assert.deepEqual(noteChips(' · '), [])
})
