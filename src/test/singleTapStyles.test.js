import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const biomasaCss = readFileSync(
  join(process.cwd(), 'src/modules/biomasa/biomasa.css'),
  'utf8',
);

const muestreosCss = readFileSync(
  join(process.cwd(), 'src/modules/gestion/submodules/muestreos.css'),
  'utf8',
);

describe('acciones reveladas por hover', () => {
  it('no deja capas invisibles capturando el primer click', () => {
    expect(biomasaCss).toMatch(
      /\.harvest-week-v2-actions\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s,
    );
    expect(biomasaCss).toMatch(
      /\.wk-nota-btn\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s,
    );
    expect(biomasaCss).toMatch(
      /\.wk-nota-add\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s,
    );
    expect(muestreosCss).toMatch(
      /\.mu-hide-btn\s*\{[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s,
    );
  });

  it('mantiene visibles y clickeables las acciones en punteros tactiles', () => {
    expect(biomasaCss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?\.harvest-week-v2-actions,[\s\S]*?opacity:\s*1;[\s\S]*?pointer-events:\s*auto;/,
    );
    expect(muestreosCss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*\{[\s\S]*?\.mu-hide-btn\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?pointer-events:\s*auto;/,
    );
  });
});
