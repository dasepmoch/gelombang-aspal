// Builds audio.wav from audio/mix.json: every line delayed to its cue, summed,
// then loudness-normalised. Requires ffmpeg on PATH.
//
//   node audio/mix.mjs
//
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mix = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio/mix.json'), 'utf8'));

const inputs = [];
const filters = [];
const labels = [];

mix.lines.forEach((line, i) => {
  const file = path.join(ROOT, 'audio', line.file);
  if (!fs.existsSync(file)) throw new Error(`missing voice file: ${line.file}`);
  inputs.push('-i', file);
  const ms = Math.round(line.at * 1000);
  filters.push(`[${i}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
  labels.push(`[a${i}]`);
});

const dur = Number(mix.duration);
filters.push(`${labels.join('')}amix=inputs=${mix.lines.length}:normalize=0,apad=whole_dur=${dur},atrim=0:${dur},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);

const out = path.join(ROOT, 'audio.wav');
execFileSync('ffmpeg', [
  '-y', '-v', 'error', ...inputs,
  '-filter_complex', filters.join(';'),
  '-map', '[aout]', '-t', String(mix.duration), '-ac', '2', '-ar', '48000', out,
], { stdio: 'inherit' });

const size = fs.statSync(out).size;
console.log(`audio.wav ${(size / 1e6).toFixed(1)} MB, ${mix.lines.length} lines, ${mix.duration}s`);
