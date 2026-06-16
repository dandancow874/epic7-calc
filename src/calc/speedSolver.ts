export type AllySpeedInput = {
  speed: number;
  cr: number;
};

export type EnemySpeedInput = {
  label: string;
  cr: number;
};

export type SpeedSolveOptions = {
  displayTolerance: boolean;
};

export type SpeedResult = {
  label: string;
  cr: number;
  min: number;
  max: number;
  mode: number;
  mean: number;
  p80: [number, number];
  p95: [number, number];
  confidence: '高' | '中' | '低';
  histogram: Array<{ speed: number; probability: number }>;
};

export type OpeningSpeedSolveResult = {
  allyFit: number;
  timeRange: [number, number];
  results: SpeedResult[];
};

const RANDOM_CR_MIN = 0;
const RANDOM_CR_MAX = 5;
const SAMPLE_STEP = 0.05;

export function solveOpeningSpeeds(
  allies: AllySpeedInput[],
  enemies: EnemySpeedInput[],
  options: SpeedSolveOptions,
): OpeningSpeedSolveResult {
  const usableAllies = allies.filter((ally) => ally.speed > 0 && ally.cr > 0);
  const anchor = usableAllies[0];
  if (!anchor?.speed) {
    return { allyFit: 0, timeRange: [0, 0], results: [] };
  }

  const timeline = buildTimelineSamples(usableAllies, anchor, options);
  const totalWeight = timeline.reduce((sum, sample) => sum + sample.weight, 0);
  const timeRange: [number, number] = timeline.length
    ? [Math.min(...timeline.map((sample) => sample.time)), Math.max(...timeline.map((sample) => sample.time))]
    : [0, 0];

  return {
    allyFit: totalWeight,
    timeRange,
    results: enemies.filter((enemy) => enemy.cr > 0).map((enemy) => solveEnemy(enemy, timeline, options)),
  };
}

function buildTimelineSamples(allies: AllySpeedInput[], anchor: AllySpeedInput, options: SpeedSolveOptions) {
  const samples: Array<{ time: number; weight: number }> = [];
  const [anchorMinCr, anchorMaxCr] = displayRange(anchor.cr, options.displayTolerance);

  for (let anchorCr = anchorMinCr; anchorCr <= anchorMaxCr + 1e-9; anchorCr += SAMPLE_STEP) {
    for (let r1 = RANDOM_CR_MIN; r1 <= RANDOM_CR_MAX + 1e-9; r1 += SAMPLE_STEP) {
      if (anchorCr < r1) continue;
      const time = (anchorCr - r1) / anchor.speed;
      if (time <= 0) continue;
      let weight = SAMPLE_STEP * SAMPLE_STEP;

      for (const ally of allies) {
        if (ally === anchor) continue;
        if (!ally.speed || !Number.isFinite(ally.cr)) continue;
        const [minCr, maxCr] = displayRange(ally.cr, options.displayTolerance);
        const requiredRandomMin = minCr - ally.speed * time;
        const requiredRandomMax = maxCr - ally.speed * time;
        const overlap = overlapLength(requiredRandomMin, requiredRandomMax, RANDOM_CR_MIN, RANDOM_CR_MAX);
        if (overlap <= 0) {
          weight = 0;
          break;
        }
        weight *= overlap / (RANDOM_CR_MAX - RANDOM_CR_MIN);
      }

      if (weight > 0) samples.push({ time, weight });
    }
  }

  return samples;
}

function solveEnemy(enemy: EnemySpeedInput, timeline: Array<{ time: number; weight: number }>, options: SpeedSolveOptions): SpeedResult {
  const histogram = new Map<number, number>();
  const [minCr, maxCr] = displayRange(enemy.cr, options.displayTolerance);

  for (const sample of timeline) {
    for (let trueCr = minCr; trueCr <= maxCr + 1e-9; trueCr += SAMPLE_STEP) {
      for (let randomCr = RANDOM_CR_MIN; randomCr <= RANDOM_CR_MAX + 1e-9; randomCr += SAMPLE_STEP) {
        if (trueCr < randomCr) continue;
        const speed = Math.round((trueCr - randomCr) / sample.time);
        if (!Number.isFinite(speed) || speed <= 0) continue;
        const previous = histogram.get(speed) || 0;
        histogram.set(speed, previous + sample.weight);
      }
    }
  }

  const entries = Array.from(histogram.entries())
    .sort(([a], [b]) => a - b)
    .map(([speed, weight]) => ({ speed, probability: weight }));
  const total = entries.reduce((sum, item) => sum + item.probability, 0) || 1;
  const normalized = entries.map((item) => ({ ...item, probability: item.probability / total }));
  const mode = normalized.reduce((best, item) => item.probability > best.probability ? item : best, normalized[0] || { speed: 0, probability: 0 });
  const mean = normalized.reduce((sum, item) => sum + item.speed * item.probability, 0);
  const p80 = centralInterval(normalized, 0.8);
  const p95 = centralInterval(normalized, 0.95);

  return {
    label: enemy.label,
    cr: enemy.cr,
    min: normalized[0]?.speed || 0,
    max: normalized[normalized.length - 1]?.speed || 0,
    mode: mode.speed,
    mean,
    p80,
    p95,
    confidence: confidenceFromInterval(p80),
    histogram: normalized,
  };
}

function displayRange(value: number, tolerant: boolean): [number, number] {
  const safe = Math.max(0, Math.min(100, value));
  if (!tolerant) return [safe, safe];
  return [safe, Math.min(100, safe + 0.999)];
}

function overlapLength(aMin: number, aMax: number, bMin: number, bMax: number) {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function centralInterval(histogram: Array<{ speed: number; probability: number }>, mass: number): [number, number] {
  if (!histogram.length) return [0, 0];
  const lowerTail = (1 - mass) / 2;
  const upperTail = 1 - lowerTail;
  return [quantile(histogram, lowerTail), quantile(histogram, upperTail)];
}

function quantile(histogram: Array<{ speed: number; probability: number }>, target: number) {
  let cumulative = 0;
  for (const item of histogram) {
    cumulative += item.probability;
    if (cumulative >= target) return item.speed;
  }
  return histogram[histogram.length - 1].speed;
}

function confidenceFromInterval(interval: [number, number]) {
  const width = interval[1] - interval[0];
  if (width <= 8) return '高';
  if (width <= 18) return '中';
  return '低';
}
