import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/lib/dateUtils.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
}).outputText
const modulePath = join(tmpdir(), `baotri-date-utils-${process.pid}-${Date.now()}.mjs`)
await (await import('node:fs/promises')).writeFile(modulePath, compiled, 'utf8')
const dateUtils = await import(pathToFileURL(modulePath).href)
await (await import('node:fs/promises')).rm(modulePath, { force: true })

test('calendar date follows Vietnam local time after UTC midnight boundary', () => {
  const previousTz = process.env.TZ
  process.env.TZ = 'Asia/Ho_Chi_Minh'
  try {
    const date = new Date('2026-11-20T18:30:00.000Z')
    assert.equal(dateUtils.formatLocalDate(date), '2026-11-21')
  } finally {
    if (previousTz === undefined) delete process.env.TZ
    else process.env.TZ = previousTz
  }
})

test('calendar date keeps the same local day before UTC date changes', () => {
  const previousTz = process.env.TZ
  process.env.TZ = 'Asia/Ho_Chi_Minh'
  try {
    const date = new Date('2026-11-20T02:00:00.000Z')
    assert.equal(dateUtils.formatLocalDate(date), '2026-11-20')
  } finally {
    if (previousTz === undefined) delete process.env.TZ
    else process.env.TZ = previousTz
  }
})
