// A feladatok időzítése: mikor végezhető el az esküvőhöz képest.
// A sortRank kisebb értéke közelebb van az esküvő napjához.

export const TASK_TIMING_OPTIONS = [
  {
    value: 'wedding_day',
    label: 'Aznap',
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
    value: 'wedding_week',
    label: 'Az esküvő hetében',
    sortRank: 4,
  },
  {
    value: 'weeks_before_1',
    label: '1 héttel korábban',
    sortRank: 5,
  },
  {
    value: 'weeks_before_2_3',
    label: '2–3 héttel korábban',
    sortRank: 6,
  },
  {
    value: 'months_before_1',
    label: '1 hónappal korábban',
    sortRank: 7,
  },
  {
    value: 'months_before_2',
    label: '2 hónappal korábban',
    sortRank: 8,
  },
  {
    value: 'months_before_3_6',
    label: '3–6 hónappal korábban',
    sortRank: 9,
  },
  {
    value: 'months_before_more_than_6',
    label: 'Több mint 6 hónappal korábban',
    sortRank: 10,
  },
]

export const DEFAULT_TASK_TIMING = 'months_before_more_than_6'

const LEGACY_TIMING_MAP = {
  week_before: 'wedding_week',
  rsvp_window: 'months_before_1',
  anytime: 'months_before_more_than_6',
  months_before_3: 'months_before_3_6',
  months_before_more_than_3: 'months_before_more_than_6',
}

const timingByValue = Object.fromEntries(
  TASK_TIMING_OPTIONS.map((option) => [option.value, option]),
)

export function normalizeTaskTiming(value) {
  const mapped = LEGACY_TIMING_MAP[value] || value
  return timingByValue[mapped] ? mapped : DEFAULT_TASK_TIMING
}

export function taskTimingLabel(value) {
  return (
    timingByValue[normalizeTaskTiming(value)]?.label ||
    'Több mint 6 hónappal korábban'
  )
}

export function taskTimingSortRank(value) {
  return timingByValue[normalizeTaskTiming(value)]?.sortRank ?? 10
}
