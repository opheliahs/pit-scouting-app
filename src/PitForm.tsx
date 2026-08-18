import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

import { db } from './firebase'

import {
  createEmptyPitScoutData,
  type PitScoutData,
} from './pitScoutData'

type PitFormProps = {
  eventKey: string
  teamNumber: number
  collectorName: string
  collectorId: string
  onBack: () => void
  onSaved: () => void
}

type AutosaveState =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'error'

function PitForm({
  eventKey,
  teamNumber,
  collectorName,
  collectorId,
  onBack,
  onSaved,
}: PitFormProps) {
  const storageKey =
    `pitData:${eventKey}:${teamNumber}`

  const documentReference = doc(
    db,
    'pitSubmissions',
    `${eventKey}_${teamNumber}`,
  )

  const hasUserEdited = useRef(false)

  const [formData, setFormData] =
    useState<PitScoutData>(() => {
      const stored =
        localStorage.getItem(storageKey)

      if (stored) {
        try {
          return JSON.parse(stored) as PitScoutData
        } catch {
          // Ignore malformed local data.
        }
      }

      return createEmptyPitScoutData(
        eventKey,
        teamNumber,
        collectorName,
        collectorId,
      )
    })

  const [submitted, setSubmitted] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [saveError, setSaveError] =
    useState<string | null>(null)

  const [
    initialLoadComplete,
    setInitialLoadComplete,
  ] = useState(false)

  const [
    documentStatus,
    setDocumentStatus,
  ] = useState<'in-progress' | 'complete'>(
    'in-progress',
  )

  const [
    autosaveState,
    setAutosaveState,
  ] = useState<AutosaveState>('idle')

  useEffect(() => {
    let cancelled = false

    async function loadCloudDraft() {
      try {
        const snapshot =
          await getDoc(documentReference)

        if (
          snapshot.exists() &&
          !cancelled
        ) {
          const cloudData =
            snapshot.data() as
              Partial<PitScoutData> & {
                status?: string
              }

          if (
            cloudData.status ===
            'complete'
          ) {
            setDocumentStatus(
              'complete',
            )
          }

          if (!hasUserEdited.current) {
            setFormData((current) => ({
              ...current,
              ...cloudData,
              eventKey,
              teamNumber,
              collectorName,
              collectorId,
            }))
          }
        }
      } catch (error) {
        console.error(
          'Could not load cloud pit draft:',
          error,
        )
      } finally {
        if (!cancelled) {
          setInitialLoadComplete(true)
        }
      }
    }

    void loadCloudDraft()

    return () => {
      cancelled = true
    }
  }, [
    collectorId,
    collectorName,
    eventKey,
    teamNumber,
  ])

  useEffect(() => {
    if (
      !initialLoadComplete ||
      !hasUserEdited.current ||
      submitted
    ) {
      return
    }

    setAutosaveState('saving')

    const timeoutId =
      window.setTimeout(async () => {
        const localDraft = {
          ...formData,
          collectorName,
          collectorId,
          status: documentStatus,
          locallySavedAt:
            new Date().toISOString(),
        }

        localStorage.setItem(
          storageKey,
          JSON.stringify(localDraft),
        )

        try {
          await setDoc(
            documentReference,
            {
              ...formData,
              collectorName,
              collectorId,
              status: documentStatus,

              lastEditedBy: {
                name: collectorName,
                scoutId: collectorId,
              },

              draftSavedAt:
                serverTimestamp(),

              updatedAt:
                serverTimestamp(),
            },
            {
              merge: true,
            },
          )

          setAutosaveState('saved')
        } catch (error) {
          console.error(
            'Could not autosave pit draft:',
            error,
          )

          setAutosaveState('error')
        }
      }, 800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    collectorId,
    collectorName,
    documentStatus,
    formData,
    initialLoadComplete,
    storageKey,
    submitted,
  ])

  function updateField<
    K extends keyof PitScoutData,
  >(
    field: K,
    value: PitScoutData[K],
  ) {
    hasUserEdited.current = true

    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function numberOrNull(
    value: string,
  ): number | null {
    if (value.trim() === '') {
      return null
    }

    const parsed = Number(value)

    return Number.isFinite(parsed)
      ? parsed
      : null
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setSaving(true)
    setSaveError(null)

    const localSubmission = {
      ...formData,
      collectorName,
      collectorId,
      status: 'complete',
      locallySavedAt:
        new Date().toISOString(),
    }

    const firestoreSubmission = {
      ...formData,
      collectorName,
      collectorId,

      status: 'complete',

      lastEditedBy: {
        name: collectorName,
        scoutId: collectorId,
      },

      completedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    }

    try {
      await setDoc(
        documentReference,
        firestoreSubmission,
        {
          merge: true,
        },
      )

      localStorage.setItem(
        storageKey,
        JSON.stringify(localSubmission),
      )

      hasUserEdited.current = false
      setDocumentStatus('complete')
      setAutosaveState('saved')
      onSaved()
      setSubmitted(true)
    } catch (error) {
      console.error(
        'Could not save pit submission:',
        error,
      )

      setSaveError(
        'The submission could not be uploaded. Check your connection and try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <section className="page-card">
        <p className="eyebrow">
          Submission saved
        </p>

        <h1>Team {teamNumber}</h1>

        <p className="subtitle">
          Pit scouting data was saved
          successfully.
        </p>

        <div className="summary-grid">
          <div>
            <span>Collector</span>
            <strong>{collectorName}</strong>
          </div>

          <div>
            <span>Scout ID</span>
            <strong>{collectorId}</strong>
          </div>

          <div>
            <span>Fuel capacity</span>
            <strong>
              {formData.maximumFuelCapacity ??
                'Unknown'}
            </strong>
          </div>

          <div>
            <span>Drivetrain</span>
            <strong>
              {formData.drivetrain ||
                'Unknown'}
            </strong>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setSubmitted(false)
            }
          >
            Edit submission
          </button>

          <button
            type="button"
            onClick={onBack}
          >
            Return to team list
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="page-card">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            {eventKey}
          </p>

          <h1>Team {teamNumber}</h1>
        </div>

        <button
          type="button"
          className="small-button secondary-button"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <div className="collector-banner">
        <span>Collecting data</span>

        <strong>
          {collectorName} · {collectorId}
        </strong>

        <div className={`autosave-status ${autosaveState}`}>
          {!initialLoadComplete && 'Loading saved data...'}

          {initialLoadComplete &&
            autosaveState === 'idle' &&
            'Draft ready'}

          {autosaveState === 'saving' &&
            'Saving draft...'}

          {autosaveState === 'saved' &&
            'Draft saved'}

          {autosaveState === 'error' &&
            'Saved on this device; cloud sync failed'}
        </div>
      </div>

      <form
        className="pit-form"
        onSubmit={handleSubmit}
      >
        <section className="form-section">
          <div className="section-heading">
            <p className="eyebrow">
              Most important
            </p>

            <h2>Fuel system</h2>
          </div>

          <div className="field-grid">
            <label>
              Maximum fuel capacity

              <input
                type="number"
                min="0"
                step="1"
                value={
                  formData.maximumFuelCapacity ??
                  ''
                }
                onChange={(event) =>
                  updateField(
                    'maximumFuelCapacity',
                    numberOrNull(
                      event.target.value,
                    ),
                  )
                }
                placeholder="Example: 40"
              />
            </label>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={
                formData.canIntakeWhileShooting
              }
              onChange={(event) =>
                updateField(
                  'canIntakeWhileShooting',
                  event.target.checked,
                )
              }
            />

            Can intake while shooting
          </label>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Robot measurements</h2>
          </div>

          <div className="field-grid">
            <label>
              Width (cm)

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  formData.widthCm ?? ''
                }
                onChange={(event) =>
                  updateField(
                    'widthCm',
                    numberOrNull(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label>
              Length (cm)

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  formData.lengthCm ?? ''
                }
                onChange={(event) =>
                  updateField(
                    'lengthCm',
                    numberOrNull(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label>
              Height (cm)

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  formData.heightCm ?? ''
                }
                onChange={(event) =>
                  updateField(
                    'heightCm',
                    numberOrNull(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>

            <label>
              Weight (kg)

              <input
                type="number"
                min="0"
                step="0.1"
                value={
                  formData.weightKg ?? ''
                }
                onChange={(event) =>
                  updateField(
                    'weightKg',
                    numberOrNull(
                      event.target.value,
                    ),
                  )
                }
              />
            </label>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={
                formData.measurementsIncludeBumpers
              }
              onChange={(event) =>
                updateField(
                  'measurementsIncludeBumpers',
                  event.target.checked,
                )
              }
            />

            Measurements include bumpers
          </label>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Mechanisms</h2>
          </div>

          <div className="field-grid">
            <label>
              Drivetrain

              <select
                value={formData.drivetrain}
                onChange={(event) =>
                  updateField(
                    'drivetrain',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select one
                </option>

                <option value="swerve">
                  Swerve
                </option>

                <option value="tank">
                  Tank
                </option>

                <option value="mecanum">
                  Mecanum
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </label>

            <label>
              Intake type

              <select
                value={formData.intakeType}
                onChange={(event) =>
                  updateField(
                    'intakeType',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select one
                </option>

                <option value="ground">
                  Ground intake
                </option>

                <option value="source">
                  Source only
                </option>

                <option value="both">
                  Ground and source
                </option>

                <option value="none">
                  None
                </option>
              </select>
            </label>

            <label>
              Shooter type

              <select
                value={formData.shooterType}
                onChange={(event) =>
                  updateField(
                    'shooterType',
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select one
                </option>

                <option value="flywheel">
                  Flywheel
                </option>

                <option value="hooded-flywheel">
                  Hooded flywheel
                </option>

                <option value="turreted">
                  Turreted shooter
                </option>

                <option value="other">
                  Other
                </option>
              </select>
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Capabilities</h2>
          </div>

          <div className="check-grid">
            <label className="check-row">
              <input
                type="checkbox"
                checked={
                  formData.canCrossBump
                }
                onChange={(event) =>
                  updateField(
                    'canCrossBump',
                    event.target.checked,
                  )
                }
              />

              Can cross bump
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={
                  formData.canCrossTrench
                }
                onChange={(event) =>
                  updateField(
                    'canCrossTrench',
                    event.target.checked,
                  )
                }
              />

              Can cross trench
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={
                  formData.canClimb
                }
                onChange={(event) =>
                  updateField(
                    'canClimb',
                    event.target.checked,
                  )
                }
              />

              Can climb
            </label>
          </div>
        </section>

        <section className="form-section">
          <div className="section-heading">
            <h2>Notes</h2>
          </div>

          <label>
            General notes

            <textarea
              rows={6}
              value={formData.notes}
              onChange={(event) =>
                updateField(
                  'notes',
                  event.target.value,
                )
              }
              placeholder="Limitations, unusual mechanisms, reliability concerns, or anything the strategy team should know."
            />
          </label>
        </section>

        {saveError && (
          <div
            role="alert"
            className="save-error"
          >
            {saveError}
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onBack}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : 'Review and save'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default PitForm