// A feladatok időzítése: mikor végezhető el az esküvőhöz képest.
// A sortRank kisebb értéke közelebb van az esküvő napjához.

export const TASK_TIMING_OPTIONS = [
  {
    value: 'wedding_day',
    label: 'Esküvő napján',
    sortRank: 0,
  },
  {
    value: 'days_before_1',
    label: '1 nappal az esküvő előtt',
    sortRank: 1,
  },
  {
    value: 'days_before_2',
    label: '2 nappal az esküvő előtt',
    sortRank: 2,
  },
  {
    value: 'days_before_3',
    label: '3 nappal az esküvő előtt',
    sortRank: 3,
  },
  {
    value: 'week_before',
    label: 'Az esküvő előtti héten',
    sortRank: 4,
  },
  {
    value: 'rsvp_window',
    label: 'Visszaküldési időn belül',
    sortRank: 5,
  },
  {
    value: 'anytime',
    label: 'Bármikor',
    sortRank: 6,
  },
]

export const DEFAULT_TASK_TIMING = 'anytime'

const timingByValue = Object.fromEntries(
  TASK_TIMING_OPTIONS.map((option) => [option.value, option]),
)

export function normalizeTaskTiming(value) {
  return timingByValue[value] ? value : DEFAULT_TASK_TIMING
}

export function taskTimingLabel(value) {
  return timingByValue[normalizeTaskTiming(value)]?.label || 'Bármikor'
}

export function taskTimingSortRank(value) {
  return timingByValue[normalizeTaskTiming(value)]?.sortRank ?? 6
}
