import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMandiAadatTotals,
  filterAccountsByPersona,
  getPersonaAdaptation,
  getPersonaCapabilities,
  getTimeGreeting,
  normalizePersonaPrefs,
} from './persona';
import type { PersonaContext } from './types';

describe('Persona Adaptation & Greeting Helpers', () => {
  it('returns time-appropriate greetings deterministically', () => {
    assert.equal(getTimeGreeting(8), 'Good Morning');
    assert.equal(getTimeGreeting(14), 'Good Afternoon');
    assert.equal(getTimeGreeting(20), 'Good Evening');
    assert.equal(getTimeGreeting(1), 'Good Evening');
  });

  it('normalizes multi-select persona preferences with safe fallback', () => {
    const fallback = normalizePersonaPrefs(undefined);
    assert.equal(fallback.onboarded, false);
    assert.deepEqual(fallback.categories, ['kirana']);
    assert.equal(fallback.activeFocus, 'kirana');

    const multi = normalizePersonaPrefs({
      onboarded: true,
      categories: ['mandi', 'wholesale', 'mandi'],
      activeFocus: 'mandi',
    });
    assert.equal(multi.onboarded, true);
    assert.deepEqual(multi.categories, ['mandi', 'wholesale']);
    assert.equal(multi.activeFocus, 'mandi');

    const fixedFocus = normalizePersonaPrefs({
      onboarded: true,
      categories: ['personal'],
      activeFocus: 'wholesale',
    });
    assert.equal(fixedFocus.activeFocus, 'personal');
  });

  it('adapts voice hints and quick notes per selected category', () => {
    const mandi = getPersonaAdaptation(['mandi', 'kirana'], 'mandi');
    assert.equal(mandi.focusBadge, 'Mandi / Vyapari');
    assert.ok(mandi.voiceSamples.some((s) => s.toLowerCase().includes('bori')));
    assert.ok(mandi.quickNotePresets.some((p) => p.toLowerCase().includes('aadat')));

    const wholesale = getPersonaAdaptation(['wholesale'], 'wholesale');
    assert.equal(wholesale.focusBadge, 'Wholesale');
    assert.ok(wholesale.heroCaption.includes('GST'));
  });

  it('enforces strict persona feature gating per mode', () => {
    const personal = getPersonaCapabilities('personal');
    assert.equal(personal.showGalla, false);
    assert.equal(personal.showSuppliers, false);
    assert.equal(personal.showGstBills, false);
    assert.equal(personal.showStock, false);
    assert.equal(personal.leftDockLabel, 'Notes');
    assert.equal(personal.rightDockLabel, 'Activity');

    const mandi = getPersonaCapabilities('mandi');
    assert.equal(mandi.showGalla, true);
    assert.equal(mandi.showMandiCalculator, true);
    assert.equal(mandi.primarySegmentLabel, 'Kisan');
    assert.equal(mandi.secondarySegmentLabel, 'Vyapari');
    assert.equal(mandi.gallaSegmentLabel, 'Mandi Cash');

    const store = getPersonaCapabilities('kirana');
    assert.equal(store.showGalla, true);
    assert.equal(store.showGstBills, true);
    assert.equal(store.showStock, true);
    assert.equal(store.showMandiCalculator, false);
  });

  it('filters unified records by personaContext while preserving legacy records and Show All override', () => {
    const records: Array<{ id: string; personaContext?: PersonaContext }> = [
      { id: 'legacy_untagged' },
      { id: 'personal_1', personaContext: 'personal' },
      { id: 'mandi_1', personaContext: 'mandi' },
      { id: 'store_1', personaContext: 'kirana' },
    ];

    const mandiOnly = filterAccountsByPersona(records, 'mandi', false).map((r) => r.id);
    assert.deepEqual(mandiOnly, ['legacy_untagged', 'mandi_1']);

    const personalOnly = filterAccountsByPersona(records, 'personal', false).map((r) => r.id);
    assert.deepEqual(personalOnly, ['legacy_untagged', 'personal_1']);

    const combined = filterAccountsByPersona(records, 'mandi', true).map((r) => r.id);
    assert.equal(combined.length, 4);
  });

  it('calculates Mandi Bori, Wazan & Aadat commission accurately', () => {
    const res = calculateMandiAadatTotals({
      boriCount: 10,
      weightKg: 500,
      ratePerQuintal: 2400,
      aadatPct: 2,
    });
    assert.equal(res.grossAmount, 12000);
    assert.equal(res.aadatFee, 240);
    assert.equal(res.netTotal, 12240);
    assert.ok(res.formattedNote.includes('10 Bori'));
    assert.ok(res.formattedNote.includes('500kg'));
  });
});

