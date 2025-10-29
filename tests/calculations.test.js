import {
  calculateFuelCost,
  calculateHelpersTotal,
  calculateTotals,
} from '../src/utils/calculations.js';

describe('calculateFuelCost', () => {
  it('computes fuel cost using rate', () => {
    expect(calculateFuelCost(50, 0.2)).toBeCloseTo(10);
  });

  it('handles invalid input', () => {
    expect(calculateFuelCost('abc', 0.2)).toBeCloseTo(0);
  });
});

describe('calculateHelpersTotal', () => {
  it('multiplies helpers, days, and rate', () => {
    expect(calculateHelpersTotal(2, 3, 120)).toBeCloseTo(720);
  });
});

describe('calculateTotals', () => {
  it('aggregates materials, services, helpers, fuel, and margin', () => {
    const totals = calculateTotals({
      materialsTotal: 500,
      services: [
        { total: 450 },
        { total: 225 },
      ],
      helpersTotal: 720,
      fuelCost: 36,
      margin: 25,
    });
    expect(totals.cost).toBeCloseTo(1931);
    expect(totals.clientPrice).toBeCloseTo(2413.75);
    expect(totals.gross).toBeCloseTo(482.75);
  });
});
