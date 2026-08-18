export type ScoutProfile = {
  name: string
  scoutId: string
}

export type EventOption = {
  key: string
  name: string
  city: string
  year: number
}

export type TeamOption = {
  teamNumber: number
  nickname: string
  status: 'not-started' | 'in-progress' | 'complete'
  collectorName?: string
}