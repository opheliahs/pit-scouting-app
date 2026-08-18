export type PitScoutData = {
  eventKey: string
  teamNumber: number

  collectorName: string
  collectorId: string

  // Fuel
  maximumFuelCapacity: number | null

  // Robot measurements
  widthCm: number | null
  lengthCm: number | null
  heightCm: number | null
  weightKg: number | null
  measurementsIncludeBumpers: boolean

  // Robot
  drivetrain: string
  intakeType: string
  shooterType: string

  canIntakeWhileShooting: boolean
  canCrossBump: boolean
  canCrossTrench: boolean
  canClimb: boolean

  // Notes
  notes: string

  createdAt: string
}

export function createEmptyPitScoutData(
  eventKey: string,
  teamNumber: number,
  collectorName: string,
  collectorId: string,
): PitScoutData {
  return {
    eventKey,
    teamNumber,

    collectorName,
    collectorId,

    maximumFuelCapacity: null,

    widthCm: null,
    lengthCm: null,
    heightCm: null,
    weightKg: null,
    measurementsIncludeBumpers: true,

    drivetrain: '',
    intakeType: '',
    shooterType: '',

    canIntakeWhileShooting: false,
    canCrossBump: false,
    canCrossTrench: false,
    canClimb: false,

    notes: '',

    createdAt: new Date().toISOString(),
  }
}