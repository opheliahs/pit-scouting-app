import {
  useEffect,
  useState,
} from 'react'

import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'

import './App.css'

import { db } from './firebase'
import PitForm from './PitForm'
import {
  mockEvents,
  mockTeams,
} from './mockData'

import type {
  EventOption,
  ScoutProfile,
  TeamOption,
} from './types'

type Screen =
  | 'profile'
  | 'events'
  | 'teams'
  | 'pit-form'

type FirestorePitSubmission = {
  eventKey?: string
  teamNumber?: number
  collectorName?: string
  status?: string
}

function App() {
  const [screen, setScreen] =
    useState<Screen>('profile')

  const [profile, setProfile] =
    useState<ScoutProfile>({
      name: '',
      scoutId: '',
    })

  const [
    savedProfile,
    setSavedProfile,
  ] = useState<ScoutProfile | null>(() => {
    const stored =
      localStorage.getItem(
        'pitScoutProfile',
      )

    if (!stored) {
      return null
    }

    try {
      return JSON.parse(
        stored,
      ) as ScoutProfile
    } catch {
      return null
    }
  })

  const [
    selectedEvent,
    setSelectedEvent,
  ] = useState<EventOption | null>(null)

  const [
    selectedTeam,
    setSelectedTeam,
  ] = useState<TeamOption | null>(null)

  const [teams, setTeams] =
    useState<TeamOption[]>(mockTeams)

  const [
    loadingStatuses,
    setLoadingStatuses,
  ] = useState(false)

  const [
    statusError,
    setStatusError,
  ] = useState<string | null>(null)
const [
  claimingTeamNumber,
  setClaimingTeamNumber,
] = useState<number | null>(null)

const [
  claimError,
  setClaimError,
] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedEvent) {
      return
    }

    setLoadingStatuses(true)
    setStatusError(null)

    const submissionsQuery = query(
      collection(
        db,
        'pitSubmissions',
      ),
      where(
        'eventKey',
        '==',
        selectedEvent.key,
      ),
    )

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const submissions:
          FirestorePitSubmission[] =
          snapshot.docs.map((document) => {
            const data = document.data()

            return {
              eventKey:
                typeof data.eventKey ===
                'string'
                  ? data.eventKey
                  : undefined,

              teamNumber:
                typeof data.teamNumber ===
                'number'
                  ? data.teamNumber
                  : undefined,

              collectorName:
                typeof data.collectorName ===
                'string'
                  ? data.collectorName
                  : undefined,

              status:
                typeof data.status ===
                'string'
                  ? data.status
                  : undefined,
            }
          })

        const updatedTeams:
          TeamOption[] =
          mockTeams.map((team) => {
            const submission =
              submissions.find(
                (entry) =>
                  entry.teamNumber ===
                  team.teamNumber,
              )

            if (!submission) {
              return {
                ...team,
                status: 'not-started',
              }
            }

            const collectorDetails =
              submission.collectorName
                ? {
                    collectorName:
                      submission.collectorName,
                  }
                : {}

            if (
              submission.status ===
              'complete'
            ) {
              return {
                ...team,
                ...collectorDetails,
                status: 'complete',
              }
            }

            return {
              ...team,
              ...collectorDetails,
              status: 'in-progress',
            }
          })

        setTeams(updatedTeams)
        setLoadingStatuses(false)
      },
      (error) => {
        console.error(
          'Could not load pit statuses:',
          error,
        )

        setLoadingStatuses(false)

        setStatusError(
          'Could not load shared team statuses.',
        )
      },
    )

    return () => {
      unsubscribe()
    }
  }, [selectedEvent])

  function handleProfileSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const cleanName =
      profile.name.trim()

    const cleanScoutId =
      profile.scoutId.trim()

    if (
      !cleanName ||
      !cleanScoutId
    ) {
      return
    }

    const completedProfile:
      ScoutProfile = {
        name: cleanName,
        scoutId: cleanScoutId,
      }

    setSavedProfile(
      completedProfile,
    )

    localStorage.setItem(
      'pitScoutProfile',
      JSON.stringify(
        completedProfile,
      ),
    )
  }

  function continueFromProfile() {
    setScreen('events')
  }

  async function selectEvent(
    event: EventOption,
  ) {
    setSelectedEvent(event)
    setSelectedTeam(null)
    setClaimError(null)

    try {
      const response =
        await fetch(
          `https://botbusters-scouting-backend.onrender.com/api/lead/events/${event.key}/teams`,
        )

      if (!response.ok) {
        throw new Error(
          `Team directory returned ${response.status}.`,
        )
      }

      const data =
        await response.json() as {
          teams?: Array<{
            team_number?: number
            teamNumber?: number
            nickname?: string | null
            name?: string | null
          }>
        }

      const loadedTeams: TeamOption[] =
        (data.teams ?? [])
          .map((team) => ({
            teamNumber:
              team.team_number ??
              team.teamNumber ??
              0,

            nickname:
              team.nickname ??
              team.name ??
              '',

            status:
              'not-started' as const,
          }))
          .filter(
            (team) =>
              Number.isFinite(
                team.teamNumber,
              ) &&
              team.teamNumber > 0,
          )
          .sort(
            (a, b) =>
              a.teamNumber -
              b.teamNumber,
          )

      if (loadedTeams.length === 0) {
        throw new Error(
          'No teams were returned for this event.',
        )
      }

      /*
        Keep mockTeams as the base roster because
        the existing Firebase listener overlays its
        live statuses onto this array.
      */
      mockTeams.splice(
        0,
        mockTeams.length,
        ...loadedTeams,
      )

      setTeams([
        ...loadedTeams,
      ])

      setScreen('teams')
    } catch (error) {
      console.error(
        'Could not load event teams:',
        error,
      )

      setClaimError(
        'Could not load the team list. Check your connection and try again.',
      )

      setTeams([])
      setScreen('teams')
    }
  }

  async function selectTeam(
  team: TeamOption,
) {
  if (!selectedEvent || !savedProfile) {
    return
  }

  setClaimingTeamNumber(
    team.teamNumber,
  )

  setClaimError(null)

  const documentReference = doc(
    db,
    'pitSubmissions',
    `${selectedEvent.key}_${team.teamNumber}`,
  )

  try {
    const result = await runTransaction(
      db,
      async (transaction) => {
        const snapshot =
          await transaction.get(
            documentReference,
          )

        if (snapshot.exists()) {
          const data = snapshot.data()

          const existingStatus =
            typeof data.status === 'string'
              ? data.status
              : ''

          const existingCollectorId =
            typeof data.collectorId ===
            'string'
              ? data.collectorId
              : ''

          const existingCollectorName =
            typeof data.collectorName ===
            'string'
              ? data.collectorName
              : 'another scout'

          if (
            existingStatus ===
            'complete'
          ) {
            return {
              allowed: true,
              alreadyComplete: true,
              collectorName:
                existingCollectorName,
            }
          }

          if (
            existingStatus ===
              'in-progress' &&
            existingCollectorId !==
              savedProfile.scoutId
          ) {
            return {
              allowed: false,
              alreadyComplete: false,
              collectorName:
                existingCollectorName,
            }
          }
        }

        transaction.set(
          documentReference,
          {
            eventKey:
              selectedEvent.key,

            teamNumber:
              team.teamNumber,

            collectorName:
              savedProfile.name,

            collectorId:
              savedProfile.scoutId,

            status: 'in-progress',

            claimedAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          },
        )

        return {
          allowed: true,
          alreadyComplete: false,
          collectorName:
            savedProfile.name,
        }
      },
    )

    if (!result.allowed) {
      const takeOver =
        window.confirm(
          `Team ${team.teamNumber} is currently being scouted by ${result.collectorName}.\n\nDo you want to take over this team?`,
        )

      if (!takeOver) {
        return
      }

      await setDoc(
        documentReference,
        {
          eventKey:
            selectedEvent.key,

          teamNumber:
            team.teamNumber,

          collectorName:
            savedProfile.name,

          collectorId:
            savedProfile.scoutId,

          status: 'in-progress',

          claimedAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      )
    }

    setSelectedTeam(team)
    setScreen('pit-form')
  } catch (error) {
    console.error(
      'Could not claim team:',
      error,
    )

    setClaimError(
      `Could not claim Team ${team.teamNumber}. Check your connection and try again.`,
    )
  } finally {
    setClaimingTeamNumber(null)
  }
}

  function changeProfile() {
    setSavedProfile(null)

    setProfile({
      name: '',
      scoutId: '',
    })

    localStorage.removeItem(
      'pitScoutProfile',
    )

    setScreen('profile')
  }

  function markTeamCompleteLocally(
    teamNumber: number,
    collectorName: string,
  ) {
    setTeams((currentTeams) =>
      currentTeams.map((team) => {
        if (
          team.teamNumber !==
          teamNumber
        ) {
          return team
        }

        return {
          ...team,
          status: 'complete',
          collectorName,
        }
      }),
    )
  }

  return (
    <main className="app-shell">
      {screen === 'profile' && (
        <section className="profile-card">
          <p className="eyebrow">
            Botbusters 4635
          </p>

          <h1>
            Pit Scout Profile
          </h1>

          <p className="subtitle">
            Enter your information
            before collecting robot
            data.
          </p>

          {savedProfile ? (
            <div className="saved-profile">
              <p className="status-label">
                Active scout
              </p>

              <h2>
                {savedProfile.name}
              </h2>

              <p>
                Scout ID:{' '}
                {savedProfile.scoutId}
              </p>

              <button
                type="button"
                className="secondary-button"
                onClick={changeProfile}
              >
                Change profile
              </button>

              <button
                type="button"
                onClick={
                  continueFromProfile
                }
              >
                Continue to team list
              </button>
            </div>
          ) : (
            <form
              className="profile-form"
              onSubmit={
                handleProfileSubmit
              }
            >
              <label>
                Scout name

                <input
                  type="text"
                  value={profile.name}
                  placeholder="Example: Eden"
                  autoComplete="name"
                  onChange={(event) => {
                    setProfile({
                      ...profile,
                      name:
                        event.target.value,
                    })
                  }}
                />
              </label>

              <label>
                Scout ID

                <input
                  type="text"
                  value={profile.scoutId}
                  placeholder="Example: EGS-07"
                  onChange={(event) => {
                    setProfile({
                      ...profile,
                      scoutId:
                        event.target.value,
                    })
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={
                  !profile.name.trim() ||
                  !profile.scoutId.trim()
                }
              >
                Save profile
              </button>
            </form>
          )}
        </section>
      )}

      {screen === 'events' && (
        <section className="page-card">
          <div className="page-header">
            <div>
              <p className="eyebrow">
                Active scout
              </p>

              <h1>
                Select Event
              </h1>
            </div>

            <button
              type="button"
              className="small-button secondary-button"
              onClick={() =>
                setScreen('profile')
              }
            >
              Back
            </button>
          </div>

          <p className="subtitle">
            Choose the competition
            where you are collecting
            pit data.
          </p>

          <div className="card-list">
            {mockEvents.map(
              (event) => (
                <button
                  type="button"
                  className="selection-card"
                  key={event.key}
                  onClick={() =>
                    selectEvent(event)
                  }
                >
                  <strong>
                    {event.name}
                  </strong>

                  <span>
                    {event.city} ·{' '}
                    {event.year}
                  </span>

                  <span className="event-key">
                    {event.key}
                  </span>
                </button>
              ),
            )}
          </div>
        </section>
      )}

      {screen === 'teams' &&
        selectedEvent && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="eyebrow">
                  {selectedEvent.name}
                </p>

                <h1>
                  Team List
                </h1>
              </div>

              <button
                type="button"
                className="small-button secondary-button"
                onClick={() =>
                  setScreen('events')
                }
              >
                Back
              </button>
            </div>

            <p className="subtitle">
              Select the team whose
              robot you are inspecting.
            </p>

            {loadingStatuses && (
              <div className="status-message">
                Loading shared team
                statuses...
              </div>
            )}

            {statusError && (
              <div
                role="alert"
                className="save-error"
              >
                {statusError}
              </div>
            )}
            
            {claimError && (
              <div
                role="alert"
              className="save-error"
            >
            {claimError}
              </div>
             )}

            <div className="card-list">
              {teams.map((team) => (
                <button
              type="button"
              className="team-card"
            key={team.teamNumber}
              disabled={
              claimingTeamNumber !== null
               }
  onClick={() => {
    void selectTeam(team)
              }}
                  >
                
                  <div>
                    <strong>
                      Team{' '}
                      {team.teamNumber}
                    </strong>

                    <span>
                      {team.nickname}
                    </span>
                  </div>

                  <div
                    className={
                      `status-badge ` +
                      team.status
                    }
                  >
                    {claimingTeamNumber ===
                    team.teamNumber
                    ? 'Claiming...'
                  : team.status ===
                    'not-started'
                   ? 'Not started'
                  : null}

                    {team.status ===
                      'in-progress' &&
                      `In progress${
                        team.collectorName
                          ? ` — ${team.collectorName}`
                          : ''
                      }`}

                    {team.status ===
                      'complete' &&
                      `Complete${
                        team.collectorName
                          ? ` — ${team.collectorName}`
                          : ''
                      }`}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      {screen === 'pit-form' &&
        selectedEvent &&
        selectedTeam &&
        savedProfile && (
          <PitForm
            key={`${selectedEvent.key}_${selectedTeam.teamNumber}`}
            eventKey={
              selectedEvent.key
            }
            teamNumber={
              selectedTeam.teamNumber
            }
            collectorName={
              savedProfile.name
            }
            collectorId={
              savedProfile.scoutId
            }
            onBack={() =>
              setScreen('teams')
            }
            onSaved={() =>
              markTeamCompleteLocally(
                selectedTeam.teamNumber,
                savedProfile.name,
              )
            }
          />
        )}
    </main>
  )
}

export default App