import { useState } from 'react'
import organizations from './data/organizations.json'
import topicList from './data/topics.json'
import placeList from './data/places.json'
import iaLogo from './assets/ia-logo.png'
import { findTopics, findPlaces, filterOrganizations, isNational } from './search'
import './App.css'
import { csvFormat } from 'd3'

const allTopics = topicList.map(t => t.topic)
const allPlaces = placeList.map(p => p.place).sort()

// Organizations split into two groups, once, when the page loads
const regionalOrgs = organizations.filter(org => !isNational(org))
const nationalOrgs = organizations.filter(isNational)

// Turns ["Tennessee", "Kentucky", "Ohio"] into "Tennessee, Kentucky, and Ohio"
function listInWords(items) {
  if (items.length <= 1) return items.join('')
  if (items.length === 2) return items.join(' and ')
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1]
}

// ===== One organization's card =====
function OrgCard({ org, selectedTopics = [] }) {
  const [open, setOpen] = useState(false)

  function handleCardClick(event) {
    // Don't close the card when someone clicks inside the details or selects text
    if (event.target.closest('.card-details')) return
    if (window.getSelection().toString()) return
    setOpen(!open)
  }

  const serviceArea = org.specificServiceArea
    ? `${org.serviceArea} (${org.specificServiceArea})`
    : org.serviceArea

  return (
    <article className={open ? 'org-card open' : 'org-card'} onClick={handleCardClick}>
      <a className="org-name" href={org.website} target="_blank" rel="noopener"
        onClick={event => event.stopPropagation()}>
        {org.name}
      </a>
      <p className="org-location">{org.location}</p>
      <button type="button" className="card-toggle" aria-expanded={open}>
        {open ? 'Hide details' : 'Show details'}
      </button>

      {open && (
        <div className="card-details">
          <p className="mission">{org.mission}</p>
          <dl>
            <dt>Service area</dt>
            <dd>{serviceArea}</dd>

            {org.states.length > 0 && (
              <>
                <dt>States</dt>
                <dd>{listInWords(org.states)}</dd>
              </>
            )}

            <dt>Newsroom type</dt>
            <dd>{org.newsroomType}</dd>

            {org.network && (
              <>
                <dt>Network</dt>
                <dd>{org.network}</dd>
              </>
            )}

            <dt>Topics</dt>
            <dd className="topic-tags">
              {org.topics.map(topic => (
                <span key={topic}
                  className={selectedTopics.includes(topic) ? 'topic-tag match' : 'topic-tag'}>
                  {topic}
                </span>
              ))}
            </dd>
          </dl>
        </div>
      )}
    </article>
  )
}
// ===== A group of results (becomes cards in the next step) =====
function ResultsGroup({ title, orgs, emptyMessage, selectedTopics}) {
  return (
    <section className="results-group">
      <h2>
        {title} <span className="count">({orgs.length})</span>
      </h2>
      {orgs.length === 0 ? (
        <p className="empty">{emptyMessage}</p>
      ) : (
        <div className="card-grid">
  {orgs.map(org => (
    <OrgCard key={org.id} org={org} selectedTopics={selectedTopics} />
  ))}
</div>
      )}
    </section>
  )
}

