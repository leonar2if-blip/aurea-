// Utilidad compartida por patch-android-widgets.mjs y patch-android-backup.mjs:
// registra plugins nativos propios en MainActivity.java sin reemplazar el archivo entero.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TEMPLATE = /class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}/;
const START = `package com.leonar2if.aurea;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`;

/** Garantiza la línea registerPlugin(<clase>.class); antes de super.onCreate(...). Idempotente. */
export function ensureRegister(mainPath, className) {
  let s = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : START;
  if (TEMPLATE.test(s)) s = START; // plantilla vacía de Capacitor
  const line = `registerPlugin(${className}.class);`;
  if (!s.includes(line)) {
    if (!/class\s+MainActivity\s+extends\s+BridgeActivity/.test(s)) throw new Error('MainActivity.java no es una BridgeActivity reconocible');
    const m = s.match(/([ \t]*)super\.onCreate\(\s*\w+\s*\);/);
    if (!m) throw new Error(`MainActivity.java: añade ${line} antes de super.onCreate(...) a mano`);
    s = s.replace(m[0], () => `${m[1]}${line}\n${m[0]}`);
  }
  writeFileSync(mainPath, s);
  return s;
}
