import type {
  EventOption,
  TeamOption,
} from './types'

export const mockEvents: EventOption[] = [
  {
    key: '2026mxmo',
    name: 'Regional Monterrey',
    city: 'Monterrey',
    year: 2026,
  },
  {
    key: '2026lake',
    name: 'Bayou Regional',
    city: 'Kenner',
    year: 2026,
  },
]

export const mockTeams: TeamOption[] = [
  {
    teamNumber: 4635,
    nickname: 'Botbusters',
    status: 'complete',
    collectorName: 'Eden',
  },
  {
    teamNumber: 3478,
    nickname: 'LamBot',
    status: 'in-progress',
    collectorName: 'Ana',
  },
  {
    teamNumber: 4010,
    nickname: 'Nautilus',
    status: 'not-started',
  },
  {
    teamNumber: 6017,
    nickname: 'Cyberius',
    status: 'not-started',
  },
]
