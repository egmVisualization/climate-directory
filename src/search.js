import topics from './data/topics.json'
import places from './data/places.json'

// ===== Cleaning up text =====
// Lowercases text and removes punctuation, so that "Hawai'i" and "Hawaii",
// or "D.C." and "DC", are treated as the same thing.
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’'.,]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Makes a word safe to use inside a search pattern
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Checks whether a word or phrase appears as a whole word, allowing plurals:
// "fire" matches "fires", and "community" matches "communities".
function containsPhrase(text, phrase) {
  const variants = [escapeRegex(phrase)]
  if (phrase.endsWith('y')) variants.push(escapeRegex(phrase.slice(0, -1) + 'ies'))
  const pattern = new RegExp(`\\b(${variants.join('|')})(s|es)?\\b`)
  return pattern.test(text)
}

// ===== Topics =====
// Returns every topic with at least one keyword in the text.
// "I care about pollution" returns Conservation & Land Use, Data centers, and Water.
export function findTopics(text) {
  const cleaned = normalize(text)
  if (!cleaned) return []
  return topics
    .filter(t => t.keywords.some(keyword => containsPhrase(cleaned, normalize(keyword))))
    .map(t => t.topic)
}

// ===== Places =====
// Two-letter codes like "TN" only count when typed in capitals,
// because "IN", "OR", "ME", and "AS" are also everyday words.
const isCode = name => /^[A-Z.]{2,5}$/.test(name)

// Full names, longest first, so "West Virginia" is found before "Virginia"
// and "Washington DC" before "Washington"
const placeNames = places
  .flatMap(p =>
    [p.place, ...p.alternateNames.filter(n => !isCode(n))]
      .map(name => ({ place: p.place, name: normalize(name) }))
  )
  .sort((a, b) => b.name.length - a.name.length)

const placeCodes = places.flatMap(p =>
  p.alternateNames.filter(isCode).map(code => ({ place: p.place, code: code.replace(/\./g, '') }))
)

export function findPlaces(text) {
  const found = new Set()

  // Full names: once a name is found, it's removed so a shorter name
  // inside it (Virginia inside West Virginia) isn't counted again
  let remaining = normalize(text)
  for (const { place, name } of placeNames) {
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`)
    if (pattern.test(remaining)) {
      found.add(place)
      remaining = remaining.replace(pattern, ' ')
    }
  }

  // Capitalized codes like TN, KY, or D.C.
  const typedCodes = text.replace(/\./g, '').match(/\b[A-Z]{2,5}\b/g) || []
  for (const { place, code } of placeCodes) {
    if (typedCodes.includes(code)) found.add(place)
  }

  return [...found]
}

// ===== Filtering organizations =====
export const isNational = org => org.serviceArea === 'U.S.' || org.serviceArea === 'Global'

// An organization matches if it covers ANY selected topic
// AND serves ANY selected place. An empty selection means "no limit."
export function filterOrganizations(orgs, selectedTopics, selectedPlaces) {
  return orgs.filter(org => {
    const topicMatch =
      selectedTopics.length === 0 || org.topics.some(t => selectedTopics.includes(t))
    const placeMatch =
      selectedPlaces.length === 0 || org.states.some(s => selectedPlaces.includes(s))
    return topicMatch && placeMatch
  })
}
