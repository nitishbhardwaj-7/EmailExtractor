import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000'

export default function Home() {
  const [urls, setUrls] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      setUrls(lines)
    }
    reader.readAsText(file)
  }

  async function handleScrape() {
    if (!urls.length) {
      setError('Please upload a .txt or .csv file with URLs first.')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    setProgress(10)

    try {
      const resp = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      setProgress(90)
      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Scraping failed')
      }
      const data = await resp.json()
      setResults(data)
      setProgress(100)
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  function downloadExcel() {
    if (!results) return
    const rows = results.all_emails.map(e => ({ Email: e }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Emails')
    XLSX.writeFile(wb, 'Extracted_Emails.xlsx')
  }

  function downloadCSV() {
    if (!results) return
    const csv = 'Email\n' + results.all_emails.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Extracted_Emails.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.icon}>📧</div>
          <h1 style={styles.title}>Email Extractor Pro</h1>
          <p style={styles.subtitle}>
            Upload a list of websites and we&apos;ll deep-scrape every email from them.
          </p>
        </div>

        {/* Upload Card */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>1. Upload your website list</h2>
          <div
            style={styles.dropzone}
            onClick={() => fileRef.current.click()}
          >
            <div style={styles.dropzoneIcon}>📂</div>
            <p style={styles.dropzoneText}>
              {fileName || 'Click to upload a .txt or .csv file'}
            </p>
            <p style={styles.dropzoneHint}>One website URL per line</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.csv"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
          </div>

          {urls.length > 0 && (
            <div style={styles.badge}>
              ✅ {urls.length} website{urls.length !== 1 ? 's' : ''} loaded
            </div>
          )}
        </div>

        {/* Scrape Button */}
        <button
          style={{
            ...styles.button,
            ...(loading ? styles.buttonDisabled : {}),
          }}
          onClick={handleScrape}
          disabled={loading}
        >
          {loading ? (
            <>
              <span style={styles.spinner} /> Extracting emails… ({progress}%)
            </>
          ) : (
            '🚀 Start Extracting Emails'
          )}
        </button>

        {loading && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.errorBox}>⚠️ {error}</div>}

        {/* Results */}
        {results && (
          <div style={styles.card}>
            <div style={styles.statsRow}>
              <div style={styles.stat}>
                <span style={styles.statNum}>{results.total_emails}</span>
                <span style={styles.statLabel}>Unique Emails</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNum}>{results.results.length}</span>
                <span style={styles.statLabel}>Sites Scanned</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNum}>
                  {results.results.filter(r => r.count > 0).length}
                </span>
                <span style={styles.statLabel}>Sites With Emails</span>
              </div>
            </div>

            <div style={styles.downloadRow}>
              <button style={styles.dlBtn} onClick={downloadExcel}>
                📥 Download Excel
              </button>
              <button style={{ ...styles.dlBtn, ...styles.dlBtnSecondary }} onClick={downloadCSV}>
                📄 Download CSV
              </button>
            </div>

            <h3 style={styles.sectionTitle}>Results by Website</h3>
            <div style={styles.resultsList}>
              {results.results.map((r, i) => (
                <div key={i} style={styles.resultItem}>
                  <div style={styles.resultHeader}>
                    <span style={styles.resultDomain}>{r.domain}</span>
                    <span style={styles.resultCount}>{r.count} emails</span>
                  </div>
                  {r.emails.length > 0 && (
                    <div style={styles.emailList}>
                      {r.emails.map((email, j) => (
                        <span key={j} style={styles.emailTag}>{email}</span>
                      ))}
                    </div>
                  )}
                  {r.error && (
                    <p style={styles.resultError}>Error: {r.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
    padding: '40px 20px',
  },
  container: {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  header: {
    textAlign: 'center',
    padding: '20px 0',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '1rem',
    lineHeight: '1.5',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '28px',
    backdropFilter: 'blur(10px)',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#c4b5fd',
    marginBottom: '16px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  dropzone: {
    border: '2px dashed rgba(99,102,241,0.5)',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
    background: 'rgba(99,102,241,0.05)',
  },
  dropzoneIcon: {
    fontSize: '32px',
    marginBottom: '12px',
  },
  dropzoneText: {
    fontSize: '1rem',
    color: '#e2e8f0',
    marginBottom: '4px',
  },
  dropzoneHint: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  badge: {
    marginTop: '12px',
    display: 'inline-block',
    background: 'rgba(16,185,129,0.15)',
    color: '#34d399',
    border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '0.875rem',
  },
  button: {
    width: '100%',
    padding: '16px',
    fontSize: '1.05rem',
    fontWeight: '600',
    color: '#fff',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'opacity 0.2s',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.8s linear infinite',
  },
  progressBar: {
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    transition: 'width 0.4s ease',
    borderRadius: '3px',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    borderRadius: '10px',
    padding: '14px 18px',
    fontSize: '0.9rem',
  },
  statsRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
  stat: {
    flex: 1,
    background: 'rgba(99,102,241,0.1)',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: '10px',
    padding: '16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statNum: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#a78bfa',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  downloadRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  dlBtn: {
    flex: 1,
    padding: '12px',
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#fff',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  dlBtnSecondary: {
    background: 'rgba(99,102,241,0.2)',
    border: '1px solid rgba(99,102,241,0.3)',
    color: '#a78bfa',
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultItem: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    padding: '14px 16px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  resultDomain: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#c4b5fd',
  },
  resultCount: {
    fontSize: '0.8rem',
    color: '#6366f1',
    background: 'rgba(99,102,241,0.15)',
    padding: '2px 8px',
    borderRadius: '6px',
  },
  emailList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  emailTag: {
    fontSize: '0.78rem',
    color: '#94a3b8',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '3px 8px',
    borderRadius: '4px',
  },
  resultError: {
    fontSize: '0.8rem',
    color: '#f87171',
    marginTop: '6px',
  },
}
