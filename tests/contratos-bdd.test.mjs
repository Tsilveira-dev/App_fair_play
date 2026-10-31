import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { catalogo } from './helpers/frontend.mjs';

// FP-01: contratos executáveis dos cenários em features/questionario-diario.feature.
const source = await readFile('public/script.js', 'utf8');
const start = source.indexOf('function hojeFortaleza(');
const end = source.indexOf('/*\n * ESTADO LOCAL', start);
assert.ok(start >= 0 && end > start, 'Rotinas de data do aplicativo disponíveis');
const calendario = runInNewContext(
  "const FUSO = 'America/Fortaleza';\n" +
  source.slice(start, end) +
  '\n;({hojeFortaleza,diferencaDias,somarDias})'
);
const perguntas = catalogo().PERGUNTAS_POR_DIA;

test('BDD FP-01: 27/10 é Dia 1, 28/10 é Dia 2 e as perguntas diferem', () => {
  const inicio = '2026-10-27';
  assert.equal(calendario.diferencaDias(inicio, '2026-10-27') + 1, 1);
  assert.equal(calendario.diferencaDias(inicio, '2026-10-28') + 1, 2);
  assert.equal(perguntas.length, 7);
  assert.equal(perguntas[0].length, 5);
  assert.equal(perguntas[1].length, 5);
  assert.notEqual(perguntas[0][0].q, perguntas[1][0].q);
  assert.equal(perguntas[1][0].id, 'D02_P1');
});
test('BDD FP-01: calendário permanece correto na virada de mês', () => {
  assert.equal(calendario.diferencaDias('2026-10-27', '2026-11-01') + 1, 6);
  assert.equal(calendario.diferencaDias('2026-10-27', '2026-11-02') + 1, 7);
  assert.equal(calendario.somarDias('2026-10-27', 6), '2026-11-02');
});
test('BDD FP-01: dia local segue America/Fortaleza, não UTC', () => {
  assert.equal(calendario.hojeFortaleza(new Date('2026-10-28T01:30:00Z')), '2026-10-27');
  assert.equal(calendario.hojeFortaleza(new Date('2026-10-28T03:30:00Z')), '2026-10-28');
});
test('BDD FP-01: todos os sete dias têm cinco perguntas identificadas corretamente', () => {
  for (let dia = 1; dia <= 7; dia++) {
    assert.equal(perguntas[dia - 1].length, 5);
    for (let i = 1; i <= 5; i++) {
      assert.equal(perguntas[dia - 1][i - 1].id, 'D' + String(dia).padStart(2, '0') + '_P' + i);
    }
  }
});