// ===== The dashboard =====
function App() {
  // What the visitor typed
  const [topicText, setTopicText] = useState('')
  const [placeText, setPlaceText] = useState('')

  // What the search understood (shown as removable tags)
  const [selectedTopics, setSelectedTopics] = useState([])
  const [selectedPlaces, setSelectedPlaces] = useState([])

  const [includeNational, setIncludeNational] = useState(false)
  const [notes, setNotes] = useState([])

  function handleSearch(event) {
    event.preventDefault() // stops the browser from reloading the page
    const foundTopics = findTopics(topicText)
    const foundPlaces = findPlaces(placeText)
    setSelectedTopics(foundTopics)
    setSelectedPlaces(foundPlaces)

    const newNotes = []
    if (topicText.trim() && foundTopics.length === 0) {
      newNotes.push("We didn't recognize a specific topic, so results include every topic. Try words like “water,” “energy,” or “wildfire,” or add a topic below.")
    }
    if (placeText.trim() && foundPlaces.length === 0) {
      newNotes.push("We didn't recognize a state or territory. Try a name like “Tennessee” or an abbreviation like “TN,” or add a place below.")
    }
    setNotes(newNotes)
  }

  function clearSearch() {
    setTopicText('')
    setPlaceText('')
    setSelectedTopics([])
    setSelectedPlaces([])
    setNotes([])
  }

  const removeTopic = topic => setSelectedTopics(selectedTopics.filter(t => t !== topic))
  const removePlace = place => setSelectedPlaces(selectedPlaces.filter(p => p !== place))
  const addTopic = topic => topic && setSelectedTopics([...selectedTopics, topic])
  const addPlace = place => place && setSelectedPlaces([...selectedPlaces, place])

  // The results, recalculated every time a selection changes
  const regionalResults = filterOrganizations(regionalOrgs, selectedTopics, selectedPlaces)
  const nationalResults = includeNational
    ? filterOrganizations(nationalOrgs, selectedTopics, [])
    : []

    const totalResults = regionalResults.length + nationalResults.length

function exportResults() {
  // One row per organization, with the column names visitors will see
  const rows = [...regionalResults, ...nationalResults].map(org => ({
    'Organization': org.name,
    'Website': org.website,
    'Location': org.location,
    'General service area': org.serviceArea,
    'Specific service area': org.specificServiceArea ?? '',
    'States': org.states.join('; '),
    'Newsroom type': org.newsroomType,
    'Network': org.network ?? '',
    'Topics': org.topics.join('; '),
    'Mission': org.mission,
  }))

  // Build the file and download it
  const csv = '\ufeff' + csvFormat(rows)
  const file = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(file)
  link.download = 'climate-newsrooms.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

  const regionalTitle = selectedPlaces.length
    ? `Newsrooms serving ${listInWords(selectedPlaces)}`
    : 'Newsrooms serving states, regions, and communities'

  return (
    <div className="page">
      <header className="site-header">
        <h1>Environment and Climate Newsrooms</h1>
        <img src={iaLogo} alt="Impact Architects" className="logo" />
      </header>

      <main>
        <p className="intro">
          Find newsrooms that cover the environment, climate, and related issues. Tell us
          what you care about and where, and we’ll show the organizations doing
          that work.
          </p> 
          <p className="intro-note">
          Are we missing a news provider?{' '}
          <a href="https://docs.google.com/forms/d/e/1FAIpQLScPBEEJIeJhUhyOcgyR5OeJJI-6Q6lIXyLHdgk4QJ4avgIoJA/viewform?usp=dialog" target="_blank" rel="noopener">Let us know</a>, and we’ll add them to the directory.
        </p>

       <details className="about">
        <summary>About this directory</summary>
        <div className="about-content">
          <p>Project of the MacArthur Foundation and Press Forward.</p>
        </div>
      </details>
    
        {/* ===== Search panel ===== */}
        <form className="search-panel" onSubmit={handleSearch}>
          <div className="search-fields">
            <label className="field">
              <span className="field-label">What do you care about?</span>
              <input
                type="text"
                value={topicText}
                onChange={e => setTopicText(e.target.value)}
                placeholder="e.g., pollution, wildfires, clean energy"
              />
            </label>
            <label className="field">
              <span className="field-label">Where?</span>
              <input
                type="text"
                value={placeText}
                onChange={e => setPlaceText(e.target.value)}
                placeholder="e.g., Tennessee, or TN and KY"
              />
            </label>
            <button type="submit" className="search-button">Find newsrooms</button>
          </div>

          {/* What the search understood */}
          <div className="selections">
            <div className="tag-row">
              <span className="tag-row-label">Topics</span>
              {selectedTopics.length === 0 && <span className="tag-none">All topics</span>}
              {selectedTopics.map(topic => (
                <button type="button" key={topic} className="tag"
                  onClick={() => removeTopic(topic)} aria-label={`Remove ${topic}`}>
                  {topic} <span aria-hidden="true">×</span>
                </button>
              ))}
              <select value="" onChange={e => addTopic(e.target.value)} aria-label="Add a topic">
                <option value="">Add a topic</option>
                {allTopics.filter(t => !selectedTopics.includes(t)).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="tag-row">
              <span className="tag-row-label">Places</span>
              {selectedPlaces.length === 0 && <span className="tag-none">All places</span>}
              {selectedPlaces.map(place => (
                <button type="button" key={place} className="tag"
                  onClick={() => removePlace(place)} aria-label={`Remove ${place}`}>
                  {place} <span aria-hidden="true">×</span>
                </button>
              ))}
              <select value="" onChange={e => addPlace(e.target.value)} aria-label="Add a place">
                <option value="">Add a place</option>
                {allPlaces.filter(p => !selectedPlaces.includes(p)).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {notes.map(note => <p key={note} className="note">{note}</p>)}
          </div>

          <div className="panel-actions">
            <button type="button" className="toggle" aria-pressed={includeNational}
              onClick={() => setIncludeNational(!includeNational)}>
              {includeNational ? 'Remove' : 'Add'} U.S. and global organizations
            </button>
            <button type="button" className="clear-button" onClick={clearSearch}>
              Clear search
            </button>
            <button type="button" className="export-button"
              onClick={exportResults} disabled={totalResults === 0}>
              Download results (CSV)
            </button>
          </div>
        </form>

        {/* ===== Results ===== */}
        <ResultsGroup
          title={regionalTitle}
          orgs={regionalResults}
          selectedTopics={selectedTopics}
          emptyMessage="No newsrooms in the directory match this search. Try removing a topic, adding a nearby state, or adding U.S. and global organizations."
        />

        {includeNational && (
          <ResultsGroup
            title="Newsrooms serving the U.S. and global audiences"
            orgs={nationalResults}
            selectedTopics={selectedTopics}
            emptyMessage="No national or global newsrooms match these topics."
          />
        )}
      </main>
    </div>
  )
}

export default App
